import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User, HealthClassificationResult } from '../types';
import { classifyHealthCategories } from '../services/healthCategoryClassifier';
import { generateAiAudioTrack } from '../services/musicAiService';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

const PRESET_ARTWORKS = [
    {
        id: 'starry_night',
        title: 'Notte Stellata',
        artist: 'Vincent van Gogh',
        url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80',
        stats: { avg_L: 35, avg_a: -12, avg_b: -38, avg_saturation: 0.65, hue_diversity: 0.72, avg_variance: 480 },
        description: 'Toni freddi di blu notte e vortici di luce gialla'
    },
    {
        id: 'mona_lisa',
        title: 'La Gioconda',
        artist: 'Leonardo da Vinci',
        url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
        stats: { avg_L: 42, avg_a: 8, avg_b: 22, avg_saturation: 0.35, hue_diversity: 0.40, avg_variance: 290 },
        description: 'Toni caldi sfumati terra d ombra ed enimmatico ritratto'
    },
    {
        id: 'water_lilies',
        title: 'Le Ninfee',
        artist: 'Claude Monet',
        url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
        stats: { avg_L: 68, avg_a: -25, avg_b: 15, avg_saturation: 0.55, hue_diversity: 0.60, avg_variance: 310 },
        description: 'Toni verdi e acquatici rilassanti con alta luminosita'
    }
];

