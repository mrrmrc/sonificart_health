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
    description?: string;
    date?: string;
    mode?: 'modal' | 'fullscreen';
    isAdmin?: boolean;
    id?: string;
}

interface Particle {
    x: number; y: number; z: number;
    r: number; g: number; b: number; a: number;
    size: number;
}

// --- I18N TEXTS ---
const TEXTS = {
    it: {
        settings: "IMPOSTAZIONI",
        masterVol: "VOLUME MASTER",
        autoCalib: "AUTO CALIBRAZIONE",
        autoCalibDesc: "Posizionati davanti alla camera e clicca. Il sistema imposterà questa distanza come punto di ascolto ottimale (suono originale).",
        calibSuccess: "Calibrazione Completata!",
        videoFx: "EFFETTI VIDEO",
        audioFx: "EFFETTI AUDIO",
        save: "SALVA CONFIGURAZIONE",
        back: "INDIETRO",
        close: "CHIUDI",
        // Params
        smile: "Sorriso (Saturazione/Distorsione)",
        mouth: "Bocca (Contrasto/Eco)",
        tilt: "Inclinazione (Rotazione/Pitch)",
        eyebrow: "Sopracciglia (Luminosità)",
        blink: "Occhi (Flash)",
        zoom: "Zoom (Prossimità)",
        pan: "Movimento Orizzontale",
        dist: "Sensibilità Distanza (Ambiente)",
        gazeX: "Sguardo X (Panning)",
        gazeY: "Sguardo Y (Tono)",
        errorWebcam: "Webcam non rilevata. Modalità automatica attiva.",
        configSaved: "Configurazione Salvata!",
        calibInstr: "CLICCA PER CALIBRARE IL PUNTO ZERO"
    },
    en: {
        settings: "SETTINGS",
        masterVol: "MASTER VOLUME",
        autoCalib: "AUTO CALIBRATION",
        autoCalibDesc: "Position yourself comfortably and click. The system will set this distance as the optimal listening point (original sound).",
        calibSuccess: "Calibration Complete!",
        videoFx: "VIDEO EFFECTS",
        audioFx: "AUDIO EFFECTS",
        save: "SAVE CONFIGURATION",
        back: "BACK",
        close: "CLOSE",
        // Params
        smile: "Smile (Saturation/Distortion)",
        mouth: "Mouth (Contrast/Echo)",
        tilt: "Tilt (Rotation/Pitch)",
        eyebrow: "Eyebrows (Brightness)",
        blink: "Blink (Flash)",
        zoom: "Zoom (Proximity)",
        pan: "Pan Sensitivity",
        dist: "Distance Sensitivity (Ambience)",
        gazeX: "Gaze X (Panning)",
        gazeY: "Gaze Y (Tone)",
        errorWebcam: "Webcam not detected. Auto mode active.",
        configSaved: "Configuration Saved!",
        calibInstr: "CLICK TO SET ZERO POINT"
    }
};

