
import React, { useState, useEffect } from 'react';

interface RequestAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({ isOpen, onClose, userEmail }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: userEmail || '',
        reason: ''
    });

    useEffect(() => {
        if (userEmail) setFormData(prev => ({ ...prev, email: userEmail }));
    }, [userEmail]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Richiesta Accesso SonificA.R.T. - ${formData.name}`);
        const body = encodeURIComponent(
`Nome: ${formData.name}
Email: ${formData.email}

Motivazione / Progetto:
${formData.reason}

--------------------------------
Inviato dal form rapido SonificA.R.T.`
        );
        window.location.href = `mailto:mail@ideesitiweb.it?subject=${subject}&body=${body}`;
        setTimeout(() => { onClose(); }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-md bg-[#0f172a] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in p-8" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white text-xl" onClick={onClose}>&times;</button>
                
                <div className="mb-6 text-center">
                    <div className="w-12 h-12 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-accent border border-brand-accent/30">
                        <i className="fas fa-key"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-white">Richiedi Accesso</h3>
                    <p className="text-sm text-brand-text-secondary mt-2">
                        Sblocca i paradigmi AI e le funzionalità Pro.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            name="name"
                            required 
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none transition-colors" 
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Il tuo nome"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            name="email"
                            required 
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none transition-colors" 
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tua@email.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Parlaci del tuo progetto</label>
                        <textarea 
                            name="reason"
                            required 
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white h-24 focus:border-brand-accent focus:outline-none transition-colors resize-none" 
                            placeholder="Perché vuoi usare SonificA.R.T.?"
                            value={formData.reason}
                            onChange={handleChange}
                        />
                    </div>

                    <button type="submit" className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.02] mt-2">
                        <i className="fas fa-paper-plane mr-2"></i> Invia Richiesta
                    </button>
                </form>
            </div>
        </div>
    );
};
