import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SonificationResult, TransformedNoteEvent, User, HealthClassificationResult } from '../types';
import { classifyHealthCategories } from '../services/healthCategoryClassifier';
import { AudioPlayer } from './AudioPlayer';
import { ScanPathOverlay } from './ScanPathOverlay';
import { CursorHighlight } from './CursorHighlight';
import { CursorLoupe } from './CursorLoupe';
import { MusicSheet } from './MusicSheet';
import saveAs from 'file-saver';
import { generateSonificationVideo } from '../services/videoService';
import { createSacContainer } from '../services/sacService';
import { createForensicPackage } from '../services/forensicPackageService';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmationModal } from './ConfirmationModal';
import { api } from '../services/api';

const InfoCard: React.FC<{ title: string, icon: string, children: React.ReactNode, className?: string }> = ({ title, icon, children, className }) => (
    <div className={`bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary ${className}`}>
        <h4 className="font-bold text-brand-accent mb-3 flex items-center gap-2">
            <i className={`fas ${icon}`}></i>
            <span>{title}</span>
        </h4>
        <div className="space-y-2 text-sm text-brand-text-primary relative h-full">{children}</div>
    </div>
);

const DataRow: React.FC<{ label: string; value: string | number | React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-start gap-2">
        <span className="text-brand-text-secondary flex-shrink-0">{label}:</span>
        <span className="font-mono text-right break-words">{value}</span>
    </div>
);

const StatBar: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div>
        <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-brand-text-secondary">{label}</span>
            <span className="font-mono text-white">{Math.round(Math.min(100, Math.max(0, value || 0)))}%</span>
        </div>
        <div className="w-full bg-brand-primary/70 rounded-full h-2">
            <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}></div>
        </div>
    </div>
);


