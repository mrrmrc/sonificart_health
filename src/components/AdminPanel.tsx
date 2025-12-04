import React, { useState, useEffect, useCallback } from 'react';
import { ShowcaseProject, SystemStats, User, SystemLog } from '../types';
import { api } from '../services/api';
import { getVideoConfig } from '../utils/videoUtils';

// --- INTERFACCE ---
interface AccessRequest {
    id: string;
    name: string;
    email: string;
    plan: string;
    piva: string;
    reason?: string;
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
type MediaType = 'image' | 'video';

const StatCard: React.FC<{ title: string; value: string | number; subtext: string; icon: string; color: string }> = ({ title, value, subtext, icon, color }) => (
    <div className="bg-brand-secondary/40 p-6 rounded-xl border border-brand-secondary flex items-center gap-4 hover:bg-brand-secondary/60 transition-colors">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${color}`}><i className={`fas ${icon}`}></i></div>
        <div><p className="text-brand-text-secondary text-sm uppercase tracking-wider font-bold">{title}</p><h3 className="text-2xl font-bold text-white">{value}</h3><p className="text-xs text-brand-text-secondary/70">{subtext}</p></div>
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
    const [role, setRole] = useState<'free' | 'pro' | 'admin'>(user?.isAdmin ? 'admin' : user?.isPro ? 'pro' : 'free');
    const [credits, setCredits] = useState(user?.credits || 5);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullName = `${firstName} ${lastName}`.trim();
        const userData: Partial<User> & { password?: string } = {
            id: user?.id, name: fullName, email, isPro: role === 'pro' || role === 'admin', isAdmin: role === 'admin', credits: credits,
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
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                        <input className="bg-black/30 border border-white/10 p-2 rounded text-white" type="number" placeholder="Crediti" value={credits} onChange={e => setCredits(parseInt(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {['free', 'pro', 'admin'].map(r => (
                            <button key={r} type="button" onClick={() => setRole(r as any)} className={`p-2 rounded text-xs font-bold uppercase ${role === r ? 'bg-brand-accent text-black' : 'bg-black/30 text-gray-400'}`}>{r}</button>
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<ShowcaseProject, 'id'>>(emptyProject);
    const [isFormVisible, setIsFormVisible] = useState(false);
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

    // --- ACTIONS RICHIESTE (CORRETTE) ---
    const handleApprove = async (id: string) => {
        if (confirm("Approvare?")) {
            await api.approveAccessRequest(id);
            loadData();
        }
    };
    const handleReject = async (id: string) => {
        if (confirm("Rifiutare?")) {
            await api.rejectAccessRequest(id);
            loadData();
        }
    };

    // --- ACTIONS VETRINA ---
    const handleDeleteProject = async (id: string) => {
        if (confirm("Eliminare?")) {
            await api.deleteShowcaseItem(id);
            loadData();
        }
    };

    // --- ACTIONS UTENTI ---
    const handleUserSave = async (userData: Partial<User>, isNew: boolean) => {
        try {
            if (isNew) await api.adminCreateUser(userData); else await api.updateUser(userData as any);
            loadData(); setEditingUser(null); setIsCreatingUser(false);
        } catch (e) { alert("Errore"); }
    };
    const handleUserDelete = async (id: string) => {
        try { await api.deleteUser(id); loadData(); setEditingUser(null); } catch (e) { alert("Errore"); }
    };

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-user-shield text-brand-accent"></i> Admin</h2>
                <div className="bg-brand-secondary/50 p-1 rounded-lg flex overflow-x-auto">
                    {['overview', 'requests', 'users', 'showcase', 'logs'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-4 py-2 rounded text-sm font-bold capitalize ${activeTab === tab ? 'bg-brand-accent text-black' : 'text-white hover:bg-white/10'}`}>
                            {tab} {tab === 'requests' && requests.length > 0 && `(${requests.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && <div className="text-center py-20">Caricamento...</div>}

            {!isLoading && activeTab === 'overview' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title="Utenti" value={stats.totalUsers} subtext="Totali" icon="fa-users" color="bg-blue-500/20 text-blue-400" />
                    <StatCard title="Opere" value={stats.totalSonifications} subtext="Generate" icon="fa-music" color="bg-purple-500/20 text-purple-400" />
                    <StatCard title="Richieste" value={requests.length} subtext="Pending" icon="fa-envelope" color="bg-yellow-500/20 text-yellow-400" />
                    <StatCard title="Status" value="OK" subtext="Online" icon="fa-server" color="bg-green-500/20 text-green-400" />
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-gray-400 uppercase text-xs"><tr><th className="p-4">Data</th><th className="p-4">Nome</th><th className="p-4">Email</th><th className="p-4">Piano</th><th className="p-4">Note</th><th className="p-4 text-right">Azioni</th></tr></thead>
                        <tbody className="divide-y divide-white/5 text-white">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-white/5">
                                    <td className="p-4 text-gray-400 text-xs">{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td className="p-4 font-bold">{req.name}</td>
                                    <td className="p-4">{req.email}</td>
                                    <td className="p-4"><span className="bg-brand-accent/20 text-brand-accent px-2 py-1 rounded text-xs">{req.plan}</span></td>
                                    <td className="p-4 text-xs text-gray-400 truncate max-w-xs">{req.piva} {req.reason}</td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        {/* NOMI FUNZIONI CORRETTI QUI */}
                                        <button onClick={() => handleApprove(req.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-500">Approva</button>
                                        <button onClick={() => handleReject(req.id)} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-500">Rifiuta</button>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nessuna richiesta.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="bg-[#1e1e2e] rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between"><h3 className="font-bold text-white">Utenti</h3><button onClick={() => { setIsCreatingUser(true); setEditingUser(null); }} className="bg-brand-accent text-black px-3 py-1 rounded text-xs font-bold">Nuovo</button></div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/30 text-gray-400 uppercase text-xs"><tr><th className="p-4">Nome</th><th className="p-4">Email</th><th className="p-4">Ruolo</th><th className="p-4 text-right"></th></tr></thead>
                        <tbody className="divide-y divide-white/5 text-white">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-white/5">
                                    <td className="p-4 font-bold">{u.name}</td>
                                    <td className="p-4 text-gray-400">{u.email}</td>
                                    <td className="p-4"><span className="bg-white/10 px-2 py-1 rounded text-xs">{u.isAdmin ? 'ADMIN' : (u.isPro ? 'PRO' : 'FREE')}</span></td>
                                    <td className="p-4 text-right"><button onClick={() => setEditingUser(u)} className="text-brand-accent"><i className="fas fa-edit"></i></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'showcase' && (
                <div className="grid gap-2">
                    {projects.map(p => (
                        <div key={p.id} className="bg-white/5 p-4 rounded flex justify-between items-center">
                            <div className="flex items-center gap-4"><img src={p.imageUrl} className="w-12 h-12 rounded object-cover" /><div><p className="font-bold text-white">{p.title}</p><p className="text-xs text-gray-400">{p.author}</p></div></div>
                            <button onClick={() => handleDeleteProject(p.id)} className="text-red-400"><i className="fas fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            )}

            {(editingUser || isCreatingUser) && <UserEditModal user={editingUser} onClose={() => { setEditingUser(null); setIsCreatingUser(false); }} onSave={handleUserSave} onDelete={!isCreatingUser ? handleUserDelete : undefined} />}
        </div>
    );
};