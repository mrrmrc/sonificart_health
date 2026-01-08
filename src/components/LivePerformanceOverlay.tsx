import React, { useEffect, useRef, useState } from 'react';
import { SonificationResult } from '../types';
import { api } from '../services/api';
import WebcamService, { FaceMetrics } from '../services/WebcamService';
import { LOGO_SVG_STRING } from './Logo';

interface Props {
    result: SonificationResult;
    audioBlob: Blob;
    onClose: () => void;
    title?: string;
    author?: string;
    mode?: 'modal' | 'fullscreen';
    isAdmin?: boolean; // NEW: Triggers auto-open of calibration
    id?: string;       // NEW: For saving persistence
}

interface Particle {
    x: number; // Normalized -0.5 to 0.5
    y: number; // Normalized -0.5 to 0.5
    z: number; // Extrusion 0 to 1 based on brightness
    r: number; g: number; b: number; a: number;
    size: number;
}

export const LivePerformanceOverlay: React.FC<Props> = ({ result, audioBlob, onClose, title, author, mode = 'modal', isAdmin = false, id }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const faceLinkCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement>(null);
    const stageRef = useRef<HTMLDivElement>(null); // NEW: Stage Container for split layout

    // States
    const [metrics, setMetrics] = useState<FaceMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(true); // Default to playing
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- ADMIN CALIBRATION ---
    const [isAdminOpen, setIsAdminOpen] = useState(isAdmin); // Sync with prop

    // Load initial config if available, otherwise defaults
    const initialConfig = result.configUsed || {};

    const calibRef = useRef({
        panSensitivity: (initialConfig as any).panSensitivity ?? 3.0,
        tiltSensitivity: (initialConfig as any).tiltSensitivity ?? 20,
        moveXSensitivity: (initialConfig as any).moveXSensitivity ?? 0.8,
        moveYSensitivity: (initialConfig as any).moveYSensitivity ?? 0.5,
        zoomSensitivity: (initialConfig as any).zoomSensitivity ?? 0.5,
        audioFilterStrength: (initialConfig as any).audioFilterStrength ?? 1.0,
        smileSensitivity: (initialConfig as any).smileSensitivity ?? 1.0,
        mouthSensitivity: (initialConfig as any).mouthSensitivity ?? 1.0,
        gazeSensitivity: (initialConfig as any).gazeSensitivity ?? 1.0,
        gazeCursorOpacity: (initialConfig as any).gazeCursorOpacity ?? 0.5
    });
    // Force re-render for UI sliders (since ref doesn't trigger it)
    const [calibState, setCalibState] = useState(calibRef.current);
    const updateCalib = (key: keyof typeof calibRef.current, val: number) => {
        calibRef.current = { ...calibRef.current, [key]: val };
        setCalibState(calibRef.current);
    };

    // Engine Refs
    const engineRef = useRef<{
        audioCtx: AudioContext | null;
        source: AudioBufferSourceNode | null;
        panner: StereoPannerNode | null;
        filter: BiquadFilterNode | null;
        gain: GainNode | null;
        analyser: AnalyserNode | null;
        animationId: number | null;
        startTime: number;
        duration: number;
        particles: Particle[];
        imageAspect: number; // Store aspect ratio of the image for projection
    } | null>(null);

    useEffect(() => {
        startPerformance();
        return () => stopPerformance();
    }, []);

    const startPerformance = async () => {
        try {
            if (!canvasRef.current || !videoRef.current) return;

            // 1. Init Audio
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();

            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            const panner = ctx.createStereoPanner();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 20000;

            const masterGain = ctx.createGain();
            masterGain.gain.value = 1.0;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            source.connect(panner);
            panner.connect(filter);
            filter.connect(masterGain);
            masterGain.connect(analyser);
            analyser.connect(ctx.destination);

            // 2. Init Webcam
            try {
                await WebcamService.initialize(videoRef.current);
            } catch (e) {
                console.warn("Webcam failed", e);
                setError("Webcam non rilevata. Modalità automatica attiva.");
            }

            // 3. Init Visuals
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d', { alpha: true });
            if (!context) throw new Error("No Canvas Context");

            const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.src = src;
            });

            const mainImg = await loadImage(result.standardizedImageUrl);
            const imageAspect = mainImg.naturalWidth / mainImg.naturalHeight; // Store Image Aspect

            const logoStub = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)));
            const logoImg = await loadImage(logoStub);

            // --- SMART OBJECT GENERATION ---
            const particles: Particle[] = [];
            const tempCanvas = document.createElement('canvas');
            const density = 450; // High Density for smooth objects

            tempCanvas.width = density;
            tempCanvas.height = density;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.drawImage(mainImg, 0, 0, density, density);
                const imgData = tempCtx.getImageData(0, 0, density, density);
                const data = imgData.data;

                const brightnessMap = new Float32Array(density * density);
                for (let i = 0; i < density * density; i++) {
                    const r = data[i * 4];
                    const g = data[i * 4 + 1];
                    const b = data[i * 4 + 2];
                    brightnessMap[i] = (r + g + b) / 3 / 255;
                }

                for (let y = 0; y < density; y++) {
                    for (let x = 0; x < density; x++) {
                        // Smoothing
                        let sumB = 0;
                        let count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const ny = y + dy;
                                const nx = x + dx;
                                if (nx >= 0 && nx < density && ny >= 0 && ny < density) {
                                    sumB += brightnessMap[ny * density + nx];
                                    count++;
                                }
                            }
                        }
                        const smoothedB = sumB / count;

                        const i = (y * density + x) * 4;
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        // FILTERING: "Ghost" Objects
                        // Only extrude parts that are significantly bright or have high contrast.
                        const isObject = smoothedB > 0.45; // HIGH THRESHOLD to reduce "rubbish"

                        if (isObject) {
                            particles.push({
                                x: (x / density) - 0.5,
                                y: (y / density) - 0.5,
                                z: smoothedB * 0.3, // Depth
                                r, g, b,
                                a: 0.15 + (smoothedB * 0.3), // Very transparent, only hints
                                size: 1.0
                            });
                        }
                    }
                }
            }

            source.start(0);

            engineRef.current = {
                audioCtx: ctx, source, panner, filter, gain: masterGain, analyser,
                animationId: 0, startTime: ctx.currentTime, duration: audioBuffer.duration,
                particles,
                imageAspect
            };

            // 4. Render Loop
            const render = () => {
                if (!engineRef.current) return;
                const now = ctx.currentTime;

                // Track Progress
                if (ctx.state === 'running') {
                    // Since we handle Play/Pause via suspend, currentTime continues? 
                    // No, ctx.currentTime progresses only when running usually, but let's approximate
                    setCurrentTime(ctx.currentTime - engineRef.current.startTime);
                }

                // --- VISUALIZER DRAW ---
                if (spectrumCanvasRef.current && engineRef.current.analyser) {
                    const sCtx = spectrumCanvasRef.current.getContext('2d');
                    if (sCtx) {
                        const bufferLength = engineRef.current.analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        engineRef.current.analyser.getByteFrequencyData(dataArray);

                        const w = spectrumCanvasRef.current.width;
                        const h = spectrumCanvasRef.current.height;
                        sCtx.clearRect(0, 0, w, h);

                        // Use a brand-themed gradient
                        const grad = sCtx.createLinearGradient(0, h, 0, 0);
                        grad.addColorStop(0, '#ec4899'); // Pink
                        grad.addColorStop(1, '#06b6d4'); // Cyan

                        sCtx.fillStyle = grad;

                        // Visualizer Bar Config
                        const barCount = 32; // More bars for wider
                        const step = Math.floor(bufferLength / barCount);
                        const barWidth = (w / barCount) - 2;
                        let barX = 0;

                        for (let i = 0; i < barCount; i++) {
                            // Average frequency in this bin
                            let sum = 0;
                            for (let j = 0; j < step; j++) {
                                sum += dataArray[(i * step) + j];
                            }
                            const avg = sum / step;

                            const barHeight = (avg / 255) * h;
                            sCtx.fillRect(barX, h - barHeight, barWidth, barHeight);
                            barX += barWidth + 2;
                        }
                    }
                }

                const m = WebcamService.getMetrics();
                setMetrics(m);

                // --- AUDIO LOGIC (TUNED) ---
                if (m.isActive) {
                    const dist = m.z; // Typical Range 0.1 (Very Close) - 0.8 (Far)

                    // Volume
                    // Keep Volume high until they are very far
                    const targetVol = dist > 0.7 ? 1.0 - ((dist - 0.7) * 2) : 1.2;
                    masterGain.gain.value += (Math.max(0.1, targetVol) - masterGain.gain.value) * 0.1;

                    // Filter (Muffling)
                    // We want it Clear up to 0.5 (50cm+)
                    // Then drop off.
                    let targetFreq = 20000;
                    if (dist > 0.5) {
                        // Drop from 20k to 200Hz between 0.5 and 1.0
                        const t = (dist - 0.5) * 2.0; // 0 to 1
                        targetFreq = 20000 * Math.pow(1 - t, 2);
                    }
                    targetFreq = Math.max(200, targetFreq);

                    filter.frequency.value += (targetFreq - filter.frequency.value) * 0.15;

                    // Panning (Yaw + Gaze)
                    // Incorporate GazeX for finer control
                    const gazeOffset = (m.gazeX || 0) * 0.5 * calibRef.current.gazeSensitivity;
                    const totalPan = -(m.yaw * calibRef.current.panSensitivity) - gazeOffset;
                    const clampedPan = Math.max(-1, Math.min(1, totalPan));
                    panner.pan.setTargetAtTime(clampedPan, now, 0.1);

                } else {
                    // AUTO MODE
                    const time = now * 0.4;
                    panner.pan.value = Math.sin(time);
                    filter.frequency.value = 15000 + Math.sin(time * 0.5) * 5000;
                    masterGain.gain.value = 1.0;
                }

                // --- VISUAL RENDERING ---
                // Size matches the STAGE container, not window
                const w = canvas.width = stageRef.current ? stageRef.current.clientWidth : window.innerWidth;
                const h = canvas.height = stageRef.current ? stageRef.current.clientHeight : window.innerHeight;

                // VISUAL MAPPING (Expression -> Color)
                if (bgImageRef.current && m.isActive) {
                    // Smile -> Saturation & Warmth
                    const smileVal = (m.smile || 0) * calibRef.current.smileSensitivity;
                    const satVal = 1.0 + (smileVal * 1.5); // Up to 2.5x
                    const hueVal = smileVal * 20; // 20deg shift

                    // Mouth Open -> Contrast & Bloom (Blur?)
                    const mouthVal = (m.mouthOpen || 0) * calibRef.current.mouthSensitivity;
                    const contrastVal = 1.0 + (mouthVal * 0.5);

                    // Mouth open > 0.3 triggers 'Dreamy' Blur?
                    const blurVal = mouthVal > 0.3 ? (mouthVal - 0.3) * 10 : 0;

                    const baseFilter = mode === 'fullscreen' ? 'brightness(0.8)' : 'brightness(0.5)';

                    bgImageRef.current.style.filter = `${baseFilter} contrast(${1.2 * contrastVal}) saturate(${satVal}) hue-rotate(${hueVal}deg) blur(${blurVal}px)`;
                } else if (bgImageRef.current) {
                    // Reset filter in auto mode or when inactive
                    bgImageRef.current.style.filter = mode === 'fullscreen' ? 'brightness(0.8) contrast(1.2)' : 'brightness(0.5) contrast(1.2)';
                }

                // Clear with transparency (Using source-over to clear properly)
                context.globalCompositeOperation = 'source-over';
                context.clearRect(0, 0, w, h);

                // Additive Blending
                context.globalCompositeOperation = 'screen';

                // --- Calculate "Object-CONTAIN" Scale ---
                // We want to match the CSS object-contain image.
                const screenAspect = w / h;
                const imgAspect = engineRef.current.imageAspect;

                let renderW, renderH;
                if (screenAspect > imgAspect) {
                    // Screen is wider. Image bounded by Height.
                    renderH = h;
                    renderW = h * imgAspect;
                } else {
                    // Screen is taller. Image bounded by Width.
                    renderW = w;
                    renderH = w / imgAspect;
                }

                // CSS Object-Fit: Contain Centers the image.
                // Our particle coord system is -0.5 to 0.5 (Centered).
                // So scaling by renderW/H works perfectly.

                // Sync Camera (Matches CSS)
                let camX = 0, camY = 0, camZ = -1.2;
                let tiltX = 0, tiltY = 0;

                if (m.isActive) {
                    camX = (m.x - 0.5) * calibRef.current.moveXSensitivity;
                    camY = (m.y - 0.5) * calibRef.current.moveYSensitivity;
                    camZ = -1.0 + (m.z * calibRef.current.zoomSensitivity);

                    // Add Gaze to Tilt
                    const gazeTiltX = -(m.gazeY || 0) * 5 * calibRef.current.gazeSensitivity;
                    const gazeTiltY = (m.gazeX || 0) * 5 * calibRef.current.gazeSensitivity;

                    tiltY = ((m.x - 0.5) * calibRef.current.tiltSensitivity) + gazeTiltY;
                    tiltX = (-(m.y - 0.5) * calibRef.current.tiltSensitivity) + gazeTiltX;
                } else {
                    const time = now * 0.5;
                    camX = Math.sin(time) * 0.2;
                    camY = Math.cos(time * 0.7) * 0.1;
                    tiltY = Math.sin(time) * 5;
                    tiltX = Math.cos(time * 0.7) * 5;
                }

                // CSS Apply
                if (bgImageRef.current) {
                    const cssZ = (camZ + 1.2) * 200;

                    bgImageRef.current.style.transform = `
                        perspective(1000px)
                        rotateX(${tiltX * 1.5}deg)
                        rotateY(${tiltY * 1.5}deg)
                        scale(${1.0 + (m.z * 0.2)})
                        translate3d(${-camX * 100}px, ${-camY * 100}px, ${cssZ}px)
                    `;
                }

                // Particle Projection
                // Should match the CSS transform roughly.
                // CSS scale is applied to the image plane.
                // Scale factor due to "cover" is handled by renderW/renderH.

                const fov = 1000;
                const cx = w / 2;
                const cy = h / 2;

                const radY = -tiltY * 0.0174533 * 1.5;
                const cosY = Math.cos(radY);
                const sinY = Math.sin(radY);
                const radX = -tiltX * 0.0174533 * 1.5;
                const cosX = Math.cos(radX);
                const sinX = Math.sin(radX);

                const scaleFactor = 1.0 + (m.isActive ? m.z * 0.2 : 0); // Must match CSS scale

                engineRef.current.particles.forEach(p => {
                    // Initial scale to match object-cover dimension
                    let wx = p.x * renderW * scaleFactor;
                    let wy = p.y * renderH * scaleFactor;
                    let wz = p.z * 200 * scaleFactor; // Extrusion scale

                    // 1. Rotate
                    let x1 = wx * cosY - wz * sinY;
                    let z1 = wx * sinY + wz * cosY;
                    let y2 = wy * cosX - z1 * sinX;
                    let z2 = wy * sinX + z1 * cosX;

                    // 2. Translate Cam (Inverse Camera Move)
                    // CSS translates image by (-camX*100), so we do same.
                    let tx = x1 - (camX * 100);
                    let ty = y2 - (camY * 100);
                    let tz = z2 - (camZ * 200) + 1000; // +1000 for perspective depth

                    // Project
                    if (tz > 0.1) {
                        const pScale = fov / tz;

                        const projX = cx + (tx * pScale * 1.3); // 1.3 fudge factor for fov match?
                        const projY = cy + (ty * pScale * 1.3);

                        const size = p.size * (pScale) * 1.5;

                        context.fillStyle = `rgba(${p.r},${p.g},${p.b}, ${p.a * 0.8})`; // More transparent
                        context.fillRect(projX, projY, size, size);
                    }
                });

                // HUD (Re-enabled with high Z-Index logic implicit in rendering order? No, canvas is z-10)
                // We render HUD on Canvas too?
                context.globalCompositeOperation = 'source-over';

                // HUD TEXT REMOVED IN FAVOR OF FOOTER DISPLAY

                context.drawImage(logoImg, w - 120, h - 120, 80, 80);

                // FACE MESH
                if (faceLinkCanvasRef.current && m.landmarks) {
                    const flCtx = faceLinkCanvasRef.current.getContext('2d');
                    if (flCtx) {
                        const cw = faceLinkCanvasRef.current.width;
                        const ch = faceLinkCanvasRef.current.height;
                        flCtx.clearRect(0, 0, cw, ch);
                        // Draw semi-transparent face mesh
                        flCtx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                        m.landmarks.forEach((pt: any) => {
                            flCtx.beginPath();
                            flCtx.arc((1 - pt.x) * cw, pt.y * ch, 1.5, 0, Math.PI * 2);
                            flCtx.fill();
                        });
                    }
                }

                engineRef.current.animationId = requestAnimationFrame(render);
            };

            engineRef.current.animationId = requestAnimationFrame(render);

        } catch (err: any) {
            setError(err.message);
        }
    };

    const stopPerformance = () => {
        if (engineRef.current) {
            cancelAnimationFrame(engineRef.current.animationId!);
            engineRef.current.source?.stop();
            engineRef.current.audioCtx?.close();
            engineRef.current = null;
        }
        WebcamService.stop();
    };

    // --- CONTROLS ---
    const togglePlay = async () => {
        if (!engineRef.current?.audioCtx) return;

        if (engineRef.current.audioCtx.state === 'running') {
            await engineRef.current.audioCtx.suspend();
            setIsPlaying(false);
        } else {
            await engineRef.current.audioCtx.resume();
            setIsPlaying(true);
        }
    };

    const restart = () => {
        // Simple reload for now as rewinding buffers is complex with current setup
        stopPerformance();
        startPerformance();
        setIsPlaying(true);
    };

    const formatTime = (time: number) => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    // --- VISUALIZER REF ---
    const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">

            {/* --- STAGE AREA --- */}
            <div ref={stageRef} className="flex-grow relative overflow-hidden w-full">

                {/* AMBIENT BACKGROUND: Only in 'fullscreen' mode */}
                {mode === 'fullscreen' && (
                    <div className="absolute inset-0 z-0">
                        <img
                            src={result.standardizedImageUrl}
                            alt="Ambient"
                            className="w-full h-full object-cover filter blur-[40px] opacity-40 scale-110"
                        />
                    </div>
                )}

                {/* MAIN IMAGE: Object-Contain */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-1">
                    <img
                        ref={bgImageRef}
                        src={result.standardizedImageUrl}
                        alt="Background"
                        className="w-full h-full object-contain transition-transform duration-75 ease-out"
                        style={{
                            transformStyle: 'preserve-3d',
                            backfaceVisibility: 'hidden',
                            filter: mode === 'fullscreen' ? 'brightness(0.8) contrast(1.2)' : 'brightness(0.5) contrast(1.2)'
                        }}
                    />
                </div>

                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10 mix-blend-screen" />

                {/* WEBCAM PIP */}
                <div className="absolute top-6 right-6 flex flex-col items-center gap-0 z-50">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-cyan-500 shadow-lg bg-black relative">
                        <video ref={videoRef} className="w-full h-full object-cover mirror-mode opacity-100" autoPlay muted playsInline />
                        <canvas ref={faceLinkCanvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none" />
                    </div>
                    {/* Tiny stats under webcam */}
                    <div className="bg-black/80 rounded-b-lg border-x border-b border-cyan-500/30 p-2 text-[8px] font-mono text-cyan-400 w-32 text-center -mt-2 pt-4">
                        <div className="flex justify-between"><span>EXPR</span><span>{(metrics?.smile || 0).toFixed(1)}</span></div>
                        <div className="flex justify-between"><span>GAZE</span><span>X:{(metrics?.gazeX || 0).toFixed(1)}</span></div>
                    </div>
                </div>

                {/* ADMIN TOGGLE (Hidden trigger area) */}
                <div
                    className="absolute top-0 left-0 w-32 h-32 z-40"
                    onDoubleClick={() => setIsAdminOpen(!isAdminOpen)}
                    title="Double Click for Admin Calibration"
                ></div>

                {/* ADMIN PANEL */}
                {isAdminOpen && (
                    <div className="absolute top-20 left-6 z-[60] bg-black/90 backdrop-blur-md border border-brand-accent/30 p-4 rounded-xl w-64 shadow-2xl animate-fade-in text-xs font-mono max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                            <h4 className="font-bold text-brand-accent tracking-widest">CALIBRAZIONE</h4>
                            <button onClick={() => setIsAdminOpen(false)} className="text-white/50 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        {/* Sliders */}
                        <div className="space-y-4 text-gray-300">
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-gray-500"><span>Pan Sensitivity</span><span>{calibState.panSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="10" step="0.1" value={calibState.panSensitivity} onChange={(e) => updateCalib('panSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-gray-500"><span>Tilt Sensitivity</span><span>{calibState.tiltSensitivity.toFixed(0)}</span></div>
                                <input type="range" min="0" max="100" step="1" value={calibState.tiltSensitivity} onChange={(e) => updateCalib('tiltSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-gray-500"><span>Move X (H-Scroll)</span><span>{calibState.moveXSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="5" step="0.1" value={calibState.moveXSensitivity} onChange={(e) => updateCalib('moveXSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-gray-500"><span>Move Y (V-Scroll)</span><span>{calibState.moveYSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="5" step="0.1" value={calibState.moveYSensitivity} onChange={(e) => updateCalib('moveYSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-gray-500"><span>Proximity Zoom</span><span>{calibState.zoomSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="2" step="0.1" value={calibState.zoomSensitivity} onChange={(e) => updateCalib('zoomSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            {/* Expressions */}
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-pink-500"><span>Smile (Saturaz/Hue)</span><span>{calibState.smileSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="3" step="0.1" value={calibState.smileSensitivity} onChange={(e) => updateCalib('smileSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-purple-400"><span>Mouth (Contrast/Blur)</span><span>{calibState.mouthSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="3" step="0.1" value={calibState.mouthSensitivity} onChange={(e) => updateCalib('mouthSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-cyan-500"><span>Gaze Sensitivity</span><span>{calibState.gazeSensitivity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="3" step="0.1" value={calibState.gazeSensitivity} onChange={(e) => updateCalib('gazeSensitivity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-[10px] uppercase text-cyan-200"><span>Gaze Visualizer Opacity</span><span>{calibState.gazeCursorOpacity.toFixed(1)}</span></div>
                                <input type="range" min="0" max="1" step="0.1" value={calibState.gazeCursorOpacity} onChange={(e) => updateCalib('gazeCursorOpacity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer" />
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10">
                            <button
                                onClick={async () => {
                                    try {
                                        if (id) {
                                            await api.updateHistoryItemConfig(id, calibState);
                                            alert("Configurazione Salvata!");
                                        } else {
                                            alert("ID Opera non trovato. Impossibile salvare.");
                                        }
                                    } catch (e) {
                                        alert("Errore salvataggio: " + e);
                                    }
                                }}
                                className="w-full py-2 bg-brand-accent/20 hover:bg-brand-accent/40 text-brand-accent border border-brand-accent rounded text-[10px] font-bold tracking-widest uppercase transition-all"
                            >
                                SALVA CONFIGURAZIONE
                            </button>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-red-900/90 text-white p-8 rounded-xl">
                        <h3 className="text-2xl font-bold mb-2">Errore</h3>
                        <p>{error}</p>
                        <button onClick={onClose} className="mt-6 bg-white text-black px-6 py-2 rounded-full font-bold">Chiudi</button>
                    </div>
                )}
            </div>


            {/* --- CONTROL DECK (FOOTER) --- */}
            <div className="h-24 bg-[#0a0a0a] border-t border-white/10 flex items-center justify-between px-6 z-[120] shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">

                {/* LEFT: Info & Expanded Spectrogram */}
                <div className="flex items-center gap-8 flex-grow mr-8 overflow-hidden">
                    <div className="flex flex-col shrink-0 min-w-[150px]">
                        <h3 className="text-white font-bold text-sm tracking-wide uppercase truncate">{title || "SENZA TITOLO"}</h3>
                        <span className="text-gray-500 text-[10px] uppercase tracking-wider truncate">{author || "ARTISTA"}</span>
                    </div>

                    {/* WIDE SPECTROGRAM */}
                    <div className="flex-grow h-12 bg-white/5 rounded-md overflow-hidden border border-white/5 relative hidden sm:block">
                        <canvas
                            ref={spectrumCanvasRef}
                            width={600}
                            height={48}
                            className="w-full h-full opacity-60 mix-blend-screen"
                        />
                    </div>
                </div>

                {/* RIGHT: Controls & Time & Exit */}
                <div className="flex items-center gap-6 shrink-0">

                    {/* Controls Group */}
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <button
                            onClick={restart}
                            className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                            title="Riavvia"
                        >
                            <i className="fas fa-step-backward text-xs"></i>
                        </button>

                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 hover:shadow-[0_0_15px_white] transition-all"
                        >
                            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm ml-0.5`}></i>
                        </button>

                        <button
                            onClick={() => setIsAdminOpen(!isAdminOpen)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isAdminOpen ? 'text-brand-accent' : 'text-gray-400 hover:text-white'}`}
                            title="Configurazione"
                        >
                            <i className="fas fa-sliders-h text-xs"></i>
                        </button>
                    </div>

                    {/* Time */}
                    <div className="text-xs font-mono text-brand-accent/80 tracking-widest hidden sm:block w-24 text-right">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Exit */}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-bold text-gray-300 hover:bg-white/20 hover:text-white transition-colors uppercase tracking-wider"
                    >
                        {mode === 'fullscreen' ? 'CHIUDI' : 'INDIETRO'}
                    </button>
                </div>

            </div>

            <style>{`.mirror-mode { transform: scaleX(-1); }`}</style>
        </div >
    );
};
