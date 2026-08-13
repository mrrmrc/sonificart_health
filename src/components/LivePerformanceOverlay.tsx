import React, { useEffect, useRef, useState } from 'react';
import { SonificationResult, ColorRegion, StemMapping, BodyPart, AudioParameter, HealthCategoryType, WhoAgentConfig, WhoAgentCategoryConfig, BODY_PARTS_LABELS, AUDIO_PARAMS_LABELS, DEFAULT_WHO_AGENT_CONFIG } from '../types';
import { api } from '../services/api';
import WebcamService, { BodyMetrics } from '../services/WebcamService';
import { LOGO_SVG_STRING } from './Logo';
import { analyzeStem, StemAnalysis } from '../services/AudioAnalysisService';

export interface AudioEngine {
    audioCtx: AudioContext | null;
    source: AudioBufferSourceNode | null;
    stemSources?: AudioBufferSourceNode[];
    stemGains?: GainNode[];
    stem3DPanners?: PannerNode[];     // 8D - 3D panners (one per stem)
    stemPanners?: StereoPannerNode[]; // Legacy (unused with 8D)
    stemFilters?: BiquadFilterNode[];
    stemDelays?: DelayNode[];
    stemDistortions?: WaveShaperNode[];
    orbitAngles?: number[];           // 8D - current orbit angle per stem (degrees)
    orbitParams?: { radius: number; height: number; speed: number }; // 8D orbit shared params
    panner: StereoPannerNode | null;
    filter: BiquadFilterNode | null;
    masterDelay?: DelayNode;
    masterDistortion?: WaveShaperNode;
    autoGain: GainNode | null;
    masterGain: GainNode | null;
    analyser: AnalyserNode | null;
    imageAspect: number;
    startTime: number;
    animationId: number;
    synthNodes: {osc: OscillatorNode, gain: GainNode}[];
    masterTrackGain: GainNode | null;
}

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

// --- WHO VISUAL & MAPPING CONFIGURATION ---
interface WhoConfig {
    colors: {
        torso: { color: string, glow: string },
        arms: { color: string, glow: string },
        legs: { color: string, glow: string },
        hands: { color: string, glow: string },
        face: { color: string, glow: string },
        mouth: { color: string, glow: string }
    },
    expression: 'smile' | 'neutral' | 'open' | 'soft_smile',
    stemBodyParts: BodyPart[]
}

const WHO_CONFIGS: Record<HealthCategoryType, WhoConfig> = {
    calming: {
        colors: {
            torso: { color: '#0ea5e9', glow: '#0284c7' }, // Sky blue
            arms: { color: '#14b8a6', glow: '#0d9488' }, // Teal
            legs: { color: '#3b82f6', glow: '#2563eb' }, // Blue
            hands: { color: '#2dd4bf', glow: '#14b8a6' },
            face: { color: '#60a5fa', glow: '#3b82f6' },
            mouth: { color: '#fcd34d', glow: '#fbbf24' }
        },
        expression: 'soft_smile',
        stemBodyParts: ['torsoY', 'handsY', 'headPitch', 'z', 'shoulderY'] // Slow, respiratory/calm movements
    },
    physiological: {
        colors: {
            torso: { color: '#10b981', glow: '#059669' }, // Emerald
            arms: { color: '#34d399', glow: '#10b981' }, 
            legs: { color: '#a7f3d0', glow: '#6ee7b7' },
            hands: { color: '#6ee7b7', glow: '#34d399' },
            face: { color: '#f8fafc', glow: '#e2e8f0' }, // White/neutral
            mouth: { color: '#10b981', glow: '#059669' }
        },
        expression: 'neutral',
        stemBodyParts: ['z', 'headPitch', 'shoulderTilt', 'torsoY', 'handsY'] // Postural, neutral
    },
    cognitive_motor: {
        colors: {
            torso: { color: '#eab308', glow: '#ca8a04' }, // Yellow
            arms: { color: '#ec4899', glow: '#db2777' }, // Pink
            legs: { color: '#06b6d4', glow: '#0891b2' }, // Cyan
            hands: { color: '#f43f5e', glow: '#e11d48' },
            face: { color: '#fb923c', glow: '#f97316' },
            mouth: { color: '#ec4899', glow: '#db2777' }
        },
        expression: 'neutral', // Focus
        stemBodyParts: ['leftHandX', 'rightHandX', 'leftHandY', 'rightHandY', 'kneeY'] // Precision of limbs
    },
    social_emotional: {
        colors: {
            torso: { color: '#f97316', glow: '#ea580c' }, // Orange
            arms: { color: '#f43f5e', glow: '#e11d48' }, // Rose
            legs: { color: '#eab308', glow: '#ca8a04' }, // Yellow
            hands: { color: '#fbbf24', glow: '#f59e0b' },
            face: { color: '#fcd34d', glow: '#fbbf24' },
            mouth: { color: '#ef4444', glow: '#b91c1c' }
        },
        expression: 'smile',
        stemBodyParts: ['headYaw', 'shoulderY', 'armSpan', 'torsoY', 'z'] // Interaction, turning head, opening arms
    },
    motivation: {
        colors: {
            torso: { color: '#ef4444', glow: '#b91c1c' }, // Red
            arms: { color: '#f97316', glow: '#ea580c' }, // Orange
            legs: { color: '#84cc16', glow: '#65a30d' }, // Lime
            hands: { color: '#eab308', glow: '#ca8a04' },
            face: { color: '#ef4444', glow: '#b91c1c' },
            mouth: { color: '#fbbf24', glow: '#f59e0b' }
        },
        expression: 'open', // Energetic
        stemBodyParts: ['armSpan', 'kneeY', 'elbowY', 'shoulderTilt', 'torsoY'] // Ample movements
    }
};

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

