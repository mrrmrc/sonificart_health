import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ConfigPanel } from './components/ConfigPanel';
import { ProcessingView } from './components/ProcessingView';
import { ResultsDashboard } from './components/ResultsDashboard';
import { SonificationResult, ConfigSettings, ProcessingStep, Paradigm, ScanPatternOverride, User, DashboardEntry } from './types';
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

const artisticSteps = scientificSteps;
const hybridSteps = scientificSteps;

const initialSettings: ConfigSettings = {
    pixelCount: 1024,
    bpm: 120,
    noteDurationSeconds: 0.125,
    osc: { enabled: false, host: '127.0.0.1', port: 9129 },
    enableAccompaniment: false, melodyInstrument: 'sine', accompanimentInstrument: 'triangle',
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
    const [user, setUser] = useState<User | null>(null);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [helpInitialSection, setHelpInitialSection] = useState<string | undefined>(undefined);
    const [oscClient, setOscClient] = useState<OSC | null>(null);
    const [oscStatus, setOscStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [oscError, setOscError] = useState<string | null>(null);

    // NUOVO: Flag per sapere se siamo in modalità "Visualizza Storia"
    const [isViewingHistory, setIsViewingHistory] = useState(false);

    const isUnlimited = user?.isPro || user?.isAdmin;

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await api.checkSession();
                if (currentUser) setUser(currentUser); else setUser(null);
            } catch (error) { await api.logout(); setUser(null); if (window.location.pathname !== '/') setView('landing'); }
        };
        checkUser();
    }, []);

    const resetEditorState = useCallback(() => {
        setImageFile(null); setImageUrl(null); setResult(null); setIsProcessing(false); setProcessingSteps(scientificSteps); setParadigm('scientific');
        setIsViewingHistory(false);
    }, []);

    const handleFileSelect = (file: File | null) => {
        setImageFile(file);
        if (file) { const url = URL.createObjectURL(file); setImageUrl(url); setResult(null); }
        else { setImageUrl(null); setResult(null); }
    };

    const handleConfigChange = (newConfig: Partial<ConfigSettings>) => setConfig(prev => ({ ...prev, ...newConfig }));
    const handleParadigmChange = (newParadigm: Paradigm) => setParadigm(newParadigm);

    // --- NUOVA FUNZIONE: CARICA DALLA STORIA ---
    const handleLoadHistoryItem = (entry: DashboardEntry) => {
        const fixImg = (url: string) => {
            if (url.startsWith('data:') || url.startsWith('http')) return url;
            return `data:image/jpeg;base64,${url}`;
        };

        // Ricostruiamo un risultato "finto" ma visualizzabile
        const reconstructedResult: SonificationResult = {
            imageHash: entry.id,
            audioHash: "ARCHIVED",
            standardizedImageUrl: fixImg(entry.imageUrl),
            paradigm: entry.paradigm,
            scanPattern: { name: "Archivio Storico", sequence: [] },
            configUsed: config,
            blockAnalysisResult: { blocks: [], gridSize: 32, totalPixelsAnalyzed: 0, coveragePercentage: 100, analysisMethod: "", blockSize: 0, globalStats: { avg_L: 50, avg_a: 0, avg_b: 0, avg_saturation: 0.5, hue_diversity: 0.5, avg_variance: 0 } },
            culturalSelectionResult: {
                tradition: { id: 'archived', name: entry.traditionName || "Sconosciuta", region: "Global", description: "Dati storici", intervals: [], baseFrequency: 440, cultural_family: "Archivio", character: "Archived", scale_cents: [], profile: { color_temp: 0, saturation: 0, hue_diversity: 0 } },
                scoreBreakdown: { total: 1, colorTemperature: 0, saturation: 0, hueDiversity: 0 }
            },
            audioOutput: {
                // USIAMO L'URL AUDIO DEL SERVER
                audioUrl: entry.audioUrl || "",
                audioWavBlob: new Blob(),
                midiBlob: new Blob(),
                duration: 0,
                events: [], eventsCount: 0, bpm: 120
            },
            performanceMetrics: { totalProcessingTime: 0 },
            validationResult: { determinism: { passed: true, message: "Archivio" }, coverage: { passed: true, message: "Archivio" }, robustness: { passed: true, message: "Archivio" }, grid: { passed: true, message: "Archivio" } },
            validationHashes: { imageBlobHash: "", audioBlobHash: "", midiBlobHash: "" },
            sacContainer: { blob: new Blob(), fileName: "" }
        };

        setResult(reconstructedResult);
        setImageUrl(reconstructedResult.standardizedImageUrl);
        setIsViewingHistory(true);
        setView('sonification');
        window.scrollTo(0, 0);
    };

    // ... (OSC logic omitted for brevity, keep existing) ...

    const startSonification = async () => {
        if (!imageFile || !user) { setIsLoginModalOpen(true); return; }
        // ... (Credit logic omitted, keep existing) ...

        setIsProcessing(true);
        setResult(null);
        setIsViewingHistory(false); // Reset history mode

        try {
            await new Promise(r => setTimeout(r, 500));
            let res: SonificationResult;
            if (paradigm === 'scientific') res = await sonifyImage(imageFile, config, () => { }, oscClient, scanPatternOverride);
            else if (paradigm === 'artistic') res = await sonifyImageArtistic(imageFile, config, () => { }, oscClient, scanPatternOverride);
            else res = await sonifyImageHybrid(imageFile, config, () => { }, oscClient, scanPatternOverride);

            if (user) await api.saveSonification(res, paradigm);
            setResult(res);
        } catch (error) { console.error(error); alert("Errore elaborazione"); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="min-h-screen flex flex-col bg-transparent text-brand-text-primary font-sans antialiased selection:bg-brand-accent selection:text-white overflow-x-hidden">
            <GlobalBackground />
            <Navbar currentView={view} setView={setView} isLoggedIn={!!user} isAdmin={user?.isAdmin} userCredits={user?.credits} isProUser={isUnlimited} onLogin={() => setIsLoginModalOpen(true)} onLogout={async () => { await api.logout(); setUser(null); resetEditorState(); setView('landing'); }} onGoProClick={() => setIsRequestAccessOpen(true)} onOpenHelp={() => { setHelpInitialSection(undefined); setIsHelpModalOpen(true); }} />

            <main className="flex-grow w-full relative z-10">
                {view === 'landing' && <LandingPage onGetStarted={() => { if (user) setView('sonification'); else setIsLoginModalOpen(true); }} onExplore={() => setView('showcase')} onOpenPricing={() => setIsRequestAccessOpen(true)} onOpenDocs={(section) => { setHelpInitialSection(section); setIsHelpModalOpen(true); }} />}

                {view !== 'landing' && (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 animate-fade-in">
                        {view === 'verification' && <VerificationPortal user={user} onLogin={() => setIsLoginModalOpen(true)} />}
                        {view === 'showcase' && <ShowcaseView />}
                        {view === 'admin' && user?.isAdmin && <AdminPanel />}
                        {view === 'profile' && user && <PublicProfile user={user} />}

                        {/* QUI PASSIAMO LA FUNZIONE ALLA DASHBOARD */}
                        {view === 'dashboard' && user && (
                            <UserDashboard onLoadEntry={handleLoadHistoryItem} />
                        )}

                        {view === 'sonification' && (
                            <div className="max-w-7xl mx-auto">
                                {!result && !isProcessing && (
                                    <div className="animate-fade-in">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                            <div className="lg:col-span-7 transition-all duration-500 flex flex-col gap-6">
                                                <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl">
                                                    <div className="mb-6">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-brand-accent text-black flex items-center justify-center text-xs font-bold">1</div>
                                                            Seleziona Paradigma
                                                        </h3>
                                                        <ParadigmToggle selectedParadigm={paradigm} onParadigmChange={handleParadigmChange} isPro={isUnlimited} />
                                                    </div>
                                                    <div className="border-t border-white/10 pt-6">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">2</div>
                                                            Input Visivo
                                                        </h3>
                                                        <ImageUploader onFileSelect={handleFileSelect} hasFile={!!imageFile} />
                                                    </div>
                                                    {imageFile && imageUrl && <div className="mt-6 border-t border-white/10 pt-6"><ImagePreview file={imageFile} imageUrl={imageUrl} /></div>}
                                                </div>
                                            </div>
                                            <div className="lg:col-span-5 animate-fade-in-up h-full">
                                                {imageFile ? (
                                                    <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl h-full">
                                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">3</div>
                                                            Parametri
                                                            {!isUnlimited && <span className="ml-auto text-xs bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded">Costo: {paradigm === 'scientific' ? '1 CR' : '2 CR'}</span>}
                                                            {isUnlimited && <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1"><i className="fas fa-infinity"></i> Licenza Attiva</span>}
                                                        </h3>
                                                        <ConfigPanel config={config} onConfigChange={handleConfigChange} onStartProcessing={startSonification} paradigm={paradigm} oscStatus={oscStatus} oscError={oscError} scanPatternOverride={scanPatternOverride} onScanPatternOverrideChange={setScanPatternOverride} onGoProClick={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} />
                                                    </div>
                                                ) : <ParadigmInfo paradigm={paradigm} onGoPro={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} />}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isProcessing && <div className="max-w-3xl mx-auto"><ProcessingView steps={processingSteps} imageUrl={imageUrl} /></div>}

                                {result && imageUrl && (
                                    <div className="max-w-7xl mx-auto">
                                        <ResultsDashboard
                                            result={result}
                                            imageUrl={imageUrl}
                                            onReset={() => {
                                                setResult(null);
                                                setImageUrl(null);
                                                if (isViewingHistory) {
                                                    setView('dashboard');
                                                    setIsViewingHistory(false);
                                                } else {
                                                    setImageFile(null);
                                                }
                                            }}
                                            onSave={() => { setResult(null); setImageFile(null); setImageUrl(null); setView('dashboard'); }}
                                            user={user}
                                            onRequestAccess={() => setIsRequestAccessOpen(true)}
                                            isHistoryView={isViewingHistory}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
            <Footer />
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={(u) => { resetEditorState(); setUser(u); setIsLoginModalOpen(false); if (view === 'landing') setView('sonification'); }} />
            <RequestAccessModal isOpen={isRequestAccessOpen} onClose={() => setIsRequestAccessOpen(false)} userEmail={user?.email} />
            <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} initialSection={helpInitialSection} />
        </div>
    );
}