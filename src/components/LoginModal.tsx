import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../services/api';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: User) => void;
}

// --- COMPONENTE INTERNA PER LA PRIVACY ---
const PrivacyContentModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [content, setContent] = useState<string>("Caricamento policy...");

    useEffect(() => {
        // Scarica il contenuto di privacy.html dalla root
        fetch('/privacy.html')
            .then(res => res.text())
            .then(text => setContent(text))
            .catch(() => setContent("Errore nel caricamento della Privacy Policy. Per favore ricarica la pagina."));
    }, []);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4 notranslate">
            <div className="relative w-full max-w-2xl bg-white text-black rounded-lg shadow-2xl h-[80vh] flex flex-col animate-zoom-in">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="text-xl font-bold text-gray-800">Termini e Privacy</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto prose prose-sm max-w-none">
                    {/* Renderizza l'HTML caricato */}
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg text-right">
                    <button onClick={onClose} className="bg-brand-accent text-brand-primary font-bold py-2 px-6 rounded hover:bg-brand-accent-light">
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE ---
export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [gdprConsent, setGdprConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
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

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Reset state on open
            setView('login');
            setError(null);
            setSuccessMsg(null);
            setEmail('');
            setConfirmEmail('');
            setPassword('');
            setName('');
            setGdprConsent(false);
            setRememberMe(false); // Default to not checked (or true if preferred, but false is safer for public terminals)
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            if (view === 'register') {
                if (!gdprConsent) throw new Error("Accetta la Privacy Policy per continuare.");
                if (email !== confirmEmail) throw new Error(t('login.email_mismatch'));
                if (password.length < 6) throw new Error("La password deve essere di almeno 6 caratteri.");
                const user = await api.register(name, email, password);
                setSuccessMsg(`${t('login.register')} riuscita! Email di benvenuto inviata a ${email}.`);
                // Wait briefly then log in
                setTimeout(() => onLoginSuccess(user), 3000);
            }
            else if (view === 'login') {
                const user = await api.login(email, password, rememberMe);
                onLoginSuccess(user);
            }
            else if (view === 'forgot') {
                // Chiamata alla nuova API reset_password
                const res = await fetch('https://sonificart.com/api/index.php?action=reset_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (data.success) {
                    setSuccessMsg("Se l'email esiste, riceverai istruzioni a breve.");
                    setTimeout(() => setView('login'), 3000);
                } else {
                    throw new Error("Errore nel recupero password.");
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Errore generico");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {showPrivacy && <PrivacyContentModal onClose={() => setShowPrivacy(false)} />}

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4 notranslate" aria-modal="true" role="dialog">
                <div className="relative w-full max-w-md bg-brand-secondary rounded-lg shadow-2xl border border-brand-secondary/50 animate-zoom-in" onClick={e => e.stopPropagation()}>
                    <button className="absolute top-4 right-4 text-brand-text-secondary text-xl hover:text-white transition-colors z-10" onClick={onClose}>&times;</button>

                    <div className="p-8">
                        {/* HEADER */}
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-black text-white font-display uppercase tracking-tight">
                                {view === 'login' && t('login.login')}
                                {view === 'register' && t('login.create_account')}
                                {view === 'forgot' && t('login.forgot_password')}
                            </h2>
                            <div className="w-12 h-1 bg-brand-accent mx-auto mt-3 rounded-full shadow-[0_0_10px_rgba(13,148,136,0.3)]"></div>
                            <p className="text-sm text-brand-text-secondary mt-4 leading-relaxed max-w-[280px] mx-auto">
                                {view === 'login' && t('login.login_subtitle')}
                                {view === 'register' && t('login.register_subtitle')}
                                {view === 'forgot' && t('login.forgot_password_subtitle') || 'Inserisci la tua email per recuperare l\'accesso.'}
                            </p>
                        </div>

                        {/* MESSAGGI DI STATO */}
                        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm text-center">{error}</div>}
                        {successMsg && <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-200 text-sm text-center">{successMsg}</div>}

                        {/* FORM */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {view === 'register' && (
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1">Nome</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:outline-none focus:border-brand-accent" placeholder="Il tuo nome" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1">{t('login.email')}</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:outline-none focus:border-brand-accent" placeholder="name@example.com" />
                            </div>

                            {view === 'register' && (
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1">{t('login.confirm_email')}</label>
                                    <input type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:outline-none focus:border-brand-accent" placeholder="name@example.com" />
                                </div>
                            )}

                            {view !== 'forgot' && (
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1">Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 bg-brand-primary border border-brand-secondary rounded-md text-white focus:outline-none focus:border-brand-accent" placeholder="••••••••" />
                                    {view === 'register' && <span className="text-[10px] text-gray-500 block mt-1">Minimo 6 caratteri</span>}
                                </div>
                            )}

                            {view === 'login' && (
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center">
                                        <input
                                            id="remember-me"
                                            name="remember-me"
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="h-4 w-4 rounded bg-brand-primary border-brand-secondary text-brand-accent focus:ring-brand-accent cursor-pointer"
                                        />
                                        <label htmlFor="remember-me" className="ml-2 block text-sm text-brand-text-secondary cursor-pointer select-none">
                                            Ricorda accesso
                                        </label>
                                    </div>
                                    <button type="button" onClick={() => { setView('forgot'); setError(null); }} className="text-xs text-brand-accent hover:text-brand-accent-light hover:underline">
                                        Password dimenticata?
                                    </button>
                                </div>
                            )}

                            {view === 'register' && (
                                <div className="flex items-start gap-3 pt-2">
                                    <input id="gdpr" type="checkbox" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} className="mt-1 w-4 h-4 rounded bg-brand-primary border-brand-secondary text-brand-accent focus:ring-brand-accent" />
                                    <label htmlFor="gdpr" className="text-xs text-brand-text-secondary">
                                        Accetto la <button type="button" onClick={() => setShowPrivacy(true)} className="text-brand-accent hover:underline">Privacy Policy</button> e i <button type="button" onClick={() => setShowPrivacy(true)} className="text-brand-accent hover:underline">Termini di Servizio</button>.
                                    </label>
                                </div>
                            )}

                            <button type="submit" disabled={isLoading} className="w-full bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50">
                                {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : (view === 'login' ? t('login.login') : view === 'register' ? t('login.register') : 'Invia Email')}
                            </button>
                        </form>

                        {/* FOOTER SWITCHER */}
                        <div className="mt-6 text-center pt-4 border-t border-brand-secondary/30">
                            {view === 'login' && (
                                <p className="text-sm text-brand-text-secondary">
                                    Non hai un account? <button onClick={() => { setView('register'); setError(null); }} className="text-brand-accent hover:underline font-bold">Registrati</button>
                                </p>
                            )}
                            {view === 'register' && (
                                <p className="text-sm text-brand-text-secondary">
                                    Hai già un account? <button onClick={() => { setView('login'); setError(null); }} className="text-brand-accent hover:underline font-bold">Accedi</button>
                                </p>
                            )}
                            {view === 'forgot' && (
                                <button onClick={() => { setView('login'); setError(null); }} className="text-sm text-brand-text-secondary hover:text-white transition-colors">
                                    &larr; Torna al Login
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};