import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
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
// --- PUBLISH DASHBOARD COMPONENT (Refactored) ---
const PublishModal: React.FC<{
    entry: DashboardEntry,
    onClose: () => void,
    user?: User,
    onShowMessage: (title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success') => void,
    onRequestConfirmation: (title: string, message: string, onConfirm: () => void) => void
}> = ({ entry, onClose, user, onShowMessage, onRequestConfirmation }) => {
    const { setHideSiteUI } = useOutletContext<any>() || { setHideSiteUI: () => { } };

    useEffect(() => {
        setHideSiteUI(true);
        return () => setHideSiteUI(false);
    }, [setHideSiteUI]);

    // STATE: Metadata
    const [title, setTitle] = useState(entry.title || "Opera Senza Titolo");
    const [subtitle, setSubtitle] = useState(entry.subtitle || "");
    const [description, setDescription] = useState(entry.description || "");

    // STATE: Audio
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);

    // REFS
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    // STATE: Video
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(entry.videoUrl || null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
            // Silent success or optional toast
            // onShowMessage("Salvataggio", "Dati salvati con successo!", 'success'); 
            entry.title = title;
        } catch (e) {
            onShowMessage("Errore", "Errore salvataggio dati: " + e, 'danger');
        } finally {
            setIsSubmitting(false);
        }
    };

    const processAudioUpload = async (file: File) => {
        setIsUploadingAudio(true);
        try {
            // Delete old video if needed
            if (activeVideoUrl) {
                await api.detachVideoFromHistory(entry.id);
                setActiveVideoUrl(null);
                entry.videoUrl = null;
            }

            // Upload Audio
            const newUrl = await api.uploadHistoryAudio(entry.id, file);

            // Validate new URL
            if (!newUrl) throw new Error("URL audio non valido dal server");

            // Update Entry Ref & UI
            entry.audioUrl = newUrl;
            entry.traditionName = file.name;

            // NO ALERT - Visual feedback is handled by isUploadingAudio spinner in the UI

        } catch (e) {
            console.error("Errore upload audio", e);
            onShowMessage("Errore Upload", "Errore durante l'upload dell'audio: " + e, 'danger');
        } finally {
            setIsUploadingAudio(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ACTION: Change Audio (Immediate Upload)
    const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Auto-delete video logic
        if (activeVideoUrl) {
            onRequestConfirmation(
                "Attenzione",
                "Modificando l'audio, il video generato attuale non sarà più sincronizzato e verrà eliminato. Vuoi procedere?",
                () => processAudioUpload(file)
            );
        } else {
            processAudioUpload(file);
        }
    };

    // ACTION: Ensure Audio
    const ensureAudioUploaded = async (): Promise<boolean> => {
        if (!entry.audioUrl) {
            onShowMessage("Audio Mancante", "Nessun audio presente. Carica un file audio prima di procedere.", 'warning');
            return false;
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
            if (entry.audioUrl) {
                const r = await fetch(getAbsoluteUrl(entry.audioUrl)!);
                if (!r.ok) throw new Error(`File audio non disponibile (Errore ${r.status}). Verifica che il file sia stato caricato correttamente sul server.`);
                audioBlob = await r.blob();
                if (audioBlob.type.includes('text') || audioBlob.type.includes('html')) {
                    throw new Error("Il file audio sembra corrotto o non valido (formato HTML/Text ricevuto).");
                }
            } else {
                throw new Error("Impossibile recuperare il file audio per la generazione video.");
            }

            const videoBlob = await VideoGenService.generateVideo({
                imageUrl: fixImage(entry.imageUrl),
                audioUrl: audioBlob,
                title: title,
                subtitle: subtitle,
                description: description,
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
            onShowMessage("Errore Generazione", "Errore Generazione Video: " + e, 'danger');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ACTION: Open Live
    const handleOpenLive = async () => {
        if (!(await ensureAudioUploaded())) return;

        // Pause generated video if playing
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
        }

        window.open(`https://sonificart.com/live/${entry.id}`, '_blank');
    };

    // ACTION: Webcam Check
    const checkWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            onShowMessage("Webcam", "✅ Webcam Rilevata e Funzionante!", 'success');
            stream.getTracks().forEach(t => t.stop());
        } catch (e) {
            onShowMessage("Errore Webcam", "❌ Webcam Errore: " + e + ". Verifica i permessi del browser.", 'danger');
        }
    };

    // STATE: Visibility
    const [isPublic, setIsPublic] = useState(true);

    const performPublish = async () => {
        // Use native confirm for critical branching decision, or implement a custom flow. 
        // For now native confirm is acceptable as per user request to change the FINAL message.
        // User asked: "quando vado su salva deve apparire la finestra del messaggio con lo stesso coordinato grafico"

        setIsSubmitting(true);
        try {
            // 1. First, SAVE METADATA
            await api.updateMetadata(entry.id, title, subtitle, description);

            // Update local entry ref
            entry.title = title;
            entry.description = description;

            // 2. Then Publish
            await api.publishFromHistory(entry.id, { description, isPublic }, activeVideoUrl ? { url: activeVideoUrl, type: 'video' } : null);

            // CUSTOM MODAL SUCCESS MESSAGE
            onShowMessage(
                isPublic ? "Pubblicazione Completata" : "Salvataggio Completato",
                isPublic ? "La tua opera è stata pubblicata correttamente nella vetrina!" : "La tua opera è stata salvata privatamente nel tuo archivio.",
                'success'
            );
        } catch (e) {
            onShowMessage("Errore", "Impossibile completare l'operazione: " + e, 'danger');
        } finally { setIsSubmitting(false); }
    };

    const handlePublish = async () => {
        onRequestConfirmation(
            isPublic ? "Conferma Pubblicazione" : "Conferma Salvataggio",
            isPublic ? "Vuoi pubblicare questa opera nella vetrina pubblica? Sarà visibile a tutti." : "Vuoi salvare questa opera in modo privato? (Non sarà visibile in galleria)",
            () => performPublish()
        );
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

    // State for QR Modal
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
        navigator.clipboard.writeText(full).then(() => onShowMessage("Link Copiato", "Link copiato negli appunti!", 'success'));
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 animate-fade-in p-4 backdrop-blur-md notranslate" onClick={onClose}>
            <div className="bg-[#1e1e2e] w-full max-w-7xl max-h-[95vh] h-full rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10 relative" onClick={e => e.stopPropagation()}>

                <button onClick={onClose} className="absolute top-3 right-3 z-50 text-white/50 hover:text-white bg-black/40 rounded-full w-8 h-8 flex items-center justify-center"><i className="fas fa-times"></i></button>

                <header className="px-6 md:px-10 py-5 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-xl shrink-0 relative z-40 w-full">
                    <div className="flex items-center gap-5">
                        <div className="w-1.5 h-10 bg-gradient-to-b from-brand-accent to-brand-primary rounded-full shadow-[0_0_20px_rgba(13,148,136,0.4)]"></div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter font-display uppercase leading-none">STUDIO MULTIMEDIALE</h2>
                            <p className="text-[10px] text-brand-accent font-black uppercase tracking-[0.4em] mt-1 opacity-80">Editing & Pubblicazione</p>
                        </div>
                    </div>
                </header>

                {/* Hidden Input */}
                <input type="file" ref={fileInputRef} hidden accept="audio/*" onChange={handleAudioFileSelect} />

                <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 md:p-5 bg-[#0B0C10] custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

                        {/* COL 1: METADATA & PREVIEW (Left, span 3/12 ~ 25%) */}
                        <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0">
                            {/* Preview - Reduced height constraint */}
                            <div className="relative w-full aspect-square max-h-[150px] lg:max-h-[22vh] rounded-xl overflow-hidden border border-white/10 group shadow-lg shrink-0 mx-auto">
                                <img src={fixImage(entry.imageUrl)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Preview" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-2 flex flex-col justify-end">
                                    <h3 className="text-white font-bold text-xs leading-tight uppercase font-display truncate">{title}</h3>
                                </div>
                            </div>

                            {/* Metadata Form */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3 flex-1 flex flex-col gap-3 shadow-lg h-full min-h-0 overflow-y-auto custom-scrollbar">
                                <h4 className="flex items-center gap-2 text-[#2dd4bf] text-[9px] font-bold uppercase tracking-wider border-b border-white/5 pb-2 shrink-0">
                                    <i className="fas fa-pen"></i> Metadata
                                </h4>
                                <div className="shrink-0">
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Titolo</label>
                                    <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white focus:border-brand-accent outline-none transition-colors" />
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Descrizione</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full flex-1 min-h-[50px] bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-white focus:border-brand-accent outline-none resize-none transition-colors custom-scrollbar" />
                                </div>

                                {/* VISIBILITY TOGGLE INTEGRATION */}
                                <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between shrink-0">
                                    <span className={`text-[10px] font-bold ${isPublic ? 'text-green-400' : 'text-gray-400'}`}>{isPublic ? 'PUBBLICA' : 'PRIVATA'}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                                        <div className="w-7 h-3.5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-brand-accent"></div>
                                    </label>
                                </div>

                                <button onClick={handlePublish} disabled={isSubmitting} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg border border-white/10 transition-all flex items-center justify-center gap-2 uppercase text-[9px] tracking-wider shrink-0">
                                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className="fas fa-save"></i> Salva & Pubblica</>}
                                </button>
                            </div>
                        </div>

                        {/* COL 2: MEDIA (Right, span 9/12) */}
                        <div className="lg:col-span-9 flex flex-col gap-3 h-full min-h-0">

                            {/* TOP: AUDIO SOURCE */}
                            <div className="bg-[#15151b] border border-white/5 rounded-xl p-3 relative overflow-hidden shadow-lg shrink-0">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-[9px] font-bold uppercase tracking-wider">
                                        <i className="fas fa-music"></i> Sorgente Audio
                                    </h4>
                                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingAudio} className="text-[8px] bg-[#2dd4bf]/10 text-[#2dd4bf] px-2 py-0.5 rounded-full font-bold hover:bg-[#2dd4bf]/20 transition-colors uppercase border border-[#2dd4bf]/20 cursor-pointer disabled:opacity-50">
                                        {isUploadingAudio ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-upload mr-1"></i>} Cambia Audio
                                    </button>
                                </div>

                                <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex items-center gap-3 mb-1">
                                    <div className="w-7 h-7 rounded-lg bg-[#2dd4bf]/10 flex items-center justify-center text-[#2dd4bf] text-[10px]">
                                        {isUploadingAudio ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-music"></i>}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-white font-bold text-[11px] truncate">
                                            {isUploadingAudio ? (
                                                <span className="text-[#2dd4bf] italic animate-pulse">Caricamento in corso...</span>
                                            ) : (
                                                entry.traditionName || "Audio Originale.wav"
                                            )}
                                        </div>
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{entry.paradigm || "Scientifico"}</div>
                                    </div>
                                    <audio key={(entry.audioUrl || "audio") + Date.now()} controls src={getAbsoluteUrl(entry.audioUrl) || undefined} className="h-5 max-w-[120px]" />
                                </div>

                                <div className="scale-90 origin-left">
                                    <ActionToolbar url={entry.audioUrl || ""} type="audio" filename={`audio_${entry.id}.wav`} title={title} />
                                </div>
                            </div>

                            {/* BOTTOM: GRID 2 - Reduced gaps and flexible height */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">

                                {/* VIDEO GENERATIVO */}
                                <div className="bg-[#15151b] border border-white/5 rounded-xl p-3 flex flex-col shadow-lg h-full min-h-0">
                                    <h4 className="flex items-center gap-2 text-[#2dd4bf] text-[9px] font-bold uppercase tracking-wider mb-2 shrink-0">
                                        <i className="fas fa-video"></i> Video Generativo
                                    </h4>

                                    <div className="flex-1 bg-black rounded-lg border border-white/10 overflow-hidden relative group min-h-[150px] flex items-center justify-center">
                                        {activeVideoUrl ? (
                                            <video
                                                ref={videoRef}
                                                src={getAbsoluteUrl(activeVideoUrl)!}
                                                className="w-full h-full object-contain"
                                                controls
                                                onPlay={() => setIsVideoPlaying(true)}
                                                onPause={() => setIsVideoPlaying(false)}
                                                onEnded={() => setIsVideoPlaying(false)}
                                            />
                                        ) : (
                                            <div className="text-center w-full px-4">
                                                {isSubmitting ? (
                                                    <div className="w-full max-w-xs mx-auto">
                                                        <div className="flex justify-between text-[10px] text-[#2dd4bf] mb-1 font-bold uppercase tracking-wider">
                                                            <span>Generazione...</span>
                                                            <span>{uploadProgress}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                                                            <div
                                                                className="h-full bg-[#2dd4bf] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(45,212,191,0.5)]"
                                                                style={{ width: `${uploadProgress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-film text-2xl text-gray-700 mb-2 block"></i>
                                                        <button onClick={handleGenerateVideo} className="px-4 py-1.5 bg-[#2dd4bf] text-black font-bold rounded-full shadow-lg hover:scale-105 transition-transform text-[10px] uppercase tracking-wide">
                                                            Genera Video
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {activeVideoUrl && (
                                        <div className="mt-2 shrink-0 scale-90 origin-left">
                                            <ActionToolbar url={activeVideoUrl} type="video" filename={`video_${entry.id}.mp4`} title={title} />
                                        </div>
                                    )}
                                </div>

                                {/* LIVE PERFORMANCE */}
                                <div className="bg-[#15151b] border border-white/5 rounded-xl p-3 flex flex-col shadow-lg relative overflow-hidden h-full min-h-0">
                                    <div className="absolute top-0 right-0 p-2 opacity-20"><i className="fas fa-bolt text-3xl text-purple-500"></i></div>
                                    <h4 className="flex items-center gap-2 text-purple-400 text-[9px] font-bold uppercase tracking-wider mb-2 shrink-0">
                                        <i className="fas fa-bolt"></i> Live Performance
                                    </h4>
                                    <p className="text-gray-300 text-[10px] mb-2 leading-relaxed shrink-0">
                                        Espressione interattiva reale.
                                    </p>

                                    <div className="bg-black/30 border border-white/5 p-2 rounded-lg mb-3 shrink-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] text-gray-500 font-bold">STATUS</span>
                                            <span className="text-[9px] font-mono text-green-400 font-bold uppercase">Ready</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500"></div><span className="text-[8px] text-gray-500 uppercase font-bold">Audio</span></div>
                                            <div className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500"></div><span className="text-[8px] text-gray-500 uppercase font-bold">Face</span></div>
                                        </div>
                                    </div>

                                    <div className="mt-auto shrink-0">
                                        <button onClick={handleOpenLive} className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg transition-all text-[9px] uppercase tracking-widest">
                                            Open Console
                                        </button>
                                        <div className="mt-2 flex justify-center scale-90">
                                            <ActionToolbar url={`https://sonificart.com/live/${entry.id}`} type="live" title={title} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>
            </div>
            {/* QR MODAL */}
            {
                qrUrl && (
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
                )
            }
        </div >
    );
};


// ... (HistoryItem remains same)
const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; onDelete?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, onDelete, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-brand-secondary/60 transition-all cursor-pointer" onClick={onView}>
        <div className="flex items-center gap-4 w-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative">
                <img
                    src={fixImage(item.imageUrl)}
                    alt="thumb"
                    className="w-full h-full object-cover rounded bg-black"
                    loading="lazy"
                    decoding="async"
                />
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
                {onPublishClick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPublishClick(); }}
                        className="bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-brand-primary text-[10px] sm:text-xs font-black py-2 px-3 sm:px-4 rounded border border-brand-accent/30 uppercase tracking-tighter transition-all flex items-center gap-2"
                    >
                        <i className="fas fa-globe"></i>
                        Pubblicazione
                    </button>
                )}
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
        <div className="max-w-5xl mx-auto pb-20 notranslate">
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
                    onShowMessage={(title, message, type) => {
                        setConfirmModal({
                            isOpen: true,
                            title,
                            message,
                            type,
                            singleButton: true,
                            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                        });
                    }}
                    onRequestConfirmation={(title, message, onConfirm) => {
                        setConfirmModal({
                            isOpen: true,
                            title,
                            message,
                            type: 'warning',
                            singleButton: false,
                            onConfirm: () => {
                                onConfirm();
                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            }
                        });
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