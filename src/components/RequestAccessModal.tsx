import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface RequestAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    initialPlan?: string; // Nuovo parametro per pre-selezionare il piano
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({ isOpen, onClose, userEmail, initialPlan = 'Mensile' }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: userEmail || '',
        address: '',
        piva: '',
        sdi: '',
        reason: '',
        plan: initialPlan
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            email: userEmail || prev.email,
            plan: initialPlan || prev.plan
        }));
    }, [userEmail, initialPlan, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.requestAccess(formData);
            alert("Richiesta inviata con successo! Controlla la tua email per la conferma.");
            onClose();
        } catch (error) {
            console.error(error);
            alert("Errore nell'invio. Riprova più tardi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-lg bg-[#0f172a] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in p-8 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white text-xl" onClick={onClose}>&times;</button>

                <div className="mb-6 text-center">
                    <div className="w-12 h-12 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-accent border border-brand-accent/30">
                        <i className="fas fa-file-invoice"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-white">Attivazione Servizio PRO</h3>
                    <p className="text-sm text-brand-text-secondary mt-3 bg-white/5 p-3 rounded border border-white/5 text-left">
                        Compila i dati per la fatturazione. Riceverai una email con la fattura e le coordinate bancarie.
                        <br /><br />
                        <em className="text-brand-accent">Il servizio sarà attivato alla ricezione del pagamento.</em>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Piano Scelto</label>
                        <select name="plan" value={formData.plan} onChange={handleChange} className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none">
                            <option value="Mensile">PRO Mensile (€ 8.80)</option>
                            <option value="Annuale">PRO Annuale (€ 88.00)</option>
                            <option value="Enterprise">Enterprise (Custom)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Ragione Sociale / Nome *</label>
                            <input type="text" name="name" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white" value={formData.name} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Email Fatturazione *</label>
                            <input type="email" name="email" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white" value={formData.email} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Indirizzo Completo *</label>
                        <input type="text" name="address" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white" placeholder="Via, Città, CAP, Provincia" value={formData.address} onChange={handleChange} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">P.IVA / C.F. *</label>
                            <input type="text" name="piva" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white" value={formData.piva} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Codice SDI / PEC</label>
                            <input type="text" name="sdi" className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white" placeholder="0000000" value={formData.sdi} onChange={handleChange} />
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 rounded-lg shadow-lg transition-all mt-2 disabled:opacity-50">
                        {isSubmitting ? "Invio in corso..." : "Richiedi Fattura e Attivazione"}
                    </button>
                </form>
            </div>
        </div>
    );
};