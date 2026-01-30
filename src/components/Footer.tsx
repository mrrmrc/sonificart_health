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
                    <div className="flex justify-center space-x-8 mb-6">
                        <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-110"><i className="fab fa-github text-xl"></i></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-110"><i className="fab fa-twitter text-xl"></i></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-110"><i className="fab fa-instagram text-xl"></i></a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-110"><i className="fab fa-linkedin text-xl"></i></a>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 text-sm mb-6 font-medium">
                        <button onClick={() => openLegal('privacy_policy', 'Informativa Privacy')} className="hover:text-brand-accent transition-colors hover:underline">Privacy Policy</button>
                        <button onClick={() => openLegal('terms_of_service', 'Termini di Servizio')} className="hover:text-brand-accent transition-colors hover:underline">Termini di Servizio</button>
                        <button onClick={() => openLegal('notice_and_takedown', 'Notice & Takedown')} className="hover:text-brand-accent transition-colors hover:underline">Notice & Takedown</button>
                    </div>

                    <p className="text-xs text-gray-500">
                        &copy; {new Date().getFullYear()} SonificA.R.T. Framework. Tutti i diritti riservati. <span className="opacity-50 ml-2">Website Builder 2701</span>
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
