import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { User } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RequestAccessModal } from './components/RequestAccessModal';
import { LoginModal } from './components/LoginModal';
import { HelpModal } from './components/HelpModal';
import { GlobalBackground } from './components/GlobalBackground';
import { api } from './services/api';
import { LanguageProvider } from './contexts/LanguageContext';

function AppContent() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
    const [requestAccessInitialPlan, setRequestAccessInitialPlan] = useState<string>('Mensile');
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [helpInitialSection, setHelpInitialSection] = useState<string | undefined>(undefined);
    const isUnlimited = user?.isPro || user?.isAdmin;
    const location = useLocation();

    // Fix scroll on route change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    useEffect(() => {
        // --- EMERGENCY RECOVERY v1.30 ---
        const FORCED_CLEANUP_VERSION = '1.30';
        const lastCleanup = localStorage.getItem('sonificart_recovery_v');
        const savedToken = localStorage.getItem('sonificart_auth_token');

        if (lastCleanup !== FORCED_CLEANUP_VERSION) {
            console.warn("Emergency Recovery: Forza pulizia sessione per aggiornamento protocollo v1.30...");
            localStorage.removeItem('sonificart_auth_token');
            localStorage.setItem('sonificart_recovery_v', FORCED_CLEANUP_VERSION);
            // Nuclear option: reload to ensure ALL components restart with empty state
            window.location.reload();
            return;
        } else if (savedToken && (
            savedToken === 'user-user-1' ||
            savedToken === 'undefined' ||
            savedToken === 'null' ||
            savedToken === 'user_undefined' ||
            savedToken === 'user_null'
        )) {
            console.warn("Emergency Wash: Identificato token corrotto, pulizia in corso...", savedToken);
            localStorage.removeItem('sonificart_auth_token');
            window.location.reload();
            return;
        }
        // -------------------------------

        const checkUser = async () => {
            const token = localStorage.getItem('sonificart_auth_token');
            if (!token) {
                setUser(null);
                return;
            }
            try {
                const currentUser = await api.checkSession();
                if (currentUser) setUser(currentUser); else setUser(null);
            } catch (error) {
                console.error("Auth check failed:", error);
                await api.logout();
                setUser(null);
            }
        };
        checkUser();
    }, []);

    const openRequestAccess = (plan: string = 'Mensile') => {
        setRequestAccessInitialPlan(plan);
        setIsRequestAccessOpen(true);
    };

    const contextValue = {
        user,
        setUser, // Exposed for LoginModal
        isUnlimited,
        setIsLoginModalOpen,
        setIsRequestAccessOpen,
        openRequestAccess, // NEW
        setIsHelpModalOpen,
        setHelpInitialSection
    };

    return (
        <div className="min-h-screen flex flex-col bg-transparent text-brand-text-primary font-sans antialiased selection:bg-brand-accent selection:text-white overflow-x-hidden">
            <GlobalBackground />
            <Navbar
                isLoggedIn={!!user}
                isAdmin={user?.isAdmin}
                userCredits={user?.credits}
                isProUser={isUnlimited}
                onLogin={() => setIsLoginModalOpen(true)}
                onLogout={async () => { await api.logout(); setUser(null); }}
                onGoProClick={() => openRequestAccess('Mensile')}
                onOpenHelp={() => { setHelpInitialSection(undefined); setIsHelpModalOpen(true); }}
            />
            <main className="flex-grow w-full relative z-10">
                {location.pathname === '/' ? (
                    <Outlet context={contextValue} />
                ) : (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 animate-fade-in">
                        <Outlet context={contextValue} />
                    </div>
                )}
            </main>
            <Footer />
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={(u) => { setUser(u); setIsLoginModalOpen(false); }} />
            <RequestAccessModal isOpen={isRequestAccessOpen} onClose={() => setIsRequestAccessOpen(false)} userEmail={user?.email} initialPlan={requestAccessInitialPlan} />
            <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} initialSection={helpInitialSection} />
        </div>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}