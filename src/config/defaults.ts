
// src/config/defaults.ts
import { ConfigSettings, ProcessingStep } from '../types';

export const scientificSteps: ProcessingStep[] = [
    { id: 1, name: 'Image Standardization', status: 'pending' },
    { id: 2, name: 'Hash Calculation (SHA-256)', status: 'pending' },
    { id: 3, name: 'Block Analysis', status: 'pending' },
    { id: 4, name: 'Universal Mapping', status: 'pending' },
    { id: 5, name: 'Cultural Selection', status: 'pending' },
    { id: 6, name: 'Cultural Transformation', status: 'pending' },
    { id: 7, name: 'Audio Synthesis & Export', status: 'pending' },
];

export const artisticSteps: ProcessingStep[] = [
    { id: 1, name: 'AI Aesthetic Consulting', status: 'pending' },
    { id: 2, name: 'Image Standardization', status: 'pending' },
    { id: 3, name: 'Hash Calculation', status: 'pending' },
    { id: 4, name: 'Block Analysis', status: 'pending' },
    { id: 5, name: 'Universal Mapping', status: 'pending' },
    { id: 6, name: 'Cultural Selection', status: 'pending' },
    { id: 7, name: 'Cultural Transformation', status: 'pending' },
    { id: 8, name: 'Deterministic Audio Synthesis', status: 'pending' },
    { id: 9, name: 'AI Extended Music Gen', status: 'pending' },
];

export const hybridSteps: ProcessingStep[] = [
    { id: 1, name: 'AI Image Description', status: 'pending' },
    { id: 2, name: 'AI Creative Fusion', status: 'pending' },
    { id: 3, name: 'Image Standardization', status: 'pending' },
    { id: 4, name: 'Hash Calculation', status: 'pending' },
    { id: 5, name: 'Block Analysis', status: 'pending' },
    { id: 6, name: 'Universal Mapping', status: 'pending' },
    { id: 7, name: 'Cultural Selection', status: 'pending' },
    { id: 8, name: 'Cultural Transformation', status: 'pending' },
    { id: 9, name: 'Deterministic Audio Synthesis', status: 'pending' },
    { id: 10, name: 'AI Extended Music Gen', status: 'pending' },
];

export const initialSettings: ConfigSettings = {
    pixelCount: 1024,
    bpm: 120,
    noteDurationSeconds: 0.125,
    osc: { enabled: false, host: '127.0.0.1', port: 9129 },
    enableAccompaniment: false,
    melodyInstrument: 'sine',
    accompanimentInstrument: 'triangle',
};
