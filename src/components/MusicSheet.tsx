import React from 'react';
import { TransformedNoteEvent } from '../types';

interface MusicSheetProps {
    activeEvent: TransformedNoteEvent | null;
}

export const MusicSheet: React.FC<MusicSheetProps> = React.memo(({ activeEvent }) => {
    const noteName = activeEvent ? `${activeEvent.noteName}${Math.floor(activeEvent.midiFloat / 12) - 1}` : '---';
    
    // Use the source block's color for the note text to create a direct visual link
    const noteColor = activeEvent 
        ? `rgb(${Math.round(activeEvent.sourceBlock.r)}, ${Math.round(activeEvent.sourceBlock.g)}, ${Math.round(activeEvent.sourceBlock.b)})` 
        : 'var(--color-brand-text-secondary)';

    return (
        <div className="mt-4 w-full h-32 bg-brand-primary/50 p-2 rounded-lg border border-brand-secondary flex flex-col items-center justify-center text-center transition-all duration-300">
            <div 
                className="text-6xl font-bold font-mono transition-colors duration-100"
                style={{ color: noteColor, textShadow: `0 0 15px ${noteColor}` }}
            >
                {noteName}
            </div>
            <div className="text-xs text-brand-text-secondary mt-1 tracking-widest uppercase">
                Nota Corrente
            </div>
        </div>
    );
});