export const LivePerformanceOverlay: React.FC<Props> = ({ result, audioBlob, onClose, title, author, description, date, mode = 'modal', isAdmin = false, id }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const faceLinkCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);

    // Lang Detection
    const lang = navigator.language.startsWith('it') ? 'it' : 'en';
    const t = TEXTS[lang];

    // States
    const [metrics, setMetrics] = useState<FaceMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- SETTINGS UI ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Sidebar closed by default
    const [expandedSection, setExpandedSection] = useState<'video' | 'audio' | null>(null);
    const [masterVolume, setMasterVolume] = useState(1.0);
    const [isCalibrated, setIsCalibrated] = useState(false);

    // Load initial config
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
        gazeCursorOpacity: (initialConfig as any).gazeCursorOpacity ?? 0.4,
        headTiltEffect: (initialConfig as any).headTiltEffect ?? 0.8,
        eyebrowEffect: (initialConfig as any).eyebrowEffect ?? 0.5,
        blinkEffect: (initialConfig as any).blinkEffect ?? 0.6,
        showFaceMesh: (initialConfig as any).showFaceMesh ?? false,
        gazePointerSize: (initialConfig as any).gazePointerSize ?? 40,

        // AUDIO
        smileAudio: (initialConfig as any).smileAudio ?? 0.0,
        mouthAudio: (initialConfig as any).mouthAudio ?? 0.0,
        tiltAudio: (initialConfig as any).tiltAudio ?? 0.0,
        eyebrowAudio: (initialConfig as any).eyebrowAudio ?? 0.0,
        distAudio: (initialConfig as any).distAudio ?? 1.0,
        gazeAudioX: (initialConfig as any).gazeAudioX ?? 1.0,
        gazeAudioY: (initialConfig as any).gazeAudioY ?? 1.0,

        // AUTO CALIB
        neutralZ: 0.5 // Default mid-distance (will be overwritten by auto-calib)
    });

    // Force re-render for UI
    const [calibState, setCalibState] = useState(calibRef.current);
    const smoothCam = useRef({ x: 0, y: 0, z: -1.0, tiltX: 0, tiltY: 0 });

    const updateCalib = (key: keyof typeof calibRef.current, val: number) => {
        calibRef.current = { ...calibRef.current, [key]: val };
        setCalibState(calibRef.current);
    };

    // --- AUTO CALIBRATION ---
    const calibrateDistance = () => {
        if (!metrics) return;
        // Set current Z as neutral (Original Sound Point)
        calibRef.current.neutralZ = metrics.z;
        setIsCalibrated(true);
        setTimeout(() => setIsCalibrated(false), 2000); // Reset success msg
    };

    // Engine Refs
    const engineRef = useRef<{
        audioCtx: AudioContext | null;
        source: AudioBufferSourceNode | null;
        panner: StereoPannerNode | null;
        filter: BiquadFilterNode | null;
        autoGain: GainNode | null; // Controlled by distance
        masterGain: GainNode | null; // Controlled by User Slider
        analyser: AnalyserNode | null;
        animationId: number | null;
        startTime: number;
        duration: number;
        particles: Particle[];
        imageAspect: number;
        delayWet: GainNode | null;
        highShelf: BiquadFilterNode | null;
    } | null>(null);

    useEffect(() => {
        startPerformance();
        return () => stopPerformance();
    }, []);

    // Update Master Volume in real-time
    useEffect(() => {
        if (engineRef.current?.masterGain) {
            engineRef.current.masterGain.gain.setTargetAtTime(masterVolume, engineRef.current.audioCtx!.currentTime, 0.1);
        }
    }, [masterVolume]);

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

            // NODE GRAPH
            const panner = ctx.createStereoPanner();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 20000;
            filter.Q.value = 1.0;

            const highShelf = ctx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 4000;
            highShelf.gain.value = 0;

            // Auto Gain (Distance Volume)
            const autoGain = ctx.createGain();
            autoGain.gain.value = 1.0;

            // FX: Delay
            const delayNode = ctx.createDelay();
            delayNode.delayTime.value = 0.35;
            const delayFeedback = ctx.createGain();
            delayFeedback.gain.value = 0.4;
            const delayWet = ctx.createGain();
            delayWet.gain.value = 0.0;

            // Master Gain (User Volume)
            const masterGain = ctx.createGain();
            masterGain.gain.value = masterVolume;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            // ROUTING
            /* 
               Source -> Panner -> Filter -> HighShelf -> AutoGain -> [Branch Delay] -> Mix -> MasterGain -> Analyser -> Dest
            */
            source.connect(panner);
            panner.connect(filter);
            filter.connect(highShelf);
            highShelf.connect(autoGain);

            // Branch Direct
            autoGain.connect(masterGain);

            // Branch Delay
            autoGain.connect(delayWet);
            delayWet.connect(delayNode);
            delayNode.connect(delayFeedback);
            delayFeedback.connect(delayNode);
            delayNode.connect(masterGain); // Mix delay back to master

            masterGain.connect(analyser);
            analyser.connect(ctx.destination);

            // 2. Init Webcam
            try {
                await WebcamService.initialize(videoRef.current);
            } catch (e) {
                console.warn("Webcam failed", e);
                setError(t.errorWebcam);
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
            const imageAspect = mainImg.naturalWidth / mainImg.naturalHeight;

            const logoStub = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)));
            const logoImg = await loadImage(logoStub);

            source.start(0);

            engineRef.current = {
                audioCtx: ctx, source, panner, filter, autoGain, masterGain, analyser,
                animationId: 0, startTime: ctx.currentTime, duration: audioBuffer.duration,
                particles: [],
                imageAspect,
                delayWet,
                highShelf
            };

            // 4. Render Loop
            const render = () => {
                if (!engineRef.current) return;
                const now = ctx.currentTime;

                if (ctx.state === 'running') {
                    setCurrentTime(ctx.currentTime - engineRef.current.startTime);
                }

                // Spectrum Visualizer
                if (spectrumCanvasRef.current && engineRef.current.analyser) {
                    const sCtx = spectrumCanvasRef.current.getContext('2d');
                    if (sCtx) {
                        const bufferLength = engineRef.current.analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        engineRef.current.analyser.getByteFrequencyData(dataArray);
                        const w = spectrumCanvasRef.current.width;
                        const h = spectrumCanvasRef.current.height;
                        sCtx.clearRect(0, 0, w, h);
                        const barCount = 48;
                        const step = Math.floor(bufferLength / barCount);
                        const barWidth = (w / barCount) - 2;
                        let barX = 0;
                        for (let i = 0; i < barCount; i++) {
                            let sum = 0;
                            for (let j = 0; j < step; j++) { sum += dataArray[(i * step) + j]; }
                            const avg = sum / step;
                            const barHeight = (avg / 255) * h;
                            let color = i < barCount / 3 ? `rgba(239, 68, 68, ${avg / 255})` : i < (barCount / 3) * 2 ? `rgba(34, 197, 94, ${avg / 255})` : `rgba(59, 130, 246, ${avg / 255})`;
                            sCtx.fillStyle = color;
                            sCtx.fillRect(barX, h - barHeight, barWidth, barHeight);
                            sCtx.fillStyle = color.replace(')', ', 0.2)').replace('rgba', 'rgba').replace(', 1)', ', 0.2)');
                            sCtx.fillRect(barX, h, barWidth, barHeight * 0.5);
                            barX += barWidth + 2;
                        }
                    }
                }

                const m = WebcamService.getMetrics();
                setMetrics(m);

                if (m.isActive) {
                    // --- RELATIVE DISTANCE LOGIC ---
                    const rawZ = m.z;
                    const neutralZ = calibRef.current.neutralZ;

                    // Difference from neutral point. 
                    // Positive = Moving Away (Further than neutral). Negative = Moving Closer.
                    const deltaDist = rawZ - neutralZ;

                    // 1. Ambience / Muffling
                    // If near neutralZ (+/- threshold), pure sound.
                    // If further, add reverb/muffle.
                    let targetFreq = 20000;
                    let ambientWet = 0;

                    if (deltaDist > 0.1) {
                        // Allontanamento -> Muffled + Ambience
                        const t = Math.min(1, (deltaDist - 0.1) * 3); // Scale factor
                        targetFreq = 20000 * Math.pow(1 - t, 2);
                        ambientWet = t * 0.7 * (calibRef.current as any).distAudio;
                    } else if (deltaDist < -0.1) {
                        // Avvicinamento -> Pure, maybe slight boost?
                        // Currently just keeping it clean/full.
                        targetFreq = 20000;
                        ambientWet = 0;
                    }

                    targetFreq = Math.max(200, targetFreq);
                    if (engineRef.current.filter) engineRef.current.filter.frequency.setTargetAtTime(targetFreq, now, 0.1);

                    // 2. Panning
                    const gazeOffset = (m.gazeX || 0) * 0.8 * (calibRef.current as any).gazeAudioX;
                    const headPan = -(m.yaw * calibRef.current.panSensitivity);
                    const totalPan = headPan - gazeOffset;
                    if (engineRef.current.panner) engineRef.current.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, totalPan)), now, 0.1);

                    // 3. Tone (Gaze Y)
                    const gazeY = m.gazeY || 0;
                    const targetQ = 1.0 + ((gazeY + 0.5) * 6.0 * (calibRef.current as any).gazeAudioY);
                    if (engineRef.current.filter) engineRef.current.filter.Q.setTargetAtTime(Math.max(0.1, targetQ), now, 0.1);

                    // 4. Expression FX
                    const mouthEcho = (m.mouthOpen || 0) * (calibRef.current as any).mouthAudio;
                    const totalWet = Math.min(0.9, mouthEcho + ambientWet);
                    if (engineRef.current.delayWet) engineRef.current.delayWet.gain.setTargetAtTime(totalWet, now, 0.1);

                    const brightAmount = ((m.smile || 0) * (calibRef.current as any).smileAudio);
                    if (engineRef.current.highShelf) engineRef.current.highShelf.gain.setTargetAtTime(brightAmount * 15, now, 0.1);

                    const tiltFactor = Math.abs(smoothCam.current.tiltX) / 45;
                    const detuneAmount = tiltFactor * (calibRef.current as any).tiltAudio * 500;
                    if (engineRef.current.source) engineRef.current.source.detune.setTargetAtTime(detuneAmount, now, 0.1);

                } else {
                    // Auto Mode
                    const time = now * 0.4;
                    if (engineRef.current.panner) engineRef.current.panner.pan.value = Math.sin(time);
                    if (engineRef.current.filter) engineRef.current.filter.frequency.value = 15000 + Math.sin(time * 0.5) * 5000;
                }

                // --- VISUALS ---
                const w = canvas.width = stageRef.current ? stageRef.current.clientWidth : window.innerWidth;
                const h = canvas.height = stageRef.current ? stageRef.current.clientHeight : window.innerHeight;

                // Visual Feedback
                if (bgImageRef.current && m.isActive) {
                    const smileVal = (m.smile || 0) * calibRef.current.smileSensitivity;
                    const satVal = 1.0 + (smileVal * 1.5);
                    const hueVal = smileVal * 20;
                    const mouthVal = (m.mouthOpen || 0) * calibRef.current.mouthSensitivity;
                    const contrastVal = 1.0 + (mouthVal * 0.5);
                    const blurVal = mouthVal > 0.3 ? (mouthVal - 0.3) * 10 : 0;
                    const baseFilter = mode === 'fullscreen' ? 'brightness(0.8)' : 'brightness(0.5)';
                    bgImageRef.current.style.filter = `${baseFilter} contrast(${1.2 * contrastVal}) saturate(${satVal}) hue-rotate(${hueVal}deg) blur(${blurVal}px)`;
                } else if (bgImageRef.current) {
                    bgImageRef.current.style.filter = mode === 'fullscreen' ? 'brightness(0.8) contrast(1.2)' : 'brightness(0.5) contrast(1.2)';
                }

                context.clearRect(0, 0, w, h);

                // Camera Math
                let camX = 0, camY = 0, camZ = -1.2;
                let tiltX = 0, tiltY = 0;
                const breath = Math.sin(now * 0.8) * 0.02;

                if (m.isActive) {
                    const targetCamX = (m.x - 0.5) * calibRef.current.moveXSensitivity;
                    const targetCamY = (m.y - 0.5) * calibRef.current.moveYSensitivity;

                    // Zoom relative to calibration
                    // If Z is neutralZ, zoom is -1.0 (standard).
                    // If Z > neutralZ (farther), zoom out.
                    // If Z < neutralZ (closer), zoom in.
                    const relZ = m.z - calibRef.current.neutralZ;
                    const targetCamZ = -1.0 + (relZ * calibRef.current.zoomSensitivity * 2);

                    const gazeTiltX = -(m.gazeY || 0) * 5 * calibRef.current.gazeSensitivity;
                    const gazeTiltY = (m.gazeX || 0) * 5 * calibRef.current.gazeSensitivity;
                    const targetTiltY = ((m.x - 0.5) * calibRef.current.tiltSensitivity) + gazeTiltY;
                    const targetTiltX = (-(m.y - 0.5) * calibRef.current.tiltSensitivity) + gazeTiltX;

                    const lerpFactor = 0.08;
                    smoothCam.current.x += (targetCamX - smoothCam.current.x) * lerpFactor;
                    smoothCam.current.y += (targetCamY - smoothCam.current.y) * lerpFactor;
                    smoothCam.current.z += (targetCamZ - smoothCam.current.z) * lerpFactor;
                    smoothCam.current.tiltX += (targetTiltX - smoothCam.current.tiltX) * lerpFactor;
                    smoothCam.current.tiltY += (targetTiltY - smoothCam.current.tiltY) * lerpFactor;

                    camX = smoothCam.current.x;
                    camY = smoothCam.current.y;
                    camZ = smoothCam.current.z + breath;
                    tiltX = smoothCam.current.tiltX;
                    tiltY = smoothCam.current.tiltY;
                } else {
                    const time = now * 0.5;
                    camX = Math.sin(time) * 0.2;
                    camY = Math.cos(time * 0.7) * 0.1;
                    tiltY = Math.sin(time) * 5;
                    tiltX = Math.cos(time * 0.7) * 5;
                    camZ = -1.2 + breath;
                    smoothCam.current = { x: camX, y: camY, z: camZ, tiltX, tiltY };
                }

                if (bgImageRef.current) {
                    const cssZ = (camZ + 1.2) * 200;
                    bgImageRef.current.style.transform = `perspective(1000px) rotateX(${tiltX * 1.5}deg) rotateY(${tiltY * 1.5}deg) scale(${1.0 + breath * 2}) translate3d(${-camX * 100}px, ${-camY * 100}px, ${cssZ}px)`;
                }

                // Draw Logic
                const cx = w / 2, cy = h / 2;
                const screenAspect = w / h;
                const imgAspect = engineRef.current.imageAspect;
                let renderW = screenAspect > imgAspect ? h * imgAspect : w;
                let renderH = screenAspect > imgAspect ? h : w / imgAspect;

                // Gaze Cursor
                if (m.isActive && calibRef.current.gazeCursorOpacity > 0) {
                    const gazeX = 0.5 + (m.gazeX || 0) * calibRef.current.gazeSensitivity;
                    const gazeY = 0.5 + (m.gazeY || 0) * calibRef.current.gazeSensitivity;
                    const pointerX = cx + ((gazeX - 0.5) * renderW);
                    const pointerY = cy + ((gazeY - 0.5) * renderH);
                    context.save();
                    context.globalAlpha = calibRef.current.gazeCursorOpacity * 0.6;
                    context.beginPath(); context.arc(pointerX, pointerY, calibRef.current.gazePointerSize, 0, Math.PI * 2);
                    context.strokeStyle = 'rgba(45, 212, 191, 0.8)'; context.lineWidth = 2; context.stroke();
                    context.restore();
                }

                context.drawImage(logoImg, w - 120, h - 120, 80, 80);
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

    const togglePlay = async () => {
        if (!engineRef.current?.audioCtx) return;
        if (engineRef.current.audioCtx.state === 'running') {
            await engineRef.current.audioCtx.suspend(); setIsPlaying(false);
        } else {
            await engineRef.current.audioCtx.resume(); setIsPlaying(true);
        }
    };

    const restart = () => { stopPerformance(); startPerformance(); setIsPlaying(true); };
    const formatTime = (time: number) => {
        const min = Math.floor(time / 60); const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };
    const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden font-sans">
            <div ref={stageRef} className="flex-grow relative overflow-hidden w-full">
                {/* Backgrounds */}
                {mode === 'fullscreen' && <div className="absolute inset-0 z-0"><img src={result.standardizedImageUrl} className="w-full h-full object-cover filter blur-[40px] opacity-40 scale-110" /></div>}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-1">
                    <img ref={bgImageRef} src={result.standardizedImageUrl} className="w-full h-full object-contain transition-transform duration-75 ease-out" style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }} />
                </div>
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10 mix-blend-screen" />

                {/* WEBCAM PIP */}
                <div className="absolute bottom-32 right-6 flex flex-col items-center gap-0 z-50 transition-all duration-500 hover:scale-105 opacity-80 hover:opacity-100">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-cyan-500 shadow-lg bg-black relative">
                        <video ref={videoRef} className="w-full h-full object-cover mirror-mode opacity-100" autoPlay muted playsInline />
                        <canvas ref={faceLinkCanvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none" />
                    </div>
                </div>

                {/* SETTINGS TOGGLE (Top Left) */}
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="absolute top-6 left-6 z-[60] text-gray-400 hover:text-white bg-black/50 p-3 rounded-full backdrop-blur transition-all border border-transparent hover:border-white/20"
                >
                    <i className="fas fa-cog text-xl"></i>
                </button>

                {/* SIDEBAR SETTINGS */}
                <div className={`absolute top-0 left-0 h-full w-80 bg-black/95 backdrop-blur-xl border-r border-white/10 z-[70] transition-transform duration-300 transform ${isSettingsOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}>

                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <h2 className="text-white font-bold text-lg tracking-widest">{t.settings}</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
                    </div>

                    {/* Content Scroll */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* 1. MASTER VOLUME & AUTO CALIB */}
                        <div className="space-y-6">

                            {/* Master Vol */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{t.masterVol}</label>
                                <div className="flex items-center gap-3">
                                    <i className="fas fa-volume-up text-gray-500 text-xs"></i>
                                    <input
                                        type="range" min="0" max="2" step="0.05"
                                        value={masterVolume}
                                        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                                    />
                                    <span className="text-xs font-mono w-8 text-right">{(masterVolume * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Auto Calibrate */}
                            <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 p-4 rounded-xl border border-cyan-500/30">
                                <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-magic"></i> {t.autoCalib}
                                </label>
                                <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                                    {t.autoCalibDesc}
                                </p>
                                <button
                                    onClick={calibrateDistance}
                                    className={`w-full py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2
                                        ${isCalibrated ? 'bg-green-500 text-black' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                                >
                                    {isCalibrated ? <><i className="fas fa-check"></i> {t.calibSuccess}</> : <><i className="fas fa-crosshairs"></i> {t.calibInstr}</>}
                                </button>
                            </div>
                        </div>

                        {/* 2. VIDEO EFFECTS (Accordion) */}
                        <div className="border-t border-white/5 pt-4">
                            <button
                                onClick={() => setExpandedSection(expandedSection === 'video' ? null : 'video')}
                                className="w-full flex justify-between items-center py-2 text-xs font-bold text-pink-500 uppercase tracking-widest hover:text-pink-400"
                            >
                                <span><i className="fas fa-video mr-2"></i> {t.videoFx}</span>
                                <i className={`fas fa-chevron-down transition-transform ${expandedSection === 'video' ? 'rotate-180' : ''}`}></i>
                            </button>

                            {expandedSection === 'video' && (
                                <div className="mt-4 space-y-4 animate-fade-in pl-2 border-l border-white/5">
                                    <InputSlider label={t.smile} value={calibState.smileSensitivity} max={3} onChange={(v) => updateCalib('smileSensitivity', v)} color="text-pink-400" />
                                    <InputSlider label={t.mouth} value={calibState.mouthSensitivity} max={3} onChange={(v) => updateCalib('mouthSensitivity', v)} color="text-purple-400" />
                                    <InputSlider label={t.eyebrow} value={calibState.eyebrowEffect} max={2} onChange={(v) => updateCalib('eyebrowEffect', v)} color="text-orange-400" />
                                    <InputSlider label={t.zoom} value={calibState.zoomSensitivity} max={2} onChange={(v) => updateCalib('zoomSensitivity', v)} color="text-blue-400" />
                                    <InputSlider label={t.tilt} value={calibState.tiltSensitivity} max={100} step={1} onChange={(v) => updateCalib('tiltSensitivity', v)} color="text-gray-300" />
                                    <InputSlider label={t.pan} value={calibState.panSensitivity} max={10} onChange={(v) => updateCalib('panSensitivity', v)} color="text-gray-300" />
                                </div>
                            )}
                        </div>

                        {/* 3. AUDIO EFFECTS (Accordion) */}
                        <div className="border-t border-white/5 pt-2">
                            <button
                                onClick={() => setExpandedSection(expandedSection === 'audio' ? null : 'audio')}
                                className="w-full flex justify-between items-center py-2 text-xs font-bold text-green-500 uppercase tracking-widest hover:text-green-400"
                            >
                                <span><i className="fas fa-music mr-2"></i> {t.audioFx}</span>
                                <i className={`fas fa-chevron-down transition-transform ${expandedSection === 'audio' ? 'rotate-180' : ''}`}></i>
                            </button>

                            {expandedSection === 'audio' && (
                                <div className="mt-4 space-y-4 animate-fade-in pl-2 border-l border-white/5">
                                    <InputSlider label={t.dist} value={(calibState as any).distAudio} max={2} onChange={(v) => updateCalib('distAudio' as any, v)} color="text-blue-400" />
                                    <InputSlider label={t.gazeX} value={(calibState as any).gazeAudioX} max={3} onChange={(v) => updateCalib('gazeAudioX' as any, v)} color="text-cyan-400" />
                                    <InputSlider label={t.gazeY} value={(calibState as any).gazeAudioY} max={3} onChange={(v) => updateCalib('gazeAudioY' as any, v)} color="text-cyan-200" />
                                    <InputSlider label={`${t.smile} (Audio)`} value={(calibState as any).smileAudio} max={5} onChange={(v) => updateCalib('smileAudio' as any, v)} color="text-pink-400" />
                                    <InputSlider label={`${t.mouth} (Audio)`} value={(calibState as any).mouthAudio} max={2} onChange={(v) => updateCalib('mouthAudio' as any, v)} color="text-purple-400" />
                                    <InputSlider label={`${t.tilt} (Audio)`} value={(calibState as any).tiltAudio} max={2} step={0.05} onChange={(v) => updateCalib('tiltAudio' as any, v)} color="text-orange-400" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-white/10">
                        <button
                            onClick={async () => {
                                try {
                                    if (id) {
                                        await api.updateHistoryItemConfig(id, calibState);
                                        alert(t.configSaved);
                                    }
                                } catch (e) { alert("Error: " + e); }
                            }}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all text-white"
                        >
                            {t.save}
                        </button>
                    </div>
                </div>

                {/* ERROR BANNER */}
                {error && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[80] bg-red-900/90 text-white px-8 py-4 rounded-xl flex items-center gap-4">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* CONTROL DECK */}
            <div className="bg-[#0a0a0a] border-t border-white/10 flex flex-col z-[120] shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] w-full">
                <div className="flex items-center justify-between px-6 py-4 w-full">
                    {/* INFO */}
                    <div className="flex items-center gap-6 mr-8 overflow-hidden">
                        <div className="flex flex-col min-w-[150px]">
                            <h3 className="text-white font-bold text-lg tracking-wide uppercase truncate">{title || "SENZA TITOLO"}</h3>
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-400 text-xs uppercase tracking-wider">{author || "ARTISTA"}</span>
                                {date && <span className="text-gray-600 text-[10px] font-mono mt-1">{date}</span>}
                            </div>
                        </div>
                        <div className="h-12 w-12 opacity-80 shrink-0 hidden sm:block">
                            <img src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)))}`} className="w-full h-full object-contain" />
                        </div>
                    </div>

                    {/* CONTROLS */}
                    <div className="flex items-center gap-6 shrink-0">
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            <button onClick={restart} className="w-8 h-8 rounded-full text-gray-400 hover:text-white transition-all"><i className="fas fa-step-backward text-xs"></i></button>
                            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 transition-all"><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm ml-0.5`}></i></button>
                        </div>
                        <div className="text-xs font-mono text-brand-accent/80 tracking-widest hidden sm:block w-24 text-right">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                        <button onClick={onClose} className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-bold text-gray-300 hover:text-white uppercase">
                            {mode === 'fullscreen' ? t.close : t.back}
                        </button>
                    </div>
                </div>
                {/* SPECTRUM */}
                <div className="w-full h-24 bg-black/40 relative border-t border-white/5">
                    <canvas ref={spectrumCanvasRef} width={1920} height={96} className="w-full h-full opacity-80 mix-blend-screen block" />
                </div>
            </div>
            <style>{`.mirror-mode { transform: scaleX(-1); }`}</style>
        </div >
    );
};

// HELPER COMPONENTS
interface InputSliderProps { label: string; value: number; min?: number; max: number; step?: number; onChange: (val: number) => void; color?: string; }
const InputSlider: React.FC<InputSliderProps> = ({ label, value, min = 0, max, step = 0.1, onChange, color }) => (
    <div>
        <div className={`flex justify-between text-[10px] uppercase font-bold mb-1 ${color}`}>
            <span>{label}</span>
            <span>{value.toFixed(1)}</span>
        </div>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded cursor-pointer appearance-none"
        />
    </div>
);
