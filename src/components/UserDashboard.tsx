import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

// --- HELPER: RIPARA L'IMMAGINE DAL DB ---
const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

// --- PUBLISH MODAL (Resta invariato, serve per pubblicare) ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any) => void }> = ({ entry, onClose, onPublish }) => {
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPublish({ title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0) });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4">Pubblica in Vetrina</h3>
                <div className="mb-4 flex gap-4 items-center bg-brand-primary/50 p-3 rounded">
                    <img src={fixImage(entry.imageUrl)} className="w-16 h-16 object-cover rounded" alt="Preview" />
                    <div>
                        <p className="text-sm text-white font-bold">{entry.traditionName}</p>
                        <p className="text-xs text-brand-text-secondary capitalize">{entry.paradigm}</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Titolo</label><input required type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white" value={title} onChange={e => setTitle(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Descrizione</label><textarea className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white h-20" value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Tags</label><input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white" value={tags} onChange={e => setTags(e.target.value)} /></div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded text-sm">Annulla</button>
                        <button type="submit" className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-2 px-6 rounded text-sm shadow-lg">Conferma</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- HISTORY ITEM (LISTA) ---
const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, isPro }) => {
    return (
        // Aggiunto onClick sul container per migliorare l'usabilità
        <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in border border-transparent hover:border-brand-accent/50 hover:bg-brand-secondary/60 transition-all group cursor-pointer" onClick={onView}>
            <div className="relative w-20 h-20 flex-shrink-0">
                <img
                    src={fixImage(item.imageUrl)}
                    alt="preview"
                    className="w-full h-full object-cover rounded bg-black"
                />
                {/* Overlay play sull'immagine */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-all flex items-center justify-center">
                    <i className="fas fa-play text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"></i>
                </div>
            </div>

            <div className="flex-grow min-w-0">
                <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Opera Senza Nome"}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${item.paradigm === 'scientific' ? 'bg-teal-900/50 text-teal-300' :
                            item.paradigm === 'artistic' ? 'bg-purple-900/50 text-purple-300' : 'bg-amber-900/50 text-amber-300'
                        }`}>
                        {item.paradigm}
                    </span>
                    <span className="text-[10px] text-gray-500">
                        {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1 font-mono truncate">ID: {item.id}</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* TASTO APRI STUDIO (Sostituisce il vecchio Dettagli/Modale) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    className="flex-1 sm:flex-none bg-brand-primary hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded-full border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                    <i className="fas fa-desktop"></i> Apri Studio
                </button>

                {isPro && onPublishClick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPublishClick(); }}
                        className="flex-1 sm:flex-none bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-4 rounded-full border border-purple-500/30 transition-colors"
                        title="Pubblica sul tuo profilo pubblico"
                    >
                        <i className="fas fa-share-square mr-1"></i> Pubblica
                    </button>
                )}
            </div>
        </div>
    );
};

// --- INTERFACCIA PRINCIPALE ---
// Definiamo la prop onLoadEntry che App.tsx ci passerà
interface UserDashboardProps {
    onLoadEntry: (entry: DashboardEntry) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ onLoadEntry }) => {
    const [history, setHistory] = useState<DashboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [publishingEntry, setPublishingEntry] = useState<DashboardEntry | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const user = await api.checkSession();
            setCurrentUser(user);
            const data = await api.getHistory();
            if (Array.isArray(data)) {
                setHistory(data);
            } else {
                setHistory([]);
            }
        } catch (error) {
            console.error("Failed to load history:", error);
            setError("Impossibile caricare la cronologia.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const clearHistory = useCallback(async () => {
        if (window.confirm("Sei sicuro di voler cancellare tutta la cronologia? Questa azione è irreversibile.")) {
            try {
                await api.clearHistory();
                setHistory([]);
            } catch (e) {
                alert("Errore durante la cancellazione.");
            }
        }
    }, []);

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }) => {
        if (!publishingEntry || !currentUser) return;
        try {
            await api.publishFromHistory(publishingEntry, metadata, currentUser);
            alert("Opera pubblicata con successo!");
            setPublishingEntry(null);
        } catch (e) {
            alert("Errore durante la pubblicazione.");
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-12 text-center">
                <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto"></div>
                <p className="text-brand-text-secondary mt-4">Caricamento archivio...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">

            {/* Header */}
            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white mb-2">Archivio Opere</h2>
                    <p className="text-brand-text-secondary">
                        Clicca su <strong>Apri Studio</strong> per riascoltare, generare video e scaricare i certificati.
                    </p>
                </div>
                {history.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold py-2 px-4 rounded text-xs transition-colors"
                    >
                        <i className="fas fa-trash-alt mr-2"></i> Svuota Tutto
                    </button>
                )}
            </div>

            {error && <div className="bg-red-900/50 p-4 rounded-lg text-center text-red-200 mb-6">{error}</div>}

            {history.length === 0 && !error ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                    <i className="fas fa-folder-open text-5xl text-gray-600 mb-4"></i>
                    <h3 className="text-xl font-bold text-gray-400">Nessuna Opera</h3>
                    <p className="text-gray-500 text-sm mt-2">Le sonificazioni salvate appariranno qui.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {history.map(item => (
                        <HistoryItem
                            key={item.id}
                            item={item}
                            // QUI STA LA MAGIA: Chiamiamo onLoadEntry invece di aprire il modale
                            onView={() => onLoadEntry(item)}
                            onPublishClick={currentUser?.isPro ? () => setPublishingEntry(item) : undefined}
                            isPro={currentUser?.isPro}
                        />
                    ))}
                </div>
            )}

            {publishingEntry && (
                <PublishModal
                    entry={publishingEntry}
                    onClose={() => setPublishingEntry(null)}
                    onPublish={handlePublish}
                />
            )}
        </div>
    );
};