
// Helper to write a string to a DataView
function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// Encodes an AudioBuffer into a WAV file (blob)
export function encodeWAV(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44; // 2 bytes per sample (16-bit)
    const wavBuffer = new ArrayBuffer(length);
    const view = new DataView(wavBuffer);
    const channels = [];
    let sample;
    let offset = 0;

    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // RIFF header
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    
    // fmt sub-chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // sub-chunk size
    view.setUint16(offset, 1, true); offset += 2; // audio format 1 = PCM
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4; // byte rate
    view.setUint16(offset, numOfChan * 2, true); offset += 2; // block align
    view.setUint16(offset, 16, true); offset += 2; // bits per sample

    // data sub-chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;

    // write the PCM samples
    for (let i = 0; i < buffer.length; i++) {
        for (let j = 0; j < numOfChan; j++) {
            sample = Math.max(-1, Math.min(1, channels[j][i]));
            // scale to 16-bit integer
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/wav;base64,") to get pure base64
      const base64 = result.split(',')[1]; 
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generates a short preview audio blob based on the paradigm
export const generateParadigmPreview = async (paradigm: string): Promise<string> => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 10; // 10 seconds preview
    const sampleRate = 44100;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    
    // Simple generative logic based on paradigm
    const baseFreq = paradigm === 'scientific' ? 110 : paradigm === 'artistic' ? 146.83 : 130.81; // A2, D3, C3
    
    for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        
        // Base Drone
        let sample = Math.sin(2 * Math.PI * baseFreq * t) * 0.3;
        
        // Add "texture" based on paradigm
        if (paradigm === 'scientific') {
            // Pure sine waves, pulsing
            sample += Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.1; // 5th
            sample *= (1 + Math.sin(2 * Math.PI * 0.2 * t)) * 0.5; // Slow LFO
        } else if (paradigm === 'artistic') {
            // More harmonics, richer
            sample += Math.sin(2 * Math.PI * (baseFreq * 1.25) * t) * 0.15; // Major 3rd
            sample += Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.1; // 5th
            sample += Math.random() * 0.05; // Noise texture
        } else {
            // Hybrid - Melodic Arpeggio simulation
            const note = Math.floor(t * 4) % 4; // Change note every 0.25s
            const freq = baseFreq * [1, 1.2, 1.5, 1.8][note];
            sample = Math.sin(2 * Math.PI * freq * t) * 0.2;
            sample += Math.sin(2 * Math.PI * (freq/2) * t) * 0.2; // Sub osc
        }

        // Envelope (Fade in / Fade out)
        let envelope = 1;
        if (t < 1) envelope = t;
        if (t > duration - 1) envelope = duration - t;
        
        L[i] = sample * envelope * 0.5;
        R[i] = sample * envelope * 0.5; // Mono to stereo mostly
    }

    const blob = encodeWAV(buffer);
    return URL.createObjectURL(blob);
};
