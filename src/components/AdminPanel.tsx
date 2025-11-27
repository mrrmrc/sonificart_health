
import React, { useState, useEffect } from 'react';
import { ShowcaseProject, Paradigm, SystemStats, User, SystemLog } from '../types';
import { api } from '../services/api';
import { getVideoConfig } from '../utils/videoUtils';

const emptyProject: Omit<ShowcaseProject, 'id'> = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    author: '',
    description: '',
    imageUrl: '',
    paradigm: 'scientific',
    tradition: '',
    tags: [],
    stats: {
        duration: '0m 00s',
        notes: 0
    },
    audioUrl: '',
    videoUrl: ''
};

type AdminTab = 'overview' | 'users' | 'showcase' | 'logs';
type MediaType = 'image' | 'video';

const StatCard: React.FC<{ title: string; value: string | number; subtext: string; icon: string; color: string }> = ({ title, value, subtext, icon, color }) => (
    <div className="bg-brand-secondary/40 p-6 rounded-xl border border-brand-secondary flex items-center gap-4 hover:bg-brand-secondary/60 transition-colors">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${color}`}>
            <i className={`fas ${icon}`}></i>
        </div>
        <div>
            <p className="text-brand-text-secondary text-sm uppercase tracking-wider font-bold">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            <p className="text-xs text-brand-text-secondary/70">{subtext}</p>
        </div>
    </div>
);

const ProgressBar: React.FC<{ label: string; value: number; max: number; unit: string; colorClass: string }> = ({ label, value, max, unit, colorClass }) => {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 100;
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

// --- USER EDIT / CREATE MODAL ---
interface UserEditModalProps {
    user?: User | null; // If null, we are creating a new user
    onClose: () => void;
    onSave: (u: Partial<User> & { password?: string }, isNew: boolean) => void;
    onDelete?: (id: string) => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onSave, onDelete }) => {
    const isCreating = !user;
    
    // Parse name into First/Last if possible
    const initialName = user?.name || '';
    const splitName = initialName.split(' ');
    const initialFirstName = splitName[0] || '';
    const initialLastName = splitName.slice(1).join(' ') || '';

    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'free' | 'pro' | 'admin'>(
        user?.isAdmin ? 'admin' : user?.isPro ? 'pro' : 'free'
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const fullName = `${firstName} ${lastName}`.trim();
        
        const userData: Partial<User> & { password?: string } = {
            id: user?.id,
            name: fullName,
            email,
            isPro: role === 'pro' || role === 'admin',
            isAdmin: role === 'admin',
            avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`
        };

        if (password) {
            userData.password = password;
        }

        onSave(userData, isCreating);
    };

    const handleDelete = () => {
        if (user && onDelete) {
            if (window.confirm(`Sei ASSOLUTAMENTE sicuro di voler eliminare l'utente ${user.name}? Questa azione è irreversibile.`)) {
                onDelete(user.id);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-black/60 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 animate-zoom-in p-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-white">
                            {isCreating ? 'Nuovo Utente' : 'Modifica Profilo'}
                        </h3>
                        <p className="text-sm text-brand-text-secondary">
                            {isCreating ? 'Inserisci i dati per creare un nuovo account.' : `Gestione account ID: ${user?.id}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white text-xl">&times;</button>
                </div>

                {!isCreating && user && (
                    <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-lg border border-white/10">
                        <img src={user.avatarUrl} className="w-12 h-12 rounded-full border border-white/20" alt="" />
                        <div>
                            <p className="text-white font-bold">{user.name}</p>
                            <div className="flex gap-2 mt-1">
                                {user.isAdmin && <span className="text-[10px] bg-red-900/50 text-red-200 px-2 py-0.5 rounded border border-red-500/30">ADMIN</span>}
                                {user.isPro && <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded border border-brand-accent/30">PRO</span>}
                            </div>
                        </div>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Nome *</label>
                            <input required type="text" className="w-full bg-black/40 border border-white/10 focus:border-brand-accent p-3 rounded text-white outline-none transition-colors" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Mario" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Cognome *</label>
                            <input required type="text" className="w-full bg-black/40 border border-white/10 focus:border-brand-accent p-3 rounded text-white outline-none transition-colors" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rossi" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Email *</label>
                        <input required type="email" className="w-full bg-black/40 border border-white/10 focus:border-brand-accent p-3 rounded text-white outline-none transition-colors" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@esempio.it" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">
                            {isCreating ? 'Password *' : 'Reset Password (Opzionale)'}
                        </label>
                        <input 
                            type="password" 
                            required={isCreating}
                            className="w-full bg-black/40 border border-white/10 focus:border-brand-accent p-3 rounded text-white outline-none transition-colors" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder={isCreating ? "Crea password" : "Lascia vuoto per mantenere attuale"} 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-3">Ruolo & Permessi</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                type="button"
                                onClick={() => setRole('free')}
                                className={`p-3 rounded-lg border text-center transition-all ${role === 'free' ? 'bg-white/20 border-white text-white' : 'bg-transparent border-white/10 text-brand-text-secondary hover:bg-white/5'}`}
                            >
                                <div className="text-xs font-bold mb-1">FREE</div>
                                <div className="text-[10px] opacity-70">Base</div>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setRole('pro')}
                                className={`p-3 rounded-lg border text-center transition-all ${role === 'pro' ? 'bg-brand-accent/30 border-brand-accent text-brand-accent shadow-[0_0_15px_rgba(45,212,191,0.2)]' : 'bg-transparent border-white/10 text-brand-text-secondary hover:bg-white/5'}`}
                            >
                                <div className="text-xs font-bold mb-1">PRO</div>
                                <div className="text-[10px] opacity-70">Artist</div>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setRole('admin')}
                                className={`p-3 rounded-lg border text-center transition-all ${role === 'admin' ? 'bg-red-900/40 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-transparent border-white/10 text-brand-text-secondary hover:bg-white/5'}`}
                            >
                                <div className="text-xs font-bold mb-1">ADMIN</div>
                                <div className="text-[10px] opacity-70">Full Access</div>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                        {!isCreating && onDelete ? (
                            <button type="button" onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-2 px-2 py-1 rounded hover:bg-red-900/20">
                                <i className="fas fa-trash-alt"></i> Elimina
                            </button>
                        ) : <div></div>}
                        
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white py-2 px-5 rounded-lg text-sm font-bold transition-colors">Annulla</button>
                            <button type="submit" className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-2 px-8 rounded-lg text-sm shadow-lg hover:shadow-brand-accent/30 transition-all">
                                {isCreating ? 'Crea Utente' : 'Salva Modifiche'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    
    // Data States
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    
    // UI States
    const [isLoading, setIsLoading] = useState(false);
    
    // Showcase Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<ShowcaseProject, 'id'>>(emptyProject);
    const [tagsInput, setTagsInput] = useState('');
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [mediaType, setMediaType] = useState<MediaType>('image');

    // User Edit States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // --- LOAD DATA ---
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                if (activeTab === 'overview') {
                    const s = await api.getSystemStats();
                    setStats(s);
                } else if (activeTab === 'users') {
                    const u = await api.getAllUsers();
                    setUsers(u);
                } else if (activeTab === 'showcase') {
                    const p = await api.getShowcase();
                    setProjects(p);
                } else if (activeTab === 'logs') {
                    const l = await api.getSystemLogs();
                    setLogs(l);
                }
            } catch (e) {
                console.error("Admin load error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        
        // Set up a poller for live-ish stats if in overview
        let interval: any;
        if (activeTab === 'overview') {
            interval = setInterval(loadData, 5000);
        }
        return () => clearInterval(interval);
    }, [activeTab]);


    // --- SHOWCASE LOGIC ---
    const handleEdit = (project: ShowcaseProject) => {
        setEditingId(project.id);
        setFormData({ ...project });
        setTagsInput(project.tags.join(', '));
        setMediaType(project.videoUrl ? 'video' : 'image');
        setIsFormVisible(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo progetto dalla vetrina?")) {
            await api.deleteShowcaseItem(id);
            const p = await api.getShowcase();
            setProjects(p);
        }
    };

    const handleAddNew = () => {
        setEditingId(null);
        setFormData(emptyProject);
        setTagsInput('');
        setMediaType('image');
        setIsFormVisible(true);
    };

    const handleMediaTypeChange = (type: MediaType) => {
        setMediaType(type);
        if (type === 'image') {
            setFormData({ ...formData, videoUrl: '' }); // Clear video URL if switching to image mode
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Enforce mutual exclusion logic on submit as well
        const finalData = {
            ...formData,
            tags: tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0),
            videoUrl: mediaType === 'image' ? '' : formData.videoUrl // Ensure no video URL if image mode
        };

        try {
            if (editingId) {
                await api.updateShowcaseItem({ ...finalData, id: editingId });
            } else {
                await api.addShowcaseItem(finalData);
            }
            setIsFormVisible(false);
            const p = await api.getShowcase();
            setProjects(p);
            setFormData(emptyProject);
        } catch (e) {
            alert("Errore nel salvataggio");
        }
    };

    // --- USER MANAGEMENT LOGIC ---
    const handleUserSave = async (userData: Partial<User> & { password?: string }, isNew: boolean) => {
        try {
            if (isNew) {
                await api.adminCreateUser(userData);
                alert("Utente creato con successo.");
            } else {
                await api.updateUser(userData as any);
                alert("Utente aggiornato con successo.");
            }
            
            const u = await api.getAllUsers();
            setUsers(u);
            setEditingUser(null);
            setIsCreatingUser(false);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Errore nell'operazione utente.");
        }
    };

    const handleUserDelete = async (userId: string) => {
        try {
            await api.deleteUser(userId);
            const u = await api.getAllUsers();
            setUsers(u);
            setEditingUser(null);
        } catch (e) {
            alert("Errore nell'eliminazione utente.");
        }
    };
    
    // Use new utility, disable autoplay for admin preview to avoid noise
    const videoPreviewConfig = formData.videoUrl ? getVideoConfig(formData.videoUrl, false) : null;

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <i className="fas fa-user-shield text-brand-accent"></i>
                        Admin Dashboard
                    </h2>
                    <p className="text-brand-text-secondary">Panoramica del sistema e gestione contenuti (Live DB)</p>
                </div>
                
                <div className="bg-brand-secondary/50 p-1 rounded-lg flex overflow-x-auto max-w-full backdrop-blur-sm border border-white/5">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-brand-accent text-brand-primary shadow' : 'text-brand-text-secondary hover:text-white'}`}
                    >
                        <i className="fas fa-chart-pie mr-2"></i> Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-brand-accent text-brand-primary shadow' : 'text-brand-text-secondary hover:text-white'}`}
                    >
                        <i className="fas fa-users mr-2"></i> Utenti
                    </button>
                    <button 
                        onClick={() => setActiveTab('showcase')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'showcase' ? 'bg-brand-accent text-brand-primary shadow' : 'text-brand-text-secondary hover:text-white'}`}
                    >
                        <i className="fas fa-images mr-2"></i> Vetrina
                    </button>
                     <button 
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'logs' ? 'bg-brand-accent text-brand-primary shadow' : 'text-brand-text-secondary hover:text-white'}`}
                    >
                        <i className="fas fa-clipboard-list mr-2"></i> Audit Logs
                    </button>
                </div>
            </div>

            {isLoading && <div className="text-center py-20"><div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto"></div></div>}

            {/* --- TAB: OVERVIEW --- */}
            {!isLoading && activeTab === 'overview' && stats && (
                <div className="animate-fade-in space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Utenti Registrati" 
                            value={stats.totalUsers} 
                            subtext={`${stats.activeUsers24h} attivi nelle ultime 24h`} 
                            icon="fa-users" 
                            color="bg-blue-500/20 text-blue-400" 
                        />
                         <StatCard 
                            title="Sonificazioni" 
                            value={stats.totalSonifications} 
                            subtext="Totale processate" 
                            icon="fa-music" 
                            color="bg-purple-500/20 text-purple-400" 
                        />
                         <StatCard 
                            title="Revenue Stimata" 
                            value={`$${stats.apiStatus.paddle.used}`} 
                            subtext="Transazioni Mock" 
                            icon="fa-dollar-sign" 
                            color="bg-green-500/20 text-green-400" 
                        />
                         <StatCard 
                            title="Server Status" 
                            value="ONLINE" 
                            subtext={`CPU: ${stats.serverHealth.cpu}% | RAM: ${stats.serverHealth.memory}%`} 
                            icon="fa-server" 
                            color="bg-brand-accent/20 text-brand-accent" 
                        />
                    </div>

                    {/* API Credits & Status */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <i className="fas fa-cloud-api text-brand-accent"></i>
                                    Utilizzo API & Crediti
                                </h3>
                                <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-800">
                                    LIVE SYNC
                                </span>
                            </div>
                            
                            <div className="space-y-6">
                                <ProgressBar 
                                    label="Google Gemini API (Tokens)" 
                                    value={Math.round(stats.apiStatus.gemini.used)} 
                                    max={stats.apiStatus.gemini.limit} 
                                    unit="tok" 
                                    colorClass="bg-blue-500"
                                />
                                <p className="text-xs text-right text-brand-text-secondary -mt-3 mb-4">
                                    Costo Stimato: <span className="text-white font-bold">${stats.apiStatus.gemini.costEstimated.toFixed(3)}</span>
                                </p>

                                <ProgressBar 
                                    label="Cloud Storage (S3 Bucket)" 
                                    value={stats.apiStatus.storage.used} 
                                    max={stats.apiStatus.storage.limit} 
                                    unit="GB" 
                                    colorClass="bg-orange-500"
                                />
                                <p className="text-xs text-right text-brand-text-secondary -mt-3 mb-4">
                                    Costo Stimato: <span className="text-white font-bold">${stats.apiStatus.storage.costEstimated.toFixed(2)}</span>
                                </p>
                            </div>
                        </div>

                         <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-shield-alt text-brand-accent"></i>
                                Salute del Sistema
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-green-900/20 rounded border border-green-800/50">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-database text-green-500"></i>
                                        <span className="text-white">Persistent LocalDB</span>
                                    </div>
                                    <span className="text-xs font-bold text-green-400 px-2 py-1 bg-green-900/40 rounded">CONNECTED</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-green-900/20 rounded border border-green-800/50">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-check-circle text-green-500"></i>
                                        <span className="text-white">SAC Verification Engine</span>
                                    </div>
                                    <span className="text-xs font-bold text-green-400 px-2 py-1 bg-green-900/40 rounded">OPERATIONAL</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-yellow-900/20 rounded border border-yellow-800/50">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-exclamation-circle text-yellow-500"></i>
                                        <span className="text-white">Udio Integration</span>
                                    </div>
                                    <span className="text-xs font-bold text-yellow-400 px-2 py-1 bg-yellow-900/40 rounded">SIMULATION</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: LOGS --- */}
            {!isLoading && activeTab === 'logs' && (
                 <div className="animate-fade-in bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                         <h3 className="text-xl font-bold text-white">Audit Logs di Sistema</h3>
                         <button onClick={() => {api.getSystemLogs().then(setLogs)}} className="text-brand-accent hover:text-white"><i className="fas fa-sync"></i> Refresh</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 text-brand-text-secondary text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">Livello</th>
                                    <th className="p-4">Utente</th>
                                    <th className="p-4">Azione</th>
                                    <th className="p-4">Dettagli</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-white/5">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors font-mono text-xs">
                                        <td className="p-4 text-brand-text-secondary whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded uppercase font-bold ${
                                                log.level === 'error' ? 'bg-red-900/50 text-red-300 border border-red-900' :
                                                log.level === 'warning' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-900' :
                                                log.level === 'success' ? 'bg-green-900/50 text-green-300 border border-green-900' :
                                                'bg-blue-900/50 text-blue-300 border border-blue-900'
                                            }`}>
                                                {log.level}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white">{log.user}</td>
                                        <td className="p-4 font-bold text-brand-accent">{log.action}</td>
                                        <td className="p-4 text-brand-text-secondary">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* --- TAB: USERS --- */}
            {!isLoading && activeTab === 'users' && (
                <div className="animate-fade-in bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-white">Elenco Utenti (Database Locale)</h3>
                            <button 
                                onClick={() => { setIsCreatingUser(true); setEditingUser(null); }}
                                className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary text-xs font-bold px-3 py-1.5 rounded shadow hover:shadow-lg transition-all"
                            >
                                <i className="fas fa-plus mr-1"></i> Nuovo Utente
                            </button>
                         </div>
                         <div className="relative">
                             <input type="text" placeholder="Cerca utente..." className="bg-black/50 text-sm p-2 pl-8 rounded text-white border border-white/10 focus:border-brand-accent focus:outline-none" />
                             <i className="fas fa-search absolute left-2.5 top-2.5 text-brand-text-secondary text-xs"></i>
                         </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 text-brand-text-secondary text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Utente</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Piano</th>
                                    <th className="p-4">Registrato il</th>
                                    <th className="p-4">Ultimo Login</th>
                                    <th className="p-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-white/5">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 flex items-center gap-3">
                                            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                                            <span className="font-bold text-white">{user.name}</span>
                                        </td>
                                        <td className="p-4 text-brand-text-secondary">{user.email}</td>
                                        <td className="p-4">
                                            <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold ${user.isPro ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'bg-white/10 text-gray-300'}`}>
                                                {user.isPro ? 'PRO' : 'FREE'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-brand-text-secondary">{user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : '-'}</td>
                                        <td className="p-4 text-brand-text-secondary">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-'}</td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => setEditingUser(user)}
                                                className="text-brand-accent hover:text-white p-2 rounded hover:bg-white/10 transition-all" 
                                                title="Gestisci Utente"
                                            >
                                                <i className="fas fa-pen"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-white/10 text-center">
                        <p className="text-xs text-brand-text-secondary">Visualizzati {users.length} utenti.</p>
                    </div>
                </div>
            )}

            {(editingUser || isCreatingUser) && (
                <UserEditModal 
                    user={editingUser} 
                    onClose={() => { setEditingUser(null); setIsCreatingUser(false); }} 
                    onSave={handleUserSave}
                    onDelete={!isCreatingUser ? handleUserDelete : undefined}
                />
            )}

            {/* --- TAB: SHOWCASE (EXISTING) --- */}
            {!isLoading && activeTab === 'showcase' && (
                <div className="animate-fade-in bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden p-6">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Gestione Progetti Vetrina</h3>
                        <button 
                            onClick={handleAddNew}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md transition-colors shadow-lg text-sm"
                        >
                            <i className="fas fa-plus mr-2"></i> Nuovo Progetto
                        </button>
                    </div>

                    {isFormVisible && (
                        <div className="bg-brand-secondary/80 backdrop-blur-xl p-6 rounded-lg border border-white/10 mb-8 shadow-2xl animate-zoom-in">
                            <h3 className="text-xl font-bold text-white mb-4">{editingId ? 'Modifica Progetto' : 'Aggiungi Progetto'}</h3>
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                
                                {/* --- SECTION 1: MEDIA & ASSETS --- */}
                                <div className="border border-white/10 rounded-lg p-4 bg-black/20">
                                    <h4 className="text-sm font-bold text-brand-accent uppercase mb-4 flex items-center gap-2">
                                        <i className="fas fa-photo-video"></i> Media & Assets
                                    </h4>

                                    {/* Media Type Selector */}
                                    <div className="flex gap-4 mb-4">
                                        <button 
                                            type="button"
                                            onClick={() => handleMediaTypeChange('image')}
                                            className={`flex-1 py-2 px-4 rounded border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${mediaType === 'image' ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-white/5 border-white/10 text-brand-text-secondary hover:bg-white/10'}`}
                                        >
                                            <i className="fas fa-image"></i> Immagine Standard
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleMediaTypeChange('video')}
                                            className={`flex-1 py-2 px-4 rounded border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${mediaType === 'video' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/10 text-brand-text-secondary hover:bg-white/10'}`}
                                        >
                                            <i className="fas fa-video"></i> Video / Multimedia
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">
                                                    {mediaType === 'video' ? 'URL Copertina (Thumbnail) *' : 'URL Immagine *'}
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="w-8 flex items-center justify-center bg-white/5 rounded text-brand-text-secondary"><i className="fas fa-image"></i></div>
                                                    <input required type="url" className="flex-grow bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none text-sm" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
                                                </div>
                                                {mediaType === 'video' && <p className="text-[10px] text-brand-text-secondary mt-1 italic">Questa immagine verrà mostrata nella griglia prima del click.</p>}
                                            </div>

                                            {mediaType === 'video' && (
                                                <div className="animate-fade-in">
                                                    <label className="block text-xs font-bold text-purple-400 uppercase mb-1">URL Video (MP4/YT/Vimeo) *</label>
                                                    <div className="flex gap-2">
                                                        <div className="w-8 flex items-center justify-center bg-purple-500/10 rounded text-purple-400 border border-purple-500/30"><i className="fas fa-video"></i></div>
                                                        <input required type="url" className="flex-grow bg-black/40 border border-purple-500/30 p-2 rounded text-white focus:border-purple-500 outline-none text-sm" placeholder="https://..." value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} />
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">
                                                    {mediaType === 'image' ? 'URL Audio (MP3) *' : 'URL Audio (MP3) - Opzionale'}
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="w-8 flex items-center justify-center bg-white/5 rounded text-brand-text-secondary"><i className="fas fa-music"></i></div>
                                                    <input 
                                                        required={mediaType === 'image'} // Required if only image is present
                                                        type="url" 
                                                        className="flex-grow bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none text-sm" 
                                                        placeholder="https://.../audio.mp3" 
                                                        value={formData.audioUrl || ''} 
                                                        onChange={e => setFormData({...formData, audioUrl: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- LIVE PREVIEW BOX --- */}
                                        <div className="bg-black/40 border border-white/10 rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                                            {mediaType === 'video' && videoPreviewConfig ? (
                                                videoPreviewConfig.type === 'native' ? (
                                                    <video src={videoPreviewConfig.src} controls className="w-full h-40 object-contain" />
                                                ) : (
                                                    <iframe src={videoPreviewConfig.src} className="w-full h-40" frameBorder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
                                                )
                                            ) : formData.imageUrl ? (
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-40 object-contain" referrerPolicy="no-referrer" onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+Image'} />
                                            ) : (
                                                <div className="text-center text-brand-text-secondary text-xs">
                                                    <i className="fas fa-eye text-2xl mb-2 opacity-50"></i>
                                                    <p>Anteprima Media</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* --- SECTION 2: DETAILS --- */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Titolo</label>
                                        <input required type="text" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Autore</label>
                                        <input required type="text" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Data (YYYY-MM-DD)</label>
                                        <input required type="date" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Paradigma</label>
                                        <select className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.paradigm} onChange={e => setFormData({...formData, paradigm: e.target.value as Paradigm})}>
                                            <option value="scientific">Scientific</option>
                                            <option value="artistic">Artistic</option>
                                            <option value="hybrid">Hybrid</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Descrizione</label>
                                        <textarea required className="w-full bg-black/40 border border-white/10 p-2 rounded text-white h-24 focus:border-brand-accent outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Nome Tradizione</label>
                                        <input required type="text" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.tradition} onChange={e => setFormData({...formData, tradition: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Tags (separati da virgola)</label>
                                        <input type="text" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" placeholder="Arte, Spazio, Natura..." value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
                                    </div>
                                </div>

                                {/* --- SECTION 3: METRICS --- */}
                                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Durata (Stringa)</label>
                                        <input type="text" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" placeholder="3m 45s" value={formData.stats.duration} onChange={e => setFormData({...formData, stats: {...formData.stats, duration: e.target.value}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Numero Note</label>
                                        <input type="number" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={formData.stats.notes} onChange={e => setFormData({...formData, stats: {...formData.stats, notes: parseInt(e.target.value)}})} />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsFormVisible(false)} className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded text-sm">Annulla</button>
                                    <button type="submit" className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-2 px-6 rounded shadow-lg text-sm">Salva</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 text-brand-text-secondary text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Titolo</th>
                                    <th className="p-4">Autore</th>
                                    <th className="p-4">Media</th>
                                    <th className="p-4">Paradigma</th>
                                    <th className="p-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-white/5">
                                {projects.map(p => (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold text-white">{p.title}</td>
                                        <td className="p-4 text-brand-text-primary">{p.author}</td>
                                        <td className="p-4 text-xs flex gap-2">
                                            {p.audioUrl && <span className="text-green-400 border border-green-900 bg-green-900/20 px-1 rounded">Audio</span>}
                                            {p.videoUrl && <span className="text-purple-400 border border-purple-900 bg-purple-900/20 px-1 rounded">Video</span>}
                                            {!p.audioUrl && !p.videoUrl && <span className="text-gray-400 border border-gray-700 bg-gray-800/50 px-1 rounded">Algo</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] px-2 py-1 rounded uppercase ${p.paradigm === 'scientific' ? 'bg-blue-900/50 text-blue-300 border border-blue-500/30' : p.paradigm === 'artistic' ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' : 'bg-teal-900/50 text-teal-300 border border-teal-500/30'}`}>
                                                {p.paradigm}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => handleEdit(p)} className="text-brand-accent hover:text-white transition-colors"><i className="fas fa-edit"></i></button>
                                            <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-300 transition-colors"><i className="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                ))}
                                {projects.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-brand-text-secondary">Nessun progetto trovato.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