interface ResultsDashboardProps {
    result: SonificationResult;
    imageUrl: string;
    onReset: () => void;
    onSave: (title: string, description?: string) => void;
    user: User | null;
    setUser: (user: User | null) => void;
    onRequestAccess: () => void;
    isHistoryView?: boolean;
    onVideoGenerated?: (blob: Blob) => void;
    isOwner?: boolean;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
    result, imageUrl, onReset, onSave, user, setUser, onRequestAccess, isHistoryView = false, onVideoGenerated, isOwner = false
}) => {
    const { t } = useLanguage();

    const imageRef = useRef<HTMLImageElement>(null);


    const [originalAspectRatio, setOriginalAspectRatio] = useState<number | null>(null);
    const [hasSaved, setHasSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const [workTitle, setWorkTitle] = useState(result.title || `Opera del ${new Date().toLocaleDateString()}`);
    const [workDescription, setWorkDescription] = useState((result as any).description || ""); // NEW
    const [audioSource, setAudioSource] = useState<'synth' | 'original' | 'custom'>(
        (result.audioOutput.customAudioUrl) ? 'custom' :
            ((result.audioOutput.originalArchivedUrl) ? 'original' : 'synth')
    );
    const [cursorType, setCursorType] = useState<'vertical' | 'horizontal' | 'original' | 'crosshair'>('vertical');

    const handleSaveClick = async () => {
        if (hasSaved || isSaving) return;
        setIsSaving(true);
        try {
            await onSave(workTitle.trim() || `Opera del ${new Date().toLocaleDateString()}`, workDescription); // Updated
            setHasSaved(true);
            setConfirmModal({
                isOpen: true,
                title: "Salvataggio",
                message: t('showcase.saved_success') || "Sonificazione salvata con successo!",
                type: 'success',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } catch (e) {
            console.error(e);
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: e instanceof Error ? e.message : "Errore durante il salvataggio.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
            setHasSaved(false);
        } finally {
            setIsSaving(false);
        }
    };

    // --- SHARE LOGIC ---
    const [qrUrl, setQrUrl] = useState<string | null>(null);

    const copyLink = (text: string) => {
        const full = text.startsWith('http') ? text : `https://sonificart.com${text.startsWith('/') ? '' : '/'}${text}`;
        navigator.clipboard.writeText(full)
            .then(() => setConfirmModal({
                isOpen: true, title: "Copia", message: "Link copiato negli appunti!", type: 'success', singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }))
            .catch(() => setConfirmModal({
                isOpen: true, title: "Errore", message: "Impossibile copiare il link", type: 'danger', singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            }));
    };

    const socialShare = (platform: 'whatsapp' | 'facebook' | 'twitter' | 'linkedin', url: string, text: string) => {
        if (!url) return;
        const full = url.startsWith('http') ? url : `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
        const encUrl = encodeURIComponent(full);
        const encText = encodeURIComponent(text);

        let link = "";
        switch (platform) {
            case 'whatsapp': link = `https://wa.me/?text=${encText}%20${encUrl}`; break;
            case 'facebook': link = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`; break;
            case 'twitter': link = `https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`; break;
            case 'linkedin': link = `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`; break;
        }
        window.open(link, '_blank');
    };

    const handleClose = () => {
        if (isHistoryView) {
            onReset();
            return;
        }

        if (!hasSaved) {
            setConfirmModal({
                isOpen: true,
                title: t('common.warning') || "Attenzione",
                message: "Attenzione: non hai salvato le modifiche. Se chiudi ora, il lavoro andrà perso.\n\nVuoi chiudere comunque?",
                type: 'warning',
                onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    onReset();
                }
            });
        } else {
            onReset();
        }
    };

    // Calculate original aspect ratio from the source image url to ensure we know the real image bounds
    // This is critical if the standardized image has black bars baked in (letterboxing)
    useEffect(() => {
        if (!imageUrl) return;
        const img = new Image();
        img.onload = () => {
            if (img.naturalHeight > 0) {
                setOriginalAspectRatio(img.naturalWidth / img.naturalHeight);
            }
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // State for re-analyzed result (vital for Restored views from dashboard)
    const [reanalyzedBlocks, setReanalyzedBlocks] = useState<any[] | null>(null);

    // Effect to re-analyze block colors from the image if we are in "Restored" mode
    // This fixes the issue where dashboard history items have "fake" grey blocks and no color data
    useEffect(() => {
        if (result.blockAnalysisResult.analysisMethod !== 'Restored' || !imageRef.current) {
            setReanalyzedBlocks(null);
            return;
        }

        const runAnalysis = () => {
            try {
                const img = imageRef.current;
                if (!img || !img.naturalWidth) return;

                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, 512, 512);

                const gridSize = result.blockAnalysisResult.gridSize || 32;
                const blockSize = 512 / gridSize;
                const blocks = [];

                // --- AUTO-CROP DETECTION ALGORITHM ---
                // Since we might only have the standardized (letterboxed) image, we need to find the actual content bounds.
                // We scan for the first and last non-black pixels.

                const imageData = ctx.getImageData(0, 0, 512, 512);
                const data = imageData.data;
                const threshold = 15; // Tolerance for "black" (compression artifacts might make it not exactly 0)

                let minContentY = 0;
                let maxContentY = 511;
                let minContentX = 0;
                let maxContentX = 511;


                // Scan for Top Y
                for (let y = 0; y < 512; y++) {
                    let rowHasContent = false;
                    for (let x = 0; x < 512; x++) {
                        const i = (y * 512 + x) * 4;
                        if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                            rowHasContent = true;
                            break;
                        }
                    }
                    if (rowHasContent) {
                        minContentY = y;
                        break;
                    }
                }

                // Scan for Bottom Y
                for (let y = 511; y >= 0; y--) {
                    let rowHasContent = false;
                    for (let x = 0; x < 512; x++) {
                        const i = (y * 512 + x) * 4;
                        if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                            rowHasContent = true;
                            break;
                        }
                    }
                    if (rowHasContent) {
                        maxContentY = y;
                        break;
                    }
                }

                // Scan for Left X (scan only within Y bounds to avoid corners if rounded?) 
                // actually safely scan whole height
                for (let x = 0; x < 512; x++) {
                    let colHasContent = false;
                    for (let y = minContentY; y <= maxContentY; y++) {
                        const i = (y * 512 + x) * 4;
                        if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                            colHasContent = true;
                            break;
                        }
                    }
                    if (colHasContent) {
                        minContentX = x;
                        break;
                    }
                }

                // Scan for Right X
                for (let x = 511; x >= 0; x--) {
                    let colHasContent = false;
                    for (let y = minContentY; y <= maxContentY; y++) {
                        const i = (y * 512 + x) * 4;
                        if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                            colHasContent = true;
                            break;
                        }
                    }
                    if (colHasContent) {
                        maxContentX = x;
                        break;
                    }
                }


                // Define the effective content bounds with a small margin
                const contentBoundsPixels = {
                    x: minContentX,
                    y: minContentY,
                    width: Math.max(1, maxContentX - minContentX),
                    height: Math.max(1, maxContentY - minContentY)
                };

                const epsilon = 1.0;

                for (let y = 0; y < gridSize; y++) {
                    for (let x = 0; x < gridSize; x++) {
                        const px = Math.floor(x * blockSize);
                        const py = Math.floor(y * blockSize);

                        // Sample center pixel of the block
                        const pixelIndex = ((py + Math.floor(blockSize / 2)) * 512 + (px + Math.floor(blockSize / 2))) * 4;
                        const r = data[pixelIndex];
                        const g = data[pixelIndex + 1];
                        const b = data[pixelIndex + 2];

                        const blockCenterX = px + blockSize / 2;
                        const blockCenterY = py + blockSize / 2;

                        // Check if block center is outside the detected content bounds
                        let isFiller = blockCenterX < (contentBoundsPixels.x - epsilon) ||
                            blockCenterX > (contentBoundsPixels.x + contentBoundsPixels.width + epsilon) ||
                            blockCenterY < (contentBoundsPixels.y - epsilon) ||
                            blockCenterY > (contentBoundsPixels.y + contentBoundsPixels.height + epsilon);

                        // Also verify if the block itself is remarkably black (secondary check)
                        const isPitchBlack = r < 10 && g < 10 && b < 10;
                        if (isPitchBlack && (x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1)) {
                            isFiller = true;
                        }

                        // Force filler if within "letterbox" zones derived from geometric scan
                        // (This overrides the earlier geometric calculation which was based on whole image)

                        blocks.push({
                            position: { x, y },
                            r, g, b,
                            isFiller,
                            hsv: { h: 0, s: 0, v: 0 },
                            lab: { l: 0, a: 0, b: 0 },
                            variance: 0
                        });
                    }
                }
                setReanalyzedBlocks(blocks);
            } catch (e) {
                console.error("Error re-analyzing blocks:", e);
            }
        };

        if (imageRef.current.complete) {
            runAnalysis();
        } else {
            imageRef.current.addEventListener('load', runAnalysis);
            return () => imageRef.current?.removeEventListener('load', runAnalysis);
        }
    }, [result, originalAspectRatio, imageUrl]); // Depend on originalAspectRatio

    const correctedResult = useMemo(() => {
        // Base blocks: prefer reanalyzed ones if available (for Restored view)
        const baseBlocks = reanalyzedBlocks || result.blockAnalysisResult?.blocks || [];

        if (baseBlocks.length === 0) return result;

        // Use original aspect ratio if available, otherwise fall back to imageRef or standardized image
        let aspectRatio = originalAspectRatio || 1;
        if (!originalAspectRatio && imageRef.current && imageRef.current.naturalWidth) {
            aspectRatio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
        }

        let dw = 512, dh = 512;
        if (aspectRatio > 1) {
            dh = 512 / aspectRatio;
        } else {
            dw = 512 * aspectRatio;
        }

        const dx = (512 - dw) / 2;
        const dy = (512 - dh) / 2;
        const imageBounds = { x: dx, y: dy, width: dw, height: dh };

        const gridSize = result.blockAnalysisResult?.gridSize || 32;
        const blockWidth = 512 / gridSize;
        const blockHeight = 512 / gridSize;
        const epsilon = 1.0;

        // Always recalculate isFiller based on imageBounds to ensure accuracy
        const correctedBlocks = baseBlocks.map(block => {
            const startX = Math.floor(block.position.x * blockWidth);
            const startY = Math.floor(block.position.y * blockHeight);
            const blockCenterX = startX + blockWidth / 2;
            const blockCenterY = startY + blockHeight / 2;

            const isFiller = blockCenterX < (imageBounds.x + epsilon) ||
                blockCenterX > (imageBounds.x + imageBounds.width - epsilon) ||
                blockCenterY < (imageBounds.y + epsilon) ||
                blockCenterY > (imageBounds.y + imageBounds.height - epsilon);

            return { ...block, isFiller };
        });

        const correctedEvents = result.audioOutput.events.map(event => {
            let matchingBlock = null;
            if (event.sourceBlock) {
                matchingBlock = correctedBlocks.find(b =>
                    b.position.x === event.sourceBlock.position.x &&
                    b.position.y === event.sourceBlock.position.y
                );
            }
            // Fallback for events without explicit sourceBlock (legacy/restored)
            if (!matchingBlock && typeof event.sourceBlockIndex === 'number') {
                // Try to map index to position if possible, but safer to rely on reanalyzed blocks covering grid
            }

            if (matchingBlock) {
                return { ...event, sourceBlock: matchingBlock };
            }
            return { ...event, sourceBlock: matchingBlock || event.sourceBlock };
        });

        return {
            ...result,
            blockAnalysisResult: {
                ...result.blockAnalysisResult,
                blocks: correctedBlocks,
            },
            audioOutput: {
                ...result.audioOutput,
                events: correctedEvents,
            },
        };
    }, [result, originalAspectRatio, imageRef.current?.naturalWidth]);

    // Stato per i Tab del Prompt (Suno / Udio / Soundverse AI)
    const [activePromptTab, setActivePromptTab] = useState<'suno' | 'udio' | 'soundverse'>('suno');

    const [imageRenderInfo, setImageRenderInfo] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [playbackTime, setPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeEvent, setActiveEvent] = useState<TransformedNoteEvent | null>(null);
    const [hoverEvent, setHoverEvent] = useState<TransformedNoteEvent | null>(null);

    const [isVideoRendering, setIsVideoRendering] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(correctedResult.generatedVideoBlob || null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [videoTitle, setVideoTitle] = useState("Composizione Sonora");
    const [videoAuthor, setVideoAuthor] = useState("SonificA.R.T. User");

    const containerRef = useRef<HTMLDivElement>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const lastEventIndexRef = useRef(0);

    const isArtisticMode = !!correctedResult.musicGenerationPrompt;
    const scanPatternName = correctedResult.scanPattern?.name || t('results.unknown_pattern') || "Pattern Sconosciuto";
    const isManualScan = useMemo(() => scanPatternName.startsWith("Manuale:") || scanPatternName.startsWith("Manual:"), [scanPatternName]);
    const isPro = !!user?.isPro || !!user?.isAdmin;
    const displayImage = correctedResult.standardizedImageUrl;
    const safeHash = correctedResult.imageHash || "unknown_hash";
    const safeDuration = correctedResult.audioOutput?.duration || 0;

    const healthData: HealthClassificationResult | null = useMemo(() => {
        if (correctedResult.healthClassification) {
            return correctedResult.healthClassification;
        }
        if (correctedResult.configUsed?.useHealthAgent && correctedResult.blockAnalysisResult?.globalStats) {
            return classifyHealthCategories(
                correctedResult.blockAnalysisResult.globalStats,
                (correctedResult as any).description || ""
            );
        }
        return null;
    }, [correctedResult]);

    const calculateImageRect = useCallback(() => {
        if (!imageRef.current || !containerRef.current) return;
        const { naturalWidth, naturalHeight } = imageRef.current;
        const { clientWidth: cW, clientHeight: cH } = containerRef.current;
        if (naturalWidth === 0 || cW === 0) return;
        const imgAspect = naturalWidth / naturalHeight;
        const cAspect = cW / cH;
        let rW, rH, x, y;
        if (imgAspect > cAspect) { rW = cW; rH = cW / imgAspect; x = 0; y = (cH - rH) / 2; }
        else { rH = cH; rW = cH * imgAspect; y = 0; x = (cW - rW) / 2; }
        setImageRenderInfo({ x, y, width: rW, height: rH });
    }, []);

    useEffect(() => {
        const imageEl = imageRef.current; const containerEl = containerRef.current;
        if (!imageEl || !containerEl) return;
        const handleLoad = () => calculateImageRect();
        imageEl.addEventListener('load', handleLoad);
        const resizeObserver = new ResizeObserver(calculateImageRect);
        resizeObserver.observe(containerEl);
        if (imageEl.complete) handleLoad();
        return () => { imageEl.removeEventListener('load', handleLoad); resizeObserver.disconnect(); };
    }, [calculateImageRect, displayImage]);

    // Exclude accompaniment and any events mapped to filler blocks so highlights stay inside the real image area
    const melodyEvents = useMemo(() => (correctedResult.audioOutput?.events || []).filter(e => e.isAccompaniment !== true && !e.sourceBlock?.isFiller), [correctedResult.audioOutput]);

    useEffect(() => {
        if (!isPlaying || playbackTime < 0 || melodyEvents.length === 0) return;
        let searchStartIndex = lastEventIndexRef.current;
        if (playbackTime < (melodyEvents[searchStartIndex]?.time || 0)) searchStartIndex = 0;
        let newEventIndex = -1;
        for (let i = searchStartIndex; i < melodyEvents.length; i++) {
            if (melodyEvents[i].time + melodyEvents[i].duration > playbackTime) { newEventIndex = i; break; }
        }
        if (newEventIndex === -1 && playbackTime >= safeDuration) newEventIndex = melodyEvents.length - 1;
        if (newEventIndex !== -1 && melodyEvents[newEventIndex]) {
            if (!activeEvent || activeEvent.time !== melodyEvents[newEventIndex].time) { setActiveEvent(melodyEvents[newEventIndex]); }
            lastEventIndexRef.current = newEventIndex;
        }
    }, [playbackTime, isPlaying, safeDuration, melodyEvents, activeEvent]);

    const handleTimeUpdate = useCallback((time: number) => setPlaybackTime(time), []);
    const handlePlay = () => setIsPlaying(true);
    const handleStop = () => { setIsPlaying(false); if (audioRef.current && audioRef.current.ended) { setActiveEvent(null); lastEventIndexRef.current = 0; } };

    // LOGICA COPIA PROMPT AGGIORNATA
    const copyPrompt = () => {
        if (!correctedResult.musicGenerationPrompt) return;
        let textToCopy = "";
        switch (activePromptTab) {
            case 'suno': textToCopy = correctedResult.musicGenerationPrompt.suno_prompt; break;
            case 'udio': textToCopy = correctedResult.musicGenerationPrompt.udio_prompt; break;
            case 'soundverse': textToCopy = correctedResult.musicGenerationPrompt.soundverse_prompt || correctedResult.musicGenerationPrompt.technical_parameters; break;
        }
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            setConfirmModal({
                isOpen: true,
                title: "Prompt Copiato",
                message: `Il prompt per ${activePromptTab.toUpperCase()} è stato copiato negli appunti!`,
                type: 'success',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    const handleVideoAction = () => { if (generatedVideoBlob) { saveAs(generatedVideoBlob, `kinetic_proof_${safeHash.substring(0, 8)}.mp4`); } else { setIsVideoModalOpen(true); } };
    const startVideoGeneration = async () => {
        // Credit check for video (cost 5)
        if (!isPro && user) {
            const cost = 5;
            if ((user.credits || 0) < cost) {
                setConfirmModal({
                    isOpen: true,
                    title: "Crediti Video Insufficienti",
                    message: `Ti servono ${cost} crediti per generare il video (Qualità Cinema). Hai ${user.credits || 0} crediti.`,
                    type: 'warning',
                    onConfirm: () => { onRequestAccess(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }
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
                    message: e.message || "Impossibile scalare i crediti per il video.",
                    type: 'danger',
                    singleButton: true,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
                return;
            }
        }

        setIsVideoModalOpen(false); setIsVideoRendering(true); setVideoProgress(0);
        try {
            // Assicuriamoci di avere il blob audio prima di generare il video (fondamentale per la cronologia)
            const audioBlob = await fetchBlobIfMissing(correctedResult.audioOutput.audioWavBlob, correctedResult.audioOutput.audioUrl || "");
            const resultWithBlob = {
                ...correctedResult,
                audioOutput: {
                    ...correctedResult.audioOutput,
                    audioWavBlob: audioBlob
                }
            };

            const blob = await generateSonificationVideo(resultWithBlob, (p) => setVideoProgress(p), {
                title: videoTitle,
                author: videoAuthor,
                description: workDescription,
                cursorType: cursorType,
                events: correctedResult.audioOutput.events
            });
            setGeneratedVideoBlob(blob);
            if (onVideoGenerated) onVideoGenerated(blob);
            const dateStr = new Date().toISOString().slice(0, 10);
            // REMOVED: saveAs(blob, `${sanitizedTitle}_${dateStr}.mp4`); 
            // We now keep it in state and the user can download it manually if they want, 
            // or it will be uploaded to the server when they click "SAVE" project.
        } catch (e) {
            console.error(e);
            setConfirmModal({
                isOpen: true,
                title: "Errore Video",
                message: "Errore video: " + (e instanceof Error ? e.message : String(e)),
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally { setIsVideoRendering(false); }
    };
    const fetchBlobIfMissing = async (blob: Blob, url: string): Promise<Blob> => {
        if (blob && blob.size > 0) return blob;
        if (url && url.length > 0) {
            try {
                const response = await fetch(url);
                return await response.blob();
            } catch (e) {
                console.error("Error fetching blob from URL:", e);
            }
        }
        return new Blob();
    };

    const handleDownloadSac = async () => {
        if (!isOwner && !user?.isAdmin) {
            setConfirmModal({
                isOpen: true,
                title: "Accesso Negato",
                message: "Solo l'autore può scaricare i file sorgente di questa opera.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }
        try {
            const canvas = new OffscreenCanvas(512, 512); const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const img = new Image(); img.src = correctedResult.standardizedImageUrl; await new Promise(r => { img.onload = r; });
            ctx?.drawImage(img, 0, 0, 512, 512);

            // Ensure we have the audio blob
            const audioBlob = await fetchBlobIfMissing(correctedResult.audioOutput.audioWavBlob, correctedResult.audioOutput.audioUrl || "");
            const midiBlob = correctedResult.audioOutput.midiBlob;

            const sacContainer = await createSacContainer({
                imageHash: correctedResult.imageHash,
                audioHash: correctedResult.audioHash,
                config: correctedResult.configUsed,
                blockAnalysisResult: correctedResult.blockAnalysisResult,
                culturalSelectionResult: correctedResult.culturalSelectionResult,
                transformedEvents: correctedResult.audioOutput.events.filter(e => !e.isAccompaniment),
                canvas: canvas,
                audioWavBlob: audioBlob,
                midiBlob: midiBlob,
                totalDuration: correctedResult.audioOutput.duration,
                scanPattern: correctedResult.scanPattern,
                videoBlob: generatedVideoBlob || undefined,
                title: workTitle // ADDED TITLE HERE
            });
            const cleanTitle = workTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            saveAs(sacContainer.blob, `${cleanTitle}.sac`);
        } catch (e) {
            console.error("SAC failed", e);
            if (correctedResult.sacContainer?.blob) {
                const cleanTitle = (workTitle || correctedResult.title || 'sonification').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                saveAs(correctedResult.sacContainer.blob, `${cleanTitle}.sac`);
            } else {
                setConfirmModal({
                    isOpen: true,
                    title: "Errore SAC",
                    message: "Errore durante la creazione del container SAC.",
                    type: 'danger',
                    singleButton: true,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
            }
        }
    };

    const handleDownloadWav = async () => {
        if (!isOwner && !user?.isAdmin) {
            setConfirmModal({
                isOpen: true,
                title: "Accesso Negato",
                message: "Solo l'autore può scaricare i file audio originali.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }
        const blob = await fetchBlobIfMissing(correctedResult.audioOutput.audioWavBlob, correctedResult.audioOutput.audioUrl || "");
        if (blob.size > 0) {
            const cleanTitle = workTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            saveAs(blob, `${cleanTitle}.wav`);
        } else {
            setConfirmModal({
                isOpen: true,
                title: "Download",
                message: "Audio non disponibile per il download.",
                type: 'warning',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    // *** FORENSIC PACKAGE DOWNLOAD ***
    const handleDownloadForensicPackage = async () => {
        if (!isOwner && !user?.isAdmin) {
            setConfirmModal({
                isOpen: true,
                title: "Accesso Negato",
                message: "Solo l'autore può generare e scaricare il pacchetto forense.",
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }
        try {
            // Check if original file metadata is available
            if (!correctedResult.originalFileMetadata) {
                setConfirmModal({
                    isOpen: true,
                    title: "Metadati Mancanti",
                    message: "I metadati del file originale non sono disponibili. Questa funzionalità richiede una nuova sonificazione.",
                    type: 'warning',
                    singleButton: true,
                    onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                });
                return;
            }

            // Get all required blobs
            const audioBlob = await fetchBlobIfMissing(correctedResult.audioOutput.audioWavBlob, correctedResult.audioOutput.audioUrl || "");

            // Create the forensic package
            const packageBlob = await createForensicPackage({
                originalBlob: correctedResult.originalFileMetadata.originalBlob!,
                originalMetadata: correctedResult.originalFileMetadata,
                result: correctedResult,
                title: workTitle
            });

            const cleanTitle = workTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            saveAs(packageBlob, `${cleanTitle}.sac`);

            setConfirmModal({
                isOpen: true,
                title: "🛡️ Pacchetto Forense Creato",
                message: "Il pacchetto .sac contiene il file originale certificato e tutti i dati per la verifica futura dell'autenticità.",
                type: 'success',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });

        } catch (e) {
            console.error("Forensic package creation failed:", e);
            setConfirmModal({
                isOpen: true,
                title: "Errore Pacchetto Forense",
                message: `Errore durante la creazione del pacchetto: ${e instanceof Error ? e.message : 'Errore sconosciuto'}`,
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    const visualProfile = useMemo(() => {
        const stats = correctedResult.blockAnalysisResult?.globalStats || { avg_L: 0, avg_saturation: 0, hue_diversity: 0 };
        const sat = stats.avg_saturation > 1 ? stats.avg_saturation : stats.avg_saturation * 100;
        const hue = stats.hue_diversity > 1 ? stats.hue_diversity : stats.hue_diversity * 100;
        return { lightness: stats.avg_L, saturation: sat, hueDiversity: hue };
    }, [correctedResult]);

    const audioProfile = useMemo(() => {
        const events = correctedResult.audioOutput?.events?.filter(e => !e.isAccompaniment) || [];
        if (events.length === 0) return { pitch: { low: 0, mid: 0, high: 0 }, dynamics: { soft: 0, mid: 0, loud: 0 } };
        let low = 0, midPitch = 0, high = 0; let soft = 0, midDynamics = 0, loud = 0;
        events.forEach(event => { if (event.midiFloat < 60) low++; else if (event.midiFloat < 84) midPitch++; else high++; if (event.velocity < 43) soft++; else if (event.velocity < 86) midDynamics++; else loud++; });
        const total = events.length;
        return { pitch: { low: (low / total) * 100, mid: (midPitch / total) * 100, high: (high / total) * 100 }, dynamics: { soft: (soft / total) * 100, mid: (midDynamics / total) * 100, loud: (loud / total) * 100 } };
    }, [correctedResult]);

    const culturalName = correctedResult.culturalSelectionResult?.tradition?.name || t('results.unknown') || "Sconosciuta";
    const culturalFamily = correctedResult.culturalSelectionResult?.tradition?.cultural_family || t('results.generic') || "Generica";
    const culturalScore = correctedResult.culturalSelectionResult?.scoreBreakdown?.total || 0;


    // Framework v1.0 standard: Fixed 512x512 container
    // But imageBounds should reflect the ACTUAL image area within the canvas (excluding letterbox)
    const imageBounds = useMemo(() => {
        // Use original aspect ratio if available
        let aspectRatio = originalAspectRatio || 1;
        if (!originalAspectRatio && imageRef.current && imageRef.current.naturalWidth) {
            aspectRatio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
        }

        let dw = 512, dh = 512;
        if (aspectRatio > 1) {
            // Landscape: height is smaller
            dh = 512 / aspectRatio;
        } else if (aspectRatio < 1) {
            // Portrait: width is smaller
            dw = 512 * aspectRatio;
        }

        const dx = (512 - dw) / 2;
        const dy = (512 - dh) / 2;
        return { x: dx, y: dy, width: dw, height: dh };
    }, [originalAspectRatio]);

    // Content bounds (actual image area inside the black box)
    // Used for rendering overlays correctly if needed, though scan covers all.
    const contentBounds = useMemo(() => {
        if (correctedResult.blockAnalysisResult?.blocks) {
            const blocks = correctedResult.blockAnalysisResult.blocks;
            let minX = 999, minY = 999, maxX = 0, maxY = 0;
            let found = false;
            blocks.forEach((b: any) => {
                if (!b.isFiller) {
                    found = true;
                    minX = Math.min(minX, b.position.x);
                    minY = Math.min(minY, b.position.y);
                    maxX = Math.max(maxX, b.position.x);
                    maxY = Math.max(maxY, b.position.y);
                }
            });
            return found ? { minX, minY, maxX, maxY } : undefined;
        }
        return undefined;
    }, [correctedResult.blockAnalysisResult]);


    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || !imageRef.current || !correctedResult.blockAnalysisResult || !imageBounds) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
            setHoverEvent(null);
            return;
        }

        const gridSize = correctedResult.blockAnalysisResult.gridSize || 32;
        const blocks = correctedResult.blockAnalysisResult.blocks || [];

        // Framework v1.0: Square Mapping
        const normX = mouseX / rect.width;
        const normY = mouseY / rect.height;

        const blockX = Math.min(Math.floor(normX * gridSize), gridSize - 1);
        const blockY = Math.min(Math.floor(normY * gridSize), gridSize - 1);

        // Trova il blocco corrispondente
        const block = blocks.find(b =>
            b.position.x === blockX &&
            b.position.y === blockY
        );

        if (block && !block.isFiller) {
            // Logic remains same...
            const event = melodyEvents.find(e =>
                e.sourceBlock?.position.x === blockX &&
                e.sourceBlock?.position.y === blockY
            ) || {
                time: 0,
                duration: 0,
                baseNote: 60,
                noteName: "C",
                midiFloat: 60,
                velocity: 100,
                sourceBlock: block,
                isAccompaniment: false
            } as TransformedNoteEvent;

            setHoverEvent(event);
        } else {
            setHoverEvent(null);
        }
    }, [correctedResult.blockAnalysisResult, melodyEvents, imageBounds]);

    const handleMouseLeave = useCallback(() => {
        setHoverEvent(null);
    }, []);

    // L'evento attivo ha priorità: se sta suonando usa activeEvent, altrimenti usa hoverEvent
    const displayEvent = isPlaying ? activeEvent : (hoverEvent || activeEvent);

    // Determine container styles based on image state
    // For new images, use full width, auto height. For loading, square placeholder.
    const containerStyle = {
        // If image is loaded, we let the image define height.
        // But to prevent CLS, maybe aspect-ratio?
    };

    return (
        <div className="animate-fade-in">
            {/* Titolo Principale dell'Opera */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-grow">
                    {!isHistoryView ? (
                        <div className="group relative">
                            <label className="block text-[10px] font-black text-brand-accent uppercase mb-1 tracking-widest flex items-center gap-2">
                                <i className="fas fa-edit"></i>
                                {t('results.work_name') || "Nome dell'opera"}
                            </label>
                            <input
                                type="text"
                                className={`w-full md:max-w-2xl bg-white/5 border-b-2 p-2 text-2xl md:text-3xl font-black text-white font-display outline-none transition-all placeholder:text-white/10 notranslate ${hasSaved ? 'border-green-500/50' : 'border-brand-accent/30 focus:border-brand-accent focus:bg-white/10'}`}
                                placeholder={t('results.enter_name') || "Inserisci un nome..."}
                                value={workTitle}
                                onChange={(e) => { setWorkTitle(e.target.value); setHasSaved(false); }}
                            />
                            {/* DESCRIPTION INPUT */}
                            <div className="mt-4 md:max-w-2xl">
                                <label className="block text-[10px] font-black text-brand-text-secondary uppercase mb-1 tracking-widest flex items-center gap-2">
                                    <i className="fas fa-align-left"></i>
                                    Descrizione (Opzionale)
                                </label>
                                <textarea
                                    className={`w-full bg-white/5 border-l-2 p-2 text-xs md:text-sm text-gray-300 font-mono outline-none transition-all placeholder:text-white/10 h-20 resize-none notranslate ${hasSaved ? 'border-green-500/50' : 'border-brand-accent/30 focus:border-brand-accent focus:bg-white/10'}`}
                                    placeholder="Aggiungi una breve descrizione per il video generativo..."
                                    value={workDescription}
                                    onChange={(e) => { setWorkDescription(e.target.value); setHasSaved(false); }}
                                />
                            </div>

                            <p className="text-[10px] text-brand-text-secondary uppercase tracking-[0.2em] font-bold mt-2 flex items-center gap-2">
                                {hasSaved && <i className="fas fa-check text-green-500"></i>}
                                {isHistoryView ? "Archivio Sonificazione" : (hasSaved ? "Sonificazione Salvata (Modifica per salvare nuova copia)" : "Nuova Sonificazione Generata")}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white font-display flex items-center gap-3">
                                <i className="fas fa-file-audio text-brand-accent"></i>
                                {workTitle}
                            </h2>
                            <p className="text-[10px] text-brand-text-secondary uppercase tracking-[0.2em] font-bold mt-1">
                                {isHistoryView ? "Archivio Sonificazione" : "Sonificazione Salvata"}
                            </p>
                        </div>
                    )}
                </div>
                {!isHistoryView && !hasSaved && (
                    <div className="flex items-center gap-2 bg-brand-accent/10 px-4 py-2 rounded-full border border-brand-accent/20 self-start md:self-center">
                        <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></span>
                        <span className="text-xs font-black text-brand-accent uppercase tracking-widest">{t('results.unsaved') || "DA SALVARE"}</span>
                    </div>
                )}
            </div>

            {
                isVideoModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4 notranslate">
                        <div className="bg-brand-secondary p-6 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full animate-zoom-in" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-video text-brand-accent"></i>
                                {t('results.video_modal_title') || "Prova Forense Cinetica"}
                                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded ml-2 shadow-lg animate-pulse">V4.0 REBUILD</span>
                            </h3>
                            <p className="text-sm text-brand-text-secondary mb-6">{t('results.video_modal_desc') || "Generazione del file MP4 che certifica la causalità tra pixel e suono."}</p>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('results.video_title_label') || "Titolo"}</label>
                                    <input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">{t('results.video_author_label') || "Autore"}</label>
                                    <input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none" value={videoAuthor} onChange={e => setVideoAuthor(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Descrizione</label>
                                    <textarea
                                        className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none resize-none h-20 text-xs"
                                        value={workDescription}
                                        onChange={e => setWorkDescription(e.target.value)}
                                        placeholder="Descrizione dell'opera..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsVideoModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-bold text-brand-text-secondary hover:text-white hover:bg-white/10 transition-colors">
                                    {t('dashboard.cancel')}
                                </button>
                                <button onClick={startVideoGeneration} className="px-6 py-2 rounded-md text-sm font-bold bg-brand-accent text-brand-primary hover:bg-brand-accent-light transition-colors shadow-lg">
                                    <i className="fas fa-fingerprint mr-2"></i> {t('results.video_render') || "Renderizza"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isVideoRendering && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md notranslate">
                        <div className="bg-brand-secondary p-8 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full text-center">
                            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto mb-6"></div>
                            <h3 className="text-2xl font-bold text-white mb-2">{t('results.video_audit') || "Video Forense..."}</h3>
                            <p className="text-brand-text-secondary text-sm mb-6">{t('results.video_time_est') || "Tempo stimato"}: <span className="notranslate">{(safeDuration / 60).toFixed(1)} min.</span></p>
                            <div className="w-full bg-brand-primary rounded-full h-4 border border-brand-secondary overflow-hidden">
                                <div className="bg-brand-accent h-full transition-all duration-200 ease-linear" style={{ width: `${videoProgress}%` }}></div>
                            </div>
                            <p className="mt-2 text-xs font-mono text-brand-accent-light notranslate">{Math.round(videoProgress)}%</p>
                        </div>
                    </div>
                )
            }

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3 space-y-4">
                    {/* Main Analysis View Container - Auto Height based on Image */}
                    <div
                        ref={containerRef}
                        className="relative w-full rounded-md overflow-hidden border border-brand-secondary group bg-black/20"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <img
                            ref={imageRef}
                            src={displayImage}
                            alt="Analysis View"
                            className="w-full h-auto block"
                        />

                        {/* Overlay Layer - Absolute positioning over the image */}
                        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                            {/* Debug/Info Badge */}
                            <div className="absolute top-2 right-2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <span className="bg-black/70 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-sm pointer-events-auto">
                                    {t('results.view_analysis') || "Vista Analisi (512px)"}
                                </span>
                            </div>

                            {/* NOTE: We pass the FULL container rect (0,0, w, h) to overlays now because the image fills it.
                                In ScanPathOverlay, we must ensure it scales to this rect.
                                If ScanPathOverlay uses grid coordinates, it should work if we pass correct imageRect.
                             */}
                            {/* Uses rendered dimensions from ResizeObserver or simply 100% width/height logic depending on implementation. 
                                 However, ScanPathOverlay prop 'imageRect' expects {x,y,width,height} relative to parent SVG logic usually?
                                 Actually ScanPathOverlay usually renders an SVG. 
                                 Let's check if we have imageRenderInfo. 
                                 Since we removed the 'imageRenderInfo' calculation block in this replacement, we need to supply 
                                 an equivalent object that represents "The whole image area".
                                 Since the overlay is absolute inset-0, the "image area" is 100% of the parent. 
                                 We can pass null/undefined if the component supports auto-sizing, 
                                 OR we pass the actual pixel dimensions of the container if we track them.
                                 
                                 But wait, ScanPathOverlay needs pixel coords to draw lines? 
                                 If it uses percentages, we are good.
                                 
                                 Looking at previous usage: imageRenderInfo was passed.
                                 We can reconstruct imageRenderInfo as "relative" coords 0,0 and 100%, 100% effectively.
                                 BUT ScanPathOverlay might expect pixel values for strokeWidth etc.
                                 
                                 Let's imply that imageRenderInfo is {x:0, y:0, width: containerWidth, height: containerHeight}.
                                 We can measure this via ref, OR just render the SVG with 100% width/height and viewBox.
                             */}

                            {correctedResult.blockAnalysisResult && Array.isArray(correctedResult.blockAnalysisResult.blocks) && (
                                <ScanPathOverlay
                                    blocks={correctedResult.blockAnalysisResult.blocks}
                                    gridSize={correctedResult.blockAnalysisResult.gridSize}
                                    imageRect={imageRenderInfo} // We need to keep imageRenderInfo state or ref ref logic
                                />
                            )}
                            <CursorHighlight
                                gridSize={correctedResult.blockAnalysisResult?.gridSize || 32}
                                imageRect={imageRenderInfo}
                                activeBlockPosition={displayEvent?.sourceBlock?.position ?? null}
                                contentBounds={contentBounds}
                            />
                        </div>
                    </div>
                    <CursorLoupe activeEvent={displayEvent} isPlaying={isPlaying} />
                </div>

                <div className="lg:col-span-2 bg-brand-secondary/50 p-6 rounded-lg">
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-palette text-brand-accent"></i><span>{t('results.chromatic_profile')}</span></h4>
                            <div className="space-y-3">
                                <StatBar label={t('results.lightness')} value={visualProfile.lightness} colorClass="bg-gray-300" />
                                <StatBar label={t('results.saturation')} value={visualProfile.saturation} colorClass="bg-brand-accent-light" />
                                <StatBar label={t('results.hue_diversity')} value={visualProfile.hueDiversity} colorClass="bg-purple-500" />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-music text-brand-accent"></i><span>{t('results.sound_profile')}</span></h4>
                            <div className="space-y-4">
                                <div>
                                    <h5 className="text-sm text-brand-text-secondary mb-2">{t('results.pitch')}</h5>
                                    <div className="space-y-2">
                                        <StatBar label={t('results.low')} value={audioProfile.pitch.low} colorClass="bg-teal-700" />
                                        <StatBar label={t('results.mid')} value={audioProfile.pitch.mid} colorClass="bg-teal-500" />
                                        <StatBar label={t('results.high')} value={audioProfile.pitch.high} colorClass="bg-teal-300" />
                                    </div>
                                </div>
                                <div className="bg-brand-primary/30 p-3 rounded-lg border border-brand-secondary">
                                    <div className="flex flex-col gap-2 mb-2">
                                        <h5 className="text-[10px] text-brand-accent text-center font-black uppercase tracking-[0.2em] mb-1">
                                            {audioSource === 'custom' ? (t('results.audio_source_custom') || "Audio Pubblicazione (AI)") :
                                                (audioSource === 'original' ? (t('results.audio_source_original') || "Originale SAC (WAV)") :
                                                    (t('results.audio_source_synth') || "Traduzione Tecnica (Synth)"))}
                                        </h5>
                                        <div className="flex justify-center gap-2 mb-2 flex-wrap">
                                            <button
                                                onClick={() => setAudioSource('synth')}
                                                className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${audioSource === 'synth' ? 'bg-brand-accent text-brand-primary' : 'bg-white/5 text-gray-500'}`}
                                                title="Ascolta la traduzione tecnica pura"
                                            >
                                                <i className="fas fa-microchip mr-1"></i> Synth
                                            </button>
                                            {correctedResult.audioOutput.originalArchivedUrl && (
                                                <button
                                                    onClick={() => setAudioSource('original')}
                                                    className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${audioSource === 'original' ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-500'}`}
                                                    title="Ascolta l'audio originale SAC (WAV)"
                                                >
                                                    <i className="fas fa-wave-square mr-1"></i> Originale
                                                </button>
                                            )}
                                            {correctedResult.audioOutput.customAudioUrl && (
                                                <button
                                                    onClick={() => setAudioSource('custom')}
                                                    className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${audioSource === 'custom' ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-500'}`}
                                                    title="Ascolta l'audio elaborato per la pubblicazione"
                                                >
                                                    <i className="fas fa-music mr-1"></i> Pubblicazione
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <AudioPlayer
                                        audioRef={audioRef}
                                        audioUrl={
                                            audioSource === 'custom' ? (correctedResult.audioOutput.customAudioUrl || "") :
                                                audioSource === 'original' ? (correctedResult.audioOutput.originalArchivedUrl || "") :
                                                    (correctedResult.audioOutput.audioUrl || "")
                                        }
                                        onTimeUpdate={handleTimeUpdate}
                                        onPlay={handlePlay}
                                        onStop={handleStop}
                                    />
                                    {/* DEBUG: Show filename to confirm source */}
                                    <div className="text-[9px] text-gray-600 font-mono text-center mt-1 truncate max-w-full opacity-50 hover:opacity-100 transition-opacity">
                                        Playing: {
                                            (audioSource === 'custom' ? (correctedResult.audioOutput.customAudioUrl || "") :
                                                audioSource === 'original' ? (correctedResult.audioOutput.originalArchivedUrl || "") : "Synth (Generated)")
                                                .split('/').pop()?.split('?')[0]
                                        }
                                    </div>
                                    <MusicSheet activeEvent={displayEvent} />
                                    <div className="flex gap-3 mt-4 pt-3 border-t border-brand-secondary/30">
                                        <button onClick={handleClose} className={`flex-1 ${isHistoryView ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'} py-2 rounded text-xs font-bold transition-colors ${isHistoryView ? '' : 'border border-red-500/30'} flex items-center justify-center gap-2`}>
                                            <i className={`fas ${isHistoryView ? 'fa-arrow-left' : 'fa-times'}`}></i>
                                            {isHistoryView ? t('results.back_to_list') : (t('results.close') || "CHIUDI")}
                                        </button>
                                        {!isHistoryView && (
                                            <button
                                                onClick={handleSaveClick}
                                                disabled={hasSaved || isSaving}
                                                className={`flex-1 ${hasSaved ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-brand-accent text-brand-primary hover:bg-brand-accent-light'} py-2 rounded text-xs font-black transition-colors border-none flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/10`}
                                            >
                                                {isSaving ? (
                                                    <span className="notranslate"><i className="fas fa-spinner fa-spin"></i> {t('results.saving') || "SALVATAGGIO..."}</span>
                                                ) : (
                                                    hasSaved ? <span className="notranslate"><i className="fas fa-check"></i> {t('results.saved') || "SALVATO"}</span> : <span className="notranslate"><i className="fas fa-save"></i> {t('showcase.save') || "SALVA"}</span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* --- SEZIONE CLASSIFICAZIONE TERAPEUTICA WHO HEALTH AGENT --- */}
                {healthData && (
                    <InfoCard
                        title="WHO Health Agent — Classificazione Terapeutica Visiva"
                        icon="fa-heart-pulse"
                        className="lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-emerald-950/40 via-teal-950/20 to-black border-emerald-500/40 shadow-xl shadow-emerald-950/20"
                    >
                        <div className="space-y-6">
                            {/* INTESTAZIONE E CATEGORIA PRIMARIA */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                                        <i className="fas fa-bullseye text-sm animate-pulse"></i>
                                        Categoria Terapeutica Primaria Identificata
                                    </div>
                                    <h3 className="text-xl font-extrabold text-white flex items-center gap-3">
                                        {healthData.primaryCategory.label}
                                        <span className="text-sm px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold">
                                            {(healthData.primaryCategory.score * 100).toFixed(0)}% Rilevanza
                                        </span>
                                    </h3>
                                    <p className="text-xs text-emerald-200/80 italic">
                                        {healthData.primaryCategory.visualReason}
                                    </p>
                                </div>
                                <div className="bg-black/40 px-4 py-2 rounded-lg border border-emerald-500/30 text-right">
                                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Linee Guida Attive</span>
                                    <span className="text-xs font-mono font-bold text-emerald-300">
                                        {healthData.activeCategories.length} su 5 Categorie WHO
                                    </span>
                                </div>
                            </div>

                            {/* GRIGLIA BARRE DELLE 5 CATEGORIE WHO */}
                            <div>
                                <h5 className="text-xs uppercase font-bold text-gray-300 mb-3 flex items-center gap-2">
                                    <i className="fas fa-chart-bar text-emerald-400"></i>
                                    Profilo delle 5 Categorie WHO (Health Evidence Network Report 67)
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {healthData.allScores.map((scoreObj) => {
                                        const isActive = scoreObj.score >= 0.3;
                                        const isPrimary = scoreObj.category === healthData.primaryCategory.category;
                                        const pct = Math.round(scoreObj.score * 100);
                                        return (
                                            <div
                                                key={scoreObj.category}
                                                className={`p-3 rounded-lg border transition-all ${
                                                    isPrimary
                                                        ? 'bg-emerald-500/20 border-emerald-400 shadow-md shadow-emerald-500/10'
                                                        : isActive
                                                        ? 'bg-teal-900/20 border-teal-500/30'
                                                        : 'bg-black/30 border-white/5 opacity-50'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center text-xs mb-1 font-bold">
                                                    <span className={isPrimary ? 'text-emerald-300' : isActive ? 'text-teal-200' : 'text-gray-400'}>
                                                        {scoreObj.label.split('/')[0]}
                                                    </span>
                                                    <span className="font-mono text-[11px]">{pct}%</span>
                                                </div>
                                                <div className="w-full bg-black/50 rounded-full h-1.5 mb-2 overflow-hidden border border-white/10">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            isPrimary
                                                                ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                                                                : isActive
                                                                ? 'bg-teal-400'
                                                                : 'bg-gray-600'
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono block text-center ${
                                                    isPrimary
                                                        ? 'bg-emerald-400 text-black font-bold'
                                                        : isActive
                                                        ? 'bg-teal-500/30 text-teal-300'
                                                        : 'bg-white/5 text-gray-500'
                                                }`}>
                                                    {isPrimary ? 'PRIMARIA' : isActive ? 'ATTIVA' : 'NON ATTIVA'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* DIRETTIVA WHO INIETTATA NEL PROMPT */}
                            <div className="bg-black/40 p-4 rounded-xl border border-white/10">
                                <h5 className="text-xs uppercase font-bold text-emerald-400 mb-2 flex items-center gap-2">
                                    <i className="fas fa-file-medical-alt"></i>
                                    Direttiva WHO Specificamente Inviata all'AI
                                </h5>
                                <p className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-line bg-white/5 p-3 rounded-lg border border-white/5">
                                    {healthData.primaryCategory.whoDirective}
                                </p>
                            </div>
                        </div>
                    </InfoCard>
                )}

                {/* --- SEZIONE CONCEPT & AI RIGENERATA CON MULTI-TAB --- */}
                {correctedResult.paradigm?.toLowerCase().trim() !== 'scientific' && correctedResult.musicGenerationPrompt && (
                    <InfoCard title="Prompt per IA" icon="fa-robot" className="lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
                        <div className='grid grid-cols-1 md:grid-cols-12 gap-8'>
                            {/* COLONNA SINISTRA: CONCEPT E RAGIONAMENTO */}
                            <div className='md:col-span-4 space-y-6 border-r border-white/5 pr-6'>
                                <div>
                                    <h5 className="text-brand-text-secondary text-[10px] uppercase font-black mb-2 tracking-widest flex items-center gap-2">
                                        <i className="fas fa-quote-left text-brand-accent/50"></i>
                                        {t('results.concept_ita') || "Concept (Ita)"}
                                    </h5>
                                    <p className="text-sm text-brand-text-primary italic leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5 shadow-inner">
                                        "{correctedResult.musicGenerationPrompt.main_prompt_ita}"
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <h5 className="text-brand-text-secondary text-[10px] uppercase font-black mb-2 tracking-widest flex items-center gap-2">
                                        <i className="fas fa-brain text-brand-accent/50"></i>
                                        {t('results.ai_reason') || "Ragionamento AI"}
                                    </h5>
                                    <p className="text-xs text-brand-text-secondary leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                                        {correctedResult.musicGenerationPrompt.justification}
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <h5 className="text-brand-text-secondary text-[10px] uppercase font-black mb-2 tracking-widest flex items-center gap-2">
                                        <i className="fas fa-microchip text-brand-accent/50"></i>
                                        {t('results.tech_specs') || "Specifiche Tecniche"}
                                    </h5>
                                    <p className="text-xs text-brand-accent font-mono bg-brand-accent/5 p-2 rounded border border-brand-accent/10 text-center">
                                        {correctedResult.musicGenerationPrompt.technical_parameters}
                                    </p>
                                </div>
                            </div>

                            {/* COLONNA DESTRA: PROMPT E SINCRONIZZAZIONE */}
                            <div className='md:col-span-8 space-y-5'>
                                {/* SELETTORE TAB PROMPT */}
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setActivePromptTab('suno')}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'suno' ? 'bg-brand-accent text-brand-primary' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <i className="fas fa-bolt mr-1.5"></i>
                                            SUNO (PROMPT 1)
                                        </button>
                                        <button
                                            onClick={() => setActivePromptTab('udio')}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'udio' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <i className="fas fa-wave-square mr-1.5"></i>
                                            UDIO (PROMPT 2)
                                        </button>
                                        <button
                                            onClick={() => setActivePromptTab('soundverse')}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'soundverse' ? 'bg-emerald-500 text-black font-bold' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <i className="fas fa-compact-disc mr-1.5"></i>
                                            SOUNDVERSE (PROMPT 3)
                                        </button>
                                    </div>
                                    <button
                                        onClick={copyPrompt}
                                        className="px-3 py-1.5 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-brand-primary transition-all rounded-md text-[10px] font-black tracking-tighter uppercase flex items-center gap-2 border border-brand-accent/20"
                                    >
                                        <i className="fas fa-copy"></i> {t('results.copy') || "Copia Prompt"}
                                    </button>
                                </div>

                                {/* AREA TESTO PROMPT DINAMICA */}
                                <div className="relative group">
                                    <div className="absolute -top-2 left-3 px-2 bg-brand-secondary text-[9px] font-black text-brand-text-secondary tracking-widest uppercase z-10 flex items-center gap-2">
                                        <i className="fas fa-arrow-right text-brand-accent animate-pulse"></i>
                                        PROMPT PER IA MUSICALE ({activePromptTab.toUpperCase()})
                                    </div>
                                    <div className="bg-brand-primary/80 p-5 rounded-xl text-sm font-mono break-words border border-brand-accent/20 min-h-[120px] shadow-2xl group-hover:border-brand-accent/40 transition-colors leading-relaxed">
                                        {activePromptTab === 'suno' && (
                                            <span className="text-brand-accent/90">{correctedResult.musicGenerationPrompt.suno_prompt}</span>
                                        )}
                                        {activePromptTab === 'udio' && (
                                            <span className="text-blue-300/90">{correctedResult.musicGenerationPrompt.udio_prompt}</span>
                                        )}
                                        {activePromptTab === 'soundverse' && (
                                            <span className="text-emerald-300/90">
                                                {correctedResult.musicGenerationPrompt.soundverse_prompt || correctedResult.musicGenerationPrompt.technical_parameters}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* SINCRONIZZAZIONE PDC */}
                                <div className="mt-2 bg-black/40 p-4 rounded-xl border border-white/5 border-dashed">
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-brand-text-secondary text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-stopwatch text-brand-accent/50"></i>
                                            {t('results.pdc_lyrics') || "Lyrics (Sincronizzazione PDC)"}
                                            <span className="text-brand-accent/60 lowercase font-bold italic ml-2 border-l border-white/10 pl-2">
                                                <i className="fas fa-level-down-alt mr-1"></i>
                                                Incolla nel campo Lyrics dell'IA
                                            </span>
                                        </h5>
                                        <button
                                            onClick={() => {
                                                if (correctedResult.musicGenerationPrompt?.suno_lyrics) {
                                                    navigator.clipboard.writeText(correctedResult.musicGenerationPrompt.suno_lyrics);
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        title: "Testo Copiato",
                                                        message: "Timestamp di sincronizzazione copiati! Incollali nel campo Lyrics dell'AI per garantire la coerenza con il framework.",
                                                        type: 'success',
                                                        singleButton: true,
                                                        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                                    });
                                                }
                                            }}
                                            className="text-[9px] text-brand-accent hover:text-white transition-colors font-black uppercase flex items-center gap-1.5"
                                        >
                                            <i className="fas fa-magic"></i> {t('results.copy_lyrics') || "Copia Marcatori Sync"}
                                        </button>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded-lg text-[11px] font-mono text-brand-accent/70 leading-relaxed border border-white/10 max-h-24 overflow-y-auto custom-scrollbar">
                                        {correctedResult.musicGenerationPrompt?.suno_lyrics || "[0:00] Intro, [0:30] Sviluppo..."}
                                    </div>
                                </div>

                                {/* TIPS HUD */}
                                <div className="flex items-center gap-4 px-4 py-2 bg-white/5 rounded-lg border border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                        <span>1. Load Sonification WAV</span>
                                    </div>
                                    <i className="fas fa-chevron-right text-[8px] text-white/10"></i>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                        <span>2. Paste Style Tags</span>
                                    </div>
                                    <i className="fas fa-chevron-right text-[8px] text-white/10"></i>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                        <span>3. Paste Sync Markers</span>
                                    </div>
                                    <i className="fas fa-chevron-right text-[8px] text-white/10"></i>
                                    <div className="flex items-center gap-2 text-brand-accent">
                                        <i className="fas fa-check-circle"></i>
                                        <span>GENERATE</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </InfoCard>
                )}

                <InfoCard
                    title={isManualScan ? (t('results.scan_type') || "Tipo Scansione") : t('results.cultural_selection')}
                    icon={isManualScan ? "fa-layer-group" : "fa-globe-americas"}
                >
                    {isManualScan ? (
                        <>
                            <DataRow label={t('results.chosen_pattern') || "Pattern Scelto"} value={<span className="text-brand-accent font-bold">{scanPatternName.replace("Manuale: ", "")}</span>} />
                            <DataRow label={t('results.mode') || "Modalità"} value={t('results.manual') || "Manuale"} />
                            <div className="my-2 border-t border-brand-secondary/50"></div>
                            <p className="text-xs text-brand-text-secondary mb-1 font-bold">{t('results.musical_tradition') || "Tradizione Musicale"}:</p>
                            <DataRow label={t('results.name') || "Nome"} value={culturalName} />
                            <DataRow label={t('results.origin') || "Origine"} value={culturalFamily} />
                        </>
                    ) : (
                        <>
                            <DataRow label={t('results.tradition')} value={culturalName} />
                            <DataRow label={t('results.family')} value={culturalFamily} />
                            <DataRow label={t('results.scan_path')} value={scanPatternName} />
                            <DataRow label={t('results.score')} value={culturalScore.toFixed(4)} />
                        </>
                    )}
                </InfoCard>

                <InfoCard title={t('results.analysis_synthesis')} icon="fa-cogs">
                    <div className="grid grid-cols-2 gap-2">
                        <DataRow label={t('results.grid')} value={`${correctedResult.blockAnalysisResult?.gridSize || 32}x${correctedResult.blockAnalysisResult?.gridSize || 32}`} />
                        <DataRow label={t('results.audio_events')} value={correctedResult.audioOutput?.eventsCount || 0} />
                        <DataRow label={t('results.duration')} value={`${safeDuration.toFixed(2)}s`} />
                        <DataRow label={t('results.audio_quality') || "Qualità Audio"} value="44.1kHz WAV" />
                    </div>
                </InfoCard>

                <InfoCard title={t('results.forensic_certificate')} icon="fa-fingerprint">
                    <div className="grid grid-cols-1 gap-1">
                        <DataRow label={t('results.image_hash')} value={safeHash.substring(0, 16) + '...'} />
                        <DataRow label={t('results.audio_hash')} value={
                            (correctedResult.audioHash && correctedResult.audioHash !== '---')
                                ? correctedResult.audioHash.substring(0, 16) + '...'
                                : ((correctedResult.audioOutput as any)?.audioHash
                                    ? (correctedResult.audioOutput as any).audioHash.substring(0, 16) + '...'
                                    : "---")
                        } />
                        <DataRow label={t('results.framework_ver') || "Framework Ver."} value="1.0" />
                    </div>
                </InfoCard>

                <InfoCard title={t('results.acquisition_details') || "Dettagli Acquisizione"} icon="fa-camera">
                    <div className="space-y-4">
                        <DataRow
                            label={t('results.method') || "Metodo"}
                            value={
                                <span className="capitalize text-white font-bold">
                                    {correctedResult.acquisitionMetadata?.method === 'camera' ? 'Direct Photo' :
                                        correctedResult.acquisitionMetadata?.method === 'upload' ? 'Image Upload' :
                                            'Restored'}
                                </span>
                            }
                        />
                        {correctedResult.acquisitionMetadata?.offsets ? (
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 bg-black/20 p-2 rounded border border-brand-accent/10">
                                <DataRow label="EXP" value={(correctedResult.acquisitionMetadata.offsets.exposure >= 0 ? '+' : '') + correctedResult.acquisitionMetadata.offsets.exposure.toFixed(1)} />
                                <DataRow label="WB" value={(correctedResult.acquisitionMetadata.offsets.whiteBalance >= 0 ? '+' : '') + correctedResult.acquisitionMetadata.offsets.whiteBalance.toFixed(0)} />
                                <DataRow label="CONT" value={(correctedResult.acquisitionMetadata.offsets.contrast >= 0 ? '+' : '') + correctedResult.acquisitionMetadata.offsets.contrast.toFixed(0)} />
                                <DataRow label="STAB" value={(correctedResult.acquisitionMetadata.offsets.stability >= 0 ? '+' : '') + correctedResult.acquisitionMetadata.offsets.stability.toFixed(0)} />
                            </div>
                        ) : (
                            // Fallback for restored items WITHOUT metadata
                            <div className="text-xs text-gray-500 italic mt-2">
                                Dati originali non disponibili per questa voce storica.
                            </div>
                        )}
                    </div>
                </InfoCard>

                <InfoCard title={t('results.performance')} icon="fa-bolt">
                    <DataRow label={t('results.total_time')} value={`${correctedResult.performanceMetrics?.totalProcessingTime?.toFixed(0) || 0} ms`} />
                </InfoCard>

                {/* ARCHIVED VIDEO PLAYER */}
                {((result as any).videoUrl || generatedVideoBlob) && (
                    <InfoCard title={t('results.video_title') || "Esperienza Sinestetica"} icon="fa-video" className="bg-purple-900/20 border-purple-500/30">
                        <div className="rounded-lg overflow-hidden border border-purple-500/20 shadow-lg mb-3">
                            <video
                                src={generatedVideoBlob ? URL.createObjectURL(generatedVideoBlob) : (result as any).videoUrl}
                                controls
                                className="w-full h-auto aspect-video"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className="text-[10px] text-purple-300 italic text-center">
                                {generatedVideoBlob ? "Video generato in questa sessione." : "Video recuperato dall'archivio."}
                            </p>

                            {((result as any).videoUrl) && (
                                <div className="flex justify-center gap-3 py-2 border-t border-white/5 mt-1">
                                    <button onClick={() => copyLink((result as any).videoUrl)} className="text-gray-400 hover:text-white text-sm" title="Copia Link"><i className="fas fa-link"></i></button>
                                    <button onClick={() => setQrUrl((result as any).videoUrl)} className="text-gray-400 hover:text-white text-sm" title="QR Code"><i className="fas fa-qrcode"></i></button>
                                    <button onClick={() => socialShare('whatsapp', (result as any).videoUrl, "Guarda la mia sonificazione su SonificART!")} className="text-green-500 hover:text-green-400 text-sm"><i className="fab fa-whatsapp"></i></button>
                                    <button onClick={() => socialShare('facebook', (result as any).videoUrl, "Guarda la mia sonificazione su SonificART!")} className="text-blue-500 hover:text-blue-400 text-sm"><i className="fab fa-facebook"></i></button>
                                    <button onClick={() => socialShare('linkedin', (result as any).videoUrl, "Guarda la mia sonificazione su SonificART!")} className="text-blue-400 hover:text-blue-300 text-sm"><i className="fab fa-linkedin"></i></button>
                                </div>
                            )}
                        </div>
                    </InfoCard>
                )}

                <InfoCard title={t('results.download_artifacts')} icon="fa-download" className="bg-brand-accent/5 border-brand-accent/20">
                    <div className="flex flex-col gap-2 mt-2 relative">
                        {(!isPro && (user?.credits || 0) <= 0) && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-lg text-center p-4 border border-brand-accent/20">
                                <i className="fas fa-lock text-2xl text-brand-accent mb-2"></i>
                                <button onClick={onRequestAccess} className="px-4 py-1.5 bg-brand-accent text-black text-xs font-bold rounded-full">{t('results.unlock') || "Sblocca"}</button>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                disabled={(!isPro && (user?.credits || 0) <= 0) || (!isOwner && !user?.isAdmin)}
                                onClick={handleDownloadWav}
                                className={`py-2 rounded text-xs font-bold border ${(!isOwner && !user?.isAdmin) ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 'bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border-brand-accent/20'}`}
                                title={(!isOwner && !user?.isAdmin) ? "Solo l'autore può scaricare questo file" : "Scarica Audio WAV"}
                            >
                                <i className={`fas ${(!isOwner && !user?.isAdmin) ? 'fa-lock' : 'fa-file-audio'} mr-2`}></i> WAV
                            </button>
                            <button
                                disabled={(!isPro && (user?.credits || 0) <= 0) || (!isOwner && !user?.isAdmin)}
                                onClick={() => {
                                    if (!isOwner && !user?.isAdmin) {
                                        setConfirmModal({ isOpen: true, title: "Accesso Negato", message: "Solo l'autore può scaricare la notazione MIDI.", type: 'danger', singleButton: true, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
                                        return;
                                    }
                                    saveAs(correctedResult.audioOutput.midiBlob, 'musical_notation.mid');
                                }}
                                className={`py-2 rounded text-xs font-bold border ${(!isOwner && !user?.isAdmin) ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 'bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 border-brand-accent/20'}`}
                                title={(!isOwner && !user?.isAdmin) ? "Solo l'autore può scaricare questo file" : "Scarica MIDI"}
                            >
                                <i className={`fas ${(!isOwner && !user?.isAdmin) ? 'fa-lock' : 'fa-music'} mr-2`}></i> MIDI
                            </button>
                        </div>


                        {/* UNIFIED PRIMARY DOWNLOAD BUTTON (.SAC) */}
                        <button
                            disabled={(!isPro && (user?.credits || 0) <= 0) || (!isOwner && !user?.isAdmin)}
                            onClick={correctedResult.originalFileMetadata ? handleDownloadForensicPackage : handleDownloadSac}
                            className={`w-full py-3 rounded mt-2 shadow-lg disabled:opacity-50 text-[10px] uppercase tracking-widest border font-black text-white ${(!isOwner && !user?.isAdmin) ? 'bg-gray-700 border-gray-600 cursor-not-allowed' : (correctedResult.originalFileMetadata ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/30 shadow-emerald-500/20' : 'bg-brand-accent hover:bg-brand-accent-light border-transparent')}`}
                            title={(!isOwner && !user?.isAdmin) ? "Solo l'autore può scaricare l'archivio completo" : "Scarica Archivio SAC"}
                        >
                            <i className={`fas ${(!isOwner && !user?.isAdmin) ? 'fa-lock' : 'fa-box-open'} mr-2`}></i>
                            SCARICA ARCHIVIO COMPLETO (.SAC)
                            {correctedResult.originalFileMetadata && (
                                <span className="ml-2 text-[8px] bg-white/20 px-1.5 py-0.5 rounded">ORIGINALE CERTIFICATO</span>
                            )}
                        </button>
                    </div>
                </InfoCard>
            </div>

            {qrUrl && (
                <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setQrUrl(null)}>
                    <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 max-w-sm w-full text-center shadow-2xl transform scale-100 transition-all" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">QR CODE VIDEO</h3>
                            <button onClick={() => setQrUrl(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="bg-white p-4 rounded-xl inline-block mb-4">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl.startsWith('http') ? qrUrl : `https://sonificart.com${qrUrl.startsWith('/') ? '' : '/'}${qrUrl}`)}`} alt="QR Code" className="w-full h-full" />
                        </div>
                        <p className="text-xs text-gray-400 break-all bg-black/30 p-2 rounded border border-white/5">{qrUrl}</p>
                        <button onClick={() => copyLink(qrUrl)} className="text-brand-accent text-xs mt-3 hover:underline">Copia Link</button>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );
};
