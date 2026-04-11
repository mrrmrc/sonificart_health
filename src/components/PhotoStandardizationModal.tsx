import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { GuidedPhotoCapture } from './GuidedPhotoCapture';
import { normalizeImage, NormalizationReport, NormalizationOptions } from '../services/imageNormalizationService';
import { AcquisitionMetadata } from '../types';

interface PhotoStandardizationModalProps {
    onImageReady: (file: File, report: NormalizationReport | null, acquisitionMetadata?: AcquisitionMetadata, originalFile?: File) => void;
    onClose: () => void;
}

type Mode = 'select' | 'capture' | 'preview';

export const PhotoStandardizationModal: React.FC<PhotoStandardizationModalProps> = ({
    onImageReady,
    onClose
}) => {
    // REMOVED: setHideSiteUI(true)

    const [mode, setMode] = useState<Mode>('select');
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [normalizedFile, setNormalizedFile] = useState<File | null>(null);
    const [normalizationReport, setNormalizationReport] = useState<NormalizationReport | null>(null);
    const [acquisitionMetadata, setAcquisitionMetadata] = useState<AcquisitionMetadata | undefined>(undefined);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Debug tracking
    useEffect(() => {
        console.log('[StandardizationModal] Current mode:', mode);
    }, [mode]);

    const normalizationOptions: NormalizationOptions = {
        whiteBalance: true,
        exposure: true,
        contrast: true,
        claheClipLimit: 2.0,
        claheTileSize: 8,
        targetContrast: 50
    };

    const handleCapture = async (file: File, info: { method: 'camera', offsets: any }) => {
        console.log('[StandardizationModal] Photo captured, starting normalization');
        setOriginalFile(file);
        setAcquisitionMetadata({
            method: 'camera',
            offsets: info.offsets,
            timestamp: new Date().toISOString()
        });
        await processImage(file);
    };

    const handleUploadClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[StandardizationModal] Upload card clicked');
        if (fileInputRef.current) {
            fileInputRef.current.click();
        } else {
            console.error('[StandardizationModal] File input ref is null!');
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        console.log('[StandardizationModal] File selection event, file:', file?.name);
        if (!file) return;

        setOriginalFile(file);
        setAcquisitionMetadata({
            method: 'upload',
            timestamp: new Date().toISOString()
        });
        await processImage(file);
    };

    const processImage = async (file: File) => {
        setIsProcessing(true);
        setMode('preview');

        try {
            const { normalizedFile: processed, report } = await normalizeImage(file, normalizationOptions);
            setNormalizedFile(processed);
            setNormalizationReport(report);
        } catch (error) {
            console.error('[StandardizationModal] Normalization failed:', error);
            alert('Errore durante la normalizzazione dell\'immagine');
            setMode('select');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = () => {
        if (normalizedFile && normalizationReport) {
            // Ensure originalFile is present
            if (!originalFile) {
                console.error('[StandardizationModal] Critical: Original file is missing during confirm!');
                // Fallback: use normalized if strictly necessary but this shouldn't happen
            }
            onImageReady(normalizedFile, normalizationReport, acquisitionMetadata, originalFile || undefined);
        }
    };

    const handleRetake = () => {
        setOriginalFile(null);
        setNormalizedFile(null);
        setNormalizationReport(null);
        setMode('select');
    };

    const selectCapture = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[StandardizationModal] Capture card clicked');
        setMode('capture');
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden bg-black/80 backdrop-blur-sm shadow-2xl">
            {/* Backdrop explicit */}
            <div
                className="absolute inset-0 z-0 bg-black/40"
                onClick={(e) => {
                    console.log('[StandardizationModal] Backdrop clicked');
                    if (mode === 'select') onClose();
                }}
            />

            <div className="relative z-10 w-full max-w-5xl max-h-[95vh] bg-brand-primary rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex flex-col animate-zoom-in">

                {/* File input (Hidden) */}
                <input
                    ref={fileInputRef}
                    id="hidden-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                />

                {mode === 'select' && (
                    <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden p-4 md:p-8">
                        <div className="flex justify-between items-center mb-6 md:mb-10">
                            <div>
                                <h2 className="text-xl md:text-3xl font-black text-white font-display tracking-tight mb-2 uppercase">Standardizzazione Foto</h2>
                                <div className="h-1.5 w-12 md:w-20 bg-brand-accent rounded-full shadow-[0_0_10px_rgba(13,148,136,0.5)]"></div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onClose(); }}
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                            >
                                <i className="fas fa-times text-sm"></i>
                            </button>
                        </div>

                        <div className="bg-brand-accent/5 border border-brand-accent/20 p-4 md:p-5 rounded-2xl mb-4 md:mb-6">
                            <p className="text-gray-300 leading-relaxed text-xs md:text-base">
                                <span className="text-brand-accent font-bold">Nota Scientifica:</span> Per garantire la validità del framework SonificART, le immagini devono essere standardizzate. Questo elimina il bias dovuto alle condizioni di scatto.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8">
                            {/* Capture Card */}
                            <button
                                onClick={selectCapture}
                                className="text-left bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-5 md:p-8 rounded-2xl md:rounded-3xl cursor-pointer hover:bg-white/[0.08] hover:border-brand-accent/50 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 md:opacity-10 group-hover:scale-125 transition-transform duration-700">
                                    <i className="fas fa-camera text-4xl md:text-6xl"></i>
                                </div>
                                <div className="w-10 h-10 md:w-14 md:h-14 bg-brand-accent/20 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-2xl mb-4 md:mb-6 text-brand-accent group-hover:scale-110 transition-transform">
                                    <i className="fas fa-video"></i>
                                </div>
                                <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-4 group-hover:text-brand-accent transition-colors">Acquisizione Guidata</h3>
                                <p className="text-[10px] md:text-sm text-gray-400 mb-4 md:mb-8 leading-relaxed">
                                    Scatta una foto con assistenza real-time. L'app analizza illuminazione e stabilità.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[8px] md:text-[10px] font-bold bg-white/5 text-gray-400 px-2 md:px-3 py-1 rounded-lg border border-white/5">Analisi Real-time</span>
                                </div>
                            </button>

                            {/* Upload Card */}
                            <button
                                onClick={handleUploadClick}
                                className="text-left bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-5 md:p-8 rounded-2xl md:rounded-3xl cursor-pointer hover:bg-white/[0.08] hover:border-brand-accent/50 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 md:opacity-10 group-hover:scale-125 transition-transform duration-700">
                                    <i className="fas fa-file-upload text-4xl md:text-6xl"></i>
                                </div>
                                <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-500/20 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-2xl mb-4 md:mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                                    <i className="fas fa-images"></i>
                                </div>
                                <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-4 group-hover:text-blue-400 transition-colors">Carica & Normalizza</h3>
                                <p className="text-[10px] md:text-sm text-gray-400 mb-4 md:mb-8 leading-relaxed">
                                    Usa un'immagine esistente. Applicheremo algoritmi basati sul colore per normalizzare l'input.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[8px] md:text-[10px] font-bold bg-white/5 text-gray-400 px-2 md:px-3 py-1 rounded-lg border border-white/5">White Patch</span>
                                    <span className="text-[8px] md:text-[10px] font-bold bg-white/5 text-gray-400 px-2 md:px-3 py-1 rounded-lg border border-white/5">CLAHE</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'capture' && (
                    <GuidedPhotoCapture
                        onCapture={handleCapture}
                        onCancel={() => setMode('select')}
                    />
                )}

                {mode === 'preview' && (
                    <NormalizationPreview
                        originalFile={originalFile!}
                        normalizedFile={normalizedFile}
                        report={normalizationReport}
                        isProcessing={isProcessing}
                        onConfirm={handleConfirm}
                        onRetake={handleRetake}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

// ============================================================================
// NORMALIZATION PREVIEW COMPONENT
// ============================================================================

interface NormalizationPreviewProps {
    originalFile: File;
    normalizedFile: File | null;
    report: NormalizationReport | null;
    isProcessing: boolean;
    onConfirm: () => void;
    onRetake: () => void;
}

const NormalizationPreview: React.FC<NormalizationPreviewProps> = ({
    originalFile,
    normalizedFile,
    report,
    isProcessing,
    onConfirm,
    onRetake
}) => {
    const [originalUrl, setOriginalUrl] = useState<string>('');
    const [normalizedUrl, setNormalizedUrl] = useState<string>('');
    const [showComparison, setShowComparison] = useState(true);

    useEffect(() => {
        const origUrl = URL.createObjectURL(originalFile);
        setOriginalUrl(origUrl);
        return () => URL.revokeObjectURL(origUrl);
    }, [originalFile]);

    useEffect(() => {
        if (normalizedFile) {
            const normUrl = URL.createObjectURL(normalizedFile);
            setNormalizedUrl(normUrl);
            return () => URL.revokeObjectURL(normUrl);
        }
    }, [normalizedFile]);

    if (isProcessing) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center bg-brand-primary border border-white/10 rounded-3xl">
                <div className="relative w-24 h-24 mb-10">
                    <div className="absolute inset-0 border-4 border-white/5 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-brand-accent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-2xl font-black text-white mb-2 font-display">Normalizzazione...</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">Standardizzazione bilanciamento bianco e contrasto adattivo</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-brand-primary">
            <div className="bg-black/40 p-4 md:p-6 flex justify-between items-center border-b border-white/10 shadow-lg relative z-20">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-brand-accent rounded-full shadow-[0_0_15px_rgba(13,148,136,0.5)]"></div>
                    <h2 className="text-xl md:text-2xl font-black text-white font-display tracking-tight uppercase">Miglioramento Completato</h2>
                </div>
                <div className="flex bg-black p-1 rounded-lg border border-white/10">
                    <button
                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${showComparison ? 'bg-brand-accent text-brand-primary' : 'text-gray-500 hover:text-white'}`}
                        onClick={() => setShowComparison(true)}
                    >
                        Confronto
                    </button>
                    <button
                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${!showComparison ? 'bg-brand-accent text-brand-primary' : 'text-gray-500 hover:text-white'}`}
                        onClick={() => setShowComparison(false)}
                    >
                        Risultato
                    </button>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-6 overflow-y-auto lg:overflow-hidden custom-scrollbar">
                {showComparison ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start mb-6 md:mb-10">
                        <div className="space-y-4">
                            <div className="relative group overflow-hidden rounded-xl border border-white/5 shadow-2xl">
                                <img src={originalUrl} className="w-full aspect-square max-h-[30vh] md:max-h-[40vh] object-contain transition-transform duration-700 group-hover:scale-105" alt="Originale" />
                                <div className="absolute top-3 left-3 bg-black/80 px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest backdrop-blur-md border border-white/10">Originale</div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="relative group overflow-hidden rounded-xl border border-brand-accent/20 shadow-2xl shadow-brand-accent/5">
                                <img src={normalizedUrl} className="w-full aspect-square max-h-[30vh] md:max-h-[40vh] object-contain transition-transform duration-700 group-hover:scale-105" alt="Normalizzata" />
                                <div className="absolute top-3 right-3 bg-brand-accent px-3 py-1 rounded-full text-[9px] font-black text-brand-primary uppercase tracking-widest border border-white/10">Normalizzato</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full mb-10">
                        <img src={normalizedUrl} className="max-w-full max-h-[45vh] object-contain rounded-2xl shadow-2xl border border-white/5" alt="Normalizzata" />
                    </div>
                )}

                {report && (
                    <div className="max-w-5xl mx-auto space-y-8 pb-10">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            <MetricCard icon="temperature-high" label="TEMP." value={`${Math.round(report.quality.colorTemperature)}K`} sub="6500K" color="text-orange-400" />
                            <MetricCard icon="bullseye" label="ACCURATEZZA" value={`${report.quality.colorAccuracy.toFixed(1)}%`} sub="Fedeltà" color="text-emerald-400" />
                            <MetricCard icon="sliders-h" label="DINAMICA" value={report.quality.dynamicRange.toFixed(1)} sub="Levels" color="text-blue-400" />
                            <MetricCard icon="stopwatch" label="LATENZA" value={`${(report.processingTime / 1).toFixed(0)}ms`} sub="Engine" color="text-yellow-400" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="bg-black/20 border border-white/5 p-5 md:p-6 rounded-2xl">
                                <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    Correzione
                                </h4>
                                <ul className="space-y-2 text-xs text-gray-400">
                                    {report.applied.slice(0, 3).map((algo, i) => (
                                        <li key={i} className="flex items-center gap-2 truncate">
                                            <i className="fas fa-check text-[10px] text-emerald-500"></i> {algo}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-black/20 border border-white/5 p-5 md:p-6 rounded-2xl">
                                <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    Validazione
                                </h4>
                                <div className="space-y-3">
                                    <DetailRow label="WB Delta" value={report.metrics.whiteBalanceShift.g.toFixed(2)} />
                                    <DetailRow label="Exposure" value={report.metrics.exposureAdjustment.toFixed(2)} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row gap-3">
                <button
                    onClick={onRetake}
                    className="order-2 md:order-1 px-6 py-3.5 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:bg-white/5 transition-all text-[9px] font-black uppercase tracking-[0.2em]"
                >
                    Scarta
                </button>
                <button
                    onClick={onConfirm}
                    className="order-1 md:order-2 flex-1 px-6 py-3.5 rounded-xl bg-brand-accent text-brand-primary hover:bg-brand-accent-light transition-all text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-accent/20"
                >
                    Inizia Processo Sonoro →
                </button>
            </div>
        </div>
    );
};

const MetricCard = ({ icon, label, value, sub, color }: any) => (
    <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
        <div className={`text-lg mb-2 ${color}`}><i className={`fas fa-${icon}`}></i></div>
        <div className="text-[8px] text-gray-500 uppercase tracking-widest font-black mb-1">{label}</div>
        <div className="text-xl font-black text-white mb-0.5 font-display">{value}</div>
        <div className="text-[8px] text-gray-600 font-bold">{sub}</div>
    </div>
);

const DetailRow = ({ label, value }: any) => (
    <div className="flex justify-between items-center group">
        <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors uppercase tracking-wider">{label}</span>
        <span className="text-xs text-white font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/5">{value}</span>
    </div>
);
