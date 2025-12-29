import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User, TransformedNoteEvent } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { generateSonificationVideo } from '../services/videoService';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return `https://sonificart.com${url}`;
    return `data:image/jpeg;base64,${url}`;
};

// --- MODALE PUBBLICAZIONE (CON UPLOAD A PEZZI) ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any, customMedia: { url: string, type: string } | null) => Promise<any>; onSuccess?: () => void }> = ({ entry, onClose, onPublish, onSuccess }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
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

    // FIX: Store uploaded result to correct QR Code immediately
    const [uploadedMedia, setUploadedMedia] = useState<{ url: string, type: string } | null>(null);
    const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

    // Modal State for inside PublishModal
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setUploadProgress(0);

        let finalFileToUpload = customFile;

        // Se abbiamo un syncAudioFile, dobbiamo generare il video prima di procedere
        if (syncAudioFile) {
            setIsGeneratingSync(true);
            try {
                // Ricostruiamo un SonificationResult fittizio ma valido per il videoService
                const blocks = entry.blockData?.blocks || [];

                // Helper per decodificare gli eventi compressi
                const decompressEvents = (evs: any[]) => evs.map((e: any) => {
                    const bx = e[4], by = e[5];
                    const matchingBlock = blocks.find(b => b.position.x === bx && b.position.y === by);
                    return {
                        time: e[0],
                        duration: e[1],
                        midiFloat: e[2],
                        velocity: e[3],
                        noteName: e[6] || "N/A",
                        sourceBlock: matchingBlock || { r: 0, g: 0, b: 0, position: { x: bx, y: by } }
                    };
                });

                const mockResult: any = {
                    imageHash: entry.id,
                    standardizedImageUrl: fixImage(entry.imageUrl),
                    blockAnalysisResult: entry.blockData || { gridSize: 32, blocks: [] },
                    culturalSelectionResult: { tradition: { name: entry.traditionName } },
                    scanPattern: { name: "Path Originale" },
                    audioOutput: {
                        events: entry.events ? decompressEvents(entry.events) : [],
                        audioWavBlob: new Blob() // Fallback non usato perché c'è override
                    }
                };

                const videoBlob = await generateSonificationVideo(mockResult, (p: number) => setSyncProgress(p), {
                    title: title,
                    author: "SonificA.R.T. Sync",
                    overrideAudioBlob: syncAudioFile
                });

                // Creiamo un URL locale per il download immediato
                const localUrl = URL.createObjectURL(videoBlob);
                setLocalVideoUrl(localUrl);

                // Trasformiamo il Blob in un File per l'uploader esistente
                finalFileToUpload = new File([videoBlob], "synesthetic_experience.mp4", { type: 'video/mp4' });
            } catch (err) {
                console.error("Sync-Video error:", err);
                throw new Error("Errore durante la creazione dell'esperienza sinestetica. Assicurati che il file audio sia valido.");
            } finally {
                setIsGeneratingSync(false);
            }
        }

        let customMediaResult: { url: string, type: string } | null = null;

        try {
            if (finalFileToUpload) {
                const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per pezzo
                const totalChunks = Math.ceil(finalFileToUpload.size / CHUNK_SIZE);
                const uploadId = `${Date.now()}-${finalFileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, finalFileToUpload.size);
                    const chunk = finalFileToUpload.slice(start, end);

                    const formData = new FormData();
                    formData.append('fileChunk', chunk, finalFileToUpload.name);
                    formData.append('uploadId', uploadId);
                    formData.append('chunkIndex', String(i));
                    formData.append('totalChunks', String(totalChunks));
                    formData.append('originalFilename', finalFileToUpload.name);

                    const response = await api.uploadChunk(formData);

                    if (response.success && response.url) {
                        customMediaResult = { url: response.url, type: response.type };
                    }

                    setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
                }
            }

            if (customMediaResult) {
                setUploadedMedia(customMediaResult);
            }

            const result = await onPublish({
                title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            }, customMediaResult);

            if (result && result.id) {
                setPublishedId(result.id);
            }

            setStep(2);
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            const errorMsg = e instanceof Error ? e.message : "Impossibile completare la pubblicazione. Verifica la connessione e riprova.";
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
    // MODIFICA: Il link pubblico usa l'id reale della vetrina se disponibile, altrimenti fallback
    const idToUse = publishedId || entry.id;
    const publicLink = `https://sonificart.com/?gallery_id=${idToUse}`;

    // Logic for QR Code target (Media > Page)
    const getAbsoluteUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // FIX: Prioritize uploaded media URL, then local audio URL
    const mediaTarget = getAbsoluteUrl(uploadedMedia?.url) || getAbsoluteUrl(entry.audioUrl);

    // Se non abbiamo un file media diretto, mandiamo alla pagina in modalità "museum" (più pulita)
    const museumLink = `https://sonificart.com/museum?id=${idToUse}`;
    const qrTarget = museumLink; // Consigliato per avere il controllo sul branding (logo custom)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTarget)}`;
    const downloadQR = async () => {
        try {
            const res = await fetch(qrUrl);
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QR_${entry.id}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <h3 className="text-2xl font-bold text-white mb-6">Pubblica in Vetrina</h3>
                            <div className="flex flex-col sm:flex-row gap-6">
                                <img src={fixImage(entry.imageUrl)} className="w-full sm:w-1/3 h-48 sm:h-32 object-cover rounded-lg border border-white/10" alt="Preview" />
                                <div className="w-full sm:w-2/3 space-y-4">
                                    <input required type="text" className="w-full bg-black/30 border border-white/10 p-2 rounded text-white" value={title} onChange={e => setTitle(e.target.value)} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-2 bg-black/20 rounded border border-white/5 hover:border-brand-accent/30 transition-colors">
                                            <label className="block text-[8px] font-bold text-gray-500 uppercase mb-1">Standard</label>
                                            <label className="block text-[10px] font-bold text-brand-text-secondary uppercase mb-1 cursor-pointer flex items-center gap-2">
                                                <i className="fas fa-upload text-brand-accent"></i>
                                                <span>Carica Media</span>
                                                <input type="file" accept="video/*,audio/*" className="hidden" onChange={e => { setCustomFile(e.target.files ? e.target.files[0] : null); setSyncAudioFile(null); }} />
                                            </label>
                                            <p className="text-[9px] text-gray-600 truncate">{customFile ? customFile.name : "Video o Audio custom"}</p>
                                        </div>
                                        <div className={`p-2 bg-purple-900/10 rounded border ${syncAudioFile ? 'border-purple-500/50' : 'border-white/5'} hover:border-purple-500/30 transition-colors relative overflow-hidden group`}>
                                            <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100"><i className="fas fa-bolt text-purple-400 text-[10px]"></i></div>
                                            <label className="block text-[8px] font-bold text-purple-400 uppercase mb-1">Potenziato</label>
                                            <label className="block text-[10px] font-bold text-purple-300 uppercase mb-1 cursor-pointer flex items-center gap-2">
                                                <i className="fas fa-magic"></i>
                                                <span>Sync-Audio</span>
                                                <input type="file" accept="audio/*" className="hidden" onChange={e => { setSyncAudioFile(e.target.files ? e.target.files[0] : null); setCustomFile(null); }} />
                                            </label>
                                            <p className="text-[9px] text-purple-400/60 truncate">{syncAudioFile ? syncAudioFile.name : "Genera Video Sinestetico"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <textarea className="w-full bg-black/30 border border-white/10 p-2 rounded text-white h-20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrizione..." />

                            {/* SYNC GENERATION PROGRESS */}
                            {isGeneratingSync && (
                                <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg animate-pulse">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-purple-300 flex items-center gap-2"><i className="fas fa-spinner fa-spin"></i> Generazione Esperienza Sinestetica...</span>
                                        <span className="text-xs font-mono text-purple-400">{syncProgress}%</span>
                                    </div>
                                    <div className="w-full bg-black/40 rounded-full h-1.5 border border-purple-500/10 overflow-hidden">
                                        <div className="bg-gradient-to-r from-purple-600 to-brand-accent h-full transition-all duration-200" style={{ width: `${syncProgress}%` }}></div>
                                    </div>
                                    <p className="text-[9px] text-purple-400/60 mt-2 italic text-center">Stiamo fondendo i tuoi pixel con la nuova traccia sonora...</p>
                                </div>
                            )}

                            {/* PROGRESS BAR */}
                            {isSubmitting && (customFile || syncAudioFile) && (
                                <div className="space-y-1 pt-2">
                                    <div className="flex justify-between text-[10px] font-bold text-brand-accent uppercase tracking-widest">
                                        <span>{isGeneratingSync ? 'Rilevamento...' : 'Upload In Corso'}</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                                        <div className="bg-brand-accent h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button type="button" onClick={onClose} className="text-gray-400 text-sm">Annulla</button>
                                <div className="flex justify-center mt-4">
                                    {isGeneratingSync || (isSubmitting && syncAudioFile) ? (
                                        <button type="button" disabled className="bg-purple-900/50 text-purple-300 font-bold py-3 px-10 rounded-full flex items-center gap-3 border border-purple-500/30">
                                            <i className="fas fa-spinner fa-spin"></i>
                                            <span>ELABORAZIONE SINESTETICA IN CORSO...</span>
                                        </button>
                                    ) : syncAudioFile ? (
                                        <button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-purple-600 to-brand-accent text-white font-bold py-3 px-10 rounded-full hover:scale-105 transition-transform shadow-lg shadow-purple-500/20 flex items-center gap-3">
                                            <i className="fas fa-magic"></i>
                                            <span>GENERA & PUBBLICA ESPERIENZA SINESTETICA</span>
                                        </button>
                                    ) : (
                                        <button type="submit" disabled={isSubmitting} className="bg-brand-accent text-brand-primary font-bold py-3 px-10 rounded-full hover:scale-105 transition-transform disabled:opacity-50">
                                            {isSubmitting ? 'UPLOADING...' : customFile ? "PUBBLICA CON MEDIA CUSTOM" : "CONFERMA PUBBLICAZIONE"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center space-y-6 animate-fade-in">
                            <h3 className="text-2xl font-bold text-white">Pubblicazione Completata!</h3>
                            <div className="flex justify-center my-4">
                                {localVideoUrl ? (
                                    <div className="relative group w-48 aspect-video rounded-lg overflow-hidden border border-purple-500/50 shadow-lg shadow-purple-500/20">
                                        <video src={localVideoUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i className="fas fa-check-circle text-brand-accent text-3xl"></i>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={qrUrl} alt="QR Code" className="w-32 h-32 bg-white p-2 rounded" />
                                )}
                            </div>

                            {localVideoUrl && (
                                <div className="p-4 bg-purple-900/20 rounded-xl border border-purple-500/30 mb-4">
                                    <p className="text-xs text-purple-300 mb-3">La tua opera ora è un video sinestetico completo.</p>
                                    <a
                                        href={localVideoUrl}
                                        download={`${title.replace(/\s+/g, '_')}_synesthetic.mp4`}
                                        className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-sm font-bold transition-all shadow-lg shadow-purple-900/40"
                                    >
                                        <i className="fas fa-download"></i>
                                        SCARICA IL VIDEO MP4
                                    </a>
                                </div>
                            )}

                            <div className="flex justify-center gap-4">
                                {!localVideoUrl && <button onClick={downloadQR} className="px-4 py-2 bg-white/10 rounded text-white text-xs font-bold">Scarica QR</button>}
                                <button onClick={() => {
                                    navigator.clipboard.writeText(qrTarget);
                                    setConfirmModal({
                                        isOpen: true,
                                        title: "Successo",
                                        message: "Link copiato negli appunti!",
                                        type: 'success',
                                        singleButton: true,
                                        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                    });
                                }} className="px-4 py-2 bg-white/10 rounded text-white text-xs font-bold">Copia Link</button>
                                {localVideoUrl && <button onClick={downloadQR} className="px-4 py-2 bg-white/10 rounded text-white text-xs font-bold">Scarica QR</button>}
                            </div>
                            <button onClick={onClose} className="text-gray-500 text-sm mt-4">Chiudi</button>
                        </div>
                    )}
                </div>
            </div>

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

// ... (HistoryItem rimane uguale)
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
                <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Senza Titolo"}</h4>
                <div className="text-[10px] text-gray-500 mt-1 flex gap-2"><span className="bg-white/10 px-1.5 rounded uppercase">{item.paradigm}</span><span>{new Date(item.timestamp).toLocaleDateString()}</span></div>
            </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
            <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onView(); }} className="bg-brand-primary hover:bg-white/10 text-white text-[10px] sm:text-xs font-bold py-2 px-3 sm:px-4 rounded border border-white/10">Sonificazione</button>
                {isPro && onPublishClick && <button onClick={(e) => { e.stopPropagation(); onPublishClick(); }} className="bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-[10px] sm:text-xs font-bold py-2 px-3 sm:px-4 rounded border border-purple-500/30">Galleria</button>}
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

    // MODAL STATES
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // No more redundant api.checkSession() call here.
            // We use the 'user' prop directly.
            const data = await api.getHistory();
            setHistory(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            // Si è verificato un errore nel caricamento.
            // Se l'errore è un 401 (identificato dal testo), mostriamo il messaggio di sessione scaduta.
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
            {publishingEntry && (
                <PublishModal
                    entry={publishingEntry}
                    onClose={() => setPublishingEntry(null)}
                    onPublish={(details, customMedia) => api.publishFromHistory(publishingEntry.id, details, customMedia)}
                    onSuccess={loadHistory}
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