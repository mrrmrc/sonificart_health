import React, { useEffect, useRef, useState } from 'react';
import { SonificationResult, ColorRegion } from '../types';
import { api } from '../services/api';
import WebcamService, { BodyMetrics } from '../services/WebcamService';
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

    // Kiosk Mode (Hides UI for Museum Exhibitions)
    const query = new URLSearchParams(window.location.search);
    const isKiosk = query.get('kiosk') === 'true';

    // Lang Detection
    const lang = navigator.language.startsWith('it') ? 'it' : 'en';
    const t = TEXTS[lang];

    // States
    const [metrics, setMetrics] = useState<BodyMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- SETTINGS UI ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Sidebar closed by default
    const [expandedSection, setExpandedSection] = useState<'video' | 'audio' | null>(null);
    const [masterVolume, setMasterVolume] = useState(1.0);
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [visualMode, setVisualMode] = useState<'none' | 'skeleton' | 'transparency'>('none');

    // Default calibration values
    const calibRef = useRef({
        gazeCursorOpacity: 1.0,
        gazePointerSize: 10,
        gazeSensitivity: 1.0,
        tiltSensitivity: 1.0,
        neutralZ: 0.5,
        panSensitivity: 3.0,
        moveXSensitivity: 0.8,
        moveYSensitivity: 0.5,
        zoomSensitivity: 0.5,
        distAudio: 1.0,
        gazeAudioX: 1.0,
        gazeAudioY: 1.0,
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
        // Use smoothCam.current.z (real-time filtered position)
        const currentZ = smoothCam.current.z;
        // Default is -1.0. If close to default, camera might not be ready.
        if (currentZ <= -0.95) {
            return;
        }

        calibRef.current.neutralZ = currentZ;
        setIsCalibrated(true);
        setTimeout(() => setIsCalibrated(false), 2000);
    };

    // Auto-Calibrate on Startup
    useEffect(() => {
        const t1 = setTimeout(calibrateDistance, 1500);
        const t2 = setTimeout(calibrateDistance, 3000);
        const t3 = setTimeout(calibrateDistance, 5000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                e.stopPropagation();
                setIsSettingsOpen(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);

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
        highShelf: BiquadFilterNode | null;
        synthNodes: { osc: OscillatorNode, gain: GainNode }[];
    } | null>(null);

    // Grid tracking for overdubbing
    const lastPlayedCell = useRef<{x: number, y: number} | null>(null);
    const synthDebounce = useRef<number>(0);

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

            // Master Gain (User Volume)
            const masterGain = ctx.createGain();
            masterGain.gain.value = masterVolume;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            // ROUTING
            source.connect(panner);
            panner.connect(filter);
            filter.connect(highShelf);
            highShelf.connect(autoGain);
            autoGain.connect(masterGain);
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
                highShelf,
                synthNodes: []
            };

            // Grid bounds for Overdubbing
            let maxX = 1, maxY = 1;
            if (result.audioOutput.events && result.audioOutput.events.length > 0) {
                maxX = Math.max(...result.audioOutput.events.map(e => e.sourceBlock?.position?.x || 0));
                maxY = Math.max(...result.audioOutput.events.map(e => e.sourceBlock?.position?.y || 0));
            }
            if (maxX === 0) maxX = 1;
            if (maxY === 0) maxY = 1;

            // Simple Synth Function
            const playWhisperSynth = (freq: number, velocity: number) => {
                if (!engineRef.current) return;
                const c = engineRef.current.audioCtx;
                if (!c) return;
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, c.currentTime);
                // Attack / Release
                gain.gain.setValueAtTime(0, c.currentTime);
                const vol = (velocity / 127) * 0.3 * masterVolume; // subtle
                gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
                
                osc.connect(gain);
                gain.connect(engineRef.current.panner!); // Route through main effects
                osc.start(c.currentTime);
                osc.stop(c.currentTime + 1.0);
                
                engineRef.current.synthNodes.push({ osc, gain });
                engineRef.current.synthNodes = engineRef.current.synthNodes.filter(n => n.osc.context.currentTime < c.currentTime + 1.0);
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

                let m = WebcamService.getMetrics() as BodyMetrics;
                setMetrics(m);

                if (m.isActive) {
                    // --- RELATIVE DISTANCE & VOLUME LOGIC ---
                    const rawZ = m.z;
                    const neutralZ = calibRef.current.neutralZ;
                    const zDiff = rawZ - neutralZ;

                    let volFactor = 1.0;
                    const sensitivity = calibRef.current.distAudio || 1.0;

                    if (zDiff > 0) {
                        volFactor = Math.max(0.1, 1.0 - (zDiff * sensitivity * 1.5));
                    } else {
                        volFactor = Math.min(2.5, 1.0 + (Math.abs(zDiff) * sensitivity));
                    }

                    if (engineRef.current.autoGain) {
                        engineRef.current.autoGain.gain.setTargetAtTime(volFactor, now, 0.15);
                    }

                    // 2. Panning
                    const gazeOffset = 0; // removed gaze logic
                    const headPan = -(m.yaw * calibRef.current.panSensitivity);
                    const totalPan = headPan - gazeOffset;
                    if (engineRef.current.panner) engineRef.current.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, totalPan)), now, 0.1);

                    // 3. Tone (Gaze Y)
                    const gazeY = 0;
                    const targetQ = 1.0 + ((gazeY + 0.5) * 6.0 * calibRef.current.gazeAudioY);
                    if (engineRef.current.filter) engineRef.current.filter.Q.setTargetAtTime(Math.max(0.1, targetQ), now, 0.1);

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
                if (bgImageRef.current) {
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

                    const relZ = m.z - calibRef.current.neutralZ;
                    const targetCamZ = -1.0 + (relZ * calibRef.current.zoomSensitivity * 2);

                    const gazeTiltX = 0; // removed gaze
                    const gazeTiltY = 0; // removed gaze
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
                    const shadowX = -tiltY * 15;
                    const shadowY = tiltX * 15; 
                    bgImageRef.current.style.transform = `perspective(1000px) rotateX(${tiltX * 1.5}deg) rotateY(${tiltY * 1.5}deg) scale(1.0) translate3d(${-camX * 100}px, ${-camY * 100}px, ${cssZ}px)`;
                    bgImageRef.current.style.boxShadow = `${shadowX}px ${shadowY}px ${30 + Math.abs(cssZ / 5)}px rgba(0,0,0,0.6)`;
                }

                // Draw Logic
                const cx = w / 2, cy = h / 2;
                const screenAspect = w / h;
                const imgAspect = engineRef.current.imageAspect;
                let renderW = screenAspect > imgAspect ? h * imgAspect : w;
                let renderH = screenAspect > imgAspect ? h : w / imgAspect;

                if (m.isActive && calibRef.current.gazeCursorOpacity > 0) {
                    context.save();
                    context.globalAlpha = calibRef.current.gazeCursorOpacity * 0.6;
                    context.strokeStyle = 'rgba(45, 212, 191, 0.8)'; 
                    context.lineWidth = 2;
                    
                    // Left Hand
                    const hLx = cx + (((m.leftHandX || 0.5) - 0.5) * renderW);
                    const hLy = cy + (((m.leftHandY || 0.5) - 0.5) * renderH);
                    context.beginPath(); context.arc(hLx, hLy, calibRef.current.gazePointerSize, 0, Math.PI * 2); context.stroke();

                    // Right Hand
                    const hRx = cx + (((m.rightHandX || 0.5) - 0.5) * renderW);
                    const hRy = cy + (((m.rightHandY || 0.5) - 0.5) * renderH);
                    context.beginPath(); context.arc(hRx, hRy, calibRef.current.gazePointerSize, 0, Math.PI * 2); context.stroke();

                    context.restore();
                }

                    // --- PARALLAX CONSTELLATION & OVERDUBBING (REGIONS) ---
                    const regionsList = result.regions;
                    if (regionsList && regionsList.length > 0) {
                        // Health Paradigm (Organic Regions)
                        let hoveredRegion: ColorRegion | null = null;
                        let minDist = Infinity;

                        // Draw regions as a 3D Constellation
                        regionsList.forEach(region => {
                            // Base position based on centroid (0-100 to canvas coordinates)
                            const baseX = (w - renderW) / 2 + (region.centroidX / 100) * renderW;
                            const baseY = (h - renderH) / 2 + (region.centroidY / 100) * renderH;

                            // Parallax Depth Factor
                            let depthFactor = 1.0;
                            let nodeSize = 3;
                            if (region.depthLayer === 'foreground') { depthFactor = 2.5; nodeSize = 5; }
                            else if (region.depthLayer === 'background') { depthFactor = 0.4; nodeSize = 2; }

                            // Apply parallax translation based on camera/tilt
                            const parallaxX = baseX + (tiltY * 3 * depthFactor);
                            const parallaxY = baseY - (tiltX * 3 * depthFactor); // inverted tilt for natural feel

                            // Collision detection with Hands instead of Gaze
                            // Map Hand coordinates (0 to 1) to canvas coordinates
                            const lhX = cx + ((m.leftHandX || 0.5) - 0.5) * renderW;
                            const lhY = cy + ((m.leftHandY || 0.5) - 0.5) * renderH;
                            const rhX = cx + ((m.rightHandX || 0.5) - 0.5) * renderW;
                            const rhY = cy + ((m.rightHandY || 0.5) - 0.5) * renderH;
                            
                            const dlhX = lhX - parallaxX;
                            const dlhY = lhY - parallaxY;
                            const drhX = rhX - parallaxX;
                            const drhY = rhY - parallaxY;
                            
                            const distL = Math.sqrt(dlhX*dlhX + dlhY*dlhY);
                            const distR = Math.sqrt(drhX*drhX + drhY*drhY);
                            const dist = Math.min(distL, distR); // Closest hand
                            // Old dist removed

                            const isHovered = dist < 40; // Collision radius

                            if (isHovered && dist < minDist) {
                                minDist = dist;
                                hoveredRegion = region;
                            }

                            // Render Node
                            context.save();
                            context.beginPath();
                            context.arc(parallaxX, parallaxY, isHovered ? nodeSize * 2 : nodeSize, 0, Math.PI * 2);
                            context.fillStyle = region.hex;
                            context.shadowColor = region.hex;
                            context.shadowBlur = isHovered ? 20 : 5;
                            context.globalAlpha = isHovered ? 1.0 : 0.6 + (Math.sin(now * 3 + region.id) * 0.2); // slight pulse
                            context.fill();
                            context.restore();

                            // Draw subtle connecting lines for constellation effect (only to close nodes on same layer)
                            if (isHovered) {
                                regionsList.forEach(other => {
                                    if (other.id !== region.id && other.depthLayer === region.depthLayer) {
                                        const obx = (w - renderW) / 2 + (other.centroidX / 100) * renderW;
                                        const oby = (h - renderH) / 2 + (other.centroidY / 100) * renderH;
                                        const opx = obx + (tiltY * 3 * depthFactor);
                                        const opy = oby - (tiltX * 3 * depthFactor);
                                        const d = Math.sqrt(Math.pow(parallaxX - opx, 2) + Math.pow(parallaxY - opy, 2));
                                        if (d < 150) {
                                            context.save();
                                            context.beginPath();
                                            context.moveTo(parallaxX, parallaxY);
                                            context.lineTo(opx, opy);
                                            context.strokeStyle = region.hex;
                                            context.globalAlpha = 0.2;
                                            context.stroke();
                                            context.restore();
                                        }
                                    }
                                });
                            }
                        });

                        // Trigger synth if hovered
                        if (hoveredRegion !== null) {
                            const hr = hoveredRegion as ColorRegion;
                            const regionId = hr.id;
                            const gridX = -1; // special value for regions
                            const gridY = regionId;
                            
                            if (!lastPlayedCell.current || lastPlayedCell.current.y !== gridY || lastPlayedCell.current.x !== gridX) {
                                if (now - synthDebounce.current > 0.3) { // 300ms debounce
                                    lastPlayedCell.current = { x: gridX, y: gridY };
                                    synthDebounce.current = now;
                                    
                                    // Play Region Frequency
                                    playWhisperSynth(hr.frequencyHz, 0.6); // slightly louder for regions
                                }
                            }
                        }

                    } // No legacy grid synth anymore!

                    // --- DRAW VISUAL MODES ---
                    if (visualMode === 'skeleton' && m.landmarks) {
                        context.save();
                        context.globalAlpha = 0.8;
                        context.strokeStyle = '#2dd4bf'; // Cyan
                        context.lineWidth = 2;
                        context.fillStyle = '#f472b6'; // Pink
                        
                        // Define connections for the upper body (Pose landmarks)
                        const connections = [
                            [11, 12], [11, 13], [13, 15], // Right Arm
                            [12, 14], [14, 16],           // Left Arm
                            [11, 23], [12, 24], [23, 24]  // Torso
                        ];

                        // Draw lines
                        connections.forEach(([i, j]) => {
                            const p1 = m.landmarks![i];
                            const p2 = m.landmarks![j];
                            if (p1 && p2 && (p1.visibility ?? 1) > 0.5 && (p2.visibility ?? 1) > 0.5) {
                                const px1 = cx + (p1.x - 0.5) * renderW;
                                const py1 = cy + (p1.y - 0.5) * renderH;
                                const px2 = cx + (p2.x - 0.5) * renderW;
                                const py2 = cy + (p2.y - 0.5) * renderH;
                                context.beginPath();
                                context.moveTo(px1, py1);
                                context.lineTo(px2, py2);
                                context.stroke();
                            }
                        });

                        // Draw joints
                        [11, 12, 13, 14, 15, 16, 23, 24].forEach(i => {
                            const p = m.landmarks![i];
                            if (p && (p.visibility ?? 1) > 0.5) {
                                const px = cx + (p.x - 0.5) * renderW;
                                const py = cy + (p.y - 0.5) * renderH;
                                context.beginPath();
                                context.arc(px, py, 5, 0, Math.PI * 2);
                                context.fill();
                            }
                        });

                        context.restore();
                    }

                    if (visualMode === 'transparency' && m.landmarks) {
                        // Apply destination-out to clear the canvas where the body is
                        context.save();
                        context.globalCompositeOperation = 'destination-out';
                        context.fillStyle = 'black';
                        
                        // Create a thick path over the torso and arms to cut out the painting
                        context.beginPath();
                        const shoulderL = m.landmarks[12];
                        const shoulderR = m.landmarks[11];
                        const hipL = m.landmarks[24];
                        const hipR = m.landmarks[23];
                        
                        if (shoulderL && shoulderR && hipL && hipR) {
                            context.moveTo(cx + (shoulderL.x - 0.5) * renderW, cy + (shoulderL.y - 0.5) * renderH);
                            context.lineTo(cx + (shoulderR.x - 0.5) * renderW, cy + (shoulderR.y - 0.5) * renderH);
                            context.lineTo(cx + (hipR.x - 0.5) * renderW, cy + (hipR.y - 0.5) * renderH);
                            context.lineTo(cx + (hipL.x - 0.5) * renderW, cy + (hipL.y - 0.5) * renderH);
                            context.closePath();
                            context.fill();
                        }
                        
                        // Thicken arms
                        context.lineWidth = 60; // Thick stroke for arms
                        context.lineCap = 'round';
                        context.lineJoin = 'round';
                        context.strokeStyle = 'black';
                        
                        const arms = [
                            [11, 13], [13, 15], // Right
                            [12, 14], [14, 16]  // Left
                        ];
                        
                        arms.forEach(([i, j]) => {
                            const p1 = m.landmarks![i];
                            const p2 = m.landmarks![j];
                            if (p1 && p2) {
                                context.beginPath();
                                context.moveTo(cx + (p1.x - 0.5) * renderW, cy + (p1.y - 0.5) * renderH);
                                context.lineTo(cx + (p2.x - 0.5) * renderW, cy + (p2.y - 0.5) * renderH);
                                context.stroke();
                            }
                        });
                        
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
            engineRef.current.synthNodes.forEach(n => {
                try { n.osc.stop(); n.osc.disconnect(); n.gain.disconnect(); } catch(e){}
            });
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
        <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden font-sans">
            <div ref={stageRef} className="flex-grow relative overflow-hidden w-full">
                {/* Backgrounds */}
                {mode === 'fullscreen' && <div className="absolute inset-0 z-0"><img src={result.standardizedImageUrl} className="w-full h-full object-cover filter blur-[40px] opacity-40 scale-110" /></div>}
                {/* 3D PLATFORM IMAGE */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-1" style={{ perspective: '1500px', transformStyle: 'preserve-3d' }}>
                    <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
                        {/* Main Image */}
                        <img ref={bgImageRef} src={result.standardizedImageUrl} className="w-full h-full object-contain transition-transform duration-75 ease-out relative z-10" style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }} />

                        {/* 3D Base Platform - Bottom Face */}
                        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{
                            transform: 'rotateX(90deg) translateZ(-4px)',
                            transformOrigin: 'bottom center',
                            background: 'linear-gradient(to bottom, rgba(20, 20, 30, 0.8), rgba(10, 10, 15, 0.95))',
                            borderTop: '1px solid rgba(45, 212, 191, 0.2)',
                            boxShadow: '0 0 20px rgba(0, 0, 0, 0.8)'
                        }}></div>

                        {/* 3D Base Platform - Left Side */}
                        <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none" style={{
                            transform: 'rotateY(90deg) translateZ(-4px) translateX(-4px)',
                            transformOrigin: 'left bottom',
                            background: 'linear-gradient(to right, rgba(15, 15, 20, 0.9), rgba(20, 20, 30, 0.8))',
                            borderRight: '1px solid rgba(45, 212, 191, 0.15)'
                        }}></div>

                        {/* 3D Base Platform - Right Side */}
                        <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none" style={{
                            transform: 'rotateY(-90deg) translateZ(-4px) translateX(4px)',
                            transformOrigin: 'right bottom',
                            background: 'linear-gradient(to left, rgba(15, 15, 20, 0.9), rgba(20, 20, 30, 0.8))',
                            borderLeft: '1px solid rgba(45, 212, 191, 0.15)'
                        }}></div>
                    </div>
                </div>
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10 mix-blend-screen" />

                {/* WEBCAM PIP */}
                <div className="absolute bottom-32 right-6 flex flex-col items-center gap-0 z-50 transition-all duration-500 hover:scale-105 opacity-80 hover:opacity-100">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-cyan-500 shadow-lg bg-black relative">
                        <video ref={videoRef} className="w-full h-full object-cover mirror-mode opacity-100" autoPlay muted playsInline />
                        <canvas ref={faceLinkCanvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none" />
                    </div>
                </div>

                {/* SETTINGS TOGGLE */}
                {isKiosk ? (
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="absolute bottom-4 left-4 z-[9999] text-gray-800 hover:text-white opacity-20 hover:opacity-100 transition-all text-xl"
                        title="Impostazioni Kiosk"
                    >
                        *
                    </button>
                ) : (
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="absolute top-24 left-6 z-[9999] text-gray-400 hover:text-white bg-black/50 p-3 rounded-full backdrop-blur transition-all border border-transparent hover:border-white/20"
                    >
                        <i className="fas fa-cog text-xl"></i>
                    </button>
                )}

                {/* SIDEBAR SETTINGS */}
                <div className={`absolute top-0 left-0 h-full w-80 bg-black/95 backdrop-blur-xl border-r border-white/10 z-[10000] transition-transform duration-300 transform ${isSettingsOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}>

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

                        {/* 2. DISPLAY MODE */}
                        <div className="border-t border-white/5 pt-4">
                            <label className="block text-xs font-bold text-pink-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-eye"></i> Visual Mode
                            </label>
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setVisualMode('none')}
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${visualMode === 'none' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    None
                                </button>
                                <button
                                    onClick={() => setVisualMode('skeleton')}
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${visualMode === 'skeleton' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    Skeleton
                                </button>
                                <button
                                    onClick={() => setVisualMode('transparency')}
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${visualMode === 'transparency' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    Transparent
                                </button>
                            </div>
                        </div>

                        {/* 3. CAMERA CONTROLS */}
                        <div className="border-t border-white/5 pt-4">
                            <label className="block text-xs font-bold text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-camera"></i> Camera Sensitivity
                            </label>
                            <div className="mt-4 space-y-4">
                                <InputSlider label={t.zoom || 'Zoom'} value={calibState.zoomSensitivity} max={2} onChange={(v) => updateCalib('zoomSensitivity', v)} color="text-blue-400" />
                                <InputSlider label={t.tilt || 'Tilt'} value={calibState.tiltSensitivity} max={100} step={1} onChange={(v) => updateCalib('tiltSensitivity', v)} color="text-gray-300" />
                                <InputSlider label={t.pan || 'Pan'} value={calibState.panSensitivity} max={10} onChange={(v) => updateCalib('panSensitivity', v)} color="text-gray-300" />
                                <InputSlider label={t.dist || 'Volume (Distance)'} value={calibState.distAudio} max={2} onChange={(v) => updateCalib('distAudio', v)} color="text-blue-400" />
                                <InputSlider label={t.gazeX || 'Pan (Gaze X)'} value={calibState.gazeAudioX} max={3} onChange={(v) => updateCalib('gazeAudioX', v)} color="text-cyan-400" />
                                <InputSlider label={t.gazeY || 'Filter (Gaze Y)'} value={calibState.gazeAudioY} max={3} onChange={(v) => updateCalib('gazeAudioY', v)} color="text-cyan-200" />
                            </div>
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

            {/* CONTROL DECK (3-COLUMN LAYOUT) */}
            {!isKiosk && (
            <div className="bg-gradient-to-t from-black via-black/95 to-black/80 border-t border-white/10 flex flex-col z-[120] shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full backdrop-blur-md">

                {/* Main Grid: Info | Spectrum | Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 py-6 items-center w-full">

                    {/* LEFT COL: METADATA */}
                    <div className="flex flex-col justify-center min-w-[200px]">
                        <h3 className="text-white font-bold text-2xl tracking-wide uppercase truncate font-display">{title || "SENZA TITOLO"}</h3>
                        <div className="flex flex-col gap-1 mt-1">
                            <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">{author || "ARTISTA"}</span>
                            {date && <span className="text-gray-500 text-[10px] font-mono">{date}</span>}
                        </div>
                        {result.description && (
                            <p className="text-gray-400 text-xs mt-3 line-clamp-2 leading-relaxed opacity-80 max-w-sm">
                                {result.description}
                            </p>
                        )}

                        {/* Social Links & QR Code */}
                        <div className="mt-4 flex items-center gap-4">
                            <div className="flex gap-3">
                                <a href={`https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener" className="text-gray-500 hover:text-blue-500 transition-colors">
                                    <i className="fab fa-facebook text-lg"></i>
                                </a>
                                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title || 'SonificART')}`} target="_blank" rel="noopener" className="text-gray-500 hover:text-cyan-400 transition-colors">
                                    <i className="fab fa-twitter text-lg"></i>
                                </a>
                                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener" className="text-gray-500 hover:text-blue-400 transition-colors">
                                    <i className="fab fa-linkedin text-lg"></i>
                                </a>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        alert('Link copiato!');
                                    }}
                                    className="text-gray-500 hover:text-green-400 transition-colors"
                                    title="Copia Link"
                                >
                                    <i className="fas fa-link text-lg"></i>
                                </button>
                            </div>

                            {/* QR Code */}
                            <div className="ml-2 p-1 bg-white rounded" title="Scansiona per condividere">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(window.location.href)}`}
                                    alt="QR Code"
                                    className="w-12 h-12"
                                />
                            </div>
                        </div>
                    </div>

                    {/* CENTER COL: SPECTRUM VISUALIZER */}
                    <div className="w-full h-16 bg-black/30 rounded-lg overflow-hidden border border-white/5 relative shadow-inner">
                        <canvas ref={spectrumCanvasRef} width={800} height={64} className="w-full h-full opacity-90 mix-blend-screen block" />
                    </div>

                    {/* RIGHT COL: CONTROLS & LOGO */}
                    <div className="flex items-center justify-end gap-6">
                        {/* Player Controls */}
                        <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-full border border-white/10 shadow-lg">
                            <button onClick={restart} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-all hover:bg-white/10"><i className="fas fa-step-backward text-xs"></i></button>
                            <button onClick={togglePlay} className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition-all shadow-lg hover:shadow-cyan-500/50"><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-lg ml-0.5`}></i></button>
                        </div>

                        {/* Time */}
                        <div className="text-xs font-mono text-cyan-500/80 tracking-widest hidden lg:block w-24 text-right">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>

                        {/* Logo */}
                        <div className="h-14 w-14 opacity-80 shrink-0 hidden xl:block">
                            <img src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)))}`} className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(45,212,191,0.3)]" />
                        </div>

                        <button onClick={onClose} className="ml-4 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-gray-400 hover:text-white hover:bg-red-900/40 uppercase transition-all">
                            {mode === 'fullscreen' ? t.close : t.back}
                        </button>
                    </div>
                </div>
            </div>
            )}
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

export default LivePerformanceOverlay;
