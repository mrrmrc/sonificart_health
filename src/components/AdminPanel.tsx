import React, { useState, useEffect, useCallback } from 'react';
import { ShowcaseProject, SystemStats, User, SystemLog } from '../types';
import { api } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { MusicAiProvider, MusicProviderType, getMusicProviders, saveMusicProviders, testMusicProvider, DEFAULT_SOUNDVERSE_PROVIDER } from '../services/musicAiService';

// --- INTERFACCE ---
interface AccessRequest {
    id: string;
    name: string;
    email: string;
    plan: string;
    piva: string;
    reason?: string;
    institution_type?: string;
    purpose?: string;
    website?: string;
    phone?: string;
    city?: string;
    invoice_sent: boolean;
    paid: boolean;
    created_at: string;
}

const emptyProject: Omit<ShowcaseProject, 'id'> = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    author: '',
    description: '',
    imageUrl: '',
    paradigm: 'scientific',
    tradition: '',
    tags: [],
    stats: { duration: '0m 00s', notes: 0 },
    audioUrl: '',
    videoUrl: ''
};

type AdminTab = 'overview' | 'requests' | 'users' | 'showcase' | 'logs' | 'database' | 'settings' | 'cookies' | 'api' | 'agents';

const StatCard: React.FC<{ title: string; value: string | number; subtext: string; icon: string; color: string }> = ({ title, value, subtext, icon, color }) => (
    <div className="bg-brand-secondary/40 p-6 rounded-xl border border-brand-secondary flex items-center gap-4 hover:bg-brand-secondary/60 transition-colors">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${color}`}><i className={`fas ${icon}`}></i></div>
        <div>
            <p className="text-brand-text-secondary text-sm uppercase tracking-wider font-bold">{title}</p>
            <h3 className="text-2xl font-bold text-white truncate max-w-[150px]" title={String(value)}>{value}</h3>
            <p className="text-[10px] text-brand-text-secondary/70">{subtext}</p>
        </div>
    </div>
);

const ProgressBar: React.FC<{ label: string; value: number; max: number; unit: string; colorClass: string }> = ({ label, value, max, unit, colorClass }) => {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-bold text-white">{label}</span>
                <span className="text-xs text-brand-text-secondary font-mono">{value.toLocaleString()} / {max.toLocaleString()} {unit} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-brand-primary rounded-full h-3 overflow-hidden border border-brand-secondary/50">
                <div className={`h-full rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

// --- PROVIDER EDIT MODAL ---
interface ProviderModalProps {
    provider?: MusicAiProvider | null;
    onClose: () => void;
    onSave: (p: MusicAiProvider) => void;
}

const ProviderEditModal: React.FC<ProviderModalProps> = ({ provider, onClose, onSave }) => {
    const isNew = !provider;
    const [name, setName] = useState(provider?.name || '');
    const [type, setType] = useState<MusicProviderType>(provider?.type || 'custom_webhook');
    const [apiKey, setApiKey] = useState(provider?.apiKey || '');
    const [endpointUrl, setEndpointUrl] = useState(provider?.endpointUrl || '');
    const [authHeaderName, setAuthHeaderName] = useState(provider?.authHeaderName || 'Authorization');
    const [description, setDescription] = useState(provider?.description || '');
    
    const [showKey, setShowKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleTestInModal = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const p: MusicAiProvider = {
                id: provider?.id || 'temp_test',
                name: name || 'Test Provider',
                type,
                apiKey: apiKey.trim(),
                endpointUrl: type === 'soundverse' ? 'https://apiv2.soundverse.ai/v7/generate/music' : endpointUrl.trim(),
                authHeaderName: authHeaderName.trim() || 'Authorization',
                isDefault: false
            };
            const res = await testMusicProvider(p);
            if (res.success) {
                setTestResult({ success: true, message: res.message || "Connessione verificata con successo!" });
            } else {
                setTestResult({ success: false, message: res.error || "Test fallito." });
            }
        } catch (e: any) {
            setTestResult({ success: false, message: e.message || "Errore test connessione." });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return alert("Inserisci il nome del provider.");
        if (type !== 'soundverse' && !endpointUrl.trim()) return alert("Inserisci l'URL dell'Endpoint API.");

        const updated: MusicAiProvider = {
            id: provider?.id || `provider_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: name.trim(),
            type,
            apiKey: apiKey.trim(),
            endpointUrl: type === 'soundverse' ? 'https://apiv2.soundverse.ai/v7/generate/music' : endpointUrl.trim(),
            authHeaderName: authHeaderName.trim() || 'Authorization',
            isDefault: provider?.isDefault || false,
            description: description.trim()
        };

        onSave(updated);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <div className="bg-[#1e1e2e] p-6 rounded-xl max-w-lg w-full border border-white/10 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-server text-brand-accent"></i>
                    {isNew ? 'Aggiungi Nuovo Provider Musica AI' : 'Modifica Provider Musica AI'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Nome Provider</label>
                        <input
                            required
                            className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-sm focus:border-brand-accent outline-none"
                            placeholder="Es: Custom Webhook AI / Suno Wrapper"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Tipo di Integrazione</label>
                        <select
                            className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-sm focus:border-brand-accent outline-none"
                            value={type}
                            onChange={e => {
                                const newType = e.target.value as MusicProviderType;
                                setType(newType);
                                if (newType === 'soundverse' && !name) setName('Soundverse AI (Predefinito)');
                            }}
                        >
                            <option value="soundverse">Soundverse AI (Nativo)</option>
                            <option value="custom_webhook">Custom Webhook POST (REST JSON)</option>
                            <option value="generic_rest">Generic REST API (Headers Custom)</option>
                        </select>
                    </div>

                    {type !== 'soundverse' && (
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Endpoint URL API</label>
                            <input
                                required
                                type="url"
                                className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-sm font-mono focus:border-brand-accent outline-none"
                                placeholder="https://api.tuodominio.com/v1/generate-music"
                                value={endpointUrl}
                                onChange={e => setEndpointUrl(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">API Key / Secret Token</label>
                            <div className="relative">
                                <input
                                    type={showKey ? "text" : "password"}
                                    className="w-full bg-black/40 border border-white/10 p-2.5 pr-10 rounded text-white text-sm font-mono focus:border-brand-accent outline-none"
                                    placeholder="sk_... o secret token"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white text-xs"
                                    title={showKey ? "Nascondi chiave" : "Mostra chiave"}
                                >
                                    <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>

                        {type !== 'soundverse' && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Header Autenticazione</label>
                                <input
                                    className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-sm font-mono focus:border-brand-accent outline-none"
                                    placeholder="Authorization"
                                    value={authHeaderName}
                                    onChange={e => setAuthHeaderName(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Note / Descrizione (Opzionale)</label>
                        <input
                            className="w-full bg-black/40 border border-white/10 p-2.5 rounded text-white text-xs focus:border-brand-accent outline-none"
                            placeholder="Es: Modello a basso costo..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {testResult && (
                        <div className={`p-3 rounded-lg border text-xs font-bold ${testResult.success ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' : 'bg-red-950/50 border-red-500/40 text-red-300'}`}>
                            <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-1.5`}></i>
                            {testResult.message}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={handleTestInModal}
                            disabled={isTesting || !apiKey.trim()}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <i className={`fas fa-stethoscope ${isTesting ? 'fa-spin' : ''}`}></i>
                            {isTesting ? 'Verifica in corso...' : 'Testa Chiave Ora'}
                        </button>

                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xs px-4 py-2">Annulla</button>
                            <button type="submit" className="bg-brand-accent text-brand-primary px-6 py-2 rounded font-bold text-xs hover:bg-brand-accent-light transition-all">
                                {isNew ? 'Aggiungi Provider' : 'Salva Modifiche'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- USER EDIT MODAL ---
interface UserEditModalProps {
    user?: User | null;
    onClose: () => void;
    onSave: (u: Partial<User> & { password?: string }, isNew: boolean) => void;
    onDelete?: (id: string) => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onSave, onDelete }) => {
    const isCreating = !user;
    const [firstName, setFirstName] = useState(user ? user.name.split(' ')[0] : '');
    const [lastName, setLastName] = useState(user ? user.name.split(' ').slice(1).join(' ') : '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    // Determine initial role state
    const getInitialRole = () => {
        if (user?.isAdmin) return 'admin';
        if (user?.isPro) return 'pro';
        if ((user?.credits || 0) > 20) return 'custom';
        return 'free';
    };
    const [role, setRole] = useState<'free' | 'pro' | 'admin' | 'custom'>(getInitialRole());
    const [tier, setTier] = useState<'free' | 'pro' | 'custom'>(user?.tier || 'free');
    const [credits, setCredits] = useState(user?.credits || 5);
    const [customLogoUrl, setCustomLogoUrl] = useState(user?.customLogoUrl || '');

    const handleRoleChange = (r: 'free' | 'pro' | 'admin' | 'custom') => {
        setRole(r);
        if (r === 'free') { setCredits(5); setTier('free'); }
        if (r === 'pro') { setCredits(9999); setTier('pro'); }
        if (r === 'admin') { setCredits(9999); setTier('pro'); } // Gli admin sono solitamente pro
        if (r === 'custom') { setCredits(100); setTier('custom'); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullName = `${firstName} ${lastName}`.trim();

        const isPro = role === 'pro' || role === 'admin';
        const isAdmin = role === 'admin';

        const userData: Partial<User> & { password?: string, tier: string, customLogoUrl?: string } = {
            id: user?.id,
            name: fullName,
            email,
            isPro,
            isAdmin,
            credits,
            tier,
            customLogoUrl: tier === 'custom' ? customLogoUrl : undefined,
            avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`
        };
        if (password) userData.password = password;
        onSave(userData, isCreating);
    };

    const handleDelete = () => {
        if (user && onDelete) {
            onDelete(user.id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <div className="bg-[#1e1e2e] p-8 rounded-xl max-w-lg w-full border border-white/10" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-6">{isCreating ? 'Nuovo Utente' : 'Modifica Utente'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" placeholder="Nome" value={firstName} onChange={e => setFirstName(e.target.value)} />
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" placeholder="Cognome" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                    <input className="w-full bg-black/30 border border-white/10 p-2 rounded text-white" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <div className="grid grid-cols-2 gap-4">
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" type="password" placeholder="Password (lascia vuoto se invariata)" value={password} onChange={e => setPassword(e.target.value)} />
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" type="number" placeholder="Crediti" value={credits} onChange={e => setCredits(parseInt(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {['free', 'custom', 'pro', 'admin'].map(r => (
                            <button key={r} type="button" onClick={() => handleRoleChange(r as any)} className={`p-2 rounded text-[10px] font-bold uppercase ${role === r ? 'bg-brand-accent text-black' : 'bg-black/30 text-gray-400'}`}>{r}</button>
                        ))}
                    </div>
                    {role === 'custom' && (
                        <input className="w-full bg-black/30 border border-white/10 p-2 rounded text-white text-xs" placeholder="URL Logo Custom (per museum mode)" value={customLogoUrl} onChange={e => setCustomLogoUrl(e.target.value)} />
                    )}
                    <div className="flex justify-between mt-6 pt-4 border-t border-white/10">
                        {!isCreating && onDelete && <button type="button" onClick={handleDelete} className="text-red-400 text-xs">Elimina</button>}
                        <div className="flex gap-2 ml-auto">
                            <button type="button" onClick={onClose} className="text-gray-400 text-xs px-4">Annulla</button>
                            <button type="submit" className="bg-brand-accent text-black px-6 py-2 rounded font-bold text-xs">Salva</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- EDITABLE CELL ---
const EditableCell: React.FC<{ value: any, col: string, id: string, table: string, onUpdate: (val: any) => void }> = ({ value, col, id, table, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value ?? ''));

    const handleSave = () => {
        setIsEditing(false);
        if (editValue !== String(value ?? '')) {
            onUpdate(editValue);
        }
    };

    if (isEditing) {
        return (
            <td className="p-2 border-r border-white/5 last:border-0 bg-brand-accent/10">
                <input
                    autoFocus
                    className="w-full bg-transparent text-white font-mono outline-none border-b border-brand-accent"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') { setEditValue(String(value ?? '')); setIsEditing(false); }
                    }}
                />
            </td>
        );
    }

    return (
        <td
            className="p-2 border-r border-white/5 last:border-0 max-w-[200px] truncate cursor-pointer hover:bg-white/10 transition-colors"
            title={`${col}: ${String(value)} (Double click to edit)`}
            onDoubleClick={() => {
                // Prevent editing IDs or sensitive readonly cols if needed (though API checks too)
                if (col === 'id') return;
                setIsEditing(true);
                setEditValue(String(value ?? ''));
            }}
        >
            {value === null ? <span className="text-gray-600">NULL</span> : (typeof value === 'boolean' ? (value ? '1' : '0') : String(value))}
        </td>
    );
};

