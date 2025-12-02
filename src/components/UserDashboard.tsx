import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

// Helper per percorsi sicuri
const fixUrl = (url: string | undefined) => {
    if (!url) return "https://via.placeholder.com/400x400?text=No+Media";
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Se è un path relativo, aggiungilo al dominio (modifica se necessario in base al tuo deploy)
    return url;
};

// --- MODALE EDITOR PUBBLICAZIONE ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any, file: File | null) => Promise<void> }> = ({ entry, onClose, onPublish }) => {
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [customFile, setCustomFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showQR, setShowQR] = useState(false);

    // Link galleria
    const galleryLink = `https://sonificart.com/gallery?id=${entry.id}`; // In realtà dovrebbe usare l'ID della showcase, ma usiamo questo per ora
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(galleryLink)}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onPublish({ title, description, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0) }, customFile);
            setShowQR(true); // Mostra QR dopo successo
        } catch (e) { alert("Errore"); }
        finally { setIsSubmitting(false); }
    };

    if (showQR) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
                <div className="bg-[#1e1e2e] p-8 rounded-xl shadow-2xl border border-green-500/30 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"><i className="fas fa-check"></i></div>
                    <h3 className="text-xl font-bold text-white mb-2">Pubblicazione Aggiornata!</h3>
                    <p className="text-gray-400 text-sm mb-6">La tua opera è visibile in galleria.</p>
                    <img src={qrUrl} className="mx-auto mb-6 rounded-lg border border-white/10" alt="QR" />
                    <div className="flex flex-col gap-3">
                        <a href={qrUrl} download="qrcode.png" className="bg-white/10 hover:bg-white/20 text-white py-2 rounded text-sm font-bold transition-colors">Scarica QR</a>
                        <button onClick={() => { navigator.clipboard.writeText(galleryLink); alert("Link copiato"); }} className="bg-brand-primary hover:bg-brand-accent hover:text-black text-white py-2 rounded text-sm font-bold transition-colors">Copia Link</button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm mt-2">Chiudi</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-white/10 flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Left: Media Preview */}
                <div className="w-full md:w-1/3 bg-black p-6 flex flex-col items-center justify-center border-r border-white/5">
                    <img src={fixUrl(entry.imageUrl)} className="w-full h-auto rounded-lg shadow-lg mb-4" alt="Cover" />
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase mb-1">Media Corrente</p>
                        {entry.audioUrl ? (
                            <span className="text-green-400 text-xs font-bold flex items-center justify-center gap-1"><i className="fas fa-music"></i> Audio Presente</span>
                        ) : (
                            <span className="text-yellow-500 text-xs font-bold">Nessun Audio</span>
                        )}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="w-full md:w-2/3 p-8">
                    <h3 className="text-xl font-bold text-white mb-6">Modifica Pubblicazione</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titolo</label>
                            <input required type="text" className="w-full bg-black/30 border border-white/10 p-2 rounded text-white focus:border-brand-accent outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrizione</label>
                            <textarea className="w-full bg-black/30 border border-white/10 p-2 rounded text-white h-20 focus:border-brand-accent outline-none" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>

                        <div className="bg-white/5 p-3 rounded border border-white/5">
                            <label className="block text-xs font-bold text-brand-accent uppercase mb-2"><i className="fas fa-upload mr-1"></i> Cambia File Audio/Video (Opzionale)</label>
                            <input
                                type="file"
                                accept="audio/*,video/*"
                                className="w-full text-xs text-gray-400"
                                onChange={e => setCustomFile(e.target.files ? e.target.files[0] : null)}
                            />
                            {customFile && <p className="text-[10px] text-green-400 mt-1">File selezionato: {customFile.name}</p>}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold">Annulla</button>
                            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-brand-accent text-brand-primary hover:bg-white font-bold rounded shadow-lg text-xs transition-colors">
                                {isSubmitting ? "Salvataggio..." : "SALVA & PUBBLICA"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ... HistoryItem e UserDashboard rimangono uguali a prima, assicurati solo di usare questo PublishModal ...
const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, isPro }) => (
    <div className="bg-brand-secondary/40 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-transparent hover:border-brand-accent/50 hover:bg-brand-secondary/60 transition-all group cursor-pointer" onClick={onView}>
        <div className="relative w-20 h-20 flex-shrink-0">
            <img src={fixUrl(item.imageUrl)} alt="thumb" className="w-full h-full object-cover rounded bg-black" />
        </div>
        <div className="flex-grow min-w-0">
            <h4 className="text-white font-bold text-sm truncate">{item.traditionName || "Opera Senza Nome"}</h4>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded uppercase font-bold">{item.paradigm}</span>
                <span className="text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={(e) => { e.stopPropagation(); onView(); }} className="flex-1 sm:flex-none bg-brand-primary hover:bg-white/10 text-white text-xs font-bold py-2 px-4 rounded-full border border-white/10 transition-colors flex items-center justify-center gap-2">
                <i className="fas fa-desktop"></i> Apri Studio
            </button>
            {isPro && onPublishClick && (
                <button onClick={(e) => { e.stopPropagation(); onPublishClick(); }} className="flex-1 sm:flex-none bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-4 rounded-full border border-purple-500/30 transition-colors">
                    <i className="fas fa-edit mr-1"></i> Gestisci
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
        if (confirm("Cancellare tutto lo storico?")) { await api.clearHistory(); setHistory([]); }
    };

    const handlePublish = async (metadata: { title: string; description: string; tags: string[] }, file: File | null) => {
        if (!publishingEntry || !currentUser) return;
        // La funzione api.publishFromHistory ora gestisce l'update se esiste già
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