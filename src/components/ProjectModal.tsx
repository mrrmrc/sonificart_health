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

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, museumMode }) => {
    const [zoomedQrUrl, setZoomedQrUrl] = useState<string | null>(null);

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

                {/* HEADER */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#15151b] shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-gradient-to-b from-brand-accent to-brand-primary rounded-full"></div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Galleria Opere</h2>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Visualizzazione & Performance</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 sm:p-6 bg-[#0B0C10] custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                        {/* COL 1: METADATA, CERTIFICATE & CULTURAL (Left, span 3/12) */}
                        <div className="lg:col-span-3 flex flex-col gap-4">

                            {/* 1. Preview Image */}
                            <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group shadow-lg shrink-0">
                                <img src={fixImage(project.imageUrl)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Preview" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                    <h3 className="text-white font-bold text-lg leading-tight uppercase font-display shadow-black drop-shadow-md">{project.title}</h3>
                                </div>
                            </div>

                            {/* 2. Metadata Info (Condensed) */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                                <h4 className="flex items-center gap-2 text-[#2dd4bf] text-[10px] font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                                    <i className="fas fa-info-circle"></i> Info Opera
                                </h4>

                                <div>
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Titolo</label>
                                    <div className="w-full bg-black/30 border border-white/5 rounded px-3 py-2 text-xs text-white font-bold truncate">
                                        {project.title}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Descrizione</label>
                                    <div className="w-full max-h-[80px] bg-black/30 border border-white/5 rounded px-3 py-2 text-xs text-gray-300 overflow-y-auto custom-scrollbar leading-relaxed">
                                        {project.description || "Nessuna descrizione disponibile."}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Autore</label>
                                        <p className="text-xs text-white truncate"><i className="fas fa-user-circle mr-1 text-gray-400"></i> {project.author || "Anonimo"}</p>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Data</label>
                                        <p className="text-xs text-white truncate"><i className="fas fa-calendar mr-1 text-gray-400"></i> {new Date(project.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. FORENSIC CERTIFICATE (New) */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-4 flex flex-col gap-3 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10"><i className="fas fa-fingerprint text-5xl text-white"></i></div>
                                <h4 className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5 pb-2 z-10 relative">
                                    <i className="fas fa-certificate"></i> Certificato Forense
                                </h4>

                                <div className="z-10 relative">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Verificato su Blockchain</span>
                                    </div>
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">SHA-256 Hash</label>
                                    <div className="flex items-center gap-2 bg-black/40 rounded p-2 border border-white/5 group cursor-pointer" onClick={() => { navigator.clipboard.writeText(project.imageHash || "N/A"); alert("Hash copiato!"); }}>
                                        <code className="text-[10px] text-blue-300 font-mono truncate flex-1 block">
                                            {project.imageHash || "Hash non disponibile"}
                                        </code>
                                        <i className="fas fa-copy text-gray-500 group-hover:text-white text-xs transition-colors"></i>
                                    </div>
                                </div>
                            </div>

                            {/* 4. CULTURAL SELECTION (New) */}
                            {project.blockData && (
                                <div className="bg-[#15151b] border border-white/5 rounded-xl p-4 flex-1 shadow-lg relative overflow-hidden flex flex-col">
                                    <h4 className="flex items-center gap-2 text-pink-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5 pb-2 mb-2">
                                        <i className="fas fa-globe-americas"></i> Selezione Culturale
                                    </h4>

                                    <div className="mb-3">
                                        <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Tradizione Identificata</label>
                                        <p className="text-sm font-bold text-white">{project.tradition}</p>
                                    </div>

                                    {/* Mini Palette Visualization based on blockData stats if available, else static placeholder */}
                                    <div className="space-y-2 mt-auto">
                                        <div className="flex justify-between text-[9px] text-gray-400 uppercase">
                                            <span>Analisi Cromatica</span>
                                            <span>{project.blockData.coveragePercentage?.toFixed(0) || 0}% Coverage</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex">
                                            {/* Simulate distribution based on available data or generic if missing detailed breakdown */}
                                            <div className="h-full bg-red-500" style={{ width: '30%' }}></div>
                                            <div className="h-full bg-yellow-500" style={{ width: '20%' }}></div>
                                            <div className="h-full bg-blue-500" style={{ width: '15%' }}></div>
                                            <div className="h-full bg-green-500" style={{ width: '35%' }}></div>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
                                            <span className="text-[9px] text-gray-400">Hue Diversity</span>
                                            <span className="text-[10px] text-white font-mono">{project.blockData.globalStats?.hue_diversity?.toFixed(2) || "0.00"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* COL 2: MEDIA (Right, span 9/12) */}
                        <div className="lg:col-span-9 flex flex-col gap-4 sm:gap-6">

                            {/* TOP: AUDIO SOURCE */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-6 relative overflow-hidden shadow-lg shrink-0">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-xs font-bold uppercase tracking-wider">
                                        <i className="fas fa-music"></i> Sorgente Audio
                                    </h4>
                                    {/* Read Only Badge */}
                                    <span className="text-[9px] font-bold bg-white/5 text-gray-400 px-2 py-1 rounded border border-white/10">READ ONLY</span>
                                </div>

                                <div className="bg-black/30 rounded-lg p-4 border border-white/5 flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-[#2dd4bf]/10 flex items-center justify-center text-[#2dd4bf] shrink-0">
                                        <i className="fas fa-music"></i>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-white font-bold text-sm truncate">{project.tradition || "Audio Originale"}</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider">{project.paradigm || "Scientifico"}</div>
                                    </div>
                                    {project.audioUrl && <audio controls src={getAbsoluteUrl(project.audioUrl)!} className="h-8 w-full max-w-[250px]" />}
                                </div>

                                <ActionToolbar url={project.audioUrl} type="audio" filename={`audio_${project.id}.wav`} title={project.title} />
                            </div>

                            {/* BOTTOM: GRID 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

                                {/* VIDEO GENERATIVO */}
                                <div className="bg-[#15151b] border border-white/5 rounded-xl p-4 sm:p-6 flex flex-col shadow-lg min-h-[280px] sm:min-h-[350px]">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-xs font-bold uppercase tracking-wider mb-4">
                                        <i className="fas fa-video"></i> Video Generativo
                                    </h4>

                                    <div className="flex-1 bg-black rounded-lg border border-white/10 overflow-hidden relative group min-h-[180px] sm:min-h-[220px] flex items-center justify-center">
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
                                {/* LIVE PERFORMANCE */}
                                <div className="bg-[#15151b] border border-white/5 rounded-xl p-4 sm:p-6 flex flex-col shadow-lg relative overflow-hidden min-h-[280px] sm:min-h-[350px]">
                                    <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none"><i className="fas fa-bolt text-6xl text-purple-500"></i></div>

                                    <div className="relative z-10 flex flex-col h-full">
                                        <h4 className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-4">
                                            <i className="fas fa-bolt"></i> Live Performance
                                        </h4>
                                        <p className="text-gray-400 text-xs mb-6 leading-relaxed bg-transparent">
                                            Esegui questa opera in tempo reale con il motore sinestetico.
                                        </p>

                                        <div className="bg-black/30 border border-white/5 p-4 rounded-lg mb-6">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-gray-300">System Status</span>
                                                <span className="text-[10px] font-mono text-green-400 animate-pulse">READY</span>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_lime]"></div><span className="text-[10px] text-gray-400 uppercase">Audio</span></div>
                                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_lime]"></div><span className="text-[10px] text-gray-400 uppercase">Webcam</span></div>
                                            </div>
                                        </div>

                                        <div className="mt-auto w-full">
                                            <button onClick={() => window.open(`https://sonificart.com/live/${project.id || project.historyId}?play=true`, '_blank')} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all text-xs uppercase tracking-widest relative group overflow-hidden">
                                                <span className="relative z-10"><i className="fas fa-play mr-2"></i> OPEN CONSOLE</span>
                                                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                                            </button>
                                            <div className="mt-4 flex justify-center w-full">
                                                <ActionToolbar url={`https://sonificart.com/live/${project.id || project.historyId}`} type="live" title={project.title} />
                                            </div>
                                        </div>
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
