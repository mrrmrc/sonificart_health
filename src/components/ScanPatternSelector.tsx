import React, { useMemo } from 'react';
import { ScanPattern, ScanPatternOverride } from '../types';

const SCAN_PATTERNS = [
    { id: ScanPattern.LINEAR, name: 'Lineare (Sinistra-Destra, Alto-Basso)', svg: <path d="M 5,10 L 95,10 M 5,30 L 95,30 M 5,50 L 95,50 M 5,70 L 95,70 M 5,90 L 95,90" /> },
    { id: ScanPattern.BOUSTROPHEDON_LTR, name: 'Boustrophedon (Sinistra-Destra)', svg: <path d="M 5,15 L 95,15 L 95,35 L 5,35 L 5,55 L 95,55 L 95,75 L 5,75" /> },
    { id: ScanPattern.BOUSTROPHEDON_RTL, name: 'Boustrophedon (Destra-Sinistra)', svg: <path d="M 95,15 L 5,15 L 5,35 L 95,35 L 95,55 L 5,55 L 5,75 L 95,75" /> },
    { id: ScanPattern.SCANLINES_VERTICAL, name: 'Scansione Verticale Alternata', svg: <path d="M 15,5 L 15,95 L 35,95 L 35,5 L 55,5 L 55,95 L 75,95 L 75,5" /> },
    { id: ScanPattern.INWARD_BOX_CLOCKWISE, name: 'Spirale Oraria (Verso l\'interno)', svg: <path d="M 10,10 L 90,10 L 90,90 L 10,90 L 10,30 L 70,30 L 70,70 L 30,70 L 30,50" /> },
    { id: ScanPattern.INWARD_BOX_COUNTER_CLOCKWISE, name: 'Spirale Antioraria (Verso l\'interno)', svg: <path d="M 10,10 L 10,90 L 90,90 L 90,10 L 30,10 L 30,70 L 70,70 L 70,30 L 50,30" /> },
];

interface ScanPatternSelectorProps {
    value: ScanPatternOverride;
    onChange: (value: ScanPatternOverride) => void;
}

export const ScanPatternSelector: React.FC<ScanPatternSelectorProps> = ({ value, onChange }) => {
    
    const selectedPatternSvg = useMemo(() => {
        if (value === 'auto') return <path d="M 20,50 C 40,20 60,80 80,50" />;
        return SCAN_PATTERNS.find(p => p.id === value)?.svg;
    }, [value]);

    return (
        <div className="config-item">
            <label htmlFor="scanPattern" className="font-bold text-brand-text-primary mb-2 block">
                Percorso di Scansione:
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <select
                    id="scanPattern"
                    value={value}
                    onChange={(e) => onChange(e.target.value as ScanPatternOverride)}
                    className="w-full sm:w-2/3 p-2 bg-brand-primary border border-brand-secondary rounded-md text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                >
                    <option value="auto">Auto (da Tradizione Culturale)</option>
                    <optgroup label="Manuale">
                        {SCAN_PATTERNS.map(pattern => (
                            <option key={pattern.id} value={pattern.id}>{pattern.name}</option>
                        ))}
                    </optgroup>
                </select>
                <div className="w-full sm:w-1/3 h-16 bg-brand-primary/50 border border-brand-secondary rounded-md p-1 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="var(--color-brand-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                         <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand-accent)" />
                            </marker>
                        </defs>
                        {/* This cast solves a TypeScript type definition issue for the 'markerEnd' SVG prop without affecting runtime. */}
                        {selectedPatternSvg && React.cloneElement(selectedPatternSvg as React.ReactElement<any>, { markerEnd: "url(#arrow)" })}
                    </svg>
                </div>
            </div>
             <p className="mt-2 text-xs text-brand-text-secondary">
                La modalità 'Auto' seleziona un percorso basato sulla cultura (scientifico). Le opzioni manuali sovrascrivono questa scelta per un controllo creativo.
            </p>
        </div>
    );
};