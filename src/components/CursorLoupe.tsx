import React, { useRef, useEffect } from 'react';
import { TransformedNoteEvent } from '../types';

interface CursorLoupeProps {
    activeEvent: TransformedNoteEvent | null;
    isPlaying: boolean;
}

const DataRow: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-center text-xs">
        <span className="text-brand-text-secondary">{label}:</span>
        <span className="font-mono text-white">{value}</span>
    </div>
);

export const CursorLoupe: React.FC<CursorLoupeProps> = React.memo(({ activeEvent, isPlaying }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // FIX: Controllo se sourceBlock esiste prima di disegnare
        if (activeEvent?.sourceBlock) {
            const { r, g, b } = activeEvent.sourceBlock;
            ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            // Pulisce il canvas se non c'è il blocco
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [activeEvent]);

    // FIX: Valori di default sicuri per i colori (Nero se manca il blocco)
    const { r, g, b } = activeEvent?.sourceBlock ?? { r: 0, g: 0, b: 0 };
    const rgbString = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;

    // FIX: Safe access (Accesso Sicuro) alle coordinate con ?. e ??
    // Se manca la posizione, mostra un trattino '-' invece di crashare
    const posX = activeEvent?.sourceBlock?.position?.x ?? '-';
    const posY = activeEvent?.sourceBlock?.position?.y ?? '-';

    return (
        <div className="bg-brand-secondary/50 p-3 rounded-lg border border-brand-secondary">
            <h4 className="font-bold text-brand-accent mb-2 flex items-center gap-2 text-sm border-b border-brand-secondary pb-2">
                <i className="fas fa-search-location"></i>
                <span>Analisi Cursore (Tempo Reale)</span>
            </h4>

            {!isPlaying && !activeEvent && (
                <div className="h-16 flex items-center justify-center text-brand-text-secondary italic text-sm">
                    In attesa della riproduzione...
                </div>
            )}

            {(isPlaying || activeEvent) && (
                <div className="flex gap-3 items-center animate-fade-in pt-2">
                    <div className="w-16 h-16 flex-shrink-0 bg-brand-primary/50 rounded-md overflow-hidden border-2 border-brand-secondary shadow-inner">
                        <canvas ref={canvasRef} className="w-full h-full" width="64" height="64" />
                    </div>
                    <div className="flex-grow space-y-1">
                        <DataRow label="Stato" value={
                            <span className={isPlaying ? 'text-green-400' : 'text-yellow-400'}>
                                {isPlaying ? 'In Riproduzione' : 'In Pausa'}
                            </span>
                        } />

                        {/* Riga corretta con protezione crash */}
                        <DataRow label="Coordinate" value={`[${posX}, ${posY}]`} />

                        <DataRow label="Colore (RGB)" value={
                            <div className="flex items-center gap-2">
                                <span>{rgbString}</span>
                                <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: `rgb(${rgbString})` }}></div>
                            </div>
                        } />
                        <DataRow label="Nota Mappata" value={activeEvent?.noteName ?? 'N/A'} />
                    </div>
                </div>
            )}
        </div>
    );
});