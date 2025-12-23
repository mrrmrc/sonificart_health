import React, { useState, useEffect } from 'react';
import { User, ShowcaseProject } from '../types';
import { api } from '../services/api';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

// Reusing ProjectModal logic for consistency (Internal component)
const ProjectModal: React.FC<{ project: ShowcaseProject; onClose: () => void }> = ({ project, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-5xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>

                <button className="absolute top-4 right-4 text-white/50 hover:text-white z-10 text-2xl" onClick={onClose}>&times;</button>

                {/* Image Side */}
                <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative">
                    {project.videoUrl ? (
                        <video src={project.videoUrl} controls className="max-w-full max-h-[50vh] md:max-h-full object-contain" />
                    ) : (
                        <img src={fixImage(project.imageUrl)} alt={project.title} className="max-w-full max-h-[50vh] md:max-h-full object-contain" />
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pointer-events-none">
                        <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
                        <p className="text-brand-text-secondary">by {project.author} · {new Date(project.date).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Content Side */}
                <div className="w-full md:w-2/5 p-8 overflow-y-auto bg-[#1e1e2e]">
                    <div className="mb-6">
                        <h3 className="text-brand-accent font-bold uppercase tracking-widest text-xs mb-2">Descrizione del Progetto</h3>
                        <p className="text-gray-300 leading-relaxed text-sm">
                            {project.description || "Nessuna descrizione."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <div className="text-xs text-gray-500 uppercase">Paradigma</div>
                            <div className="text-white font-bold capitalize">{project.paradigm}</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <div className="text-xs text-gray-500 uppercase">Tradizione</div>
                            <div className="text-white font-bold truncate" title={project.tradition}>{project.tradition}</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <div className="text-xs text-gray-500 uppercase">Durata</div>
                            <div className="text-white font-mono">{project.stats.duration}</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <div className="text-xs text-gray-500 uppercase">Note Generate</div>
                            <div className="text-white font-mono">{project.stats.notes}</div>
                        </div>
                    </div>

                    {!project.videoUrl && (
                        <div className="bg-brand-accent/10 border border-brand-accent/30 p-6 rounded-lg text-center mb-6">
                            <i className="fas fa-music text-4xl text-brand-accent mb-3"></i>
                            <p className="text-sm text-white mb-4">
                                Traccia Audio Archiviata
                            </p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {project.tags && project.tags.map(tag => (
                            <span key={tag} className="text-xs bg-black/30 px-3 py-1 rounded-full text-gray-400 border border-white/10">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PublicProfileProps {
    user: User | null;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ user }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(user?.name || '');
    const [editAvatar, setEditAvatar] = useState(user?.avatarUrl || '');
    const [editLogo, setEditLogo] = useState(user?.customLogoUrl || '');
    const [editEmail, setEditEmail] = useState(user?.email || '');
    const [editPassword, setEditPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // RESTORED STATES
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

    useEffect(() => {
        if (user) {
            setEditName(user.name);
            setEditAvatar(user.avatarUrl || '');
            setEditLogo(user.customLogoUrl || '');
            setEditEmail(user.email);
            setEditPassword('');
        }
    }, [user]);

    useEffect(() => {
        const loadProfileData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const allProjects = await api.getShowcase();
                const userProjects = allProjects.filter((p: ShowcaseProject) => p.author === user.name || p.ownerId === user.id);
                setProjects(userProjects);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadProfileData();
    }, [user]);

    const handleSaveProfile = async () => {
        if (editPassword && editPassword.length < 6) {
            alert("La password deve essere di almeno 6 caratteri.");
            return;
        }
        setIsSaving(true);
        try {
            await api.updateProfile({
                name: editName,
                email: editEmail,
                avatarUrl: editAvatar,
                customLogoUrl: editLogo,
                password: editPassword || undefined
            });
            // Update local state if needed (user comes from context usually)
            window.location.reload(); // Semplice ma efficace per aggiornare la sessione
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio.");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    if (!user) return <div className="text-center p-10 text-brand-text-secondary">Utente non trovato.</div>;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-16">

            {/* Profile Header */}
            <div className="relative bg-brand-secondary/50 rounded-xl p-8 mb-12 border border-brand-secondary flex flex-col md:flex-row items-center gap-8">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-1 shadow-2xl overflow-hidden">
                        <div className="w-full h-full rounded-full bg-[#0f172a] flex items-center justify-center overflow-hidden relative">
                            {editAvatar || user.avatarUrl ? (
                                <img src={editAvatar || user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-white">{user.name?.substring(0, 2).toUpperCase() || 'UT'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-center md:text-left flex-grow space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-3">
                        <div className="flex flex-col gap-2 w-full max-w-sm">
                            {isEditing ? (
                                <>
                                    <label className="text-[10px] text-brand-accent uppercase font-bold text-left">Nome Visualizzato</label>
                                    <input
                                        className="bg-white/5 border border-white/10 rounded px-3 py-2 text-xl font-bold text-white focus:outline-none focus:border-brand-accent w-full"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Tuo Nome"
                                    />
                                </>
                            ) : (
                                <h1 className="text-3xl font-bold text-white">{user.name}</h1>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {user.isPro && !isEditing && <span className="bg-brand-accent/20 text-brand-accent text-[10px] font-bold px-2 py-1 rounded border border-brand-accent/30 tracking-tight">PRO ARTIST</span>}
                            {user.tier === 'custom' && !isEditing && <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-1 rounded border border-purple-500/30 tracking-tight">CUSTOM PARTNER</span>}
                        </div>
                    </div>

                    {isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Foto Profilo (URL)</label>
                                <input
                                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-accent w-full"
                                    value={editAvatar}
                                    onChange={e => setEditAvatar(e.target.value)}
                                    placeholder="https://.../avatar.jpg"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Email</label>
                                <input
                                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-accent w-full"
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    placeholder="email@esempio.com"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Nuova Password (opzionale)</label>
                                <input
                                    type="password"
                                    className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-accent w-full"
                                    value={editPassword}
                                    onChange={e => setEditPassword(e.target.value)}
                                    placeholder="Lascia vuoto per non cambiare"
                                />
                                <span className="text-[10px] text-gray-500 block mt-1">Minimo 6 caratteri</span>
                            </div>
                            {user.tier === 'custom' && (
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Logo Partner (URL)</label>
                                    <input
                                        className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-accent w-full"
                                        value={editLogo}
                                        onChange={e => setEditLogo(e.target.value)}
                                        placeholder="https://.../logo-partner.png"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-4 mt-6 justify-center md:justify-start">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    className="bg-brand-accent text-brand-primary px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:shadow-brand-accent/20 transition-all flex items-center gap-2"
                                >
                                    {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>}
                                    SALVA MODIFICHE
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setEditName(user.name); setEditAvatar(user.avatarUrl || ''); setEditLogo(user.customLogoUrl || ''); }}
                                    className="bg-white/5 text-white/50 px-6 py-2 rounded-full font-bold text-sm border border-white/10 hover:text-white transition-all"
                                >
                                    ANNULLA
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-white/10 text-white px-6 py-2 rounded-full font-bold text-sm border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <i className="fas fa-edit"></i>
                                MODIFICA PROFILO
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Portfolio Grid */}
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-brand-secondary pb-4">Portfolio Opere</h2>

            {isLoading ? (
                <div className="text-center py-10"><i className="fas fa-circle-notch fa-spin text-brand-accent"></i> Caricamento...</div>
            ) : projects.length === 0 ? (
                <div className="text-center py-16 bg-brand-secondary/20 rounded-lg border border-dashed border-brand-secondary/50">
                    <i className="fas fa-folder-open text-4xl text-brand-text-secondary mb-4"></i>
                    <p className="text-brand-text-secondary">Nessuna opera pubblica.</p>
                    <p className="text-xs text-brand-text-secondary mt-2">Vai nella Dashboard per pubblicare le tue sonificazioni.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="group bg-brand-secondary/30 rounded-lg overflow-hidden border border-brand-secondary hover:border-brand-accent/50 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1"
                        >
                            <div className="aspect-video relative overflow-hidden">
                                <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute bottom-2 left-2">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded border border-white/10">
                                        {project.paradigm}
                                    </span>
                                </div>
                                {project.videoUrl && <div className="absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center"><i className="fas fa-video text-[10px]"></i></div>}
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-white mb-1 truncate group-hover:text-brand-accent transition-colors">{project.title}</h3>
                                <p className="text-xs text-brand-text-secondary mb-3 line-clamp-2">{project.description}</p>
                                <div className="flex justify-between text-xs text-brand-text-secondary border-t border-brand-secondary/50 pt-2">
                                    <span>{project.stats.duration}</span>
                                    <span>{new Date(project.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedProject && (
                <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
            )}

        </div>
    );
};