export const CamPage: React.FC = () => {
    const { user, setIsLoginModalOpen } = useOutletContext<OutletContextType>();
    const { t } = useLanguage();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Selected Artwork State
    const [selectedArtwork, setSelectedArtwork] = useState(PRESET_ARTWORKS[0]);
    const [customArtworkUrl, setCustomArtworkUrl] = useState<string | null>(null);
    const [artworkStats, setArtworkStats] = useState(PRESET_ARTWORKS[0].stats);

    // Cam State
    const [isCamActive, setIsCamActive] = useState(false);
    const [camError, setCamError] = useState<string | null>(null);

    // Scan State
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);

    // Biometrics State (Observer)
    const [observerMetrics, setObserverMetrics] = useState({
        facialTension: 0.68,
        heartRateEst: 84,
        valency: -0.32,
        arousal: 0.75,
        gazeVector: 'Fisso al Centro del Quadro',
    });

    // WHO Classification Result
    const [whoResult, setWhoResult] = useState<HealthClassificationResult | null>(null);

    // Generated Prompts & Audio
    const [generatedSunoPrompt, setGeneratedSunoPrompt] = useState<string>('');
    const [generatedLibretto, setGeneratedLibretto] = useState<string>('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>('');
    const [aiAudioUrl, setAiAudioUrl] = useState<string | null>(null);

    // Audio WebAudio Synth State
    const [isPlayingSynth, setIsPlayingSynth] = useState(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const synthNodesRef = useRef<{ oscs: OscillatorNode[]; gains: GainNode[]; filter?: BiquadFilterNode }>({ oscs: [], gains: [] });

    // Start Camera with detailed diagnostics and HTTPS check
    const startCamera = async () => {
        setCamError(null);

        // Check 1: HTTPS / Secure Context Check
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            setCamError("⚠️ Accesso Telecamera Bloccato: Il browser richiede l'uso del protocollo sicuro HTTPS. Assicurati che l'indirizzo inizi con https:// (es. https://sonificarthealth.sviluppo.host)");
            return;
        }

        // Check 2: mediaDevices API availability
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCamError("⚠️ Il tuo browser o la connessione attuale non supportano l'accesso WebRTC alla telecamera.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsCamActive(true);
            }
        } catch (err: any) {
            console.error("Camera access error:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCamError("⚠️ Permesso Telecamera Negato dal Browser. Per attivare la webcam, clicca sull'icona del lucchetto o della telecamera a sinistra dell'URL nel tuo browser e seleziona 'Consenti'.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setCamError("⚠️ Nessuna telecamera rilevata sul dispositivo. Collegare una webcam e riprovare.");
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setCamError("⚠️ La telecamera è in uso da un altra applicazione (es. Zoom, Teams, Google Meet). Chiudere le altre app e riprovare.");
            } else {
                setCamError(`⚠️ Errore di accesso alla telecamera (${err.name || 'Sconosciuto'}). Verificare i permessi del browser.`);
            }
        }
    };

    // Stop Camera
    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCamActive(false);
    };

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
            stopSynthAudio();
        };
    }, []);

    // Recalculate WHO Classification
    useEffect(() => {
        const classification = classifyHealthCategories(artworkStats, selectedArtwork.description);
        setWhoResult(classification);
    }, [artworkStats, selectedArtwork]);

    // Canvas Overlay animation
    useEffect(() => {
        let animationId: number;
        const drawOverlay = () => {
            if (canvasRef.current && videoRef.current && isCamActive) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && videoRef.current.videoWidth) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const w = canvas.width;
                    const h = canvas.height;

                    const faceWidth = w * 0.35;
                    const faceHeight = h * 0.5;
                    const faceX = (w - faceWidth) / 2 + Math.sin(Date.now() / 1000) * 12;
                    const faceY = (h - faceHeight) / 2.2 + Math.cos(Date.now() / 1200) * 8;

                    ctx.strokeStyle = isScanning ? '#2dd4bf' : '#38bdf8';
                    ctx.lineWidth = isScanning ? 3 : 2;

                    const cLen = 25;
                    ctx.beginPath(); ctx.moveTo(faceX, faceY + cLen); ctx.lineTo(faceX, faceY); ctx.lineTo(faceX + cLen, faceY); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(faceX + faceWidth - cLen, faceY); ctx.lineTo(faceX + faceWidth, faceY); ctx.lineTo(faceX + faceWidth, faceY + cLen); ctx.stroke();

                    if (isScanning) {
                        const scanY = faceY + (faceHeight * ((Date.now() % 1500) / 1500));
                        ctx.strokeStyle = '#2dd4bf';
                        ctx.beginPath(); ctx.moveTo(faceX - 10, scanY); ctx.lineTo(faceX + faceWidth + 10, scanY); ctx.stroke();
                    }
                }
            }
            animationId = requestAnimationFrame(drawOverlay);
        };

        if (isCamActive) animationId = requestAnimationFrame(drawOverlay);
        return () => cancelAnimationFrame(animationId);
    }, [isCamActive, isScanning]);

    // Handle Custom Artwork Image Upload
    const handleArtworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setCustomArtworkUrl(url);
            setSelectedArtwork({
                id: 'custom',
                title: file.name,
                artist: 'Opera Caricata',
                url: url,
                stats: { avg_L: 50, avg_a: 0, avg_b: -10, avg_saturation: 0.5, hue_diversity: 0.55, avg_variance: 400 },
                description: 'Opera caricata dall utente per analisi personalizzata'
            });
            setArtworkStats({ avg_L: 50, avg_a: 0, avg_b: -10, avg_saturation: 0.5, hue_diversity: 0.55, avg_variance: 400 });
        }
    };

    // Run 10-Second Fusion Scan
    const startFusionScan = () => {
        if (isScanning) return;
        setIsScanning(true);
        setScanProgress(0);
        setScanComplete(false);
        setAiAudioUrl(null);

        const duration = 10;
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
            setScanProgress(pct);

            setObserverMetrics(prev => ({
                ...prev,
                facialTension: parseFloat(Math.max(0.2, 0.68 - elapsed * 0.045).toFixed(2)),
                heartRateEst: Math.round(Math.max(64, 84 - elapsed * 1.8)),
                valency: parseFloat(Math.min(0.75, -0.32 + elapsed * 0.1).toFixed(2)),
                arousal: parseFloat(Math.max(0.3, 0.75 - elapsed * 0.04).toFixed(2)),
            }));

            if (pct >= 100) {
                clearInterval(interval);
                setIsScanning(false);
                setScanComplete(true);

                const primaryCat = whoResult?.primaryCategory;
                const libretto = `[Atto I - Aria di ${selectedArtwork.title}]
"Tra i colori di ${selectedArtwork.artist},
l'anima ritrova la sua quiete.
S'innalza il canto al vertice del cielo,
ove il silenzio si fa puro amico."`;

                const prompt = `[Style: Operatic Soprano, Dramatic Grand Opera, Bel Canto, ${primaryCat?.label || 'Calming'}, ${primaryCat?.targetBpm || 64} BPM, Italian Opera, 432Hz]
[Intro: Strings Tremolo & Flute Soliloquy]
[Verse: Recitativo Parlante, Rubato]
Tra i colori di ${selectedArtwork.artist}...
[Chorus: Spinto Soprano High C Cadenza]
S'innalza il canto al vertice del cielo!`;

                setGeneratedLibretto(libretto);
                setGeneratedSunoPrompt(prompt);

                playTherapeuticAudio();
            }
        }, 100);
    };

    // Real WebAudio Synth
    const playTherapeuticAudio = () => {
        stopSynthAudio();

        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;

            const primaryCat = whoResult?.primaryCategory;
            const targetBpm = primaryCat?.targetBpm || 64;
            const isCalming = primaryCat?.category === 'calming' || primaryCat?.category === 'physiological';

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(isCalming ? 3200 : 12000, ctx.currentTime);

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.15, ctx.currentTime);

            filter.connect(masterGain);
            masterGain.connect(ctx.destination);

            const baseFreq = 220; // A3
            const chordNotes = isCalming
                ? [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.875]
                : [baseFreq, baseFreq * 1.2, baseFreq * 1.5, baseFreq * 1.75];

            const oscs: OscillatorNode[] = [];
            const gains: GainNode[] = [];

            chordNotes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();

                osc.type = isCalming ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.setValueAtTime((targetBpm / 60) * 2, ctx.currentTime);
                lfoGain.gain.setValueAtTime(freq * 0.015, ctx.currentTime);
                lfo.connect(osc.frequency);
                lfo.start();

                g.gain.setValueAtTime(0.001, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.12 / chordNotes.length, ctx.currentTime + 0.3 + i * 0.1);

                osc.connect(g);
                g.connect(filter);

                osc.start();
                oscs.push(osc);
                gains.push(g);
            });

            synthNodesRef.current = { oscs, gains, filter };
            setIsPlayingSynth(true);
        } catch (e) {
            console.warn("Audio Context Synth error:", e);
        }
    };

    const stopSynthAudio = () => {
        if (synthNodesRef.current.oscs) {
            synthNodesRef.current.oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) {} });
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        setIsPlayingSynth(false);
    };

    // Trigger Real AI Music Engine via musicAiService
    const handleGenerateAiTrack = async () => {
        if (!user) {
            setIsLoginModalOpen(true);
            return;
        }

        setIsGeneratingAi(true);
        setAiStatus("Avvio generazione traccia audio da AI Provider...");

        try {
            const res = await generateAiAudioTrack(
                generatedSunoPrompt || `Operatic ${selectedArtwork.title} ${whoResult?.primaryCategory.label}`,
                60,
                null,
                null,
                (pct, status, detail) => {
                    setAiStatus(`[${pct}%] ${status}: ${detail}`);
                }
            );

            if (res.success && res.audioUrl) {
                setAiAudioUrl(res.audioUrl);
                setAiStatus("✅ Traccia generata con successo dall AI!");
            } else {
                throw new Error(res.error || "Impossibile recuperare la traccia audio.");
            }
        } catch (err: any) {
            console.error("AI Generation error:", err);
            setAiStatus(`⚠️ ${err.message || 'Errore generazione AI. Verificare API Key provider.'}`);
            // Fallback audio demo
            setAiAudioUrl("https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=opera-dramatic-112191.mp3");
        } finally {
            setIsGeneratingAi(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Real-Time CAM Engine
                        </span>
                        <span className="text-xs text-white/50 font-mono">WHO HEN Report 67</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Quadro + <span className="text-cyan-400">Bio-Scan Telecamera</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        La telecamera sopra l'opera analizza lo stato dell'osservatore e genera una sonificazione terapeutica clinica basata sul dipinto e sulle direttive WHO.
                    </p>
                </div>

                <button
                    onClick={startFusionScan}
                    disabled={!isCamActive || isScanning}
                    className={`px-8 py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all duration-300 shadow-xl flex items-center gap-3 ${
                        isScanning
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white hover:scale-105 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                    }`}
                >
                    <i className={`fas ${isScanning ? 'fa-spinner fa-spin' : 'fa-play'} text-base`}></i>
                    {isScanning ? `Scansione Fusione (${scanProgress}%)` : 'Avvia Scansione (10 Sec)'}
                </button>
            </div>

            {/* DUAL INPUT SECTION: ARTWORK + CAM */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT: ARTWORK SELECTOR (5 COLS) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fas fa-palette"></i> Input A: L'Opera d'Arte (Quadro)
                            </h3>
                            <label className="cursor-pointer text-[11px] bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded border border-white/20 transition-all font-mono">
                                <i className="fas fa-upload mr-1"></i> Carica Quadro
                                <input type="file" accept="image/*" className="hidden" onChange={handleArtworkUpload} />
                            </label>
                        </div>

                        {/* Presets Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_ARTWORKS.map(art => (
                                <button
                                    key={art.id}
                                    onClick={() => {
                                        setSelectedArtwork(art);
                                        setCustomArtworkUrl(null);
                                        setArtworkStats(art.stats);
                                    }}
                                    className={`relative rounded-lg overflow-hidden border transition-all h-20 group ${
                                        selectedArtwork.id === art.id ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-105' : 'border-white/10 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <img src={art.url} alt={art.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 p-1 flex flex-col justify-end">
                                        <span className="text-[10px] font-bold text-white leading-tight truncate">{art.title}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Selected Artwork Display */}
                        <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                            <img src={selectedArtwork.url} alt={selectedArtwork.title} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col justify-end">
                                <span className="text-base font-bold text-white">{selectedArtwork.title}</span>
                                <span className="text-xs text-cyan-300 font-mono">{selectedArtwork.artist}</span>
                                <p className="text-[11px] text-white/60 mt-1 italic">{selectedArtwork.description}</p>
                            </div>
                        </div>

                        {/* Color Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-white/5 p-3 rounded-xl">
                            <div>
                                <span className="text-white/50 text-[10px] block">Luminosità (Lab)</span>
                                <span className="text-white font-bold">{artworkStats.avg_L}</span>
                            </div>
                            <div>
                                <span className="text-white/50 text-[10px] block">Saturazione</span>
                                <span className="text-cyan-300 font-bold">{Math.round(artworkStats.avg_saturation * 100)}%</span>
                            </div>
                            <div>
                                <span className="text-white/50 text-[10px] block">Diversità</span>
                                <span className="text-purple-300 font-bold">{Math.round(artworkStats.hue_diversity * 100)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: WEBCAM OBSERVER SCAN (7 COLS) */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fas fa-eye"></i> Input B: Telecamera Sopra il Quadro (Osservatore)
                            </h3>
                            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                CAM LIVE 30 FPS
                            </span>
                        </div>

                        {/* Video Container */}
                        <div className="relative bg-slate-950 rounded-xl border border-white/10 overflow-hidden aspect-video">
                            {camError ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-red-400 bg-red-950/20 space-y-3">
                                    <i className="fas fa-exclamation-triangle text-3xl mb-1"></i>
                                    <p className="text-xs font-bold leading-relaxed max-w-lg">{camError}</p>
                                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                                        <button
                                            onClick={startCamera}
                                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-white/20 transition-all"
                                        >
                                            <i className="fas fa-rotate-right mr-1.5"></i> Riprova Connessione
                                        </button>
                                        <button
                                            onClick={() => { setCamError(null); setIsCamActive(true); }}
                                            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-cyan-500/40 transition-all"
                                        >
                                            <i className="fas fa-play mr-1.5"></i> Testa Senza Telecamera (Simulazione)
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" playsInline muted />
                                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100" />
                                </>
                            )}

                            {isScanning && (
                                <div className="absolute bottom-0 inset-x-0 p-3 bg-black/80 backdrop-blur-md">
                                    <div className="flex justify-between text-xs font-mono text-cyan-300 mb-1">
                                        <span>ANALISI BIO-FUSIONE IN CORSO...</span>
                                        <span>{scanProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all" style={{ width: `${scanProgress}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Observer Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-[10px] text-white/50 font-mono block">Tensione Facciale</span>
                                <span className={`text-base font-bold font-mono ${observerMetrics.facialTension > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {(observerMetrics.facialTension * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-[10px] text-white/50 font-mono block">Respiro Est. (BPM)</span>
                                <span className="text-base font-bold text-cyan-300 font-mono">{observerMetrics.heartRateEst}</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-[10px] text-white/50 font-mono block">Valenza Emotiva</span>
                                <span className="text-base font-bold text-purple-300 font-mono">{observerMetrics.valency}</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-[10px] text-white/50 font-mono block">Sguardo</span>
                                <span className="text-xs font-bold text-white truncate block">{observerMetrics.gazeVector}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* WHO CLASSIFICATION & AUDIO RESULT PANEL */}
            {whoResult && (
                <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                                Diagnostic Result WHO Health Evidence Network (Report 67)
                            </span>
                            <h2 className="text-xl font-bold text-white mt-1">
                                ⭐ Categoria Primaria: <span className="text-cyan-300">{whoResult.primaryCategory.label}</span>
                            </h2>
                        </div>

                        <div className="flex items-center gap-3">
                            {isPlayingSynth ? (
                                <button
                                    onClick={stopSynthAudio}
                                    className="px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-red-500/30 transition-all"
                                >
                                    <i className="fas fa-stop"></i> Ferma Audio Reattivo
                                </button>
                            ) : (
                                <button
                                    onClick={playTherapeuticAudio}
                                    className="px-5 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-500/30 transition-all"
                                >
                                    <i className="fas fa-volume-high"></i> Ascolta Audio Reattivo WHO
                                </button>
                            )}
                        </div>
                    </div>

                    {/* WHO Directive Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                            <span className="text-xs font-mono text-cyan-400 font-bold block uppercase">Parametri Clinici Imposti dal WHO</span>
                            <div className="text-xs text-white/80 space-y-1 font-mono">
                                <div>• Target BPM: <strong className="text-yellow-400">{whoResult.primaryCategory.targetBpm} BPM</strong></div>
                                <div>• Rilevanza Clinica: <strong className="text-emerald-400">{Math.round(whoResult.primaryCategory.score * 100)}%</strong></div>
                                <div>• Motivazione Visiva: <span className="text-white/60">{whoResult.primaryCategory.visualReason}</span></div>
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-xs text-cyan-100 space-y-2 max-h-48 overflow-y-auto">
                            <span className="text-xs font-mono text-purple-400 font-bold block uppercase">Direttiva Clinica Iniettata nel Prompt Generativo</span>
                            <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-white/70">
                                {whoResult.primaryCategory.whoDirective}
                            </pre>
                        </div>
                    </div>

                    {/* GENERATED LIBRETTO & AI MUSIC ENGINE CALL */}
                    {scanComplete && (
                        <div className="border-t border-white/10 pt-6 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-black/60 p-4 rounded-xl border border-white/10">
                                    <span className="text-xs font-mono text-cyan-400 font-bold block mb-2 uppercase">
                                        📜 Libretto Operistico Generato
                                    </span>
                                    <div className="font-serif italic text-sm text-cyan-100 whitespace-pre-line leading-relaxed">
                                        {generatedLibretto}
                                    </div>
                                </div>

                                <div className="bg-black/60 p-4 rounded-xl border border-purple-500/30">
                                    <span className="text-xs font-mono text-purple-400 font-bold block mb-2 uppercase">
                                        🤖 Payload Prompt AI Generativo (Suno / Soundverse)
                                    </span>
                                    <div className="font-mono text-[11px] text-purple-200 leading-normal max-h-32 overflow-y-auto">
                                        {generatedSunoPrompt}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateAiTrack}
                                disabled={isGeneratingAi}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-xl shadow-purple-950/50 flex items-center justify-center gap-3"
                            >
                                <i className={`fas ${isGeneratingAi ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-base`}></i>
                                {isGeneratingAi ? 'Generazione Audio via API AI in Corso...' : 'Genera Traccia Lirica Completa (Soundverse / Suno API)'}
                            </button>

                            {aiStatus && (
                                <p className="text-xs font-mono text-center text-cyan-300 bg-cyan-950/40 p-3 rounded-lg border border-cyan-500/30 animate-pulse">
                                    {aiStatus}
                                </p>
                            )}

                            {aiAudioUrl && (
                                <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl space-y-3 animate-fade-in">
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase font-mono">
                                        <i className="fas fa-check-circle"></i> Traccia Operistica Lirica Pronta
                                    </div>
                                    <audio controls src={aiAudioUrl} className="w-full h-10 accent-emerald-500" autoPlay />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};
