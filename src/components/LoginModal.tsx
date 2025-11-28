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
        // Quando il modale si apre, blocca lo scroll del body
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            // Quando il modale si chiude, ripristina lo scroll
            document.body.style.overflow = 'auto';
        }

        // Reset state when opening or closing to ensure a clean state for the next opening
        setIsRegistering(false);
        setError(null);
        setEmail('');
        setPassword('');
        setName('');
        setGdprConsent(false);
        setRegistrationSuccess(false);

        // La cleanup function verrà eseguita quando il componente si smonta o prima di ogni nuovo render dell'effect
        return () => {
            document.body.style.overflow = 'auto'; // Assicura che lo scroll sia ripristinato
        };
    }, [isOpen]); // Dipende solo da isOpen, non da onClose, che non cambia

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
                const user = await api.register(name, email, password); // Register now returns user+token
                setRegistrationSuccess(true);
                onLoginSuccess(user); // Now logs in after successful registration
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
            // RIMOSSO: onClick={onClose} - La finestra si chiuderà solo con il tasto 'X'
            aria-modal="true"
            role="dialog"
        >
            <div
                className="relative w-full max-w-md bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in"
                onClick={e => e.stopPropagation()} // Impedisce che i clic all'interno del modale si propaghino al div di sfondo
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
                            <h2 className="text-2xl font-bold text-white mb-3">Registrazione Riuscita!</h2>
                            <p className="text-brand-text-secondary mb-6">
                                Il tuo account è stato creato.<br />
                                Ora hai <strong>5 Crediti Gratuiti</strong> per iniziare a creare musica.
                            </p>
                            <button
                                onClick={onClose} // Simply close the modal after success
                                className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Inizia a Sonificare!
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
                                        isRegistering ? 'Registrati' : 'Login'
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
                                    {isRegistering ? "Accedi qui" : "Registrati e ricevi 5 Crediti"}
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