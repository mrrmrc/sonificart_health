import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return `https://sonificart.com${url}`;
    return `data:image/jpeg;base64,${url}`;
};

// --- MODALE PUBBLICAZIONE (CON UPLOAD A PEZZI) ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any, customMedia: { url: string, type: string } | null) => Promise<void> }> = ({ entry, onClose, onPublish }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [customFile, setCustomFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setUploadProgress(0);

        let customMediaResult: { url: string, type: string } | null = null;

        try {
            if (customFile) {
                const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per pezzo
                const totalChunks = Math.ceil(customFile.size / CHUNK_SIZE);
                const uploadId = `${Date.now()}-${customFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, customFile.size);
                    const chunk = customFile.slice(start, end);

                    const formData = new FormData();
                    formData.append('fileChunk', chunk, customFile.name);
                    formData.append('uploadId', uploadId);
                    formData.append('chunkIndex', String(i));
                    formData.append('totalChunks', String(totalChunks));
                    formData.append('originalFilename', customFile.name);

                    const response = await api.uploadChunk(formData);

                    if (response.success && response.url) {
                        customMediaResult = { url: response.url, type: response.type };
                    }

                    setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
                }
            }

            await onPublish({
                title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            }, customMediaResult);

            setStep(2);
        } catch (e) {
            console.error(e);
            alert("Errore durante la pubblicazione.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ... resto del componente
    const publicLink = `https://sonificart.com/gallery?id=${entry.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicLink)}`;
    const downloadQR = async () => { /* ... */ };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <h3 className="text-2xl font-bold text-white mb-6">Pubblica in Vetrina</h3>
                            <div className="flex gap-6">
                                <img src={fixImage(entry.imageUrl)} className="w-1/3 h-32 object-cover rounded-lg border border-white/10" alt="Preview" />
                                <div className="w-2/3 space-y-4">
                                    <input required type="text" className="w-full bg-black/30 border border-white/10 p-2 rounded text-white" value={title} onChange={e => setTitle(e.target.value)} />
                                    <div className="p-2 bg-black/20 rounded border border-white/5">
                                        <label className="block text-xs font-bold text-brand-accent uppercase mb-1 cursor-pointer">Carica Video/Audio (Opzionale)<input type="file" accept="video/*,audio/*" className="hidden" onChange={e => setCustomFile(e.target.files ? e.target.files[0] : null)} /></label>
                                        <p className="text-[10px] text-gray-500 truncate">{customFile ? customFile.name : "Sostituisce file originale"}</p>
                                    </div>
                                </div>
                            </div>
                            <textarea className="w-full bg-black/30 border border-white/10 p-2 rounded text-white h-20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrizione..." />

                            {/* PROGRESS BAR */}
                            {isSubmitting && customFile && (
                                <div className="space-y-1 pt-2">
                                    <div className="flex justify-between text-xs text-brand-accent-light font-mono">
                                        <span>Caricamento file...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-black/30 rounded-full h-2.5 border border-brand-secondary/50">
                                        <div className="bg-brand-accent h-2 rounded-full transition-all duration-300 ease-linear" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button type="button" onClick={onClose} className="text-gray-400 text-sm">Annulla</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-accent text-brand-primary font-bold py-2 px-8 rounded-full disabled:opacity-50">
                                    {isSubmitting ? `In corso...` : "CONFERMA"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center space-y-6 animate-fade-in">
                            <h3 className="text-2xl font-bold text-white">Pubblicazione Completata!</h3>
                            <div className="flex justify-center my-4"><img src={qrUrl} alt="QR Code" className="w-32 h-32 bg-white p-2 rounded" /></div>
                            <div className="flex justify-center gap-4">
                                <button onClick={downloadQR} className="px-4 py-2 bg-white/10 rounded text-white text-xs font-bold">Scarica QR</button>
                                <button onClick={() => navigator.clipboard.writeText(publicLink)} className="px-4 py-2 bg-white/10 rounded text-white text-xs font-bold">Copia Link</button>
                            </div>
                            <button onClick={onClose} className="text-gray-500 text-sm mt-4">Chiudi</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ... (HistoryItem rimane uguale)
const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; onDelete?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, onDelete, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex items-center gap-4 hover:bg-brand-secondary/60 transition-all cursor-pointer" onClick={onView}>
        <div className="w-20 h-20 flex-shrink-0"><img src={fixImage(item.imageUrl)} alt="thumb" className="w-full h-full object-cover rounded bg-black" /></div>
        <div className="flex-grow min-w-0">
            <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Senza Titolo"}</h4>
            <div className="text-[10px] text-gray-500 mt-1 flex gap-2"><span className="bg-white/10 px-1.5 rounded uppercase">{item.paradigm}</span><span>{new Date(item.timestamp).toLocaleDateString()}</span></div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={(e) => { e.stopPropagation(); onView(); }} className="bg-brand-primary hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded border border-white/10">Sonificazione</button>
            {isPro && onPublishClick && <button onClick={(e) => { e.stopPropagation(); onPublishClick(); }} className="bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-4 rounded border border-purple-500/30">Galleria</button>}
            <button onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); }} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded ml-2"><i className="fas fa-trash"></i></button>
        </div>
    </div>
);

export const UserDashboard: React.FC<{ onLoadEntry: (entry: DashboardEntry) => void }> = ({ onLoadEntry }) => {
    const [history, setHistory] = useState<DashboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [publishingEntry, setPublishingEntry] = useState<DashboardEntry | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const user = await api.checkSession();
            setCurrentUser(user);
            const data = await api.getHistory();
            setHistory(Array.isArray(data) ? data : []);
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const deleteItem = async (id: string) => {
        if (confirm("Sei sicuro di voler eliminare definitivamente questa opera?")) {
            setHistory(currentHistory => currentHistory.filter(item => item.id !== id));
            try {
                await api.deleteHistoryItem(id);
            } catch (e) {
                alert("Errore nella cancellazione. Ricarica la pagina.");
                loadHistory();
            }
        }
    };

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }, customMedia: { url: string; type: string; } | null) => {
        if (!publishingEntry || !currentUser) return;
        await api.publishFromHistory(publishingEntry, metadata, currentUser, customMedia);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                <div><h2 className="text-3xl font-display font-bold text-white mb-2">Archivio Opere</h2><p className="text-brand-text-secondary">Gestisci le tue creazioni.</p></div>
            </div>
            {isLoading ? <div className="text-center py-20">Caricamento...</div> : history.length === 0 ? <div className="text-center py-20 bg-white/5 rounded-2xl text-gray-400">Nessuna opera salvata.</div> : (
                <div className="grid gap-4">
                    {history.map(item => <HistoryItem key={item.id} item={item} onView={() => onLoadEntry(item)} onPublishClick={currentUser?.isPro ? () => setPublishingEntry(item) : undefined} onDelete={() => deleteItem(item.id)} isPro={currentUser?.isPro} />)}
                </div>
            )}
            {publishingEntry && <PublishModal entry={publishingEntry} onClose={() => setPublishingEntry(null)} onPublish={handlePublish} />}
        </div>
    );
};