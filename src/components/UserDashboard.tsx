import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};
// --- MODALE PUBBLICAZIONE AVANZATO (Step 1: Dati, Step 2: Successo/QR) ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any, file: File | null) => Promise<void> }> = ({ entry, onClose, onPublish }) => {
    const [step, setStep] = useState<1 | 2>(1); // 1=Form, 2=Success
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [customFile, setCustomFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // In produzione questo link punterà all'ID reale della galleria
    const publicLink = `https://sonificart.com/gallery?id=${entry.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicLink)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onPublish({
                title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            }, customFile);
            setStep(2); // Vai alla schermata successo
        } catch (e) {
            alert("Errore durante la pubblicazione.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const downloadQR = async () => {
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `QR_${title.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>

                {step === 1 ? (
                    // STEP 1: FORM DATI
                    <div className="p-8">
                        <h3 className="text-2xl font-bold text-white mb-6">Pubblica in Vetrina</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="w-full md:w-1/3">
                                    <img src={fixImage(entry.imageUrl)} className="w-full h-32 object-cover rounded-lg border border-white/10" alt="Preview" />
                                    <p className="text-[10px] text-gray-500 mt-2 text-center">{entry.id}</p>
                                </div>
                                <div className="w-full md:w-2/3 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Titolo</label>
                                        <input required type="text" className="w-full bg-black/30 border border-white/10 p-2 rounded text-white focus:border-brand-accent focus:outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                                    </div>
                                    <div className="p-3 bg-black/20 rounded border border-white/5">
                                        <label className="block text-xs font-bold text-brand-accent uppercase mb-1 cursor-pointer hover:text-white">
                                            <i className="fas fa-cloud-upload-alt mr-1"></i> Carica Video/Audio (Opzionale)
                                            <input type="file" accept="video/*,audio/*" className="hidden" onChange={e => setCustomFile(e.target.files ? e.target.files[0] : null)} />
                                        </label>
                                        <p className="text-[10px] text-gray-500 truncate">{customFile ? customFile.name : "Sostituisce l'audio generato con un tuo file."}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descrizione</label>
                                <textarea className="w-full bg-black/30 border border-white/10 p-2 rounded text-white h-20 focus:border-brand-accent focus:outline-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrivi la tua opera..." />
                            </div>

                            <div className="flex justify-end pt-4 border-t border-white/10">
                                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm mr-2">Annulla</button>
                                <button type="submit" disabled={isSubmitting} className="bg-brand-accent text-brand-primary font-bold py-2 px-8 rounded-full hover:bg-brand-accent-light transition-all disabled:opacity-50">
                                    {isSubmitting ? "Pubblicazione..." : "CONFERMA"}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    // STEP 2: SUCCESSO & QR
                    <div className="p-8 text-center space-y-6 animate-fade-in">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400 text-4xl border border-green-500/30">
                            <i className="fas fa-check"></i>
                        </div>
                        <h3 className="text-2xl font-bold text-white">Pubblicazione Completata!</h3>
                        <p className="text-gray-300 text-sm">La tua opera è ora visibile nella galleria pubblica.</p>

                        <div className="flex justify-center my-4">
                            <div className="bg-white p-2 rounded-lg shadow-lg">
                                <img src={qrUrl} alt="QR Code" className="w-40 h-40" />
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={downloadQR} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white text-xs font-bold flex items-center gap-2">
                                <i className="fas fa-download"></i> Scarica QR
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(publicLink); alert("Link copiato!"); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white text-xs font-bold flex items-center gap-2">
                                <i className="fas fa-link"></i> Copia Link
                            </button>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                            <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">Chiudi</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; onDelete?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, onDelete, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-transparent hover:border-brand-accent/50 hover:bg-brand-secondary/60 transition-all group cursor-pointer" onClick={onView}>
        <div className="relative w-20 h-20 flex-shrink-0">
            <img src={fixImage(item.imageUrl)} alt="thumb" className="w-full h-full object-cover rounded bg-black" />
        </div>
        <div className="flex-grow min-w-0">
            <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Senza Titolo"}</h4>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold text-gray-300">{item.paradigm}</span>
                <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1 font-mono truncate">ID: {item.id}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">

            {/* PULSANTE 1: SONIFICAZIONE */}
            <button
                onClick={(e) => { e.stopPropagation(); onView(); }}
                className="bg-brand-primary hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded border border-white/10 transition-colors"
            >
                Sonificazione
            </button>

            {/* PULSANTE 2: GALLERIA */}
            {isPro && onPublishClick && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPublishClick(); }}
                    className="bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-4 rounded border border-purple-500/30 transition-colors"
                >
                    Galleria
                </button>
            )}

            {/* PULSANTE 3: ELIMINA (CESTINO) */}
            <button
                onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(); }}
                className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded transition-colors ml-2"
                title="Elimina Opera"
            >
                <i className="fas fa-trash"></i>
            </button>
        </div>
    </div>
);

interface UserDashboardProps { onLoadEntry: (entry: DashboardEntry) => void; }

export const UserDashboard: React.FC<UserDashboardProps> = ({ onLoadEntry }) => {
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
            await api.deleteHistoryItem(id);
            loadHistory(); // Ricarica la lista
        }
    };

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }, file: File | null) => {
        if (!publishingEntry || !currentUser) return;
        await api.publishFromHistory(publishingEntry, metadata, currentUser, file);
        // Il modale gestisce il successo, qui non serve fare altro
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white mb-2">Archivio Opere</h2>
                    <p className="text-brand-text-secondary">Gestisci le tue creazioni.</p>
                </div>
                {/* RIMOSSO TASTO SVUOTA */}
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500">Caricamento...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed text-gray-400">Nessuna opera salvata.</div>
            ) : (
                <div className="grid gap-4">
                    {history.map(item => (
                        <HistoryItem
                            key={item.id}
                            item={item}
                            onView={() => onLoadEntry(item)}
                            onPublishClick={currentUser?.isPro ? () => setPublishingEntry(item) : undefined}
                            onDelete={() => deleteItem(item.id)}
                            isPro={currentUser?.isPro}
                        />
                    ))}
                </div>
            )}
            {publishingEntry && <PublishModal entry={publishingEntry} onClose={() => setPublishingEntry(null)} onPublish={handlePublish} />}
        </div>
    );
};