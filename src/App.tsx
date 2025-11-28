import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ConfigPanel } from './components/ConfigPanel';
import { ProcessingView } from './components/ProcessingView';
import { ResultsDashboard } from './components/ResultsDashboard';
import { SonificationResult, ConfigSettings, ProcessingStep, Paradigm, ScanPatternOverride, User } from './types';
import { sonifyImage, sonifyImageArtistic, sonifyImageHybrid } from './services/sonificationService';
import { ParadigmToggle } from './components/ParadigmToggle';
import { ImagePreview } from './components/ImagePreview';
import { VerificationPortal } from './components/VerificationPortal';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RequestAccessModal } from './components/RequestAccessModal';
import { UserDashboard } from './components/UserDashboard';
import { LoginModal } from './components/LoginModal';
import { ShowcaseView } from './components/ShowcaseView';
import { AdminPanel } from './components/AdminPanel';
import { LandingPage } from './components/LandingPage';
import { PublicProfile } from './components/PublicProfile';
import { HelpModal } from './components/HelpModal';
import { GlobalBackground } from './components/GlobalBackground';
import { ParadigmInfo } from './components/ParadigmInfo';
import { api } from './services/api';
import OSC from 'osc-js';

// Steps definitions
const scientificSteps: ProcessingStep[] = [
    { id: 1, name: 'Image Standardization', status: 'pending' },
    { id: 2, name: 'Hash Calculation (SHA-256)', status: 'pending' },
    { id: 3, name: 'Block Analysis', status: 'pending' },
    { id: 4, name: 'Universal Mapping', status: 'pending' },
    { id: 5, name: 'Cultural Selection', status: 'pending' },
    { id: 6, name: 'Cultural Transformation', status: 'pending' },
    { id: 7, name: 'Audio Synthesis & Export', status: 'pending' },
];

const artisticSteps: ProcessingStep[] = [
    { id: 1, name: 'Generazione Prompt (Traduzione Cieca)', status: 'pending' },
    { id: 2, name: 'Image Standardization', status: 'pending' },
    { id: 3, name: 'Hash Calculation (SHA-256)', status: 'pending' },
    { id: 4, name: 'Block Analysis', status: 'pending' },
    { id: 5, name: 'Universal Mapping', status: 'pending' },
    { id: 6, name: 'Cultural Selection', status: 'pending' },
    { id: 7, name: 'Audio Synthesis & Export', status: 'pending' },
];

const hybridSteps: ProcessingStep[] = [
    { id: 1, name: 'Analisi Contesto Immagine (AI)', status: 'pending' },
    { id: 2, name: 'Generazione Prompt (Fusione Creativa)', status: 'pending' },
    { id: 3, name: 'Image Standardization', status: 'pending' },
    { id: 4, name: 'Hash Calculation (SHA-256)', status: 'pending' },
    { id: 5, name: 'Block Analysis', status: 'pending' },
    { id: 6, name: 'Universal Mapping', status: 'pending' },
    { id: 7, name: 'Cultural Selection', status: 'pending' },
    { id: 8, name: 'Audio Synthesis & Export', status: 'pending' },
];

const initialSettings: ConfigSettings = {
    pixelCount: 1024,
    bpm: 120,
    noteDurationSeconds: 0.125,
    osc: {
        enabled: false,
        host: '127.0.0.1',
        port: 9129,
    },
    enableAccompaniment: false,
    melodyInstrument: 'sine',
    accompanimentInstrument: 'triangle',
};

export type ViewType = 'landing' | 'sonification' | 'verification' | 'dashboard' | 'showcase' | 'admin' | 'profile';

