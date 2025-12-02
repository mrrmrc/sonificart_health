import React, { useState, useEffect, useRef } from 'react';
import { ShowcaseProject, User } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';
import { getVideoConfig } from '../utils/videoUtils';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

const ProjectCard: React.FC<{ project: ShowcaseProject; onClick: () => void }> = ({ project, onClick }) => {
    const getParadigmColor = (p: string) => {
        switch (p) {
            case 'scientific': return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
            case 'artistic': return 'text-purple-400 bg-purple-900/30 border-purple-500/30';
            case 'hybrid': return 'text-brand-accent bg-teal-900/30 border-brand-accent/30';
            default: return 'text-gray-400 bg-gray-800 border-gray-700';
        }
    };

    return (
        <div onClick={onClick} className="group relative bg-brand-secondary/40 border border-brand-secondary rounded-lg overflow-hidden hover:border-brand-accent/50 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-brand-accent/10 hover:-translate-y-1">
            <div className="aspect-video overflow-hidden relative">
                <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-secondary to-transparent opacity-60"></div>
                <div className="absolute bottom-3 left-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider backdrop-blur-sm ${getParadigmColor(project.paradigm)}`}>{project.paradigm}</span>
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-xl font-bold text-white group-hover:text-brand-accent transition-colors line-clamp-1 mb-2">{project.title}</h3>
                <p className="text-brand-text-secondary text-sm line-clamp-2 mb-4 min-h-[40px]">{project.description}</p>
                <div className="flex items-center gap-3 text-xs text-brand-text-secondary font-mono border-t border-brand-secondary/50 pt-3">
                    <span className="flex items-center gap-1"><i className="fas fa-globe-americas text-brand-accent/70"></i> {project.tradition}</span>
                </div>
            </div>
        </div>
    );
};

interface ProjectModalProps {
    project: ShowcaseProject;
    onClose: () => void;
    user: User | null;
    onDelete: (id: string) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, onDelete }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [isGenerating, setIsGenerating] = useState(!project.audioUrl);
    const audioRef = useRef<HTMLAudioElement>(null);

    const hasVideo = !!project.videoUrl;
    const videoConfig = hasVideo ? getVideoConfig(project.videoUrl!, true) : null;

    // Verifica se l'utente corrente è il proprietario o un admin
    const isOwner = user && (user.isAdmin || user.id === project.ownerId);

    const shareUrl = window.location.origin + "/gallery?id=" + project.id;

    useEffect(() => {
        if (!project.audioUrl && !hasVideo) {
            setIsGenerating(true);
            generateParadigmPreview(project.paradigm).then(u => {
                setAudioUrl(u);
                setIsGenerating(false);
            });
        }
    }, [project, hasVideo]);

    const handleDelete = () => {
        if (confirm("Sei sicuro di voler eliminare questa opera dalla vetrina?")) {
            onDelete(project.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-6xl bg-brand-secondary rounded-xl shadow-2xl border border-brand-secondary/50 animate-zoom-in overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white z-10 text-2xl bg-black/50 rounded-full p-2 w-10 h-10 flex items-center justify-center" onClick={onClose}>&times;</button>

                {/* SINISTRA: MEDIA */}
                <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative">
                    {hasVideo && videoConfig ? (
                        videoConfig.type === 'native' ?
                            <video src={videoConfig.src} controls autoPlay className="w-full h-full object-contain" /> :
                            <iframe src={videoConfig.src} className="w-full h-full aspect-video" frameBorder="0" allow="autoplay; fullscreen"></iframe>
                    ) : (
                        <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-contain" />
                    )}

                    {!hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {isGenerating && <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>}
                        </div>
                    )}
                </div>

                {/* DESTRA: INFO */}
                <div className="w-full md:w-1/3 p-8 overflow-y-auto bg-[#1e1e2e] border-l border-white/10 flex flex-col">

                    <div className="mb-6">
                        <h2 className="text-3xl font-bold text-white mb-2 leading-tight">{project.title}</h2>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                            by <span className="text-white font-bold">{project.author}</span>
                            <span>•</span>
                            <span>{project.date}</span>
                        </p>
                    </div>

                    <div className="mb-6 bg-black/20 p-4 rounded-lg border border-white/5">
                        <h3 className="text-xs font-bold text-brand-accent uppercase mb-2">Descrizione</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            {project.description || "Nessuna descrizione."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-white/5 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block">Paradigma</span>
                            <span className="text-sm text-white capitalize">{project.paradigm}</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block">Tradizione</span>
                            <span className="text-sm text-white truncate">{project.tradition}</span>
                        </div>
                    </div>

                    {/* PLAYER AUDIO (Se non c'è video) */}
                    {!hasVideo && (
                        <div className="mb-6 bg-brand-secondary/40 p-4 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-white uppercase">Traccia Audio</span>
                                {audioUrl && <a href={audioUrl} download="track.wav" className="text-xs text-brand-accent hover:underline"><i className="fas fa-download mr-1"></i> Scarica</a>}
                            </div>
                            {audioUrl ? <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} /> : <div className="text-xs text-gray-500 animate-pulse">Caricamento audio...</div>}
                        </div>
                    )}

                    {/* QR CODE & AZIONI */}
                    <div className="mt-auto pt-6 border-t border-white/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-white p-1 rounded w-20 h-20 flex-shrink-0">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(audioUrl || shareUrl)}`} alt="QR" className="w-full h-full" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Scansiona & Ascolta</h4>
                                <p className="text-xs text-gray-400 mb-2">Porta l'opera con te.</p>
                                <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors">
                                    Copia Link
                                </button>
                            </div>
                        </div>

                        {/* TASTI MODIFICA (SOLO AUTORE) */}
                        {isOwner && (
                            <div className="flex gap-2 mt-4">
                                <button onClick={handleDelete} className="flex-1 bg-red-500/20 text-red-400 text-xs font-bold py-2 rounded border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors">
                                    Elimina Opera
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export const ShowcaseView: React.FC<{ user?: User | null }> = ({ user }) => {
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);

    const fetchShowcase = async () => {
        setIsLoading(true);
        try {
            const data = await api.getShowcase();
            setProjects(data);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchShowcase(); }, []);

    const handleDelete = async (id: string) => {
        await api.deleteShowcaseItem(id);
        fetchShowcase();
    };

    const filteredProjects = filter === 'all' ? projects : projects.filter(p => p.paradigm === filter);

    if (isLoading) return <div className="text-center py-20">Caricamento...</div>;

    return (
        <div className="w-full animate-fade-in pb-10">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white mb-4">Vetrina Progetti</h2>
                <p className="text-brand-text-secondary max-w-2xl mx-auto">Esplora le opere della community.</p>
                <div className="flex justify-center gap-4 mt-8">
                    {['all', 'scientific', 'artistic', 'hybrid'].map((f) => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-bold capitalize ${filter === f ? 'bg-brand-accent text-brand-primary' : 'bg-brand-secondary text-brand-text-secondary'}`}>{f === 'all' ? 'Tutti' : f}</button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {filteredProjects.map(project => <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} />)}
            </div>

            {selectedProject && (
                <ProjectModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    user={user ?? null} // <--- CORREZIONE APPLICATA QUI
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
};