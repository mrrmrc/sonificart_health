import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

export interface ColorRegion {
    id: string;
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
    midiNote: number;
    noteName: string;
    frequencyHz: number;
    maskCanvasDataUrl?: string;
}

export const CamPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const { t } = useLanguage();

    // Image Upload State
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState<string>('');

    // Meticulous Color Segmentation State
    const [colorRegions, setColorRegions] = useState<ColorRegion[]>([]);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'segmented'>('segmented');

    // Canvas Refs for Real Segmentation Rendering
    const originalImageRef = useRef<HTMLImageElement>(null);
    const segmentationCanvasRef = useRef<HTMLCanvasElement>(null);

    // Audio Playback Ref
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            setColorRegions([]);
            setSelectedRegionId(null);
        }
    };

    // Trigger Meticulous Color Segmentation Analysis when Image Loads
    const runMeticulousColorSegmentation = () => {
        if (!originalImageRef.current || !uploadedImageUrl) return;

        setIsAnalyzing(true);
        setAnalysisProgress("Estrazione meticolosa delle aree di colore in corso...");

        const img = originalImageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Downscale for fast & accurate clustering
        const sampleW = 256;
        const sampleH = Math.round((img.naturalHeight / img.naturalWidth) * sampleW);
        canvas.width = sampleW;
        canvas.height = sampleH;

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imageData.data;
        const totalPixels = sampleW * sampleH;

        // K-Means Color Quantization (K=7 Color Clusters)
        setTimeout(() => {
            const k = 7;
            let centroids = initializeCentroids(data, k);

            // Run K-Means iterations
            let assignments = new Int32Array(totalPixels);
            for (let iter = 0; iter < 8; iter++) {
                assignments = assignPixelsToCentroids(data, centroids, totalPixels);
                centroids = updateCentroids(data, assignments, k, totalPixels);
            }

            // Count pixel distribution per cluster
            const clusterCounts = new Int32Array(k);
            for (let i = 0; i < totalPixels; i++) {
                clusterCounts[assignments[i]]++;
            }

            // Create Meticulous Color Regions Array
            const extractedRegions: ColorRegion[] = [];

            // Sort clusters by surface area (percentage) descending
            const sortedClusterIndices = Array.from({ length: k }, (_, i) => i)
                .sort((a, b) => clusterCounts[b] - clusterCounts[a]);

            sortedClusterIndices.forEach((cIdx, rank) => {
                const count = clusterCounts[cIdx];
                if (count === 0) return;

                const pct = parseFloat(((count / totalPixels) * 100).toFixed(1));
                const c = centroids[cIdx];
                const r = Math.round(c.r);
                const g = Math.round(c.g);
                const b = Math.round(c.b);
                const hex = rgbToHex(r, g, b);

                // Convert RGB to CIE LAB (D65 Standard)
                const lab = rgbToLab(r, g, b);

                // Deterministic Base Note (Mapped to L* and Hue)
                const midiNote = 48 + Math.round((lab.L / 100) * 24); // C3 to C5
                const noteName = midiToNoteName(midiNote);
                const freqHz = Math.round(440 * Math.pow(2, (midiNote - 69) / 12));

                const colorName = getColorDescription(r, g, b, lab);

                extractedRegions.push({
                    id: `COLOR_AREA_${rank + 1}`,
                    name: `Area ${rank + 1}: ${colorName}`,
                    r, g, b, hex,
                    percentage: pct,
                    pixelCount: count,
                    L: Math.round(lab.L),
                    a: Math.round(lab.a),
                    b_val: Math.round(lab.b),
                    midiNote,
                    noteName,
                    frequencyHz: freqHz
                });
            });

            setColorRegions(extractedRegions);
            setIsAnalyzing(false);
            if (extractedRegions.length > 0) {
                setSelectedRegionId(extractedRegions[0].id);
                renderSegmentationMask(imageData, assignments, centroids, extractedRegions[0].id, extractedRegions);
            }
        }, 100);
    };

    // Render Organic Segmentation Mask on Canvas Overlay
    const renderSegmentationMask = (
        imgData: ImageData,
        assignments: Int32Array,
        centroids: Array<{ r: number; g: number; b: number }>,
        highlightId: string | null,
        regions: ColorRegion[]
    ) => {
        if (!segmentationCanvasRef.current || !originalImageRef.current) return;

        const canvas = segmentationCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = imgData.width;
        const h = imgData.height;
        canvas.width = w;
        canvas.height = h;

        const outData = ctx.createImageData(w, h);
        const src = imgData.data;
        const dest = outData.data;

        // Find index of highlighted region
        const targetIndex = regions.findIndex(r => r.id === highlightId);

        for (let i = 0; i < assignments.length; i++) {
            const clusterIdx = assignments[i];
            const px = i * 4;

            if (highlightId === null || clusterIdx === targetIndex) {
                dest[px] = src[px];       // R
                dest[px + 1] = src[px + 1]; // G
                dest[px + 2] = src[px + 2]; // B
                dest[px + 3] = 255;         // Opaque
            } else {
                // Dim non-selected color areas to highlight selected area
                dest[px] = Math.round(src[px] * 0.2);
                dest[px + 1] = Math.round(src[px + 1] * 0.2);
                dest[px + 2] = Math.round(src[px + 2] * 0.2);
                dest[px + 3] = 160;
            }
        }

        ctx.putImageData(outData, 0, 0);
    };

    // Play Pure Tone for Selected Color Region
    const playRegionAudio = (region: ColorRegion) => {
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
            osc.frequency.setValueAtTime(region.frequencyHz, now);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {
            console.warn("Audio play error:", e);
        }
    };

    // Helper: K-Means Initial Centroids
    const initializeCentroids = (data: Uint8ClampedArray, k: number) => {
        const centroids = [];
        const step = Math.floor(data.length / 4 / k);
        for (let i = 0; i < k; i++) {
            const idx = (i * step) * 4;
            centroids.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        }
        return centroids;
    };

    // Helper: K-Means Distance Assign
    const assignPixelsToCentroids = (data: Uint8ClampedArray, centroids: Array<{ r: number; g: number; b: number }>, totalPixels: number) => {
        const assignments = new Int32Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            const px = i * 4;
            const r = data[px];
            const g = data[px + 1];
            const b = data[px + 2];

            let minDist = Infinity;
            let closestCluster = 0;

            for (let c = 0; c < centroids.length; c++) {
                const dr = r - centroids[c].r;
                const dg = g - centroids[c].g;
                const db = b - centroids[c].b;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < minDist) {
                    minDist = dist;
                    closestCluster = c;
                }
            }
            assignments[i] = closestCluster;
        }
        return assignments;
    };

    // Helper: Update Centroids
    const updateCentroids = (data: Uint8ClampedArray, assignments: Int32Array, k: number, totalPixels: number) => {
        const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
        for (let i = 0; i < totalPixels; i++) {
            const px = i * 4;
            const c = assignments[i];
            sums[c].r += data[px];
            sums[c].g += data[px + 1];
            sums[c].b += data[px + 2];
            sums[c].count++;
        }
        return sums.map(s => s.count > 0 ? { r: s.r / s.count, g: s.g / s.count, b: s.b / s.count } : { r: 128, g: 128, b: 128 });
    };

    // Color Converter Helpers
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
        const octave = Math.floor(midi / 12) - 1;
        return `${names[midi % 12]}${octave}`;
    };

    const getColorDescription = (r: number, g: number, b: number, lab: { L: number, a: number, b: number }) => {
        if (lab.L < 20) return "Toni Scuri / Nero Profondo";
        if (lab.L > 85) return "Luminoso / Bianco e Luce";
        if (Math.abs(lab.a) < 10 && Math.abs(lab.b) < 10) return "Grigio Neutro";
        if (lab.b < -20) return "Blu Notte / Cobalto";
        if (lab.b > 20 && lab.a > 10) return "Giallo Caldo / Oro";
        if (lab.a < -15) return "Verde Smeraldo / Vegetale";
        if (lab.a > 20) return "Rosso / Terra d'Ombra";
        return "Tonalità Cromatica Media";
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Segmentazione Colorimetrica Meticolosa
                        </span>
                        <span className="text-xs text-white/50 font-mono">CIE LAB D65 Cluster Engine</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Estrazione Meticolosa <span className="text-cyan-400">Aree di Colore</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Carica un quadro per consentire all'IA di identificare, scontornare ed analizzare con precisione meticolosa le singole regioni di colore e la loro traduzione sonora.
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
                        <i className="fas fa-palette"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessun Quadro Caricato</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per avviare l'identificazione e la segmentazione meticolosa delle aree di colore.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: ARTWORK & SEGMENTATION MASK DISPLAY (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-microscope"></i> Opera: {uploadedFileName}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveTab('segmented')}
                                        className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${activeTab === 'segmented' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/50 hover:text-white'}`}
                                    >
                                        Maschera Segmentata
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${activeTab === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/50 hover:text-white'}`}
                                    >
                                        Originale
                                    </button>
                                </div>
                            </div>

                            {/* Image Container with Canvas Mask Overlay */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black flex items-center justify-center">
                                {/* Hidden Original Image for Analysis */}
                                <img
                                    ref={originalImageRef}
                                    src={uploadedImageUrl}
                                    alt="Opera Scansionata"
                                    className={`w-full h-full object-cover ${activeTab === 'all' ? 'block' : 'hidden'}`}
                                    onLoad={runMeticulousColorSegmentation}
                                />

                                {/* Segmentation Mask Canvas */}
                                <canvas
                                    ref={segmentationCanvasRef}
                                    className={`w-full h-full object-cover ${activeTab === 'segmented' ? 'block' : 'hidden'}`}
                                />

                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
                                        <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
                                        <p className="text-xs font-mono text-cyan-300 font-bold">{analysisProgress}</p>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-white/50 font-mono italic text-center">
                                💡 Clicca su un'area di colore nella lista a destra per isolarla ed ascoltarne la nota basale deterministica.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: METICULOUS COLOR REGIONS BREAKDOWN (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    🎨 Aree di Colore Individuate ({colorRegions.length})
                                </span>
                                <span className="text-xs text-white/50">CIE LAB D65</span>
                            </div>

                            {/* Color Regions List */}
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {colorRegions.map((region) => {
                                    const isSelected = region.id === selectedRegionId;
                                    return (
                                        <div
                                            key={region.id}
                                            onClick={() => {
                                                setSelectedRegionId(region.id);
                                                playRegionAudio(region);
                                                if (originalImageRef.current) {
                                                    // Re-render canvas mask for selected region
                                                    const canvas = document.createElement('canvas');
                                                    const ctx = canvas.getContext('2d');
                                                    if (ctx) {
                                                        const img = originalImageRef.current;
                                                        canvas.width = 256;
                                                        canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * 256);
                                                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                                                        // Re-assign for single region highlight
                                                        const centroids = colorRegions.map(r => ({ r: r.r, g: r.g, b: r.b }));
                                                        const assignments = assignPixelsToCentroids(imageData.data, centroids, canvas.width * canvas.height);
                                                        renderSegmentationMask(imageData, assignments, centroids, region.id, colorRegions);
                                                    }
                                                }
                                            }}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                                isSelected
                                                    ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-1 ring-cyan-400'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-5 h-5 rounded-lg border border-white/30 shadow-md shrink-0" style={{ backgroundColor: region.hex }}></span>
                                                    <span className="text-xs font-bold text-white">{region.name}</span>
                                                </div>
                                                <span className="text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                                                    {region.percentage}% Superficie
                                                </span>
                                            </div>

                                            {/* Details Breakdown */}
                                            <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70 pt-1 border-t border-white/5">
                                                <div>CIE LAB: <strong className="text-cyan-200">L*:{region.L} a*:{region.a} b*:{region.b_val}</strong></div>
                                                <div>Colore Hex: <strong className="text-white">{region.hex}</strong></div>
                                                <div>Nota Basale: <strong className="text-amber-300">{region.noteName} ({region.frequencyHz} Hz)</strong></div>
                                                <div>Frequenza: <strong className="text-emerald-300">{region.frequencyHz} Hz</strong></div>
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