export default function App() {
    const [view, setView] = useState<ViewType>('landing');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [config, setConfig] = useState<ConfigSettings>(initialSettings);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(scientificSteps);
    const [result, setResult] = useState<SonificationResult | null>(null);
    const [paradigm, setParadigm] = useState<Paradigm>('scientific');
    const [scanPatternOverride, setScanPatternOverride] = useState<ScanPatternOverride>('auto');

    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [helpInitialSection, setHelpInitialSection] = useState<string | undefined>(undefined);

    // OSC State
    const [oscClient, setOscClient] = useState<OSC | null>(null);
    const [oscStatus, setOscStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [oscError, setOscError] = useState<string | null>(null);

    // Helper: Is Unlimited?
    const isUnlimited = user?.isPro || user?.isAdmin;

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await api.checkSession();
                if (currentUser) {
                    setUser(currentUser);
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error("Session check failed:", error);
                await api.logout();
                setUser(null);
                if (window.location.pathname !== '/') {
                    setView('landing');
                }
            }
        };
        checkUser();
    }, []);

    const resetEditorState = useCallback(() => {
        setImageFile(null);
        setImageUrl(null);
        setResult(null);
        setIsProcessing(false);
        setProcessingSteps(scientificSteps);
        setParadigm('scientific');
    }, []);

    const handleFileSelect = (file: File | null) => {
        setImageFile(file);
        if (file) {
            const url = URL.createObjectURL(file);
            setImageUrl(url);
            setResult(null);
        } else {
            setImageUrl(null);
            setResult(null);
        }
    };

    const handleConfigChange = (newConfig: Partial<ConfigSettings>) => {
        setConfig((prev: ConfigSettings) => ({ ...prev, ...newConfig }));
    };

    const handleParadigmChange = (newParadigm: Paradigm) => {
        setParadigm(newParadigm);
        if (newParadigm === 'scientific') setProcessingSteps(scientificSteps);
        else if (newParadigm === 'artistic') setProcessingSteps(artisticSteps);
        else setProcessingSteps(hybridSteps);
    };

    useEffect(() => {
        if (config.osc.enabled && oscStatus === 'disconnected') {
            setOscStatus('connecting');
            setOscError(null);
            const osc = new OSC({ plugin: new OSC.WebsocketClientPlugin({ host: config.osc.host, port: config.osc.port }) });

            osc.on('open', () => setOscStatus('connected'));
            osc.on('error', (err: any) => {
                console.error("OSC Error:", err);
                setOscStatus('error');
                setOscError("Connessione fallita. Controlla che il bridge WebSocket sia attivo.");
            });
            osc.on('close', () => setOscStatus('disconnected'));

            try {
                osc.open();
                setOscClient(osc);
            } catch (e) {
                setOscStatus('error');
            }
        } else if (!config.osc.enabled && oscClient) {
            oscClient.close();
            setOscClient(null);
            setOscStatus('disconnected');
        }

        return () => {
            if (oscClient) oscClient.close();
        };
    }, [config.osc.enabled, config.osc.host, config.osc.port]);


    const startSonification = async () => {
        if (!imageFile) return;

        if (!user) {
            setIsLoginModalOpen(true);
            return;
        }

        const creditCost = isUnlimited ? 0 : (paradigm === 'scientific' ? 1 : 2);

        if (!isUnlimited && user.credits < creditCost) {
            const needed = creditCost;
            alert(`Crediti insufficienti. Questa operazione richiede ${needed} crediti, ma ne hai solo ${user.credits}. Richiedi l'accesso per continuare a creare senza limiti.`);
            setIsRequestAccessOpen(true);
            return;
        }

        try {
            const remainingCredits = await api.consumeCredit(user.id, creditCost);
            setUser((prev: User | null) => prev ? ({ ...prev, credits: remainingCredits }) : null);
        } catch (e: any) {
            if (e.message === 'NO_CREDITS') {
                alert("Hai esaurito i crediti gratuiti. Richiedi l'accesso per continuare a creare.");
                setIsRequestAccessOpen(true);
                return;
            }
            console.error("Error consuming credit:", e);
            return;
        }

        setIsProcessing(true);
        setResult(null);

        const initialSteps = paradigm === 'scientific' ? scientificSteps : paradigm === 'artistic' ? artisticSteps : hybridSteps;
        setProcessingSteps(initialSteps.map(s => ({ ...s, status: 'pending' })));

        const updateProgress = (stepIndex: number, status: 'active' | 'completed') => {
            setProcessingSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status } : s));
        };

        try {
            await new Promise(r => setTimeout(r, 500));

            let res: SonificationResult;
            if (paradigm === 'scientific') {
                res = await sonifyImage(imageFile, config, updateProgress, oscClient, scanPatternOverride);
            } else if (paradigm === 'artistic') {
                res = await sonifyImageArtistic(imageFile, config, updateProgress, oscClient, scanPatternOverride);
            } else {
                res = await sonifyImageHybrid(imageFile, config, updateProgress, oscClient, scanPatternOverride);
            }

            await api.registerArtifact(res, paradigm);

            if (user) {
                await api.saveSonification(res, paradigm);
            }

            setResult(res);
        } catch (error) {
            console.error("Sonification failed:", error);
            alert("Si è verificato un errore durante l'elaborazione. Controlla la console per i dettagli.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-transparent text-brand-text-primary font-sans antialiased selection:bg-brand-accent selection:text-white overflow-x-hidden">
            <GlobalBackground />

            <Navbar
                currentView={view}
                setView={setView}
                isLoggedIn={!!user}
                isAdmin={user?.isAdmin}
                userCredits={user?.credits}
                isProUser={isUnlimited}
                onLogin={() => setIsLoginModalOpen(true)}
                onLogout={async () => {
                    await api.logout();
                    setUser(null);
                    resetEditorState();
                    setView('landing');
                }}
                onGoProClick={() => setIsRequestAccessOpen(true)}
                onOpenHelp={() => {
                    setHelpInitialSection(undefined);
                    setIsHelpModalOpen(true);
                }}
            />

            <main className="flex-grow w-full relative z-10">

                {view === 'landing' && (
                    <LandingPage
                        onGetStarted={() => {
                            if (user) {
                                setView('sonification');
                            } else {
                                setIsLoginModalOpen(true);
                            }
                        }}
                        onExplore={() => setView('showcase')}
                        onOpenPricing={() => setIsRequestAccessOpen(true)}
                        onOpenDocs={(section: string | undefined) => {
                            setHelpInitialSection(section);
                            setIsHelpModalOpen(true);
                        }}
                    />
                )}

                {view !== 'landing' && (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 animate-fade-in">
                        {view === 'verification' && (
                            <VerificationPortal
                                user={user}
                                onLogin={() => setIsLoginModalOpen(true)}
                            />
                        )}

                        {view === 'showcase' && <ShowcaseView />}

                        {view === 'admin' && user?.isAdmin && <AdminPanel />}

                        {view === 'profile' && user && <PublicProfile user={user} />}

                        {view === 'dashboard' && user && <UserDashboard />}

                        {view === 'sonification' && (
                            <div className="max-w-7xl mx-auto">
                                {!result && !isProcessing && (
                                    <div className="animate-fade-in">
                                        <div className="mb-8 pl-6 py-2 border-l-4 border-brand-accent">
                                            <h2 className="text-4xl font-display font-bold text-white mb-2">Studio di Sonificazione</h2>
                                            <p className="text-brand-text-secondary font-light max-w-2xl">
                                                Benvenuto nel laboratorio. Seleziona il paradigma di traduzione (la "lente" con cui analizzare l'opera) e carica la tua immagine.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                                            <div className="lg:col-span-7 transition-all duration-500 flex flex-col gap-6">
                                                <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl">

                                                    <div className="mb-6">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-brand-accent text-black flex items-center justify-center text-xs font-bold">1</div>
                                                            Seleziona Paradigma (Lente Interpretativa)
                                                        </h3>
                                                        <ParadigmToggle
                                                            selectedParadigm={paradigm}
                                                            onParadigmChange={handleParadigmChange}
                                                            isPro={isUnlimited}
                                                        />
                                                    </div>

                                                    <div className="border-t border-white/10 pt-6">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">2</div>
                                                            Input Visivo (Sorgente)
                                                        </h3>
                                                        <ImageUploader onFileSelect={handleFileSelect} hasFile={!!imageFile} />
                                                    </div>

                                                    {imageFile && imageUrl && (
                                                        <div className="mt-6 border-t border-white/10 pt-6">
                                                            <ImagePreview file={imageFile} imageUrl={imageUrl} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="lg:col-span-5 animate-fade-in-up h-full">
                                                {imageFile ? (
                                                    <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl h-full">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">3</div>
                                                            Parametri Algoritmo

                                                            {/* --- MODIFICA QUI: Nascondi se Pro/Admin --- */}
                                                            {!isUnlimited && (
                                                                <span className="ml-auto text-xs bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded">
                                                                    Costo: {paradigm === 'scientific' ? '1 CR' : '2 CR'}
                                                                </span>
                                                            )}
                                                            {isUnlimited && (
                                                                <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                                    <i className="fas fa-infinity"></i> Licenza Attiva
                                                                </span>
                                                            )}
                                                            {/* ------------------------------------------- */}

                                                        </h3>
                                                        <ConfigPanel
                                                            config={config}
                                                            onConfigChange={handleConfigChange}
                                                            onStartProcessing={startSonification}
                                                            paradigm={paradigm}
                                                            oscStatus={oscStatus}
                                                            oscError={oscError}
                                                            scanPatternOverride={scanPatternOverride}
                                                            onScanPatternOverrideChange={setScanPatternOverride}
                                                            onGoProClick={() => setIsRequestAccessOpen(true)}
                                                            isProUser={!!isUnlimited}
                                                        />
                                                    </div>
                                                ) : (
                                                    <ParadigmInfo
                                                        paradigm={paradigm}
                                                        onGoPro={() => setIsRequestAccessOpen(true)}
                                                        isProUser={!!isUnlimited}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isProcessing && (
                                    <div className="max-w-3xl mx-auto">
                                        <ProcessingView steps={processingSteps} imageUrl={imageUrl} />
                                    </div>
                                )}

                                {result && imageUrl && (
                                    <div className="max-w-7xl mx-auto">
                                        <ResultsDashboard
                                            result={result}
                                            imageUrl={imageUrl}
                                            onReset={() => { setResult(null); setImageFile(null); setImageUrl(null); }}
                                            user={user}
                                            onRequestAccess={() => setIsRequestAccessOpen(true)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            <Footer />

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onLoginSuccess={(loggedInUser: User) => {
                    resetEditorState();
                    setUser(loggedInUser);
                    setIsLoginModalOpen(false);
                    if (view === 'landing') setView('sonification');
                }}
            />

            <RequestAccessModal
                isOpen={isRequestAccessOpen}
                onClose={() => setIsRequestAccessOpen(false)}
                userEmail={user?.email}
            />

            <HelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                initialSection={helpInitialSection}
            />

        </div>
    );
}