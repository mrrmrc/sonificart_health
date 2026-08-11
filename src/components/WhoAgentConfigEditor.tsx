import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { WhoAgentConfig, WhoAgentCategoryConfig, AgentMappingRule, BodyPart, AudioParameter, BODY_PARTS_LABELS, AUDIO_PARAMS_LABELS } from '../types';

const defaultAgentConfig: WhoAgentConfig = {
    calming: {
        description: 'Movimenti calmi mantengono il suono chiaro. Alta energia attiva il filtro per calmarti.',
        masterMappings: [
            { id: '1', bodyPart: 'z', audioParam: 'volume' },
            { id: '2', bodyPart: 'energyLevel', audioParam: 'lowpass' },
            { id: '3', bodyPart: 'energyLevel', audioParam: 'pitch' },
            { id: '4', bodyPart: 'headYaw', audioParam: 'pan' }
        ],
        stemMappings: [
            { id: '5', bodyPart: 'headYaw', audioParam: 'pan' }
        ]
    },
    motivation: {
        description: 'Più ti muovi con energia, più il ritmo si alza e il suono diventa spaziale.',
        masterMappings: [
            { id: '6', bodyPart: 'z', audioParam: 'volume' },
            { id: '7', bodyPart: 'energyLevel', audioParam: 'lowpass' },
            { id: '8', bodyPart: 'energyLevel', audioParam: 'pitch' },
            { id: '9', bodyPart: 'energyLevel', audioParam: 'pan' },
            { id: '10', bodyPart: 'headYaw', audioParam: 'pan' }
        ],
        stemMappings: [
            { id: '11', bodyPart: 'headYaw', audioParam: 'pan' }
        ]
    },
    cognitive_motor: {
        description: 'Ogni gesto preciso controlla un parametro. Il movimento della testa orienta il suono.',
        masterMappings: [
            { id: '12', bodyPart: 'z', audioParam: 'volume' },
            { id: '13', bodyPart: 'headYaw', audioParam: 'pan' }
        ],
        stemMappings: [
            { id: '14', bodyPart: 'headYaw', audioParam: 'pan' }
        ]
    },
    social_emotional: {
        description: 'Più apri la postura e le braccia, più il suono si apre.',
        masterMappings: [
            { id: '15', bodyPart: 'z', audioParam: 'volume' },
            { id: '16', bodyPart: 'openness', audioParam: 'lowpass' },
            { id: '17', bodyPart: 'headYaw', audioParam: 'pan' }
        ],
        stemMappings: [
            { id: '18', bodyPart: 'headYaw', audioParam: 'pan' }
        ]
    },
    physiological: {
        description: 'Avvicinati o allontanati dalla telecamera per controllare il volume generale del brano.',
        masterMappings: [
            { id: '19', bodyPart: 'z', audioParam: 'volume' },
            { id: '20', bodyPart: 'headYaw', audioParam: 'pan' }
        ],
        stemMappings: [
            { id: '21', bodyPart: 'headYaw', audioParam: 'pan' }
        ]
    }
};



