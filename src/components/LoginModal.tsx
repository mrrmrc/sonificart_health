


import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [gdprConsent, setGdprConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        
        // Reset state when opening
        setIsRegistering(false);
        setError(null);
        setEmail('');
        setPassword('');
        setName('');
        setGdprConsent(false);
        setRegistrationSuccess(false);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isRegistering && !gdprConsent) {
            setError("È necessario accettare la Privacy Policy per registrarsi.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (isRegistering) {
                await api.register(name, email, password);
                setRegistrationSuccess(true);
            } else {
                const user = await api.login(email, password);
                onLoginSuccess(user);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Errore di autenticazione");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        setError(null);
        setGdprConsent(false);
        setRegistrationSuccess(false);
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="relative w-full max-w-md bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    className="absolute top-4 right-4 text-brand-text-secondary text-xl hover:text-white transition-colors z-10"
                    onClick={onClose}
                    aria-label="Chiudi"
                >
                    &times;
                </button>

                <div className="p-8">
                    {/* --- REGISTRATION SUCCESS VIEW --- */}
                    {registrationSuccess ? (
                        <div className="text-center animate-fade-in py-6">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                                <i className="fas fa-envelope-open-text text-4xl text-green-400"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">Controlla la tua Email</h2>
                            <p className="text-brand-text-secondary mb-6">
                                Ti abbiamo inviato un link di conferma a <strong>{email}</strong>.<br/>
                                Clicca sul link per attivare il tuo account e ricevere i tuoi <strong>3 Crediti Gratuiti</strong>.
                            </p>
                            <div className="p-3 bg-brand-primary/50 rounded text-xs text-brand-text-secondary mb-6 border border-white/10">
                                (Simulazione: L'account è stato creato. Puoi effettuare il login ora.)
                            </div>
                            <button 
                                onClick={() => { setRegistrationSuccess(false); setIsRegistering(false); }}
                                className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Torna al Login
                            </button>
                        </div>
                    ) : (
                        /* --- NORMAL FORM VIEW --- */
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white">
                                    {isRegistering ? 'Crea Account' : 'Accedi'}
                               </h2>
                                <p className="text-sm text-brand-text-secondary mt-2">
                                    {isRegistering 
                                        ? "Registrati per accedere al framework SonificA.R.T." 
                                        : "Accedi alla tua dashboard per gestire le sonificazioni."}
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm text-center animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {isRegistering && (
                                    <div className="animate-fade-in">
                                        <label htmlFor="name" className="block text-sm font-medium text-brand-text-primary mb-1">Nome Utente</label>
                                        <input 
                                            type="text" 
                                            id="name" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required={isRegistering}
                                            className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                            placeholder="Il tuo nome"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-brand-text-primary mb-1">Username o Email</label>
                                    <input 
                                        type="text" 
                                        id="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        placeholder="username o email"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-brand-text-primary mb-1">Password</label>
                                    <input 
                                        type="password" 
                                        id="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>

                                {isRegistering && (
                                    <div className="flex items-start gap-3 pt-2 animate-fade-in">
                                        <div className="flex items-center h-5">
                                            <input
                                                id="gdpr"
                                                type="checkbox"
                                                checked={gdprConsent}
                                                onChange={(e) => setGdprConsent(e.target.checked)}
                                                required
                                                className="w-4 h-4 border border-brand-secondary rounded bg-brand-primary focus:ring-3 focus:ring-brand-accent"
                                            />
                                        </div>
                                        <label htmlFor="gdpr" className="text-xs text-brand-text-secondary">
                                            Acconsento al trattamento dei miei dati personali secondo la <a href="#" className="text-brand-accent hover:underline">Privacy Policy</a> e confermo di aver letto i <a href="#" className="text-brand-accent hover:underline">Termini di Servizio</a> (GDPR Compliance).
                                        </label>
                                    </div>
                                )}
                                
                                <button 
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <i className="fas fa-circle-notch fa-spin"></i> 
                                    ) : (
                                        isRegistering ? 'Invia Link di Registrazione' : 'Login'
                                    )}
                                </button>
                            </form>
                            
                            <div className="mt-6 text-center">
                                <p className="text-sm text-brand-text-secondary">
                                    {isRegistering ? "Hai già un account?" : "Non hai ancora un account?"}
                                </p>
                                <button 
                                    onClick={toggleMode}
                                    className="mt-1 text-brand-accent hover:text-brand-accent-light font-bold text-sm hover:underline focus:outline-none"
                                >
                                    {isRegistering ? "Accedi qui" : "Registrati e ricevi 3 Crediti"}
                                </button>
                            </div>
                            
                            {!isRegistering && (
                                <div className="mt-6 text-center text-xs text-brand-text-secondary border-t border-brand-secondary pt-4 bg-brand-primary/20 rounded p-2">
                                    <p className="mb-1 font-semibold text-brand-text-primary">Credenziali PRO per Demo:</p>
                                    <div className="font-mono">
                                        <span className="text-brand-accent">pro@sonificart.com</span>
                                        <span className="mx-2">|</span>
                                        <span className="text-brand-accent">demo</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
