export type ProcessingStatus = 'pending' | 'active' | 'completed';

export type Paradigm = 'scientific' | 'artistic' | 'hybrid';

export type InstrumentType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export enum ScanPattern {
    LINEAR = 'LINEAR',
    INWARD_BOX_CLOCKWISE = 'INWARD_BOX_CLOCKWISE',
    INWARD_BOX_COUNTER_CLOCKWISE = 'INWARD_BOX_COUNTER_CLOCKWISE',
    BOUSTROPHEDON_LTR = 'BOUSTROPHEDON_LTR',
    BOUSTROPHEDON_RTL = 'BOUSTROPHEDON_RTL',
    SCANLINES_VERTICAL = 'SCANLINES_VERTICAL',
}

export type ScanPatternOverride = ScanPattern | 'auto';


export interface ProcessingStep {
    id: number;
    name: string;
    status: ProcessingStatus;
}

export interface OscSettings {
    enabled: boolean;
    host: string;
    port: number;
}

export interface ConfigSettings {
    pixelCount: number;
    bpm: number;
    noteDurationSeconds: number;
    osc: OscSettings;
    enableAccompaniment: boolean;
    melodyInstrument: InstrumentType;
    accompanimentInstrument: InstrumentType;
}

export interface MusicalGenre {
    id: number;
    name: string;
    cultural_family: string;
    description: string;
    profile: {
        dynamics: number;
        complexity: number;
        modernity: number;
    };
}

export interface MusicGenerationPrompt {
    main_prompt_ita: string;
    technical_parameters: string;
    justification: string;
    suno_prompt: string;      // Ottimizzato per Suno (Meta Tags)
    udio_prompt: string;      // Ottimizzato per Udio (Tags descrittivi)
    negative_prompt: string;
    suno_lyrics: string;      // NEW: Marcatori temporali per sincronizzazione
}


export interface Tradition {
    id: number | string;
    name: string;
    cultural_family: string;
    region: string;
    description: string;
    character: string;
    scale_cents: number[];
    baseFrequency: number; // Added
    profile: {
        color_temp: number;
        saturation: number;
        hue_diversity: number;
    };
    timing_profile?: {
        rubato?: number;
        swing?: number;
    };
}

export interface BlockData {
    r: number;
    g: number;
    b: number;
    position: { x: number; y: number; };
    hsv: { h: number; s: number; v: number };
    lab: { l: number; a: number; b: number };
    variance: number;
    isFiller?: boolean;
}


export interface UniversalMapping {
    baseNote: number;
    noteName: string;
    confidence: number;
    mappingType: 'hue' | 'luminosity' | 'fallback';
    microtoneOffset: number;
}

export interface MappedBlock {
    blockData: BlockData;
    mapping: UniversalMapping;
}

export interface TransformedNoteEvent {
    time: number;
    duration: number;
    baseNote: number;
    transformedCents: number;
    midiFloat: number;
    noteName: string;
    velocity: number;
    expression: number;
    chroma: number;
    articulation: 'staccato' | 'normal' | 'legato';
    sourceBlock: BlockData;
    isAccompaniment?: boolean;
    // Legacy support
    sourceBlockIndex?: number;
}


export interface BlockAnalysisResult {
    blocks: BlockData[];
    totalPixelsAnalyzed: number;
    coveragePercentage: number;
    analysisMethod: string;
    gridSize: number;
    blockSize: number;
    globalStats: {
        avg_L: number;
        avg_a: number;
        avg_b: number;
        avg_saturation: number;
        hue_diversity: number;
        avg_variance: number;
    }
}

export interface ScoreBreakdown {
    colorTemperature: number;
    saturation: number;
    hueDiversity: number;
    total: number;
}

export interface CulturalSelectionResult {
    tradition: Tradition;
    scoreBreakdown: ScoreBreakdown;
}

export interface AudioOutputResult {
    events: TransformedNoteEvent[];
    eventsCount: number;
    duration: number;
    bpm: number;
    audioUrl: string;
    audioWavBlob: Blob;
    midiBlob: Blob;
}

export interface ValidationResult {
    determinism: { passed: boolean; message: string; };
    coverage: { passed: boolean; message: string; };
    robustness: { passed: boolean; message: string; };
    grid: { passed: boolean; message: string; };
}

export interface PerformanceMetrics {
    totalProcessingTime: number;
    [key: string]: number;
}

export interface SacContainer {
    blob: Blob;
    fileName: string;
}

export interface ScanPatternData {
    name: string;
    sequence: number[];
}

