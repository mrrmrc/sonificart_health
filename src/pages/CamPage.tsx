import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

export interface ColorimeterArea {
    id: string;
    label: string;
    r: number;
    g: number;
    b: number;
    hex: string;
    percentage: number;
    pixelCount: number;
    L: number;
    a: number;
    b_val: number;
    centroidX: number; // Percentage X position on image (0-100%)
    centroidY: number; // Percentage Y position on image (0-100%)
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
    const [isScanning, setIsScanning] = useState(false);
    const [scanStepMessage, setScanStepMessage] = useState<string>('');
    const [scanProgressPct, setScanProgressPct] = useState<number>(0);

    // Digital Colorimeter Data State
    const [discoveredAreas, setDiscoveredAreas] = useState<ColorimeterArea[]>([]);
    const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
    const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null);

    // Canvas & Image Refs
    const originalImageRef = useRef<HTMLImageElement>(null);
    const colorimeterCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            setDiscoveredAreas([]);
            setActiveAreaId(null);
            setProbePos(null);
        }
    };

    // Run Real-Time Digital Colorimeter Scanning & Pin Marking
    const startDigitalColorimeterScan = () => {
        if (!originalImageRef.current || !uploadedImageUrl || isScanning) return;

        setIsScanning(true);
        setScanProgressPct(0);
        setDiscoveredAreas([]);
        setActiveAreaId(null);
        setScanStepMessage("Inizializzazione Colorimetro Digitale CIE LAB D65...");

        const img = originalImageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sampleW = 200;
        const sampleH = Math.round((img.naturalHeight / img.naturalWidth) * sampleW);
        canvas.width = sampleW;
        canvas.height = sampleH;
        ctx.drawImage(img, 0, 0, sampleW, sampleH);

        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;
        const totalPixels = sampleW * sampleH;

        // Perform Color Clustering & Centroid Discovery
        const k = 6;
        let centroids = initializeCentroids(data, k);
        let assignments = new Int32Array(totalPixels);

        for (let iter = 0; iter < 6; iter++) {
            assignments = assignPixelsToCentroids(data, centroids, totalPixels);
            centroids = updateCentroids(data, assignments, k, totalPixels);
        }

        // Calculate Pixel Counts & Centroids (X,Y) per cluster
        const clusterCounts = new Int32Array(k);
        const clusterSumX = new Float64Array(k);
        const clusterSumY = new Float64Array(k);

        for (let i = 0; i < totalPixels; i++) {
            const clusterIdx = assignments[i];
            clusterCounts[clusterIdx]++;
            const pxX = i % sampleW;
            const pxY = Math.floor(i / sampleW);
            clusterSumX[clusterIdx] += pxX;
            clusterSumY[clusterIdx] += pxY;
        }

        // Sort Clusters by Surface Area Descending
        const sortedIndices = Array.from({ length: k }, (_, i) => i)
            .filter(i => clusterCounts[i] > 0)
            .sort((a, b) => clusterCounts[b] - clusterCounts[a]);

        const allCalculatedAreas: ColorimeterArea[] = sortedIndices.map((cIdx, rank) => {
            const count = clusterCounts[cIdx];
            const pct = parseFloat(((count / totalPixels) * 100).toFixed(1));
            const c = centroids[cIdx];
            const r = Math.round(c.r);
            const g = Math.round(c.g);
            const b = Math.round(c.b);
            const hex = rgbToHex(r, g, b);

            const avgX = clusterSumX[cIdx] / count;
            const avgY = clusterSumY[cIdx] / count;
            const centroidXPct = parseFloat(((avgX / sampleW) * 100).toFixed(1));
            const centroidYPct = parseFloat(((avgY / sampleH) * 100).toFixed(1));

            const lab = rgbToLab(r, g, b);
            const midiNote = 48 + Math.round((lab.L / 100) * 24);
            const noteName = midiToNoteName(midiNote);
            const freqHz = Math.round(440 * Math.pow(2, (midiNote - 69) / 12));

            return {
                id: `COLOR_${String(rank + 1).padStart(2, '0')}`,
                label: getColorName(r, g, b, lab),
                r, g, b, hex,
                percentage: pct,
                pixelCount: count,
                L: Math.round(lab.L),
                a: Math.round(lab.a),
                b_val: Math.round(lab.b),
                centroidX: centroidXPct,
                centroidY: centroidYPct,
                midiNote,
                noteName,
                frequencyHz: freqHz
            };
        });

        // ANIMATED STEP-BY-STEP PINNING: Discover and Pin Areas One by One!
        let step = 0;
        const totalSteps = allCalculatedAreas.length;

        const interval = setInterval(() => {
            if (step >= totalSteps) {
                clearInterval(interval);
                setIsScanning(false);
                setProbePos(null);
                setScanStepMessage("✅ Marcatura Colorimetrica Completata con Successo.");
                if (allCalculatedAreas.length > 0) {
                    setActiveAreaId(allCalculatedAreas[0].id);
                }
                return;
            }

            const currentArea = allCalculatedAreas[step];

            // Move Probe Crosshair to Centroid
            setProbePos({ x: currentArea.centroidX, y: currentArea.centroidY });
            setScanStepMessage(`Rilevamento ed Analisi Area [${currentArea.id}]: ${currentArea.label}...`);
            setScanProgressPct(Math.round(((step + 1) / totalSteps) * 100));

            // Pin Area
            setDiscoveredAreas(prev => [...prev, currentArea]);
            setActiveAreaId(currentArea.id);

            // Play Colorimeter Audio Pip for this area
            playColorimeterAudioPip(currentArea.frequencyHz);

            step++;
        }, 1200); // 1.2 seconds per color area pin
    };

    // Play Colorimeter Audio Pip
    const playColorimeterAudioPip = (freqHz: number) => {
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
            gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.38);
        } catch (e) {
            console.warn("Audio Pip error:", e);
        }
    };

    // Color Processing Helpers
    const initializeCentroids = (data: Uint8ClampedArray, k: number) => {
        const centroids = [];
        const step = Math.floor(data.length / 4 / k);
        for (let i = 0; i < k; i++) {
            const idx = (i * step) * 4;
            centroids.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        }
        return centroids;
    };

    const assignPixelsToCentroids = (data: Uint8ClampedArray, centroids: Array<{ r: number; g: number; b: number }>, totalPixels: number) => {
        const assignments = new Int32Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            const px = i * 4;
            const r = data[px], g = data[px + 1], b = data[px + 2];
            let minDist = Infinity, closest = 0;
            for (let c = 0; c < centroids.length; c++) {
                const dr = r - centroids[c].r, dg = g - centroids[c].g, db = b - centroids[c].b;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < minDist) { minDist = dist; closest = c; }
            }
            assignments[i] = closest;
        }
        return assignments;
    };

    const updateCentroids = (data: Uint8ClampedArray, assignments: Int32Array, k: number, totalPixels: number) => {
        const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
        for (let i = 0; i < totalPixels; i++) {
            const px = i * 4, c = assignments[i];
            sums[c].r += data[px]; sums[c].g += data[px + 1]; sums[c].b += data[px + 2]; sums[c].count++;
        }
        return sums.map(s => s.count > 0 ? { r: s.r / s.count, g: s.g / s.count, b: s.b / s.count } : { r: 128, g: 128, b: 128 });
    };

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

    const getColorName = (r: number, g: number, b: number, lab: { L: number, a: number, b: number }) => {
        if (lab.L < 22) return "Zona Scura / Ombra";
        if (lab.L > 82) return "Zona Luminosa / Luce";
        if (Math.abs(lab.a) < 12 && Math.abs(lab.b) < 12) return "Zona Neutra";
        if (lab.b < -18) return "Zona Blu / Azzurro";
        if (lab.b > 20 && lab.a > 10) return "Zona Giallo / Oro";
        if (lab.a < -15) return "Zona Verde";
        if (lab.a > 20) return "Zona Rosso / Terra";
        return "Zona Cromatica Media";
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Colorimetro Digitale CIE LAB D65
                        </span>
                        <span className="text-xs text-white/50 font-mono">Real-Time Area Pinning</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Marcatura Visiva <span className="text-cyan-400">Aree di Colore</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Carica un'opera d'arte ed avvia la scansione: il Colorimetro Digitale esaminerà la superficie e marchierà direttamente sul quadro ciascuna area di colore con il suo ID ed i suoi valori esatti.
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
                        <i className="fas fa-crosshair"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessun Quadro Caricato</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per abilitare la marcatura diretta delle aree di colore con il Colorimetro Digitale.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: ARTWORK DISPLAY WITH REAL-TIME PINS & PROBE (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-eye"></i> Opera: {uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {discoveredAreas.length} Aree Marcate sull'Opera
                                </span>
                            </div>

                            {/* Image Container with COLORIMETER PINS PINNED DIRECTLY ON THE CANVAS */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black flex items-center justify-center">
                                <img
                                    ref={originalImageRef}
                                    src={uploadedImageUrl}
                                    alt="Opera Scansionata"
                                    className="w-full h-full object-cover"
                                />

                                {/* COLORIMETER PROBE RETICLE ANIMATION */}
                                {probePos && (
                                    <div
                                        style={{ left: `${probePos.x}%`, top: `${probePos.y}%` }}
                                        className="absolute w-12 h-12 -ml-6 -mt-6 border-2 border-cyan-400 rounded-full animate-ping pointer-events-none flex items-center justify-center shadow-[0_0_25px_#38bdf8]"
                                    >
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                    </div>
                                )}

                                {/* VISIBLE COLORIMETER PINS PINNED DIRECTLY OVER THE ARTWORK COLOR AREAS */}
                                {discoveredAreas.map((area) => {
                                    const isActive = area.id === activeAreaId;
                                    return (
                                        <div
                                            key={area.id}
                                            style={{ left: `${area.centroidX}%`, top: `${area.centroidY}%` }}
                                            onClick={() => {
                                                setActiveAreaId(area.id);
                                                playColorimeterAudioPip(area.frequencyHz);
                                            }}
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-10 group ${
                                                isActive ? 'scale-110 z-20' : 'opacity-85 hover:opacity-100 hover:scale-105'
                                            }`}
                                        >
                                            {/* COLOR TAG / BADGE PINNED ON ARTWORK */}
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md font-mono shadow-2xl border transition-all ${
                                                isActive
                                                    ? 'bg-black/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                                                    : 'bg-slate-950/80 border-cyan-400/60 text-cyan-200 hover:border-cyan-300'
                                            }`}>
                                                <span className="w-2.5 h-2.5 rounded-full border border-white/40 shadow" style={{ backgroundColor: area.hex }}></span>
                                                <span className="text-[10px] font-bold tracking-wider">{area.id}</span>
                                                <span className="text-[9px] text-white/70 bg-white/10 px-1 rounded">{area.percentage}%</span>
                                            </div>

                                            {/* HOVER TOOLTIP METRICS */}
                                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950/95 border border-cyan-400 text-[9px] font-mono text-cyan-100 px-3 py-1.5 rounded-md whitespace-nowrap shadow-2xl pointer-events-none z-30">
                                                <div>CIE LAB: L*:{area.L} a*:{area.a} b*:{area.b_val}</div>
                                                <div>HEX: {area.hex} | Nota: {area.noteName}</div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {isScanning && (
                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-black/85 backdrop-blur-md border-t border-cyan-500/30">
                                        <div className="flex justify-between text-xs font-mono text-cyan-300 mb-1">
                                            <span>{scanStepMessage}</span>
                                            <span>{scanProgressPct}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all duration-300" style={{ width: `${scanProgressPct}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* TRIGGER SCAN BUTTON */}
                            <button
                                onClick={startDigitalColorimeterScan}
                                disabled={isScanning}
                                className={`w-full py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 shadow-xl flex items-center justify-center gap-3 ${
                                    isScanning
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white hover:scale-102 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                                }`}
                            >
                                <i className={`fas ${isScanning ? 'fa-spinner fa-spin' : 'fa-crosshair'} text-base`}></i>
                                {isScanning ? 'Scansione Colorimetrica in Corso...' : 'Avvia Scansione Colorimetro & Marcatura Aree sull Opera'}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: COLORIMETER TELEMETRY BREAKDOWN (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    📊 Registro Telemetrico Colorimetro ({discoveredAreas.length})
                                </span>
                                <span className="text-xs text-white/50">CIE LAB D65</span>
                            </div>

                            {discoveredAreas.length === 0 ? (
                                <p className="text-xs text-white/50 italic text-center py-6">
                                    Clicca su <strong>"Avvia Scansione Colorimetro"</strong> a sinistra per vedere la marcatura passo dopo passo delle aree di colore sul quadro.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {discoveredAreas.map((area) => {
                                        const isActive = area.id === activeAreaId;
                                        return (
                                            <div
                                                key={area.id}
                                                onClick={() => {
                                                    setActiveAreaId(area.id);
                                                    playColorimeterAudioPip(area.frequencyHz);
                                                }}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                                    isActive
                                                        ? 'bg-cyan-950/60 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)] ring-1 ring-amber-400'
                                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-3.5 h-3.5 rounded border border-white/30" style={{ backgroundColor: area.hex }}></span>
                                                        <span className="text-xs font-bold text-amber-300">{area.id}</span>
                                                        <span className="text-xs text-white font-medium">{area.label}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                                                        {area.percentage}% Superficie
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70 pt-1 border-t border-white/5">
                                                    <div>CIE LAB: <strong className="text-cyan-200">L*:{area.L} a*:{area.a} b*:{area.b_val}</strong></div>
                                                    <div>Colore HEX: <strong className="text-white">{area.hex}</strong></div>
                                                    <div>Nota Basale: <strong className="text-amber-300">{area.noteName}</strong></div>
                                                    <div>Frequenza: <strong className="text-emerald-300">{area.frequencyHz} Hz</strong></div>
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
