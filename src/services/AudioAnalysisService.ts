/**
 * AudioAnalysisService.ts
 * Analizza un AudioBuffer tramite FFT per classificare il tipo di stem
 * e generare automaticamente una mappatura corpo→effetto suggerita dall'AI.
 */

import { BodyPart, AudioParameter, StemMapping } from '../types';

export type StemType = 'percussive' | 'bass' | 'vocal' | 'harmonic' | 'unknown';

export interface StemAnalysis {
    type: StemType;
    dominantFreqBand: 'sub-bass' | 'bass' | 'mid' | 'high-mid' | 'high';
    energy: number;        // 0..1 overall energy
    transientScore: number; // 0..1 (high = percussive)
    suggestedBodyPart: BodyPart;
    suggestedParameter: AudioParameter;
    orbitPhaseOffset: number; // degrees, for 8D orbit spacing
    label: string;             // human-readable classification
}

/**
 * Analizza un AudioBuffer e restituisce la classificazione + mappatura suggerita.
 */
export async function analyzeStem(buffer: AudioBuffer, stemIndex: number, totalStems: number): Promise<StemAnalysis> {
    const sampleRate = buffer.sampleRate;
    const data = buffer.getChannelData(0); // mono analysis

    // --- 1. FFT via OfflineAudioContext ---
    const fftSize = 2048;
    const offline = new OfflineAudioContext(1, fftSize, sampleRate);
    const src = offline.createBufferSource();
    
    // Analyze a representative sample from the middle of the buffer
    const midOffset = Math.max(0, Math.floor(buffer.length / 2) - fftSize);
    const slice = offline.createBuffer(1, fftSize, sampleRate);
    const sliceData = slice.getChannelData(0);
    for (let i = 0; i < fftSize; i++) {
        sliceData[i] = data[midOffset + i] || 0;
    }
    src.buffer = slice;

    const analyser = offline.createAnalyser();
    analyser.fftSize = fftSize;
    src.connect(analyser);
    analyser.connect(offline.destination);
    src.start();
    await offline.startRendering();

    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);

    // --- 2. Compute energy in frequency bands ---
    const binSize = sampleRate / fftSize;
    const getEnergy = (minHz: number, maxHz: number) => {
        const minBin = Math.floor(minHz / binSize);
        const maxBin = Math.min(Math.ceil(maxHz / binSize), freqData.length - 1);
        let sum = 0;
        for (let i = minBin; i <= maxBin; i++) {
            // freqData values are in dB, convert to linear
            sum += Math.pow(10, (freqData[i] || -100) / 20);
        }
        return sum / Math.max(1, maxBin - minBin);
    };

    const subBassEnergy = getEnergy(20, 80);
    const bassEnergy = getEnergy(80, 250);
    const midEnergy = getEnergy(250, 2000);
    const highMidEnergy = getEnergy(2000, 6000);
    const highEnergy = getEnergy(6000, 20000);
    const totalEnergy = subBassEnergy + bassEnergy + midEnergy + highMidEnergy + highEnergy;

    // --- 3. Detect transients (percussive content) ---
    // High variance in raw signal = percussive
    let sumSq = 0;
    let prevVal = 0;
    const sampleCount = Math.min(44100, data.length); // 1 second
    for (let i = 0; i < sampleCount; i++) {
        const diff = Math.abs(data[i] - prevVal);
        sumSq += diff * diff;
        prevVal = data[i];
    }
    const transientScore = Math.min(1, Math.sqrt(sumSq / sampleCount) * 50);

    // --- 4. Classify stem type ---
    const normSub = subBassEnergy / totalEnergy;
    const normBass = bassEnergy / totalEnergy;
    const normMid = midEnergy / totalEnergy;
    const normHigh = (highMidEnergy + highEnergy) / totalEnergy;

    let type: StemType;
    let dominantFreqBand: StemAnalysis['dominantFreqBand'];
    let label: string;

    if (transientScore > 0.4 && (normSub + normBass) > 0.3) {
        type = 'percussive';
        dominantFreqBand = 'bass';
        label = 'Percussivo / Batteria';
    } else if (normSub + normBass > 0.5) {
        type = 'bass';
        dominantFreqBand = normSub > normBass ? 'sub-bass' : 'bass';
        label = 'Basso / Sub';
    } else if (normMid > 0.4) {
        type = 'vocal';
        dominantFreqBand = 'mid';
        label = 'Voce / Melodia';
    } else if (normHigh > 0.4) {
        type = 'harmonic';
        dominantFreqBand = normHigh > 0.6 ? 'high' : 'high-mid';
        label = 'Armonia / Pad';
    } else {
        type = 'unknown';
        dominantFreqBand = 'mid';
        label = 'Generico';
    }

    // --- 5. Generate suggested mapping ---
    const BODY_PARAMS: Record<StemType, BodyPart> = {
        percussive: 'armSpan',      // Apertura braccia → energia percussiva
        bass: 'z',                   // Distanza → sub-bass (fisico)
        vocal: 'headYaw',            // Rotazione testa → melodia
        harmonic: 'shoulderTilt',    // Inclinazione spalle → armonia/pad
        unknown: 'handsY',           // Altezza mani → generico
    };

    const AUDIO_PARAMS: Record<StemType, AudioParameter> = {
        percussive: 'volume',
        bass: 'lowpass',
        vocal: 'volume',
        harmonic: 'lowpass',
        unknown: 'volume',
    };

    // Orbits evenly spaced
    const orbitPhaseOffset = (stemIndex / totalStems) * 360;

    return {
        type,
        dominantFreqBand,
        energy: totalEnergy / 100,
        transientScore,
        suggestedBodyPart: BODY_PARAMS[type],
        suggestedParameter: AUDIO_PARAMS[type],
        orbitPhaseOffset,
        label,
    };
}

/**
 * Analizza tutti gli stem e genera i StemMapping aggiornati con i suggerimenti AI.
 * Preserva eventuali mappature già configurate dall'utente.
 */
export async function autoMapStems(
    stems: StemMapping[],
    buffers: AudioBuffer[]
): Promise<{ mappings: StemMapping[], analyses: StemAnalysis[] }> {
    const analyses = await Promise.all(
        buffers.map((buf, i) => analyzeStem(buf, i, buffers.length))
    );

    const mappings = stems.map((stem, i) => {
        const analysis = analyses[i];
        if (!analysis) return stem;

        // Only override if the user hasn't customized (i.e., still uses default mapping)
        return {
            ...stem,
            assignedBodyPart: stem.assignedBodyPart || analysis.suggestedBodyPart,
            parameter: stem.parameter || analysis.suggestedParameter,
            // Store analysis metadata for display
            _aiLabel: analysis.label,
            _aiSuggested: true,
        } as StemMapping & { _aiLabel?: string; _aiSuggested?: boolean };
    });

    return { mappings, analyses };
}
