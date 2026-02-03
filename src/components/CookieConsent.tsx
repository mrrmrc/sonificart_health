import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../services/api';

interface CookiePreferences {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
}

export const CookieConsent: React.FC = () => {
    const { t, language } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [consentUuid, setConsentUuid] = useState<string>('');
    const [prefs, setPrefs] = useState<CookiePreferences>({
        essential: true,
        analytics: false,
        marketing: false,
    });

    useEffect(() => {
        let uuid = localStorage.getItem('sonificart_cookie_uuid');
        if (!uuid) {
            uuid = crypto.randomUUID();
            localStorage.setItem('sonificart_cookie_uuid', uuid);
        }
        setConsentUuid(uuid);

        const savedConsent = localStorage.getItem('sonificart_cookie_consent');
        if (!savedConsent) {
            setIsVisible(true);
        } else {
            try {
                const parsed = JSON.parse(savedConsent);
                setPrefs(parsed);
                // If they previously accepted analytics, we can trigger analytics scripts here
                if (parsed.analytics) {
                    enableAnalytics();
                }
            } catch (e) {
                setIsVisible(true);
            }
        }
    }, []);

    const saveConsent = (newPrefs: CookiePreferences) => {
        localStorage.setItem('sonificart_cookie_consent', JSON.stringify(newPrefs));
        setPrefs(newPrefs);
        setIsVisible(false);
        setShowPreferences(false);

        // Log consent to backend for legal compliance
        api.logCookieConsent({ analytics: newPrefs.analytics, marketing: newPrefs.marketing }, consentUuid);

        if (newPrefs.analytics) {
            enableAnalytics();
        } else {
            disableAnalytics();
        }
    };

    const handleAcceptAll = () => {
        const allPrefs = { essential: true, analytics: true, marketing: true };
        saveConsent(allPrefs);
    };

    const handleRejectAll = () => {
        const minimalPrefs = { essential: true, analytics: false, marketing: false };
        saveConsent(minimalPrefs);
    };

    const enableAnalytics = () => {
        // Implementation for enabling Google Analytics or similar
        console.log("Analytics enabled");
        // Example: window.gtag('consent', 'update', { 'analytics_storage': 'granted' });
    };

    const disableAnalytics = () => {
        // Implementation for disabling Google Analytics
        console.log("Analytics disabled");
        // Example: window.gtag('consent', 'update', { 'analytics_storage': 'denied' });
    };

    // Translations for the cookie banner
    const strings = {
        it: {
            title: "La tua Privacy è importante",
            description: "Utilizziamo i cookie per migliorare la tua esperienza sul nostro sito. Alcuni sono essenziali per il funzionamento, altri ci aiutano a capire come utilizzi il servizio.",
            acceptAll: "Accetta Tutti",
            rejectAll: "Rifiuta Non Essenziali",
            manage: "Personalizza",
            save: "Salva Preferenze",
            essentialTitle: "Cookie Essenziali",
            essentialDesc: "Necessari per il login, la sicurezza e le funzioni base. Non possono essere disabilitati.",
            analyticsTitle: "Cookie Analitici",
            analyticsDesc: "Ci permettono di contare le visite e le fonti di traffico in modo anonimo.",
            marketingTitle: "Cookie di Marketing",
            marketingDesc: "Utilizzati per tracciare i visitatori attraverso i siti web per mostrare annunci pertinenti."
        },
        en: {
            title: "Your Privacy Matters",
            description: "We use cookies to improve your experience on our site. Some are essential for operation, others help us understand how you use the service.",
            acceptAll: "Accept All",
            rejectAll: "Reject Non-Essential",
            manage: "Customize",
            save: "Save Preferences",
            essentialTitle: "Essential Cookies",
            essentialDesc: "Necessary for login, security, and basic functions. Cannot be disabled.",
            analyticsTitle: "Analytical Cookies",
            analyticsDesc: "Allow us to count visits and traffic sources anonymously.",
            marketingTitle: "Marketing Cookies",
            marketingDesc: "Used to track visitors across websites to display relevant ads."
        },
        fr: {
            title: "Votre confidentialité est importante",
            description: "Nous utilisons des cookies pour améliorer votre expérience sur notre site. Certains sont essentiels au fonctionnement, d'autres nous aident à comprendre comment vous utilisez le service.",
            acceptAll: "Tout Accepter",
            rejectAll: "Refuser le non-essentiel",
            manage: "Personnaliser",
            save: "Sauvegarder les préférences",
            essentialTitle: "Cookies Essentiels",
            essentialDesc: "Nécessaires pour la connexion, la sécurité et les fonctions de base. Ne peuvent pas être désactivés.",
            analyticsTitle: "Cookies Analytiques",
            analyticsDesc: "Nous permettent de compter les visites et les sources de trafic de manière anonyme.",
            marketingTitle: "Cookies de Marketing",
            marketingDesc: "Utilisés pour suivre les visiteurs à travers les sites web afin d'afficher des publicités pertinentes."
        },
        es: {
            title: "Tu privacidad es importante",
            description: "Utilizamos cookies para mejorar tu experiencia en nuestro sitio. Algunos son esenciales para el funcionamiento, otros nos ayudan a comprender cómo utilizas el servicio.",
            acceptAll: "Aceptar Todo",
            rejectAll: "Rechazar no esenciales",
            manage: "Personalizar",
            save: "Guardar preferencias",
            essentialTitle: "Cookies Esenciales",
            essentialDesc: "Necesarios para el inicio de sesión, la seguridad y las funciones básicas. No se pueden desactivar.",
            analyticsTitle: "Cookies Analíticas",
            analyticsDesc: "Nos permiten contar las visitas y las fuentes de tráfico de forma anónima.",
            marketingTitle: "Cookies de Marketing",
            marketingDesc: "Utilizados para rastrear a los visitantes a través de los sitios web para mostrar anuncios relevantes."
        }
    };

    const s = strings[language as keyof typeof strings] || strings.en;

    if (!isVisible && !showPreferences) return null;

    return (
        <>
            {/* Banner Principale */}
            {isVisible && !showPreferences && (
                <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 md:p-6 animate-slide-up">
                    <div className="max-w-7xl mx-auto bg-[#0f172a]/95 backdrop-blur-md border border-brand-accent/30 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <i className="fas fa-cookie-bite text-brand-accent"></i>
                                {s.title}
                            </h4>
                            <p className="text-gray-300 text-sm leading-relaxed max-w-3xl">
                                {s.description}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <button
                                onClick={() => setShowPreferences(true)}
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                {s.manage}
                            </button>
                            <button
                                onClick={handleRejectAll}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/10"
                            >
                                {s.rejectAll}
                            </button>
                            <button
                                onClick={handleAcceptAll}
                                className="px-8 py-2.5 text-sm font-bold text-brand-primary bg-brand-accent hover:bg-brand-accent-light rounded-lg shadow-lg shadow-brand-accent/20 transition-all"
                            >
                                {s.acceptAll}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Preferenze */}
            {showPreferences && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowPreferences(false)}>
                    <div className="w-full max-w-2xl bg-[#0f172a] rounded-2xl border border-brand-accent/30 shadow-2xl overflow-hidden animate-zoom-in" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <i className="fas fa-sliders-h text-brand-accent"></i>
                                {s.manage}
                            </h3>
                            <button onClick={() => setShowPreferences(false)} className="text-gray-500 hover:text-white transition-colors">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {/* Essential */}
                            <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex-1 pr-4">
                                    <h5 className="text-white font-bold mb-1">{s.essentialTitle}</h5>
                                    <p className="text-gray-400 text-sm">{s.essentialDesc}</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-not-allowed">
                                    <div className="w-12 h-6 bg-brand-accent/50 rounded-full"></div>
                                    <div className="absolute right-1 w-4 h-4 bg-white rounded-full"></div>
                                </div>
                            </div>

                            {/* Analytics */}
                            <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex-1 pr-4">
                                    <h5 className="text-white font-bold mb-1">{s.analyticsTitle}</h5>
                                    <p className="text-gray-400 text-sm">{s.analyticsDesc}</p>
                                </div>
                                <button
                                    onClick={() => setPrefs({ ...prefs, analytics: !prefs.analytics })}
                                    className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors ${prefs.analytics ? 'bg-brand-accent' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${prefs.analytics ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            {/* Marketing */}
                            <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex-1 pr-4">
                                    <h5 className="text-white font-bold mb-1">{s.marketingTitle}</h5>
                                    <p className="text-gray-400 text-sm">{s.marketingDesc}</p>
                                </div>
                                <button
                                    onClick={() => setPrefs({ ...prefs, marketing: !prefs.marketing })}
                                    className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors ${prefs.marketing ? 'bg-brand-accent' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${prefs.marketing ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-4">
                            <button
                                onClick={handleRejectAll}
                                className="px-6 py-2 text-sm font-bold text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                {s.rejectAll}
                            </button>
                            <button
                                onClick={() => saveConsent(prefs)}
                                className="px-8 py-2 text-sm font-bold text-brand-primary bg-brand-accent hover:bg-brand-accent-light rounded-lg transition-all"
                            >
                                {s.save}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pulsante per riaprire (Global cookie settings trigger) */}
            <button
                id="cookie-settings-trigger"
                onClick={() => setShowPreferences(true)}
                className="hidden" // Will be triggered programmatically or via footer
            >
                Cookies
            </button>
        </>
    );
};
