
import { TransformedNoteEvent, Tradition, ConfigSettings, InstrumentType } from '../types';

// Helper to write variable-length quantities for MIDI
function writeVarInt(data: number[], value: number) {
    let buffer = value & 0x7F;
    while ((value >>= 7) > 0) {
        buffer <<= 8;
        buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
        data.push(buffer & 0xFF);
        if (buffer & 0x80) {
            buffer >>= 8;
        } else {
            break;
        }
    }
}

// General MIDI Program Numbers (0-127)
const MIDI_PROGRAMS = {
    // Acoustic / Standard
    GRAND_PIANO: 0,
    ACOUSTIC_GUITAR: 24,
    ACOUSTIC_BASS: 32,
    STRING_ENSEMBLE: 48,
    
    // Synth / Electronic mappings for our waveforms
    FLUTE: 73,       // Good for Sine
    SQUARE_LEAD: 80, // Good for Square
    SAW_LEAD: 81,    // Good for Sawtooth
    CALLIOPE: 82,    // Good for Triangle/Mixed
    PAD_WARM: 89,    // Good for Accompaniment
    FX_SCIFI: 103    // Good for abstract
};

function mapInstrumentToMidiProgram(instrument: InstrumentType | undefined, isAccompaniment: boolean): number {
    if (isAccompaniment) {
        // Accompaniment usually benefits from pads or strings
        switch (instrument) {
            case 'sine': return MIDI_PROGRAMS.PAD_WARM;
            case 'triangle': return MIDI_PROGRAMS.STRING_ENSEMBLE;
            case 'sawtooth': return MIDI_PROGRAMS.SAW_LEAD;
            case 'square': return 38; // Synth Bass 1
            default: return MIDI_PROGRAMS.STRING_ENSEMBLE;
        }
    } else {
        // Melody
        switch (instrument) {
            case 'sine': return MIDI_PROGRAMS.FLUTE; // Pure tone
            case 'triangle': return MIDI_PROGRAMS.CALLIOPE; // Mellow
            case 'square': return MIDI_PROGRAMS.SQUARE_LEAD; // Retro
            case 'sawtooth': return MIDI_PROGRAMS.SAW_LEAD; // Sharp
            default: return MIDI_PROGRAMS.GRAND_PIANO;
        }
    }
}

function generateTrackChunk(
    events: TransformedNoteEvent[], 
    channel: number, 
    bpm: number, 
    trackName: string,
    programNumber: number
): number[] {
    const ticksPerBeat = 480;
    const microSecondsPerBeat = Math.round(60000000 / bpm);
    
    const finalTrackData: number[] = [];
    
    // --- 1. Track Header Meta Events ---
    
    // Sequence/Track Name (Meta 0x03)
    finalTrackData.push(0x00, 0xFF, 0x03, trackName.length, ...trackName.split('').map(c => c.charCodeAt(0)));
    
    // Instrument Name (Meta 0x04) - Optional but helpful for DAWs
    finalTrackData.push(0x00, 0xFF, 0x04, trackName.length, ...trackName.split('').map(c => c.charCodeAt(0)));

    // Set Tempo (Meta 0x51) - Only needed on the first track usually, but putting on Track 1 (Melody) is safe
    if (channel === 0) {
        finalTrackData.push(0x00, 0xFF, 0x51, 0x03, 
            (microSecondsPerBeat >> 16) & 0xFF, 
            (microSecondsPerBeat >> 8) & 0xFF, 
            microSecondsPerBeat & 0xFF);
    }

    // --- 2. Program Change (Set Instrument) ---
    // Delta time 0, Status 0xC0 | channel, Data1 = Program Number
    finalTrackData.push(0x00, 0xC0 | channel, programNumber);

    // --- 3. Note Events Queue ---
    type MidiEvent = { tick: number, type: 'on' | 'off', note: number, velocity: number };
    const midiQueue: MidiEvent[] = [];

    events.forEach(event => {
        const startTick = Math.round(event.time * ticksPerBeat * (bpm / 60));
        const endTick = startTick + Math.round(event.duration * ticksPerBeat * (bpm / 60));
        
        // Clamp MIDI notes to 0-127
        const midiNote = Math.max(0, Math.min(127, Math.round(event.midiFloat)));
        
        midiQueue.push({ tick: startTick, type: 'on', note: midiNote, velocity: event.velocity });
        midiQueue.push({ tick: endTick, type: 'off', note: midiNote, velocity: 0 });
    });

    // Sort by time
    midiQueue.sort((a, b) => a.tick - b.tick);

    let lastTick = 0;

    midiQueue.forEach(e => {
        const delta = e.tick - lastTick;
        writeVarInt(finalTrackData, Math.max(0, delta));
        
        if (e.type === 'on') {
            finalTrackData.push(0x90 | channel, e.note, e.velocity);
        } else {
            finalTrackData.push(0x80 | channel, e.note, 0);
        }
        lastTick = e.tick;
    });

    // --- 4. End of Track (Meta 0x2F) ---
    finalTrackData.push(0x00, 0xFF, 0x2F, 0x00);

    // --- 5. Create MTrk Chunk Header ---
    const trackHeader = [
        0x4D, 0x54, 0x72, 0x6B, // "MTrk"
        (finalTrackData.length >> 24) & 0xFF,
        (finalTrackData.length >> 16) & 0xFF,
        (finalTrackData.length >> 8) & 0xFF,
        finalTrackData.length & 0xFF,
    ];

    return [...trackHeader, ...finalTrackData];
}

export function exportMidi(events: TransformedNoteEvent[], tradition: Tradition, config: ConfigSettings): Blob {
    const ticksPerBeat = 480;
    
    // Separate events
    const melodyEvents = events.filter(e => !e.isAccompaniment);
    const accompanimentEvents = events.filter(e => e.isAccompaniment);

    // Determine MIDI Programs based on Config
    const melodyProgram = mapInstrumentToMidiProgram(config.melodyInstrument, false);
    const accompProgram = mapInstrumentToMidiProgram(config.accompanimentInstrument, true);

    // Generate Tracks with dedicated channels (0 and 1)
    // Track 1: Melody
    const track1Data = generateTrackChunk(
        melodyEvents, 
        0, 
        config.bpm, 
        `Melody (${config.melodyInstrument || 'Sine'})`, 
        melodyProgram
    );

    // Track 2: Accompaniment
    const track2Data = generateTrackChunk(
        accompanimentEvents, 
        1, 
        config.bpm, 
        `Accompaniment (${config.accompanimentInstrument || 'Pad'})`, 
        accompProgram
    );

    const numTracks = 2; 

    // MIDI File Header
    const header = [
        0x4D, 0x54, 0x68, 0x64, // "MThd"
        0x00, 0x00, 0x00, 0x06, // Header length
        0x00, 0x01,             // Format 1 (multi-track)
        0x00, numTracks,        // Number of tracks
        (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF,
    ];

    const midiBytes = new Uint8Array([...header, ...track1Data, ...track2Data]);
    return new Blob([midiBytes], { type: 'audio/midi' });
}
