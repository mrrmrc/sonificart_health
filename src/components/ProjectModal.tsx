import React, { useState, useEffect, useRef } from 'react';
import { ShowcaseProject, User } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmationModal } from './ConfirmationModal';

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

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, onDelete, onUpdate, museumMode }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [zoomedQrUrl, setZoomedQrUrl] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Target ID: prefer historyId (for showcase items linked to history), fallback to id (if it is a history item)
        const targetId = project.historyId || project.id;

        try {
            const newUrl = await api.uploadHistoryAudio(targetId, file);
            setAudioUrl(newUrl);
            if (onUpdate) {
                // Call update to parent if needed, though mostly visual here until refresh
                onUpdate({ ...project, audioUrl: newUrl });
            }
            alert("Audio aggiornato con successo!");
        } catch (error) {
            console.error(error);
            alert("Errore durante l'upload dell'audio.");
        }
    };

    const getAbsoluteUrl = (url: string | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    useEffect(() => {
        if (!project.audioUrl && !project.videoUrl) {
            generateParadigmPreview(project.paradigm as any).then(url => {
                if (url) {
                    setAudioUrl(url);
                }
            });
        } else {
            setAudioUrl(project.audioUrl || null);
        }
    }, [project]);

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
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 ${museumMode ? '' : 'backdrop-blur-md'} animate-fade-in p-4`} onClick={museumMode ? undefined : onClose}>

            {zoomedQrUrl && <QrZoomModal url={zoomedQrUrl} onClose={() => setZoomedQrUrl(null)} />}

            {/* MAIN CONTAINER (Adapted Layout) */}
            <div className={`bg-[#1e1e2e] w-full ${museumMode ? 'max-w-7xl h-[95vh]' : 'max-w-7xl h-[85vh]'} rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10 relative`} onClick={e => e.stopPropagation()}>

                {/* Hidden Audio Input */}
                <input type="file" ref={fileInputRef} hidden accept="audio/*" onChange={handleAudioUpload} />

                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center border border-white/10"><i className="fas fa-times"></i></button>

                {/* HEADER */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#15151b] shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-gradient-to-b from-brand-accent to-brand-primary rounded-full"></div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">GALLERIA OPERE</h2>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Visualizzazione & Performance</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-[#0B0C10] custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                        {/* COL 1: METADATA & PREVIEW (Left, span 3/12 ~ 25%) */}
                        <div className="lg:col-span-3 flex flex-col gap-4 h-full">
                            {/* Preview */}
                            <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group shadow-lg shrink-0">
                                <img src={fixImage(project.imageUrl)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Preview" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                    <h3 className="text-white font-bold text-lg leading-tight uppercase font-display">{project.title}</h3>
                                </div>
                            </div>

                            {/* Metadata Info (Read Only) */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-5 flex-1 flex flex-col gap-4 shadow-lg h-full">
                                <h4 className="flex items-center gap-2 text-[#2dd4bf] text-xs font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                                    <i className="fas fa-info-circle"></i> Info Opera
                                </h4>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Titolo</label>
                                    <p className="w-full bg-black/30 border border-white/5 rounded px-3 py-2 text-sm text-white">{project.title}</p>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Descrizione</label>
                                    <div className="w-full h-full min-h-[100px] bg-black/30 border border-white/5 rounded px-3 py-2 text-sm text-gray-300 overflow-y-auto custom-scrollbar">
                                        {project.description || "Nessuna descrizione disponibile."}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-white/5">
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Autore</label>
                                        <p className="text-xs text-white truncate"><i className="fas fa-user-circle mr-1"></i> {project.author || "Anonimo"}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Data</label>
                                        <p className="text-xs text-white truncate"><i className="fas fa-calendar mr-1"></i> {new Date(project.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COL 2: MEDIA (Right, span 9/12) */}
                        <div className="lg:col-span-9 flex flex-col gap-6">

                            {/* TOP: AUDIO SOURCE */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-6 relative overflow-hidden shadow-lg shrink-0">
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-xs font-bold uppercase tracking-wider">
                                        <i className="fas fa-music"></i> Sorgente Audio
                                    </h4>
                                    {!museumMode && (
                                        <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold bg-[#2dd4bf]/10 text-[#2dd4bf] px-3 py-1 rounded-full hover:bg-[#2dd4bf]/20 transition-colors">
                                            <i className="fas fa-upload mr-1"></i> CAMBIA AUDIO
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-black/30 rounded-lg p-4 border border-white/5 flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#2dd4bf]/10 flex items-center justify-center text-[#2dd4bf]">
                                    <i className="fas fa-music"></i>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-white font-bold text-sm truncate">{project.tradition || "Audio Originale"}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider">{project.paradigm || "Scientifico"}</div>
                                </div>
                                {audioUrl && <audio controls src={getAbsoluteUrl(audioUrl)!} className="h-8 max-w-[200px]" />}
                            </div>

                            <ActionToolbar url={audioUrl} type="audio" filename={`audio_${project.id}.wav`} title={project.title} />
                        </div>

                        {/* BOTTOM: GRID 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">

                            {/* VIDEO GENERATIVO */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-6 flex flex-col shadow-lg">
                                <h4 className="flex items-center gap-2 text-[#2dd4bf] text-xs font-bold uppercase tracking-wider mb-4">
                                    <i className="fas fa-video"></i> Video Generativo
                                </h4>

                                <div className="flex-1 bg-black rounded-lg border border-white/10 overflow-hidden relative group min-h-[250px] flex items-center justify-center">
                                    {project.videoUrl ? (
                                        <video src={getAbsoluteUrl(project.videoUrl)!} className="w-full h-full object-contain" controls />
                                    ) : (
                                        <div className="text-center opacity-50">
                                            <i className="fas fa-film text-4xl text-gray-700 mb-3 block"></i>
                                            <p className="text-xs text-gray-500">Nessun video generato.</p>
                                        </div>
                                    )}
                                </div>
                                {project.videoUrl && (
                                    <div className="mt-4">
                                        <ActionToolbar url={project.videoUrl} type="video" filename={`video_${project.id}.mp4`} title={project.title} />
                                    </div>
                                )}
                            </div>

                            {/* LIVE PERFORMANCE */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-6 flex flex-col shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><i className="fas fa-bolt text-6xl text-purple-500"></i></div>
                                <h4 className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-4">
                                    <i className="fas fa-bolt"></i> Live Performance
                                </h4>
                                <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                                    Esegui questa opera in tempo reale con il motore sinestetico.
                                </p>

                                <div className="bg-black/30 border border-white/5 p-4 rounded-lg mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-gray-300">System Status</span>
                                        <span className="text-[10px] font-mono text-green-400">READY</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] text-gray-400 uppercase">Audio</span></div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] text-gray-400 uppercase">Webcam</span></div>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <button onClick={() => window.open(`https://sonificart.com/live/${project.id || project.historyId}?play=true`, '_blank')} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all text-xs uppercase tracking-widest">
                                        Open Console
                                    </button>
                                    <div className="mt-4 flex justify-center">
                                        <ActionToolbar url={`https://sonificart.com/live/${project.id || project.historyId}`} type="live" title={project.title} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};
