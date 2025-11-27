


export type ProcessingStatus = 'pending' | 'active' | 'completed';

export type Paradigm = 'scientific' | 'artistic' | 'hybrid';

export type InstrumentType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// NEW: Enum for scan patterns for type safety
export enum ScanPattern {
  LINEAR = 'LINEAR',
  INWARD_BOX_CLOCKWISE = 'INWARD_BOX_CLOCKWISE',
  INWARD_BOX_COUNTER_CLOCKWISE = 'INWARD_BOX_COUNTER_CLOCKWISE',
  BOUSTROPHEDON_LTR = 'BOUSTROPHEDON_LTR',
  BOUSTROPHEDON_RTL = 'BOUSTROPHEDON_RTL',
  SCANLINES_VERTICAL = 'SCANLINES_VERTICAL',
}

// NEW: Type for user override
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
  noteDurationSeconds: number; // Duration of each note in seconds
  osc: OscSettings;
  // New settings for artistic arrangement
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
        // Range 0-1 for each
        dynamics: number; // 0=static, 1=dynamic
        complexity: number; // 0=simple, 1=complex
        modernity: number; // 0=acoustic, 1=electronic
    };
}

export interface MusicGenerationPrompt {
    main_prompt_ita: string; // Kept for backward compatibility/display
    technical_parameters: string;
    justification: string;
    // Stability AI specific fields
    stability_prompt: string; // Descriptive prompt for Stable Audio
    negative_prompt: string; // Elements to avoid
}


export interface Tradition {
  id: number | string;
  name: string;
  cultural_family: string;
  region: string;
  description: string;
  character: string;
  // --- New fields for cultural transformation ---
  scale_cents: number[];
  // Scoring profile for cultural selection
  profile: {
    // 0-1 range for each
    color_temp: number; // 0=warm, 1=cool
    saturation: number; // 0=low, 1=high
    hue_diversity: number; // 0=focused, 1=diverse
  };
  timing_profile?: {
    rubato?: number; // e.g., 0.1 for 10% variation
    swing?: number; // e.g., 1.2 for a swing factor
  };
}

export interface BlockData {
  r: number;
  g: number;
  b: number;
  position: { x: number; y: number; };
  // More detailed analysis
  hsv: { h: number; s: number; v: number };
  lab: { l: number; a: number; b: number };
  variance: number;
  isFiller?: boolean;
}


export interface UniversalMapping {
  baseNote: number; // 0-11
  noteName: string; // C, D, E...
  confidence: number;
  mappingType: 'hue' | 'luminosity' | 'fallback';
  microtoneOffset: number; // in cents, [-50, 50]
}

export interface MappedBlock {
  blockData: BlockData;
  mapping: UniversalMapping;
}

export interface TransformedNoteEvent {
  time: number; // in seconds from start
  duration: number; // in seconds
  
  // Note info
  baseNote: number; // original 0-11
  transformedCents: number; // microtonal note in cents
  midiFloat: number;
  noteName: string;
  
  // Dynamics
  velocity: number; // 1-127
  expression: number; // 0-1 for CC (from L*)
  chroma: number; // 0-1 for timbre richness (from C*)
  articulation: 'staccato' | 'normal' | 'legato';

  // For visualization
  sourceBlock: BlockData;

  // For arrangement
  isAccompaniment?: boolean;
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
    audioUrl: string; // Blob URL for WAV
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

// Hashes of actual file artifacts for verification
export interface ValidationHashes {
    imageBlobHash: string;
    audioBlobHash: string;
    midiBlobHash: string;
}

export interface SonificationResult {
    imageHash: string; // Semantic hash
    audioHash: string; // Semantic hash (usually same as wav blob hash but kept for logic)
    configUsed: ConfigSettings;
    standardizedImageUrl: string;
    
    // Phase results
    blockAnalysisResult: BlockAnalysisResult;
    culturalSelectionResult: CulturalSelectionResult;
    audioOutput: AudioOutputResult;
    scanPattern: ScanPatternData;

    // SAC file
    sacContainer: SacContainer;
    
    // Metadata
    validationResult: ValidationResult;
    performanceMetrics: PerformanceMetrics;
    
    // NEW: Physical file hashes for verification
    validationHashes: ValidationHashes;

    // Artistic mode data
    musicGenerationPrompt?: MusicGenerationPrompt | null;
    
    // Generated AI Track (Optional)
    generatedAiTrackUrl?: string | null;

    // NEW: Generated Video Blob (if available in SAC)
    generatedVideoBlob?: Blob;
}

// --- New types for SAC verification ---
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
}

export interface SacVerificationResult {
    isValid: boolean;
    details: SacVerificationDetails;
    manifestData: ManifestData;
    // Extracted Media for Playback
    extractedVideoBlob?: Blob;
    extractedAudioBlob?: Blob;
}

// --- New type for User Dashboard History ---
export interface DashboardEntry {
    id: string; // imageHash
    timestamp: string;
    imageUrl: string; // The blob URL of the standardized image
    paradigm: Paradigm;
    traditionName: string;
    // New field for single file verification
    audioHash?: string; 
    // NEW: Store all file hashes for verification
    validationHashes?: ValidationHashes;
}

// --- New Type for MusicGen Response ---
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
    registeredAt: string;
    lastLogin?: string;
    credits: number; // NEW: Credit system
}

export interface SystemStats {
    totalUsers: number;
    activeUsers24h: number;
    totalSonifications: number;
    serverHealth: {
        cpu: number;
        memory: number;
        uptime: string;
    };
    apiStatus: {
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
    ownerId?: string; // Optional link to user
    description: string;
    imageUrl: string;
    paradigm: 'scientific' | 'artistic' | 'hybrid' | string;
    tradition: string;
    tags: string[];
    stats: {
        duration: string;
        notes: number;
    };
    isPublic?: boolean;
    audioUrl?: string; // NEW: URL to full audio file (for showcase playback)
    videoUrl?: string; // NEW: URL to video file (for showcase playback)
}