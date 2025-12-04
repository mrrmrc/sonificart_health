import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShowcaseProject, User } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

// --- MODALE ZOOM QR ---
const QrZoomModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
        <div className="bg-white p-4 rounded-xl shadow-2xl animate-zoom-in max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-black font-bold mb-4 text-lg">Scansiona QR Code</h3>
            <img src={url} alt="QR Full" className="w-full h-auto" />
            <button onClick={onClose} className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-black transition-colors">Chiudi</button>
        </div>
    </div>
);

interface ProjectModalProps {
    project: ShowcaseProject;
    onClose: () => void;
    user?: User | null;
    onDelete: (id: string) => void;
    onUpdate: (project: ShowcaseProject) => void; // Callback per aggiornare la lista dopo edit
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, onDelete, onUpdate }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [isGenerating, setIsGenerating] = useState(!project.audioUrl);
    const [isQrZoomed, setIsQrZoomed] = useState(false);

    // EDIT MODE STATES
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(project.title);
    const [editDescription, setEditDescription] = useState(project.description);
    const [isSaving, setIsSaving] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const hasVideo = !!project.videoUrl;
    const isOwner = user && (user.isAdmin || user.id === project.ownerId);

    const shareUrl = `${window.location.origin}/?gallery_id=${project.id}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

    useEffect(() => {
        if (!project.audioUrl && !hasVideo) {
            setIsGenerating(true);
            generateParadigmPreview(project.paradigm as any).then(url => {
                setAudioUrl(url);
                setIsGenerating(false);
            });
        }
    }, [project, hasVideo]);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // STOP PROPAGATION
        if (confirm("Sei sicuro di voler rimuovere questa opera dalla vetrina pubblica?")) {
            onDelete(project.id);
        }
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation(); // STOP PROPAGATION
        setIsSaving(true);
        try {
            const updatedProject = { ...project, title: editTitle, description: editDescription };
            await api.updateShowcaseItem(updatedProject);
            onUpdate(updatedProject);
            setIsEditing(false);
        } catch (e) {
            alert("Errore nel salvataggio.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(shareUrl);
        alert("Link copiato negli appunti!");
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-4" onClick={onClose}>

            {isQrZoomed && <QrZoomModal url={qrImgUrl} onClose={() => setIsQrZoomed(false)} />}

            <div className="bg-[#0f172a] w-full max-w-6xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-white/10 animate-zoom-in relative" onClick={e => e.stopPropagation()}>

                {/* MEDIA AREA (SINISTRA) */}
                <div className="w-full md:w-2/3 bg-black relative flex items-center justify-center">
                    {hasVideo ? (
                        <video src={project.videoUrl} controls autoPlay className="w-full h-full object-contain" />
                    ) : (
                        <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-contain" />
                    )}
                </div>

                {/* INFO AREA (DESTRA) */}
                <div className="w-full md:w-1/3 bg-[#1e1e2e] border-l border-white/10 p-8 flex flex-col overflow-y-auto relative z-10 custom-scrollbar">
                    <button onClick={onClose} className="self-end text-white/50 hover:text-white mb-4 transition-colors bg-white/5 rounded-full w-8 h-8 flex items-center justify-center">
                        <i className="fas fa-times"></i>
                    </button>

                    {/* INTESTAZIONE (MODIFICABILE) */}
                    <div className="mb-6 border-b border-white/10 pb-6">
                        {isEditing ? (
                            <input
                                className="w-full bg-black/30 border border-white/20 p-2 rounded text-2xl font-bold text-white mb-2 focus:border-brand-accent outline-none"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <h1 className="text-3xl font-bold text-white mb-2 font-display leading-tight">{project.title}</h1>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-sm text-brand-text-secondary font-mono">
                            <span className="flex items-center gap-2 bg-black/30 px-2 py-1 rounded border border-white/5">
                                <i className="fas fa-user-circle"></i> {project.author}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span>{new Date(project.date).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* DESCRIZIONE (MODIFICABILE) */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-2">Descrizione</h3>
                        {isEditing ? (
                            <textarea
                                className="w-full bg-black/30 border border-white/20 p-2 rounded text-sm text-white h-32 focus:border-brand-accent outline-none resize-none"
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <p className="text-gray-300 leading-relaxed text-sm">
                                {project.description || "Nessuna descrizione fornita."}
                            </p>
                        )}
                    </div>

                    {/* DATI TECNICI (SOLA LETTURA) */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">Tradizione</span>
                            <span className="text-sm font-bold text-white truncate">{project.tradition}</span>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">Paradigma</span>
                            <span className="text-sm font-bold text-white capitalize">{project.paradigm}</span>
                        </div>
                    </div>

                    {/* QR CODE */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 flex items-center gap-4">
                        <div className="w-20 h-20 bg-white p-1 rounded cursor-pointer hover:scale-105 transition-transform" onClick={() => setIsQrZoomed(true)}>
                            <img src={qrImgUrl} alt="QR" className="w-full h-full" />
                        </div>
                        <div className="flex flex-col gap-2 flex-grow">
                            <h4 className="text-xs font-bold text-white uppercase">Condividi Opera</h4>
                            <div className="flex gap-2">
                                <button onClick={() => setIsQrZoomed(true)} className="flex-1 py-1.5 bg-black/40 hover:bg-black/60 text-white text-[10px] font-bold rounded border border-white/10 transition-colors">Zoom</button>
                                <button onClick={handleShare} className="flex-1 py-1.5 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent text-[10px] font-bold rounded border border-brand-accent/20 transition-colors">Copia Link</button>
                            </div>
                        </div>
                    </div>

                    {/* AUDIO PLAYER */}
                    {!hasVideo && (
                        <div className="bg-brand-secondary/20 p-4 rounded-xl border border-brand-secondary/30 shadow-inner mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <i className="fas fa-music text-brand-accent"></i>
                                <h4 className="text-sm font-bold text-white">Traccia Audio</h4>
                            </div>
                            {audioUrl ? <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} /> : <div className="h-10 bg-white/5 rounded animate-pulse w-full"></div>}
                        </div>
                    )}

                    {hasVideo && (
                        <div className="bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 shadow-inner mb-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <i className="fas fa-video"></i>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Opera Multimediale</h4>
                                <p className="text-xs text-purple-200">Riproduzione video attiva</p>
                            </div>
                        </div>
                    )}

                    {/* AZIONI PROPRIETARIO */}
                    {isOwner && (
                        <div className="mt-auto pt-6 border-t border-white/10 flex gap-3">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs font-bold transition-colors">Annulla</button>
                                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors">
                                        {isSaving ? "Salvataggio..." : "Salva Modifiche"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="flex-1 py-3 px-4 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                        <i className="fas fa-edit"></i> Modifica
                                    </button>
                                    <button onClick={handleDelete} className="flex-1 py-3 px-4 bg-red-500/10 hover:bg-red-500/40 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                        <i className="fas fa-trash"></i> Rimuovi
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ShowcaseViewProps {
    user?: User | null;
    initialProjectId?: string;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({ user, initialProjectId }) => {
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
    const [filter, setFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const ITEMS_PER_PAGE = 12;

    const fetchShowcase = async () => {
        setIsLoading(true);
        try {
            // FIX: Cache busting per vedere subito le modifiche
            const timestamp = new Date().getTime();
            const data = await api.getShowcase(); // Assume che api.getShowcase gestisca internamente o accetti parametri, altrimenti forzare nell'API
            setProjects(data);

            if (initialProjectId) {
                // FIX: Tipo esplicito
                const target = data.find((p: ShowcaseProject) => p.id === initialProjectId);
                if (target) setSelectedProject(target);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchShowcase(); }, [initialProjectId]);

    const filteredAndSortedProjects = useMemo(() => {
        let result = [...projects];
        if (filter !== 'all') result = result.filter(p => p.paradigm === filter);
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
            return a.title.localeCompare(b.title);
        });
        return result;
    }, [projects, filter, sortOrder]);

    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedProjects.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedProjects, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);

    const handleDeleteItem = async (id: string) => {
        // 1. Update UI immediately (Optimistic)
        setProjects(prev => prev.filter(p => p.id !== id));
        setSelectedProject(null);

        // 2. Call API
        try {
            await api.deleteShowcaseItem(id);
        } catch (e) {
            alert("Errore cancellazione.");
            fetchShowcase(); // Revert if failed
        }
    };

    const handleUpdateItem = (updatedProject: ShowcaseProject) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setSelectedProject(updatedProject);
    };

    if (isLoading) return <div className="text-center py-20 text-gray-500">Caricamento opere...</div>;

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-display font-bold text-white mb-4">Galleria Sonificazioni</h2>
                <p className="text-brand-text-secondary mb-8">Esplora le opere della community.</p>
                <div className="flex flex-wrap justify-center gap-4 bg-white/5 p-2 rounded-full inline-flex backdrop-blur-sm border border-white/10">
                    {['all', 'scientific', 'artistic', 'hybrid'].map(f => (
                        <button key={f} onClick={() => { setFilter(f); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-brand-accent text-brand-primary' : 'text-gray-400 hover:text-white'}`}>{f === 'all' ? 'Tutti' : f}</button>
                    ))}
                    <div className="w-px h-6 bg-white/10 mx-2 self-center hidden sm:block"></div>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="bg-transparent text-xs font-bold text-gray-300 focus:outline-none cursor-pointer appearance-none py-1 px-2">
                        <option value="newest" className="bg-[#0f172a]">Più Recenti</option>
                        <option value="oldest" className="bg-[#0f172a]">Meno Recenti</option>
                        <option value="az" className="bg-[#0f172a]">A-Z</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {paginatedProjects.map(p => (
                    <div key={p.id} onClick={() => setSelectedProject(p)} className="group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-accent/50 hover:shadow-lg transition-all">
                        <img src={fixImage(p.imageUrl)} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-all duration-700" alt={p.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-4 flex flex-col justify-end">
                            <span className="text-[10px] text-brand-accent font-bold uppercase mb-1">{p.paradigm}</span>
                            <h3 className="text-white font-bold text-lg leading-tight truncate">{p.title}</h3>
                            <p className="text-xs text-gray-400">by {p.author}</p>
                        </div>
                        {p.videoUrl && <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center text-white"><i className="fas fa-video text-xs"></i></div>}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-12">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&lt;</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded font-bold text-sm ${currentPage === p ? 'bg-brand-accent text-brand-primary' : 'bg-white/10 text-white hover:bg-white/20'}`}>{p}</button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&gt;</button>
                </div>
            )}

            {selectedProject && (
                <ProjectModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    user={user}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                />
            )}
        </div>
    );
};