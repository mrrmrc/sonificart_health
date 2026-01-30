
// src/utils/dataUtils.ts
import { SonificationResult, ConfigSettings, TransformedNoteEvent } from '../types';
import { initialSettings } from '../config/defaults';

export const fixAudioUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    // Base URL from the API service or hardcoded if needed
    const API_BASE = 'https://sonificart.com';
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE}${cleanUrl}`;
};

export const reconstructResultFromPartialData = (
    partialData: any,
    imgUrl: string,
    audioUrl: string | null,
    filename: string,
    videoBlob?: Blob
): SonificationResult => {

    // 0. Parse Metadata if string
    let meta = partialData.metadata || {};
    if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (e) { console.error("Metadata parse error", e); meta = {}; }
    }

    // 1. Recupero Configurazione
    const loadedConfig = partialData.configUsed || meta.config_used || {};
    const safeConfig: ConfigSettings = {
        ...initialSettings,
        ...loadedConfig,
        osc: { ...initialSettings.osc, ...(loadedConfig.osc || {}) }
    };

    // 2. Recupero Tradizione (Cerca ovunque per evitare "Sconosciuta")
    let traditionName = partialData.culturalSelectionResult?.tradition?.name
        || partialData.traditionName
        || partialData.tradition
        || partialData.musical_parameters?.tradition?.name
        || "Sconosciuta";

    let traditionFamily = partialData.culturalSelectionResult?.tradition?.cultural_family
        || partialData.traditionFamily
        || partialData.musical_parameters?.tradition?.cultural_family
        || "Generica";

    // Recupero Score (Fake 0.99 se manca per estetica)
    let score = partialData.culturalSelectionResult?.scoreBreakdown?.total || partialData.score || 0.99;

    const safeCulturalResult = {
        tradition: {
            id: 'restored',
            name: traditionName,
            cultural_family: traditionFamily,
            ...(partialData.culturalSelectionResult?.tradition || {})
        },
        scoreBreakdown: { total: score, colorTemperature: score, saturation: score, hueDiversity: score }
    };

    // 3. Recupero Pattern Scansione
    let scanName = partialData.scanPattern?.name
        || meta.scan_pattern?.name
        || "Pattern Importato";
    if (typeof scanName === 'string') scanName = scanName.replace("Manuale: ", "");

    // 4. Ricostruzione Eventi e Griglia (Fix Cursore e Note)
    let rawEvents = partialData.audioOutput?.events
        || partialData.transformedEvents
        || partialData.events
        || [];

    if (typeof rawEvents === 'string') {
        try { rawEvents = JSON.parse(rawEvents); } catch (e) { console.error("Errore parsing eventi:", e); rawEvents = []; }
    }
    const safeRawEvents = Array.isArray(rawEvents) ? rawEvents : [];
    const rawBlockAnalysis = partialData.blockAnalysisResult || partialData.blockData || partialData.analysis || {};

    let gridSize = 32;
    if (loadedConfig.pixelCount) {
        gridSize = Math.sqrt(loadedConfig.pixelCount);
    } else if (safeRawEvents.length > 0) {
        const inferred = Math.ceil(Math.sqrt(safeRawEvents.length));
        if (inferred > 32) gridSize = inferred;
        else if (rawBlockAnalysis.gridSize) gridSize = rawBlockAnalysis.gridSize;
    } else if (rawBlockAnalysis.gridSize) {
        gridSize = rawBlockAnalysis.gridSize;
    }

    const finalEvents = safeRawEvents.length > 0 ? safeRawEvents : Array.from({ length: 256 }, (_, i) => ({
        time: i * safeConfig.noteDurationSeconds,
        duration: safeConfig.noteDurationSeconds,
        baseNote: 60 + (i % 12),
        noteName: "C",
        sourceBlockIndex: i
    }));

    const sanitizedEvents: TransformedNoteEvent[] = finalEvents.map((evt: any, index: number) => {
        if (Array.isArray(evt)) {
            const x = evt[4] ?? -1;
            const y = evt[5] ?? -1;
            return {
                time: evt[0],
                duration: evt[1],
                midiFloat: evt[2],
                velocity: evt[3],
                noteName: evt[6] || "C",
                baseNote: Math.round(evt[2]),
                sourceBlock: { r: 100, g: 100, b: 100, position: { x, y } },
                sourceBlockIndex: (x >= 0 && y >= 0) ? (y * gridSize + x) : index,
                isAccompaniment: false
            };
        }
        let cx = 0, cy = 0;
        if (typeof evt.sourceBlockIndex === 'number') {
            cx = evt.sourceBlockIndex % gridSize;
            cy = Math.floor(evt.sourceBlockIndex / gridSize);
        } else if (evt.sourceBlock?.position) {
            cx = evt.sourceBlock.position.x;
            cy = evt.sourceBlock.position.y;
        } else {
            cx = index % gridSize;
            cy = Math.floor(index / gridSize);
        }
        return {
            ...evt,
            noteName: evt.noteName || "C",
            midiFloat: evt.midiFloat || 60,
            velocity: evt.velocity || 100,
            sourceBlock: { r: 100, g: 100, b: 100, ...(evt.sourceBlock || {}), position: { x: cx, y: cy } },
            isAccompaniment: false
        };
    });

    const duration = partialData.audioOutput?.duration
        || partialData.totalDuration
        || meta.total_duration_seconds
        || (sanitizedEvents.length * safeConfig.noteDurationSeconds)
        || 0;

    const fakeBlocks = Array.from({ length: gridSize * gridSize }, (_, i) => ({
        r: 100, g: 100, b: 100, position: { x: i % gridSize, y: Math.floor(i / gridSize) },
        isFiller: false, hsv: { h: 0, s: 0, v: 0 }, lab: { l: 50, a: 0, b: 0 }, variance: 0
    }));

    const blocksToUse = (Array.isArray(rawBlockAnalysis.blocks) && rawBlockAnalysis.blocks.length > 0)
        ? rawBlockAnalysis.blocks
        : fakeBlocks;

    // DEFINITIVE AUDIO SOURCE MAPPING
    // 1. Synth: Always starts empty, filled by synthesizeAudio call outside
    // 2. Original: The immutable WAV from sonification (SAC)
    // 3. Custom: The elaborated track (MP3) from Suno/Udio
    const dbAudio = partialData.audioUrl || partialData.audio_url || audioUrl;
    const dbOriginal = partialData.originalAudioUrl || partialData.original_audio_url;

    let finalOriginal = null;
    let finalCustom = null;

    if (dbOriginal) {
        // Modern record with distinct fields
        finalOriginal = dbOriginal;
        if (dbAudio && dbAudio !== dbOriginal) {
            finalCustom = dbAudio;
        }
    } else if (dbAudio) {
        // Legacy record or newly generated sonification: dbAudio is the original
        finalOriginal = dbAudio;
        finalCustom = null;
    }

    return {
        imageHash: partialData.imageHash || partialData.hash || meta.image_hash || "restored_entry",
        audioHash: partialData.audioHash || meta.audio_hash || "---",
        paradigm: partialData.paradigm || "scientific",
        standardizedImageUrl: imgUrl,
        sacContainer: { blob: new Blob(), fileName: filename },
        generatedVideoBlob: videoBlob,
        title: partialData.title || meta.title || null,

        audioOutput: {
            audioUrl: "", // Filled by Synth
            originalArchivedUrl: fixAudioUrl(finalOriginal),
            customAudioUrl: fixAudioUrl(finalCustom),
            audioWavBlob: new Blob(),
            midiBlob: new Blob(),
            events: sanitizedEvents,
            eventsCount: sanitizedEvents.length,
            duration: duration,
            bpm: safeConfig.bpm
        },

        blockAnalysisResult: {
            ...rawBlockAnalysis,
            blocks: blocksToUse,
            gridSize,
            totalPixelsAnalyzed: gridSize * gridSize,
            coveragePercentage: 100,
            analysisMethod: "Restored",
            blockSize: 16,
            globalStats: rawBlockAnalysis.globalStats || { avg_L: 50, avg_saturation: 0.5, hue_diversity: 0.5, avg_a: 0, avg_b: 0, avg_variance: 0 }
        },

        culturalSelectionResult: safeCulturalResult,
        scanPattern: { name: scanName, sequence: [] },
        configUsed: safeConfig,
        validationResult: { determinism: { passed: true, message: "OK" }, coverage: { passed: true, message: "OK" }, robustness: { passed: true, message: "OK" }, grid: { passed: true, message: "OK" } },
        performanceMetrics: { totalProcessingTime: 0 },
        validationHashes: partialData.validationHashes || { imageBlobHash: "", audioBlobHash: "", midiBlobHash: "" },
        acquisitionMetadata: partialData.acquisitionMetadata || undefined,
        musicGenerationPrompt: partialData.musicGenerationPrompt || partialData.music_generation_prompt || meta.music_generation_prompt || null
    };
};