const OBSERVER_GESTURES_CATEGORIZED = [
    {
        title: 'Testa e Sguardo',
        icon: 'fa-head-side',
        items: [
            { key: 'gazeX', label: 'Sguardo Orizz. (X)', icon: 'fa-eye' },
            { key: 'gazeY', label: 'Sguardo Vert. (Y)', icon: 'fa-eye' },
            { key: 'headYaw', label: 'Testa (Destra/Sinistra)', icon: 'fa-head-side' },
            { key: 'headPitch', label: 'Testa (Su/Giù)', icon: 'fa-arrows-alt-v' },
            { key: 'headRoll', label: 'Testa (Inclinazione)', icon: 'fa-undo' },
            { key: 'headZ', label: 'Testa (Avvicinamento)', icon: 'fa-compress-arrows-alt' }
        ] as { key: BodyPart, label: string, icon: string }[]
    },
    {
        title: 'Braccia e Mani',
        icon: 'fa-hands',
        items: [
            { key: 'leftHandX', label: 'Mano SX (Orizzontale)', icon: 'fa-hand-paper' },
            { key: 'leftHandY', label: 'Mano SX (Altezza)', icon: 'fa-hand-paper' },
            { key: 'leftHandZ', label: 'Mano SX (Profondità)', icon: 'fa-hand-paper' },
            { key: 'rightHandX', label: 'Mano DX (Orizzontale)', icon: 'fa-hand-paper' },
            { key: 'rightHandY', label: 'Mano DX (Altezza)', icon: 'fa-hand-paper' },
            { key: 'rightHandZ', label: 'Mano DX (Profondità)', icon: 'fa-hand-paper' },
            { key: 'handsY', label: 'Mani (Altezza Media)', icon: 'fa-hands' },
            { key: 'armSpan', label: 'Apertura Braccia', icon: 'fa-expand-arrows-alt' },
            { key: 'elbowY', label: 'Gomiti (Altezza)', icon: 'fa-compress' }
        ] as { key: BodyPart, label: string, icon: string }[]
    },
    {
        title: 'Busto e Postura',
        icon: 'fa-child',
        items: [
            { key: 'z', label: 'Distanza Osservatore (Z)', icon: 'fa-street-view' },
            { key: 'torsoX', label: 'Busto (Orizzontale)', icon: 'fa-arrows-alt-h' },
            { key: 'torsoY', label: 'Busto (Altezza)', icon: 'fa-arrows-alt-v' },
            { key: 'shoulderY', label: 'Spalle (Altezza)', icon: 'fa-tshirt' },
            { key: 'shoulderTilt', label: 'Inclinazione Spalle', icon: 'fa-balance-scale' },
            { key: 'openness', label: 'Apertura Postura', icon: 'fa-people-arrows' },
            { key: 'energyLevel', label: 'Livello Energia', icon: 'fa-bolt' }
        ] as { key: BodyPart, label: string, icon: string }[]
    },
    {
        title: 'Gambe e Piedi',
        icon: 'fa-walking',
        items: [
            { key: 'kneeY', label: 'Ginocchia (Altezza)', icon: 'fa-arrows-alt-v' },
            { key: 'footY', label: 'Piedi (Altezza)', icon: 'fa-shoe-prints' }
        ] as { key: BodyPart, label: string, icon: string }[]
    }
];

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
    const [visualMode, setVisualMode] = useState<'none' | 'skeleton' | 'transparency'>('skeleton');
    const visualModeRef = useRef(visualMode);
    useEffect(() => { visualModeRef.current = visualMode; }, [visualMode]);

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
        gazeAudioX: 1.0,
        gazeAudioY: 1.0,
        distAudio: 1.0
    });
    
    // Master Audio Toggle
    const [useMasterAudio, setUseMasterAudio] = useState(result.configUsed?.useMasterAudio ?? true);
    const useMasterAudioRef = useRef(useMasterAudio);
    useEffect(() => { useMasterAudioRef.current = useMasterAudio; }, [useMasterAudio]);
    
    // Removed static useEffect for useMasterAudio - now handled dynamically in onTimeUpdate
    
    // STEM LOCAL STATE
    const [localStems, setLocalStems] = useState<StemMapping[]>(
        result.stemMappings && result.stemMappings.length > 0 ? result.stemMappings : []
    );
    // Use a ref so the render loop closure always reads the latest stems
    const stemsRef = useRef<StemMapping[]>(result.stemMappings || []);
    useEffect(() => { stemsRef.current = localStems; }, [localStems]);
    
    // AI Stem Analysis
    const [stemAnalyses, setStemAnalyses] = useState<StemAnalysis[]>([]);
    
    // Configurable WHO Agent Logic
    const [agentConfig, setAgentConfig] = useState<WhoAgentConfig>(DEFAULT_WHO_AGENT_CONFIG);

    useEffect(() => {
        api.getWhoAgentConfig().then(config => {
            if (config) setAgentConfig({ ...DEFAULT_WHO_AGENT_CONFIG, ...config });
        }).catch(console.error);
    }, []);

    // Live Skeleton Panel — auto chiuso di default
    const [showSkeletonPanel, setShowSkeletonPanel] = useState(false);
    
    // Manual Live Mappings
    type LiveMappingTarget = 'master' | string;
    interface LiveMapping { target: LiveMappingTarget; parameter: AudioParameter; }
    const [liveMappings, setLiveMappings] = useState<Record<string, LiveMapping>>({});
    const liveMappingsRef = useRef(liveMappings);
    useEffect(() => { liveMappingsRef.current = liveMappings; }, [liveMappings]);

    // Initialize liveMappings
    useEffect(() => {
        if (!agentConfig || !result) return;
        const primaryCatKey = result.healthClassification?.primaryCategory?.category as keyof WhoAgentConfig || 'calming';
        const catConfig = agentConfig[primaryCatKey];
        if (!catConfig) return;

        const initialMappings: Record<string, LiveMapping> = {};
        let hasCustomMappings = false;
        
        // 1. Try to load saved mappings from database history item (result.configUsed)
        if (result.configUsed?.masterMappings && result.configUsed.masterMappings.length > 0) {
            result.configUsed.masterMappings.forEach((mm: any) => {
                initialMappings[mm.bodyPart] = { target: 'master', parameter: mm.parameter || mm.audioParam };
                hasCustomMappings = true;
            });
        }
        
        localStems.forEach(stem => {
            if (stem.assignedBodyPart) {
                // If the parameter isn't saved, default to 'volume' for stems
                initialMappings[stem.assignedBodyPart] = { target: stem.id, parameter: (stem as any).parameter || 'volume' };
                hasCustomMappings = true;
            }
        });

        // 2. If no custom mappings found, fallback to WHO agent defaults
        if (!hasCustomMappings) {
            catConfig.masterMappings.forEach(mm => {
                initialMappings[mm.bodyPart] = { target: 'master', parameter: mm.audioParam };
            });

            catConfig.stemMappings.forEach(sm => {
                if (sm.targetStemIndex !== undefined && localStems[sm.targetStemIndex]) {
                    const stemId = localStems[sm.targetStemIndex].id;
                    initialMappings[sm.bodyPart] = { target: stemId, parameter: sm.audioParam };
                }
            });
        }

        // Only set if we haven't modified it yet manually
        setLiveMappings(prev => Object.keys(prev).length > 0 ? prev : initialMappings);
    }, [agentConfig, result, localStems]);

    // Audio Player State
    const [playbackState, setPlaybackState] = useState<'playing' | 'paused'>('playing');

    const togglePlayback = () => {
        if (!engineRef.current?.audioCtx) return;
        if (playbackState === 'playing') {
            engineRef.current.audioCtx.suspend();
            setPlaybackState('paused');
        } else {
            engineRef.current.audioCtx.resume();
            setPlaybackState('playing');
        }
    };

    // Force re-render for UI
    const [calibState, setCalibState] = useState(calibRef.current);
    const smoothCam = useRef({ x: 0, y: 0, z: -1.0, tiltX: 0, tiltY: 0 });

    const updateCalib = (key: keyof typeof calibRef.current, val: number) => {
        calibRef.current = { ...calibRef.current, [key]: val };
        setCalibState(calibRef.current);
    };

    // --- AUTO CALIBRATION ---
    const calibrateDistance = () => {
        setIsCalibrated(true);
        WebcamService.startCalibration();
        setTimeout(() => setIsCalibrated(false), 3000);
    };

    // Auto-Calibrate on Startup
    useEffect(() => {
        const t1 = setTimeout(calibrateDistance, 1500);
        return () => { clearTimeout(t1); };
    }, []);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                e.stopPropagation();
                setIsSettingsOpen(prev => !prev);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                setShowSkeletonPanel(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);

    // Engine Refs
    const engineRef = useRef<AudioEngine | null>(null);

    // Grid tracking for overdubbing
    const lastPlayedCell = useRef<{x: number, y: number} | null>(null);
    const synthDebounce = useRef<number>(0);
    const lastMetricsTime = useRef<number>(0);

    // Save mappings state
    const [isSaving, setIsSaving] = useState(false);
    const handleSaveMappings = async () => {
        setIsSaving(true);
        if (id) {
            try {
                // Update specific stems mappings
                const updatedStems = localStems.map(stem => {
                    const mappingEntry = Object.entries(liveMappings).find(([_, m]) => m.target === stem.id);
                    if (mappingEntry) {
                        return { ...stem, assignedBodyPart: mappingEntry[0] as any, parameter: mappingEntry[1].parameter };
                    }
                    return stem;
                });
                if (updatedStems.length > 0) {
                    await api.updateHistoryItemStemsMapping(id, updatedStems);
                    setLocalStems(updatedStems);
                }
                
                // Update master mappings and settings
                const masterMappingsList = Object.entries(liveMappings)
                    .filter(([_, m]) => m.target === 'master')
                    .map(([bp, m]) => ({ bodyPart: bp, parameter: m.parameter }));
                
                await api.updateHistoryItemConfig(id, {
                    ...result.configUsed,
                    masterMappings: masterMappingsList,
                    useMasterAudio: useMasterAudioRef.current
                });
            } catch (e) {
                console.error("Failed to save mappings", e);
            }
        }
        setTimeout(() => setIsSaving(false), 1000);
    };

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

            // Try to load Stems
            let stemBuffers: AudioBuffer[] = [];
            let useStems = false;
            
            if (stemsRef.current.length > 0) {
                // User uploaded local stems via UI
                try {
                    console.log('[STEMS] Tentativo caricamento stem:', stemsRef.current.map(s => s.url));
                    const fetchStem = async (stem: StemMapping) => {
                        // Handle blob: URLs (local file not yet uploaded) vs server URLs
                        if (stem.url.startsWith('blob:')) {
                            console.warn('[STEMS] Stem con URL blob - file non caricato sul server:', stem.name);
                            throw new Error(`Blob URL not supported in playback: ${stem.name}`);
                        }
                        const fixedUrl = stem.url.startsWith('http') ? stem.url : `${window.location.origin}${stem.url.startsWith('/') ? '' : '/'}${stem.url}`;
                        console.log('[STEMS] Fetching:', fixedUrl);
                        const res = await fetch(fixedUrl);
                        if (!res.ok) throw new Error(`Not found: ${fixedUrl} (status: ${res.status})`);
                        return await ctx.decodeAudioData(await res.arrayBuffer());
                    };
                    stemBuffers = await Promise.all(stemsRef.current.map(fetchStem));
                    useStems = true;
                    console.log(`[STEMS] Caricati ${stemBuffers.length} stem dinamici.`);
                } catch (e) {
                    console.error('[STEMS] Errore caricamento stem:', e);
                    // Non bloccare - fallback alla traccia unita
                }
            } else {
                // Fallback hardcoded
                try {
                    const fetchStem = async (name: string) => {
                        const res = await fetch(`/stems/${name}.mp3`);
                        if (!res.ok) throw new Error('Not found');
                        return await ctx.decodeAudioData(await res.arrayBuffer());
                    };
                    stemBuffers = await Promise.all(['drums', 'bass', 'vox', 'other'].map(fetchStem));
                    useStems = true;
                    console.log("Stem multitraccia caricati con successo!");
                } catch (e) {
                    console.log("Stems non trovati, procedo con traccia unita");
                }
            }

            // Always decode the master track (fallbackBuffer) so it can play alongside stems
            let fallbackBuffer: AudioBuffer | null = null;
            try {
                const arrayBuffer = await audioBlob.arrayBuffer();
                fallbackBuffer = await ctx.decodeAudioData(arrayBuffer);
            } catch(e) {
                console.error("Could not decode master track", e);
            }

            // AUDIO HELPERS
            const makeDistortionCurve = (amount: number = 0) => {
                const k = typeof amount === 'number' ? amount : 50;
                const n_samples = 44100;
                const curve = new Float32Array(n_samples);
                const deg = Math.PI / 180;
                for (let i = 0; i < n_samples; ++i) {
                    const x = (i * 2) / n_samples - 1;
                    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
                }
                return curve;
            };

            // NODE GRAPH FOR MASTER EFFECTS
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 20000;
            filter.Q.value = 1.0;

            const masterDistortion = ctx.createWaveShaper();
            masterDistortion.curve = makeDistortionCurve(0);
            
            const masterDelay = ctx.createDelay(1.0);
            masterDelay.delayTime.value = 0;

            const highShelf = ctx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 4000;
            highShelf.gain.value = 0;

            const autoGain = ctx.createGain(); // Distance volume
            autoGain.gain.value = 1.0;

            const masterGain = ctx.createGain(); // User master volume
            masterGain.gain.value = masterVolume;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            // Route master chain
            filter.connect(masterDistortion);
            masterDistortion.connect(masterDelay);
            masterDelay.connect(highShelf);
            highShelf.connect(autoGain);
            autoGain.connect(masterGain);
            masterGain.connect(analyser);
            analyser.connect(ctx.destination);

            let sourceNode: AudioBufferSourceNode | null = null;
            let stemSources: AudioBufferSourceNode[] = [];
            let stemGains: GainNode[] = [];
            let stemDelays: DelayNode[] = [];
            let stemDistortions: WaveShaperNode[] = [];
            let stemPanners: StereoPannerNode[] = [];   // Legacy / unused with 8D
            let stem3DPanners: PannerNode[] = [];        // 8D orbit panners
            let stemFilters: BiquadFilterNode[] = [];
            let panner: StereoPannerNode | null = null;

            // 8D: Set listener at origin, listener faces -Z
            ctx.listener.positionX.value = 0;
            ctx.listener.positionY.value = 0;
            ctx.listener.positionZ.value = 0;
            ctx.listener.forwardX.value = 0;
            ctx.listener.forwardY.value = 0;
            ctx.listener.forwardZ.value = -1;
            ctx.listener.upX.value = 0;
            ctx.listener.upY.value = 1;
            ctx.listener.upZ.value = 0;

            // ALWAYS init master track
            sourceNode = ctx.createBufferSource();
            sourceNode.buffer = fallbackBuffer;
            panner = ctx.createStereoPanner();
            
            // If we have stems, master track is background, otherwise it's foreground
            const masterGainNode = ctx.createGain();
            let initialMasterGain = useStems ? 0.4 : 1.0;
            if (!useMasterAudioRef.current) initialMasterGain = 0;
            masterGainNode.gain.value = initialMasterGain;
            
            sourceNode.connect(panner);
            panner.connect(masterGainNode);
            masterGainNode.connect(filter);

            if (useStems) {
                for (let i = 0; i < stemBuffers.length; i++) {
                    const src = ctx.createBufferSource();
                    src.buffer = stemBuffers[i];
                    
                    const gain = ctx.createGain();
                    gain.gain.value = 0.75;
                    
                    // 8D: Use 3D PannerNode with HRTF
                    const panner3D = ctx.createPanner();
                    panner3D.panningModel = 'HRTF';
                    panner3D.distanceModel = 'inverse';
                    panner3D.refDistance = 1;
                    panner3D.maxDistance = 10000;
                    panner3D.rolloffFactor = 5; // Molto aggressivo per enfatizzare lo spostamento 8D
                    // Phase offset: each stem starts at a different position in the orbit
                    const phaseRad = (i / stemBuffers.length) * Math.PI * 2;
                    const initRadius = 5.0; // Raggio più ampio
                    panner3D.positionX.value = Math.sin(phaseRad) * initRadius;

                    panner3D.positionY.value = 0;
                    panner3D.positionZ.value = Math.cos(phaseRad) * initRadius;
                    
                    const stemFilter = ctx.createBiquadFilter();
                    stemFilter.type = 'lowpass';
                    stemFilter.frequency.value = 20000;
                    
                    const stemDistortion = ctx.createWaveShaper();
                    stemDistortion.curve = makeDistortionCurve(0);
                    const stemDelay = ctx.createDelay(1.0);
                    stemDelay.delayTime.value = 0;
                    
                    src.connect(gain);
                    gain.connect(panner3D);
                    panner3D.connect(stemFilter);
                    stemFilter.connect(stemDistortion);
                    stemDistortion.connect(stemDelay);
                    stemDelay.connect(filter); // connect to master chain
                    
                    stemSources.push(src);
                    stemGains.push(gain);
                    stem3DPanners.push(panner3D);
                    stemFilters.push(stemFilter);
                    

                    stemDelays.push(stemDelay);
                    stemDistortions.push(stemDistortion);
                }
            }

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

            // Always start master track
            if (sourceNode) sourceNode.start(0);
            setDuration(fallbackBuffer ? fallbackBuffer.duration : (useStems && stemBuffers.length > 0 ? stemBuffers[0].duration : 0));

            if (useStems) {
                stemSources.forEach(s => s.start(0));
                
                // AI Analysis in background (non blocking)
                Promise.all(stemBuffers.map((buf, i) => analyzeStem(buf, i, stemBuffers.length)))
                    .then(analyses => {
                        setStemAnalyses(analyses);
                        // Auto-apply AI mapping if no user mappings set
                        if (stemsRef.current.length > 0 && stemsRef.current.every(s => !s.assignedBodyPart || s.assignedBodyPart === 'leftHandY')) {
                            const primaryCategory = result.healthClassification?.primaryCategory?.category as keyof WhoAgentConfig || 'calming';
                            const catConfig = DEFAULT_WHO_AGENT_CONFIG[primaryCategory] || DEFAULT_WHO_AGENT_CONFIG['calming'];
                            
                            const updated = stemsRef.current.map((stem, i) => {
                                // Trova la regola di stem dalla coreografia WHO (default fallback)
                                const rule = catConfig.stemMappings.find(r => r.targetStemIndex === i) || catConfig.stemMappings[i % catConfig.stemMappings.length];
                                
                                return {
                                    ...stem,
                                    // Se c'è una coreografia definita la usiamo, altrimenti fallback ad AI
                                    assignedBodyPart: rule ? rule.bodyPart : analyses[i]?.suggestedBodyPart as BodyPart,
                                    parameter: rule ? rule.audioParam : (i % 2 === 0 ? 'pan' : 'lowpass')
                                };
                            });
                            setLocalStems(updated);
                        }
                        console.log('[AI ANALYSIS]', analyses.map(a => a.label));
                    })
                    .catch(e => console.warn('Audio analysis skipped:', e));
            }

            setIsPlaying(true);

            engineRef.current = {
                audioCtx: ctx,
                source: sourceNode,
                stemSources,
                stemGains,
                stemPanners,
                stem3DPanners,
                stemFilters,
                stemDelays,
                stemDistortions,
                masterDelay,
                masterDistortion,
                panner,
                filter,
                autoGain,
                masterGain,
                analyser,
                animationId: 0,
                imageAspect,
                startTime: ctx.currentTime,
                synthNodes: [],
                masterTrackGain: masterGainNode,
                orbitAngles: stem3DPanners.map((_, i) => (i / Math.max(1, stem3DPanners.length)) * 360),
                orbitParams: { radius: 3.0, height: 0, speed: 1.0 }
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
                engineRef.current.synthNodes = engineRef.current.synthNodes.filter((n: any) => n.osc.context.currentTime < c.currentTime + 1.0);
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
                if (now - lastMetricsTime.current > 0.1) { // Throttle React state updates to 10 FPS
                    lastMetricsTime.current = now;
                    setMetrics(m);
                }

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

                    // Distance/Z volume — only apply if skeleton agent will NOT handle volume
                    const lm = liveMappingsRef.current;
                    const isMasterVolumeMapped = Object.values(lm).some(map => (map.target === 'master' || map.target === 'base_track') && map.parameter === 'volume');

                    if (engineRef.current.masterTrackGain) {
                        const hasStems = engineRef.current.stemSources && engineRef.current.stemSources.length > 0;
                        let targetMasterGain = useMasterAudioRef.current ? (hasStems ? 0.4 : 1.0) : 0;
                        
                        // FOOLPROOF UX FIX:
                        // If they turned off the master track, but mapped its volume to their skeleton, 
                        // they intend for the skeleton to act as the gate. So we MUST unmute the source!
                        if (!useMasterAudioRef.current && isMasterVolumeMapped) {
                            targetMasterGain = hasStems ? 0.4 : 1.0;
                        }
                        
                        // Use direct assignment to prevent exponential curve reset bug when called every frame
                        engineRef.current.masterTrackGain.gain.value = targetMasterGain;
                    }

                    if (engineRef.current.autoGain) {
                        // Skip setting baseline if volume is explicitly mapped to prevent fighting with applyParam
                        if (!isMasterVolumeMapped) {
                            const targetVol = volFactor;
                            engineRef.current.autoGain.gain.setTargetAtTime(targetVol, now, 0.5); 
                        }
                    }

                    // --- SKELETON AGENT LOGIC ---
                    // Logica dinamica configurabile in WhoAgentConfigEditor

                    // Helper to get body parameter value and apply calibration
                    const getBodyVal = (part: BodyPart) => {
                        let val = 0.5;
                        switch(part) {
                            case 'leftHandY': val = m.leftHandY; break;
                            case 'rightHandY': val = m.rightHandY; break;
                            case 'leftHandX': val = m.leftHandX; break;
                            case 'rightHandX': val = m.rightHandX; break;
                            case 'z': val = m.z; break;
                            case 'leftHandZ': val = m.leftHandZ; break;
                            case 'rightHandZ': val = m.rightHandZ; break;
                            case 'headZ': val = m.headZ; break;
                            case 'headYaw': val = (m.yaw + 1) / 2; break; // Normalize -1..1 to 0..1
                            case 'headPitch': val = (m.pitch + 1) / 2; break;
                            case 'headRoll': val = m.headRoll; break;
                            case 'gazeX': val = m.gazeX; break;
                            case 'gazeY': val = m.gazeY; break;
                            case 'shoulderY': val = (m.leftShoulderY + m.rightShoulderY) / 2; break;
                            case 'shoulderTilt': val = m.shoulderTilt; break;
                            case 'elbowY': val = (m.leftElbowY + m.rightElbowY) / 2; break;
                            case 'kneeY': val = (m.leftKneeY + m.rightKneeY) / 2; break;
                            case 'footY': val = (m.leftFootY + m.rightFootY) / 2; break;
                            case 'torsoY': val = m.torsoY; break;
                            case 'torsoX': val = m.torsoX; break;
                            case 'armSpan': val = m.armSpan; break;
                            case 'handsY': val = (m.leftHandY + m.rightHandY) / 2; break;
                            default: val = 0.5; break;
                        }
                        return val || 0.5;
                    };


                    const applyParam = (param: AudioParameter, rawVal: number, gainNode?: GainNode, pannerNode?: StereoPannerNode, filterNode?: BiquadFilterNode, delayNode?: DelayNode, distNode?: WaveShaperNode) => {
                        const actx = engineRef.current!.audioCtx!;
                        const clampedVal = Math.max(0, Math.min(1, rawVal));
                        if (param === 'volume' && gainNode) {
                            // Full range 0..1.5 — not 1-rawVal which was limiting range
                            const vol = clampedVal * 1.5;
                            gainNode.gain.setTargetAtTime(vol, actx.currentTime, 0.08);
                        } else if (param === 'pan' && pannerNode) {
                            const pan = (clampedVal * 2) - 1; // 0..1 -> -1..1
                            pannerNode.pan.setTargetAtTime(pan, actx.currentTime, 0.08);
                        } else if (param === 'lowpass' && filterNode) {
                            // Full range: 0 = 150Hz (very muffled), 1 = 22000Hz (fully open)
                            const minFreq = 150;
                            const maxFreq = 22000;
                            const freq = minFreq * Math.pow(maxFreq / minFreq, clampedVal);
                            filterNode.frequency.setTargetAtTime(freq, actx.currentTime, 0.08);
                        } else if (param === 'pitch' && engineRef.current!.source) {
                            // Full range: 0 = 0.5x, 1 = 1.8x speed — clear difference
                            const pitch = 0.5 + (clampedVal * 1.3);
                        } else if (param === 'delay' && delayNode) {
                            // 0 to 0.8 seconds delay
                            const dTime = clampedVal * 0.8;
                            delayNode.delayTime.setTargetAtTime(dTime, actx.currentTime, 0.08);
                        } else if (param === 'distortion' && distNode) {
                            distNode.curve = makeDistortionCurve(clampedVal * 100);
                        }
                    };

                    const stems = stemsRef.current; // Always use ref, not closure
                    const eng = engineRef.current;

                    const lm = liveMappingsRef.current;
                    const isHandled = (target: string, param: AudioParameter) => {
                        return Object.values(lm).some(m => m.target === target && m.parameter === param);
                    };
                    const isGestureOverridden = (bodyPart: string) => {
                        return !!lm[bodyPart as BodyPart];
                    };

                    // ---- APPLY CUSTOM LIVE MAPPINGS ----
                    Object.entries(lm).forEach(([bodyPart, mapping]) => {
                        const rawVal = getBodyVal(bodyPart as BodyPart);
                        if (mapping.target === 'master') {
                            applyParam(mapping.parameter, rawVal, eng.autoGain || undefined, eng.panner || undefined, eng.filter || undefined, eng.masterDelay, eng.masterDistortion);
                        } else if (mapping.target === 'base_track') {
                            applyParam(mapping.parameter, rawVal, eng.masterTrackGain || undefined, eng.panner || undefined, undefined, undefined, undefined);
                        } else {
                            const stemIdx = stemsRef.current.findIndex(s => s.id === mapping.target);
                            if (stemIdx >= 0) {
                                applyParam(mapping.parameter, rawVal, eng.stemGains?.[stemIdx] || undefined, eng.stemPanners?.[stemIdx] || undefined, eng.stemFilters?.[stemIdx] || undefined, eng.stemDelays?.[stemIdx], eng.stemDistortions?.[stemIdx]);
                            }
                        }
                    });


                    // 4. STEM ENGINE MAPPING + 8D ORBIT
                    
                    if (eng.stemGains && eng.stemGains.length > 0) {
                        // ---- 8D ORBIT SYSTEM (SKELETON AGENT) ----
                        const orbitParams = eng.orbitParams!;
                        const primaryCategory = result.healthClassification?.primaryCategory?.category as HealthCategoryType;
                        
                        let baseRadius = 2.0;
                        let radiusMod = m.armSpan || 0.5;
                        let speedMod = 1.0;
                        
                        // WHO overrides for Orbit
                        if (primaryCategory === 'calming') {
                            baseRadius = 5.0; // Distante e avvolgente
                            speedMod = 0.3; // Molto lento
                        } else if (primaryCategory === 'motivation') {
                            baseRadius = 1.5; // Vicino e in the face
                            radiusMod = (m.energyLevel || 0) * 2.0; // L'energia allarga e stringe l'orbita
                            speedMod = 1.0 + (m.energyLevel || 0) * 3.0; // Veloce
                        } else if (primaryCategory === 'social_emotional') {
                            radiusMod = m.openness || 0.5; // Si apre se l'utente è aperto
                        }
                        
                        const targetRadius = baseRadius + (radiusMod * 5.0);
                        orbitParams.radius += (targetRadius - orbitParams.radius) * 0.05;
                        
                        // Calculate doppler/orbit step based on speedMod
                        const baseSpeedDegrees = 1.0;
                        const orbitStep = baseSpeedDegrees * speedMod;
                        
                        // Hands height → orbit elevation
                        const handsAvgY = (m.leftHandY + m.rightHandY) / 2;
                        const targetHeight = (0.5 - handsAvgY) * 4.0; // -2 .. +2  (hands up = positive Y)
                        orbitParams.height += (targetHeight - orbitParams.height) * 0.05;
                        
                        // Shoulder tilt → orbit rotation speed
                        const targetSpeed = 0.3 + Math.abs(m.shoulderTilt || 0) * 3.0; // 0.3..3.3 rev/s
                        orbitParams.speed += (targetSpeed - orbitParams.speed) * 0.02;
                        
                        // Rotate each stem along its orbit
                        const orbitAngles = eng.orbitAngles!;
                        
                        eng.stemGains.forEach((gainNode, index) => {
                            // Update phase
                            orbitAngles[index] = (orbitAngles[index] + orbitStep) % 360;
                            const rad = (orbitAngles[index] * Math.PI) / 180;
                            
                            // Update 3D position of this stem's panner
                            const panner3D = eng.stem3DPanners?.[index];
                            if (panner3D && ctx.currentTime) {
                                const t = ctx.currentTime;
                                panner3D.positionX.setTargetAtTime(Math.sin(rad) * orbitParams.radius, t, 0.05);
                                panner3D.positionY.setTargetAtTime(orbitParams.height, t, 0.1);
                                panner3D.positionZ.setTargetAtTime(Math.cos(rad) * orbitParams.radius, t, 0.05);
                            }
                            
                            // Apply body parameter to gain/filter
                            const filterNode = eng.stemFilters?.[index];
                            const primaryCatKey = result.healthClassification?.primaryCategory?.category as keyof WhoAgentConfig;
                            const catConfig = agentConfig && primaryCatKey && agentConfig[primaryCatKey] ? agentConfig[primaryCatKey] : null;
                            
                            let stemRule = stems.length > 0 ? stems[index] : null;
                            
                            // Fallback to agentConfig if no specific user mapping
                            if (!stemRule && catConfig?.stemMappings && catConfig.stemMappings.length > 0) {
                                const rule = catConfig.stemMappings.find(r => r.targetStemIndex === index) || catConfig.stemMappings[index % catConfig.stemMappings.length];
                                if (rule) {
                                    stemRule = {
                                        id: rule.id,
                                        name: 'Auto',
                                        url: '',
                                        assignedBodyPart: rule.bodyPart,
                                        parameter: rule.audioParam
                                    };
                                }
                            }
                            
                            if (stemRule && !isHandled(stemRule.id, stemRule.parameter) && !isGestureOverridden(stemRule.assignedBodyPart)) {
                                const rawVal = getBodyVal(stemRule.assignedBodyPart);
                                applyParam(stemRule.parameter, rawVal, gainNode, undefined, filterNode, eng.stemDelays?.[index], eng.stemDistortions?.[index]);
                            } else if (!stemRule) {
                                // Se non configurato e non gestito manualmente, volume fisso
                                if (!isHandled(stems[index]?.id || `stem_${index}`, 'volume')) {
                                    gainNode.gain.setTargetAtTime(1.0, ctx.currentTime, 0.1);
                                }
                            }
                        });
                        
                        // Head rotation → listener orientation (adds to 8D effect)
                        const headYaw = m.yaw || 0;
                        ctx.listener.forwardX.value = Math.sin(headYaw);
                        ctx.listener.forwardZ.value = -Math.cos(headYaw);
                        
                    } else {
                        // NO STEMS (Master Track) — always use agentConfig first, then configUsed fallback
                        let activeMappings: {bodyPart: BodyPart, parameter: AudioParameter}[] = [];
                        
                        // Priority 1: Live agentConfig (from WhoAgentConfigEditor / DEFAULT)
                        const primaryCatKey = result.healthClassification?.primaryCategory?.category as keyof WhoAgentConfig || 'calming';
                        const catConfig = agentConfig[primaryCatKey];
                        if (catConfig?.masterMappings && catConfig.masterMappings.length > 0) {
                            activeMappings = catConfig.masterMappings.map(r => ({
                                bodyPart: r.bodyPart,
                                parameter: r.audioParam
                            }));
                        } else if (result.configUsed?.masterMappings && result.configUsed.masterMappings.length > 0) {
                            // Priority 2: Old per-result config
                            activeMappings = result.configUsed.masterMappings as any;
                        }
                        
                        if (activeMappings.length > 0) {
                            activeMappings.forEach(mm => {
                                if (!isHandled('master', mm.parameter) && !isGestureOverridden(mm.bodyPart)) {
                                    const rawVal = getBodyVal(mm.bodyPart);
                                    applyParam(mm.parameter, rawVal, eng.autoGain || undefined, eng.panner || undefined, eng.filter || undefined, eng.masterDelay, eng.masterDistortion);
                                }
                            });
                        }
                        // Note: if no mappings found, baseline volume from distance-Z above is already applied
                    }

                } else {
                    // Auto Mode
                    const time = now * 0.4;
                    if (engineRef.current.panner) engineRef.current.panner.pan.value = Math.sin(time);
                    if (engineRef.current.filter) engineRef.current.filter.frequency.value = 15000 + Math.sin(time * 0.5) * 5000;
                }

                // --- VISUALS ---
                const w = canvas.width = stageRef.current ? stageRef.current.clientWidth : window.innerWidth;
                const h = canvas.height = stageRef.current ? stageRef.current.clientHeight : window.innerHeight;

                context.clearRect(0, 0, w, h);

                if (visualModeRef.current !== 'none' && videoRef.current && m.isActive) {
                    context.save();
                    context.globalAlpha = 0.15;
                    context.translate(w, 0);
                    context.scale(-1, 1);
                    context.drawImage(videoRef.current, 0, 0, w, h);
                    context.restore();
                }

                let camX = 0, camY = 0, camZ = -1.2;
                let tiltX = 0, tiltY = 0;
                const breath = Math.sin(now * 0.8) * 0.02;

                if (m.isActive) {
                    const targetCamX = (m.x - 0.5) * calibRef.current.moveXSensitivity;
                    const targetCamY = (m.y - 0.5) * calibRef.current.moveYSensitivity;
                    const relZ = m.z - calibRef.current.neutralZ;
                    const targetCamZ = -1.0 + (relZ * calibRef.current.zoomSensitivity * 2);
                    const targetTiltY = (m.x - 0.5) * calibRef.current.tiltSensitivity;
                    const targetTiltX = -(m.y - 0.5) * calibRef.current.tiltSensitivity;

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
                    bgImageRef.current.style.transform = `perspective(1000px) rotateX(${tiltX * 1.5}deg) rotateY(${tiltY * 1.5}deg) scale(1.0) translate3d(${-camX * 100}px, ${-camY * 100}px, ${cssZ}px)`;
                }

                // Draw Logic
                const cx = w / 2, cy = h / 2;
                const screenAspect = w / h;
                const imgAspect = engineRef.current.imageAspect;
                let renderW = screenAspect > imgAspect ? h * imgAspect : w;
                let renderH = screenAspect > imgAspect ? h : w / imgAspect;

                // --- CONSTELLATION ---
                const regionsList = result.regions;
                if (regionsList && regionsList.length > 0) {
                    let hoveredRegion: ColorRegion | null = null;
                    let minDist = Infinity;

                    regionsList.forEach(region => {
                        const baseX = (w - renderW) / 2 + (region.centroidX / 100) * renderW;
                        const baseY = (h - renderH) / 2 + (region.centroidY / 100) * renderH;
                        const parallaxX = baseX + (tiltY * 3);
                        const parallaxY = baseY - (tiltX * 3);

                        const lhX = cx + ((m.leftHandX || 0.5) - 0.5) * renderW;
                        const lhY = cy + ((m.leftHandY || 0.5) - 0.5) * renderH;
                        const rhX = cx + ((m.rightHandX || 0.5) - 0.5) * renderW;
                        const rhY = cy + ((m.rightHandY || 0.5) - 0.5) * renderH;
                        const dist = Math.min(Math.hypot(lhX - parallaxX, lhY - parallaxY), Math.hypot(rhX - parallaxX, rhY - parallaxY));

                        if (dist < 40 && dist < minDist) { minDist = dist; hoveredRegion = region; }

                        context.save();
                        context.beginPath();
                        context.arc(parallaxX, parallaxY, dist < 40 ? 6 : 3, 0, Math.PI * 2);
                        context.fillStyle = region.hex;
                        context.fill();
                        context.restore();
                    });

                    if (hoveredRegion !== null) {
                        const hr = hoveredRegion as ColorRegion;
                        if (now - synthDebounce.current > 0.3) {
                            synthDebounce.current = now;
                            playWhisperSynth(hr.frequencyHz, 0.6);
                        }
                    }
                }

                // --- DRAW VISUAL MODES ---
                if (visualModeRef.current === 'skeleton' && m.landmarks) {
                    context.save();
                    
                    // Base Neon Settings
                    context.lineCap = 'round';
                    context.lineJoin = 'round';
                    
                    const drawNeonLine = (p1: any, p2: any, color: string, glowColor: string, width: number) => {
                        if (!p1 || !p2) return;
                        context.shadowBlur = 15;
                        context.shadowColor = glowColor;
                        context.strokeStyle = color;
                        context.lineWidth = width;
                        context.beginPath();
                        context.moveTo(cx + (p1.x - 0.5) * renderW, cy + (p1.y - 0.5) * renderH);
                        context.lineTo(cx + (p2.x - 0.5) * renderW, cy + (p2.y - 0.5) * renderH);
                        context.stroke();
                        // Inner core
                        context.shadowBlur = 0;
                        context.strokeStyle = '#ffffff';
                        context.lineWidth = width * 0.4;
                        context.stroke();
                    };

                    const drawNeonPoint = (p: any, radius: number, color: string, glowColor: string) => {
                        if (!p) return;
                        context.shadowBlur = 15;
                        context.shadowColor = glowColor;
                        context.fillStyle = color;
                        context.beginPath();
                        context.arc(cx + (p.x - 0.5) * renderW, cy + (p.y - 0.5) * renderH, radius, 0, Math.PI * 2);
                        context.fill();
                        // Inner core
                        context.shadowBlur = 0;
                        context.fillStyle = '#ffffff';
                        context.beginPath();
                        context.arc(cx + (p.x - 0.5) * renderW, cy + (p.y - 0.5) * renderH, radius * 0.4, 0, Math.PI * 2);
                        context.fill();
                    };

                    const l = m.landmarks;

                    const primaryCat = result.healthClassification?.primaryCategory?.category as HealthCategoryType;
                    const skelConfig = primaryCat && WHO_CONFIGS[primaryCat] ? WHO_CONFIGS[primaryCat] : {
                        colors: {
                            torso: { color: '#d946ef', glow: '#c026d3' },
                            arms: { color: '#06b6d4', glow: '#0891b2' },
                            legs: { color: '#3b82f6', glow: '#2563eb' },
                            hands: { color: '#22d3ee', glow: '#06b6d4' },
                            face: { color: '#f59e0b', glow: '#d97706' },
                            mouth: { color: '#ef4444', glow: '#b91c1c' }
                        },
                        expression: 'neutral'
                    };

                    const c = skelConfig.colors;

                    // 1. Torso
                    const torso = [[11, 12], [11, 23], [12, 24], [23, 24]];
                    torso.forEach(([i, j]) => drawNeonLine(l[i], l[j], c.torso.color, c.torso.glow, 6));
                    
                    // 2. Arms
                    const arms = [[11, 13], [13, 15], [12, 14], [14, 16]];
                    arms.forEach(([i, j]) => drawNeonLine(l[i], l[j], c.arms.color, c.arms.glow, 5));
                    
                    // 3. Legs
                    const legs = [[23, 25], [25, 27], [27, 29], [29, 31], [31, 27], [24, 26], [26, 28], [28, 30], [30, 32], [32, 28]];
                    legs.forEach(([i, j]) => drawNeonLine(l[i], l[j], c.legs.color, c.legs.glow, 5));

                    // 4. Hands detail
                    const hands = [[15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20]];
                    hands.forEach(([i, j]) => drawNeonLine(l[i], l[j], c.hands.color, c.hands.glow, 3));

                    // 5. Face detail
                    // Face outline / structure
                    const face = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8]];
                    face.forEach(([i, j]) => drawNeonLine(l[i], l[j], c.face.color, c.face.glow, 3));
                    
                    // Eyebrows & Eyes based on expression
                    const leftEye = l[2];
                    const rightEye = l[5];
                    if (leftEye && rightEye) {
                        const leX = cx + (leftEye.x - 0.5) * renderW;
                        const leY = cy + (leftEye.y - 0.5) * renderH;
                        const reX = cx + (rightEye.x - 0.5) * renderW;
                        const reY = cy + (rightEye.y - 0.5) * renderH;
                        
                        context.shadowBlur = 10;
                        context.shadowColor = c.face.glow;
                        context.strokeStyle = c.face.color;
                        context.lineWidth = 3;
                        
                        // Eyebrows
                        let browOffset = 15;
                        let browCurve = 0;
                        if (skelConfig.expression === 'smile' || skelConfig.expression === 'soft_smile') {
                            browOffset = 20;
                            browCurve = -10; // arched up
                        } else if (skelConfig.expression === 'open') {
                            browOffset = 25;
                            browCurve = -15; // surprised, arched high
                        } else {
                            browOffset = 15;
                            browCurve = 0; // neutral flat
                        }
                        
                        // Left Brow
                        context.beginPath();
                        context.moveTo(leX - 10, leY - browOffset);
                        context.quadraticCurveTo(leX, leY - browOffset + browCurve, leX + 10, leY - browOffset);
                        context.stroke();
                        
                        // Right Brow
                        context.beginPath();
                        context.moveTo(reX - 10, reY - browOffset);
                        context.quadraticCurveTo(reX, reY - browOffset + browCurve, reX + 10, reY - browOffset);
                        context.stroke();
                        
                        // Eye Shapes (replacing dots if expression is specific)
                        if (skelConfig.expression === 'smile' || skelConfig.expression === 'soft_smile') {
                            // Happy eyes ^ ^
                            context.beginPath();
                            context.moveTo(leX - 8, leY);
                            context.quadraticCurveTo(leX, leY - 8, leX + 8, leY);
                            context.stroke();
                            
                            context.beginPath();
                            context.moveTo(reX - 8, reY);
                            context.quadraticCurveTo(reX, reY - 8, reX + 8, reY);
                            context.stroke();
                        } else if (skelConfig.expression === 'open') {
                            // Wide eyes O O
                            context.beginPath();
                            context.arc(leX, leY, 8, 0, Math.PI * 2);
                            context.stroke();
                            
                            context.beginPath();
                            context.arc(reX, reY, 8, 0, Math.PI * 2);
                            context.stroke();
                        }
                    }
                    
                    // Mouth with Expression
                    const mouthP1 = l[9];
                    const mouthP2 = l[10];
                    if (mouthP1 && mouthP2) {
                        const m1x = cx + (mouthP1.x - 0.5) * renderW;
                        const m1y = cy + (mouthP1.y - 0.5) * renderH;
                        const m2x = cx + (mouthP2.x - 0.5) * renderW;
                        const m2y = cy + (mouthP2.y - 0.5) * renderH;
                        
                        context.shadowBlur = 15;
                        context.shadowColor = c.mouth.glow;
                        context.strokeStyle = c.mouth.color;
                        context.lineWidth = 4;
                        context.beginPath();
                        
                        if (skelConfig.expression === 'neutral') {
                            context.moveTo(m1x, m1y);
                            context.lineTo(m2x, m2y);
                        } else {
                            const midX = (m1x + m2x) / 2;
                            const midY = (m1y + m2y) / 2;
                            let curveOffset = 0;
                            
                            if (skelConfig.expression === 'smile') curveOffset = 15;
                            else if (skelConfig.expression === 'soft_smile') curveOffset = 8;
                            else if (skelConfig.expression === 'open') curveOffset = 25; // more pronounced
                            
                            context.moveTo(m1x, m1y);
                            context.quadraticCurveTo(midX, midY + curveOffset, m2x, m2y);
                            
                            if (skelConfig.expression === 'open') {
                                // Draw lower part of open mouth
                                context.quadraticCurveTo(midX, midY + (curveOffset*1.8), m1x, m1y);
                            }
                        }
                        
                        context.stroke();
                        
                        // Inner core
                        context.shadowBlur = 0;
                        context.strokeStyle = '#ffffff';
                        context.lineWidth = 4 * 0.4;
                        context.stroke();
                    }
                    
                    // Draw joints
                    for (let i = 0; i < 33; i++) {
                        let color = c.torso.color;
                        let glow = c.torso.glow;
                        let size = 4;
                        
                        if (i >= 0 && i <= 10) { color = c.face.color; glow = c.face.glow; size = 3; } // Face
                        if (i >= 13 && i <= 22) { color = c.arms.color; glow = c.arms.glow; size = 5; } // Arms/Hands
                        if (i >= 25) { color = c.legs.color; glow = c.legs.glow; size = 5; } // Legs
                        
                        // Highlight Eyes and Nose
                        if (i === 0) size = 6; // Nose
                        if (i === 2 || i === 5) { 
                            if (skelConfig.expression === 'neutral') {
                                color = '#10b981'; glow = '#059669'; size = 6; 
                            } else {
                                size = 0; // Custom eyes are drawn above for non-neutral
                            }
                        }
                        
                        if (size > 0) drawNeonPoint(l[i], size, color, glow);
                    }
                    
                    context.restore();
                }

                if (visualModeRef.current === 'transparency' && m.landmarks) {
                    context.save();
                    context.globalAlpha = 0.8;
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
                        
                        context.save();
                        context.clip();
                        if (videoRef.current) {
                            context.translate(w, 0);
                            context.scale(-1, 1);
                            context.drawImage(videoRef.current, 0, 0, w, h);
                        }
                        context.restore();
                    }
                    
                    context.lineWidth = 80;
                    context.lineCap = 'round';
                    context.lineJoin = 'round';
                    context.strokeStyle = 'rgba(45, 212, 191, 0.4)';
                    
                    const arms = [[11, 13], [13, 15], [12, 14], [14, 16]];
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
            try {
                if (engineRef.current.source) {
                    engineRef.current.source.stop();
                    engineRef.current.source.disconnect();
                }
                if (engineRef.current.stemSources) {
                    engineRef.current.stemSources.forEach((s: AudioBufferSourceNode) => {
                        try { s.stop(); s.disconnect(); } catch (e) {}
                    });
                }
                engineRef.current.audioCtx?.close();
            } catch (e) { console.error(e); }
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
                {mode === 'fullscreen' && <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${visualMode === 'skeleton' ? 'opacity-0' : 'opacity-100'}`}><img src={result.standardizedImageUrl} className="w-full h-full object-cover filter blur-[40px] opacity-40 scale-110" /></div>}
                {/* 3D PLATFORM IMAGE */}
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-1 transition-opacity duration-500 ${visualMode === 'skeleton' ? 'opacity-0' : 'opacity-100'}`} style={{ perspective: '1500px', transformStyle: 'preserve-3d' }}>
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

                {/* WEBCAM PIP - Nascosto come richiesto (ma funzionante in background) */}
                <div className="absolute bottom-32 right-6 flex-col items-center gap-0 z-50 opacity-0 pointer-events-none hidden">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-cyan-500 shadow-lg bg-black relative">
                        <video ref={videoRef} className="w-full h-full object-cover mirror-mode opacity-100" autoPlay muted playsInline />
                        <canvas ref={faceLinkCanvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none" />
                    </div>
                </div>

                {/* SETTINGS TOGGLE (Nascosti in modalità trasparenza) */}
                {visualMode !== 'transparency' && (isKiosk ? (
                    <>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="absolute bottom-4 left-4 z-[9999] text-gray-800 hover:text-white opacity-20 hover:opacity-100 transition-all text-xl"
                        title="Impostazioni Kiosk"
                    >
                        *
                    </button>
                    </>
                ) : (
                    <>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="absolute top-24 left-6 z-[9999] text-gray-400 hover:text-white bg-black/50 p-3 rounded-full backdrop-blur transition-all border border-transparent hover:border-white/20"
                        title="Impostazioni"
                    >
                        <i className="fas fa-cog text-xl"></i>
                    </button>
                    </>
                ))}

                {/* LIVE SKELETON PANEL */}
                {visualMode !== 'transparency' && showSkeletonPanel && metrics && (
                    <div className="absolute top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 z-[10000] flex flex-col shadow-2xl overflow-y-auto">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-white font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                                    <i className="fas fa-person-running text-cyan-400"></i> Skeleton Live
                                </h2>
                                <p className="text-gray-500 text-[9px] mt-0.5">Parametri corpo in tempo reale</p>
                            </div>
                            <button onClick={() => setShowSkeletonPanel(false)} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>

                        {/* MASTER TRACK TOGGLE */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
                            <div>
                                <div className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <i className="fas fa-music text-cyan-400"></i> Traccia Master
                                </div>
                                <div className="text-[9px] text-gray-500 mt-0.5">Attiva o disattiva l'audio di base.</div>
                            </div>
                            <button
                                onClick={() => setUseMasterAudio(!useMasterAudio)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${useMasterAudio ? 'bg-cyan-500' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${useMasterAudio ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* WHO SKELETON AGENT GUIDELINES */}
                        {(() => {
                            const whoCategory = result.healthClassification?.primaryCategory || { category: 'calming', label: 'Calming (Default)' };
                            const primaryCatKey = whoCategory.category as keyof WhoAgentConfig;
                            
                            // If agentConfig is loaded and has this category, use it
                            if (agentConfig && agentConfig[primaryCatKey]) {
                                const catConfig = agentConfig[primaryCatKey];
                                return (
                                    <div className="mx-3 my-2 rounded-xl border p-3 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-cyan-500/30">
                                        <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-cyan-300">
                                            <i className="fas fa-robot"></i> Skeleton Agent — {whoCategory.label}
                                        </div>
                                        <p className="text-[8px] text-gray-300 leading-relaxed mb-2 italic">{catConfig.description}</p>
                                        
                                        <div className="space-y-0.5">
                                            {/* Render Master Mappings if no stems are active, else render stem mappings */}
                                            {(!engineRef.current?.stemGains || engineRef.current.stemGains.length === 0) ? (
                                                catConfig.masterMappings.map((mm, i) => (
                                                    <div key={`master-${i}`} className="flex items-center gap-1.5 text-[8px] text-gray-400">
                                                        <i className="fas fa-arrow-right text-[6px] opacity-50"></i>
                                                        <span className="text-cyan-400">{mm.bodyPart}</span> → {mm.audioParam}
                                                    </div>
                                                ))
                                            ) : (
                                                catConfig.stemMappings.slice(0, engineRef.current.stemGains.length).map((sm, i) => (
                                                    <div key={`stem-${i}`} className="flex items-center gap-1.5 text-[8px] text-gray-400">
                                                        <i className="fas fa-arrow-right text-[6px] opacity-50"></i>
                                                        Stem {(sm.targetStemIndex ?? i) + 1}: <span className="text-purple-400">{sm.bodyPart}</span> → {sm.audioParam}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            
                            // Fallback during loading or if no config
                            return (
                                <div className="mx-3 my-2 rounded-xl border p-3 bg-gradient-to-br from-gray-900/40 to-gray-800/40 border-gray-500/30">
                                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-gray-400">
                                        <i className="fas fa-spinner fa-spin"></i> Caricamento logica...
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Quick Mapping Editor - Inverted Paradigm Categorized */}
                        <div className="p-3 border-b border-white/5 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 shrink-0">
                            <div className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider mb-3">
                                <i className="fas fa-eye mr-1"></i> Rilevazioni Skeleton & Assegnazioni AI
                            </div>
                            <div className="space-y-4">
                                {OBSERVER_GESTURES_CATEGORIZED.map((category) => (
                                    <div key={category.title} className="space-y-2">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-1">
                                            <i className={`fas ${category.icon} text-gray-500`}></i> {category.title}
                                        </div>
                                        <div className="space-y-2">
                                            {category.items.map((gesture) => {
                                                // Get real-time value for the progress bar
                                                let rawVal = 0.5;
                                                if (metrics) {
                                                    switch(gesture.key) {
                                                        case 'leftHandY': rawVal = metrics.leftHandY; break;
                                                        case 'rightHandY': rawVal = metrics.rightHandY; break;
                                                        case 'leftHandX': rawVal = metrics.leftHandX; break;
                                                        case 'rightHandX': rawVal = metrics.rightHandX; break;
                                                        case 'z': rawVal = metrics.z; break;
                                                        case 'leftHandZ': rawVal = metrics.leftHandZ; break;
                                                        case 'rightHandZ': rawVal = metrics.rightHandZ; break;
                                                        case 'headZ': rawVal = metrics.headZ; break;
                                                        case 'headYaw': rawVal = (metrics.yaw + 1) / 2; break; // Normalize -1..1 to 0..1
                                                        case 'headPitch': rawVal = (metrics.pitch + 1) / 2; break;
                                                        case 'headRoll': rawVal = metrics.headRoll; break;
                                                        case 'gazeX': rawVal = metrics.gazeX; break;
                                                        case 'gazeY': rawVal = metrics.gazeY; break;
                                                        case 'shoulderY': rawVal = (metrics.leftShoulderY + metrics.rightShoulderY) / 2; break;
                                                        case 'shoulderTilt': rawVal = (metrics.shoulderTilt + 1) / 2; break;
                                                        case 'elbowY': rawVal = (metrics.leftElbowY + metrics.rightElbowY) / 2; break;
                                                        case 'kneeY': rawVal = (metrics.leftKneeY + metrics.rightKneeY) / 2; break;
                                                        case 'footY': rawVal = (metrics.leftFootY + metrics.rightFootY) / 2; break;
                                                        case 'torsoY': rawVal = metrics.torsoY; break;
                                                        case 'torsoX': rawVal = metrics.torsoX; break;
                                                        case 'armSpan': rawVal = metrics.armSpan; break;
                                                        case 'handsY': rawVal = (metrics.leftHandY + metrics.rightHandY) / 2; break;
                                                        case 'energyLevel': rawVal = metrics.energyLevel || 0; break;
                                                        case 'openness': rawVal = metrics.openness || 0.5; break;
                                                    }
                                                }
                                                const displayVal = Math.max(0, Math.min(1, rawVal));
                                                
                                                const currentMapping = liveMappings[gesture.key];

                                                return (
                                                    <div key={gesture.key} className={`p-2 rounded border ${currentMapping ? 'bg-cyan-900/20 border-cyan-500/30' : 'bg-black/40 border-white/5'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className={`text-[10px] font-bold truncate flex items-center gap-1.5 ${currentMapping ? 'text-cyan-300' : 'text-gray-400'}`} title={gesture.label}>
                                                                <i className={`fas ${gesture.icon}`}></i> {gesture.label}
                                                            </div>
                                                            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-75 ${currentMapping ? 'bg-cyan-400' : 'bg-gray-500'}`} style={{ width: `${displayVal * 100}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] text-gray-400 w-12">Target:</span>
                                                                <select
                                                                    value={currentMapping?.target || ''}
                                                                    onChange={(e) => {
                                                                        const newTarget = e.target.value;
                                                                        setLiveMappings(prev => {
                                                                            const updated = { ...prev };
                                                                            if (!newTarget) {
                                                                                updated[gesture.key] = {
                                                                                    target: '',
                                                                                    parameter: currentMapping?.parameter || 'volume'
                                                                                };
                                                                            } else {
                                                                                updated[gesture.key] = {
                                                                                    target: newTarget,
                                                                                    parameter: currentMapping?.parameter || 'volume'
                                                                                };
                                                                            }
                                                                            return updated;
                                                                        });
                                                                    }}
                                                                    className={`flex-1 border text-[9px] p-1 rounded outline-none ${currentMapping ? 'bg-cyan-950/50 border-cyan-500/50 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                                                >
                                                                    <option value="">-- Nessuno (Ignora) --</option>
                                                                    <option value="master">Mix Globale (Master Bus)</option>
                                                                    {localStems.length === 0 && (
                                                                        <optgroup label="Singolo Stem (Nessun multitraccia)">
                                                                            <option value="base_track">Traccia Base Unica</option>
                                                                        </optgroup>
                                                                    )}
                                                                    {localStems.length > 0 && (
                                                                        <optgroup label="Stem Individuali">
                                                                            {localStems.map((stem, i) => (
                                                                                <option key={stem.id} value={stem.id}>Stem {i+1}: {stem.name}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    )}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] text-gray-400 w-12">Effetto:</span>
                                                                <select
                                                                    value={currentMapping?.parameter || 'volume'}
                                                                    disabled={!currentMapping?.target}
                                                                    onChange={(e) => {
                                                                        if (!currentMapping?.target) return;
                                                                        setLiveMappings(prev => ({
                                                                            ...prev,
                                                                            [gesture.key]: {
                                                                                ...prev[gesture.key],
                                                                                parameter: e.target.value as AudioParameter
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className={`flex-1 text-[9px] p-1 rounded outline-none ${currentMapping?.target ? 'bg-cyan-950/50 border border-cyan-500/50 text-white' : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'}`}
                                                                >
                                                                    {Object.entries(AUDIO_PARAMS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Save Button */}
                            <div className="mt-4 pt-3 border-t border-white/10">
                                <button
                                    onClick={handleSaveMappings}
                                    className={`w-full py-2 rounded text-[10px] font-bold tracking-widest transition-all ${isSaving ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 border border-cyan-500/30'}`}
                                >
                                    {isSaving ? (
                                        <><i className="fas fa-check mr-2"></i> SALVATO</>
                                    ) : (
                                        <><i className="fas fa-save mr-2"></i> SALVA MAPPATURA LIVE</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 8D Orbit Status */}
                        {localStems.length > 0 && (
                            <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
                                <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <i className="fas fa-circle-notch fa-spin text-purple-300"></i> 8D Orbit Engine
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Raggio', icon: 'fa-expand-arrows-alt', val: Math.min(1, ((metrics.armSpan || 0.5) * 1.5)), color: 'bg-purple-500' },
                                        { label: 'Altezza', icon: 'fa-arrows-alt-v', val: Math.min(1, Math.abs(0.5 - ((metrics.leftHandY + metrics.rightHandY)/2)) * 2), color: 'bg-blue-500' },
                                        { label: 'Velocità', icon: 'fa-tachometer-alt', val: Math.min(1, Math.abs(metrics.shoulderTilt || 0) * 2), color: 'bg-indigo-500' },
                                    ].map(item => (
                                        <div key={item.label} className="text-center">
                                            <i className={`fas ${item.icon} text-[8px] text-gray-400 mb-1 block`}></i>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.color} rounded-full transition-all duration-100`} style={{ width: `${item.val * 100}%` }}></div>
                                            </div>
                                            <span className="text-[8px] text-gray-500 mt-0.5 block">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Body Parameters with Live Bars */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Parametri Corpo</div>
                            {([
                                { key: 'energyLevel', label: 'Energia Corpo', icon: 'fa-bolt', val: metrics.energyLevel || 0, color: 'bg-yellow-400' },
                                { key: 'openness', label: 'Apertura Postura', icon: 'fa-people-arrows', val: metrics.openness || 0.5, color: 'bg-indigo-400' },
                                { key: 'leftHandY', label: 'Mano SX (Alt.)', icon: 'fa-hand-point-left', val: metrics.leftHandY, color: 'bg-cyan-500' },
                                { key: 'rightHandY', label: 'Mano DX (Alt.)', icon: 'fa-hand-point-right', val: metrics.rightHandY, color: 'bg-pink-500' },
                                { key: 'leftHandX', label: 'Mano SX (X)', icon: 'fa-arrows-alt-h', val: metrics.leftHandX, color: 'bg-cyan-700' },
                                { key: 'rightHandX', label: 'Mano DX (X)', icon: 'fa-arrows-alt-h', val: metrics.rightHandX, color: 'bg-pink-700' },
                                { key: 'leftHandZ', label: 'Mano SX (Profond.)', icon: 'fa-compress-arrows-alt', val: metrics.leftHandZ, color: 'bg-cyan-300' },
                                { key: 'rightHandZ', label: 'Mano DX (Profond.)', icon: 'fa-compress-arrows-alt', val: metrics.rightHandZ, color: 'bg-pink-300' },
                                { key: 'armSpan', label: 'Apertura Braccia', icon: 'fa-expand-arrows-alt', val: metrics.armSpan, color: 'bg-yellow-500' },
                                { key: 'shoulderTilt', label: 'Inclinazione Spalle', icon: 'fa-balance-scale', val: (metrics.shoulderTilt + 1) / 2, color: 'bg-orange-500' },
                                { key: 'shoulderY', label: 'Spalle (Altezza)', icon: 'fa-arrows-alt-v', val: (metrics.leftShoulderY + metrics.rightShoulderY) / 2, color: 'bg-green-500' },
                                { key: 'elbowY', label: 'Gomiti (Altezza)', icon: 'fa-arrows-alt-v', val: (metrics.leftElbowY + metrics.rightElbowY) / 2, color: 'bg-teal-500' },
                                { key: 'headYaw', label: 'Testa (Rotazione Y)', icon: 'fa-head-side', val: (metrics.yaw + 1) / 2, color: 'bg-violet-500' },
                                { key: 'headPitch', label: 'Testa (Su/Giù)', icon: 'fa-head-side', val: (metrics.pitch + 1) / 2, color: 'bg-fuchsia-500' },
                                { key: 'headRoll', label: 'Testa (Inclinazione)', icon: 'fa-undo', val: metrics.headRoll, color: 'bg-rose-500' },
                                { key: 'gazeX', label: 'Sguardo (X)', icon: 'fa-eye', val: metrics.gazeX, color: 'bg-blue-300' },
                                { key: 'gazeY', label: 'Sguardo (Y)', icon: 'fa-eye', val: metrics.gazeY, color: 'bg-blue-400' },
                                { key: 'z', label: 'Distanza (Z)', icon: 'fa-compress-arrows-alt', val: metrics.z, color: 'bg-red-500' },
                                { key: 'torsoY', label: 'Busto (Altezza)', icon: 'fa-person', val: metrics.torsoY, color: 'bg-lime-500' },
                                { key: 'torsoX', label: 'Busto (Orizzontale)', icon: 'fa-arrows-alt-h', val: metrics.torsoX, color: 'bg-lime-600' },
                                { key: 'kneeY', label: 'Ginocchia', icon: 'fa-arrows-alt-v', val: (metrics.leftKneeY + metrics.rightKneeY) / 2, color: 'bg-amber-500' },
                            ] as { key: string, label: string, icon: string, val: number, color: string }[]).map(param => {
                                // Find which stems are mapped to this param
                                const mappedStems = localStems.filter(s => s.assignedBodyPart === param.key);
                                const displayVal = Math.max(0, Math.min(1, param.val || 0));
                                
                                return (
                                    <div key={param.key} className={`py-2 px-2 rounded-lg ${mappedStems.length > 0 ? 'bg-white/5 border border-white/10' : 'opacity-60'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-bold text-gray-300 flex items-center gap-1">
                                                <i className={`fas ${param.icon} text-[8px] text-gray-500`}></i>
                                                {param.label}
                                            </span>
                                            <span className="text-[9px] font-mono text-gray-400">{displayVal.toFixed(2)}</span>
                                        </div>
                                        {/* Live Bar */}
                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                                            <div
                                                className={`h-full ${param.color} rounded-full transition-all duration-75`}
                                                style={{ width: `${displayVal * 100}%` }}
                                            ></div>
                                        </div>
                                        {/* Mapped Stems */}
                                        {mappedStems.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {mappedStems.map(s => (
                                                    <span key={s.id} className="text-[8px] bg-purple-900/60 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={s.name}>
                                                        <i className="fas fa-music mr-1"></i>{s.name}
                                                        <span className="ml-1 opacity-60">→ {s.parameter}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Live Custom Mapping Controls */}
                                        <div className="mt-2 flex gap-1 items-center bg-black/40 p-1 rounded border border-white/10">
                                            <select 
                                                className="bg-transparent text-[8px] text-gray-300 outline-none flex-1 truncate uppercase"
                                                value={liveMappings[param.key]?.target || ''}
                                                onChange={(e) => {
                                                    const newTarget = e.target.value;
                                                    setLiveMappings(prev => {
                                                        const updated = { ...prev };
                                                        if (!newTarget) delete updated[param.key];
                                                        else {
                                                            updated[param.key] = {
                                                                target: newTarget as LiveMappingTarget,
                                                                parameter: prev[param.key]?.parameter || 'volume'
                                                            };
                                                        }
                                                        return updated;
                                                    });
                                                }}
                                            >
                                                <option value="" className="bg-gray-900 text-gray-500">-- Disabilitato --</option>
                                                <option value="master" className="bg-emerald-900 text-emerald-300">Mix Globale (Master)</option>
                                                {localStems.length === 0 && (
                                                    <option value="base_track" className="bg-purple-900 text-purple-300">Traccia Base Unica</option>
                                                )}
                                                {localStems.map(s => (
                                                    <option key={s.id} value={s.id} className="bg-purple-900 text-purple-300">Stem: {s.name}</option>
                                                ))}
                                            </select>
                                            
                                            {liveMappings[param.key] && (
                                                <select 
                                                    className="bg-transparent text-[8px] text-gray-300 outline-none flex-1 uppercase border-l border-white/10 pl-1 ml-1"
                                                    value={liveMappings[param.key].parameter}
                                                    onChange={(e) => {
                                                        setLiveMappings(prev => ({
                                                            ...prev,
                                                            [param.key]: {
                                                                ...prev[param.key],
                                                                parameter: e.target.value as AudioParameter
                                                            }
                                                        }));
                                                    }}
                                                >
                                                    <option value="volume" className="bg-gray-900">Volume</option>
                                                    <option value="pan" className="bg-gray-900">Pan Orizz.</option>
                                                    <option value="lowpass" className="bg-gray-900">Filtro</option>
                                                    <option value="pitch" className="bg-gray-900">Pitch/Vel</option>
                                                </select>
                                            )}
                                        </div>

                                        {/* Master Track Fallback Mappings (Visible only if not manually overridden) */}
                                        {!liveMappings[param.key] && (!engineRef.current?.stemGains || engineRef.current.stemGains.length === 0) && (() => {
                                            const cat = result.healthClassification?.primaryCategory?.category as keyof WhoAgentConfig || 'calming';
                                            const catConfig = agentConfig && agentConfig[cat];
                                            if (!catConfig) return null;
                                            
                                            // Find mapping for this body part
                                            let fallbackParams: string[] = [];
                                            
                                            if (result.configUsed?.masterMappings && result.configUsed.masterMappings.length > 0) {
                                                fallbackParams = result.configUsed.masterMappings.filter((m: any) => m.bodyPart === param.key).map((m: any) => m.parameter);
                                            } else if (catConfig.masterMappings) {
                                                fallbackParams = catConfig.masterMappings.filter(m => m.bodyPart === param.key).map(m => m.audioParam);
                                            }

                                            if (fallbackParams.length > 0) {
                                                return (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {fallbackParams.map((fp, idx) => (
                                                            <span key={idx} className="text-[8px] bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded truncate">
                                                                <i className="fas fa-layer-group mr-1"></i>Master Track
                                                                <span className="ml-1 opacity-60">→ {fp}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                );
                            })}
                        </div>

                        {/* AI Analyses Footer */}
                        {stemAnalyses.length > 0 && (
                            <div className="p-3 border-t border-white/5 shrink-0">
                                <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <i className="fas fa-robot"></i> AI Analisi Stem
                                </div>
                                <div className="space-y-1">
                                    {localStems.map((stem, i) => {
                                        const analysis = stemAnalyses[i];
                                        if (!analysis) return null;
                                        return (
                                            <div key={stem.id} className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                                                <span className="text-[9px] text-gray-300 truncate flex-1" title={stem.name}>{stem.name}</span>
                                                <span className="text-[8px] text-emerald-400 shrink-0">{analysis.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* CAMERA CONTROLS MOVED HERE */}
                        <div className="p-3 border-t border-white/5 bg-blue-900/10">
                            <label className="block text-[10px] font-bold text-blue-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <i className="fas fa-camera"></i> Camera Sensitivity
                            </label>
                            <div className="space-y-3">
                                <InputSlider label={t.zoom || 'Zoom (Prossimità)'} value={calibState.zoomSensitivity} max={2} onChange={(v) => updateCalib('zoomSensitivity', v)} color="text-blue-400" />
                                <InputSlider label={t.tilt || 'Inclinazione (Pitch)'} value={calibState.tiltSensitivity} max={100} step={1} onChange={(v) => updateCalib('tiltSensitivity', v)} color="text-gray-300" />
                                <InputSlider label={t.pan || 'Movimento Orizzontale'} value={calibState.panSensitivity} max={10} onChange={(v) => updateCalib('panSensitivity', v)} color="text-gray-300" />
                                <InputSlider label={t.dist || 'Sensibilità Distanza'} value={calibState.distAudio} max={2} onChange={(v) => updateCalib('distAudio', v)} color="text-blue-400" />
                                <InputSlider label={t.gazeX || 'Sguardo X (Pan)'} value={calibState.gazeAudioX} max={3} onChange={(v) => updateCalib('gazeAudioX', v)} color="text-cyan-400" />
                                <InputSlider label={t.gazeY || 'Sguardo Y (Tono)'} value={calibState.gazeAudioY} max={3} onChange={(v) => updateCalib('gazeAudioY', v)} color="text-cyan-200" />
                            </div>
                        </div>


                    </div>
                )}

                {/* BOTTOM AUDIO PLAYER (Always Visible during playback) */}
                {visualMode !== 'transparency' && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-black/80 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl">
                        <button 
                            onClick={togglePlayback} 
                            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] shrink-0"
                        >
                            <i className={`fas ${playbackState === 'playing' ? 'fa-pause' : 'fa-play'} text-xl ml-1`}></i>
                        </button>
                        <div className="flex flex-col shrink-0">
                            <span className="text-white font-bold text-sm tracking-wide">
                                {playbackState === 'playing' ? 'PERFORMANCE LIVE' : 'IN PAUSA'}
                            </span>
                            <span className="text-gray-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${playbackState === 'playing' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
                                Engine {playbackState}
                            </span>
                        </div>
                        
                        {/* SPECTRUM VISUALIZER IN BOTTOM BAR */}
                        <div className="h-10 w-64 ml-2 border-l border-white/10 pl-6 flex items-center">
                            <canvas ref={spectrumCanvasRef} width={200} height={40} className="w-full h-full opacity-80" />
                        </div>
                    </div>
                )}
                
                {/* SIDEBAR SETTINGS */}
                {visualMode !== 'transparency' && (
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

                            {/* Usa Melodia Principale */}
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-2">
                                            <i className="fas fa-music text-cyan-400"></i> Traccia Master
                                        </span>
                                        <span className="text-[10px] text-gray-500">Riproduci melodia principale o solo stems</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={useMasterAudio}
                                        onChange={(e) => setUseMasterAudio(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                                    />
                                </label>
                            </div>

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
                                    className={`w-full py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 mb-3
                                        ${isCalibrated ? 'bg-green-500 text-black' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                                >
                                    {isCalibrated ? <><i className="fas fa-check"></i> {t.calibSuccess}</> : <><i className="fas fa-crosshairs"></i> {t.calibInstr}</>}
                                </button>
                                
                                {/* SETUP SKELETON BUTTON */}
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false); // Close settings panel
                                        setShowSkeletonPanel(true); // Open skeleton panel
                                    }}
                                    className="w-full py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/50"
                                >
                                    <i className="fas fa-person-running"></i> SETUP SKELETON
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
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${visualMode as string === 'transparency' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    Transparent
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-white/10">
                        <button
                            onClick={async () => {
                                try {
                                    if (id) {
                                        await api.updateHistoryItemConfig(id, {
                                            ...calibState,
                                            useMasterAudio: useMasterAudio
                                        });
                                        alert(t.configSaved);
                                    }
                                } catch (e) { alert("Error: " + e); }
                            }}
                            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold tracking-widest uppercase transition-all"
                        >
                            {t.save}
                        </button>
                    </div>
                </div>
                )}
                
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
