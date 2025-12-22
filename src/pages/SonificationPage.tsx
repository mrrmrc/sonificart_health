
// src/pages/SonificationPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import OSC from 'osc-js';
import { SonificationResult, ConfigSettings, ProcessingStep, Paradigm, ScanPatternOverride, User, DashboardEntry } from '../types';
import { sonifyImage, sonifyImageArtistic, sonifyImageHybrid } from '../services/sonificationService';
import { api } from '../services/api';
import { ProcessingView } from '../components/ProcessingView';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ParadigmToggle } from '../components/ParadigmToggle';
import { ImageUploader } from '../components/ImageUploader';
import { ImagePreview } from '../components/ImagePreview';
import { ConfigPanel } from '../components/ConfigPanel';
import { ParadigmInfo } from '../components/ParadigmInfo';
import { initialSettings, scientificSteps, artisticSteps, hybridSteps } from '../config/defaults';
import { reconstructResultFromPartialData } from '../utils/dataUtils';

interface OutletContextType {
    user: User | null;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
    setIsRequestAccessOpen: (open: boolean) => void;
}

export const SonificationPage: React.FC = () => {
    const { user, isUnlimited, setIsLoginModalOpen, setIsRequestAccessOpen } = useOutletContext<OutletContextType>();
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
                entry.audioUrl || null,
                "project_from_dashboard.sac"
            );
            setResult(restoredResult);
            setImageUrl(restoredResult.standardizedImageUrl);
            setIsViewingHistory(true);
            setParadigm(restoredResult.paradigm as Paradigm);
            if (restoredResult.configUsed) setConfig(restoredResult.configUsed);

            // AUTO-REGENERATE AUDIO IF MISSING (Lite Save Fallback)
            if (!restoredResult.audioOutput.audioUrl) {
                // console.log("Audio missing in history entry. Auto-regenerating...");
                setIsProcessing(true);
                // Create a self-executing async function to handle regeneration
                (async () => {
                    try {
                        const res = await fetch(restoredResult.standardizedImageUrl);
                        const blob = await res.blob();
                        const file = new File([blob], "restored.jpg", { type: blob.type });
                        setImageFile(file); // Update state too

                        let newResult: SonificationResult;
                        const progressCb = updateProcessingStep;

                        // Small delay to let UI render processing view
                        await new Promise(r => setTimeout(r, 500));

                        if (entry.paradigm === 'scientific') {
                            newResult = await sonifyImage(file, restoredResult.configUsed, progressCb, oscClient, scanPatternOverride);
                        } else if (entry.paradigm === 'artistic') {
                            newResult = await sonifyImageArtistic(file, restoredResult.configUsed, progressCb, oscClient, scanPatternOverride);
                        } else {
                            newResult = await sonifyImageHybrid(file, restoredResult.configUsed, progressCb, oscClient, scanPatternOverride);
                        }
                    } catch (e) {
                        console.error("Failed to regenerate audio:", e);
                        setConfirmModal({
                            isOpen: true,
                            title: "Errore Rigenerazione",
                            message: "Impossibile rigenerare l'audio per questa opera.",
                            type: 'danger',
                            singleButton: true,
                            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                        });
                        // Fallback to restored result without audio
                        setResult(restoredResult);
                    } finally {
                        setIsProcessing(false);
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

    const handleFileSelect = (file: File | null) => {
        setImageFile(file);
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
        if (!imageFile || !user) { setIsLoginModalOpen(true); return; }

        let initialSteps = scientificSteps;
        if (paradigm === 'artistic') initialSteps = artisticSteps;
        else if (paradigm === 'hybrid') initialSteps = hybridSteps;

        setProcessingSteps(initialSteps.map(s => ({ ...s, status: 'pending' })));
        setIsProcessing(true); setResult(null); setIsViewingHistory(false);
        try {
            await new Promise(r => setTimeout(r, 500));
            let res: SonificationResult;
            const progressCb = (stepIndex: number, status: 'active' | 'completed') => updateProcessingStep(stepIndex, status);

            if (paradigm === 'scientific') res = await sonifyImage(imageFile, config, progressCb, oscClient, scanPatternOverride);
            else if (paradigm === 'artistic') res = await sonifyImageArtistic(imageFile, config, progressCb, oscClient, scanPatternOverride);
            else res = await sonifyImageHybrid(imageFile, config, progressCb, oscClient, scanPatternOverride);

            // REMOVED AUTO SAVE to ensure 100% progress means READY
            // if (user) await api.saveSonification(res, paradigm);

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

    const handleManualSave = async (title: string) => {
        if (!result || !user) return;
        try {
            await api.saveSonification(result, paradigm, title);
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
                                <div className="border-t border-white/10 pt-6"><h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2"><div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs font-bold">2</div> {t('steps.visual_input')}</h3><ImageUploader onFileSelect={handleFileSelect} hasFile={!!imageFile} /></div>
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
            {result && imageUrl && (<div className="max-w-7xl mx-auto"><ResultsDashboard result={result} imageUrl={imageUrl} onReset={handleCloseResult} onSave={handleManualSave} user={user} onRequestAccess={() => setIsRequestAccessOpen(true)} isHistoryView={isViewingHistory} /></div>)}

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
