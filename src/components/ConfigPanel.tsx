import React, { useMemo } from 'react';
import { ConfigSettings, Paradigm, InstrumentType, ScanPatternOverride } from '../types';
import { ScanPatternSelector } from './ScanPatternSelector';
import { useLanguage } from '../contexts/LanguageContext';

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
    const { t } = useLanguage();

    const isScientific = paradigm === 'scientific';

    // REMOVED: isLocked logic. All features are accessible via credits for Free users.
    const creditCost = paradigm === 'scientific' ? 1 : 2;

    const handleBpmChange = (newBpm: number) => {
        if (config.useHealthAgent) return; // Locked in Health Agent mode
        const newDuration = config.targetDurationSeconds 
            ? (config.targetDurationSeconds / config.pixelCount)
            : (15 / newBpm);
        onConfigChange({ bpm: newBpm, noteDurationSeconds: newDuration });
    };

    const handleTargetDurationChange = (targetSec: number) => {
        const noteDur = targetSec / config.pixelCount;
        onConfigChange({ targetDurationSeconds: targetSec, noteDurationSeconds: noteDur });
    };

    const { estimatedDuration, isDurationTooLong, isDurationInvalid } = useMemo(() => {
        const totalSeconds = config.targetDurationSeconds || (config.noteDurationSeconds * config.pixelCount);

        const invalid = !isFinite(totalSeconds) || totalSeconds <= 0;
        if (invalid) {
            return { estimatedDuration: "N/A", isDurationTooLong: false, isDurationInvalid: true };
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.round(totalSeconds % 60);
        const durationString = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

        const tooLong = totalSeconds > 240;

        return {
            estimatedDuration: durationString,
            isDurationTooLong: tooLong,
            isDurationInvalid: false
        };
    }, [config.pixelCount, config.noteDurationSeconds, config.targetDurationSeconds]);

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

                {/* TARGET DURATION (60s - 240s) & RESOLUTION & BPM */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="config-item">
                        <label htmlFor="targetDurationSetting" className="text-xs font-bold text-brand-text-secondary uppercase mb-2 flex items-center justify-between">
                            <span>Durata Target Audio (1 min - 4 min)</span>
                            <span className="text-[10px] text-emerald-400 font-normal">Granularità Adattiva</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                id="targetDurationSetting"
                                min="60"
                                max="240"
                                step="5"
                                value={config.targetDurationSeconds || 60}
                                onChange={(e) => handleTargetDurationChange(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                            <span className="bg-black/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold py-1 px-3 rounded-md min-w-[75px] text-center text-sm">
                                {Math.floor((config.targetDurationSeconds || 60) / 60)}m {((config.targetDurationSeconds || 60) % 60).toString().padStart(2, '0')}s
                            </span>
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-brand-text-secondary">
                            <span>1 min (60s)</span>
                            <span>2 min</span>
                            <span>3 min</span>
                            <span>4 min (240s)</span>
                        </div>
                    </div>

                    <div className="config-item">
                        <label htmlFor="pixelCount" className="text-xs font-bold text-brand-text-secondary uppercase mb-2 block">{t('config.resolution')}</label>
                        <select
                            id="pixelCount"
                            value={config.pixelCount}
                            onChange={(e) => {
                                const newPixels = parseInt(e.target.value, 10);
                                const targetSec = config.targetDurationSeconds || 60;
                                onConfigChange({ pixelCount: newPixels, noteDurationSeconds: targetSec / newPixels });
                            }}
                            className="w-full p-2 bg-black/20 border border-white/10 rounded text-sm text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                        >
                            <option value="1024">{t('config.pixel_1024')}</option>
                            <option value="4096">{t('config.pixel_4096')}</option>
                            <option value="16384">{t('config.pixel_16384')}</option>
                        </select>
                    </div>

                    <div className="config-item">
                        <label htmlFor="bpmSetting" className="text-xs font-bold text-brand-text-secondary uppercase mb-2 block flex items-center justify-between">
                            <span>{t('config.tempo')}</span>
                            {config.useHealthAgent && <span className="text-[10px] text-emerald-400 font-bold"><i className="fas fa-lock mr-1"></i>WHO Health Mode</span>}
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
                                disabled={config.useHealthAgent}
                                className={`w-full h-2 rounded-lg appearance-none ${config.useHealthAgent ? 'bg-white/5 opacity-50 cursor-not-allowed' : 'bg-white/10 cursor-pointer accent-brand-accent'}`}
                            />
                            <span className={`bg-black/20 border text-font-mono font-bold py-1 px-3 rounded-md min-w-[60px] text-center text-sm ${config.useHealthAgent ? 'border-emerald-500/30 text-emerald-300' : 'border-white/10 text-brand-accent'}`}>{config.bpm}</span>
                        </div>
                        {config.useHealthAgent ? (
                            <div className="text-[11px] text-emerald-300 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 mt-2 flex items-center gap-2">
                                <i className="fas fa-lock text-emerald-400"></i>
                                <span>BPM determinato ed applicato automaticamente dall'Agente WHO in base all'analisi visiva.</span>
                            </div>
                        ) : (
                            <div className="flex justify-between mt-1 text-[10px] text-brand-text-secondary">
                                <span>{t('config.slow')}</span>
                                <span>{t('config.fast')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ACCOMPANIMENT */}
                <div className={`pt-4 border-t border-white/10 transition-opacity ${isScientific ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold text-white">{t('config.accompaniment')}</h4>
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
                                <label htmlFor="melodyInstrument" className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">{t('config.melody')}</label>
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
                                <label htmlFor="accompanimentInstrument" className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">{t('config.accompaniment_instrument')}</label>
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

                {/* WHO HEALTH AGENT */}
                <div className="pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-bold text-white">WHO Health Agent (Benessere)</h4>
                        <label htmlFor="health-agent-toggle" className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="health-agent-toggle"
                                    className="sr-only peer"
                                    checked={config.useHealthAgent || false}
                                    onChange={(e) => onConfigChange({ useHealthAgent: e.target.checked })}
                                />
                                <div className="block bg-white/10 w-10 h-6 rounded-full"></div>
                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all peer-checked:bg-green-400 peer-checked:translate-x-full"></div>
                            </div>
                        </label>
                    </div>
                    {config.useHealthAgent && (
                        <p className="text-[10px] text-green-400 mt-1 animate-fade-in">Generazione ottimizzata tramite RAG (Health Evidence Network Report 67) attiva. Elementi soporiferi disabilitati.</p>
                    )}
                </div>

                {/* ESTIMATES */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl mt-auto">
                    <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
                        <div className="px-2">
                            <div className="text-xs text-brand-text-secondary uppercase mb-1">{t('config.duration')}</div>
                            <div className={`font-mono font-bold ${isDurationTooLong ? 'text-yellow-400' : 'text-white'}`}>{estimatedDuration}</div>
                        </div>
                        <div className="px-2">
                            <div className="text-xs text-brand-text-secondary uppercase mb-1">{t('config.notes')}</div>
                            <div className="font-mono font-bold text-white">{estimates.totalNotes}</div>
                        </div>
                        <div className="px-2">
                            <div className="text-xs text-brand-text-secondary uppercase mb-1">{t('config.cpu')}</div>
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
                    <span>
                        {isProUser
                            ? (t('config.start').split('(')[0].trim()) // "AVVIA ANALISI" (Rimuove la parte del costo tra parentesi se presente)
                            : t('config.start', { cost: creditCost })
                        }
                    </span>
                </button>
                <p className="text-[10px] text-center text-brand-text-secondary mt-2">
                    {isProUser ? t('config.unlimited') : t('config.credits_question')}
                </p>
            </div>
        </div>
    );
};