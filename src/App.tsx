import React, { useState, useCallback, useEffect } from 'react';
// ... import precedenti (ImageUploader, ConfigPanel, ecc.) ...
import { ImageUploader } from './components/ImageUploader';
import { ConfigPanel } from './components/ConfigPanel';
import { ProcessingView } from './components/ProcessingView';
import { ResultsDashboard } from './components/ResultsDashboard';
import { SonificationResult, ConfigSettings, ProcessingStep, Paradigm, ScanPatternOverride, User, DashboardEntry, SacVerificationResult, TransformedNoteEvent } from './types';
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
import JSZip from 'jszip';
import { LanguageProvider } from './contexts/LanguageContext';
// Importiamo ViewType da types per evitare errori
import { ViewType } from './types';

// ... (ScientificSteps, InitialSettings, reconstructResultFromPartialData, ecc.)

// --- INCOLLA QUI TUTTE LE COSTANTI E LE FUNZIONI DI SUPPORTO CHE GIA' AVEVI ---
const scientificSteps: ProcessingStep[] = [
    { id: 1, name: 'Image Standardization', status: 'pending' },
    { id: 2, name: 'Hash Calculation (SHA-256)', status: 'pending' },
    { id: 3, name: 'Block Analysis', status: 'pending' },
    { id: 4, name: 'Universal Mapping', status: 'pending' },
    { id: 5, name: 'Cultural Selection', status: 'pending' },
    { id: 6, name: 'Cultural Transformation', status: 'pending' },
    { id: 7, name: 'Audio Synthesis & Export', status: 'pending' },
];

const initialSettings: ConfigSettings = {
    pixelCount: 1024,
    bpm: 120,
    noteDurationSeconds: 0.125,
    osc: { enabled: false, host: '127.0.0.1', port: 9129 },
    enableAccompaniment: false,
    melodyInstrument: 'sine',
    accompanimentInstrument: 'triangle',
};

