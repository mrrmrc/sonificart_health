import React, { useMemo } from 'react';
import { ConfigSettings, Paradigm, InstrumentType, ScanPatternOverride } from '../types';
import { ScanPatternSelector } from './ScanPatternSelector';

interface ConfigPanelProps {
    config: ConfigSettings;
    onConfigChange: (newConfig: Partial<ConfigSettings>) => void;
    onStartProcessing: () => void;
    paradigm: Paradigm;
    oscStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
    oscError: string | null;
    scanPatternOverride: ScanPatternOverride;
    onScanPatternOverrideChange: (value: ScanPatternOverride) => void;
    onGoProClick: () => void;
    isProUser: boolean;
}

const instrumentOptions: { value: InstrumentType, label: string }[] = [
    { value: 'sine', label: 'Onda Sinusoidale (Puro)' },
    { value: 'square', label: 'Onda Quadra (Retro)' },
    { value: 'sawtooth', label: 'Dente di Sega (Ricco)' },
    { value: 'triangle', label: 'Onda Triangolare (Morbido)' },
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
    config, onConfigChange, onStartProcessing, paradigm, 
    oscStatus, oscError, scanPatternOverride, onScanPatternOverrideChange, onGoProClick, isProUser
}) => {
    
    const isScientific = paradigm === 'scientific';
    
    // REMOVED: isLocked logic. All features are accessible via credits for Free users.
    const creditCost = paradigm === 'scientific' ? 1 : 2;

    const handleBpmChange = (newBpm: number) => {
        const newDuration = 15 / newBpm;
        onConfigChange({ bpm: newBpm, noteDurationSeconds: newDuration });
    };

    const { estimatedDuration, isDurationTooLong, isDurationInvalid } = useMemo(() => {
        const totalSeconds = config.noteDurationSeconds * config.pixelCount;
        
        const invalid = !isFinite(totalSeconds) || totalSeconds <= 0;
        if (invalid) {
            return { estimatedDuration: "N/A", isDurationTooLong: false, isDurationInvalid: true };
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.round(totalSeconds % 60);
        const durationString = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        
        const tooLong = totalSeconds > 600;

        return { 
            estimatedDuration: durationString, 
            isDurationTooLong: tooLong,
            isDurationInvalid: false
        };
    }, [config.pixelCount, config.noteDurationSeconds]);

    const estimates = useMemo(() => {
        const totalNotes = config.pixelCount;
        const estimatedProcessing = `<${Math.max(1, Math.round(config.pixelCount / 2000))}s (DSP)`;
        return { totalNotes, estimatedProcessing };
    }, [config.pixelCount]);
    
    const handleOscChange = (field: string, value: any) => {
        onConfigChange({ osc: { ...config.osc, [field]: value } });
    };

    return (
        <div className="relative animate-fade-in h-full flex flex-col">
            
            <div className="flex-grow space-y-6">
                
                {/* SCAN PATTERN */}
                <div className="pb-4 border-b border-white/10">
                     <ScanPatternSelector 
                        value={scanPatternOverride}
                        onChange={onScanPatternOverrideChange}
                    />
                </div>

                {/* RESOLUTION & BPM */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="config-item">
                        <label htmlFor="pixelCount" className="text-xs font-bold text-brand-text-secondary uppercase mb-2 block">Risoluzione Analisi</label>
                        <select
                            id="pixelCount"
                            value={config.pixelCount}
                            onChange={(e) => onConfigChange({ pixelCount: parseInt(e.target.value, 10)})}
                            className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-brand-accent focus:outline-none transition-all hover:bg-black/30"
                        >
                            <option value="1024">1,024 (32×32 - Veloce)</option>
                            <option value="4096">4,096 (64×64 - HD)</option>
                            <option value="16384">16,384 (128×128 - 4K Pro)</option>
                        </select>
                    </div>
                    <div className="config-item">
                        <label htmlFor="bpmSetting" className="text-xs font-bold text-brand-text-secondary uppercase mb-2 block">
                            Tempo (BPM)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                id="bpmSetting"
                                min="60"
                                max="200"
                                step="1"
                                value={config.bpm}
                                onChange={(e) => handleBpmChange(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                            />
                            <span className="bg-black/20 border border-white/10 text-brand-accent font-mono font-bold py-1 px-3 rounded-md min-w-[60px] text-center text-sm">{config.bpm}</span>
                        </div>
                         <div className="flex justify-between mt-1 text-[10px] text-brand-text-secondary">
                            <span>Lento</span>
                            <span>Veloce</span>
                        </div>
                    </div>
                </div>

                {/* ACCOMPANIMENT */}
                 <div className={`pt-4 border-t border-white/10 transition-opacity ${isScientific ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold text-white">Arrangiamento Artistico</h4>
                        <label htmlFor="accompaniment-toggle" className={`flex items-center ${isScientific ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="accompaniment-toggle"
                                    className="sr-only peer"
                                    checked={config.enableAccompaniment}
                                    onChange={(e) => onConfigChange({ enableAccompaniment: e.target.checked })}
                                    disabled={isScientific}
                                />
                                <div className="block bg-white/10 peer-disabled:bg-white/5 w-10 h-6 rounded-full"></div>
                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:bg-brand-accent peer-checked:translate-x-full peer-disabled:bg-gray-500"></div>
                            </div>
                        </label>
                    </div>
                    {config.enableAccompaniment && (
                        <div className="animate-fade-in grid grid-cols-1 gap-4">
                             <div>
                                <label htmlFor="melodyInstrument" className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">Melodia</label>
                                 <select
                                    id="melodyInstrument"
                                    value={config.melodyInstrument}
                                    onChange={(e) => onConfigChange({ melodyInstrument: e.target.value as InstrumentType })}
                                    className="w-full p-2 bg-black/20 border border-white/10 rounded text-sm text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                >
                                    {instrumentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="accompanimentInstrument" className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">Accompagnamento</label>
                                 <select
                                    id="accompanimentInstrument"
                                    value={config.accompanimentInstrument}
                                    onChange={(e) => onConfigChange({ accompanimentInstrument: e.target.value as InstrumentType })}
                                    className="w-full p-2 bg-black/20 border border-white/10 rounded text-sm text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                >
                                    {instrumentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* ESTIMATES */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl mt-auto">
                    <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
                        <div className="px-2">
                             <div className="text-xs text-brand-text-secondary uppercase mb-1">Durata</div>
                             <div className={`font-mono font-bold ${isDurationTooLong ? 'text-yellow-400' : 'text-white'}`}>{estimatedDuration}</div>
                        </div>
                        <div className="px-2">
                             <div className="text-xs text-brand-text-secondary uppercase mb-1">Note</div>
                             <div className="font-mono font-bold text-white">{estimates.totalNotes}</div>
                        </div>
                        <div className="px-2">
                             <div className="text-xs text-brand-text-secondary uppercase mb-1">CPU</div>
                             <div className="font-mono font-bold text-green-400">Low</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-6 mt-auto">
                <button
                    onClick={onStartProcessing}
                    disabled={isDurationInvalid}
                    className="w-full btn bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(45,212,191,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:shadow-none disabled:scale-100 flex items-center justify-center gap-3"
                >
                    <i className="fas fa-play"></i>
                    <span>AVVIA ANALISI (-{creditCost} CR)</span>
                </button>
                <p className="text-[10px] text-center text-brand-text-secondary mt-2">
                    {isProUser ? 'Hai crediti illimitati.' : `Hai crediti sufficienti per questa operazione?`}
                </p>
            </div>
        </div>
    );
};