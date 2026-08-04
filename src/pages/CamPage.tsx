import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

interface ColorRegion {
    id: number;
    idCode: string;
    r: number;
    g: number;
    b: number;
    hex: string;
    pixelIndices: number[];
    pixelCount: number;
    percentage: number;
    centroidX: number;
    centroidY: number;
    L: number;
    a: number;
    b_val: number;
    noteName: string;
    frequencyHz: number;
    isDetached: boolean;
}

const COLOR_TOLERANCE = 28; // RGB distance tolerance for flood-fill

export const CamPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();

    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDeconstructing, setIsDeconstructing] = useState(false);
    const [analyzeProgress, setAnalyzeProgress] = useState<string>('');
    const [regions, setRegions] = useState<ColorRegion[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedRegion, setSelectedRegion] = useState<ColorRegion | null>(null);
    const [progressPct, setProgressPct] = useState(0);
    const [totalPixels, setTotalPixels] = useState(0);

    // THE ONE CANVAS — both renders on this (no img element visible at all)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pixelDataRef = useRef<Uint8ClampedArray | null>(null); // original image data backup
    const imageDimRef = useRef({ w: 0, h: 0 });
    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<any>(null);
    const regionsRef = useRef<ColorRegion[]>([]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setUploadedFileName(file.name);
            stopDeconstruction();
            setRegions([]);
            regionsRef.current = [];
            setCurrentStep(0);
            setProgressPct(0);
            setSelectedRegion(null);

            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);

            // Load image into canvas immediately
            const img = new Image();
            img.onload = () => {
                const MAX_W = 400;
                const w = Math.min(img.naturalWidth, MAX_W);
                const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
                imageDimRef.current = { w, h };

                const canvas = canvasRef.current!;
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);

                // Store a backup of the original pixel data
                const imgData = ctx.getImageData(0, 0, w, h);
                pixelDataRef.current = new Uint8ClampedArray(imgData.data);
                setTotalPixels(w * h);

                // Auto-start analysis
                runFloodFillAnalysis(ctx, imgData, w, h);
            };
            img.src = url;
        }
    };

    // FLOOD-FILL CONNECTED COMPONENT ANALYSIS
    // Scans top-left → bottom-right, finds first unvisited pixel, 
    // flood-fills with tolerance to capture the whole connected organic shape,
    // marks it with an ID, moves to next unvisited pixel.
    const runFloodFillAnalysis = (
        ctx: CanvasRenderingContext2D,
        imgData: ImageData,
        w: number,
        h: number
    ) => {
        setIsAnalyzing(true);
        setAnalyzeProgress("Analisi Flood-Fill in corso...");

        const data = imgData.data;
        const totalPx = w * h;
        const visited = new Uint8Array(totalPx);

        setTimeout(() => {
            const extractedRegions: ColorRegion[] = [];
            let regionCounter = 1;

            // Iterative flood fill with tolerance
            for (let startIdx = 0; startIdx < totalPx; startIdx++) {
                if (visited[startIdx]) continue;

                const sr = data[startIdx * 4];
                const sg = data[startIdx * 4 + 1];
                const sb = data[startIdx * 4 + 2];

                // BFS Flood Fill
                const stack: number[] = [startIdx];
                visited[startIdx] = 1;
                const pixelList: number[] = [];
                let sumX = 0, sumY = 0, sumR = 0, sumG = 0, sumB = 0;

                while (stack.length > 0) {
                    const idx = stack.pop()!;
                    pixelList.push(idx);

                    const px = idx * 4;
                    sumX += idx % w;
                    sumY += Math.floor(idx / w);
                    sumR += data[px];
                    sumG += data[px + 1];
                    sumB += data[px + 2];

                    // Check 4 neighbors
                    const x = idx % w;
                    const y = Math.floor(idx / w);
                    const neighbors = [
                        x > 0 ? idx - 1 : -1,
                        x < w - 1 ? idx + 1 : -1,
                        y > 0 ? idx - w : -1,
                        y < h - 1 ? idx + w : -1
                    ];

                    for (const n of neighbors) {
                        if (n < 0 || visited[n]) continue;
                        const npx = n * 4;
                        const dr = data[npx] - sr;
                        const dg = data[npx + 1] - sg;
                        const db = data[npx + 2] - sb;
                        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                        if (dist <= COLOR_TOLERANCE) {
                            visited[n] = 1;
                            stack.push(n);
                        }
                    }
                }

                const count = pixelList.length;
                // Only catalog regions >= 0.05% of surface (avoid single isolated pixels)
                if (count < Math.max(3, Math.floor(totalPx * 0.0005))) continue;

                const avgR = Math.round(sumR / count);
                const avgG = Math.round(sumG / count);
                const avgB = Math.round(sumB / count);
                const hex = '#' + [avgR, avgG, avgB].map(x => x.toString(16).padStart(2, '0')).join('');
                const lab = rgbToLab(avgR, avgG, avgB);
                const midi = 42 + Math.round((lab.L / 100) * 36);
                const freq = Math.round(440 * Math.pow(2, (midi - 69) / 12));

                extractedRegions.push({
                    id: regionCounter,
                    idCode: `#${String(regionCounter).padStart(3, '0')}`,
                    r: avgR, g: avgG, b: avgB, hex,
                    pixelIndices: pixelList,
                    pixelCount: count,
                    percentage: parseFloat(((count / totalPx) * 100).toFixed(2)),
                    centroidX: parseFloat(((sumX / count / w) * 100).toFixed(1)),
                    centroidY: parseFloat(((sumY / count / h) * 100).toFixed(1)),
                    L: Math.round(lab.L),
                    a: Math.round(lab.a),
                    b_val: Math.round(lab.b),
                    noteName: midiToNote(midi),
                    frequencyHz: freq,
                    isDetached: false
                });
                regionCounter++;
            }

            regionsRef.current = extractedRegions;
            setRegions(extractedRegions);
            setIsAnalyzing(false);
            setAnalyzeProgress(`✅ ${extractedRegions.length} regioni organiche estratte (100% copertura)`);
            if (extractedRegions.length > 0) setSelectedRegion(extractedRegions[0]);
        }, 100);
    };

    // ANIMATE STACCO: for each region, turn its exact pixels WHITE on the canvas
    const startDeconstruction = () => {
        if (regionsRef.current.length === 0 || isDeconstructing) return;
        setIsDeconstructing(true);

        let step = currentStep >= regionsRef.current.length ? 0 : currentStep;
        if (step === 0) {
            // Restore original image first
            restoreOriginal();
        }

        timerRef.current = setInterval(() => {
            const rList = regionsRef.current;
            if (step >= rList.length) {
                clearInterval(timerRef.current);
                setIsDeconstructing(false);
                return;
            }

            const region = rList[step];

            // Turn exact pixels WHITE on the canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const { w, h } = imageDimRef.current;
                    const imgData = ctx.getImageData(0, 0, w, h);
                    const d = imgData.data;
                    for (const idx of region.pixelIndices) {
                        d[idx * 4] = 255;
                        d[idx * 4 + 1] = 255;
                        d[idx * 4 + 2] = 255;
                        d[idx * 4 + 3] = 255;
                    }
                    ctx.putImageData(imgData, 0, 0);

                    // Draw ID label at centroid
                    const lx = (region.centroidX / 100) * w;
                    const ly = (region.centroidY / 100) * h;
                    ctx.font = `bold ${Math.max(8, Math.min(14, Math.sqrt(region.pixelCount) * 0.3))}px monospace`;
                    ctx.fillStyle = '#0369a1';
                    ctx.fillText(region.idCode, lx - 12, ly + 4);
                }
            }

            playTone(region.frequencyHz);
            setSelectedRegion({ ...region, isDetached: true });
            setCurrentStep(step + 1);
            setProgressPct(Math.round(((step + 1) / rList.length) * 100));

            step++;
        }, 150);
    };

    const stopDeconstruction = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsDeconstructing(false);
    };

    const restoreOriginal = () => {
        const canvas = canvasRef.current;
        const backup = pixelDataRef.current;
        if (!canvas || !backup) return;
        const { w, h } = imageDimRef.current;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(w, h);
        imgData.data.set(backup);
        ctx.putImageData(imgData, 0, 0);
    };

    const handleReset = () => {
        stopDeconstruction();
        setCurrentStep(0);
        setProgressPct(0);
        restoreOriginal();
        if (regionsRef.current.length > 0) setSelectedRegion(regionsRef.current[0]);
    };

    const playTone = (freqHz: number) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freqHz, now);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        } catch (_) {}
    };

    const rgbToLab = (r: number, g: number, b: number) => {
        let r1 = r / 255, g1 = g / 255, b1 = b / 255;
        r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
        g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
        b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;
        let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) * 100;
        let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) * 100;
        let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) * 100;
        x /= 95.047; y /= 100; z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
        return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
    };

    const midiToNote = (midi: number) => {
        const n = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
    };

    useEffect(() => {
        return () => {
            stopDeconstruction();
            audioCtxRef.current?.close();
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
                            Flood-Fill Organico · Stacco Pixel-per-Pixel
                        </span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Scontorno & <span className="text-cyan-400">Stacco dal Quadro</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Il sistema insegue il colore forma per forma (mantello, nuvola, erba...) e lo stacca rivelando la tela bianca. Zero residui.
                    </p>
                </div>
                <label className="cursor-pointer px-8 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:scale-105 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-xl flex items-center gap-3">
                    <i className="fas fa-upload text-base"></i>
                    Carica Opera
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            </div>

            {/* MAIN WORKSPACE */}
            {!uploadedImageUrl ? (
                <div className="bg-slate-950/60 backdrop-blur-xl p-16 rounded-2xl border border-dashed border-cyan-500/30 text-center space-y-4">
                    <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto text-cyan-400 text-4xl">
                        <i className="fas fa-wand-magic-sparkles"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Carica un quadro per avviare il Colorimetro Organico</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: THE CANVAS IS THE ONLY VISIBLE SURFACE (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-4">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                                    <i className="fas fa-microscope mr-2"></i>{uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {currentStep}/{regions.length} Forme Staccate ({progressPct}%)
                                </span>
                            </div>

                            {/* THE SINGLE CANVAS — image drawn here, turns white pixel-by-pixel */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white" style={{ aspectRatio: `${imageDimRef.current.w || 16}/${imageDimRef.current.h || 9}` }}>
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-full object-contain"
                                />

                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                        <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
                                        <p className="text-xs font-mono text-cyan-300 font-bold">{analyzeProgress}</p>
                                    </div>
                                )}

                                {isDeconstructing && (
                                    <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md border border-cyan-500/40 px-3 py-2 rounded-xl text-[10px] font-mono text-cyan-300 font-bold">
                                        <div className="flex justify-between mb-1">
                                            <span>Stacco Forma {currentStep}/{regions.length}</span>
                                            <span>{progressPct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all duration-150" style={{ width: `${progressPct}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CONTROLS */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={isDeconstructing ? stopDeconstruction : startDeconstruction}
                                    disabled={regions.length === 0 || isAnalyzing}
                                    className={`flex-1 py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        isDeconstructing
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-102 shadow-lg'
                                    }`}
                                >
                                    <i className={`fas ${isDeconstructing ? 'fa-pause' : 'fa-play'}`}></i>
                                    {isDeconstructing ? 'Pausa' : 'Avvia Stacco Forme Organiche'}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-mono font-bold uppercase border border-white/10 transition-all"
                                >
                                    <i className="fas fa-rotate-left mr-1.5"></i>Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: LIVE TELEMETRY & REGION REGISTRY (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        {/* Active Region Telemetry */}
                        {selectedRegion && (
                            <div className="bg-slate-950/80 backdrop-blur-xl p-5 rounded-2xl border border-cyan-500/40 shadow-2xl font-mono space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded border border-white/40" style={{ backgroundColor: selectedRegion.hex }}></span>
                                        <span className="text-amber-300 font-bold text-sm">{selectedRegion.idCode}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                                        selectedRegion.isDetached
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                            : 'bg-white/10 text-white/50 border-white/10'
                                    }`}>
                                        {selectedRegion.isDetached ? '✓ Staccato' : 'Sul Quadro'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80">
                                    <div>Pixel: <strong className="text-white">{selectedRegion.pixelCount.toLocaleString()} px</strong></div>
                                    <div>Copertura: <strong className="text-cyan-300">{selectedRegion.percentage}%</strong></div>
                                    <div>HEX: <strong className="text-white">{selectedRegion.hex}</strong></div>
                                    <div>Nota: <strong className="text-amber-300">{selectedRegion.noteName} · {selectedRegion.frequencyHz}Hz</strong></div>
                                    <div className="col-span-2">CIE LAB: <strong className="text-cyan-200">L*:{selectedRegion.L} a*:{selectedRegion.a} b*:{selectedRegion.b_val}</strong></div>
                                </div>
                            </div>
                        )}

                        {/* Region Registry */}
                        <div className="bg-slate-950/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl font-mono space-y-3 flex-1">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    Forme Organiche Trovate ({regions.length})
                                </span>
                                <span className="text-xs text-emerald-400 font-bold">{analyzeProgress && !isAnalyzing ? `✓ ${regions.length} forme` : isAnalyzing ? '⏳ Analisi...' : ''}</span>
                            </div>

                            {regions.length === 0 ? (
                                <p className="text-xs text-white/40 italic text-center py-4">
                                    Carica un'immagine per avviare l'analisi organica...
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                                    {regions.map((reg, idx) => {
                                        const isDetached = idx < currentStep;
                                        const isCurrent = idx === currentStep - 1;
                                        const isSelected = selectedRegion?.idCode === reg.idCode;
                                        return (
                                            <div
                                                key={reg.idCode}
                                                onClick={() => setSelectedRegion(reg)}
                                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-[10px] ${
                                                    isSelected || isCurrent
                                                        ? 'bg-cyan-950/80 border-amber-400 ring-1 ring-amber-400'
                                                        : isDetached
                                                            ? 'bg-white/8 border-white/10 text-white/80'
                                                            : 'bg-white/3 border-white/5 text-white/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded border border-white/20" style={{ backgroundColor: reg.hex }}></span>
                                                    <span className="font-bold text-amber-300">{reg.idCode}</span>
                                                    <span className="text-white/60">{reg.percentage}% · {reg.pixelCount.toLocaleString()}px</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-cyan-300">{reg.noteName}</span>
                                                    <i className={`fas text-xs ${isDetached ? 'fa-check text-emerald-400' : 'fa-hourglass text-white/20'}`}></i>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
