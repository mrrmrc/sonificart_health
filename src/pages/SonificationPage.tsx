
// src/pages/SonificationPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import OSC from 'osc-js';
import { SonificationResult, ConfigSettings, ProcessingStep, Paradigm, ScanPatternOverride, User, DashboardEntry } from '../types';
import { sonifyImage, sonifyImageArtistic, sonifyImageHybrid, synthesizeAudio } from '../services/sonificationService';
import { api } from '../services/api';
import { ProcessingView } from '../components/ProcessingView';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ParadigmToggle } from '../components/ParadigmToggle';
import { ImageUploader } from '../components/ImageUploader';
import { ImagePreview } from '../components/ImagePreview';
import { ConfigPanel } from '../components/ConfigPanel';
import { ParadigmInfo } from '../components/ParadigmInfo';
import { PhotoStandardizationModal } from '../components/PhotoStandardizationModal';
import { NormalizationReport } from '../services/imageNormalizationService';
import { initialSettings, scientificSteps, artisticSteps, hybridSteps } from '../config/defaults';
import { reconstructResultFromPartialData } from '../utils/dataUtils';

interface OutletContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
    setIsRequestAccessOpen: (open: boolean) => void;
}

export const SonificationPage: React.FC = () => {
    const { user, setUser, isUnlimited, setIsLoginModalOpen, setIsRequestAccessOpen } = useOutletContext<OutletContextType>();
    const { t } = useLanguage();
    const location = useLocation();

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [config, setConfig] = useState<ConfigSettings>(initialSettings);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(scientificSteps);
    const [result, setResult] = useState<SonificationResult | null>(null);
    const [paradigm, setParadigm] = useState<Paradigm>('scientific');
    const [scanPatternOverride, setScanPatternOverride] = useState<ScanPatternOverride>('auto');
    const [oscClient, setOscClient] = useState<OSC | null>(null);
    const [oscStatus, setOscStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [oscError, setOscError] = useState<string | null>(null);
    const [isViewingHistory, setIsViewingHistory] = useState(false);
    const [showStandardizationModal, setShowStandardizationModal] = useState(false);
    const [normalizationReport, setNormalizationReport] = useState<NormalizationReport | null>(null);
    const [acquisitionMetadata, setAcquisitionMetadata] = useState<SonificationResult['acquisitionMetadata']>(undefined);

    // MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean,
        title: string,
        message: string,
        onConfirm: (val?: string) => void,
        type: 'info' | 'warning' | 'danger' | 'success',
        singleButton?: boolean,
        showInput?: boolean,
        inputPlaceholder?: string,
        initialInputValue?: string,
        confirmText?: string,
        cancelText?: string
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    // Gestione OSC
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

    // Caricamento da History (passato via state)
    useEffect(() => {
        if (location.state?.historyEntry) {
            const entry: DashboardEntry = location.state.historyEntry;
            const fixImg = (url: string) => url.startsWith('data:') || url.startsWith('http') ? url : `data:image/jpeg;base64,${url}`;

            const restoredResult = reconstructResultFromPartialData(
                entry,
                fixImg(entry.imageUrl),
                null, // reconstructResult will find it in entry
                "project_from_dashboard.sac"
            );

            setResult(restoredResult);
            setImageUrl(restoredResult.standardizedImageUrl);
            setIsViewingHistory(true);
            setParadigm(restoredResult.paradigm as Paradigm);
            if (restoredResult.configUsed) setConfig(restoredResult.configUsed);

            // Fetch image file
            fetch(restoredResult.standardizedImageUrl)
                .then(res => {
                    if (!res.ok) throw new Error("Image not found");
                    return res.blob();
                })
                .then(blob => setImageFile(new File([blob], "restored_image.jpg", { type: "image/jpeg" })))
                .catch(err => {
                    console.error("Error restoring image file:", err);
                    // Fallback: use a placeholder or at least don't crash the state
                });

            // ALWAYS RE-SYNTHESIZE AUDIO FOR TECHNICAL VIEW
            if (restoredResult.audioOutput.events.length > 0) {
                (async () => {
                    try {
                        const { blob } = await synthesizeAudio(
                            restoredResult.audioOutput.events,
                            restoredResult.audioOutput.duration,
                            restoredResult.configUsed
                        );
                        const synthUrl = URL.createObjectURL(blob);
                        setResult(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                audioOutput: {
                                    ...prev.audioOutput,
                                    audioWavBlob: blob,
                                    audioUrl: synthUrl, // Pure synthesized audio
                                }
                            };
                        });
                    } catch (e) {
                        console.error("Failed to re-synthesize pure audio:", e);
                    }
                })();
            }
        } else if (location.state?.sacResult) {
            // Caricamento da Verification Page
            const restoredResult = location.state.sacResult;
            setResult(restoredResult);
            setImageUrl(restoredResult.standardizedImageUrl);
            setIsViewingHistory(true);
            setParadigm(restoredResult.paradigm as Paradigm);
            setConfig(restoredResult.configUsed);
        }
    }, [location.state]);

    const handleFileSelect = (file: File | null, report?: NormalizationReport | null, acqMetadata?: SonificationResult['acquisitionMetadata']) => {
        setImageFile(file);
        setNormalizationReport(report || null);
        setAcquisitionMetadata(acqMetadata);
        if (file) { const url = URL.createObjectURL(file); setImageUrl(url); setResult(null); setIsViewingHistory(false); }
        else { setImageUrl(null); setResult(null); }
    };

    const updateProcessingStep = useCallback((stepIndex: number, status: 'active' | 'completed') => {
        setProcessingSteps(prev => prev.map((step, idx) => {
            if (idx < stepIndex && status === 'active') return { ...step, status: 'completed' };
            if (idx === stepIndex) return { ...step, status };
            return step;
        }));
    }, []);

    const startSonification = async () => {
        if (isProcessing) return;
        if (!imageFile || !user) { setIsLoginModalOpen(true); return; }

        // Credit check and consumption
        if (!isUnlimited && user) {
            const cost = paradigm === 'scientific' ? 1 : 2;
            if ((user.credits || 0) < cost) {
                setConfirmModal({
                    isOpen: true,
                    title: "Crediti Insufficienti",
                    message: `Ti servono ${cost} crediti per questa operazione. Hai ${user.credits || 0} crediti.`,
                    type: 'warning',
                    confirmText: "Acquista Crediti",
                    onConfirm: () => { setIsRequestAccessOpen(true); setConfirmModal(prev => ({ ...prev, isOpen: false })); }
                });
                return;
            }

            try {
                const newCredits = await api.consumeCredit(user.id, cost);
                setUser({ ...user, credits: newCredits });
            } catch (e: any) {
                setConfirmModal({
                    isOpen: true,
                    title: "Errore Crediti",
                    message: e.message || "Impossibile scalare i crediti.",
                    type: 'danger',
                    singleButton: true,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
                return;
            }
        }

        let initialSteps = scientificSteps;
        if (paradigm === 'artistic') initialSteps = artisticSteps;
        else if (paradigm === 'hybrid') initialSteps = hybridSteps;

        setProcessingSteps(initialSteps.map(s => ({ ...s, status: 'pending' })));
        setIsProcessing(true); setResult(null); setIsViewingHistory(false);
        try {
            await new Promise(r => setTimeout(r, 500));
            let res: SonificationResult;
            const progressCb = (stepIndex: number, status: 'active' | 'completed') => updateProcessingStep(stepIndex, status);

            if (paradigm === 'scientific') res = await sonifyImage(imageFile, config, progressCb, oscClient, scanPatternOverride, normalizationReport, acquisitionMetadata);
            else if (paradigm === 'artistic') res = await sonifyImageArtistic(imageFile, config, progressCb, oscClient, scanPatternOverride, acquisitionMetadata);
            else res = await sonifyImageHybrid(imageFile, config, progressCb, oscClient, scanPatternOverride, acquisitionMetadata);

            // setResult(res);
            setResult(res);
            setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
        } catch (error) {
            console.error(error);
            setConfirmModal({
                isOpen: true,
                title: "Errore Elaborazione",
                message: "Si è verificato un errore durante la sonificazione dell'immagine.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally { setIsProcessing(false); }
    };

    const handleManualSave = async (title: string, description?: string) => {
        if (!result || !user) return;
        try {
            const saveRes = await api.saveSonification(result, paradigm, title, description);
            const entryId = saveRes.id;

            let finalVideoUrl = (result as any).videoUrl;

            // NEW: Automatically attach video if it has been generated
            if (result.generatedVideoBlob && entryId) {
                console.log("Automatically attaching generated video to history record:", entryId);
                try {
                    finalVideoUrl = await api.attachVideoToHistory(entryId, result.generatedVideoBlob, `video_${entryId}.mp4`);
                } catch (videoError) {
                    console.error("Failed to auto-attach video, but project was saved:", videoError);
                    // We don't throw here to not invalidate the successful project save
                }
            }

            setResult(prev => prev ? { ...prev, title, videoUrl: finalVideoUrl } as any : null);
        } catch (e) {
            console.error(e);
            throw e;
        }
    };

    const handleReset = () => {
        setResult(null); setImageUrl(null); setImageFile(null); setIsViewingHistory(false);
    };

    const handleCloseResult = () => {
        setResult(null);
        setIsViewingHistory(false);
        window.scrollTo(0, 0);
    };

    return (
        <div className="max-w-7xl mx-auto">
            {!result && !isProcessing && (
                <div className="animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-7 transition-all duration-500 flex flex-col gap-6">
                            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl">
                                <div className="mb-6"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-brand-accent text-black flex items-center justify-center text-xs font-bold">1</div> {t('steps.select_paradigm')}</h3><ParadigmToggle selectedParadigm={paradigm} onParadigmChange={setParadigm} isPro={isUnlimited} /></div>
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">2</div>
                                        {t('steps.visual_input')}
                                    </h3>
                                    <button
                                        onClick={() => setShowStandardizationModal(true)}
                                        className="w-full bg-gradient-to-r from-brand-accent/20 to-brand-accent/10 hover:from-brand-accent/30 hover:to-brand-accent/20 border border-brand-accent/30 rounded-lg p-6 transition-all duration-300 group"
                                    >
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <i className="fas fa-camera text-2xl text-brand-accent group-hover:scale-110 transition-transform"></i>
                                            <span className="text-lg font-semibold text-white">Carica o Scatta Foto</span>
                                        </div>
                                        <p className="text-sm text-white/60 text-center">
                                            {imageFile ? '✓ Immagine caricata - Clicca per cambiare' : 'Acquisizione guidata o normalizzazione automatica'}
                                        </p>
                                    </button>
                                </div>
                                {imageFile && imageUrl && <div className="mt-6 border-t border-white/10 pt-6"><ImagePreview file={imageFile} imageUrl={imageUrl} /></div>}
                            </div>
                        </div>
                        <div className="lg:col-span-5 animate-fade-in-up h-full">
                            {imageFile ? (<div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-xl border border-white/10 shadow-2xl h-full"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">3</div> {t('steps.parameters')}{!isUnlimited && <span className="ml-auto text-xs bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded">{t('steps.cost')}: {paradigm === 'scientific' ? '1 CR' : '2 CR'}</span>}{isUnlimited && <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1"><i className="fas fa-infinity"></i> {t('steps.active_license')}</span>}</h3><ConfigPanel config={config} onConfigChange={(nc) => setConfig(p => ({ ...p, ...nc }))} onStartProcessing={startSonification} paradigm={paradigm} oscStatus={oscStatus} oscError={oscError} scanPatternOverride={scanPatternOverride} onScanPatternOverrideChange={setScanPatternOverride} onGoProClick={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} /></div>) : <ParadigmInfo paradigm={paradigm} onGoPro={() => setIsRequestAccessOpen(true)} isProUser={!!isUnlimited} />}
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
                        onReset={handleCloseResult}
                        onSave={handleManualSave}
                        user={user}
                        setUser={setUser}
                        onRequestAccess={() => setIsRequestAccessOpen(true)}
                        isHistoryView={isViewingHistory}
                        onVideoGenerated={(blob) => {
                            setResult(prev => prev ? { ...prev, generatedVideoBlob: blob } : null);
                        }}
                    />
                </div>
            )}

            {showStandardizationModal && (
                <PhotoStandardizationModal
                    onImageReady={(file, report, acqMetadata) => {
                        handleFileSelect(file, report, acqMetadata);
                        setShowStandardizationModal(false);
                    }}
                    onClose={() => setShowStandardizationModal(false)}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                showInput={confirmModal.showInput}
                inputPlaceholder={confirmModal.inputPlaceholder}
                initialInputValue={confirmModal.initialInputValue}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
