import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User, TransformedNoteEvent, SonificationResult } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { generateSonificationVideo } from '../services/videoService';
import { VideoGenService } from '../services/VideoGenService';
import { LivePerformanceOverlay } from './LivePerformanceOverlay';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return `https://sonificart.com${url}`;
    return `data:image/jpeg;base64,${url}`;
};

// --- MODALE PUBBLICAZIONE (CON UPLOAD A PEZZI) ---
const PublishModal: React.FC<{ user?: User; entry: DashboardEntry; onClose: () => void; onPublish: (data: any, customMedia: { url: string, type: string } | null) => Promise<any>; onSuccess?: () => void; onLaunchPerformance?: (data: SonificationResult, audioBlob: Blob) => void }> = ({ user, entry, onClose, onPublish, onSuccess, onLaunchPerformance }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState(entry.title || `Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [customFile, setCustomFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [publishedId, setPublishedId] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    // --- NUOVA FEATURE: SYNC-AUDIO ---
    const [syncAudioFile, setSyncAudioFile] = useState<File | null>(null);
    const [isGeneratingSync, setIsGeneratingSync] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [useWebcam, setUseWebcam] = useState(false);
    const [allTraditions, setAllTraditions] = useState<any[]>([]);

    // FIX: Store uploaded result to correct QR Code immediately
    const [uploadedMedia, setUploadedMedia] = useState<{ url: string, type: string } | null>(null);
    const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
    // NEW: Persistent Video State for Option 1
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(entry.videoUrl || null);

    useEffect(() => {
        fetch('/data/traditions.json').then(res => res.json()).then(data => setAllTraditions(data)).catch(e => console.error(e));
        // Init active video
        setActiveVideoUrl(entry.videoUrl || null);
    }, [entry.videoUrl]); // React to prop change

    // Modal State for inside PublishModal
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    // NEW: Track which type of success to show ('static' for Option 1, 'live' for Option 2)
    const [successType, setSuccessType] = useState<'static' | 'live' | null>(null);

    // HELPER: Delete Video
    const handleDeleteVideo = async () => {
        setConfirmModal({
            isOpen: true,
            title: "Elimina Video",
            message: "Sei sicuro di voler eliminare il video generato? Questa azione non può essere annullata.",
            type: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await api.detachVideoFromHistory(entry.id);
                    setActiveVideoUrl(null); // Clear local state immediately
                    setUploadedMedia(null);
                    setCustomFile(null); // Reset upload state
                } catch (e) {
                    console.error("Delete failed", e);
                    alert("Errore durante l'eliminazione del video.");
                }
            }
        });
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setUploadProgress(0);

        let finalFileToUpload = customFile;

        // Determine Success Type based on input
        if (syncAudioFile) {
            setSuccessType('live');
        } else {
            setSuccessType('static');
        }

        // SE ABBIAMO UN SYNC AUDIO FILE (Opzione 2 - LIVE)
        if (syncAudioFile) {
            // LIVE MODE DIRECT FLOW
            try {
                const audioUrl = await api.attachAudioToHistory(
                    entry.id,
                    syncAudioFile,
                    `synesthetic_audio_${Date.now()}.mp3`,
                    (p) => setUploadProgress(p)
                );
                console.log("Audio associato all'esperienza live:", audioUrl);
            } catch (saveErr) {
                console.warn("Impossibile salvare l'audio nello storico:", saveErr);
                alert("Errore caricamento audio. Riprova.");
                setIsSubmitting(false);
                return;
            }

            setSuccessType('live');
            setStep(2); // Go to success only for Option 2
            setIsSubmitting(false);
            if (onSuccess) onSuccess();
            return;
        }

        let customMediaResult: { url: string, type: string } | null = null;
        let generatedVideoUrl: string | null = null;

        try {
            // OPTION 1: CUSTOM FILE (Audio) -> Client-Side Generation (Canvas + MediaRecorder)
            if (customFile) {
                setActiveVideoUrl(null); // Clear any existing video state

                // 1. Upload Audio First (Persist audio)
                const audioUrl = await api.attachAudioToHistory(
                    entry.id,
                    customFile,
                    `custom_audio_${Date.now()}.mp3`,
                    (p) => setUploadProgress(Math.min(p * 0.30, 30)) // 30% for audio upload
                );

                // 2. Client-Side Generation
                setUploadProgress(35);

                // Use VideoGenService locally
                // Note: fixImage ensures we have a valid URL (dataURI or absolute http)
                // If it's a relative path on server, fixImage adds domain, but we need to ensure CORS.
                // VideoGenService handles crossOrigin="anonymous".

                const generatedVideoBlob = await VideoGenService.generateVideo({
                    imageUrl: fixImage(entry.imageUrl),
                    audioBlob: customFile,
                    // duration automatically detected from audio
                    title: title || "SONIFICART VIDEO",
                    author: user?.name,
                    onProgress: (p: number) => setUploadProgress(35 + (p * 0.35)) // 35% to 70% range
                });

                // 3. Upload Generated Video
                setUploadProgress(75);

                const finalVideoUrl = await api.attachVideoToHistory(
                    entry.id,
                    generatedVideoBlob,
                    `gen_cl_${entry.id}_${Date.now()}.mp4`
                );

                generatedVideoUrl = finalVideoUrl;
                customMediaResult = { url: finalVideoUrl, type: 'video/mp4' };

                // VISUAL UPDATE IN PLACE
                setActiveVideoUrl(finalVideoUrl);
                setLocalVideoUrl(null);
                setUploadedMedia(customMediaResult);

                setUploadProgress(100);
            }

            // Normal publish flow (metadata update)
            const result = await onPublish({
                title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            }, customMediaResult);

            if (result && result.id) {
                setPublishedId(result.id);
            }

            // NOTE: For Option 1, we stay in Step 1 now (as requested), to show the "managed" card state.
            // Option 2 goes to Step 2 (handled above).

            if (onSuccess) onSuccess(); // Trigger reload in bg

        } catch (e) {
            console.error(e);
            // ... Error handling
            const errorMsg = e instanceof Error ? e.message : "Impossibile completare l'operazione.";
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: errorMsg,
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ... resto del componente
    const idToUse = publishedId || entry.id;
    const publicLink = `https://sonificart.com/?gallery_id=${idToUse}`;

    // Logic for QR Code target (Media > Page)
    const getAbsoluteUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // QR & Media Targets
    const videoTarget = getAbsoluteUrl(activeVideoUrl);
    const audioTarget = getAbsoluteUrl(entry.audioUrl);

    // QR Generation
    const getVideoQr = () => videoTarget ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(videoTarget)}` : null;
    const getAudioQr = () => audioTarget ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(audioTarget)}` : null;

    const downloadQR = async (url: string, name: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4">
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    {step === 1 ? (
                        <>
                            {isGeneratingSync ? (
                                <div className="flex flex-col items-center justify-center py-8 px-4 animate-fade-in text-center space-y-8">
                                    {/* ... SYNC ANIMATION REMAINS SAME ... */}
                                    <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.25)] border border-purple-500/50 group">
                                        <img src={fixImage(entry.imageUrl)} className="w-full h-full object-cover filter grayscale-[0.3]" alt="Analysis Target" />
                                        <div className="absolute inset-x-0 top-0 bg-purple-600/20 backdrop-brightness-110 backdrop-contrast-125 transition-all duration-300 ease-linear border-b-2 border-brand-accent shadow-[0_0_20px_#2dd4bf] z-10" style={{ height: `${syncProgress}%` }}><div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div></div>
                                        <div className="absolute inset-x-0 h-1 bg-white shadow-[0_0_15px_white] z-20 transition-all duration-300 ease-linear opacity-80" style={{ top: `${syncProgress}%` }}></div>
                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
                                    </div>
                                    <div className="space-y-2 max-w-md">
                                        <h3 className="text-2xl font-bold text-white font-display">
                                            {syncProgress < 30 ? "Analisi Cromatica..." : syncProgress < 70 ? "Sincronizzazione Audio..." : "Rendering Sinestetico..."}
                                        </h3>
                                        <p className="text-purple-300 text-sm animate-pulse">L'IA sta scansionando la tua opera per generare l'esperienza visiva.</p>
                                    </div>
                                    <div className="w-full max-w-sm space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-brand-accent"><span>Avanzamento</span><span>{Math.round(syncProgress)}%</span></div>
                                        <div className="w-full bg-black/40 rounded-full h-1 border border-white/5 overflow-hidden"><div className="h-full bg-brand-accent shadow-[0_0_10px_#2dd4bf] transition-all duration-300" style={{ width: `${syncProgress}%` }}></div></div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <h3 className="text-2xl font-bold text-white mb-6">Pubblica in Vetrina</h3>
                                    <div className="flex flex-col sm:flex-row gap-6">
                                        <div className="w-full sm:w-1/3 space-y-2">
                                            <img src={fixImage(entry.imageUrl)} className="w-full h-48 sm:h-32 object-cover rounded-lg border border-white/10" alt="Preview" />
                                        </div>

                                        <div className="w-full sm:w-2/3 space-y-4">
                                            <input required type="text" className="w-full bg-black/30 border border-white/10 p-2 rounded text-white font-bold" value={title} onChange={e => setTitle(e.target.value)} />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                                <div className="flex flex-col gap-4">
                                                    {/* OPTION 1: VIDEO A.R.T. MANAGEMENT CARD */}
                                                    <div className={`p-3 bg-black/20 rounded-lg border ${activeVideoUrl ? 'border-brand-accent' : 'border-white/5'} hover:border-brand-accent/50 transition-colors relative flex flex-col justify-between overflow-hidden`}>

                                                        {/* HEADER */}
                                                        <div className="flex justify-between items-start mb-2">
                                                            <label className="block text-[9px] font-bold text-gray-400 uppercase">Opzione 1: Video A.R.T.</label>
                                                            {/* Delete Button (Only present if video exists) */}
                                                            {activeVideoUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteVideo(); }}
                                                                    className="w-5 h-5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors shadow-lg"
                                                                    title="Elimina Video"
                                                                >
                                                                    <i className="fas fa-trash text-[9px]"></i>
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* VIDEO PLAYER / GENERATION UI */}
                                                        {activeVideoUrl ? (
                                                            <div className="space-y-3 animate-fade-in">
                                                                {/* Interactive Player */}
                                                                <div className="relative w-full aspect-video bg-black rounded overflow-hidden border border-brand-accent/30 shadow-[0_0_15px_rgba(45,212,191,0.1)] group">
                                                                    <video
                                                                        src={getAbsoluteUrl(activeVideoUrl) || ""}
                                                                        controls
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                </div>

                                                                {/* QR & SOCIALS ROW */}
                                                                <div className="flex gap-2 bg-white/5 p-2 rounded border border-white/10">
                                                                    {getVideoQr() && (
                                                                        <div className="w-12 h-12 bg-white p-0.5 rounded shrink-0 cursor-pointer hover:scale-110 transition-transform" onClick={() => downloadQR(getVideoQr()!, `QR_Video_${entry.id}.png`)} title="Scarica QR Video">
                                                                            <img src={getVideoQr()!} className="w-full h-full" alt="QR" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col justify-between flex-grow">
                                                                        <div className="flex gap-1 justify-end">
                                                                            {[
                                                                                { i: 'fab fa-whatsapp', c: 'bg-green-600', l: `https://wa.me/?text=${encodeURIComponent("Guarda il mio video su SonificA.R.T.! " + videoTarget)}` },
                                                                                { i: 'fab fa-facebook-f', c: 'bg-blue-600', l: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoTarget || "")}` },
                                                                                { i: 'fab fa-twitter', c: 'bg-sky-500', l: `https://twitter.com/intent/tweet?text=${encodeURIComponent("Video Generato con SonificA.R.T.! ")}&url=${encodeURIComponent(videoTarget || "")}` }
                                                                            ].map((s, idx) => (
                                                                                <a key={idx} href={s.l} target="_blank" rel="noopener noreferrer" className={`w-5 h-5 rounded-full ${s.c} text-white flex items-center justify-center hover:scale-110 transition-transform`}>
                                                                                    <i className={`${s.i} text-[9px]`}></i>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                        <a href={getAbsoluteUrl(activeVideoUrl) || "#"} download className="text-[8px] text-right text-brand-accent hover:text-white uppercase font-bold tracking-wider mt-1">Scarica MP4</a>
                                                                    </div>
                                                                </div>

                                                                {/* AUDIO QR (EXTRA) */}
                                                                {entry.audioUrl && (
                                                                    <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded border border-white/5">
                                                                        <i className="fas fa-qrcode text-gray-500 text-[10px]"></i>
                                                                        <span className="text-[8px] text-gray-400 uppercase font-bold flex-grow">QR Solo Audio</span>
                                                                        <button type="button" onClick={() => getAudioQr() && downloadQR(getAudioQr()!, `QR_Audio_${entry.id}.png`)} className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[8px] text-white">Scarica</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* NO VIDEO -> GENERATION STATE */
                                                            <div className="flex flex-col gap-3 py-2 animate-fade-in">
                                                                <div
                                                                    className={`w-full aspect-video rounded border-2 border-dashed ${customFile ? 'border-brand-accent bg-brand-accent/5' : 'border-white/10 bg-white/5'} flex flex-col items-center justify-center cursor-pointer hover:border-white/30 transition-all group`}
                                                                    onClick={() => document.getElementById('file-upload-input')?.click()}
                                                                >
                                                                    {customFile ? (
                                                                        <>
                                                                            <i className="fas fa-file-audio text-2xl text-brand-accent mb-2 group-hover:scale-110 transition-transform"></i>
                                                                            <span className="text-[9px] text-brand-accent font-bold uppercase">{customFile.name.substring(0, 15)}...</span>
                                                                            <span className="text-[8px] text-gray-400 mt-1">Clicca per cambiare</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                                                <i className="fas fa-magic text-brand-accent"></i>
                                                                            </div>
                                                                            <span className="text-[10px] text-gray-300 font-bold uppercase">Genera Video</span>
                                                                            <span className="text-[8px] text-gray-500 text-center px-4 mt-1">Carica un audio per creare il video</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <input id="file-upload-input" type="file" accept="audio/*" className="hidden" onChange={e => { setCustomFile(e.target.files ? e.target.files[0] : null); setSyncAudioFile(null); }} />

                                                                {/* Generation Button (Only if file selected) */}
                                                                {customFile && (
                                                                    <button
                                                                        type="submit"
                                                                        disabled={isSubmitting}
                                                                        onClick={(e) => { e.stopPropagation(); /* Submit triggers generation */ }}
                                                                        className="w-full py-2 bg-brand-accent text-brand-primary font-bold rounded text-[10px] uppercase tracking-wide hover:bg-brand-accent-light shadow-[0_0_15px_rgba(45,212,191,0.2)] animate-pulse-slow"
                                                                    >
                                                                        {isSubmitting ? 'Generazione...' : 'Genera Video Ora'} <i className="fas fa-wand-magic-sparkles ml-1"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>      {/* OPTION 2: SYNESTHETIC GENERATION */}
                                                <div className="flex flex-col gap-4">
                                                    {/* OPTION 2: SYNESTHETIC GENERATION */}
                                                    <div className={`p-3 bg-[#1a0b2e] rounded-lg border ${syncAudioFile ? 'border-purple-500' : 'border-purple-500/20'} hover:border-purple-500/50 transition-colors relative overflow-hidden group cursor-pointer flex flex-col justify-between`} onClick={() => document.getElementById('sync-audio-input')?.click()}>
                                                        <div>
                                                            <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100"><i className="fas fa-bolt text-purple-400 text-[10px]"></i></div>
                                                            <label className="block text-[9px] font-bold text-purple-300 uppercase mb-2">Opzione 2: Generazione AI</label>

                                                            {/* PERFORMANCE MODE ALWAYS ON FOR OPTION 2 */}
                                                            <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/40 px-2 py-1 rounded backdrop-blur-sm z-10" onClick={e => e.stopPropagation()}>
                                                                <span className="text-[8px] font-bold text-pink-400 uppercase tracking-wider">PERFORMANCE ON</span>
                                                                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse shadow-[0_0_5px_#ec4899]"></div>
                                                            </div>

                                                            {/* EXISTING AUDIO INFO */}
                                                            {entry.audioUrl && !syncAudioFile && (
                                                                <div className="flex flex-col gap-2 mb-2">
                                                                    <div
                                                                        className="p-1.5 bg-purple-500/10 border border-purple-500/30 rounded flex items-center justify-between gap-2"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <i className="fas fa-music text-purple-400 text-xs"></i>
                                                                            <span className="text-[9px] text-purple-300">Audio Live presente</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-3 mt-2 mb-2">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${syncAudioFile ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-400'}`}>
                                                                    <i className={`fas ${useWebcam ? 'fa-eye' : 'fa-magic'} text-xs`}></i>
                                                                </div>
                                                                <div>
                                                                    <span className={`block text-xs font-bold ${syncAudioFile ? 'text-purple-300' : 'text-gray-300'}`}>
                                                                        {syncAudioFile ? "Nuovo Audio Caricato" : (entry.audioUrl ? "Rigenera Esperienza" : "Genera Video da Audio")}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400 block truncate max-w-[120px]">
                                                                        {syncAudioFile ? syncAudioFile.name : (entry.audioUrl ? "Carica per sostituire" : "Carica traccia MP3/WAV")}
                                                                    </span>
                                                                </div>
                                                                <input id="sync-audio-input" type="file" accept="audio/*" className="hidden" onChange={e => { setSyncAudioFile(e.target.files ? e.target.files[0] : null); setCustomFile(null); }} />
                                                            </div>
                                                        </div>

                                                        {/* PROMINENT BUTTON FOR OPTION 2 */}
                                                        <button
                                                            type="button"
                                                            disabled={isSubmitting}
                                                            onClick={(e) => { e.stopPropagation(); if (syncAudioFile) handleSubmit(e); else document.getElementById('sync-audio-input')?.click(); }}
                                                            className={`w-full mt-2 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wide transition-all shadow-lg flex items-center justify-center gap-1
                                                            ${syncAudioFile
                                                                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 text-white shadow-purple-900/30'
                                                                    : 'bg-purple-900/20 text-purple-300/50 hover:bg-purple-900/40'}`}
                                                        >
                                                            {isSubmitting ? '...' : (syncAudioFile ? "GENERA & PUBBLICA" : "SELEZIONA FILE")}
                                                            {!isSubmitting && syncAudioFile && <i className="fas fa-wand-magic-sparkles"></i>}
                                                        </button>
                                                    </div>

                                                    {/* LINK BUTTON FOR OPTION 2 (OUTSIDE BOX) */}
                                                    {entry.audioUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); window.open(`https://sonificart.com/live/${entry.id}?play=true`, '_blank'); }}
                                                            className="w-full py-2 bg-gradient-to-r from-purple-900/40 to-black text-purple-400 text-[10px] uppercase font-bold rounded border border-purple-500/30 hover:bg-purple-900/60 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg"
                                                        >
                                                            <i className="fas fa-play-circle text-sm"></i>
                                                            APRI ESPERIENZA LIVE
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <textarea className="w-full bg-black/30 border border-white/10 p-3 rounded text-white text-sm h-24 focus:border-brand-accent outline-none transition-colors" value={description} onChange={e => setDescription(e.target.value)} placeholder="Aggiungi una descrizione per la vetrina..." />

                                    {/* STATUS BAR FOR UPLOAD ONLY */}
                                    {isSubmitting && !isGeneratingSync && (customFile || syncAudioFile) && (
                                        <div className="space-y-1 pt-2">
                                            <div className="flex justify-between text-[10px] font-bold text-brand-accent uppercase tracking-widest">
                                                <span>{customFile ? "Generazione Video..." : "Upload..."}</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                                                <div className="bg-brand-accent h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 flex justify-end">
                                        <button type="button" onClick={onClose} disabled={isSubmitting || isGeneratingSync} className="text-gray-500 text-xs hover:text-white transition-colors py-2">Annulla e torna indietro</button>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : (
                        <div className="text-center space-y-6 animate-fade-in">
                            {/* SUCCESS STATE - ONLY FOR LIVE OPTION HERE AS OPTION 1 IS MANAGED IN STEP 1 */}
                            <h3 className="text-2xl font-bold text-white">Pubblicazione Completata!</h3>
                            {/* ... LIVE EXPERIENCE SUCCESS (Option 2) remains ... */}
                            <div className="space-y-6">
                                <div className="p-6 bg-purple-900/20 rounded-xl border border-purple-500/30 animate-scale-in">
                                    <div className="flex items-center justify-center mb-4">
                                        <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center animate-pulse">
                                            <i className="fas fa-wand-magic-sparkles text-2xl text-purple-400"></i>
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Esperienza Sinestetica Pronta</h4>
                                    <p className="text-sm text-purple-300 mb-6">La tua opera è ora vivente. Usa il link qui sotto per avviare la performance 3D in tempo reale.</p>

                                    <div className="p-4 bg-black/40 rounded-lg border border-purple-500/20 mb-4">
                                        <p className="text-[10px] text-purple-400 mb-2 uppercase tracking-widest font-bold">Link Performance Live</p>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                value={`https://sonificart.com/live/${entry.id}?play=true`}
                                                className="flex-grow bg-black/50 text-white text-sm p-3 rounded border border-purple-500/30 text-center font-mono focus:border-purple-500 outline-none"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`https://sonificart.com/live/${entry.id}?play=true`);
                                                    alert("Link Copiato!");
                                                }}
                                                className="px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded transition-colors"
                                            >
                                                COPIA
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => window.open(`https://sonificart.com/live/${entry.id}?play=true`, '_blank')}
                                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full font-bold shadow-lg shadow-purple-900/50 flex items-center gap-2"
                                        >
                                            <i className="fas fa-play"></i> PROVA ORA
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-gray-500 text-sm mt-4 hover:text-white transition-colors">Chiudi</button>
                        </div>
                    )
                    }
                </div >
            </div >

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
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
            {publishingEntry && !useWebcamOverlay && (
                <PublishModal
                    user={user}
                    entry={publishingEntry}
                    onClose={() => setPublishingEntry(null)}
                    onPublish={(details, customMedia) => api.publishFromHistory(publishingEntry.id, details, customMedia)}
                    onSuccess={loadHistory}
                    onLaunchPerformance={(data, audio) => {
                        setPerformanceData({ result: data, audioBlob: audio });
                        setUseWebcamOverlay(true);
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