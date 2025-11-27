
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { showcaseProjects } from '../data/showcaseData'; // Import real data for preview
import { ShowcaseProject } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';
import { getVideoConfig } from '../utils/videoUtils';

interface LandingPageProps {
    onGetStarted: () => void;
    onExplore: () => void;
    onOpenPricing: () => void;
    onOpenDocs: (section?: string) => void;
}

const FeatureCard: React.FC<{ icon: string, title: string, desc: React.ReactNode, color: string, onClick?: () => void }> = ({ icon, title, desc, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-${color}-500/20`}></div>
        
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl mb-6 text-${color}-400 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
            <i className={`fas ${icon}`}></i>
        </div>
        
        <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-brand-accent transition-colors flex items-center gap-2">
            {title}
            {onClick && <i className="fas fa-arrow-right text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-brand-accent"></i>}
        </h3>
        <div className="text-sm text-brand-text-secondary leading-relaxed group-hover:text-white/80 transition-colors">
            {desc}
        </div>
        {onClick && (
            <div className="mt-4 text-xs font-bold text-brand-accent/70 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                Approfondisci
            </div>
        )}
    </div>
);

const PreviewModal: React.FC<{ project: ShowcaseProject; onClose: () => void }> = ({ project, onClose }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [isGenerating, setIsGenerating] = useState(!project.audioUrl);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Auto-generate audio if no URL provided
    useEffect(() => {
        if (!project.audioUrl) {
            setIsGenerating(true);
            generateParadigmPreview(project.paradigm).then(url => {
                setAudioUrl(url);
                setIsGenerating(false);
            }).catch(() => setIsGenerating(false));
        }
        return () => {
            // Cleanup blob url if it was generated
            if (!project.audioUrl && audioUrl) URL.revokeObjectURL(audioUrl);
        }
    }, [project]);

    // Use shared utility with autoplay enabled
    const videoConfig = project.videoUrl ? getVideoConfig(project.videoUrl, true) : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row animate-zoom-in max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                <button className="absolute top-4 right-4 z-20 text-white/70 hover:text-white bg-black/50 rounded-full p-2 transition-colors" onClick={onClose}>
                    <i className="fas fa-times text-xl"></i>
                </button>

                {/* Visual Side - Prioritize VIDEO if available */}
                <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative group">
                    {videoConfig ? (
                         videoConfig.type === 'native' ? (
                            <video src={videoConfig.src} controls autoPlay className="w-full h-full object-contain" />
                         ) : (
                            <iframe 
                                src={videoConfig.src} 
                                title={project.title} 
                                className="w-full h-full aspect-video" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                         )
                    ) : (
                        <>
                            <img 
                                src={project.imageUrl} 
                                alt={project.title} 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer" 
                            />
                        </>
                    )}
                </div>

                {/* Audio/Info Side */}
                <div className="w-full md:w-1/3 bg-brand-secondary/90 backdrop-blur-xl p-8 flex flex-col border-l border-white/10">
                    <div className="mb-auto">
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${project.paradigm === 'scientific' ? 'bg-blue-900/30 text-blue-300 border-blue-500/30' : project.paradigm === 'artistic' ? 'bg-purple-900/30 text-purple-300 border-purple-500/30' : 'bg-teal-900/30 text-teal-300 border-teal-500/30'}`}>
                                {project.paradigm}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{project.title}</h2>
                        <p className="text-sm text-brand-text-secondary font-light leading-relaxed">
                            {project.description}
                        </p>
                        
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="flex justify-between text-xs text-white/60 mb-2">
                                <span>Tradizione:</span>
                                <span className="text-white font-medium">{project.tradition}</span>
                            </div>
                            <div className="flex justify-between text-xs text-white/60">
                                <span>Autore:</span>
                                <span className="text-white font-medium">{project.author}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        {/* Only show audio player if it's NOT a video project (videos usually have their own audio) */}
                        {!project.videoUrl && (
                            <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-white uppercase tracking-widest">Output Sonoro</span>
                                    {audioUrl ? <i className="fas fa-volume-up text-brand-accent"></i> : <i className="fas fa-spinner fa-spin text-white/50"></i>}
                                </div>
                                {audioUrl ? (
                                    <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
                                ) : isGenerating ? (
                                    <div className="text-xs text-center py-2 text-brand-text-secondary animate-pulse">Generazione anteprima in corso...</div>
                                ) : (
                                    <div className="text-xs text-center py-2 text-brand-text-secondary">Audio preview non disponibile.</div>
                                )}
                                <p className="text-[10px] text-brand-text-secondary/50 mt-2 italic text-center">
                                    * Audio generato real-time dal framework
                                </p>
                            </div>
                        )}
                        {project.videoUrl && (
                             <div className="bg-black/30 p-4 rounded-xl border border-white/10 text-center">
                                <i className="fas fa-video text-purple-400 text-xl mb-2"></i>
                                <p className="text-xs text-brand-text-secondary">Riproduzione video attiva.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onExplore, onOpenPricing, onOpenDocs }) => {
    const { t } = useLanguage();
    const [selectedPreviewProject, setSelectedPreviewProject] = useState<ShowcaseProject | null>(null);

    return (
        <div className="w-full font-sans overflow-x-hidden text-white selection:bg-brand-accent selection:text-brand-primary">
            
            {/* --- HERO SECTION: IMMERSIVE --- */}
            <div className="relative min-h-[85vh] flex flex-col justify-center items-center pt-32 pb-20 z-20 text-center px-6 overflow-hidden">
                
                {/* Animated background elements specifically for Hero */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-accent/10 rounded-full blur-[120px] animate-pulse-glow pointer-events-none"></div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-in-up shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-xs font-bold tracking-widest text-green-400 uppercase">Framework v1.0 Stable</span>
                </div>

                <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-black text-white mb-6 leading-tight tracking-tighter animate-fade-in-up drop-shadow-2xl z-10">
                    Il Suono <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent via-white to-purple-400 animate-gradient-x pb-2">
                        Dell'Invisibile
                    </span>
                </h1>

                <p className="text-lg md:text-2xl text-brand-text-secondary max-w-3xl mx-auto font-light mb-12 animate-fade-in-up leading-relaxed z-10" style={{ animationDelay: '0.2s' }}>
                    Trasforma ogni pixel in frequenza. <br className="hidden md:block" />
                    Il primo framework deterministico per la <strong className="text-white">sonificazione scientifica</strong> e <strong className="text-white">artistica</strong>.
                </p>

                <div className="flex flex-col sm:flex-row gap-6 animate-fade-in-up z-10" style={{ animationDelay: '0.4s' }}>
                    <button 
                        onClick={onGetStarted}
                        className="px-10 py-5 bg-brand-accent text-brand-primary font-black text-base md:text-lg rounded-full hover:bg-brand-accent-light hover:scale-105 hover:shadow-[0_0_40px_rgba(45,212,191,0.6)] transition-all duration-300 flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-play"></i> INIZIA A CREARE
                    </button>
                    <button 
                        onClick={onExplore}
                        className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold text-base md:text-lg rounded-full hover:bg-white/10 hover:border-white/30 backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-compass"></i> ESPLORA VETRINA
                    </button>
                </div>

                {/* Stats Strip */}
                <div className="absolute bottom-10 left-0 w-full flex justify-center gap-8 md:gap-16 text-white/40 text-xs md:text-sm font-mono animate-fade-in" style={{ animationDelay: '0.8s' }}>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-white text-lg">48+</span>
                        <span>Tradizioni Culturali</span>
                    </div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-white text-lg">100%</span>
                        <span>Deterministico</span>
                    </div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-white text-lg">4K</span>
                        <span>Risoluzione Audio</span>
                    </div>
                </div>
            </div>

            {/* --- SHOWCASE PREVIEW STRIP --- */}
            <div className="w-full overflow-hidden bg-black/30 border-y border-white/5 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex justify-between items-end mb-8">
                        <p className="text-brand-text-secondary text-sm uppercase tracking-widest">Cosa puoi sonificare oggi?</p>
                        <span className="text-xs text-brand-accent flex items-center gap-1 animate-pulse"><i className="fas fa-mouse-pointer"></i> Clicca per ascoltare</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {showcaseProjects.slice(0, 4).map((project) => (
                            <div 
                                key={project.id}
                                onClick={() => setSelectedPreviewProject(project)}
                                className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer border border-transparent hover:border-brand-accent/50 transition-all"
                            >
                                {/* Always display image, never inline video */}
                                <img 
                                    src={project.imageUrl} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                    alt={project.title} 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=No+Image'}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                                
                                {/* Play Icon Overlay - Only if media is present */}
                                {(project.videoUrl || project.audioUrl) ? (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                                            <i className={`fas ${project.videoUrl ? 'fa-video' : 'fa-music'} ml-1`}></i>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70">
                                            <i className="fas fa-wave-square"></i>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute bottom-0 left-0 w-full p-4">
                                    <span className="text-white font-bold text-sm block truncate">{project.title}</span>
                                    <span className="text-[10px] text-brand-text-secondary uppercase tracking-wider">{project.paradigm}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- FEATURES GRID --- */}
            <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-20">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">Scienza incontra Arte</h2>
                    <p className="text-brand-text-secondary max-w-2xl mx-auto">
                        Un framework rigoroso che supera i limiti dell'interpretazione soggettiva, fondendo standard scientifici e ricerca etnomusicologica.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard 
                        icon="fa-microscope" 
                        title="Colorimetria CIE LAB D65" 
                        desc={
                            <>
                                Analisi percettivamente uniforme. Garanzia di corrispondenza con la visione umana reale.
                            </>
                        }
                        color="teal"
                        onClick={() => onOpenDocs('doc-colorimetry')}
                    />
                    <FeatureCard 
                        icon="fa-globe-americas" 
                        title="Database Etnomusicologico" 
                        desc={
                            <>
                                48 tradizioni musicali (Maqam, Raga, Gamelan). Selezione matematica della scala microtonale affine.
                            </>
                        }
                        color="purple"
                        onClick={() => onOpenDocs('doc-database')}
                    />
                    <FeatureCard 
                        icon="fa-fingerprint" 
                        title="Determinismo Bit-Perfect" 
                        desc={
                            <>
                                Output sempre identico. Hash SHA-256 e Prova Cinetica (Video) inclusi nel container SAC.
                            </>
                        }
                        color="blue"
                        onClick={() => onOpenDocs('doc-determinism')}
                    />
                </div>
            </div>

            {/* --- ACCESS TIERS --- */}
            <div className="w-full bg-gradient-to-b from-transparent to-black/40 py-24 border-t border-white/5">
                <div className="w-full max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">Tipologie di accesso</h2>
                        <p className="text-brand-text-secondary">Scegli il tuo livello di interazione con il framework.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        {/* Free Tier */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">Ricercatore</h3>
                                <div className="text-3xl font-black text-white mt-2">Gratis</div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per iniziare a sperimentare</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span><strong>5 Crediti</strong> all'iscrizione</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Paradigma Scientifico</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Export MP3 Standard</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Visualizzazione 2D</span></li>
                            </ul>
                            <button onClick={onGetStarted} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">
                                Crea Account
                            </button>
                        </div>

                        {/* Pro Tier - FEATURED */}
                        <div className="bg-brand-secondary/80 backdrop-blur-xl border border-brand-accent/50 rounded-2xl p-8 flex flex-col relative transform scale-105 shadow-2xl shadow-brand-accent/10 z-10">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-accent text-brand-primary text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg">
                                Consigliato
                            </div>
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white text-brand-accent">Artista Pro</h3>
                                <div className="text-3xl font-black text-white mt-2">Su Richiesta</div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per studi creativi e professionisti</p>
                            </div>
                            <ul className="space-y-4 text-sm text-white/90 flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-infinity text-brand-accent"></i> <span><strong>Crediti Illimitati</strong></span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Paradigmi AI Ibrido & Artistico</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Risoluzione 4K Ultra-HD</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Container SAC Completo</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Video Prova Forense (Kinetic)</span></li>
                            </ul>
                            <button onClick={onOpenPricing} className="w-full py-4 bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold rounded-xl transition-colors shadow-lg shadow-brand-accent/20">
                                Richiedi Accesso PRO
                            </button>
                        </div>

                        {/* Enterprise Tier */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">Istituzioni</h3>
                                <div className="text-3xl font-black text-white mt-2">Custom</div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per musei ed eventi live</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Installazioni Interattive</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>API Access Dedicato</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Supporto Hardware</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>White Label</span></li>
                            </ul>
                            <button onClick={onOpenPricing} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">
                                Contattaci
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- FINAL CTA --- */}
            <div className="py-32 text-center px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-accent/5 pointer-events-none"></div>
                <h2 className="text-4xl md:text-6xl font-display font-black text-white mb-8 relative z-10">
                    L'arte ha una voce.<br/>Sei pronto ad ascoltarla?
                </h2>
                <button 
                    onClick={onGetStarted}
                    className="px-12 py-5 bg-white text-black font-black text-lg rounded-full hover:scale-105 transition-transform shadow-2xl relative z-10"
                >
                    INIZIA ORA
                </button>
            </div>

            {/* --- PREVIEW MODAL --- */}
            {selectedPreviewProject && (
                <PreviewModal 
                    project={selectedPreviewProject} 
                    onClose={() => setSelectedPreviewProject(null)} 
                />
            )}

        </div>
    );
};
