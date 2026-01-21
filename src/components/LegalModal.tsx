import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentKey: string; // 'privacy_policy' | 'terms_of_service' | 'image_upload_policy' | 'notice_and_takedown' | 'upload_disclaimer'
    title: string;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, documentKey, title }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadDocument();
        }
    }, [isOpen, documentKey]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const text = await api.getAppSetting(documentKey);
            setContent(text || "Nessun contenuto disponibile per questo documento.");
        } catch (error) {
            console.error(`Failed to load document: ${documentKey}`, error);
            setContent("Errore nel caricamento del documento.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl bg-[#0f172a] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 rounded-t-xl">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <i className="fas fa-file-contract text-brand-accent"></i>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <i className="fas fa-circle-notch fa-spin text-4xl text-brand-accent"></i>
                        </div>
                    ) : (
                        <div
                            className="prose prose-invert max-w-none text-gray-300 leading-relaxed font-sans"
                            dangerouslySetInnerHTML={{ __html: content }} // Use innerHTML to render formatted text
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-white/5 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-brand-accent text-brand-primary font-bold rounded hover:bg-brand-accent-light transition-colors">
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};
