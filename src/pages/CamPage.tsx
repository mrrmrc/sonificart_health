import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

export interface DeconstructedPiece {
    idNumber: number;
    idCode: string;
    gridX: number;
    gridY: number;
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
    r: number;
    g: number;
    b: number;
    hex: string;
    L: number;
    a: number;
    b_val: number;
    isDetached: boolean;
    midiNote: number;
    noteName: string;
    frequencyHz: number;
}

export const CamPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const { t } = useLanguage();

    // Image Upload State
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isDeconstructing, setIsDeconstructing] = useState(false);
    const [scanStepMessage, setScanStepMessage] = useState<string>('');
    const [progressPct, setProgressPct] = useState<number>(0);

    // Deconstruction Grid State
    const [pieces, setPieces] = useState<DeconstructedPiece[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [selectedPiece, setSelectedPiece] = useState<DeconstructedPiece | null>(null);

    // Canvas & Audio Refs
    const originalImageRef = useRef<HTMLImageElement>(null);
    const deconstructionCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const deconstructionTimerRef = useRef<any>(null);

    // Matrix Resolution (16x16 = 256 Total Pieces covering 100.0% of canvas)
    const GRID_COLS = 16;
    const GRID_ROWS = 16;
    const TOTAL_PIECES = GRID_COLS * GRID_ROWS;

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            stopDeconstruction();
            setPieces([]);
            setCurrentStepIndex(0);
            setSelectedPiece(null);
        }
    };

    // Analyze Artwork into 100% Contiguous Pieces (Book-Reading Order)
    const analyzeArtworkForDeconstruction = () => {
        if (!originalImageRef.current || !uploadedImageUrl) return;

        const img = originalImageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = GRID_COLS * 16; // 256px
        canvas.height = GRID_ROWS * 16; // 256px
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const pieceWPct = 100 / GRID_COLS;
        const pieceHPct = 100 / GRID_ROWS;

        const generatedPieces: DeconstructedPiece[] = [];

        let idCounter = 1;

        // Book-Reading Order: Top-Left to Bottom-Right
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                // Calculate average RGB for this piece block
                let sumR = 0, sumG = 0, sumB = 0, count = 0;

                const blockX = col * 16;
                const blockY = row * 16;

                for (let py = 0; py < 16; py++) {
                    for (let px = 0; px < 16; px++) {
                        const i = ((blockY + py) * canvas.width + (blockX + px)) * 4;
                        sumR += data[i];
                        sumG += data[i + 1];
                        sumB += data[i + 2];
                        count++;
                    }
                }

                const avgR = Math.round(sumR / count);
                const avgG = Math.round(sumG / count);
                const avgB = Math.round(sumB / count);
                const hex = rgbToHex(avgR, avgG, avgB);
                const lab = rgbToLab(avgR, avgG, avgB);

                const midiNote = 42 + Math.round((lab.L / 100) * 36);
                const noteName = midiToNoteName(midiNote);
                const freqHz = Math.round(440 * Math.pow(2, (midiNote - 69) / 12));

                generatedPieces.push({
                    idNumber: idCounter,
                    idCode: `#${String(idCounter).padStart(3, '0')}`,
                    gridX: col,
                    gridY: row,
                    xPct: col * pieceWPct,
                    yPct: row * pieceHPct,
                    wPct: pieceWPct,
                    hPct: pieceHPct,
                    r: avgR,
                    g: avgG,
                    b: avgB,
                    hex,
                    L: Math.round(lab.L),
                    a: Math.round(lab.a),
                    b_val: Math.round(lab.b),
                    isDetached: false,
                    midiNote,
                    noteName,
                    frequencyHz: freqHz
                });

                idCounter++;
            }
        }

        setPieces(generatedPieces);
        if (generatedPieces.length > 0) {
            setSelectedPiece(generatedPieces[0]);
        }
    };

    // Run Sequential "Stacco dal Quadro" Animation & Audio Playback
    const startDeconstruction = () => {
        if (pieces.length === 0 || isDeconstructing) return;

        setIsDeconstructing(true);
        setScanStepMessage("Avvio Destrutturazione a lettura sequenziale (Stacco dal Quadro)...");

        if (deconstructionTimerRef.current) clearInterval(deconstructionTimerRef.current);

        let step = currentStepIndex >= TOTAL_PIECES ? 0 : currentStepIndex;

        deconstructionTimerRef.current = setInterval(() => {
            if (step >= TOTAL_PIECES) {
                clearInterval(deconstructionTimerRef.current);
                setIsDeconstructing(false);
                setScanStepMessage("✅ Destrutturazione Completata: Quadro 100% Convertito in Tela Bianca.");
                return;
            }

            // Mark piece as detached (turns to white canvas)
            setPieces(prev => {
                const next = [...prev];
                if (next[step]) {
                    next[step] = { ...next[step], isDetached: true };
                }
                return next;
            });

            const currentPiece = pieces[step];
            if (currentPiece) {
                setSelectedPiece(currentPiece);
                playPieceAudio(currentPiece.frequencyHz);
            }

            setCurrentStepIndex(step + 1);
            setProgressPct(Math.round(((step + 1) / TOTAL_PIECES) * 100));

            step++;
        }, 60); // Fast 60ms step speed
    };

    // Stop Deconstruction Animation
    const stopDeconstruction = () => {
        if (deconstructionTimerRef.current) {
            clearInterval(deconstructionTimerRef.current);
            deconstructionTimerRef.current = null;
        }
        setIsDeconstructing(false);
    };

    // Reset Deconstruction (Restore Painting)
    const resetDeconstruction = () => {
        stopDeconstruction();
        setCurrentStepIndex(0);
        setProgressPct(0);
        setPieces(prev => prev.map(p => ({ ...p, isDetached: false })));
        if (pieces.length > 0) setSelectedPiece(pieces[0]);
    };

    // Play Audio Pip for Detached Piece
    const playPieceAudio = (freqHz: number) => {
        try {
            if (!audioCtxRef.current) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                audioCtxRef.current = new AudioCtx();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freqHz, now);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.14);
        } catch (e) {
            console.warn("Audio play error:", e);
        }
    };

    // Color Processing Helpers
    const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

    const rgbToLab = (r: number, g: number, b: number) => {
        let r1 = r / 255, g1 = g / 255, b1 = b / 255;
        r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
        g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
        b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;

        let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) * 100;
        let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) * 100;
        let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) * 100;

        x /= 95.047; y /= 100.000; z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

        return { L: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
    };

    const midiToNoteName = (midi: number) => {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
    };

    useEffect(() => {
        return () => {
            stopDeconstruction();
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
                            Destrutturazione Sequenziale a Tela Bianca
                        </span>
                        <span className="text-xs text-white/50 font-mono">100.0% Copertura Superficie</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Scansione & <span className="text-cyan-400">Stacco dal Quadro</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Partendo dall'angolo in alto a sinistra, il sistema analizza a lettura di libro ogni porzione di colore, la marca con un ID sequenziale e la stacca dal quadro rivelando la tela bianca.
                    </p>
                </div>

                {/* UPLOAD BUTTON */}
                <label className="cursor-pointer px-8 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:scale-105 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-xl flex items-center gap-3">
                    <i className="fas fa-upload text-base"></i>
                    Carica Immagine Opera
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            </div>

            {/* MAIN WORKSPACE */}
            {!uploadedImageUrl ? (
                <div className="bg-slate-950/60 backdrop-blur-xl p-16 rounded-2xl border border-dashed border-cyan-500/30 text-center space-y-4">
                    <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto text-cyan-400 text-3xl">
                        <i className="fas fa-[#38bdf8] fa-border-none"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessun Quadro Caricato</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per avviare lo stacco sequenziale delle porzioni di colore verso la tela bianca.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: DECONSTRUCTION CANVAS WITH WHITE CANVAS REVEAL (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-microscope"></i> Opera: {uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {currentStepIndex}/{TOTAL_PIECES} Porzioni Staccate ({progressPct}%)
                                </span>
                            </div>

                            {/* Canvas Container with White Canvas Peel Overlay */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-white flex items-center justify-center shadow-inner">
                                {/* Base Original Image */}
                                <img
                                    ref={originalImageRef}
                                    src={uploadedImageUrl}
                                    alt="Opera Scansionata"
                                    className="w-full h-full object-cover absolute inset-0"
                                    onLoad={analyzeArtworkForDeconstruction}
                                />

                                {/* DYNAMIC WHITE CANVAS PIECES OVERLAY */}
                                {pieces.map((piece) => {
                                    const isSelected = selectedPiece?.idCode === piece.idCode;

                                    return (
                                        <div
                                            key={piece.idCode}
                                            style={{
                                                left: `${piece.xPct}%`,
                                                top: `${piece.yPct}%`,
                                                width: `${piece.wPct}%`,
                                                height: `${piece.hPct}%`,
                                            }}
                                            onClick={() => {
                                                setSelectedPiece(piece);
                                                playPieceAudio(piece.frequencyHz);
                                            }}
                                            className={`absolute transition-all duration-300 cursor-pointer pointer-events-auto flex items-center justify-center border ${
                                                piece.isDetached
                                                    ? 'bg-white border-slate-300 shadow-inner'
                                                    : 'bg-transparent border-transparent hover:border-cyan-400/60'
                                            } ${isSelected ? 'ring-2 ring-amber-400 z-20' : ''}`}
                                        >
                                            {/* Show Sequential ID Tag when detached */}
                                            {piece.isDetached && (
                                                <span className="text-[7px] font-mono font-bold text-slate-500 scale-90 truncate pointer-events-none">
                                                    {piece.idCode}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}

                                {isDeconstructing && (
                                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-cyan-500/40 px-3 py-1 rounded-full text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-2 pointer-events-none z-30 animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                        Stacco dal Quadro in corso ({progressPct}%)
                                    </div>
                                )}
                            </div>

                            {/* CONTROLS */}
                            <div className="flex items-center justify-between gap-4 pt-2">
                                <button
                                    onClick={isDeconstructing ? stopDeconstruction : startDeconstruction}
                                    disabled={pieces.length === 0}
                                    className={`flex-1 py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        isDeconstructing
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                            : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white hover:scale-102 shadow-xl shadow-cyan-950/50'
                                    }`}
                                >
                                    <i className={`fas ${isDeconstructing ? 'fa-pause' : 'fa-play'}`}></i>
                                    {isDeconstructing ? 'Pausa Stacco' : 'Avvia Destrutturazione & Stacco dal Quadro'}
                                </button>

                                <button
                                    onClick={resetDeconstruction}
                                    className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-mono font-bold uppercase border border-white/10 transition-all"
                                >
                                    <i className="fas fa-rotate-left mr-1.5"></i> Ripristina Quadro
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: DECONSTRUCTED PIECES REGISTRY & TELEMETRY (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    📋 Registro Porzioni Staccate ({currentStepIndex}/{TOTAL_PIECES})
                                </span>
                                <span className="text-xs text-white/50">Lettura a Libro</span>
                            </div>

                            {/* ACTIVE / SELECTED PIECE TELEMETRY */}
                            {selectedPiece && (
                                <div className="bg-cyan-950/40 border border-cyan-500/40 p-4 rounded-xl space-y-2 animate-fade-in text-xs">
                                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 rounded border border-white/40" style={{ backgroundColor: selectedPiece.hex }}></span>
                                            <span className="text-amber-300 font-bold text-sm">{selectedPiece.idCode}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedPiece.isDetached ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/10 text-white/60'}`}>
                                            {selectedPiece.isDetached ? 'Staccato (Tela Bianca)' : 'Sul Quadro'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80 pt-1">
                                        <div>Matrice: <strong>[X: {selectedPiece.gridX}, Y: {selectedPiece.gridY}]</strong></div>
                                        <div>Colore HEX: <strong>{selectedPiece.hex}</strong></div>
                                        <div>CIE LAB: <strong>L*:{selectedPiece.L} a*:{selectedPiece.a} b*:{selectedPiece.b_val}</strong></div>
                                        <div>Nota Basale: <strong className="text-amber-300">{selectedPiece.noteName} ({selectedPiece.frequencyHz} Hz)</strong></div>
                                    </div>
                                </div>
                            )}

                            {/* DECONSTRUCTED PIECES SCROLLING REGISTRY */}
                            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                                {pieces.map((piece) => {
                                    const isSelected = selectedPiece?.idCode === piece.idCode;
                                    return (
                                        <div
                                            key={piece.idCode}
                                            onClick={() => {
                                                setSelectedPiece(piece);
                                                playPieceAudio(piece.frequencyHz);
                                            }}
                                            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                                                isSelected
                                                    ? 'bg-cyan-950/80 border-amber-400 ring-1 ring-amber-400'
                                                    : piece.isDetached
                                                        ? 'bg-white/10 border-white/10 text-white/90'
                                                        : 'bg-white/5 border-white/5 text-white/40 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded border border-white/30" style={{ backgroundColor: piece.hex }}></span>
                                                <span className="font-bold text-amber-300">{piece.idCode}</span>
                                                <span className="text-[10px] text-white/60">[X:{piece.gridX}, Y:{piece.gridY}]</span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-cyan-300 font-bold">{piece.noteName} ({piece.frequencyHz}Hz)</span>
                                                <i className={`fas ${piece.isDetached ? 'fa-check text-emerald-400' : 'fa-clock text-white/30'} text-xs`}></i>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </div>
            )}

        </div>
    );
};