export interface ValidationHashes {
    imageBlobHash: string;
    audioBlobHash: string;
    midiBlobHash: string;
}

export interface AcquisitionMetadata {
    method: 'camera' | 'upload' | 'restored';
    offsets?: {
        exposure: number;
        whiteBalance: number;
        contrast: number;
        stability: number;
        focus: number;
    };
    timestamp: string;
}

export interface SonificationResult {
    imageHash: string;
    audioHash: string;
    configUsed: ConfigSettings;
    standardizedImageUrl: string;
    paradigm: Paradigm;

    blockAnalysisResult: BlockAnalysisResult;
    culturalSelectionResult: CulturalSelectionResult;
    audioOutput: AudioOutputResult;
    scanPattern: ScanPatternData;

    sacContainer: SacContainer;

    validationResult: ValidationResult;
    performanceMetrics: PerformanceMetrics;

    validationHashes: ValidationHashes;
    normalizationReport?: any | null;  // Import from imageNormalizationService
    musicGenerationPrompt?: MusicGenerationPrompt | null;
    generatedVideoBlob?: Blob;
    acquisitionMetadata?: AcquisitionMetadata;
    title?: string | null;
    description?: string | null;
}

export interface SacVerificationDetails {
    [filename: string]: {
        expected: string;
        actual: string;
        match: boolean;
    }
}

export interface ManifestData {
    container_version: string;
    created_at: string;
    framework_version: string;
    file_hashes: { [key: string]: { sha256: string, size_bytes: number } };
    // Legacy support
    sac_hash?: string;
    hash?: string;
    id?: string;
    signature?: string;
}

export interface SacVerificationResult {
    isValid: boolean;
    details: SacVerificationDetails;
    manifestData: ManifestData;
    extractedVideoBlob?: Blob;
    extractedAudioBlob?: Blob;
}

export interface DashboardEntry {
    id: string;
    timestamp: string;
    imageUrl: string;
    paradigm: Paradigm;
    traditionName: string;
    audioHash?: string;
    audioUrl?: string | null;
    validationHashes?: ValidationHashes;
    musicGenerationPrompt?: MusicGenerationPrompt | null;
    // Extended fields from backend
    configUsed?: ConfigSettings;
    events?: any[]; // Compressed format from backend
    blockData?: BlockAnalysisResult;
    imageHash?: string;
    videoUrl?: string | null;
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    acquisitionMetadata?: AcquisitionMetadata;
}

export interface MusicGenResponse {
    audioUrl: string;
    status: 'succeeded' | 'failed' | 'processing';
    error?: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    isPro: boolean;
    isAdmin: boolean;
    token?: string;
    avatarUrl?: string;
    customLogoUrl?: string;
    tier?: 'free' | 'pro' | 'custom';
    registeredAt: string;
    lastLogin?: string;
    credits: number;
}

export interface SystemStats {
    totalUsers: number;
    totalSonifications: number;
    aiUsage?: { hybrid: number; artistic: number; scientific: number };
    phpVersion?: string;
    dbVersion?: string;
    serverOs?: string;
    activeUsers24h?: number;
    serverHealth?: { cpu: number; memory: number; uptime: string; };
    apiStatus?: {
        gemini: { serviceName: string; used: number; limit: number; unit: string; costEstimated: number };
        storage: { serviceName: string; used: number; limit: number; unit: string; costEstimated: number };
        paddle: { serviceName: string; used: number; limit: number; unit: string; costEstimated: number };
    };
}

export interface SystemLog {
    id: number;
    timestamp: string;
    action: string;
    details: string;
    level: 'info' | 'warning' | 'error' | 'success';
    user: string;
}

export interface ShowcaseProject {
    id: string;
    title: string;
    date: string;
    author: string;
    ownerId?: string;
    description: string;
    imageUrl: string;
    paradigm: 'scientific' | 'artistic' | 'hybrid' | string;
    tradition: string;
    tags: string[];
    stats: { duration: string; notes: number; };
    isPublic?: boolean;
    audioUrl?: string;
    videoUrl?: string;
    historyId?: string;
    priority?: number;
    isFeatured?: boolean;
    imageHash?: string;
    blockData?: BlockAnalysisResult;
}

// --- DEFINIZIONE SPOSTATA QUI PER EVITARE DIPENDENZE CIRCOLARI ---
export type ViewType = 'landing' | 'sonification' | 'verification' | 'dashboard' | 'showcase' | 'admin' | 'profile';
