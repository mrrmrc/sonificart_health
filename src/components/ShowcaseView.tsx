
import React, { useState, useEffect, useRef } from 'react';
import { ShowcaseProject } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';
import { getVideoConfig } from '../utils/videoUtils';

const ProjectCard: React.FC<{ project: ShowcaseProject; onClick: () => void }> = ({ project, onClick }) => {
    const getParadigmColor = (p: string) => {
        switch(p) {
            case 'scientific': return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
            case 'artistic': return 'text-purple-400 bg-purple-900/30 border-purple-500/30';
            case 'hybrid': return 'text-brand-accent bg-teal-900/30 border-brand-accent/30';
            default: return 'text-gray-400 bg-gray-800 border-gray-700';
        }
    };

    return (
        <div 
            onClick={onClick}
            className="group relative bg-brand-secondary/40 border border-brand-secondary rounded-lg overflow-hidden hover:border-brand-accent/50 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-brand-accent/10 hover:-translate-y-1"
        >
            <div className="aspect-video overflow-hidden relative">
                <img 
                    src={project.imageUrl} 
                    alt={project.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x400?text=No+Image';
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-secondary to-transparent opacity-60"></div>
                <div className="absolute bottom-3 left-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider backdrop-blur-sm ${getParadigmColor(project.paradigm)}`}>
                        {project.paradigm}
                    </span>
                </div>
            </div>
            
            <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-brand-accent transition-colors line-clamp-1">{project.title}</h3>
                </div>
                <p className="text-brand-text-secondary text-sm line-clamp-2 mb-4 min-h-[40px]">
                    {project.description}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-brand-text-secondary font-mono border-t border-brand-secondary/50 pt-3">
                    <span className="flex items-center gap-1">
                        <i className="fas fa-globe-americas text-brand-accent/70"></i> {project.tradition}
                    </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {project.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-brand-primary px-2 py-1 rounded-full text-brand-text-secondary border border-brand-secondary">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ProjectModal: React.FC<{ project: ShowcaseProject; onClose: () => void }> = ({ project, onClose }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!project.videoUrl && !audioUrl) {
            let url: string | null = null;
            generateParadigmPreview(project.paradigm).then(u => {
                url = u;
                setAudioUrl(u);
            });
            return () => {
                if (url) URL.revokeObjectURL(url);
            };
        }
    }, [project.paradigm, audioUrl, project.videoUrl]);

    // Use shared utility with autoplay enabled
    const videoConfig = project.videoUrl ? getVideoConfig(project.videoUrl, true) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-5xl bg-brand-secondary rounded-xl shadow-2xl border border-brand-secondary/50 animate-zoom-in overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <button className="absolute top-4 right-4 text-white/50 hover:text-white z-10 text-2xl bg-black/50 rounded-full p-2" onClick={onClose}>&times;</button>

                {/* Visual Side: Video OR Image */}
                <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative">
                    {videoConfig ? (
                        videoConfig.type === 'native' ? (
                            <video src={videoConfig.src} controls autoPlay className="max-w-full max-h-[50vh] md:max-h-full object-contain w-full h-full" />
                        ) : (
                            <iframe 
                                src={videoConfig.src} 
                                title={project.title} 
                                className="w-full h-full max-h-[50vh] md:max-h-full aspect-video" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                        )
                    ) : (
                        <img 
                            src={project.imageUrl} 
                            alt={project.title} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-[50vh] md:max-h-full object-contain" 
                        />
                    )}
                    
                    {!project.videoUrl && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                            <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
                            <p className="text-brand-text-secondary">by {project.author} · {project.date}</p>
                        </div>
                    )}
                </div>

                {/* Content Side */}
                <div className="w-full md:w-2/5 p-8 overflow-y-auto bg-brand-secondary border-l border-white/10">
                    {project.videoUrl && (
                        <div className="mb-6 border-b border-white/10 pb-4">
                            <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
                            <p className="text-brand-text-secondary">by {project.author} · {project.date}</p>
                        </div>
                    )}

                    <div className="mb-6">
                        <h3 className="text-brand-accent font-bold uppercase tracking-widest text-xs mb-2">Descrizione del Progetto</h3>
                        <p className="text-brand-text-primary leading-relaxed">
                            {project.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Paradigma</div>
                            <div className="text-white font-bold capitalize">{project.paradigm}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Tradizione</div>
                            <div className="text-white font-bold truncate" title={project.tradition}>{project.tradition}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Durata</div>
                            <div className="text-white font-mono">{project.stats.duration}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Note Generate</div>
                            <div className="text-white font-mono">{project.stats.notes}</div>
                        </div>
                    </div>

                    {!project.videoUrl && (
                        <div className="bg-brand-accent/10 border border-brand-accent/30 p-6 rounded-lg mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <i className="fas fa-music text-2xl text-brand-accent"></i>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Anteprima Audio SAC</h4>
                                    <p className="text-xs text-brand-text-secondary">Estratto generato dal container</p>
                                </div>
                            </div>
                            
                            {audioUrl ? (
                                <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
                                    <i className="fas fa-spinner fa-spin text-white/50"></i> Generazione anteprima...
                                </div>
                            )}
                        </div>
                    )}
                    
                    {project.videoUrl && (
                        <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center mb-6">
                            <i className="fas fa-video text-purple-400 text-xl mb-2"></i>
                            <p className="text-xs text-brand-text-secondary">Riproduzione video attiva nel player principale.</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {project.tags.map(tag => (
                            <span key={tag} className="text-xs bg-brand-primary px-3 py-1 rounded-full text-brand-text-secondary border border-brand-secondary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ShowcaseView: React.FC = () => {
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.getShowcase();
                setProjects(data);
            } catch (e) {
                console.error("Failed to load showcase", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredProjects = filter === 'all' 
        ? projects 
        : projects.filter(p => p.paradigm === filter);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                 <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-brand-accent mb-4"></div>
                 <p className="text-brand-text-secondary">Caricamento vetrina...</p>
            </div>
        );
    }

    return (
        <div className="w-full animate-fade-in pb-10">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white mb-4">Vetrina Progetti</h2>
                <p className="text-brand-text-secondary max-w-2xl mx-auto">
                    Esplora come l'algoritmo SonificA.R.T. trasforma capolavori artistici, dati scientifici e fotografia urbana in esperienze sonore uniche.
                </p>
                
                <div className="flex justify-center gap-4 mt-8">
                    {['all', 'scientific', 'artistic', 'hybrid'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all capitalize ${
                                filter === f 
                                ? 'bg-brand-accent text-brand-primary shadow-lg shadow-brand-accent/20' 
                                : 'bg-brand-secondary text-brand-text-secondary hover:text-white'
                            }`}
                        >
                            {f === 'all' ? 'Tutti' : f}
                        </button>
                    ))}
                </div>
            </div>

            {filteredProjects.length === 0 ? (
                <div className="text-center py-12 bg-brand-secondary/20 rounded-lg">
                    <p className="text-brand-text-secondary">Nessun progetto trovato in questa categoria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                    {filteredProjects.map(project => (
                        <ProjectCard 
                            key={project.id} 
                            project={project} 
                            onClick={() => setSelectedProject(project)} 
                        />
                    ))}
                </div>
            )}

            {selectedProject && (
                <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
            )}
        </div>
    );
};
