import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { PrivacyModal } from './PrivacyModal';
import { useLanguage } from '../contexts/LanguageContext';

interface RequestAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    initialPlan?: string;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({ isOpen, onClose, userEmail, initialPlan = 'Mensile' }) => {
    const { t } = useLanguage();
    const { setHideSiteUI } = useOutletContext<any>() || { setHideSiteUI: () => { } };

    useEffect(() => {
        if (isOpen) {
            setHideSiteUI(true);
        } else {
            setHideSiteUI(false);
        }
        return () => setHideSiteUI(false);
    }, [isOpen, setHideSiteUI]);

    const [formData, setFormData] = useState({
        name: '',
        email: userEmail || '',
        address: '',
        piva: '',
        sdi: '',
        reason: '',
        plan: initialPlan,
        institutionType: '',
        purpose: '',
        website: ''
    });
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

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

    const handlePlanSelect = (plan: string) => {
        setFormData(prev => ({ ...prev, plan }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!privacyAccepted) return; // Should be handled by 'required' attribute but safety check

        setIsSubmitting(true);
        try {
            await api.requestAccess(formData);
            setConfirmModal({
                isOpen: true,
                title: "Richiesta Inviata",
                message: t('request_access.success') || "La tua richiesta è stata inviata con successo. Riceverai presto una email di conferma.",
                type: 'success',
                singleButton: true,
                onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    onClose();
                }
            });
        } catch (error) {
            console.error(error);
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: t('request_access.error') || "Si è verificato un errore durante l'invio della richiesta.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-2xl bg-[#1e1e2e] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in p-8 overflow-y-auto max-h-[95vh]" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white text-xl" onClick={onClose}>&times;</button>

                <div className="mb-10 text-center">
                    <div className="w-16 h-16 bg-brand-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-accent border border-brand-accent/30 rotate-3 hover:rotate-0 transition-transform duration-500">
                        <i className="fas fa-file-invoice text-2xl"></i>
                    </div>
                    <h3 className="text-3xl font-black text-white font-display uppercase tracking-tight">{t('request_access.title')}</h3>
                    <div className="w-12 h-1 bg-brand-accent mx-auto mt-4 rounded-full"></div>

                    <p className="text-[13px] text-brand-text-secondary mt-6 bg-white/5 p-6 rounded-2xl border border-white/5 text-left leading-relaxed shadow-inner">
                        <span className="block mb-3 font-bold text-white uppercase tracking-wider text-[11px] opacity-80">
                            {t('request_access.subtitle')}
                        </span>
                        <span className="block mb-3 italic opacity-60">
                            {t('request_access.legal_disclaimer')}
                        </span>
                        <em className="text-brand-accent font-black uppercase tracking-[0.1em] text-[10px] block mt-4 px-3 py-1.5 bg-brand-accent/10 rounded-lg inline-block">{t('request_access.activation_note')}</em>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.company_name')}</label>
                            <input type="text" name="name" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" value={formData.name} onChange={handleChange} placeholder="Mario Rossi" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.billing_email')}</label>
                            <input type="email" name="email" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.purpose')}</label>
                        <textarea name="purpose" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white h-32 focus:border-brand-accent focus:outline-none resize-none" placeholder={t('request_access.purpose_placeholder')} value={formData.purpose} onChange={handleChange}></textarea>
                    </div>

                    {/* Checkbox Privacy */}
                    <div className="flex items-start gap-3 mt-4">
                        <input
                            type="checkbox"
                            id="privacyCheck"
                            required
                            checked={privacyAccepted}
                            onChange={(e) => setPrivacyAccepted(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded border-gray-600 bg-black/40 text-brand-accent focus:ring-brand-accent"
                        />
                        <label htmlFor="privacyCheck" className="text-xs text-brand-text-secondary leading-relaxed">
                            Ho letto e accetto l'&nbsp;
                            <button
                                type="button"
                                onClick={() => setIsPrivacyModalOpen(true)}
                                className="text-brand-accent hover:underline font-bold"
                            >
                                Informativa Privacy
                            </button>
                            . Acconsento al trattamento dei dati personali trasmessi.
                        </label>
                    </div>

                    <button type="submit" disabled={isSubmitting || !privacyAccepted} className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 rounded-lg shadow-lg transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? t('request_access.sending') : t('request_access.submit')}
                    </button>
                </form>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
        </div>
    );
};