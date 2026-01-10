import React, { useState, useEffect, useCallback } from 'react';
import { ShowcaseProject, SystemStats, User, SystemLog } from '../types';
import { api } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';

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

type AdminTab = 'overview' | 'requests' | 'users' | 'showcase' | 'logs' | 'database';

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
            onSave({ ...user, id: user.id }, false); // This is just dummy to show modal
            // In reality, the parent should handle the confirm logic
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
    const [isLoading, setIsLoading] = useState(false);

    // Edit States
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

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
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [activeTab]);

    useEffect(() => {
        loadData();
        const i = setInterval(loadData, 15000);
        return () => clearInterval(i);
    }, [activeTab, loadData]);

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

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-user-shield text-brand-accent"></i> Admin Dashboard</h2>
                <div className="bg-brand-secondary/50 p-1 rounded-lg flex overflow-x-auto">
                    {['overview', 'requests', 'users', 'showcase', 'logs', 'database'].map(tab => (
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
                <div className="grid gap-4">
                    <div className="bg-brand-secondary/30 p-4 rounded-xl border border-white/5 mb-4 flex items-center justify-between text-xs text-gray-400">
                        <p><i className="fas fa-info-circle mr-2"></i> Le opere con "Pubblica" attiva sono visibili nella landing page. La priorità (da 0 a 99) determina l'ordine di apparizione.</p>
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
                                        {p.isFeatured && <span className="text-[10px] bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-400 uppercase font-bold"><i className="fas fa-star mr-1"></i>Slider</span>}
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
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Slider</span>
                                    <button
                                        onClick={() => handleShowcaseUpdate(p.id, { isFeatured: !p.isFeatured })}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${p.isFeatured ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-gray-600'}`}
                                        title="Mostra nello slider principale"
                                    >
                                        <i className="fas fa-images"></i>
                                    </button>
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Status</span>
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
                                                        <td key={c} className="p-2 border-r border-white/5 last:border-0 max-w-[200px] truncate" title={String(row[c])}>
                                                            {row[c] === null ? <span className="text-gray-600">NULL</span> : (typeof row[c] === 'boolean' ? (row[c] ? '1' : '0') : String(row[c]))}
                                                        </td>
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

            {(editingUser || isCreatingUser) && <UserEditModal user={editingUser} onClose={() => { setEditingUser(null); setIsCreatingUser(false); }} onSave={handleUserSave} onDelete={!isCreatingUser ? handleUserDelete : undefined} />}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};