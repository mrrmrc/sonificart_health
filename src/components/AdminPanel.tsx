import React, { useState, useEffect, useCallback } from 'react';
import { ShowcaseProject, SystemStats, User, SystemLog } from '../types';
import { api } from '../services/api';

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

type AdminTab = 'overview' | 'requests' | 'users' | 'showcase' | 'logs';

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
    const [credits, setCredits] = useState(user?.credits || 5);

    const handleRoleChange = (r: 'free' | 'pro' | 'admin' | 'custom') => {
        setRole(r);
        if (r === 'free') setCredits(5);
        if (r === 'pro') setCredits(9999);
        if (r === 'admin') setCredits(9999);
        if (r === 'custom') setCredits(100);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullName = `${firstName} ${lastName}`.trim();

        const isPro = role === 'pro' || role === 'admin';
        const isAdmin = role === 'admin';
        // Custom is just high credits, not Pro flag (unless requested otherwise, current logic implies Custom = Prepaid)

        const userData: Partial<User> & { password?: string } = {
            id: user?.id, name: fullName, email, isPro, isAdmin, credits,
            avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`
        };
        if (password) userData.password = password;
        onSave(userData, isCreating);
    };

    const handleDelete = () => { if (user && onDelete && confirm("Eliminare utente?")) onDelete(user.id); };

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

// --- ADMIN PANEL ---
export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Edit States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // LOAD DATA
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'overview') {
                setStats(await api.getSystemStats());
                setRequests(api.getAccessRequests ? await api.getAccessRequests() : []);
            }
            if (activeTab === 'users') setUsers(await api.getAllUsers());
            if (activeTab === 'showcase') setProjects(await api.getShowcase());
            if (activeTab === 'logs') setLogs(await api.getSystemLogs());
            if (activeTab === 'requests') setRequests(await api.getAccessRequests());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [activeTab]);

    useEffect(() => {
        loadData();
        const i = setInterval(loadData, 15000);
        return () => clearInterval(i);
    }, [activeTab, loadData]);

    const handleApprove = async (id: string) => {
        if (confirm("Approvare richiesta? L'utente dovrà essere aggiornato manualmente a PRO se non automatizzato.")) {
            // Nota: approveAccessRequest non fa nulla di magico, per ora è solo un segnaposto o approva nel DB.
            // Idealmente dovrei anche creare l'utente o assegnargli crediti.
            await api.approveAccessRequest(id);
            loadData();
        }
    };
    const handleReject = async (id: string) => {
        if (confirm("Rifiutare richiesta?")) {
            await api.rejectAccessRequest(id);
            loadData();
        }
    };

    const handleRequestUpdate = async (id: string, field: 'invoice_sent' | 'paid', value: boolean) => {
        try {
            await api.updateAccessRequest(id, field, value);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        } catch (e) { console.error(e); alert("Errore aggiornamento status"); }
    };

    const handleDeleteProject = async (id: string) => {
        if (confirm("Eliminare?")) {
            await api.deleteShowcaseItem(id);
            loadData();
        }
    };

    const handleUserSave = async (userData: Partial<User>, isNew: boolean) => {
        try {
            if (isNew) await api.adminCreateUser(userData); else await api.updateUser(userData as any);
            loadData(); setEditingUser(null); setIsCreatingUser(false);
        } catch (e) { alert("Errore operazione utente"); }
    };
    const handleUserDelete = async (id: string) => {
        try { await api.deleteUser(id); loadData(); setEditingUser(null); } catch (e) { alert("Errore eliminazione utente"); }
    };

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-user-shield text-brand-accent"></i> Admin Dashboard</h2>
                <div className="bg-brand-secondary/50 p-1 rounded-lg flex overflow-x-auto">
                    {['overview', 'requests', 'users', 'showcase', 'logs'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-4 py-2 rounded text-sm font-bold capitalize whitespace-nowrap ${activeTab === tab ? 'bg-brand-accent text-black' : 'text-white hover:bg-white/10'}`}>
                            {tab} {tab === 'requests' && requests.length > 0 && `(${requests.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && !stats && <div className="text-center py-20 text-brand-accent animate-pulse">Caricamento dati...</div>}

            {!isLoading && activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard title="Utenti" value={stats.totalUsers} subtext="Registrati" icon="fa-users" color="bg-blue-500/20 text-blue-400" />
                        <StatCard title="Opere" value={stats.totalSonifications} subtext="Salvate" icon="fa-music" color="bg-purple-500/20 text-purple-400" />
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
                            <thead className="bg-black/30 text-gray-400 uppercase text-xs"><tr><th className="p-4">Nome</th><th className="p-4">Email</th><th className="p-4">Ruolo</th><th className="p-4 text-right">Crediti</th><th className="p-4 text-right">Azioni</th></tr></thead>
                            <tbody className="divide-y divide-white/5 text-white">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold">{u.name}</td>
                                        <td className="p-4 text-gray-400">{u.email}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.isAdmin ? 'bg-red-500/20 text-red-400' : (u.isPro ? 'bg-yellow-500/20 text-yellow-400' : (u.credits > 20 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-300'))}`}>{u.isAdmin ? 'ADMIN' : (u.isPro ? 'PRO' : (u.credits > 20 ? 'CUSTOM' : 'FREE'))}</span></td>
                                        <td className="p-4 text-right font-mono">{u.isAdmin || u.isPro ? '∞' : u.credits}</td>
                                        <td className="p-4 text-right"><button onClick={() => setEditingUser(u)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded"><i className="fas fa-edit"></i></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'showcase' && (
                <div className="grid gap-3">
                    {projects.map(p => (
                        <div key={p.id} className="bg-white/5 p-4 rounded border border-white/5 hover:border-white/10 transition-all flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <img src={p.imageUrl} alt={p.title} className="w-12 h-12 rounded object-cover bg-black/50" />
                                <div><p className="font-bold text-white">{p.title}</p><p className="text-xs text-gray-400">{p.author} • {p.date}</p></div>
                            </div>
                            <button onClick={() => handleDeleteProject(p.id)} className="text-red-400 hover:text-red-300 p-2"><i className="fas fa-trash"></i></button>
                        </div>
                    ))}
                    {projects.length === 0 && <div className="text-center text-gray-500 py-10">La vetrina è vuota.</div>}
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="bg-black/30 p-4 rounded-xl border border-white/10 font-mono text-xs text-gray-400 h-96 overflow-y-auto">
                    {logs.length > 0 ? logs.map((l, i) => <div key={i} className="border-b border-white/5 py-1">{l.timestamp} - {l.action}: {l.details} <span className="text-[10px] opacity-70">[{l.level}]</span></div>) : "Nessun log disponibile o funzionalità log non attiva."}
                </div>
            )}

            {(editingUser || isCreatingUser) && <UserEditModal user={editingUser} onClose={() => { setEditingUser(null); setIsCreatingUser(false); }} onSave={handleUserSave} onDelete={!isCreatingUser ? handleUserDelete : undefined} />}
        </div>
    );
};