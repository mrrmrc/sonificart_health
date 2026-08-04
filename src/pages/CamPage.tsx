import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User, ConfigSettings, BlockData, TransformedNoteEvent } from '../types';
import { initialSettings } from '../config/defaults';
import { sonifyImage } from '../services/sonificationService';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

interface MatrixRegion {
    id: string;
    index: number;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    widthPct: number;
    heightPct: number;
    L: number;
    a: number;
    b: number;
    hex: string;
    noteName: string;
    frequencyHz: number;
}

export const CamPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const { t } = useLanguage();

    // Upload & Image State
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState<string>('');

    // Deterministic Scan & Matrix State
    const [matrixRegions, setMatrixRegions] = useState<MatrixRegion[]>([]);
    const [matchedTraditionName, setMatchedTraditionName] = useState<string>('');
    const [matchedCulturalFamily, setMatchedCulturalFamily] = useState<string>('');
    const [scanPatternName, setScanPatternName] = useState<string>('');
    const [audioTrackUrl, setAudioTrackUrl] = useState<string | null>(null);

    // Live Step-by-Step Playback & Cursor State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [activeRegion, setActiveRegion] = useState<MatrixRegion | null>(null);

    // Refs for Audio Synth & Animation Interval
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playbackTimerRef = useRef<any>(null);

    // Grid Dimensions
    const GRID_SIZE = 16; // 16x16 Matrix (256 Regions)

    // Handle File Upload & Deterministic Matrix Analysis
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            stopPlayback();

            // Run Deterministic Color Matrix Analysis
            processDeterministicImageScan(file, url);
        }
    };

    // Deterministic Color Matrix Extraction & Sonification
    const processDeterministicImageScan = async (fileObj: File, imageSrc: string) => {
        setIsAnalyzing(true);
        setAnalysisProgress("Analisi Colorimetrica CIE LAB & Segmentazione Matrice in corso...");
        setAudioTrackUrl(null);
        setMatrixRegions([]);
        setCurrentStepIndex(0);
        setActiveRegion(null);

        try {
            const config: ConfigSettings = {
                ...initialSettings,
                pixelCount: GRID_SIZE * GRID_SIZE,
                bpm: 72,
                enableAccompaniment: false // Melodia Basale Pura
            };

            // 1. Run Full SonificART Deterministic Engine
            const result = await sonifyImage(
                fileObj,
                config,
                (stepIndex: number, status: 'active' | 'completed') => {
                    setAnalysisProgress(`Fase ${stepIndex}/6: ${status}`);
                },
                null,
                'auto'
            );

            // 2. Store Results
            setMatchedTraditionName(result.culturalSelectionResult.tradition.name);
            setMatchedCulturalFamily(result.culturalSelectionResult.tradition.cultural_family);
            setScanPatternName(result.scanPattern.name);
            setAudioTrackUrl(result.audioOutput.audioUrl);

            // 3. Build Matrix Regions Array for Visual Overlay
            const regions: MatrixRegion[] = [];
            const blockDataList: BlockData[] = result.blockAnalysisResult.blocks;
            const melodyEvents: TransformedNoteEvent[] = result.audioOutput.events;

            const cellW = 100 / GRID_SIZE;
            const cellH = 100 / GRID_SIZE;

            blockDataList.forEach((bd: BlockData, idx: number) => {
                const noteEvt = melodyEvents[idx] || melodyEvents[0];

                const gX = idx % GRID_SIZE;
                const gY = Math.floor(idx / GRID_SIZE);

                regions.push({
                    id: `REG_${String(idx + 1).padStart(3, '0')}`,
                    index: idx,
                    x: gX * cellW,
                    y: gY * cellH,
                    gridX: gX,
                    gridY: gY,
                    widthPct: cellW,
                    heightPct: cellH,
                    L: Math.round(bd.lab.l),
                    a: Math.round(bd.lab.a),
                    b: Math.round(bd.lab.b),
                    hex: `rgb(${bd.r}, ${bd.g}, ${bd.b})`,
                    noteName: noteEvt ? noteEvt.noteName : 'C4',
                    frequencyHz: noteEvt ? Math.round(noteEvt.transformedCents ? 440 * Math.pow(2, (noteEvt.baseNote - 69) / 12) : 261) : 261
                });
            });

            setMatrixRegions(regions);
            if (regions.length > 0) {
                setActiveRegion(regions[0]);
            }
            setIsAnalyzing(false);

        } catch (err: any) {
            console.error("Analysis Error:", err);
            setAnalysisProgress(`Errore: ${err.message || 'Impossibile completare la scansione deterministica.'}`);
            setIsAnalyzing(false);
        }
    };

    // Play Note Event for Current Region in Real-Time WebAudio
    const playNoteForRegion = (region: MatrixRegion) => {
        try {
            if (!audioCtxRef.current) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                audioCtxRef.current = new AudioCtx();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;

            // Pure Base Harmonic Sine Wave (1 Region = 1 Base Note)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(region.frequencyHz, now);

            // Envelope tuned to Luminance (L*)
            const vol = 0.05 + (region.L / 100) * 0.25;
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {
            console.warn("Audio note play error:", e);
        }
    };

    // Start Step-by-Step Cursor Movement & Audio Playback
    const startPlayback = () => {
        if (matrixRegions.length === 0 || isAnalyzing) return;
        setIsPlaying(true);

        const stepTimeMs = 350; // 350ms per region step

        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);

        let step = currentStepIndex;

        playbackTimerRef.current = setInterval(() => {
            if (step >= matrixRegions.length) {
                step = 0; // Loop or Stop
            }

            const currentReg = matrixRegions[step];
            setActiveRegion(currentReg);
            setCurrentStepIndex(step);

            // Play the base melodic note for this region
            playNoteForRegion(currentReg);

            step++;
        }, stepTimeMs);
    };

    // Stop Playback
    const stopPlayback = () => {
        if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
        }
        setIsPlaying(false);
    };

    useEffect(() => {
        return () => {
            stopPlayback();
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Scansione Deterministica Colorimetrica Matrice
                        </span>
                        <span className="text-xs text-white/50 font-mono">1 Porzione = 1 Nota</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Segmentazione Matrice + <span className="text-cyan-400">Linea Melodica Basale</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Carica un'immagine per suddividerla in una matrice di porzioni cromatiche CIE LAB, calcolare la traiettoria del cursore e riprodurre la linea melodica basale deterministica.
                    </p>
                </div>

                {/* UPLOAD BUTTON */}
                <label className="cursor-pointer px-8 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:scale-105 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-xl flex items-center gap-3">
                    <i className="fas fa-upload text-base"></i>
                    Carica Immagine Opera
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            </div>

            {/* MAIN SCAN & CURSOR WORKSPACE */}
            {!uploadedImageUrl ? (
                <div className="bg-slate-950/60 backdrop-blur-xl p-16 rounded-2xl border border-dashed border-cyan-500/30 text-center space-y-4">
                    <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto text-cyan-400 text-3xl">
                        <i className="fas fa-image"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessuna Immagine Caricata</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per avviare la segmentazione della matrice colorimetrica e la generazione della linea melodica basale.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: IMAGE DISPLAY WITH LIVE MATRIX CURSOR OVERLAY (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-microscope"></i> Opera: {uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    Matrice {GRID_SIZE}×{GRID_SIZE} ({matrixRegions.length} Porzioni)
                                </span>
                            </div>

                            {/* Image Container with Dynamic Matrix Overlay */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                                <img src={uploadedImageUrl} alt="Opera Scansionata" className="w-full h-full object-cover" />

                                {/* Render Matrix Grid Lines */}
                                {matrixRegions.length > 0 && (
                                    <div className="absolute inset-0 grid grid-cols-16 grid-rows-16 pointer-events-none opacity-30">
                                        {matrixRegions.map((reg) => (
                                            <div key={reg.id} className="border border-white/20" />
                                        ))}
                                    </div>
                                )}

                                {/* ACTIVE STEP CURSOR OVERLAY */}
                                {activeRegion && (
                                    <div
                                        style={{
                                            left: `${activeRegion.x}%`,
                                            top: `${activeRegion.y}%`,
                                            width: `${activeRegion.widthPct}%`,
                                            height: `${activeRegion.heightPct}%`
                                        }}
                                        className="absolute border-2 border-cyan-400 bg-cyan-400/30 shadow-[0_0_20px_#38bdf8] transition-all duration-150 rounded-sm flex items-center justify-center pointer-events-none"
                                    >
                                        <span className="bg-black/90 text-cyan-300 text-[8px] font-mono font-bold px-1 rounded border border-cyan-400/50 -top-4 absolute">
                                            {activeRegion.id}
                                        </span>
                                    </div>
                                )}

                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
                                        <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
                                        <p className="text-xs font-mono text-cyan-300 font-bold">{analysisProgress}</p>
                                    </div>
                                )}
                            </div>

                            {/* CONTROLS */}
                            <div className="flex items-center justify-between gap-4 pt-2">
                                <button
                                    onClick={isPlaying ? stopPlayback : startPlayback}
                                    disabled={isAnalyzing || matrixRegions.length === 0}
                                    className={`flex-1 py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        isPlaying
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                            : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:scale-102 shadow-lg shadow-cyan-950/50'
                                    }`}
                                >
                                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                                    {isPlaying ? 'Pausa Scansione' : 'Avvia Scansione Cursore & Melodia'}
                                </button>

                                <button
                                    onClick={() => { stopPlayback(); setCurrentStepIndex(0); if (matrixRegions[0]) setActiveRegion(matrixRegions[0]); }}
                                    className="px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-mono font-bold uppercase border border-white/10 transition-all"
                                >
                                    <i className="fas fa-rotate-left mr-1"></i> Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: DETERMINISTIC TELEMETRY & ACTIVE REGION DATA (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* MATCHED CULTURAL TRADITION & PATTERN */}
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider block border-b border-white/10 pb-2">
                                📊 Algoritmo Deterministico Applicato
                            </span>

                            <div className="space-y-3 text-xs">
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <span className="text-white/50 text-[10px] block">Tradizione Etnomusicologica Matched</span>
                                    <span className="text-amber-300 font-bold text-sm block mt-0.5">{matchedTraditionName || 'Calcolo in corso...'}</span>
                                    <span className="text-white/60 text-[10px]">{matchedCulturalFamily}</span>
                                </div>

                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <span className="text-white/50 text-[10px] block">Traiettoria Cursore di Scansione</span>
                                    <span className="text-cyan-300 font-bold text-sm block mt-0.5">{scanPatternName || 'Calcolo in corso...'}</span>
                                </div>
                            </div>
                        </div>

                        {/* ACTIVE REGION TELEMETRY */}
                        {activeRegion && (
                            <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 font-mono animate-fade-in">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                        🎯 Porzione Matrice Attiva
                                    </span>
                                    <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded font-bold border border-cyan-500/40">
                                        {activeRegion.id} ({activeRegion.index + 1}/{matrixRegions.length})
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-white/50 text-[10px] block">Coordinate Matrice</span>
                                        <span className="text-white font-bold">[X: {activeRegion.gridX}, Y: {activeRegion.gridY}]</span>
                                    </div>

                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-white/50 text-[10px] block">Colore Esadecimale</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: activeRegion.hex }}></span>
                                            <span className="text-white font-bold">{activeRegion.hex}</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 col-span-2">
                                        <span className="text-white/50 text-[10px] block">Colorimetria CIE LAB D65</span>
                                        <span className="text-cyan-300 font-bold">L*: {activeRegion.L} | a*: {activeRegion.a} | b*: {activeRegion.b}</span>
                                    </div>

                                    <div className="bg-cyan-950/40 p-3 rounded-xl border border-cyan-500/40 col-span-2 flex items-center justify-between">
                                        <div>
                                            <span className="text-white/50 text-[10px] block">Nota Melodica Basale</span>
                                            <span className="text-amber-300 font-bold text-base">{activeRegion.noteName}</span>
                                        </div>
                                        <span className="text-cyan-300 font-bold text-sm bg-black/60 px-3 py-1.5 rounded-lg border border-cyan-500/30">
                                            {activeRegion.frequencyHz} Hz
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* COMPLETED AUDIO TRACK DOWNLOAD */}
                        {audioTrackUrl && (
                            <div className="bg-emerald-950/40 border border-emerald-500/40 p-5 rounded-2xl space-y-3 font-mono animate-fade-in">
                                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">
                                    ✅ Linea Melodica Basale Completa (.WAV)
                                </span>
                                <audio controls src={audioTrackUrl} className="w-full h-10 accent-emerald-500" />
                            </div>
                        )}

                    </div>
                </div>
            )}

        </div>
    );
};