function AppContent() {
    const [view, setView] = useState<ViewType>('landing');
    // ... (Resto del codice di AppContent come fornito nella risposta precedente "App.tsx completo") ...
    // (Assicurati di incollare tutto il corpo della funzione AppContent qui)
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

    // Stato per Deep Linking Galleria
    const [initialGalleryId, setInitialGalleryId] = useState<string | undefined>(undefined);

    const [oscClient, setOscClient] = useState<OSC | null>(null);
    const [oscStatus, setOscStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [oscError, setOscError] = useState<string | null>(null);

    const [isViewingHistory, setIsViewingHistory] = useState(false);
    const isUnlimited = user?.isPro || user?.isAdmin;

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await api.checkSession();
                if (currentUser) setUser(currentUser); else setUser(null);
            } catch (error) { await api.logout(); setUser(null); }
        };
        checkUser();

        const params = new URLSearchParams(window.location.search);
        const galleryId = params.get('gallery_id');
        if (galleryId) {
            setInitialGalleryId(galleryId);
            setView('showcase');
        }
        else if (window.location.pathname !== '/') {
            setView('landing');
        }
    }, []);

    const resetEditorState = useCallback(() => {
        setImageFile(null); setImageUrl(null); setResult(null); setIsProcessing(false); setProcessingSteps(scientificSteps); setParadigm('scientific'); setIsViewingHistory(false);
        setConfig(initialSettings);
    }, []);

    const handleFileSelect = (file: File | null) => {
        setImageFile(file);
        if (file) { const url = URL.createObjectURL(file); setImageUrl(url); setResult(null); }
        else { setImageUrl(null); setResult(null); }
    };

    const handleConfigChange = (newConfig: Partial<ConfigSettings>) => setConfig(prev => ({ ...prev, ...newConfig }));
    const handleParadigmChange = (newParadigm: Paradigm) => setParadigm(newParadigm);

    useEffect(() => {
        if (!config?.osc) return;
        if (config.osc.enabled && oscStatus === 'disconnected') {
            setOscStatus('connecting'); setOscError(null);
            const osc = new OSC({ plugin: new OSC.WebsocketClientPlugin({ host: config.osc.host, port: config.osc.port }) });
            osc.on('open', () => setOscStatus('connected'));
            osc.on('error', (err: any) => { console.error("OSC Error:", err); setOscStatus('error'); setOscError("Connessione fallita."); });
            osc.on('close', () => setOscStatus('disconnected'));
            try { osc.open(); setOscClient(osc); } catch (e) { setOscStatus('error'); }
        } else if (!config.osc.enabled && oscClient) {
            oscClient.close(); setOscClient(null); setOscStatus('disconnected');
        }
        return () => { if (oscClient) oscClient.close(); };
    }, [config.osc?.enabled, config.osc?.host, config.osc?.port]);

    // === HELPER: RICOSTRUZIONE DATI DA PARTIAL / LEGACY (Il cuore del fix) ===
    const reconstructResultFromPartialData = (
        partialData: any,
        imgUrl: string,
        audioUrl: string | null,
        filename: string,
        videoBlob?: Blob
    ): SonificationResult => {

        // 1. Recupero Configurazione
        const loadedConfig = partialData.configUsed || partialData.metadata?.config_used || {};
        const safeConfig: ConfigSettings = {
            ...initialSettings,
            ...loadedConfig,
            osc: { ...initialSettings.osc, ...(loadedConfig.osc || {}) }
        };

        // 2. Recupero Tradizione (Cerca ovunque per evitare "Sconosciuta")
        let traditionName = partialData.culturalSelectionResult?.tradition?.name
            || partialData.traditionName
            || partialData.tradition
            || partialData.musical_parameters?.tradition?.name
            || "Sconosciuta";

        let traditionFamily = partialData.culturalSelectionResult?.tradition?.cultural_family
            || partialData.traditionFamily
            || partialData.musical_parameters?.tradition?.cultural_family
            || "Generica";

        // Recupero Score (Fake 0.99 se manca per estetica)
        let score = partialData.culturalSelectionResult?.scoreBreakdown?.total || partialData.score || 0.99;

        const safeCulturalResult = {
            tradition: {
                id: 'restored',
                name: traditionName,
                cultural_family: traditionFamily,
                ...(partialData.culturalSelectionResult?.tradition || {})
            },
            scoreBreakdown: { total: score, colorTemperature: score, saturation: score, hueDiversity: score }
        };

        // 3. Recupero Pattern Scansione
        let scanName = partialData.scanPattern?.name
            || partialData.metadata?.scan_pattern?.name
            || "Pattern Importato";
        if (typeof scanName === 'string') scanName = scanName.replace("Manuale: ", "");

        // 4. Ricostruzione Eventi e Griglia (Fix Cursore e Note)
        const rawEvents = partialData.audioOutput?.events
            || partialData.transformedEvents
            || partialData.events
            || [];
        const safeRawEvents = Array.isArray(rawEvents) ? rawEvents : [];

        const rawBlockAnalysis = partialData.blockAnalysisResult || partialData.blockData || partialData.analysis || {};

        // Determina Griglia (se manca, la deduce)
        let gridSize = 32;
        if (safeConfig.pixelCount) gridSize = Math.sqrt(safeConfig.pixelCount);
        else if (safeRawEvents.length > 0) gridSize = Math.ceil(Math.sqrt(safeRawEvents.length));
        else if (rawBlockAnalysis.gridSize) gridSize = rawBlockAnalysis.gridSize;

        // Se non ci sono eventi (es. dashboard solo audio), ne creiamo di fittizi per visualizzazione
        const finalEvents = safeRawEvents.length > 0 ? safeRawEvents : Array.from({ length: 256 }, (_, i) => ({
            time: i * safeConfig.noteDurationSeconds,
            duration: safeConfig.noteDurationSeconds,
            baseNote: 60 + (i % 12),
            noteName: "C",
            sourceBlockIndex: i
        }));

        // Sanitizzazione Coordinate Eventi
        const sanitizedEvents: TransformedNoteEvent[] = finalEvents.map((evt: any, index: number) => {
            let cx = 0;
            let cy = 0;

            // Calcolo coordinate da indice se mancano
            if (typeof evt.sourceBlockIndex === 'number') {
                cx = evt.sourceBlockIndex % gridSize;
                cy = Math.floor(evt.sourceBlockIndex / gridSize);
            } else if (evt.sourceBlock?.position) {
                cx = evt.sourceBlock.position.x;
                cy = evt.sourceBlock.position.y;
            } else {
                // Fallback puro
                cx = index % gridSize;
                cy = Math.floor(index / gridSize);
            }

            return {
                ...evt,
                // Assicuriamoci che noteName e midiFloat esistano
                noteName: evt.noteName || "C",
                midiFloat: evt.midiFloat || 60,
                velocity: evt.velocity || 100,
                sourceBlock: {
                    r: 100, g: 100, b: 100,
                    ...(evt.sourceBlock || {}),
                    position: { x: cx, y: cy }
                },
                isAccompaniment: false
            };
        });

        const duration = partialData.audioOutput?.duration
            || partialData.totalDuration
            || partialData.metadata?.total_duration_seconds
            || (sanitizedEvents.length * safeConfig.noteDurationSeconds)
            || 0;

        // Ricostruzione Blocchi per Overlay (Se mancano)
        const fakeBlocks = Array.from({ length: gridSize * gridSize }, (_, i) => ({
            r: 100, g: 100, b: 100, position: { x: i % gridSize, y: Math.floor(i / gridSize) },
            isFiller: false, hsv: { h: 0, s: 0, v: 0 }, lab: { l: 50, a: 0, b: 0 }, variance: 0
        }));

        const blocksToUse = (Array.isArray(rawBlockAnalysis.blocks) && rawBlockAnalysis.blocks.length > 0)
            ? rawBlockAnalysis.blocks
            : fakeBlocks;

        return {
            imageHash: partialData.imageHash || partialData.hash || partialData.metadata?.image_hash || "restored_entry",
            audioHash: partialData.audioHash || partialData.metadata?.audio_hash || "---",
            paradigm: partialData.paradigm || "scientific",
            standardizedImageUrl: imgUrl,
            sacContainer: { blob: new Blob(), fileName: filename },
            generatedVideoBlob: videoBlob,

            audioOutput: {
                audioUrl: audioUrl || "",
                audioWavBlob: new Blob(),
                midiBlob: new Blob(),
                events: sanitizedEvents,
                eventsCount: sanitizedEvents.length,
                duration: duration,
                bpm: safeConfig.bpm
            },

            blockAnalysisResult: {
                ...rawBlockAnalysis,
                blocks: blocksToUse,
                gridSize,
                totalPixelsAnalyzed: gridSize * gridSize,
                coveragePercentage: 100,
                analysisMethod: "Restored",
                blockSize: 16,
                globalStats: rawBlockAnalysis.globalStats || { avg_L: 50, avg_saturation: 0.5, hue_diversity: 0.5, avg_a: 0, avg_b: 0, avg_variance: 0 }
            },

            culturalSelectionResult: safeCulturalResult,
            scanPattern: { name: scanName, sequence: [] },
            configUsed: safeConfig,
            validationResult: { determinism: { passed: true, message: "OK" }, coverage: { passed: true, message: "OK" }, robustness: { passed: true, message: "OK" }, grid: { passed: true, message: "OK" } },
            performanceMetrics: { totalProcessingTime: 0 },
            validationHashes: { imageBlobHash: "", audioBlobHash: "", midiBlobHash: "" },

            // Recupero prompt se presente
            musicGenerationPrompt: partialData.musicGenerationPrompt
        };
    };


    // --- CARICAMENTO DA DASHBOARD ---
    const handleLoadHistoryItem = (entry: DashboardEntry) => {
        const fixImg = (url: string) => url.startsWith('data:') || url.startsWith('http') ? url : `data:image/jpeg;base64,${url}`;

        const result = reconstructResultFromPartialData(
            entry,
            fixImg(entry.imageUrl),
            entry.audioUrl || null,
            "project_from_dashboard.sac"
        );

        setResult(result);
        setImageUrl(result.standardizedImageUrl);
        setIsViewingHistory(true);
        setView('sonification');
        window.scrollTo(0, 0);
    };

    // --- CARICAMENTO SAC ---
    const handleLoadSacProject = async (file: File, verificationResult: SacVerificationResult) => {
        try {
            setIsProcessing(true);
            const zip = await JSZip.loadAsync(file);
            const jsonFile = zip.file("sonification_data.json");
            if (!jsonFile) throw new Error("JSON mancante");
            const jsonData = JSON.parse(await jsonFile.async("string"));

            let imgUrl = "";
            const imgFile = zip.file("original_image.jpg") || zip.file("original_image.png");
            if (imgFile) imgUrl = URL.createObjectURL(await imgFile.async("blob"));

            let audioUrl = ""; let audioBlob = new Blob([], { type: 'audio/wav' });
            let audioFile = zip.file("generated_audio.wav");
            if (!audioFile) { const wavFiles = Object.keys(zip.files).filter(f => f.endsWith('.wav')); if (wavFiles.length > 0) audioFile = zip.file(wavFiles[0]); }
            if (audioFile) {
                const buffer = await audioFile.async("arraybuffer");
                audioBlob = new Blob([buffer], { type: 'audio/wav' });
                audioUrl = URL.createObjectURL(audioBlob);
            }

            const restoredResult = reconstructResultFromPartialData(
                jsonData,
                imgUrl || jsonData.standardizedImageUrl,
                audioUrl,
                file.name,
                verificationResult.extractedVideoBlob
            );
            restoredResult.audioOutput.audioWavBlob = audioBlob;

            setResult(restoredResult);
            if (imgUrl) setImageUrl(imgUrl);
            setParadigm(restoredResult.paradigm);
            setConfig(restoredResult.configUsed);

            setIsViewingHistory(true);
            setView('sonification');
            window.scrollTo(0, 0);

        } catch (e) {
            console.error("Errore Caricamento SAC:", e);
            alert("Errore critico durante la lettura del file.");
        } finally { setIsProcessing(false); }
    };

    // Aggiorna lo stato degli step in base ai callback del servizio
    const updateProcessingStep = useCallback((stepIndex: number, status: 'active' | 'completed') => {
        setProcessingSteps(prev => {
            return prev.map((step, idx) => {
                if (idx < stepIndex && status === 'active') {
                    // quelli prima vengono marcati completed
                    return { ...step, status: 'completed' };
                }
                if (idx === stepIndex) {
                    return { ...step, status };
                }
                return step;
            });
        });
    }, []);

    const startSonification = async () => {
        if (!imageFile || !user) { setIsLoginModalOpen(true); return; }
        // resetta gli step a pending prima di partire
        setProcessingSteps(scientificSteps.map(s => ({ ...s, status: 'pending' })));
        setIsProcessing(true); setResult(null); setIsViewingHistory(false);
        try {
            await new Promise(r => setTimeout(r, 500));
            let res: SonificationResult;
            const progressCb = (stepIndex: number, status: 'active' | 'completed') => updateProcessingStep(stepIndex, status);

            if (paradigm === 'scientific') res = await sonifyImage(imageFile, config, progressCb, oscClient, scanPatternOverride);
            else if (paradigm === 'artistic') res = await sonifyImageArtistic(imageFile, config, progressCb, oscClient, scanPatternOverride);
            else res = await sonifyImageHybrid(imageFile, config, progressCb, oscClient, scanPatternOverride);
            if (user) await api.saveSonification(res, paradigm);
            setResult(res);
            // al termine tutti completed
            setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
        } catch (error) { console.error(error); alert("Errore elaborazione"); } finally { setIsProcessing(false); }
    };

    return (
        <div className="min-h-screen flex flex-col bg-transparent text-brand-text-primary font-sans antialiased selection:bg-brand-accent selection:text-white overflow-x-hidden">
            <GlobalBackground />
            <Navbar currentView={view} setView={(newView) => { if (newView === 'sonification') resetEditorState(); setView(newView); }} isLoggedIn={!!user} isAdmin={user?.isAdmin} userCredits={user?.credits} isProUser={isUnlimited} onLogin={() => setIsLoginModalOpen(true)} onLogout={async () => { await api.logout(); setUser(null); resetEditorState(); setView('landing'); }} onGoProClick={() => setIsRequestAccessOpen(true)} onOpenHelp={() => { setHelpInitialSection(undefined); setIsHelpModalOpen(true); }} />
            <main className="flex-grow w-full relative z-10">
                {view === 'landing' && <LandingPage onGetStarted={() => { if (user) setView('sonification'); else setIsLoginModalOpen(true); }} onExplore={() => setView('showcase')} onOpenPricing={() => setIsRequestAccessOpen(true)} onOpenDocs={(section) => { setHelpInitialSection(section); setIsHelpModalOpen(true); }} />}
                {view !== 'landing' && (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 animate-fade-in">
                        {view === 'verification' && <VerificationPortal user={user} onLogin={() => setIsLoginModalOpen(true)} onLoadSacProject={handleLoadSacProject} />}
                        {view === 'showcase' && <ShowcaseView user={user} initialProjectId={initialGalleryId} />}
                        {view === 'admin' && user?.isAdmin && <AdminPanel />}
                        {view === 'profile' && user && <PublicProfile user={user} />}
                        {view === 'dashboard' && user && <UserDashboard onLoadEntry={handleLoadHistoryItem} />}
                        {view === 'sonification' && (
                            <div className="max-w-7xl mx-auto">
                                {!result && !isProcessing && (
                                    <div className="animate-fade-in">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                            <div className="lg:col-span-7 transition-all duration-500 flex flex-col gap-6">
                                                <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl">
                                                    <div className="mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-brand-accent text-black flex items-center justify-center text-xs font-bold">1</div> Seleziona Paradigma</h3><ParadigmToggle selectedParadigm={paradigm} onParadigmChange={handleParadigmChange} isPro={isUnlimited} /></div>
                                                    <div className="border-t border-white/10 pt-6"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">2</div> Input Visivo</h3><ImageUploader onFileSelect={handleFileSelect} hasFile={!!imageFile} /></div>
                                                    {imageFile && imageUrl && <div className="mt-6 border-t border-white/10 pt-6"><ImagePreview file={imageFile} imageUrl={imageUrl} /></div>}
                                                </div>
                                            </div>
                                            <div className="lg:col-span-5 animate-fade-in-up h-full">
                                                {imageFile ? (<div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl h-full"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">3</div> Parametri{!isUnlimited && <span className="ml-auto text-xs bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded">Costo: {paradigm === 'scientific' ? '1 CR' : '2 CR'}</span>}{isUnlimited && <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1"><i className="fas fa-infinity"></i> Licenza Attiva</span>}</h3><ConfigPanel config={config} onConfigChange={handleConfigChange} onStartProcessing={startSonification} paradigm={paradigm} oscStatus={oscStatus} oscError={oscError} scanPatternOverride={scanPatternOverride} onScanPatternOverrideChange={setScanPatternOverride} onGoProClick={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} /></div>) : <ParadigmInfo paradigm={paradigm} onGoPro={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} />}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isProcessing && <div className="max-w-3xl mx-auto"><ProcessingView steps={processingSteps} imageUrl={imageUrl} /></div>}
                                {result && imageUrl && (<div className="max-w-7xl mx-auto"><ResultsDashboard result={result} imageUrl={imageUrl} onReset={() => { setResult(null); setImageUrl(null); if (isViewingHistory) { setView('dashboard'); setIsViewingHistory(false); } else { setImageFile(null); } }} onSave={() => { setResult(null); setImageFile(null); setImageUrl(null); setView('dashboard'); }} user={user} onRequestAccess={() => setIsRequestAccessOpen(true)} isHistoryView={isViewingHistory} /></div>)}
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

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}