// --- ADMIN PANEL ---
export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [dbTables, setDbTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableData, setTableData] = useState<{ columns: string[], rows: any[] } | null>(null);
    const [cookieLogs, setCookieLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Settings State
    const [settingKey, setSettingKey] = useState('privacy_policy');
    const [settingsContent, setSettingsContent] = useState('');

    const SETTING_KEYS: { [key: string]: string } = {
        'privacy_policy': 'Informativa Privacy',
        'terms_of_service': 'Termini di Servizio',
        'cookie_policy': 'Cookie Policy',
        'image_upload_policy': 'Informativa Upload Immagini',
        'notice_and_takedown': 'Notice & Takedown',
        'upload_disclaimer': 'Disclaimer Upload'
    };

    // API Settings State
    const [apiSettings, setApiSettings] = useState({ gemini_api_key: '', gemini_api_email: '', gemini_api_budget: '', soundverse_api_key: '' });
    const [isTestingApi, setIsTestingApi] = useState(false);

    // Soundverse Balance State
    const [soundverseBalance, setSoundverseBalance] = useState<{
        totalCredits?: number;
        baseEffective?: number;
        extraCents?: number;
        error?: string;
        loading: boolean;
    }>({ loading: false });

    // Multi-Provider State
    const [musicProviders, setMusicProviders] = useState<MusicAiProvider[]>([]);
    const [activeProviderId, setActiveProviderId] = useState<string>('');
    const [editingProvider, setEditingProvider] = useState<MusicAiProvider | null>(null);
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

    const loadMusicProvidersData = useCallback(async () => {
        try {
            const data = await getMusicProviders();
            setMusicProviders(data.providers);
            setActiveProviderId(data.activeProvider?.id || data.providers[0]?.id || '');
        } catch (e) {
            console.error("Errore caricamento provider musica:", e);
        }
    }, []);

    const fetchSoundverseBalance = useCallback(async (keyOverride?: string) => {
        setSoundverseBalance(prev => ({ ...prev, loading: true, error: undefined }));
        try {
            const { getSoundverseBalance } = await import('../services/soundverseService');
            const res = await getSoundverseBalance(keyOverride || apiSettings.soundverse_api_key);
            if (res.success) {
                setSoundverseBalance({
                    totalCredits: res.totalCredits,
                    baseEffective: res.baseEffective,
                    extraCents: res.extraCents,
                    loading: false
                });
            } else {
                setSoundverseBalance({
                    error: res.error || "Impossibile recuperare i crediti Soundverse",
                    loading: false
                });
            }
        } catch (e: any) {
            setSoundverseBalance({
                error: e.message || "Errore di connessione a Soundverse",
                loading: false
            });
        }
    }, [apiSettings.soundverse_api_key]);

    // Edit States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // Agents State
    const [healthAgentPrompt, setHealthAgentPrompt] = useState('');
    const [agentMatcherPrompt, setAgentMatcherPrompt] = useState('');
    const [agentOrchestratorPrompt, setAgentOrchestratorPrompt] = useState('');
    const [healthAgentDocument, setHealthAgentDocument] = useState('');
    const [uploadingAgentDoc, setUploadingAgentDoc] = useState(false);
    const [knowledgeBase, setKnowledgeBase] = useState<Array<{url: string, filename: string, rules: string, extracting?: boolean}>>([]);
    const [extractingDocIndex, setExtractingDocIndex] = useState<number | null>(null);

    // Conflict Resolution State
    const [conflictResolution, setConflictResolution] = useState<{
        isOpen: boolean;
        contradictions: string[];
        additions: string[];
        mergedPrompt: string;
        pendingUrl: string;
        pendingKb: any[];
    } | null>(null);

    // MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    // LOAD DATA
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'overview') {
                setStats(await api.getSystemStats());
                setRequests(api.getAccessRequests ? await api.getAccessRequests() : []);
                setUsers(await api.getAllUsers());
                fetchSoundverseBalance();
            }
            if (activeTab === 'users') setUsers(await api.getAllUsers());
            if (activeTab === 'showcase') setProjects(await api.getShowcase(true));
            if (activeTab === 'logs') setLogs(await api.getSystemLogs());
            if (activeTab === 'requests') setRequests(await api.getAccessRequests());
            if (activeTab === 'database') {
                setDbTables(await api.getDbTables());
                if (selectedTable) {
                    setTableData(await api.getDbTableContent(selectedTable));
                }
            }
            if (activeTab === 'settings') {
                setSettingsContent(await api.getAppSetting(settingKey));
            }
            if (activeTab === 'cookies') {
                setCookieLogs(await api.getCookieLogs());
            }
            if (activeTab === 'api') {
                const svKey = (await api.getAppSetting('soundverse_api_key')).replace(/<[^>]*>?/gm, '').trim() || "sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl";
                setApiSettings({
                    gemini_api_key: (await api.getAppSetting('gemini_api_key')).replace(/<[^>]*>?/gm, '').trim(),
                    gemini_api_email: (await api.getAppSetting('gemini_api_email')).replace(/<[^>]*>?/gm, '').trim(),
                    gemini_api_budget: (await api.getAppSetting('gemini_api_budget')).replace(/<[^>]*>?/gm, '').trim(),
                    soundverse_api_key: svKey
                });
                fetchSoundverseBalance(svKey);
                loadMusicProvidersData();
            }
            if (activeTab === 'agents') {
                const promptRaw = await api.getAppSetting('agent_health_prompt');
                const matcherPromptRaw = await api.getAppSetting('agent_matcher_prompt');
                const orchestratorPromptRaw = await api.getAppSetting('agent_orchestrator_prompt');
                const docRaw = await api.getAppSetting('agent_health_document');
                setHealthAgentPrompt(promptRaw.replace(/<[^>]*>?/gm, '').trim());
                setAgentMatcherPrompt(matcherPromptRaw.replace(/<[^>]*>?/gm, '').trim());
                setAgentOrchestratorPrompt(orchestratorPromptRaw.replace(/<[^>]*>?/gm, '').trim());
                setHealthAgentDocument(docRaw.replace(/<[^>]*>?/gm, '').trim());
                try {
                    const kbRaw = await api.getAppSetting('agent_health_knowledge');
                    const cleaned = kbRaw.replace(/<[^>]*>?/gm, '').trim();
                    if (cleaned) setKnowledgeBase(JSON.parse(cleaned));
                } catch { /* no knowledge base yet */ }
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [activeTab, settingKey]);

    useEffect(() => {
        loadData();
        const i = setInterval(loadData, 15000);
        return () => clearInterval(i);
    }, [activeTab, settingKey, loadData]);

    const handleApprove = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Approva Richiesta",
            message: "Approvare questa richiesta? L'utente riceverà automaticamente le credenziali PRO via email.",
            type: 'success',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setIsLoading(true);
                try {
                    const res = await api.approveAccessRequest(id);
                    await loadData();
                    setConfirmModal({
                        isOpen: true,
                        title: "Successo",
                        message: res.mail_status
                            ? "Richiesta approvata e email inviata con successo!"
                            : "Utente creato ma l'invio della mail è fallito. Controlla i log del server.",
                        type: res.mail_status ? 'success' : 'warning',
                        singleButton: true,
                        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                    });
                } catch (e) {
                    setConfirmModal({
                        isOpen: true,
                        title: "Errore",
                        message: "Errore durante l'approvazione: " + (e instanceof Error ? e.message : "Errore sconosciuto"),
                        type: 'danger',
                        singleButton: true,
                        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                    });
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };
    const handleReject = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Rifiuta Richiesta",
            message: "Rifiutare questa richiesta?",
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                await api.rejectAccessRequest(id);
                loadData();
            }
        });
    };

    const handleRequestUpdate = async (id: string, field: 'invoice_sent' | 'paid', value: boolean) => {
        try {
            await api.updateAccessRequest(id, field, value);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        } catch (e) {
            console.error(e);
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: "Errore aggiornamento status",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    const handleDeleteProject = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Elimina Opera",
            message: "Eliminare definitivamente questa opera dalla vetrina?",
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                await api.deleteShowcaseItem(id);
                loadData();
            }
        });
    };

    const handleImpersonate = async (u: User) => {
        if (!confirm(`Sei sicuro di voler accedere come ${u.name}?`)) return;
        try {
            const data = await api.impersonateUser(u.id);
            if (data.token) {
                localStorage.setItem('sonificart_auth_token', data.token);
                sessionStorage.removeItem('sonificart_token'); // Clear strictly
                window.location.href = '/dashboard';
            }
        } catch (e) {
            alert("Errore accesso come utente: " + e);
        }
    };

    const handleUserSave = async (userData: Partial<User>, isNew: boolean) => {
        try {
            if (isNew) await api.adminCreateUser(userData); else await api.updateUser(userData as any);
            loadData(); setEditingUser(null); setIsCreatingUser(false);
        } catch (e) {
            setConfirmModal({
                isOpen: true,
                title: "Errore Utente",
                message: "Errore durante l'operazione sull'utente.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };
    const handleUserDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Elimina Utente",
            message: "Sei sicuro di voler eliminare definitivamente questo utente e tutti i suoi dati?",
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await api.deleteUser(id);
                    loadData();
                    setEditingUser(null);
                } catch (e) {
                    setConfirmModal({
                        isOpen: true,
                        title: "Errore",
                        message: "Errore eliminazione utente",
                        type: 'danger',
                        singleButton: true,
                        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                    });
                }
            }
        });
    };

    const handleShowcaseUpdate = async (id: string, updates: Partial<ShowcaseProject>) => {
        try {
            await api.updateShowcaseItem({ id, ...updates });
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        } catch (e) {
            console.error(e);
        }
    };

    const handleSettingsSave = async () => {
        setIsLoading(true);
        try {
            await api.updateAppSetting(settingKey, settingsContent);
            setConfirmModal({
                isOpen: true,
                title: "Salvataggio Riuscito",
                message: `Il documento "${SETTING_KEYS[settingKey]}" è stato aggiornato con successo.`,
                type: 'success',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } catch (e) {
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: "Impossibile salvare le modifiche: " + (e instanceof Error ? e.message : "Errore sconosciuto"),
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAgentSave = async () => {
        setIsLoading(true);
        try {
            await api.updateAppSetting('agent_health_prompt', healthAgentPrompt);
            await api.updateAppSetting('agent_matcher_prompt', agentMatcherPrompt);
            await api.updateAppSetting('agent_health_document', healthAgentDocument);
            await api.updateAppSetting('agent_health_knowledge', JSON.stringify(knowledgeBase));
            setConfirmModal({
                isOpen: true, title: "Salvataggio Riuscito", message: "Configurazione Agente salvata.", type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } catch (e) {
            setConfirmModal({
                isOpen: true, title: "Errore", message: "Errore salvataggio agente: " + (e instanceof Error ? e.message : ""), type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally { setIsLoading(false); }
    };

    const handleAgentDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAgentDoc(true);
        try {
            const url = await api.uploadAgentDocument(file);
            const newDoc = { url, filename: file.name, rules: '', extracting: true };
            const newKb = [...knowledgeBase, newDoc];
            setKnowledgeBase(newKb);
            const newIndex = newKb.length - 1;
            // Auto-extract rules and run conflict resolution
            try {
                const { extractDirectivesFromPDF, assessRulesConflict } = await import('../services/geminiService');
                const rules = await extractDirectivesFromPDF(url);
                
                // Instead of auto-saving, we run conflict assessment
                const assessment = await assessRulesConflict(rules);
                
                const updatedKb = newKb.map((doc, i) => i === newIndex ? { ...doc, rules, extracting: false } : doc);
                
                setConflictResolution({
                    isOpen: true,
                    contradictions: assessment.contradictions,
                    additions: assessment.additions,
                    mergedPrompt: assessment.mergedPrompt,
                    pendingUrl: url,
                    pendingKb: updatedKb
                });

            } catch (extractErr: any) {
                console.error("Estrazione PDF fallita:", extractErr);
                const updatedKb = newKb.map((doc, i) => i === newIndex ? { ...doc, rules: '⚠️ Estrazione fallita: ' + extractErr.message, extracting: false } : doc);
                setKnowledgeBase(updatedKb);
                await api.updateAppSetting('agent_health_knowledge', JSON.stringify(updatedKb));
            }
        } catch (error) {
            alert("Errore upload PDF: " + (error instanceof Error ? error.message : "Sconosciuto"));
        } finally {
            setUploadingAgentDoc(false);
            e.target.value = '';
        }
    };

    const handleApplyConflictResolution = async () => {
        if (!conflictResolution) return;
        setIsLoading(true);
        try {
            setKnowledgeBase(conflictResolution.pendingKb);
            setHealthAgentPrompt(conflictResolution.mergedPrompt);
            await api.updateAppSetting('agent_health_knowledge', JSON.stringify(conflictResolution.pendingKb));
            await api.updateAppSetting('agent_health_document', conflictResolution.pendingUrl);
            await api.updateAppSetting('agent_health_prompt', conflictResolution.mergedPrompt);
            setConfirmModal({
                isOpen: true, title: "Regole Aggiornate", message: "Il PDF è stato integrato e le regole sono state salvate.", type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } catch (e) {
            alert("Errore durante il salvataggio dell'integrazione.");
        } finally {
            setIsLoading(false);
            setConflictResolution(null);
        }
    };

    const handleResetAgents = async () => {
        if (!window.confirm("Sei sicuro di voler cancellare tutti i PDF e ripristinare il WHO Health Agent ai valori di base?")) return;
        setIsLoading(true);
        try {
            await api.updateAppSetting('agent_health_prompt', '');
            await api.updateAppSetting('agent_health_document', '');
            await api.updateAppSetting('agent_health_knowledge', '[]');
            setHealthAgentPrompt('');
            setHealthAgentDocument('');
            setKnowledgeBase([]);
            alert("Agenti ripristinati con successo.");
        } catch (e) {
            alert("Errore durante il ripristino.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-user-shield text-brand-accent"></i> Admin Dashboard</h2>
                <div className="bg-brand-secondary/50 p-1 rounded-lg flex overflow-x-auto">
                    {['overview', 'requests', 'users', 'showcase', 'logs', 'cookies', 'database', 'settings', 'api', 'agents'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-4 py-2 rounded text-sm font-bold capitalize whitespace-nowrap ${activeTab === tab ? 'bg-brand-accent text-black' : 'text-white hover:bg-white/10'}`}>
                            {tab === 'settings' ? 'Impostazioni' : (tab === 'cookies' ? 'Cookie Consent' : (tab === 'api' ? 'API & AI' : (tab === 'agents' ? 'Agenti AI' : tab)))} {tab === 'requests' && requests.length > 0 && `(${requests.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && !stats && <div className="text-center py-20 text-brand-accent animate-pulse">Caricamento dati...</div>}

            {!isLoading && activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <StatCard title="Utenti" value={stats.totalUsers} subtext="Registrati" icon="fa-users" color="bg-blue-500/20 text-blue-400" />
                        <StatCard title="Opere" value={stats.totalSonifications} subtext="Salvate" icon="fa-music" color="bg-purple-500/20 text-purple-400" />
                        <StatCard title="Crediti SV" value={soundverseBalance.loading ? '...' : (soundverseBalance.totalCredits !== undefined ? soundverseBalance.totalCredits : 'N/D')} subtext={soundverseBalance.error ? 'Errore bilancio' : 'Soundverse.ai'} icon="fa-coins" color={soundverseBalance.totalCredits && soundverseBalance.totalCredits > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"} />
                        <StatCard title="Richieste" value={requests.length} subtext="Totali" icon="fa-envelope" color="bg-yellow-500/20 text-yellow-400" />
                        <StatCard title="Server" value={(stats as any).serverOs || 'Linux'} subtext={`PHP ${(stats as any).phpVersion}`} icon="fa-server" color="bg-green-500/20 text-green-400" />
                    </div>

                    {stats.aiUsage && (
                        <div className="bg-[#1e1e2e] p-6 rounded-xl border border-white/10">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <i className="fas fa-brain text-brand-accent"></i> Analisi Consumi AI
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-white/5 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                                    <div className="text-3xl font-bold text-gray-400 mb-1">{stats.aiUsage.scientific}</div>
                                    <div className="text-xs text-brand-text-secondary uppercase tracking-widest text-center">Scientific (Algorithmic)</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Logic-based (Low Cost)</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-purple-500/30 flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10"><i className="fas fa-robot text-purple-500 text-5xl"></i></div>
                                    <div className="text-3xl font-bold text-purple-400 mb-1">{stats.aiUsage.hybrid}</div>
                                    <div className="text-xs text-purple-200 uppercase tracking-widest font-bold text-center">Hybrid (Vision AI)</div>
                                    <div className="text-[10px] text-purple-400/70 mt-1">Vision Analysis (Medium Cost)</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-pink-500/30 flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10"><i className="fas fa-magic text-pink-500 text-5xl"></i></div>
                                    <div className="text-3xl font-bold text-pink-400 mb-1">{stats.aiUsage.artistic}</div>
                                    <div className="text-xs text-pink-200 uppercase tracking-widest font-bold text-center">Artistic (Gen AI)</div>
                                    <div className="text-[10px] text-pink-400/70 mt-1">Music Generation (High Cost)</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white/5 p-4 rounded-lg flex gap-4 text-xs font-mono text-gray-400 overflow-x-auto">
                        <span>DB Version: <span className="text-white">{(stats as any).dbVersion || 'N/A'}</span></span>
                        <span>•</span>
                        <span>API Status: <span className="text-green-400">ONLINE</span></span>
                        <span>•</span>
                        <span>Connection: <span className="text-white">Secure</span></span>
                    </div>

                    <div className="bg-[#1e1e2e] rounded-xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Ultimi 5 Utenti</h3>
                        <table className="w-full text-left text-sm text-gray-400">
                            <tbody>
                                {users.slice(0, 5).map(u => (
                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-2">{u.name}</td>
                                        <td className="py-2">{u.email}</td>
                                        <td className="py-2 text-right">{u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={() => setActiveTab('users')} className="text-brand-accent text-xs mt-4 hover:underline">Vedi tutti &rarr;</button>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/30 text-gray-400 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Utente / Dettagli</th>
                                    <th className="p-4">Piano</th>
                                    <th className="p-4 text-center">Fattura</th>
                                    <th className="p-4 text-center">Pagato</th>
                                    <th className="p-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-white">
                                {requests.map(req => (
                                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-gray-400 text-xs whitespace-nowrap">{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 min-w-[200px]">
                                            <div className="font-bold">{req.name}</div>
                                            <div className="text-xs text-gray-400 flex flex-col gap-0.5">
                                                <span>{req.email}</span>
                                                <span className="font-mono text-[10px]">{req.piva}</span>
                                                {(req.phone || req.city) && (
                                                    <span className="text-[10px] text-brand-accent/80">
                                                        {req.phone} {req.phone && req.city && '•'} {req.city}
                                                    </span>
                                                )}
                                            </div>
                                            {req.plan === 'Enterprise' && (
                                                <div className="mt-2 text-xs bg-white/5 p-2 rounded border-l-2 border-purple-500">
                                                    {req.institution_type && <div><span className="text-gray-500">Tipo:</span> {req.institution_type}</div>}
                                                    {req.purpose && <div className="truncate max-w-[200px]" title={req.purpose}><span className="text-gray-500">Scopo:</span> {req.purpose}</div>}
                                                    {req.website && <div><a href={req.website} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline">Sito Web &nearr;</a></div>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${req.plan === 'Enterprise' ? 'bg-purple-500/20 text-purple-400' : 'bg-brand-accent/20 text-brand-accent'}`}>{req.plan}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={req.invoice_sent} onChange={e => handleRequestUpdate(req.id, 'invoice_sent', e.target.checked)} className="form-checkbox h-5 w-5 text-brand-accent rounded bg-gray-700 border-gray-600 focus:ring-brand-accent cursor-pointer transition-colors" />
                                        </td>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={req.paid} onChange={e => handleRequestUpdate(req.id, 'paid', e.target.checked)} className="form-checkbox h-5 w-5 text-green-500 rounded bg-gray-700 border-gray-600 focus:ring-green-500 cursor-pointer transition-colors" />
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleApprove(req.id)} className="bg-green-600/80 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold" title="Segna come completato / Archivia"><i className="fas fa-check"></i></button>
                                                <button onClick={() => handleReject(req.id)} className="bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold" title="Elimina Richiesta"><i className="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">Nessuna richiesta in attesa.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-white">Gestione Utenti</h3><button onClick={() => { setIsCreatingUser(true); setEditingUser(null); }} className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all"><i className="fas fa-plus mr-1"></i> Nuovo Utente</button></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/30 text-gray-400 uppercase text-xs"><tr><th className="p-4">ID</th><th className="p-4">Nome</th><th className="p-4">Email</th><th className="p-4">Ruolo</th><th className="p-4 text-right">Crediti</th><th className="p-4 text-right">Azioni</th></tr></thead>
                            <tbody className="divide-y divide-white/5 text-white">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-xs text-gray-500 font-mono">{u.id}</td>
                                        <td className="p-4 font-bold">{u.name}</td>
                                        <td className="p-4 text-gray-400">{u.email}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.isAdmin ? 'bg-red-500/20 text-red-400' : (u.isPro ? 'bg-yellow-500/20 text-yellow-400' : (u.credits > 20 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-300'))}`}>{u.isAdmin ? 'ADMIN' : (u.isPro ? 'PRO' : (u.credits > 20 ? 'CUSTOM' : 'FREE'))}</span></td>
                                        <td className="p-4 text-right font-mono">
                                            {u.isAdmin ? '∞' : (
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-white">{u.credits}</span>
                                                    {u.creditsConsumed !== undefined && u.creditsConsumed > 0 && (
                                                        <span className="text-[10px] text-gray-500" title={`Crediti Consumati: ${u.creditsConsumed}`}>
                                                            (Iniz: {u.credits + u.creditsConsumed})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleImpersonate(u)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded mr-2" title="Accedi come utente"><i className="fas fa-sign-in-alt"></i></button>
                                            <button onClick={() => setEditingUser(u)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded"><i className="fas fa-edit"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'showcase' && (
                <div className="grid gap-4">
                    <div className="bg-brand-secondary/30 p-4 rounded-xl border border-white/5 mb-4 flex items-center justify-between text-xs text-gray-400">
                        <p><i className="fas fa-info-circle mr-2"></i> "Pubblica" rende visibile l'opera nel profilo dell'artista. "Vetrina Globale" la mostra nella Galleria Principale (Home/Gallery).</p>
                    </div>
                    {projects.map(p => (
                        <div key={p.id} className={`bg-white/5 p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${p.isPublic ? 'border-brand-accent/20' : 'border-white/5 opacity-60'}`}>
                            <div className="flex items-center gap-4 flex-grow w-full md:w-auto">
                                <img src={p.imageUrl} alt={p.title} className="w-16 h-16 rounded-lg object-cover bg-black/50 shadow-lg" />
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate text-base">{p.title}</p>
                                    <p className="text-xs text-brand-text-secondary">{p.author} • {p.date}</p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 uppercase font-mono">{p.paradigm}</span>
                                        {p.isFeatured && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold"><i className="fas fa-images mr-1"></i>Galleria</span>}
                                        {p.isHome && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold"><i className="fas fa-star mr-1"></i>Home</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full md:w-auto justify-end">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Priorità</span>
                                    <input
                                        type="number"
                                        value={p.priority || 0}
                                        onChange={e => handleShowcaseUpdate(p.id, { priority: parseInt(e.target.value) || 0 })}
                                        className="bg-black/40 border border-white/10 rounded w-16 px-2 py-1 text-center text-sm font-bold text-brand-accent focus:border-brand-accent outline-none"
                                    />
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Galleria</span>
                                    <button
                                        onClick={() => handleShowcaseUpdate(p.id, { isFeatured: !p.isFeatured })}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${p.isFeatured ? 'bg-purple-500 text-black shadow-lg shadow-purple-500/20' : 'bg-white/5 text-gray-600'}`}
                                        title="Mostra nella Galleria Principale"
                                    >
                                        <i className="fas fa-images"></i>
                                    </button>
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Home Page</span>
                                    <button
                                        onClick={() => handleShowcaseUpdate(p.id, { isHome: !p.isHome })}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${p.isHome ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-gray-600'}`}
                                        title="Mostra nella Vetrina Home (Slider)"
                                    >
                                        <i className="fas fa-star"></i>
                                    </button>
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Stato</span>
                                    <button
                                        onClick={() => handleShowcaseUpdate(p.id, { isPublic: !p.isPublic })}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${p.isPublic ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                    >
                                        {p.isPublic ? 'PUBBLICATA' : 'BOZZA'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {projects.length === 0 && <div className="text-center text-gray-500 py-20 bg-white/5 rounded-xl">La vetrina è vuota.</div>}
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 font-mono text-xs text-gray-400 h-96 overflow-y-auto">
                    {logs.length > 0 ? logs.map((l, i) => <div key={i} className="border-b border-white/5 py-1">{l.timestamp} - {l.action}: {l.details} <span className="text-[10px] opacity-70">[{l.level}]</span></div>) : "Nessun log disponibile o funzionalità log non attiva."}
                </div>
            )}

            {activeTab === 'database' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 p-6">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="w-full md:w-1/4">
                            <h3 className="font-bold text-white mb-2">Tabelle Database</h3>
                            <div className="bg-black/30 rounded-lg border border-white/10 overflow-hidden">
                                {dbTables.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { setSelectedTable(t); setIsLoading(true); api.getDbTableContent(t).then(setTableData).finally(() => setIsLoading(false)); }}
                                        className={`w-full text-left px-4 py-2 text-xs font-mono transition-colors border-b border-white/5 last:border-0 ${selectedTable === t ? 'bg-brand-accent text-brand-primary font-bold' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-3/4">
                            <h3 className="font-bold text-white mb-2 flex justify-between items-center">
                                <span>Contenuto: <span className="text-brand-accent font-mono">{selectedTable || 'Seleziona tabella'}</span></span>
                                {tableData && <span className="text-xs text-gray-500 font-mono">{tableData.rows.length} righe (limit 100)</span>}
                            </h3>
                            <div className="bg-black/30 rounded-lg border border-white/10 overflow-x-auto min-h-[300px]">
                                {tableData ? (
                                    <table className="w-full text-left text-xs font-mono whitespace-nowrap">
                                        <thead className="bg-white/5 text-brand-accent">
                                            <tr>
                                                {tableData.columns.map(c => <th key={c} className="p-2 border-b border-white/10">{c}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {tableData.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-white/5">
                                                    {tableData.columns.map(c => (
                                                        <EditableCell
                                                            key={c}
                                                            value={row[c]}
                                                            col={c}
                                                            id={row['id']}
                                                            table={selectedTable!}
                                                            onUpdate={(val) => {
                                                                // Optimistic update locally? Or just refetch. Refetch is safer.
                                                                api.adminUpdateCell(selectedTable!, String(row['id']), c, val)
                                                                    .then(() => {
                                                                        // Optional: toast success
                                                                        // Reload data
                                                                        api.getDbTableContent(selectedTable!).then(setTableData);
                                                                    })
                                                                    .catch(err => alert("Errore modifica: " + err.message));
                                                            }}
                                                        />
                                                    ))}
                                                </tr>
                                            ))}
                                            {tableData.rows.length === 0 && <tr><td colSpan={tableData.columns.length} className="p-8 text-center text-gray-500">Tabella vuota</td></tr>}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-gray-500 italic">Seleziona una tabella per vederne il contenuto.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Gestione Termini e Policy</h3>
                        <div className="flex gap-2">
                            {Object.entries(SETTING_KEYS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setSettingKey(key)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${settingKey === key ? 'bg-brand-accent text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-sm text-gray-400 mb-4">
                        Modifica il contenuto di <strong>{SETTING_KEYS[settingKey]}</strong>. Supporta testo formattato in HTML.
                    </p>
                    <textarea
                        value={settingsContent}
                        onChange={(e) => setSettingsContent(e.target.value)}
                        className="w-full h-[500px] bg-black/30 border border-white/10 rounded-lg p-4 text-white text-sm font-mono focus:border-brand-accent outline-none resize-y"
                        placeholder="<h1>Titolo</h1><p>Inserisci qui il contenuto HTML...</p>"
                    />
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={handleSettingsSave}
                            disabled={isLoading}
                            className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary px-6 py-2 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Salvataggio...' : 'Salva Modifiche'}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'cookies' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-white">Registro Consensi Cookie (GDPR)</h3>
                        <div className="text-[10px] text-gray-500 font-mono">Last 500 entries</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono whitespace-nowrap">
                            <thead className="bg-black/30 text-gray-400 uppercase">
                                <tr>
                                    <th className="p-3">Timestamp</th>
                                    <th className="p-3">UUID</th>
                                    <th className="p-3">IP</th>
                                    <th className="p-3">A (Analitici)</th>
                                    <th className="p-3">M (Marketing)</th>
                                    <th className="p-3">User Agent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {cookieLogs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 text-white">{log.timestamp}</td>
                                        <td className="p-3 text-brand-accent" title={log.consent_uuid}>{log.consent_uuid?.substring(0, 8)}...</td>
                                        <td className="p-3">{log.ip_address}</td>
                                        <td className="p-3">
                                            <span className={log.analytics ? 'text-green-400' : 'text-red-400'}>
                                                {log.analytics ? 'SI' : 'NO'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={log.marketing ? 'text-green-400' : 'text-red-400'}>
                                                {log.marketing ? 'SI' : 'NO'}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-[200px] truncate" title={log.user_agent}>{log.user_agent}</td>
                                    </tr>
                                ))}
                                {cookieLogs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">Nessun log consensi registrato.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'agents' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><i className="fas fa-robot text-brand-accent"></i> Configurazione Agenti AI</h3>

                    <div className="bg-black/30 p-6 rounded-lg border border-white/10 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <h4 className="font-bold text-white">WHO Matcher Agent (Classificatore)</h4>
                                <p className="text-xs text-gray-400">Logica base certificata per l'abbinamento colori-terapia. <span className="text-brand-accent">Sola lettura per protezione certificazione.</span></p>
                            </div>
                            <i className="fas fa-lock text-brand-accent text-2xl"></i>
                        </div>
                        <div className="mb-4 mt-4">
                            <pre className="w-full bg-black/50 border border-white/10 rounded p-4 text-gray-300 font-mono text-xs whitespace-pre-wrap overflow-auto">
{`1. Calming (BPM 64): Colori freddi (blu/verde), bassa saturazione.
2. Physiological (BPM 74): Elevata varianza, colori neutri.
3. Cognitive/Motor (BPM 108): Alta diversità cromatica, forte dettaglio.
4. Social/Emotional (BPM 86): Colori caldi (rosso/arancio), presenza di persone.
5. Motivation (BPM 118): Contrasti forti, alta saturazione, dinamismo visivo.`}
                            </pre>
                        </div>
                    </div>

                    <div className="bg-black/30 p-6 rounded-lg border border-white/10 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <h4 className="font-bold text-white">WHO-AI Music Orchestrator</h4>
                                <p className="text-xs text-gray-400">Traduci gli stati d'animo clinici in Tag Acustici per i generatori musicali (Suno/Soundverse).</p>
                            </div>
                            <i className="fas fa-music text-brand-accent text-2xl"></i>
                        </div>
                        <div className="mb-4 mt-4">
                            <label className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">Tabella di Conversione Deterministica</label>
                            <textarea 
                                value={agentOrchestratorPrompt || `- [Obiettivo: Calming / Riduzione Stress] -> TRADUCI IN: [Soothing, Deep Drone, Slow Tempo, Cinematic Ambient, Resonant Low Strings, Meditative, Minimalist]
- [Obiettivo: Regolazione Fisiologica / Dolore] -> TRADUCI IN: [Ethereal, Floating, Sustained Pads, Ambient Soundscape, Healing Hz, Soft Resonance, Drone]
- [Obiettivo: Stimolazione Cognitiva / Motoria] -> TRADUCI IN: [Rhythmic, Ostinato, Minimalist Pulse, Clear Transients, Percussive Elements, Moderate Tempo, Focused]
- [Obiettivo: Connessione Sociale / Emotiva] -> TRADUCI IN: [Warm, Orchestral, Expressive Cello, Emotional Cinematic, Harmonic Richness, Uplifting]
- [Obiettivo: Energia / Motivazione] -> TRADUCI IN: [Energizing, Bright, Driving Rhythm, Dynamic Cinematic, Upbeat, Forward Momentum]`}
                                onChange={e => setAgentOrchestratorPrompt(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-4 text-white font-mono text-xs h-40 focus:border-brand-accent focus:outline-none"
                                placeholder="Definisci i tag acustici..."
                            />
                            <p className="text-[10px] text-gray-500 mt-2">Usa questa tabella per orchestrare gli strumenti e il mood sonoro in base alle categorie WHO e ai Colori Dominanti identificati dal Matcher.</p>
                        </div>
                    </div>
                    
                    <div className="bg-black/30 p-6 rounded-lg border border-white/10 mb-6 relative">
                        <button onClick={handleResetAgents} className="absolute top-6 right-6 text-xs bg-red-900/50 hover:bg-red-900/80 text-red-200 border border-red-500/30 px-3 py-1 rounded transition-colors" title="Cancella tutti i PDF e il prompt personalizzato">
                            <i className="fas fa-undo mr-1"></i> Ripristina Default
                        </button>
                        <h4 className="font-bold text-white mb-2">WHO Health Agent (Benessere)</h4>
                        <p className="text-xs text-gray-400 mb-4">Istruzioni specifiche e base di conoscenza RAG per l'agente del benessere.</p>
                        
                        <div className="mb-6">
                            <label className="text-xs font-bold text-brand-text-secondary uppercase mb-1 block">Prompt Personalizzato / Direttive (Opzionale)</label>
                            <textarea 
                                value={healthAgentPrompt}
                                onChange={e => setHealthAgentPrompt(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 text-white font-mono text-xs h-32 focus:border-brand-accent focus:outline-none"
                                placeholder="Inserisci direttive aggiuntive per l'agente. Es: Fai in modo che la musica non induca mai sonno..."
                            />
                        </div>

                        {/* KNOWLEDGE BASE - Multiple PDFs */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-bold text-brand-text-secondary uppercase block">
                                    <i className="fas fa-brain mr-1"></i> Base di Conoscenza ({knowledgeBase.length} documenti)
                                </label>
                                <label className="bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent px-4 py-2 rounded text-sm font-bold cursor-pointer transition-colors border border-brand-accent/30">
                                    {uploadingAgentDoc ? <><i className="fas fa-spinner fa-spin mr-1"></i> Caricamento...</> : <><i className="fas fa-plus mr-1"></i> Aggiungi PDF</>}
                                    <input type="file" accept=".pdf" className="hidden" onChange={handleAgentDocUpload} disabled={uploadingAgentDoc} />
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-3">Ogni PDF caricato viene analizzato da Gemini AI. Le regole estratte arricchiscono il bagaglio di conoscenza dell'agente.</p>

                            {knowledgeBase.length === 0 ? (
                                <div className="bg-black/20 border border-dashed border-white/10 rounded-lg p-8 text-center">
                                    <i className="fas fa-file-pdf text-gray-600 text-3xl mb-2"></i>
                                    <p className="text-gray-500 text-sm">Nessun documento caricato</p>
                                    <p className="text-gray-600 text-xs">Carica uno o più PDF per costruire la base di conoscenza dell'agente</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {knowledgeBase.map((doc, idx) => (
                                        <div key={idx} className="bg-black/20 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-file-pdf text-red-400"></i>
                                                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-white hover:text-brand-accent transition-colors underline">{doc.filename}</a>
                                                    {doc.extracting && <span className="text-xs text-yellow-400 animate-pulse"><i className="fas fa-spinner fa-spin mr-1"></i> Estrazione regole in corso...</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                setKnowledgeBase(prev => prev.map((d, i) => i === idx ? { ...d, extracting: true } : d));
                                                                const { extractDirectivesFromPDF } = await import('../services/geminiService');
                                                                const rules = await extractDirectivesFromPDF(doc.url);
                                                                setKnowledgeBase(prev => {
                                                                    const updatedKb = prev.map((d, i) => i === idx ? { ...d, rules, extracting: false } : d);
                                                                    api.updateAppSetting('agent_health_knowledge', JSON.stringify(updatedKb));
                                                                    api.updateAppSetting('agent_health_prompt', rules);
                                                                    return updatedKb;
                                                                });
                                                            } catch (e: any) {
                                                                setKnowledgeBase(prev => prev.map((d, i) => i === idx ? { ...d, rules: '⚠️ Errore: ' + e.message, extracting: false } : d));
                                                            }
                                                        }}
                                                        className="text-brand-accent hover:text-brand-accent-light text-xs transition-colors"
                                                        title="Ri-estrai regole"
                                                    >
                                                        <i className="fas fa-sync-alt"></i>
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            const updatedKb = knowledgeBase.filter((_, i) => i !== idx);
                                                            setKnowledgeBase(updatedKb);
                                                            await api.updateAppSetting('agent_health_knowledge', JSON.stringify(updatedKb));
                                                            if (updatedKb.length === 0) {
                                                                await api.updateAppSetting('agent_health_document', '');
                                                                await api.updateAppSetting('agent_health_prompt', '');
                                                            }
                                                        }}
                                                        className="text-red-400 hover:text-red-300 text-xs transition-colors"
                                                        title="Rimuovi documento"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            {doc.rules && !doc.extracting && (
                                                <div className="bg-black/30 border border-white/5 rounded p-3 mt-2">
                                                    <p className="text-[10px] font-bold text-brand-accent uppercase mb-1"><i className="fas fa-lightbulb mr-1"></i> Regole Estratte</p>
                                                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{doc.rules}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={handleAgentSave} disabled={isLoading} className="bg-brand-accent text-black px-6 py-2 rounded font-bold text-sm hover:bg-brand-accent-light transition-colors">
                            {isLoading ? 'Salvataggio...' : 'Salva Configurazione Agente'}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'api' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white"><i className="fas fa-robot text-brand-accent mr-3"></i> Gestione API Google Gemini</h3>
                    </div>

                    <div className="space-y-6 max-w-3xl">
                        <div className="bg-gradient-to-r from-brand-accent/10 to-transparent p-4 rounded-lg border border-brand-accent/30 mb-2 flex items-center gap-4">
                            <div className="bg-brand-accent/20 p-3 rounded-full">
                                <i className="fas fa-microchip text-brand-accent text-xl"></i>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Motore AI Attivo</p>
                                <p className="text-lg font-bold text-white">Google Gemini 2.5 Flash</p>
                                <p className="text-[10px] text-gray-500">Modello di ultima generazione per ragionamento, analisi documenti e generazione prompt musicali</p>
                            </div>
                            <span className="ml-auto bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                                <i className="fas fa-circle text-[6px] mr-1 animate-pulse"></i> Attivo
                            </span>
                        </div>

                        <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Google AI Studio API Key</label>
                            <input 
                                type="password" 
                                value={apiSettings.gemini_api_key} 
                                onChange={e => setApiSettings(prev => ({...prev, gemini_api_key: e.target.value}))} 
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm font-mono focus:border-brand-accent outline-none" 
                                placeholder="AIzaSy..." 
                            />
                            <p className="text-[10px] text-gray-500 mt-1">La chiave usata per tutte le chiamate ad AI Generativa. Tieni questo valore al sicuro.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Notifiche (Info)</label>
                                <input 
                                    type="email" 
                                    value={apiSettings.gemini_api_email} 
                                    onChange={e => setApiSettings(prev => ({...prev, gemini_api_email: e.target.value}))} 
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-accent outline-none" 
                                    placeholder="admin@sonificart.com" 
                                />
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Budget / Scadenza (Info)</label>
                                <input 
                                    type="text" 
                                    value={apiSettings.gemini_api_budget} 
                                    onChange={e => setApiSettings(prev => ({...prev, gemini_api_budget: e.target.value}))} 
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-accent outline-none" 
                                    placeholder="Es: $50 / Scade: 31-12-2026" 
                                />
                            </div>
                        </div>

                        {/* MULTI-PROVIDER MUSIC AI SECTION */}
                        <div className="bg-[#181d26] p-6 rounded-xl border border-white/10 space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <i className="fas fa-sliders-h text-brand-accent"></i> Gestione Multi-Provider Musica AI
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">Configura molteplici API/Webhook per la generazione audio e seleziona il motore predefinito (Default).</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setEditingProvider(null); setIsProviderModalOpen(true); }}
                                    className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all whitespace-nowrap flex items-center gap-1.5"
                                >
                                    <i className="fas fa-plus"></i> Nuovo Provider API
                                </button>
                            </div>

                            <div className="space-y-4">
                                {musicProviders.map(p => {
                                    const isAct = p.id === activeProviderId;
                                    return (
                                        <div
                                            key={p.id}
                                            className={`p-5 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isAct ? 'bg-brand-accent/10 border-brand-accent shadow-lg shadow-brand-accent/5' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                                        >
                                            <div className="space-y-1 max-w-xl">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white text-base">{p.name}</span>
                                                    <span className="text-[10px] bg-white/10 text-gray-300 font-mono px-2 py-0.5 rounded uppercase font-bold">{p.type}</span>
                                                    {isAct && (
                                                        <span className="text-[10px] bg-brand-accent text-brand-primary font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase">
                                                            <i className="fas fa-check-circle"></i> Attivo (Default)
                                                        </span>
                                                    )}
                                                </div>
                                                {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                                                <div className="text-[11px] font-mono text-gray-500 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                                                    <span>Endpoint: <span className="text-gray-300">{p.endpointUrl || 'Soundverse API v7/v1'}</span></span>
                                                    {p.apiKey && <span>Key: <span className="text-gray-300">{p.apiKey.substring(0, 12)}...</span></span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                                                {!isAct && (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            setActiveProviderId(p.id);
                                                            await saveMusicProviders(musicProviders, p.id);
                                                        }}
                                                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-xs font-bold transition-all"
                                                    >
                                                        Imposta Default
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={testingProviderId === p.id}
                                                    onClick={async () => {
                                                        setTestingProviderId(p.id);
                                                        try {
                                                            const res = await testMusicProvider(p);
                                                            if (res.success) {
                                                                setConfirmModal({ isOpen: true, title: "Test Riuscito", message: res.message || `Provider ${p.name} raggiungibile!`, type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
                                                            } else {
                                                                setConfirmModal({ isOpen: true, title: "Test Fallito", message: res.error || `Impossibile contattare ${p.name}`, type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
                                                            }
                                                        } catch (e: any) {
                                                            setConfirmModal({ isOpen: true, title: "Errore Test", message: e.message, type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
                                                        } finally {
                                                            setTestingProviderId(null);
                                                        }
                                                    }}
                                                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50"
                                                >
                                                    <i className={`fas fa-stethoscope mr-1 ${testingProviderId === p.id ? 'fa-spin' : ''}`}></i> Test
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingProvider(p); setIsProviderModalOpen(true); }}
                                                    className="bg-white/5 hover:bg-white/10 text-gray-300 p-2 rounded text-xs transition-all"
                                                    title="Modifica Provider"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>

                                                {musicProviders.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setConfirmModal({
                                                                isOpen: true,
                                                                title: "Elimina Provider",
                                                                message: `Eliminare il provider "${p.name}"?`,
                                                                type: 'danger',
                                                                onConfirm: async () => {
                                                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                    const updated = musicProviders.filter(x => x.id !== p.id);
                                                                    const newActive = isAct ? updated[0].id : activeProviderId;
                                                                    setMusicProviders(updated);
                                                                    setActiveProviderId(newActive);
                                                                    await saveMusicProviders(updated, newActive);
                                                                }
                                                            });
                                                        }}
                                                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded text-xs transition-all"
                                                        title="Elimina Provider"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                            <button
                                onClick={async () => {
                                    setIsTestingApi(true);
                                    try {
                                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiSettings.gemini_api_key}`);
                                        if (res.ok) setConfirmModal({ isOpen: true, title: "API Gemini Valida", message: "Connessione a Google AI Studio effettuata con successo! La chiave è operativa.", type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                        else setConfirmModal({ isOpen: true, title: "Errore API Gemini", message: "Chiave Google non valida o scaduta.", type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                    } catch(e) {
                                        setConfirmModal({ isOpen: true, title: "Errore Rete", message: "Impossibile connettersi a Google.", type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                    } finally {
                                        setIsTestingApi(false);
                                    }
                                }}
                                disabled={isTestingApi || !apiSettings.gemini_api_key}
                                className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 text-xs"
                            >
                                <i className={`fas fa-stethoscope mr-2 ${isTestingApi ? 'fa-spin' : ''}`}></i> {isTestingApi ? 'Test Gemini...' : 'Test Google AI'}
                            </button>

                            <button
                                onClick={async () => {
                                    setIsTestingApi(true);
                                    try {
                                        const { checkSoundverseApi } = await import('../services/soundverseService');
                                        const check = await checkSoundverseApi(apiSettings.soundverse_api_key);
                                        if (check.success) {
                                            setConfirmModal({ isOpen: true, title: "API Soundverse Attiva", message: "Pre-flight OK! Connessione a Soundverse AI verificata ed operativa.", type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                        } else {
                                            setConfirmModal({ isOpen: true, title: "Errore Soundverse", message: check.error || "Chiave Soundverse non valida.", type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                        }
                                    } catch(e: any) {
                                        setConfirmModal({ isOpen: true, title: "Errore Test Soundverse", message: e.message, type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                    } finally {
                                        setIsTestingApi(false);
                                    }
                                }}
                                disabled={isTestingApi || !apiSettings.soundverse_api_key}
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-5 py-3 rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 text-xs"
                            >
                                <i className={`fas fa-compact-disc mr-2 ${isTestingApi ? 'fa-spin' : ''}`}></i> {isTestingApi ? 'Test Soundverse...' : 'Test Soundverse AI'}
                            </button>
                            
                            <button
                                onClick={async () => {
                                    setIsLoading(true);
                                    try {
                                        await api.updateAppSetting('gemini_api_key', apiSettings.gemini_api_key);
                                        await api.updateAppSetting('gemini_api_email', apiSettings.gemini_api_email);
                                        await api.updateAppSetting('gemini_api_budget', apiSettings.gemini_api_budget);
                                        await api.updateAppSetting('soundverse_api_key', apiSettings.soundverse_api_key);
                                        setConfirmModal({ isOpen: true, title: "Salvataggio Riuscito", message: "Impostazioni API (Gemini e Soundverse) aggiornate con successo.", type: 'success', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                    } catch(e) {
                                        setConfirmModal({ isOpen: true, title: "Errore Salvataggio", message: "Impossibile salvare: " + (e as Error).message, type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false })) });
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                                className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary px-6 py-3 rounded-lg font-bold shadow-lg transition-all ml-auto disabled:opacity-50"
                            >
                                <i className="fas fa-save mr-2"></i> {isLoading ? 'Salvataggio...' : 'Salva Impostazioni'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(editingUser || isCreatingUser) && <UserEditModal user={editingUser} onClose={() => { setEditingUser(null); setIsCreatingUser(false); }} onSave={handleUserSave} onDelete={!isCreatingUser ? handleUserDelete : undefined} />}

            {isProviderModalOpen && (
                <ProviderEditModal
                    provider={editingProvider}
                    onClose={() => setIsProviderModalOpen(false)}
                    onSave={async (p) => {
                        setIsProviderModalOpen(false);
                        const exists = musicProviders.some(x => x.id === p.id);
                        const updated = exists ? musicProviders.map(x => x.id === p.id ? p : x) : [...musicProviders, p];
                        setMusicProviders(updated);
                        await saveMusicProviders(updated, activeProviderId || p.id);

                        if (p.type === 'soundverse' && p.apiKey) {
                            setApiSettings(prev => ({ ...prev, soundverse_api_key: p.apiKey }));
                            fetchSoundverseBalance(p.apiKey);
                        }
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* CONFLICT RESOLUTION MODAL */}
            {conflictResolution && conflictResolution.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#1e1e2e] p-6 rounded-xl max-w-2xl w-full border border-yellow-500/30 space-y-4 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> Valutazione Impatto Scientifico
                        </h3>
                        <p className="text-sm text-gray-300">
                            Gemini ha analizzato il nuovo PDF e lo ha confrontato con le regole certificate di default.
                        </p>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {conflictResolution.contradictions.length > 0 ? (
                                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                                    <h4 className="text-red-400 font-bold mb-2"><i className="fas fa-times-circle mr-2"></i>Contraddizioni Rilevate (Ignorate)</h4>
                                    <ul className="list-disc list-inside text-sm text-red-200/80 space-y-1">
                                        {conflictResolution.contradictions.map((c, i) => <li key={i}>{c}</li>)}
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
                                    <h4 className="text-green-400 font-bold mb-2"><i className="fas fa-check-circle mr-2"></i>Nessuna Contraddizione</h4>
                                    <p className="text-sm text-green-200/80">Il documento è in perfetta armonia con le regole base.</p>
                                </div>
                            )}

                            {conflictResolution.additions.length > 0 && (
                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                                    <h4 className="text-blue-400 font-bold mb-2"><i className="fas fa-plus-circle mr-2"></i>Integrazioni Accettate</h4>
                                    <ul className="list-disc list-inside text-sm text-blue-200/80 space-y-1">
                                        {conflictResolution.additions.map((a, i) => <li key={i}>{a}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="bg-black/50 border border-white/10 p-4 rounded-lg">
                                <h4 className="text-white font-bold mb-2">Prompt Finale (Health Agent)</h4>
                                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">{conflictResolution.mergedPrompt}</pre>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-4">
                            <button
                                onClick={() => setConflictResolution(null)}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Annulla e Scarta PDF
                            </button>
                            <button
                                onClick={handleApplyConflictResolution}
                                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded shadow-lg transition-colors"
                            >
                                Approva e Applica
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};