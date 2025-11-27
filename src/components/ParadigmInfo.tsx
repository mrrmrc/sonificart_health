import React from 'react';
import { Paradigm } from '../types';

interface ParadigmInfoProps {
    paradigm: Paradigm;
    onGoPro: () => void;
    isProUser?: boolean;
}

export const ParadigmInfo: React.FC<ParadigmInfoProps> = ({ paradigm, onGoPro, isProUser }) => {
    
    const content = {
        scientific: {
            title: "Paradigma Scientifico",
            subtitle: "Traduzione Deterministica Oggettiva",
            icon: "fa-microscope",
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/30",
            process: [
                { title: "Standardizzazione", desc: "L'immagine viene ridimensionata a 512px per garantire l'integrità dei dati pixel." },
                { title: "Scansione CIE LAB", desc: "Analisi colorimetrica che imita la percezione umana (Luminosità = Volume, Colore = Tonalità)." },
                { title: "Matching Culturale", desc: "Confronto matematico con 48 tradizioni musicali per trovare la scala più affine." },
                { title: "Sintesi Pura", desc: "Generazione audio deterministica: 1 Pixel = 1 Nota. Nessuna 'allucinazione' AI." }
            ],
            license: {
                type: "Accesso Standard",
                rights: ["Uso Personale", "Ricerca Accademica", "Condivisione Social"],
                limitations: ["Costo: 1 Credito / Generazione"]
            }
        },
        hybrid: {
            title: "Paradigma Ibrido (AI + Dati)",
            subtitle: "Il 'Regista' Virtuale",
            icon: "fa-wand-magic-sparkles",
            color: "text-brand-accent",
            bg: "bg-teal-500/10",
            border: "border-brand-accent/30",
            process: [
                { title: "Visione Computerizzata", desc: "Un'IA analizza il contenuto semantico (es. 'Tramonto malinconico')." },
                { title: "Fusione Dati", desc: "I dati scientifici del colore guidano l'emozione dell'IA." },
                { title: "Arrangiamento", desc: "Generazione di una struttura musicale complessa (Melodia + Armonia)." },
                { title: "Texture Sonora", desc: "Utilizzo di strumenti virtuali di alta qualità basati sul contesto." }
            ],
            license: {
                type: "Accesso Premium",
                rights: ["Alta Risoluzione (4K)", "Arrangiamenti Completi", "Strumenti AI"],
                limitations: ["Costo: 2 Crediti / Generazione (o Illimitato Pro)"]
            }
        },
        artistic: {
            title: "Paradigma Artistico",
            subtitle: "Interpretazione Strutturale Libera",
            icon: "fa-palette",
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/30",
            process: [
                { title: "Astrazione Pura", desc: "L'IA ignora il soggetto visivo e si concentra sulla geometria compositiva." },
                { title: "Traduzione Cieca", desc: "Generazione basata esclusivamente sui rapporti matematici di contrasto ed equilibrio." },
                { title: "Creatività Generativa", desc: "Il sistema 'immagina' una colonna sonora basata sulla 'vibrazione' dell'opera." },
                { title: "Unicità", desc: "Ideale per arte astratta e installazioni moderne." }
            ],
            license: {
                type: "Accesso Premium",
                rights: ["Installazioni Museali", "Output Multi-Traccia (MIDI)", "Supporto Prioritario"],
                limitations: ["Costo: 2 Crediti / Generazione (o Illimitato Pro)"]
            }
        }
    };

    const info = content[paradigm];
    const isProTier = paradigm !== 'scientific';

    return (
        <div className="h-full animate-fade-in">
            <div className={`h-full ${info.bg} backdrop-blur-xl p-6 rounded-xl border ${info.border} flex flex-col shadow-2xl`}>
                
                {/* Header */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className={`w-16 h-16 rounded-2xl ${info.bg} border border-white/10 flex items-center justify-center text-3xl shadow-lg`}>
                        <i className={`fas ${info.icon} ${info.color}`}></i>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">{info.title}</h3>
                        <p className="text-brand-text-secondary text-sm font-mono uppercase tracking-wider">{info.subtitle}</p>
                    </div>
                    {isProTier && (
                        <div className="ml-auto">
                            <span className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-amber-500/20">
                                2 CR
                            </span>
                        </div>
                    )}
                </div>

                {/* Process Steps */}
                <div className="mb-8">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i className="fas fa-cogs text-brand-text-secondary"></i> Cosa Accadrà:
                    </h4>
                    <div className="space-y-4">
                        {info.process.map((step, idx) => (
                            <div key={idx} className="flex gap-3 items-start group">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-white/30 group-hover:bg-brand-accent transition-colors"></div>
                                <div>
                                    <span className="text-white font-bold text-sm block mb-0.5">{step.title}</span>
                                    <span className="text-brand-text-secondary text-xs leading-relaxed">{step.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* License Info */}
                <div className="mt-auto bg-black/40 rounded-lg p-4 border border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                            <i className="fas fa-file-contract mr-2 text-brand-text-secondary"></i>
                            Condizioni d'Uso
                        </h4>
                        <span className={`text-xs font-bold ${isProTier ? 'text-amber-400' : 'text-green-400'}`}>{info.license.type}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                        <div className="space-y-1">
                            {info.license.rights.map((right, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-green-300/80">
                                    <i className="fas fa-check"></i> {right}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            {info.license.limitations.map((lim, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-yellow-300/60">
                                    <i className="fas fa-info-circle"></i> {lim}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Button Logic: Always allow usage with credits unless Pro */}
                    {isProUser ? (
                        <div className="w-full py-2 bg-green-900/30 border border-green-600/30 text-green-400 text-sm font-bold rounded-md text-center flex items-center justify-center gap-2">
                            <i className="fas fa-check-circle"></i> Licenza Pro Attiva
                        </div>
                    ) : (
                        <button 
                            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-md transition-all transform hover:scale-[1.02]"
                            disabled={true} // This is purely informational here, action is on Image Upload
                        >
                            Usa i tuoi Crediti ({isProTier ? '2' : '1'})
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};