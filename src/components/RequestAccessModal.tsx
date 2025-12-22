import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ConfirmationModal } from './ConfirmationModal';
import { useLanguage } from '../contexts/LanguageContext';

interface RequestAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    initialPlan?: string;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({ isOpen, onClose, userEmail, initialPlan = 'Mensile' }) => {
    const { t } = useLanguage();
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
            <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-2xl border border-brand-accent/30 animate-zoom-in p-8 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white text-xl" onClick={onClose}>&times;</button>

                <div className="mb-6 text-center">
                    <div className="w-12 h-12 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-accent border border-brand-accent/30">
                        <i className="fas fa-file-invoice"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-white">{t('request_access.title')}</h3>
                    <p className="text-[13px] text-brand-text-secondary mt-3 bg-white/5 p-4 rounded border border-white/5 text-left leading-relaxed">
                        <span className="block mb-3 font-medium text-white/90">
                            {t('request_access.subtitle')}
                        </span>
                        <span className="block mb-3 italic">
                            {t('request_access.legal_disclaimer')}
                        </span>
                        <em className="text-brand-accent font-medium">{t('request_access.activation_note')}</em>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* PLAN SELECTION (Custom Radio Grid) */}
                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-2">{t('request_access.plan')}</label>
                        <div className="grid grid-cols-3 gap-3">
                            {['Mensile', 'Annuale', 'Enterprise'].map(plan => (
                                <div
                                    key={plan}
                                    onClick={() => handlePlanSelect(plan)}
                                    className={`cursor-pointer p-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center h-full ${formData.plan === plan
                                        ? 'bg-brand-accent text-brand-primary border-brand-accent shadow-lg ring-1 ring-brand-accent'
                                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="text-sm font-bold leading-tight">
                                        {plan === 'Enterprise' ? t('request_access.plan_enterprise') : (plan === 'Annuale' ? t('request_access.plan_annual') : t('request_access.plan_monthly'))}
                                    </div>
                                    <div className="text-[11px] mt-1 font-medium opacity-90">
                                        {plan === 'Enterprise' ? t('request_access.plan_enterprise_price') : (plan === 'Annuale' ? t('request_access.plan_annual_price') : t('request_access.plan_monthly_price'))}
                                    </div>
                                    {plan === 'Annuale' && <div className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded mt-1">-20%</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONDITIONAL FIELDS FOR ENTERPRISE */}
                    {formData.plan === 'Enterprise' && (
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                                <i className="fas fa-building-columns text-brand-accent text-xs"></i>
                                <h4 className="text-xs font-bold text-brand-accent uppercase">Dettagli Istituzione</h4>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.institution_type')}</label>
                                <input type="text" name="institutionType" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white text-sm focus:border-brand-accent focus:outline-none" placeholder={t('request_access.institution_placeholder')} value={formData.institutionType} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.purpose')}</label>
                                <textarea name="purpose" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white text-sm h-16 focus:border-brand-accent focus:outline-none" placeholder={t('request_access.purpose_placeholder')} value={formData.purpose} onChange={handleChange}></textarea>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.website')}</label>
                                <input type="text" name="website" className="w-full bg-black/40 border border-white/10 p-2 rounded text-white text-sm focus:border-brand-accent focus:outline-none" placeholder="https://" value={formData.website} onChange={handleChange} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.company_name')}</label>
                            <input type="text" name="name" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" value={formData.name} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.billing_email')}</label>
                            <input type="email" name="email" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" value={formData.email} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.address')}</label>
                        <input type="text" name="address" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" placeholder={t('request_access.address_placeholder')} value={formData.address} onChange={handleChange} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.vat_number')}</label>
                            <input type="text" name="piva" required className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" value={formData.piva} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('request_access.sdi_code')}</label>
                            <input type="text" name="sdi" className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-brand-accent focus:outline-none" placeholder="0000000" value={formData.sdi} onChange={handleChange} />
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 rounded-lg shadow-lg transition-all mt-2 disabled:opacity-50">
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
        </div>
    );
};