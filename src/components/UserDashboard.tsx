import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any, file: File | null) => Promise<void> }> = ({ entry, onClose, onPublish }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [customFile, setCustomFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Verifica se c'è già audio
    const hasExistingAudio = !!entry.audioUrl;

    const publicLink = `https://sonificart.com/gallery?id=${entry.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicLink)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (customFile && customFile.size > 30 * 1024 * 1024) {
            alert("File troppo grande (Max 30MB)."); return;
        }
        setIsSubmitting(true);
        try {
            await onPublish({ title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0) }, customFile);
            setStep(2);
        } catch (error) { alert("Errore pubblicazione"); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex border-b border-white/10">
                    <div className={`flex-1 py-4 text-center text-sm font-bold uppercase tracking-wider ${step === 1 ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-gray-600'}`}>1. Dati & Media</div>
                    <div className={`flex-1 py-4 text-center text-sm font-bold uppercase tracking-wider ${step === 2 ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-gray-600'}`}>2. QR & Share</div>
                </div>
                <div className="p-8">
                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex gap-6">
                                <div className="w-1/3">
                                    <img src={fixImage(entry.imageUrl)} className="w-full h-32 object-cover rounded-lg border border-white/10" alt="Preview" />
                                    <p className="text-[10px] text-gray-500 mt-2 text-center">{entry.paradigm}</p>
                                </div>
                                <div className="w-2/3 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Titolo</label>
                                        <input required type="text" className="w-full bg-black/40 border border-white/10 p-3 rounded text-white focus:border-brand-accent outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                                    </div>

                                    <div className="bg-black/20 p-3 rounded border border-white/5">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                                            {customFile ? "Nuovo File Selezionato:" : "File Audio/Video"}
                                        </label>

                                        {/* Mostra stato attuale */}
                                        {!customFile && hasExistingAudio && (
                                            <div className="text-xs text-green-400 mb-2 flex items-center gap-2">
                                                <i className="fas fa-check-circle"></i> Audio salvato presente
                                            </div>
                                        )}

                                        <input
                                            type="file"
                                            accept="video/mp4,audio/mp3,audio/wav"
                                            className="w-full text-xs text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary cursor-pointer"
                                            onChange={(e) => setCustomFile(e.target.files ? e.target.files[0] : null)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descrizione</label>
                                <textarea className="w-full bg-black/40 border border-white/10 p-3 rounded text-white h-20 focus:border-brand-accent outline-none" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tags</label>
                                <input type="text" className="w-full bg-black/40 border border-white/10 p-3 rounded text-white focus:border-brand-accent outline-none" value={tags} onChange={e => setTags(e.target.value)} placeholder="Es: Natura, Emozione" />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 py-2 rounded-full text-gray-400 hover:text-white text-sm font-bold">Annulla</button>
                                <button type="submit" disabled={isSubmitting} className="px-8 py-2 rounded-full bg-brand-accent text-brand-primary hover:bg-white font-bold shadow-lg transition-all text-sm">
                                    {isSubmitting ? "Pubblicazione..." : "PUBBLICA ORA"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center animate-fade-in">
                            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"><i className="fas fa-check"></i></div>
                            <h3 className="text-2xl font-bold text-white mb-2">Pubblicata!</h3>
                            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl mb-6"><img src={qrUrl} alt="QR" className="w-40 h-40" /></div>
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <button onClick={onClose} className="bg-brand-primary hover:bg-white/10 text-white py-2 px-6 rounded-full text-sm font-bold transition-colors border border-white/10">Chiudi</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-transparent hover:border-brand-accent/50 hover:bg-brand-secondary/60 transition-all group cursor-pointer" onClick={onView}>
        <div className="relative w-20 h-20 flex-shrink-0">
            <img src={fixImage(item.imageUrl)} alt="thumb" className="w-full h-full object-cover rounded bg-black" />
        </div>
        <div className="flex-grow min-w-0">
            <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Opera Senza Nome"}</h4>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded uppercase font-bold">{item.paradigm}</span>
                <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1 font-mono truncate">ID: {item.id}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={(e) => { e.stopPropagation(); onView(); }} className="flex-1 sm:flex-none bg-brand-primary hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded-full border border-white/10 transition-colors flex items-center justify-center gap-2">
                <i className="fas fa-desktop"></i> Apri Studio
            </button>
            {isPro && onPublishClick && (
                <button onClick={(e) => { e.stopPropagation(); onPublishClick(); }} className="flex-1 sm:flex-none bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-4 rounded-full border border-purple-500/30 transition-colors">
                    <i className="fas fa-share-square mr-1"></i> Pubblica
                </button>
            )}
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

    const clearHistory = async () => {
        if (confirm("Cancellare tutto lo storico?")) await api.clearHistory();
        setHistory([]);
    };

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }, file: File | null) => {
        if (!publishingEntry || !currentUser) return;
        await api.publishFromHistory(publishingEntry, metadata, currentUser, file);
    };

    if (isLoading) return <div className="text-center py-20">Caricamento...</div>;

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                <div><h2 className="text-3xl font-display font-bold text-white mb-2">Archivio Opere</h2><p className="text-brand-text-secondary">Gestisci le tue creazioni.</p></div>
                {history.length > 0 && <button onClick={clearHistory} className="text-red-400 text-xs">Svuota</button>}
            </div>
            <div className="grid gap-4">
                {history.map(item => <HistoryItem key={item.id} item={item} onView={() => onLoadEntry(item)} onPublishClick={currentUser?.isPro ? () => setPublishingEntry(item) : undefined} isPro={currentUser?.isPro} />)}
            </div>
            {publishingEntry && <PublishModal entry={publishingEntry} onClose={() => setPublishingEntry(null)} onPublish={handlePublish} />}
        </div>
    );
};