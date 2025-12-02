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

interface ProjectModalProps {
    project: ShowcaseProject;
    onClose: () => void;
    user?: User | null;
    onDelete: (id: string) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, onDelete }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [isGenerating, setIsGenerating] = useState(!project.audioUrl);
    const audioRef = useRef<HTMLAudioElement>(null);

    const hasVideo = !!project.videoUrl;
    const isOwner = user && (user.isAdmin || user.id === project.ownerId);

    // Genera preview audio se manca (fallback)
    useEffect(() => {
        if (!project.audioUrl && !hasVideo) {
            setIsGenerating(true);
            generateParadigmPreview(project.paradigm as any).then(url => {
                setAudioUrl(url);
                setIsGenerating(false);
            });
        }
    }, [project, hasVideo]);

    const handleDelete = () => {
        if (confirm("Sei sicuro di voler rimuovere questa opera dalla vetrina pubblica?")) {
            onDelete(project.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
            <div className="bg-[#1e1e2e] w-full max-w-6xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-white/10 animate-zoom-in" onClick={e => e.stopPropagation()}>

                {/* MEDIA AREA (SINISTRA) */}
                <div className="w-full md:w-2/3 bg-black relative flex items-center justify-center">
                    {hasVideo ? (
                        <video src={project.videoUrl} controls autoPlay className="w-full h-full object-contain" />
                    ) : (
                        <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-contain" />
                    )}

                    {/* Overlay Titolo in basso */}
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/60 to-transparent p-8 pt-24">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 font-display shadow-black drop-shadow-md">{project.title}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-300">
                            <span className="flex items-center gap-1"><i className="fas fa-user-circle"></i> {project.author}</span>
                            <span className="text-gray-500">•</span>
                            <span>{new Date(project.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* INFO AREA (DESTRA) */}
                <div className="w-full md:w-1/3 bg-[#1e1e2e] border-l border-white/10 p-8 flex flex-col overflow-y-auto">
                    <button onClick={onClose} className="self-end text-gray-400 hover:text-white mb-6 transition-colors">
                        <i className="fas fa-times text-2xl"></i>
                    </button>

                    <div className="mb-8">
                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-3">Descrizione</h3>
                        <p className="text-gray-300 leading-relaxed text-sm">
                            {project.description || "Nessuna descrizione fornita dall'artista."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1">Tradizione</span>
                            <span className="text-sm font-bold text-white">{project.tradition}</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1">Paradigma</span>
                            <span className="text-sm font-bold text-white capitalize">{project.paradigm}</span>
                        </div>
                    </div>

                    {/* PLAYER AUDIO (Solo se non è video) */}
                    {!hasVideo && (
                        <div className="mt-auto bg-brand-secondary/30 p-4 rounded-xl border border-brand-secondary/50">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                                    <i className="fas fa-music"></i>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Traccia Audio</h4>
                                    <p className="text-[10px] text-gray-400">{isGenerating ? "Sintesi anteprima..." : "Riproduzione"}</p>
                                </div>
                            </div>
                            {audioUrl ? (
                                <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
                            ) : (
                                <div className="h-10 bg-white/5 rounded animate-pulse w-full"></div>
                            )}
                        </div>
                    )}

                    {/* TASTO ELIMINA (Solo Admin/Owner) */}
                    {isOwner && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={handleDelete}
                                className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-trash"></i> Rimuovi dalla Galleria
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ShowcaseViewProps {
    user?: User | null;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({ user }) => {
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
    const [filter, setFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const ITEMS_PER_PAGE = 12;

    const fetchShowcase = () => {
        setIsLoading(true);
        api.getShowcase().then(data => {
            setProjects(data);
            setIsLoading(false);
        }).catch(e => {
            console.error(e);
            setIsLoading(false);
        });
    };

    useEffect(() => { fetchShowcase(); }, []);

    // Logica Ordinamento e Filtro
    const filteredAndSortedProjects = useMemo(() => {
        let result = [...projects];
        if (filter !== 'all') {
            result = result.filter(p => p.paradigm === filter);
        }
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
            return a.title.localeCompare(b.title);
        });
        return result;
    }, [projects, filter, sortOrder]);

    // Logica Paginazione
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedProjects.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedProjects, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);

    const handleDeleteItem = async (id: string) => {
        await api.deleteShowcaseItem(id);
        fetchShowcase(); // Ricarica lista
    };

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">

            <div className="text-center mb-12">
                <h2 className="text-4xl font-display font-bold text-white mb-4">Galleria Sonificazioni</h2>
                <p className="text-brand-text-secondary mb-8">Esplora le opere della community.</p>

                {/* BARRA FILTRI & ORDINAMENTO */}
                <div className="flex flex-wrap justify-center gap-4 bg-white/5 p-2 rounded-full inline-flex backdrop-blur-sm border border-white/10">
                    {['all', 'scientific', 'artistic', 'hybrid'].map(f => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setCurrentPage(1); }}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-brand-accent text-brand-primary' : 'text-gray-400 hover:text-white'}`}
                        >
                            {f === 'all' ? 'Tutti' : f}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-white/10 mx-2 self-center hidden sm:block"></div>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-gray-300 focus:outline-none cursor-pointer appearance-none py-1 px-2"
                    >
                        <option value="newest" className="bg-[#0f172a]">Più Recenti</option>
                        <option value="oldest" className="bg-[#0f172a]">Meno Recenti</option>
                        <option value="az" className="bg-[#0f172a]">A-Z</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500">Caricamento opere...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                        {paginatedProjects.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedProject(p)}
                                className="group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-accent/50 hover:shadow-[0_0_30px_rgba(45,212,191,0.1)] transition-all"
                            >
                                <img src={fixImage(p.imageUrl)} className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" alt={p.title} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-4 flex flex-col justify-end">
                                    <span className="text-[10px] text-brand-accent font-bold uppercase tracking-wider mb-1">{p.paradigm}</span>
                                    <h3 className="text-white font-bold text-lg leading-tight truncate">{p.title}</h3>
                                    <p className="text-xs text-gray-400">by {p.author}</p>
                                </div>
                                {/* Icona tipo media */}
                                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center text-white">
                                    <i className={`fas ${p.videoUrl ? 'fa-video' : 'fa-music'} text-xs`}></i>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CONTROLLI PAGINAZIONE */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-12">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&lt;</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded font-bold text-sm ${currentPage === p ? 'bg-brand-accent text-brand-primary' : 'bg-white/10 text-white hover:bg-white/20'}`}>{p}</button>
                            ))}
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&gt;</button>
                        </div>
                    )}
                </>
            )}

            {selectedProject && (
                <ProjectModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    user={user}
                    onDelete={handleDeleteItem}
                />
            )}
        </div>
    );
};