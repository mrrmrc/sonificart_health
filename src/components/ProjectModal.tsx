import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShowcaseProject, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

const QrZoomModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white p-4 rounded-xl shadow-2xl animate-zoom-in max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-black font-bold mb-4 text-lg">{t('showcase.scan_qr')}</h3>
                <img src={url} alt="QR Full" className="w-full h-auto" />
                <button onClick={onClose} className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-black transition-colors">{t('showcase.close')}</button>
            </div>
        </div>
    );
};

export interface ProjectModalProps {
    project: ShowcaseProject;
    onClose: () => void;
    user?: User | null;
    onDelete?: (id: string) => void;
    onUpdate?: (project: ShowcaseProject) => void;
    museumMode?: boolean;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, museumMode }) => {
    const [zoomedQrUrl, setZoomedQrUrl] = useState<string | null>(null);
    const isGuest = !user;
    const { t } = useLanguage();

    const isOwner = user && project.ownerId && user.id === project.ownerId;
    const canDownload = isOwner || !!user?.isAdmin;

    // Helpers
    const getAbsoluteUrl = (url: string | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const ActionToolbar: React.FC<{ url: string | null | undefined, type: 'video' | 'audio' | 'live', filename?: string, title?: string }> = ({ url, type, filename }) => {
        if (!url) return null;
        const safeUrl = getAbsoluteUrl(url) || "";

        return (
            <div className="flex flex-wrap gap-1.5 items-center">
                {type !== 'live' && canDownload && (
                    <button onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = safeUrl;
                        link.download = filename || "file";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }} className="bg-white/5 hover:bg-white/10 text-xs px-2.5 py-1.5 rounded text-gray-300 hover:text-white transition-colors" title="Scarica">
                        <i className="fas fa-download"></i>
                    </button>
                )}
                <button onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(safeUrl).then(() => alert("Link copiato!"));
                }} className="bg-white/5 hover:bg-white/10 text-xs px-2.5 py-1.5 rounded text-gray-300 hover:text-white transition-colors" title="Copia Link">
                    <i className="fas fa-link"></i>
                </button>
                <button onClick={(e) => {
                    e.stopPropagation();
                    setZoomedQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(safeUrl)}`);
                }} className="bg-white/5 hover:bg-white/10 text-xs px-2.5 py-1.5 rounded text-gray-300 hover:text-white transition-colors" title="QR Code">
                    <i className="fas fa-qrcode"></i>
                </button>
                <div className="w-px h-5 bg-white/10 mx-1"></div>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-green-500 hover:text-green-400 text-sm px-1"><i className="fab fa-whatsapp"></i></button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-blue-500 hover:text-blue-400 text-sm px-1"><i className="fab fa-facebook"></i></button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-gray-400 hover:text-white text-sm px-1"><i className="fab fa-x-twitter"></i></button>
            </div>
        );
    };

    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/80 ${museumMode ? '' : 'backdrop-blur-md'} animate-fade-in p-2 sm:p-6 lg:p-10`} onClick={museumMode ? undefined : onClose}>
            {zoomedQrUrl && <QrZoomModal url={zoomedQrUrl} onClose={() => setZoomedQrUrl(null)} />}

            <div className={`bg-[#1e1e2e] w-full ${museumMode ? 'max-w-7xl max-h-[98vh]' : 'max-w-6xl max-h-[85vh] h-auto lg:h-[82vh]'} rounded-3xl shadow-2xl flex flex-col border border-white/10 relative overflow-hidden`} onClick={e => e.stopPropagation()}>

                {/* CLOSE BUTTON */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white bg-black/60 backdrop-blur-md rounded-full w-9 h-9 flex items-center justify-center border border-white/10 transition-all hover:scale-110 shadow-lg cursor-pointer">
                    <i className="fas fa-times text-sm"></i>
                </button>

                {/* MODAL HEADER - STICKY */}
                <header className="px-5 md:px-8 py-4 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-xl shrink-0 z-40">
                    <div className="flex items-center gap-4">
                        <div className="w-1 h-8 bg-brand-accent rounded-full shadow-[0_0_15px_rgba(45,212,191,0.4)]"></div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[9px] font-black text-brand-accent uppercase tracking-[0.3em]">Archivio Digitale</span>
                                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{new Date(project.date).toLocaleDateString()}</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase font-display leading-none">
                                {project.title}
                            </h2>
                        </div>
                    </div>
                </header>

                {/* MAIN CONTENT - SCROLLABLE */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0B0C10]">
                    <div className="p-3 md:p-6 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-4 md:gap-8">

                            {/* LEFT: VISUAL */}
                            <div className="flex flex-col gap-4">
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-brand-accent/20 to-purple-600/20 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                                    <div className="relative aspect-square lg:h-[38vh] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex items-center justify-center">
                                        <img
                                            src={fixImage(project.imageUrl)}
                                            className="max-w-full max-h-full object-contain transition-transform duration-1000 group-hover:scale-105"
                                            alt={project.title}
                                        />
                                        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-brand-accent/30 text-[9px] font-black text-brand-accent uppercase tracking-widest flex items-center gap-1.5">
                                            <i className="fas fa-certificate"></i> Verified Art
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                                    <h4 className="text-[9px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2">
                                        <i className="fas fa-align-left"></i> La Visione Curatoriale
                                    </h4>
                                    <p className="text-gray-300 text-[11px] leading-relaxed italic opacity-85 font-medium line-clamp-3">
                                        "{project.description || "Un'esperienza sinestetica generata attraverso il framework deterministico SonificA.R.T."}"
                                    </p>
                                    <div className="pt-1 flex items-center gap-3">
                                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest shrink-0">Footprint:</span>
                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 overflow-hidden">
                                            <i className="fas fa-link text-brand-accent text-[10px]"></i>
                                            <code className="text-[9px] text-gray-500 font-mono truncate">{project.historyId || "0x..."}</code>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: MULTIMEDIA */}
                            <div className="flex flex-col gap-4">
                                <div className="bg-[#15151b] rounded-3xl p-5 border border-white/10 shadow-2xl space-y-5">

                                    {/* Video generative section */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[9px] font-black text-brand-accent uppercase tracking-[0.2em] flex items-center gap-2">
                                                <i className="fas fa-video"></i> Video Generativo
                                            </h4>
                                        </div>
                                        <div className="aspect-video lg:h-[22vh] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner group relative">
                                            {project.videoUrl ? (
                                                <video controls src={getAbsoluteUrl(project.videoUrl)!} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-black/40 text-white/20 text-xs italic">
                                                    Video non disponibile
                                                </div>
                                            )}
                                        </div>
                                        {project.videoUrl && (
                                            <div className="pt-0.5"><ActionToolbar url={project.videoUrl} type="video" filename={`video_${project.id}.mp4`} /></div>
                                        )}
                                    </div>

                                    {/* Audio section */}
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <i className="fas fa-wave-square"></i> Audio Originale
                                        </h4>
                                        <div className="bg-black/60 p-2 rounded-xl border border-white/5">
                                            {project.audioUrl ? (
                                                <audio controls src={getAbsoluteUrl(project.audioUrl)!} className="w-full h-8 invert brightness-150" />
                                            ) : (
                                                <div className="py-1 text-center text-white/20 text-[10px] italic">Audio non presente</div>
                                            )}
                                        </div>
                                        {project.audioUrl && (
                                            <div className="pt-0.5"><ActionToolbar url={project.audioUrl} type="audio" filename={`audio_${project.id}.wav`} /></div>
                                        )}
                                    </div>
                                </div>

                                {/* LIVE PERFORMANCE - CALL TO ACTION */}
                                <div className="bg-gradient-to-br from-purple-900/40 to-[#1e1e2e] rounded-3xl p-5 border border-purple-500/20 shadow-2xl relative overflow-hidden group flex-1 flex flex-col justify-center">
                                    <div className="relative z-10 flex flex-col gap-2">
                                        <h4 className="text-[9px] font-black text-purple-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                            <i className="fas fa-bolt"></i> Live Experience
                                        </h4>
                                        <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                                            Interagisci in tempo reale: il tuo sguardo e i movimenti trasformano l'immagine in suono.
                                        </p>
                                        <button
                                            onClick={() => window.open(`https://sonificart.com/live/${project.id || project.historyId}?play=true`, '_blank')}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <i className="fas fa-play text-xs"></i>
                                            {isGuest ? "Esplora Opera" : "Apri Console Live"}
                                        </button>
                                        <div className="flex items-center justify-between text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1">
                                            <span className="flex items-center gap-1.5"><i className="fas fa-microphone text-green-500/70"></i> Audio Sync</span>
                                            <span className="flex items-center gap-1.5"><i className="fas fa-eye text-green-500/70"></i> Gaze Ready</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* MODAL FOOTER - STICKY */}
                <footer className="px-5 md:px-8 py-4 bg-black/60 backdrop-blur-xl border-t border-white/10 shrink-0 flex items-center justify-between z-40">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-accent to-purple-600 flex items-center justify-center text-white font-black text-xs">
                                {project.author?.charAt(0) || 'A'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-white uppercase tracking-wider">{project.author || "SonificART Artist"}</span>
                                <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Framework Artist v1.1</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
                        <ActionToolbar url={project.imageUrl} type="live" title={project.title} />
                    </div>
                </footer>

            </div>
        </div>
    );
};
