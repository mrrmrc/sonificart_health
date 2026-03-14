import React, { useState, useEffect } from 'react';
import { User, ShowcaseProject } from '../types';
import { api } from '../services/api';
import { ProjectModal } from './ProjectModal';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

interface PublicProfileProps {
    user: User | null;
    targetUserId?: string;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ user, targetUserId }) => {
    // Determine if we are viewing our own profile or someone else's
    const isOwner = !targetUserId || (user && user.id === targetUserId);

    const [displayedUser, setDisplayedUser] = useState<User | null>(user);
    const [isEditing, setIsEditing] = useState(false);

    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editLogo, setEditLogo] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPassword, setEditPassword] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

    // Initialize Edit Form when displayedUser changes
    useEffect(() => {
        if (displayedUser) {
            setEditName(displayedUser.name);
            setEditAvatar(displayedUser.avatarUrl || '');
            setEditLogo(displayedUser.customLogoUrl || '');
            setEditEmail(displayedUser.email);
            setEditPassword('');
        }
    }, [displayedUser]);

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                if (targetUserId && (!user || user.id !== targetUserId)) {
                    // Public Mode: Fetch specific user's public info
                    const data = await api.getPublicProfile(targetUserId);

                    // Construct a partial User object for display
                    const publicUser: any = {
                        id: data.user.id,
                        name: data.user.name,
                        email: '', // Private
                        isAdmin: false,
                        isPro: false, // Not exposed publicly unless tier says so
                        credits: 0,
                        avatarUrl: data.user.avatarUrl,
                        customLogoUrl: data.user.customLogoUrl,
                        tier: data.user.tier
                    };
                    setDisplayedUser(publicUser);
                    setProjects(data.projects);
                } else if (user) {
                    // Owner Mode: Use logged in user and fetch their showcase
                    setDisplayedUser(user);
                    const allProjects = await api.getShowcase();
                    // Filter for my projects (Showcase returns all public, but I want to see MINE)
                    const userProjects = allProjects.filter((p: ShowcaseProject) => p.ownerId === user.id);
                    setProjects(userProjects);
                }
            } catch (e) {
                console.error("Profile Load Error", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [user, targetUserId]);

    const handleSaveProfile = async () => {
        if (!displayedUser) return;
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
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio.");
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    const copyShareLink = () => {
        if (displayedUser) {
            const url = `${window.location.origin}/artist/${displayedUser.id}`;
            navigator.clipboard.writeText(url);
            alert("Link copiato negli appunti: " + url);
        }
    };

    if (!displayedUser && !isLoading) return <div className="text-center p-10 text-brand-text-secondary">Utente non trovato.</div>;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-16">

            {/* Profile Header */}
            <div className="relative bg-brand-secondary/50 rounded-xl p-8 mb-12 border border-brand-secondary flex flex-col md:flex-row items-center gap-8">

                {/* Public Share Link Badge (Owner Only) */}
                {isOwner && displayedUser && (
                    <div className="absolute top-4 left-4">
                        <button onClick={copyShareLink} className="text-[10px] bg-brand-accent/10 border border-brand-accent/30 text-brand-accent px-2 py-1 rounded hover:bg-brand-accent/20 transition-all flex items-center gap-1" title="Copia link pubblico">
                            <i className="fas fa-link"></i> LINK PUBBLICO
                        </button>
                    </div>
                )}

                <div className="text-center md:text-left flex-grow space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-3">
                        <div className="flex flex-col gap-2 w-full max-w-sm">
                            {isEditing && isOwner ? (
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
                                <h1 className="text-3xl font-bold text-white">{displayedUser?.name}</h1>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {displayedUser?.tier === 'pro' && !isEditing && <span className="bg-brand-accent/20 text-brand-accent text-[10px] font-bold px-2 py-1 rounded border border-brand-accent/30 tracking-tight">PRO ARTIST</span>}
                            {displayedUser?.tier === 'custom' && !isEditing && <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-1 rounded border border-purple-500/30 tracking-tight">CUSTOM PARTNER</span>}
                        </div>
                    </div>

                    {isEditing && isOwner && displayedUser && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                            {/* ... Edit Fields (Avatar, Email, Password, Logo) ... */}
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Foto Profilo (URL)</label>
                                <input className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 w-full" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Email</label>
                                <input className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 w-full" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Nuova Password</label>
                                <input type="password" className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 w-full" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Opzionale" />
                            </div>
                            {displayedUser.tier === 'custom' && (
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-[10px] text-brand-accent uppercase font-bold text-left">Logo Partner (URL)</label>
                                    <input className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 w-full" value={editLogo} onChange={e => setEditLogo(e.target.value)} />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-4 mt-6 justify-center md:justify-start">
                        {isOwner && (
                            isEditing ? (
                                <>
                                    <button onClick={handleSaveProfile} disabled={isSaving} className="bg-brand-accent text-brand-primary px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:shadow-brand-accent/20 transition-all flex items-center gap-2">
                                        {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>} SALVA
                                    </button>
                                    <button onClick={() => setIsEditing(false)} className="bg-white/5 text-white/50 px-6 py-2 rounded-full font-bold text-sm border border-white/10 hover:text-white transition-all">ANNULLA</button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="bg-white/10 text-white px-6 py-2 rounded-full font-bold text-sm border border-white/10 hover:bg-white/20 transition-all flex items-center gap-2">
                                    <i className="fas fa-edit"></i> MODIFICA PROFILO
                                </button>
                            )
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
                <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} user={isOwner ? user : null} />
            )}

        </div>
    );
};