import React from 'react';
import { TransformedNoteEvent } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MusicSheetProps {
    activeEvent: TransformedNoteEvent | null;
}

export const MusicSheet: React.FC<MusicSheetProps> = React.memo(({ activeEvent }) => {
    const { t } = useLanguage();
    const noteName = activeEvent ? `${activeEvent.noteName}${Math.floor(activeEvent.midiFloat / 12) - 1}` : '---';

    // Use the source block's color for the note text
    const r = activeEvent ? Math.round(activeEvent.sourceBlock.r) : 255;
    const g = activeEvent ? Math.round(activeEvent.sourceBlock.g) : 255;
    const b = activeEvent ? Math.round(activeEvent.sourceBlock.b) : 255;

    const noteColor = activeEvent
        ? `rgb(${r}, ${g}, ${b})`
        : 'var(--color-brand-text-secondary)';

    // Calculate luminance to decide if we need a light glow for contrast
    // Formula: 0.2126*R + 0.7152*G + 0.0722*B
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);
    const isDark = luminance < 50; // Threshold for dark color

    return (
        <div className="mt-4 w-full h-32 bg-brand-primary/50 p-2 rounded-lg border border-brand-secondary flex flex-col items-center justify-center text-center transition-all duration-300">
            <div
                className="text-6xl font-bold font-mono transition-colors duration-100"
                style={{
                    color: noteColor,
                    textShadow: isDark
                        ? `0 0 1px rgba(255,255,255,0.8), 0 0 15px ${noteColor}`
                        : `0 0 15px ${noteColor}`
                }}
            >
                {noteName}
            </div>
            <div className="text-xs text-brand-text-secondary mt-1 tracking-widest uppercase">
                {t('results.current_note')}
            </div>
        </div>
    );
});