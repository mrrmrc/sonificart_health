import React, { useState } from 'react';
import { SemanticHotspot } from '../types';

interface AiVisionInspectorOverlayProps {
    hotspots: SemanticHotspot[];
    pictorialStyle?: string;
    targetBpm?: number;
    primaryCategoryLabel?: string;
}

export const AiVisionInspectorOverlay: React.FC<AiVisionInspectorOverlayProps> = ({
    hotspots,
    pictorialStyle,
    targetBpm,
    primaryCategoryLabel
}) => {
    const [selectedHotspot, setSelectedHotspot] = useState<SemanticHotspot | null>(hotspots[0] || null);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [isHudVisible, setIsHudVisible] = useState<boolean>(true);

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'emotions': return 'fa-theater-masks text-purple-400';
            case 'materials': return 'fa-cube text-amber-400';
            case 'style': return 'fa-paint-brush text-emerald-400';
            case 'who_target': return 'fa-crosshairs text-cyan-400';
            default: return 'fa-info-circle text-brand-accent';
        }
    };

    const getCategoryBadgeClass = (category: string) => {
        switch (category) {
            case 'emotions': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
            case 'materials': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            case 'style': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
            case 'who_target': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
            default: return 'bg-brand-accent/20 text-brand-accent border-brand-accent/40';
        }
    };

    const filteredHotspots = hotspots.filter(h => activeFilter === 'all' || h.category === activeFilter);

    if (!isHudVisible) {
        return (
            <div className="absolute bottom-3 right-3 z-30 pointer-events-auto">
                <button
                    onClick={() => setIsHudVisible(true)}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 transition-all transform hover:scale-105"
                >
                    <i className="fas fa-eye"></i> Mostra Vision AI Inspector
                </button>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none">

            {/* TOP HEADER HUD */}
            <div className="absolute top-3 left-3 right-3 z-30 pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 backdrop-blur-md p-2 rounded-xl border border-emerald-500/40 shadow-2xl">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fas fa-robot text-emerald-400"></i> Vision AI Inspector
                    </span>
                </div>

                {/* CATEGORY FILTERS */}
                <div className="flex items-center gap-1 flex-wrap">
                    {[
                        { id: 'all', label: 'Tutti i Pin', icon: 'fa-layer-group' },
                        { id: 'emotions', label: 'Emozioni', icon: 'fa-theater-masks' },
                        { id: 'materials', label: 'Materiali', icon: 'fa-cube' },
                        { id: 'who_target', label: 'WHO Target', icon: 'fa-crosshairs' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFilter(f.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                                activeFilter === f.id
                                    ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <i className={`fas ${f.icon}`}></i> {f.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setIsHudVisible(false)}
                        className="ml-2 text-gray-400 hover:text-white text-xs px-1.5 py-1"
                        title="Nascondi HUD"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            {/* HOTSPOT PINS ON IMAGE */}
            {filteredHotspots.map(spot => {
                const isSelected = selectedHotspot?.id === spot.id;
                return (
                    <div
                        key={spot.id}
                        style={{ top: `${spot.y_percent}%`, left: `${spot.x_percent}%` }}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto group cursor-pointer"
                        onClick={() => setSelectedHotspot(spot)}
                        onMouseEnter={() => setSelectedHotspot(spot)}
                    >
                        {/* PULSING TARGET RING */}
                        <div className={`relative flex items-center justify-center transition-all ${isSelected ? 'scale-125' : 'hover:scale-110'}`}>
                            <span className={`animate-ping absolute inline-flex h-8 w-8 rounded-full opacity-75 ${
                                isSelected ? 'bg-emerald-400' : 'bg-cyan-400'
                            }`}></span>
                            
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 backdrop-blur-md shadow-2xl transition-all ${
                                isSelected
                                    ? 'bg-emerald-500 text-black border-white ring-4 ring-emerald-400/40 shadow-emerald-500/50'
                                    : 'bg-slate-900/90 text-white border-emerald-400/60 shadow-black/80'
                            }`}>
                                <i className={`fas ${getCategoryIcon(spot.category)} text-xs`}></i>
                            </div>

                            {/* PIN LABEL */}
                            <div className={`absolute top-9 left-1/2 transform -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg transition-all ${
                                isSelected
                                    ? 'bg-emerald-500 text-black border-white'
                                    : 'bg-black/80 text-gray-200 border-white/20 group-hover:border-emerald-400'
                            }`}>
                                {spot.label}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* BOTTOM REASONING HUD (AI THOUGHT CHAIN CARD) */}
            {selectedHotspot && (
                <div className="absolute bottom-3 left-3 right-3 z-30 pointer-events-auto animate-fade-in-up">
                    <div className="bg-slate-950/90 backdrop-blur-xl p-4 rounded-xl border border-emerald-500/40 shadow-2xl text-xs space-y-2 max-w-2xl mx-auto">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getCategoryBadgeClass(selectedHotspot.category)}`}>
                                    <i className={`fas ${getCategoryIcon(selectedHotspot.category)} mr-1`}></i>
                                    {selectedHotspot.label}
                                </span>
                                <span className="text-white font-bold text-sm">
                                    {selectedHotspot.description}
                                </span>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold">
                                Point ({selectedHotspot.x_percent}%, {selectedHotspot.y_percent}%)
                            </span>
                        </div>

                        {/* AI REASONING STEP-BY-STEP */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
                                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fas fa-brain text-emerald-300"></i> Ragionamento dell'AI (Vision AI Analysis)
                                </div>
                                <p className="text-gray-200 leading-relaxed text-[11px]">
                                    {selectedHotspot.reasoning_step}
                                </p>
                            </div>

                            <div className="bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-500/30 space-y-1">
                                <div className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fas fa-music text-cyan-400"></i> Assegnazione Acustico-Strumentale
                                </div>
                                <p className="text-cyan-100 font-bold text-[11px] flex items-center gap-2">
                                    <i className="fas fa-arrow-right text-emerald-400"></i>
                                    {selectedHotspot.acoustic_effect}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
