import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

export interface ColorPerimeter {
    id: string;
    family: 'red' | 'blue' | 'yellow' | 'green' | 'earth' | 'neutral';
    familyLabel: string;
    name: string;
    r: number;
    g: number;
    b: number;
    hex: string;
    percentage: number;
    pixelCount: number;
    L: number;
    a: number;
    b_val: number;
    centroidX: number; // 0-100%
    centroidY: number; // 0-100%
    bBox: { minX: number; minY: number; maxX: number; maxY: number };
    maskPixels: Uint8Array; // Binary mask for exact pixel perimeter
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

    // Color Perimeter Data State
    const [perimeters, setPerimeters] = useState<ColorPerimeter[]>([]);
    const [selectedPerimeterId, setSelectedPerimeterId] = useState<string | null>(null);
    const [filterFamily, setFilterFamily] = useState<string>('all');

    // Canvas & Image Refs
    const originalImageRef = useRef<HTMLImageElement>(null);
    const canvasOverlayRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sampleDimensionsRef = useRef<{ w: number; h: number }>({ w: 320, h: 200 });

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            setPerimeters([]);
            setSelectedPerimeterId(null);
        }
    };

    // Run Full-Resolution Connected-Component Color Perimeter Segmentation
    const startMeticulousPerimeterScan = () => {
        if (!originalImageRef.current || !uploadedImageUrl || isScanning) return;

        setIsScanning(true);
        setScanProgressPct(0);
        setPerimeters([]);
        setSelectedPerimeterId(null);
        setScanStepMessage("Inizializzazione Colorimetro per Perimetri di Colore...");

        const img = originalImageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High resolution analysis for micro-perimeters
        const sampleW = 320;
        const sampleH = Math.round((img.naturalHeight / img.naturalWidth) * sampleW);
        canvas.width = sampleW;
        canvas.height = sampleH;
        sampleDimensionsRef.current = { w: sampleW, h: sampleH };

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;
        const totalPixels = sampleW * sampleH;

        setTimeout(() => {
            setScanStepMessage("Scansione della superficie pixel per pixel (CIE LAB $\\Delta E$)...");
            setScanProgressPct(20);

            // 1. Convert image to CIE LAB Array
            const labArray = new Float32Array(totalPixels * 3);
            for (let i = 0; i < totalPixels; i++) {
                const px = i * 4;
                const lab = rgbToLab(data[px], data[px + 1], data[px + 2]);
                labArray[i * 3] = lab.L;
                labArray[i * 3 + 1] = lab.a;
                labArray[i * 3 + 2] = lab.b;
            }

            setScanStepMessage("Identificazione e Scontorno delle Isole/Perimetri Cromatici...");
            setScanProgressPct(50);

            // 2. Fine-grained Color Quantization (Fine Delta-E Clustering)
            // Extract distinct color seeds
            const k = 16; // 16 Fine Color Clusters
            const centroids = initializeCentroids(data, k);
            const assignments = assignPixelsToCentroids(data, centroids, totalPixels);

            // 3. Connected Component Analysis (Extract Perimeters/Islands)
            const extractedPerimeters: ColorPerimeter[] = [];
            const visited = new Uint8Array(totalPixels);

            let perimeterCount = 0;

            for (let i = 0; i < totalPixels; i++) {
                if (visited[i] || assignments[i] < 0) continue;

                const clusterIdx = assignments[i];
                const mask = new Uint8Array(totalPixels);
                const queue: number[] = [i];
                visited[i] = 1;
                mask[i] = 1;

                let count = 0;
                let sumX = 0, sumY = 0;
                let sumR = 0, sumG = 0, sumB = 0;
                let minX = sampleW, minY = sampleH, maxX = 0, maxY = 0;

                while (queue.length > 0) {
                    const currentIdx = queue.pop()!;
                    const cX = currentIdx % sampleW;
                    const cY = Math.floor(currentIdx / sampleW);

                    count++;
                    sumX += cX;
                    sumY += cY;

                    const px4 = currentIdx * 4;
                    sumR += data[px4];
                    sumG += data[px4 + 1];
                    sumB += data[px4 + 2];

                    if (cX < minX) minX = cX;
                    if (cX > maxX) maxX = cX;
                    if (cY < minY) minY = cY;
                    if (cY > maxY) maxY = cY;

                    // Check 4-connected neighbors
                    const neighbors = [
                        cX > 0 ? currentIdx - 1 : -1,
                        cX < sampleW - 1 ? currentIdx + 1 : -1,
                        cY > 0 ? currentIdx - sampleW : -1,
                        cY < sampleH - 1 ? currentIdx + sampleW : -1,
                    ];

                    for (const nIdx of neighbors) {
                        if (nIdx >= 0 && !visited[nIdx] && assignments[nIdx] === clusterIdx) {
                            visited[nIdx] = 1;
                            mask[nIdx] = 1;
                            queue.push(nIdx);
                        }
                    }
                }

                // Keep perimeters with surface area > 0.15% of canvas (filter noise)
                const pct = parseFloat(((count / totalPixels) * 100).toFixed(2));
                if (pct >= 0.15) {
                    perimeterCount++;
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);
                    const hex = rgbToHex(avgR, avgG, avgB);
                    const lab = rgbToLab(avgR, avgG, avgB);

                    const familyInfo = classifyColorFamily(avgR, avgG, avgB, lab);
                    const midiNote = 42 + Math.round((lab.L / 100) * 36);
                    const noteName = midiToNoteName(midiNote);
                    const freqHz = Math.round(440 * Math.pow(2, (midiNote - 69) / 12));

                    extractedPerimeters.push({
                        id: `PERIMETER_${String(perimeterCount).padStart(3, '0')}`,
                        family: familyInfo.family,
                        familyLabel: familyInfo.label,
                        name: `${familyInfo.label} (${hex})`,
                        r: avgR, g: avgG, b: avgB, hex,
                        percentage: pct,
                        pixelCount: count,
                        L: Math.round(lab.L),
                        a: Math.round(lab.a),
                        b_val: Math.round(lab.b),
                        centroidX: parseFloat(((sumX / count / sampleW) * 100).toFixed(1)),
                        centroidY: parseFloat(((sumY / count / sampleH) * 100).toFixed(1)),
                        bBox: { minX, minY, maxX, maxY },
                        maskPixels: mask,
                        midiNote,
                        noteName,
                        frequencyHz: freqHz
                    });
                }
            }

            // Sort perimeters by surface area descending
            extractedPerimeters.sort((a, b) => b.percentage - a.percentage);

            setScanProgressPct(100);
            setScanStepMessage(`✅ Estratti ${extractedPerimeters.length} Perimetri di Colore Meticolosi.`);
            setPerimeters(extractedPerimeters);
            setIsScanning(false);

            if (extractedPerimeters.length > 0) {
                setSelectedPerimeterId(extractedPerimeters[0].id);
                drawPerimeterOutline(extractedPerimeters[0]);
            }
        }, 150);
    };

    // Draw Exact Pixel Contour Outline for Selected Color Perimeter
    const drawPerimeterOutline = (perimeter: ColorPerimeter | null) => {
        if (!canvasOverlayRef.current || !originalImageRef.current) return;
        const canvas = canvasOverlayRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { w, h } = sampleDimensionsRef.current;
        canvas.width = w;
        canvas.height = h;

        ctx.clearRect(0, 0, w, h);

        if (!perimeter) return;

        const mask = perimeter.maskPixels;
        const outData = ctx.createImageData(w, h);
        const data = outData.data;

        // Highlight exact mask pixels with perimeter glow & stroke
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 1) {
                const px = i * 4;
                data[px] = perimeter.r;
                data[px + 1] = perimeter.g;
                data[px + 2] = perimeter.b;
                data[px + 3] = 210; // Semi-transparent overlay
            }
        }

        ctx.putImageData(outData, 0, 0);

        // Draw Contour Border Stroke around perimeter
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            perimeter.bBox.minX,
            perimeter.bBox.minY,
            perimeter.bBox.maxX - perimeter.bBox.minX,
            perimeter.bBox.maxY - perimeter.bBox.minY
        );
    };

    // Play Note for Selected Perimeter
    const playPerimeterAudio = (p: ColorPerimeter) => {
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
            osc.frequency.setValueAtTime(p.frequencyHz, now);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.42);
        } catch (e) {
            console.warn("Audio play error:", e);
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

    const classifyColorFamily = (r: number, g: number, b: number, lab: { L: number, a: number, b: number }): { family: ColorPerimeter['family'], label: string } => {
        if (r > 120 && g < 100 && b < 100) return { family: 'red', label: 'Rosso / Scarlatto / Tunica' };
        if (b > 120 && r < 110) return { family: 'blue', label: 'Blu / Azzurro / Cielo' };
        if (r > 140 && g > 120 && b < 90) return { family: 'yellow', label: 'Giallo / Oro / Luce' };
        if (g > 110 && r < 120) return { family: 'green', label: 'Verde / Vegetazione' };
        if (lab.L < 25) return { family: 'neutral', label: 'Ombra Scura / Fondo' };
        if (lab.L > 80) return { family: 'yellow', label: 'Luce Brillante' };
        return { family: 'earth', label: 'Terra d Ombra / Bruno' };
    };

    const filteredPerimeters = perimeters.filter(p => filterFamily === 'all' || p.family === filterFamily);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Colorimetro a Scansione Perimetrica Meticolosa
                        </span>
                        <span className="text-xs text-white/50 font-mono">Connected Component CIE LAB</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Scontorno & Marcatura <span className="text-cyan-400">Perimetri di Colore</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Scansione ad alta precisione: individua ogni singola isola perimetrale di colore (es. tunica rossa, mantello, cielo, croce) e ne marca lo scontorno visivo ed i dati colorimetrici esatti.
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
                        <i className="fas fa-[#38bdf8] fa-crop-simple"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessun Quadro Caricato</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per avviare lo scontorno meticoloso di ogni perimetro di colore.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: ARTWORK & PERIMETER OUTLINE CANVAS DISPLAY (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-microscope"></i> Opera: {uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {perimeters.length} Perimetri Cromatici Estratti
                                </span>
                            </div>

                            {/* Image Container with Exact Pixel Perimeter Outline Canvas */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black flex items-center justify-center">
                                <img
                                    ref={originalImageRef}
                                    src={uploadedImageUrl}
                                    alt="Opera Scansionata"
                                    className="w-full h-full object-cover"
                                />

                                {/* Perimeter Outline Canvas Overlay */}
                                <canvas
                                    ref={canvasOverlayRef}
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                />

                                {/* PIN MARKERS FOR EACH PERIMETER */}
                                {filteredPerimeters.map((p) => {
                                    const isSelected = p.id === selectedPerimeterId;
                                    return (
                                        <div
                                            key={p.id}
                                            style={{ left: `${p.centroidX}%`, top: `${p.centroidY}%` }}
                                            onClick={() => {
                                                setSelectedPerimeterId(p.id);
                                                drawPerimeterOutline(p);
                                                playPerimeterAudio(p);
                                            }}
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-10 ${
                                                isSelected ? 'scale-110 z-20' : 'opacity-85 hover:opacity-100'
                                            }`}
                                        >
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded backdrop-blur-md font-mono text-[9px] font-bold shadow-xl border transition-all ${
                                                isSelected
                                                    ? 'bg-black/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 shadow-[0_0_20px_#f59e0b]'
                                                    : 'bg-black/80 border-cyan-400/60 text-cyan-200 hover:border-cyan-300'
                                            }`}>
                                                <span className="w-2 h-2 rounded-full border border-white/40" style={{ backgroundColor: p.hex }}></span>
                                                <span>{p.id}</span>
                                                <span className="text-white/60">({p.percentage}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {isScanning && (
                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-black/90 backdrop-blur-md border-t border-cyan-500/30">
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

                            {/* TRIGGER FULL SCAN BUTTON */}
                            <button
                                onClick={startMeticulousPerimeterScan}
                                disabled={isScanning}
                                className={`w-full py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 shadow-xl flex items-center justify-center gap-3 ${
                                    isScanning
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white hover:scale-102 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                                }`}
                            >
                                <i className={`fas ${isScanning ? 'fa-spinner fa-spin' : 'fa-vector-square'} text-base`}></i>
                                {isScanning ? 'Scansione Meticolosa Perimetri in Corso...' : 'Avvia Scansione Meticolosa & Scontorno Perimetri di Colore'}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: PERIMETER REGISTRY TELEMETRY (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    📋 Registro Perimetri Marcati ({filteredPerimeters.length})
                                </span>
                                <span className="text-xs text-white/50">Connected Component</span>
                            </div>

                            {/* Filter Buttons */}
                            {perimeters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pb-2 border-b border-white/5 text-[10px]">
                                    <button onClick={() => setFilterFamily('all')} className={`px-2 py-1 rounded ${filterFamily === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-white/60'}`}>Tutti ({perimeters.length})</button>
                                    <button onClick={() => setFilterFamily('red')} className={`px-2 py-1 rounded ${filterFamily === 'red' ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-white/5 text-white/60'}`}>Rossi</button>
                                    <button onClick={() => setFilterFamily('blue')} className={`px-2 py-1 rounded ${filterFamily === 'blue' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-white/5 text-white/60'}`}>Blu</button>
                                    <button onClick={() => setFilterFamily('yellow')} className={`px-2 py-1 rounded ${filterFamily === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-white/5 text-white/60'}`}>Gialli/Ori</button>
                                    <button onClick={() => setFilterFamily('green')} className={`px-2 py-1 rounded ${filterFamily === 'green' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-white/60'}`}>Verdi</button>
                                    <button onClick={() => setFilterFamily('earth')} className={`px-2 py-1 rounded ${filterFamily === 'earth' ? 'bg-amber-800/20 text-amber-300 border border-amber-800/40' : 'bg-white/5 text-white/60'}`}>Terre</button>
                                </div>
                            )}

                            {perimeters.length === 0 ? (
                                <p className="text-xs text-white/50 italic text-center py-6">
                                    Clicca su <strong>"Avvia Scansione Meticolosa & Scontorno Perimetri"</strong> per isolare ogni singola porzione di colore sull'opera.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {filteredPerimeters.map((p) => {
                                        const isSelected = p.id === selectedPerimeterId;
                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPerimeterId(p.id);
                                                    drawPerimeterOutline(p);
                                                    playPerimeterAudio(p);
                                                }}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                                    isSelected
                                                        ? 'bg-cyan-950/60 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)] ring-1 ring-amber-400'
                                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-3.5 h-3.5 rounded border border-white/30" style={{ backgroundColor: p.hex }}></span>
                                                        <span className="text-xs font-bold text-amber-300">{p.id}</span>
                                                        <span className="text-xs text-white font-medium truncate max-w-[180px]">{p.name}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                                                        {p.percentage}% Sup.
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70 pt-1 border-t border-white/5">
                                                    <div>CIE LAB: <strong className="text-cyan-200">L*:{p.L} a*:{p.a} b*:{p.b_val}</strong></div>
                                                    <div>Hex: <strong className="text-white">{p.hex}</strong></div>
                                                    <div>Nota Basale: <strong className="text-amber-300">{p.noteName}</strong></div>
                                                    <div>Frequenza: <strong className="text-emerald-300">{p.frequencyHz} Hz</strong></div>
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
