import React, { useEffect, useState, useRef } from 'react';

interface GoogleTranslateProps {
    className?: string;
}

declare global {
    interface Window {
        google: any;
        googleTranslateElementInit: () => void;
    }
}

const LANGUAGES = [
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', label: 'Português', flag: '🇵🇹' },
    { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export const GoogleTranslate: React.FC<GoogleTranslateProps> = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentLang, setCurrentLang] = useState('it');
    const [isLoaded, setIsLoaded] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize from cookie if exists
        const match = document.cookie.match(/googtrans=\/it\/(\w+)/);
        const cookieLang = match && match[1] ? match[1] : 'it';
        setCurrentLang(cookieLang);

        // If not Italian, load immediately
        if (cookieLang !== 'it') {
            loadGoogleTranslate();
        }
    }, []);

    const loadGoogleTranslate = () => {
        if (document.getElementById('google-translate-script')) {
            setIsLoaded(true);
            return;
        }

        // Create hidden container
        if (!document.getElementById('google_translate_element')) {
            const container = document.createElement('div');
            container.id = 'google_translate_element';
            container.style.display = 'none';
            document.body.appendChild(container);
        }

        // Initialize callback
        window.googleTranslateElementInit = () => {
            new window.google.translate.TranslateElement(
                {
                    pageLanguage: 'it',
                    includedLanguages: LANGUAGES.map(l => l.code).join(','),
                    autoDisplay: false,
                    multilanguagePage: true,
                },
                'google_translate_element'
            );
            setIsLoaded(true);
        };

        // Load script
        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        document.body.appendChild(script);

        // Hide banner styles
        if (!document.getElementById('google-translate-styles')) {
            const style = document.createElement('style');
            style.id = 'google-translate-styles';
            style.innerHTML = `
                .goog-te-banner-frame, .skiptranslate, #goog-gt-tt, .goog-te-balloon-frame, .goog-te-gadget {
                    display: none !important;
                }
                body { top: 0 !important; }
                .goog-text-highlight { background: none !important; box-shadow: none !important; }
            `;
            document.head.appendChild(style);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = async (langCode: string) => {
        const domain = window.location.hostname;

        // Update state and cookie
        setCurrentLang(langCode);
        setIsOpen(false);

        // Set cookie
        document.cookie = `googtrans=/it/${langCode}; path=/; domain=${domain}`;
        document.cookie = `googtrans=/it/${langCode}; path=/`;

        if (langCode === 'it') {
            // If switching back to Italian, clear cookie and reload to clear Google's DOM modifications
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
            window.location.reload();
            return;
        }

        // If changing to other language, ensure script is loaded
        if (!isLoaded) {
            loadGoogleTranslate();
            // Wait a bit for script to load and initialize
            let retries = 0;
            const checkAndTrigger = setInterval(() => {
                const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
                if (select) {
                    select.value = langCode;
                    select.dispatchEvent(new Event('change'));
                    clearInterval(checkAndTrigger);
                }
                if (++retries > 20) { // 2 seconds timeout
                    clearInterval(checkAndTrigger);
                    window.location.reload();
                }
            }, 100);
        } else {
            const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
            if (select) {
                select.value = langCode;
                select.dispatchEvent(new Event('change'));
            } else {
                window.location.reload();
            }
        }
    };

    const currentLangData = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    return (
        <div className={`relative ${className || ''}`} ref={dropdownRef}>
            {/* Trigger Button - Styled to match app design */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-xs font-bold text-white/70 hover:text-white uppercase flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all hover:bg-white/10"
                title="Cambia lingua / Change language"
            >
                <span className="text-base">{currentLangData.flag}</span>
                <span className="hidden sm:inline font-mono notranslate">{currentLang.toUpperCase()}</span>
                <i className={`fas fa-chevron-down text-[8px] transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

                    {/* Menu */}
                    <div className="absolute top-full right-0 mt-2 w-44 bg-[#1e293b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                        <div className="px-3 py-2 border-b border-white/10">
                            <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                                <i className="fab fa-google mr-1.5"></i>Translate
                            </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-3 ${currentLang === lang.code
                                        ? 'text-brand-accent bg-brand-accent/10'
                                        : 'text-white/80'
                                        }`}
                                >
                                    <span className="text-lg">{lang.flag}</span>
                                    <span className="flex-1">{lang.label}</span>
                                    {currentLang === lang.code && (
                                        <i className="fas fa-check text-brand-accent text-[10px]"></i>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="px-3 py-2 border-t border-white/10 bg-white/5">
                            <span className="text-[9px] text-white/30">
                                Powered by Google Translate
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
