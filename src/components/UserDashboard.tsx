import React, { useState, useEffect, useCallback } from 'react';
import { DashboardEntry, User } from '../types';
import { api, USE_MOCK_BACKEND } from '../services/api';

// --- HELPER: RIPARA L'IMMAGINE DAL DB ---
const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Se ha già il prefisso corretto o è un link web, va bene così
    if (url.startsWith('data:') || url.startsWith('http')) {
        return url;
    }

    // Se è la stringa raw dal DB (come nel tuo screenshot), aggiungiamo il prefisso
    return `data:image/jpeg;base64,${url}`;
};

// --- PUBLISH MODAL ---
const PublishModal: React.FC<{ entry: DashboardEntry; onClose: () => void; onPublish: (data: any) => void }> = ({ entry, onClose, onPublish }) => {
    const [title, setTitle] = useState(`Opera del ${new Date(entry.timestamp).toLocaleDateString()}`);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPublish({
            title,
            description,
            tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4">Pubblica in Vetrina</h3>
                <div className="mb-4 flex gap-4 items-center bg-brand-primary/50 p-3 rounded">
                    {/* USO fixImage QUI */}
                    <img src={fixImage(entry.imageUrl)} className="w-16 h-16 object-cover rounded" alt="Preview" />
                    <div>
                        <p className="text-sm text-white font-bold">{entry.traditionName}</p>
                        <p className="text-xs text-brand-text-secondary capitalize">{entry.paradigm}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Titolo Opera</label>
                        <input required type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Descrizione (facoltativa)</label>
                        <textarea className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white h-20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrivi l'ispirazione..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Tags (separati da virgola)</label>
                        <input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white" value={tags} onChange={e => setTags(e.target.value)} placeholder="Astratto, Natura, Emozione..." />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded text-sm">Annulla</button>
                        <button type="submit" className="bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-2 px-6 rounded text-sm shadow-lg">Conferma Pubblicazione</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Details Modal Component ---
const HistoryDetailsModal: React.FC<{ entry: DashboardEntry; onClose: () => void }> = ({ entry, onClose }) => {
    // Helper data sicura
    const safeDate = (dateVal: string | Date) => {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-3xl bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <button
                    className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl transition-colors z-10"
                    onClick={onClose}
                >
                    &times;
                </button>

                <div className="flex flex-col md:flex-row">
                    {/* Image Section */}
                    <div className="w-full md:w-1/2 bg-black/20 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-brand-secondary/50">
                        <div className="relative group">
                            {/* USO fixImage QUI */}
                            <img
                                src={fixImage(entry.imageUrl)}
                                alt="Sonification Result"
                                className="max-w-full max-h-[400px] object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
                        <h3 className="text-2xl font-bold text-white mb-1">{entry.traditionName}</h3>
                        <div className="inline-flex items-center gap-2 mb-6">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${entry.paradigm === 'scientific' ? 'bg-blue-900/50 text-blue-200' :
                                    entry.paradigm === 'artistic' ? 'bg-purple-900/50 text-purple-200' : 'bg-brand-accent/20 text-brand-accent'
                                }`}>
                                {entry.paradigm}
                            </span>
                            <span className="text-brand-text-secondary text-xs">
                                {safeDate(entry.timestamp).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="space-y-4 text-sm text-brand-text-primary">
                            <div className="bg-brand-primary/50 p-3 rounded border border-brand-secondary/50">
                                <span className="block text-xs text-brand-text-secondary uppercase tracking-wider mb-1">ID Univoco (Hash)</span>
                                <span className="font-mono text-xs break-all text-white/80">{entry.id}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-brand-primary/50 p-3 rounded border border-brand-secondary/50">
                                    <span className="block text-xs text-brand-text-secondary uppercase tracking-wider mb-1">Data</span>
                                    <span className="font-mono text-white/90">{safeDate(entry.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="bg-brand-primary/50 p-3 rounded border border-brand-secondary/50">
                                    <span className="block text-xs text-brand-text-secondary uppercase tracking-wider mb-1">Stato</span>
                                    <span className="font-mono text-green-400"><i className="fas fa-check-circle mr-1"></i> Completato</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-brand-secondary/50 flex justify-end">
                            <button onClick={onClose} className="bg-brand-secondary hover:bg-brand-secondary/80 text-white font-bold py-2 px-6 rounded-full transition-colors text-sm">
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const HistoryItem: React.FC<{ item: DashboardEntry; onView: () => void; onPublishClick?: () => void; isPro?: boolean }> = ({ item, onView, onPublishClick, isPro }) => {
    const safeDate = (dateVal: string | Date) => {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    return (
        <div className="bg-brand-secondary/50 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in border border-transparent hover:border-brand-accent transition-all group">
            {/* USO fixImage QUI */}
            <img
                src={fixImage(item.imageUrl)}
                alt="Sonification preview"
                className="w-full sm:w-20 h-20 object-cover rounded-md bg-brand-primary"
            />
            <div className="flex-grow min-w-0">
                <p className="font-bold text-white text-sm capitalize truncate">{item.traditionName}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.paradigm === 'scientific' ? 'bg-blue-900/30 text-blue-300' :
                            item.paradigm === 'artistic' ? 'bg-purple-900/30 text-purple-300' : 'bg-teal-900/30 text-teal-300'
                        }`}>
                        {item.paradigm}
                    </span>
                    <p className="text-xs text-brand-text-secondary"></p>