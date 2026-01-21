import React, { useState, useEffect, useRef } from 'react';
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
    const isGuest = !user; // Check if user is guest

    // Helpers
    const getAbsoluteUrl = (url: string | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // --- HELPERS (Layout Shared) ---
    const ActionToolbar: React.FC<{ url: string | null | undefined, type: 'video' | 'audio' | 'live', filename?: string, title?: string }> = ({ url, type, filename, title }) => {
        if (!url) return null;
        const safeUrl = getAbsoluteUrl(url) || "";

        return (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
                {/* Download (Video/Audio only) */}
                {type !== 'live' && (
                    <button onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = safeUrl;
                        link.download = filename || "file";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="Scarica">
                        <i className="fas fa-download"></i>
                    </button>
                )}

                {/* Copy Link */}
                <button onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(safeUrl).then(() => alert("Link copiato!"));
                }} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="Copia Link">
                    <i className="fas fa-link"></i>
                </button>

                {/* QR Code */}
                <button onClick={(e) => {
                    e.stopPropagation();
                    setZoomedQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(safeUrl)}`);
                }} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="QR Code">
                    <i className="fas fa-qrcode"></i>
                </button>

                {/* Social Divider */}
                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {/* Social Icons */}
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-green-500 hover:text-green-400 text-sm px-1"><i className="fab fa-whatsapp"></i></button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-blue-500 hover:text-blue-400 text-sm px-1"><i className="fab fa-facebook"></i></button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(safeUrl)}`, '_blank'); }} className="text-gray-400 hover:text-white text-sm px-1"><i className="fab fa-x-twitter"></i></button>
            </div>
        );
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 ${museumMode ? '' : 'backdrop-blur-md'} animate-fade-in p-2 sm:p-4`} onClick={museumMode ? undefined : onClose}>

            {zoomedQrUrl && <QrZoomModal url={zoomedQrUrl} onClose={() => setZoomedQrUrl(null)} />}

            {/* MAIN CONTAINER */}
            <div className={`bg-[#1e1e2e] w-full ${museumMode ? 'max-w-7xl max-h-[98vh]' : 'max-w-7xl max-h-[90vh]'} rounded-2xl overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col border border-white/10 relative`} onClick={e => e.stopPropagation()}>

                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center border border-white/10 transition-colors"><i className="fas fa-times"></i></button>

                {/* HEADER - Minimal & Clean */}
                <div className="px-8 py-6 border-b border-white/10 flex justify-between items-end bg-[#15151b] shrink-0 sticky top-0 z-20">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.3em]">Opera Pubblicata</span>
                            <div className="w-1 h-1 rounded-full bg-white/20"></div>
                            <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">{new Date(project.date).toLocaleDateString()}</span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight uppercase font-display leading-none">
                            {project.title}
                        </h2>
                        <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-accent to-brand-primary flex items-center justify-center text-[10px] text-brand-primary font-bold">
                                    {project.author?.charAt(0) || 'A'}
                                </div>
                                <span className="text-xs font-bold text-white/80 uppercase tracking-wide">{project.author || "Anonimo"}</span>
                            </div>
                            <div className="h-4 w-px bg-white/10"></div>
                            <span className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">{project.tradition} • {project.paradigm}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-2"><i className="fas fa-times text-xl"></i></button>
                </div>

                <div className="flex-1 p-8 bg-[#0B0C10] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">

                        {/* LEFT COLUMN: VISUAL & STORY */}
                        <div className="flex flex-col gap-8">
                            {/* Main Preview Card */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-brand-accent/20 to-purple-600/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <img src={fixImage(project.imageUrl)} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={project.title} />
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {!isGuest && (
                                            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                                                <i className="fas fa-fingerprint text-blue-400 text-[10px]"></i>
                                                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Certified</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Description & Metadata Group */}
                            <div className="space-y-6">
                                <div className="border-l-2 border-brand-accent/30 pl-6">
                                    <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] mb-3">La Visione</h4>
                                    <p className="text-gray-300 text-lg leading-relaxed font-medium italic">
                                        "{project.description || "Un'esperienza sinestetica generata attraverso il framework deterministico SonificA.R.T."}"
                                    </p>
                                </div>

                                {!isGuest && project.imageHash && (
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/10 transition-all" onClick={() => { navigator.clipboard.writeText(project.imageHash!); alert("Hash copiato!"); }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <i className="fas fa-link text-xs"></i>
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Blockchain Hash</span>
                                                <code className="text-[10px] text-blue-300/80 font-mono">{project.imageHash.substring(0, 32)}...</code>
                                            </div>
                                        </div>
                                        <i className="fas fa-copy text-white/20 group-hover:text-white/60 transition-colors"></i>
                                    </div>
                                )}

                                <div className="pt-4 flex flex-wrap gap-3">
                                    <ActionToolbar url={project.imageUrl} type="live" title={project.title} />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: INTERACTION & MEDIA */}
                        <div className="flex flex-col gap-6">

                            {/* 1. Main Interaction: LIVE CONSOLE (Highest Priority) */}
                            <div className="bg-gradient-to-br from-[#1e1e2e] to-[#15151b] rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform translate-x-12 -translate-y-12 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                                    <i className="fas fa-bolt text-[200px] text-white"></i>
                                </div>

                                <div className="relative z-10">
                                    <h4 className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-[0.3em] mb-4">
                                        <i className="fas fa-bolt"></i> Esperienza Live
                                    </h4>
                                    <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm">
                                        {isGuest
                                            ? "Entra nello spazio dell'opera. Interagisci in tempo reale con suoni e colori usando i tuoi sensi."
                                            : "Avvia il motore sinestetico e controlla i parametri biometrici dell'esecuzione."
                                        }
                                    </p>

                                    <button
                                        onClick={() => window.open(`https://sonificart.com/live/${project.id || project.historyId}?play=true`, '_blank')}
                                        className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-[0_10px_40px_rgba(147,51,234,0.3)] hover:shadow-[0_15px_50px_rgba(147,51,234,0.5)] transition-all text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        <i className="fas fa-play"></i> {isGuest ? "ESPLORA OPERA" : "APRI CONSOLE"}
                                    </button>

                                    <div className="mt-8 flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]"></div>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Audio Engine</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]"></div>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Webcam AR</span>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">Pronto</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Multimedia Center: VIDEO & AUDIO */}
                            <div className="grid grid-cols-1 gap-6">
                                {/* Video Section */}
                                <div className="bg-[#15151b] rounded-3xl p-6 border border-white/5 shadow-xl">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                                        <i className="fas fa-video"></i> Video Generativo
                                    </h4>
                                    <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner group relative">
                                        {project.videoUrl ? (
                                            <video src={getAbsoluteUrl(project.videoUrl)!} className="w-full h-full object-contain" controls />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                                                <i className="fas fa-film text-3xl mb-2"></i>
                                                <span className="text-[10px] font-bold uppercase">Non Generato</span>
                                            </div>
                                        )}
                                    </div>
                                    {!isGuest && project.videoUrl && (
                                        <div className="mt-4 flex justify-between items-center">
                                            <ActionToolbar url={project.videoUrl} type="video" filename={`video_${project.id}.mp4`} title={project.title} />
                                        </div>
                                    )}
                                </div>

                                {/* Audio Section */}
                                <div className="bg-[#15151b] rounded-3xl p-6 border border-white/5 shadow-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="flex items-center gap-2 text-brand-primary-light text-[10px] font-black uppercase tracking-[0.2em]">
                                            <i className="fas fa-music"></i> Audio Originale
                                        </h4>
                                        <span className="text-[8px] font-black bg-white/5 px-2 py-1 rounded text-white/20 border border-white/5 tracking-[0.2em]">SINTESI DIGITALE</span>
                                    </div>
                                    <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                                        <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent shrink-0">
                                            <i className="fas fa-wave-square"></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {project.audioUrl ? (
                                                <audio controls src={getAbsoluteUrl(project.audioUrl)!} className="h-8 w-full invert opacity-80" />
                                            ) : (
                                                <span className="text-xs text-white/30 italic">Audio non disponibile</span>
                                            )}
                                        </div>
                                    </div>
                                    {!isGuest && project.audioUrl && (
                                        <div className="mt-4">
                                            <ActionToolbar url={project.audioUrl} type="audio" filename={`audio_${project.id}.wav`} title={project.title} />
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