export const WhoAgentConfigEditor: React.FC = () => {
    const [config, setConfig] = useState<WhoAgentConfig>(defaultAgentConfig);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<keyof WhoAgentConfig>('calming');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const saved = await api.getWhoAgentConfig();
            if (saved) {
                setConfig({ ...defaultAgentConfig, ...saved });
            }
        } catch (e) {
            console.error("Failed to load WhoAgentConfig", e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async () => {
        setIsSaving(true);
        try {
            await api.updateWhoAgentConfig(config);
            alert("Configurazione WHO Agent salvata con successo!");
        } catch (e) {
            alert("Errore durante il salvataggio.");
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const updateCategoryDescription = (desc: string) => {
        setConfig(prev => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], description: desc }
        }));
    };

    const addMapping = (type: 'masterMappings' | 'stemMappings') => {
        const newRule: AgentMappingRule = {
            id: Math.random().toString(36).substring(7),
            bodyPart: 'z',
            audioParam: 'volume'
        };
        setConfig(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [type]: [...prev[activeTab][type], newRule]
            }
        }));
    };

    const updateMapping = (type: 'masterMappings' | 'stemMappings', id: string, field: keyof AgentMappingRule, value: any) => {
        setConfig(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [type]: prev[activeTab][type].map(rule => rule.id === id ? { ...rule, [field]: value } : rule)
            }
        }));
    };

    const removeMapping = (type: 'masterMappings' | 'stemMappings', id: string) => {
        setConfig(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [type]: prev[activeTab][type].filter(rule => rule.id !== id)
            }
        }));
    };

    if (isLoading) return <div className="text-gray-400 text-sm">Caricamento configurazione agente...</div>;

    const currentCat = config[activeTab];

    const renderMappingEditor = (title: string, type: 'masterMappings' | 'stemMappings') => (
        <div className="bg-black/20 border border-white/5 rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center mb-3">
                <h5 className="text-[10px] font-bold text-cyan-400 uppercase flex items-center gap-2">
                    <i className={type === 'masterMappings' ? "fas fa-layer-group" : "fas fa-music"}></i>
                    {title}
                </h5>
                <button onClick={() => addMapping(type)} className="text-[9px] bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded hover:bg-cyan-800 transition">
                    + Aggiungi Regola
                </button>
            </div>

            {currentCat[type].length === 0 ? (
                <p className="text-[9px] text-gray-500 italic">Nessuna regola configurata.</p>
            ) : (
                <div className="space-y-2">
                    {currentCat[type].map(rule => (
                        <div key={rule.id} className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-white/5 p-2 rounded">
                            <select
                                value={rule.bodyPart}
                                onChange={(e) => updateMapping(type, rule.id, 'bodyPart', e.target.value)}
                                className="flex-1 min-w-[120px] bg-black/40 border border-white/10 p-1.5 rounded text-white text-[9px] outline-none"
                            >
                                {Object.entries(BODY_PARTS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <i className="fas fa-arrow-right text-[8px] text-gray-500"></i>
                            <select
                                value={rule.audioParam}
                                onChange={(e) => updateMapping(type, rule.id, 'audioParam', e.target.value)}
                                className="flex-1 min-w-[120px] bg-black/40 border border-white/10 p-1.5 rounded text-white text-[9px] outline-none"
                            >
                                {Object.entries(AUDIO_PARAMS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>

                            {type === 'stemMappings' && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-gray-400">Stem Index:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={rule.targetStemIndex ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                            updateMapping(type, rule.id, 'targetStemIndex', val);
                                        }}
                                        placeholder="All"
                                        className="w-12 bg-black/40 border border-white/10 p-1.5 rounded text-white text-[9px] outline-none text-center"
                                        title="Lascia vuoto per applicare a tutti gli stem, oppure inserisci l'indice (0=primo, 1=secondo...)"
                                    />
                                </div>
                            )}

                            <button onClick={() => removeMapping(type, rule.id)} className="text-red-400 hover:text-red-300 ml-auto px-2">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="bg-black/30 p-6 rounded-lg border border-cyan-500/30 mb-6 relative">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h4 className="font-bold text-white flex items-center gap-2">
                        <i className="fas fa-person-running text-cyan-400 text-xl"></i>
                        Editor Skeleton Agent WHO
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase font-bold ml-1">Nuovo Modulo Live</span>
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                        Configura la logica di mappatura automatica dei parametri del corpo sugli effetti audio. Questa logica viene applicata nel pannello Live Console.
                    </p>
                </div>
                <button onClick={saveConfig} disabled={isSaving} className="bg-cyan-600 text-white px-4 py-2 rounded font-bold text-[10px] hover:bg-cyan-500 transition-colors uppercase tracking-widest flex items-center gap-2">
                    {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                    Salva Configurazione
                </button>
            </div>

            <div className="flex border-b border-white/10 mb-4 overflow-x-auto">
                {(Object.keys(config) as Array<keyof WhoAgentConfig>).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === cat ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {cat.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descrizione (Mostrata all'utente in Live)</label>
                    <textarea
                        value={currentCat.description}
                        onChange={(e) => updateCategoryDescription(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-[10px] focus:border-cyan-500 outline-none h-16 resize-none"
                    />
                </div>

                {renderMappingEditor('Regole Traccia Master (Senza Stems)', 'masterMappings')}
                {renderMappingEditor('Regole Traccia Multipla (Con Stems)', 'stemMappings')}
            </div>
            <p className="text-[9px] text-gray-600 mt-4 italic">* Le regole "Master" vengono applicate se il brano non ha strumenti separati (stems). Le regole "Multipla" vengono usate come assegnazione predefinita quando gli stem sono disponibili.</p>
        </div>
    );
};
