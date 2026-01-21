import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface PrivacyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPrivacyPolicy();
        }
    }, [isOpen]);

    const loadPrivacyPolicy = async () => {
        setLoading(true);
        try {
            const text = await api.getPrivacyPolicy();
            setContent(text || "Nessuna informativa privacy disponibile.");
        } catch (error) {
            console.error("Failed to load privacy policy", error);
            setContent("Errore nel caricamento dell'informativa.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl bg-[#0f172a] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 rounded-t-xl">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <i className="fas fa-user-shield text-brand-accent"></i>
                        Informativa Privacy
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
                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {content}
                        </div>
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
