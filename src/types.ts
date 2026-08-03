export type ProcessingStatus = 'pending' | 'active' | 'completed';

export type Paradigm = 'scientific' | 'artistic' | 'hybrid' | 'ai_composer';

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
    targetDurationSeconds?: number;
    osc: OscSettings;
    enableAccompaniment: boolean;
    melodyInstrument: InstrumentType;
    accompanimentInstrument: InstrumentType;
    useHealthAgent?: boolean;
    healthEnrichment?: string;
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

export interface SemanticHotspot {
    id: string;
    label: string;
    category: 'emotions' | 'materials' | 'style' | 'who_target';
    x_percent: number;
    y_percent: number;
    description: string;
    reasoning_step: string;
    acoustic_effect: string;
}

export interface SemanticAnalysis {
    facial_expressions: string;
    materials_objects: string[];
    natural_elements: string;
    pictorial_style: string;
    acoustic_impact: string;
    hotspots?: SemanticHotspot[];
}

export interface MusicGenerationPrompt {
    main_prompt_ita: string;
    technical_parameters: string;
    justification: string;
    suno_prompt: string;      // Ottimizzato per Suno (Meta Tags)
    udio_prompt: string;      // Ottimizzato per Udio (Tags descrittivi)
    soundverse_prompt?: string; // Ottimizzato per Soundverse AI (Parametrizzazione strutturata)
    negative_prompt: string;
    suno_lyrics: string;      // Marcatori temporali per sincronizzazione
    semantic_analysis?: SemanticAnalysis | null;
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
    originalArchivedUrl?: string; // NEW: keep track of the file in DB if we override with synth
    customAudioUrl?: string; // NEW: keep track of the custom/elaborated audio (MP3)
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

// Original file metadata for forensic verification
export interface OriginalFileMetadata {
    hash: string;           // SHA-256 of the original untouched file
    size: number;           // Size in bytes
    name: string;           // Original filename
    dimensions: { width: number; height: number };  // Original dimensions
    type: string;           // MIME type (e.g., "image/jpeg")
    originalBlob?: Blob;    // The original file as a Blob (for creating forensic packages)
}

// --- WHO HEALTH CATEGORY CLASSIFICATION ---
export type HealthCategoryType = 'calming' | 'physiological' | 'cognitive_motor' | 'social_emotional' | 'motivation';

export interface HealthCategoryScore {
    category: HealthCategoryType;
    score: number;          // 0.0 - 1.0
    label: string;          // Human-readable label (IT)
    targetBpm: number;      // Clinical WHO target BPM for this category
    whoDirective: string;   // Specific WHO directive to inject into prompt
    visualReason: string;   // Why this category was selected based on visual analysis
}

export interface HealthClassificationResult {
    primaryCategory: HealthCategoryScore;
    activeCategories: HealthCategoryScore[];  // score > threshold
    allScores: HealthCategoryScore[];
    promptFragment: string;  // Ready-to-use prompt text for Gemini with only relevant directives
}

export interface SonificationResult {
    imageHash: string;
    audioHash: string;
    configUsed: ConfigSettings;
    standardizedImageUrl: string;
    paradigm: Paradigm;

    // NEW: Original file metadata for forensic package
    originalFileMetadata?: OriginalFileMetadata;

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
    videoUrl?: string | null;
    healthClassification?: HealthClassificationResult | null;
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
    audioUrl?: string | null;  // Custom/Elaborated audio (Suno, Udio, etc.) - MODIFIABLE
    originalAudioUrl?: string | null; // Sonification audio from SAC - IMMUTABLE
    validationHashes?: ValidationHashes;
    musicGenerationPrompt?: MusicGenerationPrompt | null;
    // Extended fields from backend
    ownerId?: string; // Added for filtering
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
    creditsConsumed?: number;
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
    isHome?: boolean;
    imageHash?: string;
    blockData?: BlockAnalysisResult;
}

// --- DEFINIZIONE SPOSTATA QUI PER EVITARE DIPENDENZE CIRCOLARI ---
export type ViewType = 'landing' | 'sonification' | 'verification' | 'dashboard' | 'showcase' | 'admin' | 'profile';
