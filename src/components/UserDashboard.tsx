import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User, TransformedNoteEvent, SonificationResult } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { generateSonificationVideo } from '../services/videoService';
import { VideoGenService } from '../services/VideoGenService';
import { LivePerformanceOverlay } from './LivePerformanceOverlay';

const fixImage = (url: string | null | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return `https://sonificart.com${url}`;
    return `data:image/jpeg;base64,${url}`;
};

// --- PUBLISH DASHBOARD COMPONENT (Refactored) ---
const PublishModal: React.FC<{ entry: DashboardEntry, onClose: () => void, user?: User }> = ({ entry, onClose, user }) => {
    // STATE: Metadata
    const [title, setTitle] = useState(entry.title || "Opera Senza Titolo");
    const [subtitle, setSubtitle] = useState(entry.subtitle || ""); // Ensure entry has subtitle prop or default empty
    const [description, setDescription] = useState(entry.description || "");

    // STATE: Audio
    const [unifiedAudioFile, setUnifiedAudioFile] = useState<File | null>(null);
    const [hasAudioChanged, setHasAudioChanged] = useState(false);

    // STATE: Video
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(entry.videoUrl || null);

    // STATE: Actions
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Helpers
    const getAbsoluteUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // ACTION: Save Metadata
    const handleSaveMetadata = async () => {
        setIsSubmitting(true);
        try {
            await api.updateMetadata(entry.id, title, subtitle, description);
            alert("Dati salvati con successo!");
            entry.title = title; // Update local ref
            // entry.subtitle = subtitle; // Check types
        } catch (e) {
            alert("Errore salvataggio dati: " + e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ACTION: Change Audio
    const handleAudioChange = async (file: File) => {
        setUnifiedAudioFile(file);
        setHasAudioChanged(true);

        // Auto-delete video logic
        if (activeVideoUrl) {
            if (confirm("Attenzione: Modificando l'audio, il video generato attuale non sarà più sincronizzato e verrà eliminato. Vuoi procedere?")) {
                setIsSubmitting(true);
                try {
                    await api.detachVideoFromHistory(entry.id);
                    setActiveVideoUrl(null);
                    entry.videoUrl = null;
                } catch (e) {
                    console.error("Errore rimozione video obsoleto", e);
                    alert("Impossibile rimuovere il video precedente: " + e);
                } finally {
                    setIsSubmitting(false);
                }
            } else {
                // Cancel change
                setUnifiedAudioFile(null);
                setHasAudioChanged(false);
                return;
            }
        }
    };

    // ACTION: Upload Audio (Pre-requisite for Live/Video)
    const ensureAudioUploaded = async (): Promise<boolean> => {
        if (unifiedAudioFile && hasAudioChanged) {
            setIsSubmitting(true);
            try {
                const newUrl = await api.attachAudioToHistory(entry.id, unifiedAudioFile, unifiedAudioFile.name);
                entry.audioUrl = (newUrl as any).audioUrl; // Update ref
                setHasAudioChanged(false); // Reset flag
                return true;
            } catch (e) {
                alert("Errore caricamento audio: " + e);
                return false;
            } finally {
                setIsSubmitting(false);
            }
        }
        return true;
    };

    // ACTION: Generate Video
    const handleGenerateVideo = async () => {
        if (!(await ensureAudioUploaded())) return;

        setIsSubmitting(true);
        setUploadProgress(0);
        try {
            let audioBlob: Blob;
            if (unifiedAudioFile) {
                audioBlob = unifiedAudioFile;
            } else if (entry.audioUrl) {
                const r = await fetch(entry.audioUrl);
                audioBlob = await r.blob();
            } else {
                throw new Error("Impossibile recuperare il file audio per la generazione video.");
            }

            const videoBlob = await VideoGenService.generateVideo({
                imageUrl: fixImage(entry.imageUrl),
                audioUrl: audioBlob,
                title: title,
                subtitle: subtitle,
                date: new Date(entry.timestamp).toLocaleDateString('it-IT'),
                author: user?.name,
                onProgress: (p: number) => setUploadProgress(Math.floor(p))
            });

            // Re-start progress for Upload phase
            setUploadProgress(1);
            const videoUrl = await api.attachVideoToHistory(entry.id, videoBlob, `video_${entry.id}.mp4`, (p) => setUploadProgress(p));

            if (videoUrl) {
                const uniqueUrl = `${videoUrl}?t=${Date.now()}`;
                setActiveVideoUrl(uniqueUrl);
                entry.videoUrl = uniqueUrl;
            }
        } catch (e) {
            alert("Errore Generazione Video: " + e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ACTION: Open Live
    const handleOpenLive = async () => {
        if (!(await ensureAudioUploaded())) return;
        window.open(`https://sonificart.com/live/${entry.id}?play=true`, '_blank');
    };

    // ACTION: Webcam Check
    const checkWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            alert("✅ Webcam Rilevata e Funzionante!");
            stream.getTracks().forEach(t => t.stop());
        } catch (e) {
            alert("❌ Webcam Errore: " + e + ". Verifica i permessi del browser.");
        }
    };

    // ACTION: Publish to Showcase (Optional final step)
    const handlePublish = async () => {
        if (!confirm("Vuoi pubblicare questa opera nella vetrina pubblica?")) return;
        setIsSubmitting(true);
        try {
            await api.publishFromHistory(entry.id, { description }, activeVideoUrl ? { url: activeVideoUrl, type: 'video' } : null);
            alert("Opera pubblicata in vetrina!");
        } catch (e) {
            alert("Errore : " + e);
        } finally { setIsSubmitting(false); }
    };

    const downloadFile = (url: string | null | undefined, name: string) => {
        if (!url) return;
        const link = document.createElement('a');
        link.href = getAbsoluteUrl(url) || url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- SHARE LOGIC ---
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [qrTitle, setQrTitle] = useState<string>("");

    const openQR = (url: string, title: string) => {
        if (!url) return;
        const full = url.startsWith('http') ? url : getAbsoluteUrl(url) || "";
        setQrUrl(full);
        setQrTitle(title);
    };

    const copyLink = (url: string) => {
        if (!url) return;
        const full = url.startsWith('http') ? url : getAbsoluteUrl(url) || "";
        navigator.clipboard.writeText(full).then(() => alert("Link copiato negli appunti!"));
    };

    const socialShare = (platform: 'whatsapp' | 'facebook' | 'twitter' | 'linkedin', url: string, text: string) => {
        if (!url) return;
        const full = url.startsWith('http') ? url : getAbsoluteUrl(url) || "";
        const encUrl = encodeURIComponent(full);
        const encText = encodeURIComponent(text);

        let link = "";
        switch (platform) {
            case 'whatsapp': link = `https://wa.me/?text=${encText}%20${encUrl}`; break;
            case 'facebook': link = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`; break;
            case 'twitter': link = `https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`; break;
            case 'linkedin': link = `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`; break;
        }
        window.open(link, '_blank');
    };

    const ActionToolbar: React.FC<{ url: string | null, type: 'video' | 'audio' | 'live', filename?: string, title?: string }> = ({ url, type, filename, title }) => {
        if (!url) return null;

        return (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
                {/* Download (Video/Audio only) */}
                {type !== 'live' && (
                    <button onClick={() => downloadFile(url, filename || "file")} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="Scarica">
                        <i className="fas fa-download"></i>
                    </button>
                )}

                {/* Copy Link */}
                <button onClick={() => copyLink(url)} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="Copia Link">
                    <i className="fas fa-link"></i>
                </button>

                {/* QR Code */}
                <button onClick={() => openQR(url, title || "QR Code")} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-2 rounded text-gray-300 hover:text-white transition-colors" title="QR Code">
                    <i className="fas fa-qrcode"></i>
                </button>

                {/* Social Divider */}
                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {/* Social Icons */}
                <button onClick={() => socialShare('whatsapp', url, title || "Guarda questa opera")} className="text-green-500 hover:text-green-400 text-sm px-1"><i className="fab fa-whatsapp"></i></button>
                <button onClick={() => socialShare('facebook', url, title || "Guarda questa opera")} className="text-blue-500 hover:text-blue-400 text-sm px-1"><i className="fab fa-facebook"></i></button>
                <button onClick={() => socialShare('linkedin', url, title || "Guarda questa opera")} className="text-blue-400 hover:text-blue-300 text-sm px-1"><i className="fab fa-linkedin"></i></button>
                <button onClick={() => socialShare('twitter', url, title || "Guarda questa opera")} className="text-gray-400 hover:text-white text-sm px-1"><i className="fab fa-x-twitter"></i></button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0f172a] w-full max-w-[90vw] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">

                {/* HEADER */}
                <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/40 flex-shrink-0">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <i className="fas fa-sliders-h text-brand-accent"></i> Studio Multimediale
                    </h3>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePublish} className="px-4 py-1.5 bg-brand-primary/20 hover:bg-brand-primary/40 text-brand-accent border border-brand-accent/30 hover:border-brand-accent/50 text-xs font-bold uppercase rounded transition-all">
                            <i className="fas fa-globe mr-2"></i> Pubblica
                        </button>
                        <div className="w-px h-6 bg-white/10"></div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-4 bg-gradient-to-br from-[#050505] to-[#101010]">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">

                        {/* COL 1: DATI OPERA */}
                        <div className="lg:col-span-1 flex flex-col gap-4 h-full overflow-hidden">
                            {/* Preview Image - Fixed Height Ratio */}
                            <div className="relative h-[35%] w-full rounded-xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0 bg-black">
                                <img src={fixImage(entry.imageUrl)} className="w-full h-full object-contain" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                                <div className="absolute bottom-3 left-3 right-3">
                                    <h2 className="text-white font-bold text-lg leading-tight shadow-black drop-shadow-md truncate">{title}</h2>
                                </div>
                            </div>

                            {/* Form - Scrollable */}
                            <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                                <h4 className="text-brand-accent text-[10px] font-bold uppercase tracking-widest flex-shrink-0"><i className="fas fa-pen-nib mr-2"></i> Metadata</h4>
                                <div>
                                    <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Titolo</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:border-brand-accent outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Sottotitolo</label>
                                    <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:border-brand-accent outline-none" />
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Descrizione</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white text-xs resize-none focus:border-brand-accent outline-none min-h-[60px]" />
                                </div>
                                <button onClick={handleSaveMetadata} disabled={isSubmitting} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold uppercase transition-colors flex-shrink-0">
                                    <i className="fas fa-save mr-1"></i> Salva
                                </button>
                            </div>
                        </div>

                        {/* COL 2 & 3: MULTIMEDIA - FULL RESTORED DIMENSIONS */}
                        <div className="lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">

                            {/* BLOCK: SORGENTE AUDIO - CARD LAYOUT */}
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex-shrink-0">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-brand-accent text-black flex items-center justify-center text-xs">A</span>
                                        Sorgente Audio
                                    </h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => document.getElementById('audio-upload')?.click()} className="text-xs bg-brand-accent text-brand-primary hover:bg-white px-4 py-1.5 rounded font-bold uppercase transition-colors">
                                            <i className="fas fa-upload mr-1"></i> {unifiedAudioFile ? "Cambia File" : "Carica/Cambia"}
                                        </button>
                                        <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={e => {
                                            if (e.target.files?.[0]) handleAudioChange(e.target.files[0]);
                                            e.target.value = '';
                                        }} />
                                    </div>
                                </div>
                                <div className="bg-black/40 rounded-lg p-4 flex items-center gap-4 border border-white/5">
                                    <div className="w-10 h-10 bg-brand-secondary rounded-full flex items-center justify-center text-brand-accent">
                                        <i className="fas fa-music"></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-white font-bold text-sm">
                                            {unifiedAudioFile ? unifiedAudioFile.name : (entry.audioUrl ? "Audio Originale.wav" : "Nessun Audio")}
                                        </div>
                                        {hasAudioChanged && <div className="text-yellow-500 text-[10px] mt-1"><i className="fas fa-exclamation-circle"></i> Modifiche non salvate</div>}
                                    </div>
                                </div>

                                {/* Audio Actions Bar (Inside Card) */}
                                {(unifiedAudioFile || entry.audioUrl) && (
                                    <div className="mt-3">
                                        <ActionToolbar
                                            url={unifiedAudioFile ? null : (entry.audioUrl || "")}
                                            type="audio"
                                            filename="audio_originale.wav"
                                            title={`Audio: ${title}`}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* GRID: VIDEO & LIVE - MINIMUM HEIGHTS ENFORCED */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pb-4">

                                {/* VIDEO BLOCK */}
                                <div className="bg-black/20 rounded-xl p-5 border border-white/10 flex flex-col h-full min-h-[400px] overflow-hidden relative group">
                                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                        <h4 className="text-brand-accent font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                                            <i className="fas fa-film"></i> Video Generativo
                                        </h4>
                                    </div>

                                    <div className="flex-1 bg-black rounded-lg overflow-hidden border border-white/5 relative flex items-center justify-center min-h-0">
                                        {activeVideoUrl ? (
                                            <video src={getAbsoluteUrl(activeVideoUrl)!} className="w-full h-full object-contain" controls playsInline />
                                        ) : (
                                            <div className="text-center opacity-40">
                                                <i className="fas fa-video-slash text-2xl mb-2 text-gray-500"></i>
                                                <p className="text-[9px] text-gray-500 uppercase">Nessun video</p>
                                            </div>
                                        )}
                                        {isSubmitting && uploadProgress <= 100 && (
                                            <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-brand-accent backdrop-blur-sm">
                                                <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin mb-2"></div>
                                                <span className="text-[9px] uppercase font-bold tracking-widest">
                                                    {isSubmitting && uploadProgress < 100 ? `${uploadProgress}%` : "Processing..."}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-2 flex-shrink-0">
                                        {!activeVideoUrl ? (
                                            <button onClick={handleGenerateVideo} disabled={isSubmitting} className="w-full py-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold uppercase text-[10px] rounded border border-white/10 transition-colors">
                                                Genera Video
                                            </button>
                                        ) : (
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="flex gap-1">
                                                    <button onClick={() => activeVideoUrl && downloadFile(activeVideoUrl, `video.mp4`)} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded text-[10px]"><i className="fas fa-download"></i></button>
                                                    <button onClick={async () => { if (confirm("Eliminare il video?")) { await api.detachVideoFromHistory(entry.id); setActiveVideoUrl(null); entry.videoUrl = null; } }} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 p-1.5 rounded text-[10px]"><i className="fas fa-trash"></i></button>
                                                </div>
                                                <div className="scale-90 origin-right">
                                                    <ActionToolbar url={activeVideoUrl} type="video" filename={`video.mp4`} title={`Video`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* LIVE BLOCK */}
                                <div className="bg-gradient-to-br from-purple-900/10 to-black rounded-xl p-5 border border-purple-500/20 flex flex-col h-full min-h-[400px] overflow-hidden">
                                    <h4 className="text-purple-400 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 flex-shrink-0">
                                        <i className="fas fa-bolt"></i> Live Performance
                                    </h4>

                                    <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto custom-scrollbar px-1">
                                        <p className="text-[10px] text-gray-400 leading-snug">
                                            Interactive environment driven by facial expression tracking.
                                        </p>
                                        <div className="bg-purple-500/5 p-2 rounded border border-purple-500/10 text-[9px] text-purple-200/80">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold">System Status:</span>
                                                <button onClick={checkWebcam} className="text-purple-300 hover:text-white underline decoration-dashed cursor-pointer">Test Cam</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1">
                                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Audio</div>
                                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div> Webcam</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex-shrink-0">
                                        <button onClick={handleOpenLive} className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold uppercase text-[10px] rounded shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.01] mb-1">
                                            Open Console
                                        </button>
                                        <div className="flex justify-center scale-90">
                                            <ActionToolbar url={`https://sonificart.com/performance/${entry.id}`} type="live" title={`Live`} />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>



                    </div>
                </div>
            </div>

            {/* QR MODAL */}
            {qrUrl && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setQrUrl(null)}>
                    <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 max-w-sm w-full text-center shadow-2xl transform scale-100 transition-all" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{qrTitle}</h3>
                            <button onClick={() => setQrUrl(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="bg-white p-4 rounded-xl inline-block mb-4">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`} alt="QR Code" className="w-full h-full" />
                        </div>
                        <p className="text-xs text-gray-400 break-all bg-black/30 p-2 rounded border border-white/5">{qrUrl}</p>
                        <button onClick={() => copyLink(qrUrl)} className="text-brand-accent text-xs mt-3 hover:underline">Copia Link</button>
                    </div>
                </div>
            )}
        </div>

    );
};

// ... (HistoryItem remains same)
const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; onDelete?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, onDelete, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-brand-secondary/60 transition-all cursor-pointer" onClick={onView}>
        <div className="flex items-center gap-4 w-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative">
                <img src={fixImage(item.imageUrl)} alt="thumb" className="w-full h-full object-cover rounded bg-black" />
                {item.videoUrl && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded">
                        <span className="bg-brand-accent text-brand-primary text-[7px] font-bold px-1 py-0.5 rounded flex items-center gap-1">
                            <i className="fas fa-video text-[6px]"></i> VIDEO
                        </span>
                    </div>
                )}
            </div>
            <div className="flex-grow min-w-0">
                <h4 className="text-white font-bold text-sm truncate">{item.title || "Senza Titolo"}</h4>
                <div className="text-[10px] text-gray-500 mt-1 flex gap-2"><span className="bg-white/10 px-1.5 rounded uppercase">{item.paradigm}</span><span>{new Date(item.timestamp).toLocaleDateString()}</span></div>
            </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:border-t-0 border-t border-white/5">
            <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onView(); }} className="bg-brand-primary hover:bg-white/10 text-white text-[10px] sm:text-xs font-bold py-2 px-3 sm:px-4 rounded border border-white/10">Sonificazione</button>
                {item.videoUrl && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            link.href = item.videoUrl || "";
                            link.download = `synesthetic_${(item.traditionName || "opera").replace(/\s+/g, '_')}.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-[10px] sm:text-xs font-bold py-2 px-3 sm:px-4 rounded border border-purple-500/30 flex items-center gap-1"
                    >
                        <i className="fas fa-video"></i> VIDEO
                    </button>
                )}
                {isPro && onPublishClick && <button onClick={(e) => { e.stopPropagation(); onPublishClick(); }} className="bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-[10px] sm:text-xs font-bold py-2 px-3 sm:px-4 rounded border border-purple-500/30">Pubblica</button>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); }} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded ml-2"><i className="fas fa-trash text-xs"></i></button>
        </div>
    </div>
);

export const UserDashboard: React.FC<{ user: User, onLoadEntry: (entry: DashboardEntry) => void }> = ({ user, onLoadEntry }) => {
    const [history, setHistory] = useState<DashboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [publishingEntry, setPublishingEntry] = useState<DashboardEntry | null>(null);
    const [useWebcamOverlay, setUseWebcamOverlay] = useState(false);
    const [performanceData, setPerformanceData] = useState<{ result: SonificationResult, audioBlob: Blob } | null>(null);

    // MODAL STATES
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getHistory();
            setHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("not found")) {
                setError("Sessione scaduta o non valida. Effettua nuovamente il login.");
            } else {
                setError(msg || "Errore nel caricamento della cronologia");
            }
        }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const deleteItem = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Elimina Opera",
            message: "Sei sicuro di voler eliminare definitivamente questa opera? L'azione è irreversibile.",
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                const oldHistory = [...history];
                setHistory(currentHistory => currentHistory.filter(item => item.id !== id));
                try {
                    await api.deleteHistoryItem(id);
                } catch (e) {
                    setConfirmModal({
                        isOpen: true,
                        title: "Errore",
                        message: "Impossibile eliminare l'opera. Riprova più tardi.",
                        type: 'danger',
                        singleButton: true,
                        onConfirm: () => {
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            setHistory(oldHistory);
                        }
                    });
                }
            }
        });
    };

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }, customMedia: { url: string; type: string; } | null) => {
        if (!publishingEntry || !user) return null;
        return await api.publishFromHistory(publishingEntry.id, metadata, customMedia);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                <div><h2 className="text-3xl font-display font-bold text-white mb-2">Archivio Opere</h2><p className="text-brand-text-secondary">Gestisci le tue creazioni.</p></div>
            </div>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-brand-text-secondary">
                    <i className="fas fa-circle-notch fa-spin text-3xl mb-4"></i>
                    <p>Caricamento opere...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 bg-red-900/10 rounded-xl border border-red-500/20 px-6">
                    <i className="fas fa-exclamation-triangle text-4xl mb-4 text-red-500 opacity-50"></i>
                    <p className="text-red-300 mb-6 max-w-md mx-auto">{error}</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button onClick={loadHistory} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-sm font-bold transition-all border border-white/10">
                            Riprova
                        </button>
                        {(error.toLowerCase().includes("unauthorized") || error.includes("scaduta")) && (
                            <button onClick={api.cleanAuthSession} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-6 py-2 rounded-full text-sm font-bold transition-all border border-red-500/30">
                                Reset Sessione (Logout)
                            </button>
                        )}
                    </div>
                </div>
            ) : history.length === 0 ? (
                <div className="text-center py-20 bg-brand-secondary/20 rounded-xl border border-dashed border-white/10">
                    <i className="fas fa-folder-open text-4xl mb-4 text-brand-text-secondary opacity-30"></i>
                    <p className="text-brand-text-secondary">Non hai ancora salvato nessuna opera.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {history.map(item => (
                        <HistoryItem
                            key={item.id}
                            item={item}
                            onView={() => onLoadEntry(item)}
                            onPublishClick={() => setPublishingEntry(item)}
                            onDelete={() => deleteItem(item.id)}
                            isPro={user?.isPro || user?.isAdmin}
                        />
                    ))}
                </div>
            )}

            {/* NEW MODAL USAGE */}
            {publishingEntry && !useWebcamOverlay && (
                <PublishModal
                    entry={publishingEntry}
                    user={user}
                    onClose={() => {
                        setPublishingEntry(null);
                        loadHistory();
                    }}
                />
            )}

            {useWebcamOverlay && performanceData && (
                <LivePerformanceOverlay
                    result={performanceData.result}
                    audioBlob={performanceData.audioBlob}
                    title={publishingEntry?.title || "OPERA SENZA TITOLO"}
                    onClose={() => {
                        setUseWebcamOverlay(false);
                        setPerformanceData(null);
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};