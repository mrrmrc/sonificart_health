import React, { useState } from 'react';
import { Logo } from './Logo';
import { GoogleTranslate } from './GoogleTranslate';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavbarProps {
    isLoggedIn: boolean;
    isAdmin?: boolean;
    userCredits?: number;
    isProUser?: boolean;
    onLogin: () => void;
    onLogout: () => void;
    onGoProClick: () => void;
    onOpenHelp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, isAdmin, userCredits, isProUser, onLogin, onLogout, onGoProClick, onOpenHelp }) => {
    const { t } = useLanguage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Helper per determinare la vista corrente dal path
    const currentView = location.pathname === '/' ? 'landing' : location.pathname.substring(1);

    const navLinkClass = (view: string) => `
        relative cursor-pointer px-3 py-2 text-sm font-bold tracking-wide uppercase transition-all duration-300 group
        ${currentView === view
            ? 'text-white'
            : 'text-white/70 hover:text-white'}
    `;

    const ActiveIndicator = ({ isActive }: { isActive: boolean }) => (
        <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-brand-accent transition-all duration-300 shadow-[0_0_10px_rgba(45,212,191,0.8)] ${isActive ? 'w-full opacity-100' : 'w-0 opacity-0 group-hover:w-2/3 group-hover:opacity-50'}`}></span>
    );

    return (
        <nav className="fixed w-full z-50 top-0 left-0 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl transition-all duration-300 shadow-2xl">
            <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">

                {/* --- LEFT: BRANDING --- */}
                <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => navigate('/')}>
                    <Logo className="w-10 h-10 relative z-10 transition-transform duration-700 ease-out group-hover:rotate-[360deg] filter drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
                    <div className="flex flex-col justify-center">
                        <div className="flex items-baseline gap-2">
                            <span className="font-display font-black text-xl tracking-tight text-white leading-none group-hover:text-brand-accent transition-colors">
                                Sonific<span className="text-brand-accent">A.R.T.</span>
                            </span>
                            <span className="text-[10px] font-mono text-brand-text-secondary/70 border border-white/10 px-1.5 rounded bg-white/5 hidden md:block">
                                v1.19
                            </span>
                        </div>
                        <span className="text-[8px] uppercase tracking-[0.2em] text-brand-text-secondary hidden sm:block group-hover:text-white transition-colors">
                            Framework Deterministico
                        </span>
                    </div>
                </div>

                {/* --- CENTER: MAIN NAVIGATION --- */}
                <div className="hidden lg:flex items-center justify-center gap-8">
                    <button onClick={() => navigate('/')} className={`${navLinkClass('landing')} notranslate`}>
                        Home
                        <ActiveIndicator isActive={currentView === 'landing'} />
                    </button>

                    <button onClick={() => navigate('/cam')} className={`${navLinkClass('cam')} text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-extrabold`}>
                        <i className="fas fa-video text-xs text-cyan-400 animate-pulse"></i>
                        CAM
                        <ActiveIndicator isActive={currentView === 'cam'} />
                    </button>

                    <button onClick={onGoProClick} className={`${navLinkClass('landing')} text-brand-accent hover:text-brand-accent-light flex items-center gap-2`}>
                        {t('nav.access')}
                        <ActiveIndicator isActive={false} />
                    </button>

                    {isLoggedIn ? (
                        <>
                            <button onClick={() => navigate('/sonification')} className={navLinkClass('sonification')}>
                                {t('nav.sonify')}
                                <ActiveIndicator isActive={currentView === 'sonification'} />
                            </button>
                            <button onClick={() => navigate(isLoggedIn ? '/profile' : '/showcase')} className={navLinkClass(isLoggedIn ? 'profile' : 'showcase')}>
                                {t('nav.showcase')}
                                <ActiveIndicator isActive={currentView === (isLoggedIn ? 'profile' : 'showcase')} />
                            </button>
                            <button onClick={() => navigate('/verification')} className={navLinkClass('verification')}>
                                {t('nav.verify')}
                                <ActiveIndicator isActive={currentView === 'verification'} />
                            </button>
                            <button onClick={() => navigate('/compare')} className={`${navLinkClass('compare')} whitespace-nowrap`}>
                                COMPARA
                                <ActiveIndicator isActive={currentView === 'compare'} />
                            </button>
                            <button onClick={() => navigate('/dashboard')} className={navLinkClass('dashboard')}>
                                {t('nav.dashboard')}
                                <ActiveIndicator isActive={currentView === 'dashboard'} />
                            </button>
                            {isAdmin && (
                                <button onClick={() => navigate('/admin')} className={`${navLinkClass('admin')} text-red-400 hover:text-red-300`}>
                                    {t('nav.admin')}
                                    <ActiveIndicator isActive={currentView === 'admin'} />
                                </button>
                            )}
                        </>
                    ) : (
                        <button onClick={() => navigate('/showcase')} className={navLinkClass('showcase')}>
                            {t('nav.showcase')}
                            <ActiveIndicator isActive={currentView === 'showcase'} />
                        </button>
                    )}
                </div>

                {/* --- RIGHT: ACTIONS --- */}
                <div className="flex items-center gap-4 shrink-0">

                    <button onClick={onOpenHelp} className="hidden md:block text-white/70 hover:text-brand-accent transition-colors" title="Guida Framework">
                        <i className="fas fa-book-open text-lg"></i>
                    </button>

                    {/* Google Translate - Integrato */}
                    <GoogleTranslate />

                    <div className="h-6 w-px bg-white/20 mx-2 hidden sm:block"></div>

                    {!isLoggedIn ? (
                        <button
                            onClick={onLogin}
                            className="hidden sm:block bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full border border-white/20 transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        >
                            {t('nav.login')}
                        </button>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div
                                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md ${isProUser ? 'bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' :
                                    (userCredits && userCredits > 0) ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
                                    }`}
                                title={(isProUser && userCredits && userCredits > 5000) ? "Crediti Illimitati" : `Crediti rimanenti: ${userCredits}`}
                            >
                                <i className={`fas ${isProUser && (!userCredits || userCredits > 5000) ? 'fa-infinity' : 'fa-coins'} ${isProUser ? 'text-yellow-400' : 'text-white'} text-xs`}></i>
                                <span className="text-xs font-bold font-mono text-white">
                                    {(isProUser && (!userCredits || userCredits > 5000)) ? 'PRO' :
                                        (isProUser ? `${userCredits}` : userCredits)}
                                </span>
                            </div>

                            <button
                                onClick={() => navigate('/profile')}
                                className="hidden sm:flex w-9 h-9 rounded-full bg-gradient-to-br from-brand-accent to-purple-600 items-center justify-center text-white shadow-lg hover:scale-110 transition-transform border border-white/20"
                            >
                                <i className="fas fa-user text-xs"></i>
                            </button>
                            <button onClick={onLogout} className="hidden sm:block text-white/60 hover:text-red-400 transition-colors text-lg ml-2">
                                <i className="fas fa-sign-out-alt"></i>
                            </button>
                        </div>
                    )}

                    <button
                        className="lg:hidden ml-2 text-white focus:outline-none"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden bg-[#0f172a] border-b border-white/10 animate-fade-in shadow-2xl absolute w-full left-0 top-20 z-50">
                    <div className="p-4 space-y-2">
                        <button onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg notranslate">
                            Home
                        </button>
                        <button onClick={() => { navigate('/cam'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-cyan-400 font-bold bg-white/5 rounded-lg border border-cyan-500/30 flex items-center gap-2">
                            <i className="fas fa-video text-cyan-400 animate-pulse"></i> CAM (Real-Time Opera & WHO)
                        </button>
                        <button onClick={() => { onGoProClick(); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-brand-accent font-bold bg-white/5 rounded-lg border border-brand-accent/20">
                            {t('nav.access')}
                        </button>
                        <button onClick={() => { navigate('/showcase'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                            <i className="fas fa-th-large mr-3 w-5 text-center text-gray-400"></i> {t('nav.showcase')}
                        </button>
                        <button onClick={() => { onOpenHelp(); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                            <i className="fas fa-book-open mr-3 w-5 text-center text-gray-400"></i> {t('help.title')}
                        </button>
                        {isLoggedIn && (
                            <>
                                <button onClick={() => { navigate('/sonification'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                                    <i className="fas fa-plus-circle mr-3 w-5 text-center text-gray-400"></i> {t('nav.sonify')}
                                </button>
                                <button onClick={() => { navigate('/verification'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                                    <i className="fas fa-shield-alt mr-3 w-5 text-center text-gray-400"></i> {t('nav.verify')}
                                </button>
                                <button onClick={() => { navigate('/dashboard'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                                    <i className="fas fa-folder-open mr-3 w-5 text-center text-gray-400"></i> {t('nav.dashboard')}
                                </button>
                                <button onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-white font-bold hover:bg-white/5 rounded-lg">
                                    <i className="fas fa-user mr-3 w-5 text-center text-gray-400"></i> {t('nav.profile') || 'Profilo'}
                                </button>
                                {isAdmin && (
                                    <button onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-400 font-bold hover:bg-white/5 rounded-lg border border-red-500/20">
                                        <i className="fas fa-user-shield mr-3 w-5 text-center"></i> {t('nav.admin')}
                                    </button>
                                )}
                                <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                                    <i className="fas fa-coins text-brand-accent"></i>
                                    Crediti: <span className="text-white font-mono">{isProUser ? 'Infiniti' : userCredits}</span>
                                </div>
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-400 font-bold hover:bg-white/5 rounded-lg">Logout</button>
                            </>
                        )}
                        {!isLoggedIn && (
                            <button onClick={() => { onLogin(); setIsMobileMenuOpen(false); }} className="w-full text-center mt-4 bg-brand-accent text-brand-primary font-bold py-3 rounded-lg shadow-lg">
                                {t('nav.login')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};