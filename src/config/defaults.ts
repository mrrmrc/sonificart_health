
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

export const initialSettings: ConfigSettings = {
    pixelCount: 1024,
    bpm: 120,
    noteDurationSeconds: 0.125,
    osc: { enabled: false, host: '127.0.0.1', port: 9129 },
    enableAccompaniment: false,
    melodyInstrument: 'sine',
    accompanimentInstrument: 'triangle',
};
