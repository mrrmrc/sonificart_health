import React, { useState } from 'react';
import { LegalModal } from './LegalModal'; // Ensure this path is correct

export const Footer: React.FC = () => {
    const [legalModal, setLegalModal] = useState<{ isOpen: boolean, key: string, title: string }>({ isOpen: false, key: '', title: '' });

    const openLegal = (key: string, title: string) => {
        setLegalModal({ isOpen: true, key, title });
    };

    return (
        <>
            <footer className="w-full bg-brand-secondary/30 border-t border-brand-secondary mt-auto relative z-0">
                <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-brand-text-secondary">
                    <div className="flex flex-wrap justify-center gap-6 text-sm mb-6 font-medium">
                        <button onClick={() => openLegal('privacy_policy', 'Informativa Privacy')} className="hover:text-brand-accent transition-colors hover:underline">Privacy Policy</button>
                        <button onClick={() => openLegal('cookie_policy', 'Cookie Policy')} className="hover:text-brand-accent transition-colors hover:underline">Cookie Policy</button>
                        <button onClick={() => {
                            const trigger = document.getElementById('cookie-settings-trigger');
                            if (trigger) trigger.click();
                        }} className="hover:text-brand-accent transition-colors hover:underline">Impostazioni Cookie</button>
                        <button onClick={() => openLegal('terms_of_service', 'Termini di Servizio')} className="hover:text-brand-accent transition-colors hover:underline">Termini di Servizio</button>
                        <button onClick={() => openLegal('notice_and_takedown', 'Notice & Takedown')} className="hover:text-brand-accent transition-colors hover:underline">Notice & Takedown</button>
                    </div>

                    <p className="text-xs text-gray-500">
                        &copy; {new Date().getFullYear()} SonificA.R.T. Framework. Tutti i diritti riservati.
                        <a href="mailto:mail@sonificart.com" className="opacity-50 ml-2 hover:opacity-100 hover:text-brand-accent transition-all">mail@sonificart.com</a>
                    </p>
                    <p className="text-[10px] text-gray-600/50 mt-2 font-mono">
                        Ultimo Deploy: {/* @ts-ignore */}
                        {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'Dev Environment'}
                    </p>
                </div>
            </footer>

            <LegalModal
                isOpen={legalModal.isOpen}
                onClose={() => setLegalModal({ ...legalModal, isOpen: false })}
                documentKey={legalModal.key}
                title={legalModal.title}
            />
        </>
    );
};
