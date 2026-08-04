import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
}

export interface OrganicColorShape {
    idNumber: number;
    idCode: string;
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
    pixelIndices: Int32Array; // Array of pixel indices in this organic shape
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

    // Organic Shapes State
    const [shapes, setShapes] = useState<OrganicColorShape[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [selectedShape, setSelectedShape] = useState<OrganicColorShape | null>(null);

    // Canvas & Audio Refs
    const originalImageRef = useRef<HTMLImageElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const deconstructionTimerRef = useRef<any>(null);
    const imageDimensionsRef = useRef<{ w: number; h: number }>({ w: 320, h: 200 });

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);
            setUploadedFileName(file.name);
            stopDeconstruction();
            setShapes([]);
            setCurrentStepIndex(0);
            setSelectedShape(null);
        }
    };

    // Extract True Organic Color Shapes via Connected Component Flood-Fill
    const extractOrganicColorShapes = () => {
        if (!originalImageRef.current || !uploadedImageUrl) return;

        setIsDeconstructing(true);
        setScanStepMessage("Estrazione meticolosa forme organiche (Inseguimento colore)...");

        const img = originalImageRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resolution for organic shape extraction
        const w = 320;
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
        canvas.width = w;
        canvas.height = h;
        imageDimensionsRef.current = { w, h };

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        // Render Initial Image on Main Interactive Canvas
        if (mainCanvasRef.current) {
            const mainCtx = mainCanvasRef.current.getContext('2d');
            if (mainCtx) {
                mainCanvasRef.current.width = w;
                mainCanvasRef.current.height = h;
                mainCtx.putImageData(imgData, 0, 0);
            }
        }

        setTimeout(() => {
            // 1. Color Quantization for Seed Clustering
            const k = 14; // 14 Organic Color Families
            const centroids = initializeCentroids(data, k);
            const assignments = assignPixelsToCentroids(data, centroids, totalPixels);

            // 2. Connected-Component Flood Fill for Organic Shapes (No Boxes!)
            const visited = new Uint8Array(totalPixels);
            const extractedShapes: OrganicColorShape[] = [];
            let shapeCounter = 1;

            // Sequential Reading Order Scan: Top-Left to Bottom-Right
            for (let i = 0; i < totalPixels; i++) {
                if (visited[i]) continue;

                const targetCluster = assignments[i];
                const shapePixelList: number[] = [];
                const queue: number[] = [i];
                visited[i] = 1;

                let sumX = 0, sumY = 0;
                let sumR = 0, sumG = 0, sumB = 0;

                while (queue.length > 0) {
                    const currentIdx = queue.pop()!;
                    shapePixelList.push(currentIdx);

                    const cx = currentIdx % w;
                    const cy = Math.floor(currentIdx / w);
                    sumX += cx;
                    sumY += cy;

                    const px4 = currentIdx * 4;
                    sumR += data[px4];
                    sumG += data[px4 + 1];
                    sumB += data[px4 + 2];

                    // 4-Connected Neighbors (Up, Down, Left, Right)
                    const neighbors = [
                        cx > 0 ? currentIdx - 1 : -1,
                        cx < w - 1 ? currentIdx + 1 : -1,
                        cy > 0 ? currentIdx - w : -1,
                        cy < h - 1 ? currentIdx + w : -1,
                    ];

                    for (const nIdx of neighbors) {
                        if (nIdx >= 0 && !visited[nIdx] && assignments[nIdx] === targetCluster) {
                            visited[nIdx] = 1;
                            queue.push(nIdx);
                        }
                    }
                }

                // Filter out tiny noise pixels (keep organic shapes >= 0.1% surface)
                const count = shapePixelList.length;
                const pct = parseFloat(((count / totalPixels) * 100).toFixed(2));

                if (pct >= 0.10) {
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);
                    const hex = rgbToHex(avgR, avgG, avgB);
                    const lab = rgbToLab(avgR, avgG, avgB);

                    const midiNote = 42 + Math.round((lab.L / 100) * 36);
                    const noteName = midiToNoteName(midiNote);
                    const freqHz = Math.round(440 * Math.pow(2, (midiNote - 69) / 12));
                    const shapeName = getOrganicShapeDescription(avgR, avgG, avgB, lab);

                    extractedShapes.push({
                        idNumber: shapeCounter,
                        idCode: `#${String(shapeCounter).padStart(3, '0')}`,
                        name: `${shapeName} (${pct}%)`,
                        r: avgR, g: avgG, b: avgB, hex,
                        percentage: pct,
                        pixelCount: count,
                        L: Math.round(lab.L),
                        a: Math.round(lab.a),
                        b_val: Math.round(lab.b),
                        centroidX: parseFloat(((sumX / count / w) * 100).toFixed(1)),
                        centroidY: parseFloat(((sumY / count / h) * 100).toFixed(1)),
                        pixelIndices: new Int32Array(shapePixelList),
                        isDetached: false,
                        midiNote,
                        noteName,
                        frequencyHz: freqHz
                    });

                    shapeCounter++;
                }
            }

            setShapes(extractedShapes);
            setIsDeconstructing(false);
            setScanStepMessage(`✅ Estratte ${extractedShapes.length} Forme Organiche di Colore. Pronti allo stacco.`);
            if (extractedShapes.length > 0) {
                setSelectedShape(extractedShapes[0]);
            }
        }, 150);
    };

    // Run Sequential "Stacco Forme Organiche" Animation (Turns exact shape WHITE!)
    const startOrganicDeconstruction = () => {
        if (shapes.length === 0 || isDeconstructing) return;

        setIsDeconstructing(true);
        setScanStepMessage("Stacco progressivo forme organiche verso la Tela Bianca...");

        if (deconstructionTimerRef.current) clearInterval(deconstructionTimerRef.current);

        let step = currentStepIndex >= shapes.length ? 0 : currentStepIndex;

        deconstructionTimerRef.current = setInterval(() => {
            if (step >= shapes.length) {
                clearInterval(deconstructionTimerRef.current);
                setIsDeconstructing(false);
                setScanStepMessage("✅ Quadro 100% Staccato: Convertito in Tela Bianca Organica.");
                return;
            }

            const currentShape = shapes[step];
            if (currentShape) {
                // Peel exact organic shape off the main canvas (turn those exact pixels WHITE!)
                peelShapeToWhiteCanvas(currentShape);

                // Mark shape as detached in state
                setShapes(prev => {
                    const next = [...prev];
                    next[step] = { ...next[step], isDetached: true };
                    return next;
                });

                setSelectedShape(currentShape);
                playShapeAudio(currentShape.frequencyHz);
            }

            setCurrentStepIndex(step + 1);
            setProgressPct(Math.round(((step + 1) / shapes.length) * 100));

            step++;
        }, 220); // 220ms per organic shape peel
    };

    // Turn Exact Organic Shape Pixels to Pure White Canvas
    const peelShapeToWhiteCanvas = (shape: OrganicColorShape) => {
        if (!mainCanvasRef.current) return;
        const canvas = mainCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { w, h } = imageDimensionsRef.current;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Turn only pixels belonging to this exact organic shape into pure WHITE
        const indices = shape.pixelIndices;
        for (let i = 0; i < indices.length; i++) {
            const px = indices[i] * 4;
            data[px] = 255;     // White R
            data[px + 1] = 255; // White G
            data[px + 2] = 255; // White B
            data[px + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);

        // Draw organic perimeter stroke and ID label
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 9px monospace';

        const labelX = (shape.centroidX / 100) * w;
        const labelY = (shape.centroidY / 100) * h;
        ctx.fillText(shape.idCode, labelX - 10, labelY + 3);
    };

    // Stop Animation
    const stopDeconstruction = () => {
        if (deconstructionTimerRef.current) {
            clearInterval(deconstructionTimerRef.current);
            deconstructionTimerRef.current = null;
        }
        setIsDeconstructing(false);
    };

    // Reset Deconstruction (Restore Original Painting)
    const resetDeconstruction = () => {
        stopDeconstruction();
        setCurrentStepIndex(0);
        setProgressPct(0);
        setShapes(prev => prev.map(s => ({ ...s, isDetached: false })));

        if (originalImageRef.current && mainCanvasRef.current) {
            const img = originalImageRef.current;
            const canvas = mainCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const { w, h } = imageDimensionsRef.current;
                ctx.drawImage(img, 0, 0, w, h);
            }
        }
        if (shapes.length > 0) setSelectedShape(shapes[0]);
    };

    // Play Audio Note for Organic Shape
    const playShapeAudio = (freqHz: number) => {
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
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.32);
        } catch (e) {
            console.warn("Audio play error:", e);
        }
    };

    // Processing Helpers
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

    const getOrganicShapeDescription = (r: number, g: number, b: number, lab: { L: number, a: number, b: number }) => {
        if (r > 120 && g < 100 && b < 100) return "Forma Organica Rossa / Scarlatto";
        if (b > 120 && r < 110) return "Forma Organica Blu / Azzurro Nuvola";
        if (r > 140 && g > 120 && b < 90) return "Forma Organica Gialla / Luce";
        if (g > 110 && r < 120) return "Forma Organica Verde / Vestito";
        if (lab.L < 25) return "Forma Organica Scura / Ombra";
        if (lab.L > 80) return "Forma Organica Chiara / Bianco";
        return "Forma Organica Cromatica";
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
                            Stacco Forme Organiche di Colore (Nessun Riquadro)
                        </span>
                        <span className="text-xs text-white/50 font-mono">Organic Flood-Fill Peeling</span>
                    </div>
                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Inseguimento & <span className="text-cyan-400">Stacco Forme Organiche</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Il sistema insegue le reali forme organiche del colore (vestiti verdi, nuvole blu, mantelli rossi, volti) e le stacca una ad una dal quadro lasciando la tela bianca.
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
                        <i className="fas fa-wand-magic-sparkles"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Nessun Quadro Caricato</h3>
                    <p className="text-sm text-white/60 max-w-md mx-auto">
                        Clicca sul pulsante in alto <strong>"Carica Immagine Opera"</strong> per avviare l'inseguimento e lo stacco delle forme organiche di colore.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: MAIN CANVAS FOR ORGANIC SHAPE PEELING TO WHITE (7 COLS) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-microscope"></i> Opera: {uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {currentStepIndex}/{shapes.length} Forme Organiche Staccate ({progressPct}%)
                                </span>
                            </div>

                            {/* Canvas Container with Real-Time Organic White Peel */}
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-white flex items-center justify-center shadow-inner">
                                {/* Hidden Original Image for Reference */}
                                <img
                                    ref={originalImageRef}
                                    src={uploadedImageUrl}
                                    alt="Originale"
                                    className="hidden"
                                    onLoad={extractOrganicColorShapes}
                                />

                                {/* Interactive Canvas showing exact organic shape peeling to WHITE */}
                                <canvas
                                    ref={mainCanvasRef}
                                    className="w-full h-full object-cover shadow-2xl"
                                />

                                {/* ORGANIC SHAPE PIN BADGES OVERLAY */}
                                {shapes.map((s) => {
                                    const isSelected = selectedShape?.idCode === s.idCode;
                                    return (
                                        <div
                                            key={s.idCode}
                                            style={{ left: `${s.centroidX}%`, top: `${s.centroidY}%` }}
                                            onClick={() => {
                                                setSelectedShape(s);
                                                playShapeAudio(s.frequencyHz);
                                            }}
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 pointer-events-auto z-10 ${
                                                isSelected ? 'scale-110 z-20' : 'opacity-85 hover:opacity-100'
                                            }`}
                                        >
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded backdrop-blur-md font-mono text-[9px] font-bold shadow-xl border transition-all ${
                                                s.isDetached
                                                    ? 'bg-white/90 border-slate-400 text-slate-800 shadow-md'
                                                    : isSelected
                                                        ? 'bg-black/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/50'
                                                        : 'bg-black/80 border-cyan-400/60 text-cyan-200'
                                            }`}>
                                                <span className="w-2 h-2 rounded-full border border-white/40" style={{ backgroundColor: s.hex }}></span>
                                                <span>{s.idCode}</span>
                                                <span className="text-[8px] opacity-70">({s.percentage}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {isDeconstructing && (
                                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-cyan-500/40 px-3 py-1 rounded-full text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-2 pointer-events-none z-30 animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                        Stacco Forme Organiche in corso ({progressPct}%)
                                    </div>
                                )}
                            </div>

                            {/* CONTROLS */}
                            <div className="flex items-center justify-between gap-4 pt-2">
                                <button
                                    onClick={isDeconstructing ? stopDeconstruction : startOrganicDeconstruction}
                                    disabled={shapes.length === 0}
                                    className={`flex-1 py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        isDeconstructing
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                            : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white hover:scale-102 shadow-xl shadow-cyan-950/50'
                                    }`}
                                >
                                    <i className={`fas ${isDeconstructing ? 'fa-pause' : 'fa-play'}`}></i>
                                    {isDeconstructing ? 'Pausa Stacco' : 'Avvia Inseguimento & Stacco Forme Organiche'}
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

                    {/* RIGHT: EXTRACTED ORGANIC SHAPES REGISTRY (5 COLS) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 font-mono">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    📋 Forme Organiche Estratte ({currentStepIndex}/{shapes.length})
                                </span>
                                <span className="text-xs text-white/50">Flood-Fill Organico</span>
                            </div>

                            {/* SELECTED SHAPE TELEMETRY */}
                            {selectedShape && (
                                <div className="bg-cyan-950/40 border border-cyan-500/40 p-4 rounded-xl space-y-2 animate-fade-in text-xs">
                                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 rounded border border-white/40" style={{ backgroundColor: selectedShape.hex }}></span>
                                            <span className="text-amber-300 font-bold text-sm">{selectedShape.idCode}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedShape.isDetached ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/10 text-white/60'}`}>
                                            {selectedShape.isDetached ? 'Staccato (Tela Bianca)' : 'Sul Quadro'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80 pt-1">
                                        <div className="col-span-2 text-white font-bold">{selectedShape.name}</div>
                                        <div>Colore HEX: <strong>{selectedShape.hex}</strong></div>
                                        <div>CIE LAB: <strong>L*:{selectedShape.L} a*:{selectedShape.a} b*:{selectedShape.b_val}</strong></div>
                                        <div className="col-span-2">Nota Basale: <strong className="text-amber-300">{selectedShape.noteName} ({selectedShape.frequencyHz} Hz)</strong></div>
                                    </div>
                                </div>
                            )}

                            {/* EXTRACTED ORGANIC SHAPES LIST */}
                            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                                {shapes.map((s) => {
                                    const isSelected = selectedShape?.idCode === s.idCode;
                                    return (
                                        <div
                                            key={s.idCode}
                                            onClick={() => {
                                                setSelectedShape(s);
                                                playShapeAudio(s.frequencyHz);
                                            }}
                                            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                                                isSelected
                                                    ? 'bg-cyan-950/80 border-amber-400 ring-1 ring-amber-400'
                                                    : s.isDetached
                                                        ? 'bg-white/10 border-white/10 text-white/90'
                                                        : 'bg-white/5 border-white/5 text-white/40 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded border border-white/30" style={{ backgroundColor: s.hex }}></span>
                                                <span className="font-bold text-amber-300">{s.idCode}</span>
                                                <span className="text-[10px] text-white/70 truncate max-w-[140px]">{s.name}</span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-cyan-300 font-bold">{s.noteName} ({s.frequencyHz}Hz)</span>
                                                <i className={`fas ${s.isDetached ? 'fa-check text-emerald-400' : 'fa-clock text-white/30'} text-xs`}></i>
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
