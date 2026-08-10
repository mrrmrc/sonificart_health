import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { User, DashboardEntry } from '../types';
import { reconstructResultFromPartialData } from '../utils/dataUtils';

interface OutletContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    isUnlimited: boolean;
    setIsLoginModalOpen: (open: boolean) => void;
    setIsRequestAccessOpen: (open: boolean) => void;
}

import { getCulturalTraditions, selectCulturalTradition, determineCulturalScanPattern, generateScanSequence, mapPixelToNote, transformNote, processOrganicAI } from '../services/sonificationService';
import { audioBufferToWav } from '../utils/wavExport';
import saveAs from 'file-saver';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { ProcessingView } from '../components/ProcessingView';
import { SonificationResult, ProcessingStep, ConfigSettings, TransformedNoteEvent, ColorRegion } from '../types';
import { calculateSHA256, bufferToHex } from '../utils/cryptoUtils';
import { api } from '../services/api';



// ─────────────────────────────────────────────────────────────────────────────
//  PARAMETRI DI SCANSIONE (ora dinamici via UI)
// ─────────────────────────────────────────────────────────────────────────────


const InfoCard: React.FC<{ title: string, icon: string, children: React.ReactNode, className?: string }> = ({ title, icon, children, className }) => (
    <div className={`bg-slate-900/80 border border-emerald-500/30 rounded-xl p-6 backdrop-blur-sm ${className || ''}`}>
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-3 border-b border-emerald-500/20 pb-3">
            <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center border border-emerald-500/30 shadow-inner">
                <i className={`fas ${icon} text-emerald-400 text-sm`}></i>
            </div>
            {title}
        </h4>
        {children}
    </div>
);

export const CamPage: React.FC = () => {
    const location = useLocation();
    const [activePromptTab, setActivePromptTab] = useState<'suno' | 'udio' | 'soundverse'>('suno');
    const { user, setUser, isUnlimited, setIsLoginModalOpen, setIsRequestAccessOpen } = useOutletContext<OutletContextType>();

    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing]           = useState(false);
    const [animationMode, setAnimationMode]       = useState<'idle' | 'detach' | 'attach' | 'listen-all'>('idle');
    const [analyzeProgress, setAnalyzeProgress]   = useState<string>('');
    const [regions, setRegions]                   = useState<ColorRegion[]>([]);
    const [currentStep, setCurrentStep]           = useState(0);
    const [selectedRegion, setSelectedRegion]     = useState<ColorRegion | null>(null);
    const [progressPct, setProgressPct]           = useState(0);
    const [totalPixels, setTotalPixels]           = useState(0);
    const [scanPct, setScanPct]                   = useState(0);   // progresso scansione analisi
    const [liveSonificationData, setLiveSonificationData] = useState<{tradition: string, pattern: string, note: string, hex: string} | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    // --- SALVATAGGIO IN GALLERIA ---
    const [workTitle, setWorkTitle] = useState('');
    const [workDescription, setWorkDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const [savedWorkId, setSavedWorkId] = useState<string | null>(null);

    const handleSaveToGallery = async () => {
        if (!user) {
            setIsLoginModalOpen(true);
            return;
        }
        if (!finalResult) return;
        
        setIsSaving(true);
        try {
            const titleToSave = workTitle.trim() || `Opera del ${new Date().toLocaleDateString()}`;
            const res = await api.saveSonification(finalResult, 'ai_composer', titleToSave, workDescription);
            if (res && res.id) setSavedWorkId(res.id);
            setHasSaved(true);
        } catch (e: any) {
            console.error(e);
            if (e.message && e.message.includes("401")) {
                setIsLoginModalOpen(true);
            } else {
                alert(e.message || "Errore durante il salvataggio.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    // --- AI & WHO STATES ---
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [finalResult, setFinalResult] = useState<SonificationResult | null>(null);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProcessingSteps, setAiProcessingSteps] = useState<ProcessingStep[]>([
        { id: 1, name: "Vision AI & Analisi Organica", status: 'pending' },
        { id: 2, name: "Classificazione Clinica WHO", status: 'pending' },
        { id: 3, name: "Generazione Prompt Olistico", status: 'pending' },
        { id: 4, name: "Assemblaggio Certificato Forense (SAC)", status: 'pending' }
    ]);

    useEffect(() => {
        if (location.state?.historyEntry) {
            const entry: DashboardEntry = location.state.historyEntry;
            const fixImg = (url: string) => url.startsWith('data:') || url.startsWith('http') ? url : `data:image/jpeg;base64,${url}`;
            const imgUrl = fixImg(entry.imageUrl || '');
            const restoredResult = reconstructResultFromPartialData(
                entry,
                imgUrl,
                null,
                "project_from_dashboard.sac"
            );
            
            setUploadedImageUrl(imgUrl);
            setUploadedFileName("Opera dal Server");
            setFinalResult(restoredResult);
            setIsAnalyzing(false); 
            
            if (entry.audioUrl) {
                const absoluteAudioUrl = entry.audioUrl.startsWith('http') ? entry.audioUrl : `${window.location.origin}${entry.audioUrl.startsWith('/') ? '' : '/'}${entry.audioUrl}`;
                fetch(absoluteAudioUrl).then(res => res.blob()).then(blob => {
                    setFinalResult(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            audioOutput: {
                                ...prev.audioOutput,
                                audioWavBlob: blob,
                                audioUrl: absoluteAudioUrl
                            }
                        };
                    });
                }).catch(e => console.error("Impossibile recuperare il file audio", e));
            }
        }
    }, [location.state]);

    const [config, setConfig] = useState<ConfigSettings>({
        pixelCount: 512*512, bpm: 108, noteDurationSeconds: 0.1, targetDurationSeconds: 180,
        osc: { enabled: false, host: 'localhost', port: 8080 },
        enableAccompaniment: true, melodyInstrument: 'triangle', accompanimentInstrument: 'sine',
        useHealthAgent: true
    });

    // Parametri dinamici scollamento e 3D
    const [colorTolerance, setColorTolerance] = useState(45);
    const [minRegionPx, setMinRegionPx] = useState(80);
    const [enable3DScan, setEnable3DScan] = useState(false);
    
    // Time-Stretching (Suno/Limit)
    const [targetDurationMax, setTargetDurationMax] = useState<number>(0); // 0 = Naturale (Nessun limite)

    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const cursorCanvasRef = useRef<HTMLCanvasElement>(null); // Nuovo canvas per il cursore in sovraimpressione
    const pixelDataRef   = useRef<Uint8ClampedArray | null>(null);
    const imageDimRef    = useRef({ w: 0, h: 0 });
    const audioCtxRef    = useRef<AudioContext | null>(null);
    const timerRef       = useRef<any>(null);
    const listenAllAbort = useRef<boolean>(false);
    const regionsRef     = useRef<ColorRegion[]>([]);

    // ─────────────────────────────────────────────────────────────────────────
    //  CARICAMENTO IMMAGINE
    // ─────────────────────────────────────────────────────────────────────────
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setOriginalFile(file);
            setUploadedFileName(file.name);
            stopAnimation();
            setRegions([]);
            regionsRef.current = [];
            setCurrentStep(0);
            setProgressPct(0);
            setScanPct(0);
            setSelectedRegion(null);

            const url = URL.createObjectURL(file);
            setUploadedImageUrl(url);

            const img = new Image();
            img.onload = () => {
                // Risoluzione massima 600px — più dettaglio, copertura completa
                const MAX_W = 600;
                const w = Math.min(img.naturalWidth, MAX_W);
                const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
                imageDimRef.current = { w, h };

                const canvas = canvasRef.current!;
                canvas.width  = w;
                canvas.height = h;

                const cCanvas = cursorCanvasRef.current;
                if (cCanvas) {
                    cCanvas.width = w;
                    cCanvas.height = h;
                }

                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);

                const imgData = ctx.getImageData(0, 0, w, h);
                pixelDataRef.current = new Uint8ClampedArray(imgData.data);
                setTotalPixels(w * h);

                runFullScanAnalysis(imgData, w, h);
            };
            img.src = url;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  ANALISI ORGANICA DETERMINISTICA (Flood Fill Colorimetrico 100% Copertura)
    // ─────────────────────────────────────────────────────────────────────────
    const runFullScanAnalysis = (imgData: ImageData, w: number, h: number, overrideTol?: number, overrideMinPx?: number) => {
        setIsAnalyzing(true);
        setAnalyzeProgress('Scansione organica delle forme in corso...');
        setScanPct(0);

        // Usiamo un setTimeout per permettere a React di renderizzare il loading spinner
        setTimeout(() => {
            const data = imgData.data;
            const totalPx = w * h;
            const regionIdMap = new Int32Array(totalPx); // 0 = non visitato
            
            const extractedRegions: ColorRegion[] = [];
            const regionRefMap: ColorRegion[] = []; // O(1) lookup per ID
            
            let regionCounter = 1;
            const BFS_COLOR_TOLERANCE = overrideTol !== undefined ? overrideTol : colorTolerance;
            const BFS_MIN_REGION_PX = overrideMinPx !== undefined ? overrideMinPx : minRegionPx;
            
            // Per BFS/DFS
            const stack = new Int32Array(totalPx);
            let stackSize = 0;
            
            for (let i = 0; i < totalPx; i++) {
                if (regionIdMap[i] !== 0) continue; // Già processato
                
                // Inizia nuova forma
                stack[0] = i;
                stackSize = 1;
                regionIdMap[i] = regionCounter;
                
                const cpx = i * 4;
                const seedR = data[cpx];
                const seedG = data[cpx + 1];
                const seedB = data[cpx + 2];
                
                const pixelList: number[] = [];
                let sumR = 0, sumG = 0, sumB = 0;
                let sumX = 0, sumY = 0;
                let minX = w, maxX = 0, minY = h, maxY = 0;
                
                let adjacentRegionId = 0; // Per assorbire gli orfani
                
                while (stackSize > 0) {
                    const cur = stack[--stackSize];
                    pixelList.push(cur);
                    
                    const cx = cur % w;
                    const cy = Math.floor(cur / w);
                    const curPx = cur * 4;
                    const cR = data[curPx];
                    const cG = data[curPx + 1];
                    const cB = data[curPx + 2];
                    
                    sumR += cR; sumG += cG; sumB += cB;
                    sumX += cx; sumY += cy;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;
                    
                    // 4-connettività
                    const neighbors = [
                        cx > 0 ? cur - 1 : -1,
                        cx < w - 1 ? cur + 1 : -1,
                        cy > 0 ? cur - w : -1,
                        cy < h - 1 ? cur + w : -1
                    ];
                    
                    for (const n of neighbors) {
                        if (n === -1) continue;
                        
                        const nId = regionIdMap[n];
                        if (nId > 0 && nId !== regionCounter) {
                            // Trovato un vicino già assegnato a un'altra regione
                            if (adjacentRegionId === 0) adjacentRegionId = nId;
                            continue;
                        }
                        
                        if (nId === 0) {
                            const npx = n * 4;
                            const dr = data[npx] - seedR;
                            const dg = data[npx + 1] - seedG;
                            const db = data[npx + 2] - seedB;
                            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                            
                            if (dist <= BFS_COLOR_TOLERANCE) {
                                regionIdMap[n] = regionCounter; // Marca subito
                                stack[stackSize++] = n;
                            }
                        }
                    }
                }
                
                const count = pixelList.length;
                
                // Se la regione è troppo piccola e ha un vicino, viene ASSORBITA in O(1)
                if (count < BFS_MIN_REGION_PX && adjacentRegionId > 0) {
                    const targetReg = regionRefMap[adjacentRegionId];
                    if (targetReg) {
                        for (let p = 0; p < count; p++) {
                            const px = pixelList[p];
                            targetReg.pixelIndices!.push(px);
                            regionIdMap[px] = adjacentRegionId;
                        }
                        targetReg.pixelCount += count;
                        // Aggiorna Bounding Box del target
                        if (minX < targetReg.minX) targetReg.minX = minX;
                        if (maxX > targetReg.maxX) targetReg.maxX = maxX;
                        if (minY < targetReg.minY) targetReg.minY = minY;
                        if (maxY > targetReg.maxY) targetReg.maxY = maxY;
                        
                        continue; // Non incrementiamo il contatore e passiamo oltre
                    }
                }
                
                // Crea nuova regione
                if (count > 0) {
                    const avgR = Math.round(sumR / count);
                    const avgG = Math.round(sumG / count);
                    const avgB = Math.round(sumB / count);
                    const hex = '#' + [avgR, avgG, avgB].map(v => v.toString(16).padStart(2, '0')).join('');
                    const lab = rgbToLab(avgR, avgG, avgB);
                    const hsv = rgbToHsv(avgR, avgG, avgB);
                    
                    let baseNote = 0;
                    if (hsv.s > 0.3) {
                        const hAngle = hsv.h;
                        if (hAngle >= 0 && hAngle < 45) baseNote = 0;
                        else if (hAngle >= 45 && hAngle < 75) baseNote = 2;
                        else if (hAngle >= 75 && hAngle < 105) baseNote = 4;
                        else if (hAngle >= 105 && hAngle < 135) baseNote = 5;
                        else if (hAngle >= 135 && hAngle < 195) baseNote = 7;
                        else if (hAngle >= 195 && hAngle < 255) baseNote = 9;
                        else if (hAngle >= 255 && hAngle < 315) baseNote = 11;
                        else baseNote = 0;
                    } else {
                        const vVal = hsv.v;
                        if (vVal <= 36) baseNote = 0;
                        else if (vVal <= 73) baseNote = 2;
                        else if (vVal <= 109) baseNote = 4;
                        else if (vVal <= 145) baseNote = 5;
                        else if (vVal <= 182) baseNote = 7;
                        else if (vVal <= 218) baseNote = 9;
                        else baseNote = 11;
                    }
                    
                    const octaveOffset = Math.floor((lab.l / 100) * 3) - 1;
                    const midi = 60 + baseNote + (octaveOffset * 12);
                    const freq = Math.round(440 * Math.pow(2, (midi - 69) / 12));
                    
                    const newRegion: ColorRegion = {
                        id: regionCounter,
                        idCode: `#${String(extractedRegions.length + 1).padStart(4, '0')}`,
                        r: avgR, g: avgG, b: avgB, hex,
                        pixelIndices: pixelList,
                        pixelCount: count,
                        percentage: parseFloat(((count / totalPx) * 100).toFixed(2)),
                        centroidX: parseFloat(((sumX / count / w) * 100).toFixed(1)),
                        centroidY: parseFloat(((sumY / count / h) * 100).toFixed(1)),
                        minX, maxX, minY, maxY,
                        L: Math.round(lab.l),
                        a: Math.round(lab.a),
                        b_val: Math.round(lab.b),
                        noteName: midiToNote(midi),
                        frequencyHz: freq,
                        isDetached: false,
                        depthLayer: 'middleground' // Placeholder
                    };
                    
                    extractedRegions.push(newRegion);
                    regionRefMap[regionCounter] = newRegion; // O(1) storage
                    regionCounter++;
                }
            }
            
            // Ricalcolo percentuali per regioni che hanno assorbito orfani
            for (const r of extractedRegions) {
                r.percentage = parseFloat(((r.pixelCount / totalPx) * 100).toFixed(2));
            }
            
            // Euristiche 3D Depth
            for (const reg of extractedRegions) {
                const touchesBorder = (reg.minX <= 5 || reg.maxX >= w - 5 || reg.minY <= 5 || reg.maxY >= h - 5);
                const isHuge = reg.pixelCount > (w * h * 0.1); // > 10% dell'immagine
                const cx = reg.centroidX;
                const cy = reg.centroidY;
                const distToCenter = Math.sqrt(Math.pow(cx - 50, 2) + Math.pow(cy - 50, 2));
                
                let score = 0;
                if (touchesBorder) score -= 50;
                if (isHuge) score -= 40;
                if (distToCenter < 25) score += 30; // Al centro
                
                const max = Math.max(reg.r, reg.g, reg.b);
                const min = Math.min(reg.r, reg.g, reg.b);
                const saturation = max === 0 ? 0 : (max - min) / max;
                if (saturation > 0.6) score += 20; // Colori vivi escono
                
                if (score < -20) {
                    reg.depthLayer = 'background';
                } else if (score > 10) {
                    reg.depthLayer = 'foreground';
                } else {
                    reg.depthLayer = 'middleground';
                }
            }

            regionsRef.current = extractedRegions;
            setRegions(extractedRegions);
            setIsAnalyzing(false);
            setScanPct(100);
            setAnalyzeProgress(`✅ Scomposizione organica completata: ${extractedRegions.length} forme estratte`);
            if (extractedRegions.length > 0) setSelectedRegion(extractedRegions[0]);
            
        }, 100); // Piccolo delay per far apparire lo spinner
    };

    const handleRecalculate = (overrideTol?: number, overrideMinPx?: number) => {
        if (!pixelDataRef.current || !canvasRef.current) return;
        const { w, h } = imageDimRef.current;
        const imgData = new ImageData(new Uint8ClampedArray(pixelDataRef.current), w, h);
        runFullScanAnalysis(imgData, w, h, overrideTol, overrideMinPx);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  DECOSTRUCTION & RECONSTRUCTION ANIMATION
    // ─────────────────────────────────────────────────────────────────────────
    const startDetach = () => {
        if (regionsRef.current.length === 0 || animationMode !== 'idle') return;
        
        const rList = regionsRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { w, h } = imageDimRef.current;
        const imgData  = ctx.getImageData(0, 0, w, h);
        const d        = imgData.data;

        for (const region of rList) {
            for (const idx of region.pixelIndices!) {
                d[idx * 4]     = 255;
                d[idx * 4 + 1] = 255;
                d[idx * 4 + 2] = 255;
                d[idx * 4 + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const newRegions = rList.map(r => ({ ...r, isDetached: true }));
        setRegions(newRegions);
        regionsRef.current = newRegions;
        setProgressPct(100);
        setCurrentStep(rList.length);
        if (newRegions.length > 0) setSelectedRegion(newRegions[0]);
    };

    const startAttach = () => {
        if (regionsRef.current.length === 0 || animationMode !== 'idle') return;
        setAnimationMode('attach');

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d')!;
            const { w, h } = imageDimRef.current;
            // Blank canvas to start reconstruction
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        }

        let step = 0;
        setCurrentStep(0);
        setProgressPct(0);
        
        let stepDurationMs = 120;
        const naturalTotalDuration = regionsRef.current.length * 16 * 0.12;
        if (targetDurationMax > 0 && naturalTotalDuration > targetDurationMax) {
            const compressionRatio = targetDurationMax / naturalTotalDuration;
            stepDurationMs = 120 * compressionRatio;
        }

        timerRef.current = setInterval(() => {
            const rList = regionsRef.current;
            if (step >= rList.length) {
                clearInterval(timerRef.current);
                setAnimationMode('idle');
                return;
            }

            const region = rList[step];
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const backup = pixelDataRef.current;
                if (ctx && backup) {
                    const { w, h } = imageDimRef.current;
                    const imgData  = ctx.getImageData(0, 0, w, h);
                    const d        = imgData.data;
                    
                    // Ripristina i pixel originali
                    for (const idx of region.pixelIndices!) {
                        d[idx * 4]     = backup[idx * 4];
                        d[idx * 4 + 1] = backup[idx * 4 + 1];
                        d[idx * 4 + 2] = backup[idx * 4 + 2];
                        d[idx * 4 + 3] = backup[idx * 4 + 3];
                    }
                    ctx.putImageData(imgData, 0, 0);
                }
            }

            playTone(region.frequencyHz);
            setSelectedRegion({ ...region, isDetached: false });
            setCurrentStep(step + 1);
            setProgressPct(Math.round(((step + 1) / rList.length) * 100));
            step++;
        }, stepDurationMs);
    };

    const startListenAll = async () => {
        if (regionsRef.current.length === 0 || animationMode !== 'idle') return;
        setAnimationMode('listen-all');
        listenAllAbort.current = false;

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d')!;
            const { w, h } = imageDimRef.current;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        }

        let regionsToPlay = [...regionsRef.current];
        if (enable3DScan) {
            const depthOrder = { background: 0, middleground: 1, foreground: 2 };
            regionsToPlay.sort((a, b) => depthOrder[a.depthLayer] - depthOrder[b.depthLayer]);
        }

        for (let i = 0; i < regionsToPlay.length; i++) {
            if (listenAllAbort.current) break;
            const region = regionsToPlay[i];
            
            // Seleziona la regione così si illumina e si aggiorna la telemetria
            setSelectedRegion({ ...region, isDetached: true });
            setCurrentStep(i + 1);
            setProgressPct(Math.round(((i + 1) / regionsToPlay.length) * 100));

            await playRegionDeepSound(region);
        }

        if (!listenAllAbort.current) {
            setAnimationMode('idle');
        }
    };

    const exportAudioWav = async () => {
        if (regionsRef.current.length === 0 || animationMode !== 'idle' || isExporting) return;
        setIsExporting(true);

        try {
            const sampleRate = 44100;
            const estimatedDurationSeconds = regionsRef.current.length * 16 * 0.12;
            const totalLength = sampleRate * (estimatedDurationSeconds + 2); 
            const offlineCtx = new window.OfflineAudioContext(1, totalLength, sampleRate);
            const { w } = imageDimRef.current;
            
            let regionsToPlay = [...regionsRef.current];
            if (enable3DScan) {
                const depthOrder = { background: 0, middleground: 1, foreground: 2 };
                regionsToPlay.sort((a, b) => depthOrder[a.depthLayer] - depthOrder[b.depthLayer]);
            }

            // Calcolo Time-Stretching
            let globalNoteDuration = 0.12;
            const naturalTotalDuration = regionsToPlay.length * 16 * 0.12;
            if (targetDurationMax > 0 && naturalTotalDuration > targetDurationMax) {
                globalNoteDuration = targetDurationMax / (regionsToPlay.length * 16);
            }

            let globalTimeOffset = 0; 

            const organicEvents: TransformedNoteEvent[] = [];
            let sumL = 0, sumA = 0, sumB = 0, sumSat = 0, sumHueDiv = 0, sumVar = 0;
            const appliedTraditionNames = new Set<string>();

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            let liveImgData: ImageData | null = null;
            let lastRenderTime = performance.now();
            if (canvas && ctx && pixelDataRef.current) {
                ctx.fillStyle = '#050B14'; // Sfondo blu scuro del tema
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                liveImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }

            for (const region of regionsToPlay) {
                const hsv = rgbToHsv(region.r, region.g, region.b);
                const shapeSizePct = region.pixelCount / (imageDimRef.current.w * imageDimRef.current.h);
                const dynamicHueDiversity = Math.min(1.0, shapeSizePct * 5 + (region.id % 10) / 20);

                const stats = {
                    avg_L: region.L,
                    avg_a: region.a,
                    avg_b: region.b_val,
                    avg_saturation: hsv.s,
                    hue_diversity: dynamicHueDiversity,
                    avg_variance: region.pixelCount > 1000 ? 500 : 50
                };

                sumL += stats.avg_L; sumA += stats.avg_a; sumB += stats.avg_b; 
                sumSat += stats.avg_saturation; sumHueDiv += stats.hue_diversity; sumVar += stats.avg_variance;

                const traditions = await getCulturalTraditions();
                const { tradition } = selectCulturalTradition(stats as any, traditions, false);
                const { pattern } = determineCulturalScanPattern(tradition.cultural_family);
                appliedTraditionNames.add(tradition.name);

                const NOTE_DURATION = globalNoteDuration; 
                const NOTES_PER_SHAPE = 16;
                const boundingBoxArea = Math.max(1, (region.maxX - region.minX + 1) * (region.maxY - region.minY + 1));
                const targetBlockSize = Math.max(1, Math.round(Math.sqrt(boundingBoxArea / NOTES_PER_SHAPE)));
                
                const blockSize = targetBlockSize;
                const gridW = Math.max(1, Math.ceil((region.maxX - region.minX) / blockSize));
                const gridH = Math.max(1, Math.ceil((region.maxY - region.minY) / blockSize));
                
                const scanSequence = generateScanSequence(gridW, gridH, pattern);
                const shapePixels = new Set(region.pixelIndices!);
                const backup = pixelDataRef.current!;
                
                // O(N) optimization: Map pixels directly to blocks instead of O(BoundingBox) grid scanning
                const blockDataMap = new Map<number, { sumR: number, sumG: number, sumB: number, count: number }>();
                
                for (const pIdx of region.pixelIndices!) {
                    const x = pIdx % w;
                    const y = Math.floor(pIdx / w);
                    
                    const gx = Math.floor((x - region.minX) / blockSize);
                    const gy = Math.floor((y - region.minY) / blockSize);
                    
                    const safeGx = Math.max(0, Math.min(gridW - 1, gx));
                    const safeGy = Math.max(0, Math.min(gridH - 1, gy));
                    const blockIdx = safeGy * gridW + safeGx;
                    
                    let bData = blockDataMap.get(blockIdx);
                    if (!bData) {
                        bData = { sumR: 0, sumG: 0, sumB: 0, count: 0 };
                        blockDataMap.set(blockIdx, bData);
                    }
                    
                    const dataIdx = pIdx * 4;
                    bData.sumR += backup[dataIdx];
                    bData.sumG += backup[dataIdx + 1];
                    bData.sumB += backup[dataIdx + 2];
                    bData.count++;
                    
                    if (liveImgData && backup) {
                        liveImgData.data[dataIdx] = backup[dataIdx];
                        liveImgData.data[dataIdx + 1] = backup[dataIdx + 1];
                        liveImgData.data[dataIdx + 2] = backup[dataIdx + 2];
                        liveImgData.data[dataIdx + 3] = 255;
                    }
                }

                if (canvas && ctx && liveImgData) {
                    if (performance.now() - lastRenderTime > 16) {
                        ctx.putImageData(liveImgData, 0, 0);
                        await new Promise(resolve => requestAnimationFrame(resolve));
                        lastRenderTime = performance.now();
                    }
                }

                for (const blockIdx of scanSequence) {
                    const gx = blockIdx % gridW;
                    const gy = Math.floor(blockIdx / gridW);
                    
                    const bData = blockDataMap.get(blockIdx);
                    let sumR = 0, sumG = 0, sumB = 0, count = 0;
                    
                    if (bData) {
                        sumR = bData.sumR;
                        sumG = bData.sumG;
                        sumB = bData.sumB;
                        count = bData.count;
                    }

                    if (count > 0) {
                        const avgR = sumR / count;
                        const avgG = sumG / count;
                        const avgB = sumB / count;
                        
                        const bHsv = rgbToHsv(avgR, avgG, avgB);
                        const bLab = rgbToLab(avgR, avgG, avgB);
                        const blockData = {
                            r: avgR,
                            g: avgG,
                            b: avgB,
                            hue: bHsv.h,
                            saturation: bHsv.s,
                            lightness: bHsv.v / 255,
                            lab: bLab,
                            position: { x: gx, y: gy }
                        };

                        const mapped = mapPixelToNote(blockData as any);
                        const transformed = transformNote({ blockData, mapping: mapped } as any, tradition);
                        
                        let pitchShift = 0;
                        if (enable3DScan) {
                            if (region.depthLayer === 'background') pitchShift = -24;
                            else if (region.depthLayer === 'middleground') pitchShift = -12;
                        }

                        let freq = 440 * Math.pow(2, ((transformed.midiFloat + pitchShift) - 69) / 12);
                        const vol = transformed.velocity / 127;

                        const osc = offlineCtx.createOscillator();
                        const gain = offlineCtx.createGain();
                        
                        if (enable3DScan) {
                            if (region.depthLayer === 'background') osc.type = 'sine';
                            else if (region.depthLayer === 'foreground') osc.type = 'sawtooth';
                            else osc.type = 'triangle';
                        } else {
                            osc.type = tradition.cultural_family === 'Middle Eastern' ? 'sawtooth' : 
                                       tradition.cultural_family === 'East Asian' ? 'sine' : 'triangle';
                        }
                        if (!isFinite(freq)) {
                            console.error("DEBUG NAN FREQ exportAudioWav", { freq, transformed, mapped, blockData });
                            freq = 440;
                        }
                        osc.frequency.setValueAtTime(freq, globalTimeOffset);
                        gain.gain.setValueAtTime(0.001, globalTimeOffset);
                        gain.gain.linearRampToValueAtTime(vol * 0.4, globalTimeOffset + 0.02);
                        gain.gain.exponentialRampToValueAtTime(0.0001, globalTimeOffset + NOTE_DURATION + 0.05);
                        
                        osc.connect(gain);
                        gain.connect(offlineCtx.destination);
                        
                        osc.start(globalTimeOffset);
                        osc.stop(globalTimeOffset + NOTE_DURATION + 0.1);
                        
                        const completeEvent = {
                            ...transformed,
                            time: globalTimeOffset,
                            duration: NOTE_DURATION
                        } as TransformedNoteEvent;
                        organicEvents.push(completeEvent);

                        globalTimeOffset += NOTE_DURATION;
                    }
                }
            }

            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(renderedBuffer);
            
            // --- AI & WHO INTEGRATION ---
            setIsExporting(false);
            setIsAiProcessing(true);

            const n = regionsToPlay.length || 1;
            const globalStats = {
                avg_L: sumL/n, avg_a: sumA/n, avg_b: sumB/n, 
                avg_saturation: sumSat/n, hue_diversity: sumHueDiv/n, avg_variance: sumVar/n
            };

            const traditions = await getCulturalTraditions();
            const { tradition: mainTradition } = selectCulturalTradition(globalStats as any, traditions, false);

            if (appliedTraditionNames.size > 0) {
                mainTradition.name = Array.from(appliedTraditionNames).join(', ');
            }

            const emptyMidi = new Blob([''], { type: 'audio/midi' }); // Placeholder for now
            const imgHash = bufferToHex(await calculateSHA256(await originalFile!.arrayBuffer()));
            const audioHash = bufferToHex(await calculateSHA256(await wavBlob.arrayBuffer()));

            const processResult = await processOrganicAI(
                originalFile!,
                config,
                (step, status) => {
                    setAiProcessingSteps(prev => prev.map((s, idx) => {
                        if (idx < step - 1 && status === 'active') return { ...s, status: 'completed' };
                        if (idx === step - 1) return { ...s, status };
                        return s;
                    }));
                },
                organicEvents,
                globalTimeOffset,
                wavBlob,
                imgHash,
                audioHash,
                mainTradition,
                globalStats,
                canvasRef.current,
                emptyMidi,
                [] // scan sequence
            );

            const finalProcessedResult = {
                ...processResult,
                regions: regionsRef.current.map(r => {
                    const { pixelIndices, ...safeRegion } = r;
                    return safeRegion;
                })
            };
            setFinalResult(finalProcessedResult);

        } catch (e) {
            console.error("Errore export WAV:", e);
            alert("Errore durante la generazione dell'audio offline e AI.");
        } finally {
            setIsExporting(false);
            setIsAiProcessing(false);
        }
    };

    const stopAnimation = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        listenAllAbort.current = true;
        setAnimationMode('idle');
    };

    const restoreOriginal = () => {
        const canvas = canvasRef.current;
        const backup = pixelDataRef.current;
        if (!canvas || !backup) return;
        const { w, h } = imageDimRef.current;
        const ctx      = canvas.getContext('2d')!;
        const imgData  = ctx.createImageData(w, h);
        imgData.data.set(backup);
        ctx.putImageData(imgData, 0, 0);
    };

    const handleReset = () => {
        stopAnimation();
        setCurrentStep(0);
        setProgressPct(0);
        restoreOriginal();
        if (regionsRef.current.length > 0) setSelectedRegion(regionsRef.current[0]);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  AUDIO
    // ─────────────────────────────────────────────────────────────────────────
    const playTone = (freqHz: number) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx  = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            const now  = ctx.currentTime;
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freqHz, now);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        } catch (_) {}
    };

    const playRegionDeepSound = async (region: ColorRegion): Promise<void> => {
        return new Promise(async (resolve) => {
            try {
                if (!audioCtxRef.current) {
                    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const ctx = audioCtxRef.current;
                if (ctx.state === 'suspended') ctx.resume();

                // Ripristino visivo della forma sul canvas principale (Ricomposizione graduale)
                const mainCanvas = canvasRef.current;
                const backup = pixelDataRef.current;
                if (mainCanvas && backup) {
                    const mCtx = mainCanvas.getContext('2d');
                    if (mCtx) {
                        const { w, h } = imageDimRef.current;
                        const imgData = mCtx.getImageData(0, 0, w, h);
                        const d = imgData.data;
                        for (const idx of region.pixelIndices!) {
                            d[idx * 4] = backup[idx * 4];
                            d[idx * 4 + 1] = backup[idx * 4 + 1];
                            d[idx * 4 + 2] = backup[idx * 4 + 2];
                            d[idx * 4 + 3] = backup[idx * 4 + 3];
                        }
                        mCtx.putImageData(imgData, 0, 0);
                    }
                }

                // 1. Statistiche base della forma
                const hsv = rgbToHsv(region.r, region.g, region.b);
                const shapeSizePct = region.pixelCount / (imageDimRef.current.w * imageDimRef.current.h);
                const dynamicHueDiversity = Math.min(1.0, shapeSizePct * 5 + (region.id % 10) / 20);

                const stats = {
                    avg_L: region.L,
                    avg_a: region.a,
                    avg_b: region.b_val,
                    avg_saturation: hsv.s,
                    hue_diversity: dynamicHueDiversity,
                    avg_variance: region.pixelCount > 1000 ? 500 : 50
                };

                // 2. Scelta Tradizione Culturale e Pattern
                const traditions = await getCulturalTraditions();
                const { tradition } = selectCulturalTradition(stats as any, traditions, false);
                const { pattern, name: patternName } = determineCulturalScanPattern(tradition.cultural_family);

                // 3. Generazione Micro-Griglia Dinamica basata sulla durata desiderata
                let NOTE_DURATION = 0.12; 
                const naturalTotalDuration = regionsRef.current.length * 16 * 0.12;
                if (targetDurationMax > 0 && naturalTotalDuration > targetDurationMax) {
                    NOTE_DURATION = targetDurationMax / (regionsRef.current.length * 16);
                }
                const NOTES_PER_SHAPE = 16;
                const targetBlockSize = Math.max(1, Math.round(Math.sqrt(region.pixelCount / NOTES_PER_SHAPE)));
                const wImg = imageDimRef.current.w;
                const hImg = imageDimRef.current.h;
                
                const blockSize = targetBlockSize;
                const gridW = Math.max(1, Math.ceil((region.maxX - region.minX) / blockSize));
                const gridH = Math.max(1, Math.ceil((region.maxY - region.minY) / blockSize));
                
                const scanSequence = generateScanSequence(gridW, gridH, pattern);
                const shapePixels = new Set(region.pixelIndices);
                const { w } = imageDimRef.current;
                
                // Set initial live data for UI
                setLiveSonificationData({
                    tradition: tradition.name,
                    pattern: patternName,
                    note: '-',
                    hex: region.hex
                });
                
                // Preparo il canvas del cursore
                const cCtx = cursorCanvasRef.current?.getContext('2d');
                if (cCtx) {
                    cCtx.clearRect(0, 0, wImg, hImg);
                }

                const now = ctx.currentTime;
                let currentTimeOffset = 0;
                let eventsCount = 0;
                
                for (const blockIdx of scanSequence) {
                    if (listenAllAbort.current) break;

                    const gx = blockIdx % gridW;
                    const gy = Math.floor(blockIdx / gridW);
                    
                    const startX = region.minX + gx * blockSize;
                    const startY = region.minY + gy * blockSize;
                    const endX = startX + blockSize;
                    const endY = startY + blockSize;
                    
                    let sumR=0, sumG=0, sumB=0, count=0;
                    
                    for (let y = startY; y < endY; y++) {
                        for (let x = startX; x < endX; x++) {
                            const pIdx = y * w + x;
                            if (shapePixels.has(pIdx)) {
                                const dataIdx = pIdx * 4;
                                sumR += pixelDataRef.current![dataIdx];
                                sumG += pixelDataRef.current![dataIdx+1];
                                sumB += pixelDataRef.current![dataIdx+2];
                                count++;
                            }
                        }
                    }
                    
                    if (count > 0) {
                        const avgR = Math.round(sumR / count);
                        const avgG = Math.round(sumG / count);
                        const avgB = Math.round(sumB / count);
                        const lab = rgbToLab(avgR, avgG, avgB);
                        
                        const blockData = {
                            r: avgR, g: avgG, b: avgB,
                            lab: { l: lab.l, a: lab.a, b: lab.b },
                            variance: 50,
                            isFiller: false
                        } as any;
                        
                        const mapped = mapPixelToNote(blockData);
                        const transformed = transformNote({ blockData, mapping: mapped } as any, tradition);
                        
                        let pitchShift = 0;
                        if (enable3DScan) {
                            if (region.depthLayer === 'background') pitchShift = -24; // Bassi profondi
                            else if (region.depthLayer === 'middleground') pitchShift = -12; // Accompagnamento
                        }

                        let freq = 440 * Math.pow(2, ((transformed.midiFloat + pitchShift) - 69) / 12);
                        const vol = transformed.velocity / 127;

                        // Schedula audio
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        
                        if (enable3DScan) {
                            if (region.depthLayer === 'background') osc.type = 'sine'; // Suono morbido e basso
                            else if (region.depthLayer === 'foreground') osc.type = 'sawtooth'; // Suono graffiante e visibile
                            else osc.type = 'triangle';
                        } else {
                            osc.type = tradition.cultural_family === 'Middle Eastern' ? 'sawtooth' : 
                                       tradition.cultural_family === 'East Asian' ? 'sine' : 'triangle';
                        }
                        
                        if (!isFinite(freq)) {
                            console.error("DEBUG NAN FREQ playRegionDeepSound", { freq, transformed, mapped, blockData });
                            freq = 440;
                        }
                        osc.frequency.setValueAtTime(freq, now + currentTimeOffset);
                        gain.gain.setValueAtTime(0.001, now + currentTimeOffset);
                        gain.gain.linearRampToValueAtTime(vol * 0.4, now + currentTimeOffset + 0.02);
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + currentTimeOffset + NOTE_DURATION);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start(now + currentTimeOffset);
                        osc.stop(now + currentTimeOffset + NOTE_DURATION);
                        
                        // Schedula UI visiva (Cursore)
                        setTimeout(() => {
                            if (listenAllAbort.current) return;
                            
                            // Disegna cursore
                            if (cCtx) {
                                cCtx.clearRect(0, 0, wImg, hImg);
                                cCtx.strokeStyle = '#22d3ee'; // cyan-400
                                cCtx.lineWidth = 2;
                                cCtx.strokeRect(startX, startY, blockSize, blockSize);
                                cCtx.fillStyle = 'rgba(34, 211, 238, 0.3)';
                                cCtx.fillRect(startX, startY, blockSize, blockSize);
                            }
                            
                            const toHex = (c:number) => c.toString(16).padStart(2,'0');
                            setLiveSonificationData({
                                tradition: tradition.name,
                                pattern: patternName,
                                note: transformed.noteName,
                                hex: `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`
                            });
                        }, currentTimeOffset * 1000);

                        currentTimeOffset += NOTE_DURATION;
                        eventsCount++;
                    }
                }
                
                if (eventsCount === 0) {
                    resolve(); return;
                }
                
                // Attendi la fine dell'esecuzione di questa forma
                setTimeout(() => {
                    if (cCtx) cCtx.clearRect(0, 0, wImg, hImg);
                    setLiveSonificationData(null);
                    resolve();
                }, currentTimeOffset * 1000 + 100);
            } catch (e) {
                console.error("Errore sonificazione forma:", e);
                resolve();
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  UTILITY COLORE
    // ─────────────────────────────────────────────────────────────────────────
    const rgbToLab = (r: number, g: number, b: number) => {
        let r1 = r / 255, g1 = g / 255, b1 = b / 255;
        r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
        g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
        b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;
        let x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) * 100;
        let y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) * 100;
        let z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) * 100;
        x /= 95.047; y /= 100; z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
        return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
    };

    const rgbToHsv = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max !== min) {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s, v: v * 255 };
    };

    const midiToNote = (midi: number) => {
        const n = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
    };

    useEffect(() => {
        return () => {
            stopAnimation();
            audioCtxRef.current?.close();
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">

            {/* HEADER */}
            <div className="bg-slate-950/60 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                            Scansione Sequenziale · Puzzle Pixel-per-Pixel
                        </span>
                    </div>

                    <h1 className="text-3xl font-black font-display text-white tracking-tight">
                        Scontorno &amp; <span className="text-cyan-400">Stacco dal Quadro</span>
                    </h1>
                    <p className="text-sm text-white/70 mt-1 max-w-2xl">
                        Scansione raster completa (top-left→bottom-right): ogni pixel è un tassello numerato.
                        BFS neighbor-to-neighbor cattura ogni sfumatura cromatica. Copertura 100% garantita.
                    </p>
                    
                    {/* SONIFICAZIONE PROFONDA */}
                    <div className="bg-slate-950/80 backdrop-blur-md rounded-2xl border border-cyan-900/50 p-5 shadow-inner mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold font-mono text-white tracking-wider flex items-center gap-2">
                                <i className="fas fa-wave-square text-cyan-400"></i>
                                SONIFICAZIONE SONIFICART INTEGRALE
                            </h3>
                        </div>
                        
                        <div className="text-sm text-slate-400 font-mono mb-4">
                            Ogni forma viene analizzata come tela a sé stante: viene calcolata la Tradizione Culturale ottimale e applicato un pattern di lettura dinamico sulla sagoma. La risoluzione della griglia si adatta automaticamente in base alla durata impostata.
                        </div>
                    </div>
                </div>
                <label className="cursor-pointer px-8 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 hover:scale-105 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-300 shadow-xl flex items-center gap-3">
                    <i className="fas fa-upload text-base"></i>
                    Carica Opera
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
            </div>

            {/* MAIN WORKSPACE */}
            {!uploadedImageUrl ? (
                <div className="bg-slate-950/60 backdrop-blur-xl p-16 rounded-2xl border border-dashed border-cyan-500/30 text-center space-y-4">
                    <div className="w-20 h-20 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto text-cyan-400 text-4xl">
                        <i className="fas fa-wand-magic-sparkles"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Carica un quadro per avviare il Colorimetro Organico</h3>
                    <p className="text-sm text-white/50">
                        La scansione percorre ogni pixel in ordine sequenziale — come i tasselli numerati di un puzzle —<br/>
                        garantendo copertura totale senza lacune né residui.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: CANVAS (lg:col-span-8 or 9) */}
                    <div className="lg:col-span-9 flex flex-col gap-4">
                        <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                                    <i className="fas fa-microscope mr-2"></i>{uploadedFileName}
                                </span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                    {currentStep}/{regions.length} Forme Staccate ({progressPct}%)
                                </span>
                            </div>

                            {/* Barra progresso scansione (mostrata solo durante analisi) */}
                            {isAnalyzing && (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-mono text-cyan-300">
                                        <span>{analyzeProgress}</span>
                                        <span>{scanPct}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 transition-all duration-200"
                                            style={{ width: `${scanPct}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* CANVAS CONTAINER */}
                            <div
                                className="relative rounded-xl overflow-hidden border border-white/10 bg-black"
                                style={{ aspectRatio: `${imageDimRef.current.w || 16}/${imageDimRef.current.h || 9}` }}
                            >
                                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
                                {/* CANVAS CURSORE SOVRAPPOSTO */}
                                <canvas ref={cursorCanvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />

                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                        <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
                                        <p className="text-xs font-mono text-cyan-300 font-bold">
                                            Scansione sequenziale in corso… {scanPct}%
                                        </p>
                                        <p className="text-[10px] font-mono text-white/50">
                                            Ogni pixel è un tassello — nessun buco possibile
                                        </p>
                                    </div>
                                )}

                                {animationMode !== 'idle' && (
                                    <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md border border-cyan-500/40 px-3 py-2 rounded-xl text-[10px] font-mono text-cyan-300 font-bold">
                                        <div className="flex justify-between mb-1">
                                            <span>
                                                {animationMode === 'detach' ? 'Stacco' : 
                                                 animationMode === 'attach' ? 'Ricostruzione' : 
                                                 'Ascolto'} Forma {currentStep}/{regions.length}
                                            </span>
                                            <span>{progressPct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all duration-150"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CONTROLS */}
                            <div className="flex flex-wrap gap-3 pt-1">
                                <button
                                    onClick={animationMode === 'detach' ? stopAnimation : startDetach}
                                    disabled={regions.length === 0 || isAnalyzing || animationMode === 'attach'}
                                    className={`flex-1 min-w-[140px] py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        animationMode === 'detach'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-102 shadow-lg'
                                    }`}
                                >
                                    <i className={`fas ${animationMode === 'detach' ? 'fa-pause' : 'fa-play'}`}></i>
                                    {animationMode === 'detach' ? 'Pausa' : 'Avvia Analisi'}
                                </button>
                                <button
                                    onClick={animationMode === 'attach' ? stopAnimation : startAttach}
                                    disabled={regions.length === 0 || isAnalyzing || animationMode === 'detach'}
                                    className={`flex-1 min-w-[140px] py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        animationMode === 'attach'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:scale-102 shadow-lg'
                                    }`}
                                >
                                    <i className={`fas ${animationMode === 'attach' ? 'fa-pause' : 'fa-puzzle-piece'}`}></i>
                                    {animationMode === 'attach' ? 'Pausa' : 'Re-Incolla'}
                                </button>
                                <button
                                    onClick={exportAudioWav}
                                    disabled={regions.length === 0 || isAnalyzing || animationMode !== 'idle' || isExporting || isAiProcessing}
                                    className="flex-1 min-w-[140px] py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:scale-102 shadow-lg disabled:opacity-50"
                                >
                                    {isExporting || isAiProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>}
                                    {isExporting ? 'Rendering Audio...' : isAiProcessing ? 'Analisi AI...' : 'Genera AI, WHO e WAV'}
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-mono font-bold uppercase border border-white/10 transition-all"
                                >
                                    <i className="fas fa-rotate-left mr-1.5"></i>Reset
                                </button>
                            </div>
                        </div>
                        
                        {/* CONTROLLI DURATA STIMATA E SENSITIVITA */}
                        {!isAnalyzing && regions.length > 0 && (
                            <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
                                <div className="text-sm font-bold font-mono text-white mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <i className="fas fa-sliders text-cyan-400"></i> Dettaglio Analisi
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm font-mono text-white bg-black/40 p-3 rounded-lg border border-white/5 mb-4">
                                    <span>Durata Stimata Audio:</span>
                                    <strong className="text-emerald-400 font-mono text-lg">
                                        {Math.floor(
                                            (targetDurationMax > 0 && ((regions.length * 16 * 0.12) > targetDurationMax)) 
                                            ? targetDurationMax / 60 
                                            : ((regions.length * 16 * 0.12) / 60)
                                        )}m 
                                        {' '}
                                        {Math.floor(
                                            (targetDurationMax > 0 && ((regions.length * 16 * 0.12) > targetDurationMax)) 
                                            ? targetDurationMax % 60 
                                            : ((regions.length * 16 * 0.12) % 60)
                                        )}s
                                        {targetDurationMax > 0 && ((regions.length * 16 * 0.12) > targetDurationMax) && (
                                            <span className="text-[10px] text-amber-400 ml-2">(Compresso)</span>
                                        )}
                                    </strong>
                                </div>

                                {/* TARGET DURATION SELECTOR */}
                                <div className="space-y-1 mb-4">
                                    <div className="flex justify-between text-xs font-mono text-white/70">
                                        <span>Target Durata Massima</span>
                                    </div>
                                    <select 
                                        className="w-full bg-black/50 border border-white/20 text-white text-xs p-1.5 rounded outline-none"
                                        value={targetDurationMax}
                                        onChange={(e) => setTargetDurationMax(Number(e.target.value))}
                                        disabled={animationMode !== 'idle'}
                                    >
                                        <option value={0}>Naturale (Nessun limite)</option>
                                        <option value={210}>Suno Safe (Max 3m 30s)</option>
                                        <option value={120}>Radio Edit (Max 2m 0s)</option>
                                        <option value={60}>Fast (Max 1m 0s)</option>
                                    </select>
                                    <p className="text-[9px] text-white/40 leading-tight mt-1">Comprime automaticamente la velocità per rientrare nel limite.</p>
                                </div>

                                {/* PRESET BUTTONS */}
                                <div className="flex gap-2 mb-4">
                                    <button 
                                        onClick={() => { setColorTolerance(20); setMinRegionPx(10); handleRecalculate(20, 10); }}
                                        disabled={animationMode !== 'idle'}
                                        className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-cyan-300 uppercase"
                                    >Mosaico Dettagliato</button>
                                    <button 
                                        onClick={() => { setColorTolerance(45); setMinRegionPx(100); handleRecalculate(45, 100); }}
                                        disabled={animationMode !== 'idle'}
                                        className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-cyan-300 uppercase"
                                    >Bilanciato</button>
                                    <button 
                                        onClick={() => { setColorTolerance(80); setMinRegionPx(500); handleRecalculate(80, 500); }}
                                        disabled={animationMode !== 'idle'}
                                        className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-cyan-300 uppercase"
                                    >Macro-Aree Astratte</button>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-mono text-white/70">
                                        <span>Sensibilità Colore (Tolleranza)</span>
                                        <span className="text-cyan-400">{colorTolerance}</span>
                                    </div>
                                    <input 
                                        type="range" min="10" max="100" step="5"
                                        value={colorTolerance}
                                        onChange={(e) => setColorTolerance(parseInt(e.target.value))}
                                        onMouseUp={() => handleRecalculate()}
                                        onTouchEnd={() => handleRecalculate()}
                                        className="w-full accent-cyan-500"
                                        disabled={animationMode !== 'idle'}
                                    />
                                    <p className="text-[9px] text-white/40 leading-tight mt-1">Scegli se considerare il colore netto o frammentare includendo le minime sfumature.</p>
                                </div>
                                <div className="space-y-1 pt-2">
                                    <div className="flex justify-between text-xs font-mono text-white/70 items-center">
                                        <span>Dimensione Cursore Scansione (Filtro Rumore)</span>
                                        <div className="flex items-center gap-3">
                                            <div 
                                                title="Le forme più piccole di questo quadrato verranno ignorate"
                                                style={{ 
                                                    width: `${Math.max(2, Math.sqrt(minRegionPx))}px`, 
                                                    height: `${Math.max(2, Math.sqrt(minRegionPx))}px`,
                                                    minWidth: `${Math.max(2, Math.sqrt(minRegionPx))}px`,
                                                    minHeight: `${Math.max(2, Math.sqrt(minRegionPx))}px`
                                                }} 
                                                className="bg-teal-500/50 border border-teal-400 shadow-[0_0_5px_rgba(20,184,166,0.5)] flex-shrink-0 rounded-sm"
                                            ></div>
                                            <span className="text-cyan-400 min-w-[50px] text-right font-bold">{minRegionPx} px</span>
                                        </div>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1000" step="10"
                                        value={minRegionPx}
                                        onChange={(e) => setMinRegionPx(parseInt(e.target.value))}
                                        onMouseUp={() => handleRecalculate()}
                                        onTouchEnd={() => handleRecalculate()}
                                        className="w-full accent-teal-500"
                                        disabled={animationMode !== 'idle'}
                                    />
                                    <p className="text-[9px] text-white/40 leading-tight mt-1">Più è piccolo più è preciso, più è grande più è grossolano ed esclude i piccoli dettagli.</p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Profondità 3D (Z-Index)</span>
                                        <span className="text-[10px] text-white/50">Ordina l'ascolto (Sfondo → Primo Piano)</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" className="sr-only peer" checked={enable3DScan} onChange={() => setEnable3DScan(!enable3DScan)} disabled={animationMode !== 'idle'} />
                                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: TELEMETRIA & REGISTRO REGIONI (lg:col-span-3) */}
                    <div className="lg:col-span-3 flex flex-col gap-6">

                        {/* HUD TELEMETRIA LIVE (Spostato fuori dal canvas) */}
                        {liveSonificationData && (
                            <div className="bg-black/90 backdrop-blur-md border border-cyan-500/40 p-5 rounded-2xl shadow-2xl animate-fade-in flex flex-col gap-3">
                                <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider border-b border-cyan-500/30 pb-2 mb-1 flex items-center gap-2">
                                    <i className="fas fa-satellite-dish animate-pulse"></i> Telemetria Live
                                </div>
                                <div className="text-sm font-mono text-white flex justify-between gap-4">
                                    <span className="text-white/50">Tradizione:</span>
                                    <strong className="text-amber-300 text-right">{liveSonificationData.tradition}</strong>
                                </div>
                                <div className="text-sm font-mono text-white flex justify-between gap-4">
                                    <span className="text-white/50">Pattern:</span>
                                    <strong className="text-cyan-300 text-right">{liveSonificationData.pattern}</strong>
                                </div>
                                <div className="text-sm font-mono text-white flex justify-between gap-4 items-center">
                                    <span className="text-white/50">Pixel (HEX):</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-sm border border-white/30" style={{backgroundColor: liveSonificationData.hex}}></div>
                                        <strong className="text-white">{liveSonificationData.hex}</strong>
                                    </div>
                                </div>
                                <div className="text-sm font-mono text-white flex justify-between gap-4">
                                    <span className="text-white/50">Nota:</span>
                                    <strong className="text-emerald-400 text-xl">{liveSonificationData.note}</strong>
                                </div>
                            </div>
                        )}

                        {/* Info copertura */}
                        {selectedRegion && (
                            <div className="bg-slate-950/80 backdrop-blur-xl p-5 rounded-2xl border border-cyan-500/40 shadow-2xl font-mono space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded border border-white/40" style={{ backgroundColor: selectedRegion.hex }}></span>
                                        <span className="text-amber-300 font-bold text-sm">{selectedRegion.idCode}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                                        selectedRegion.isDetached
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                            : 'bg-white/10 text-white/50 border-white/10'
                                    }`}>
                                        {selectedRegion.depthLayer === 'background' ? 'Sfondo' : 
                                         selectedRegion.depthLayer === 'foreground' ? 'Primo Piano' : 'Medio Piano'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/80">
                                    <div>Pixel: <strong className="text-white">{selectedRegion.pixelCount.toLocaleString()} px</strong></div>
                                    <div>Copertura: <strong className="text-cyan-300">{selectedRegion.percentage}%</strong></div>
                                    <div>HEX: <strong className="text-white">{selectedRegion.hex}</strong></div>
                                    <div>Nota: <strong className="text-amber-300">{selectedRegion.noteName} · {selectedRegion.frequencyHz}Hz</strong></div>
                                    <div className="col-span-2">CIE LAB: <strong className="text-cyan-200">L*:{selectedRegion.L} a*:{selectedRegion.a} b*:{selectedRegion.b_val}</strong></div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => playRegionDeepSound(selectedRegion)}
                                            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
                                        >
                                            <i className="fas fa-play"></i> Singola
                                        </button>
                                        <button 
                                            onClick={animationMode === 'listen-all' ? stopAnimation : startListenAll}
                                            disabled={animationMode === 'detach' || animationMode === 'attach'}
                                            className={`flex-[2] py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all ${
                                                animationMode === 'listen-all'
                                                    ? 'bg-rose-500/80 text-white'
                                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white'
                                            }`}
                                        >
                                            <i className={`fas ${animationMode === 'listen-all' ? 'fa-stop' : 'fa-list-ol'}`}></i> {animationMode === 'listen-all' ? 'Ferma' : 'Ascolta Tutte'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Registro Regioni */}
                        <div className="bg-slate-950/80 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-2xl font-mono space-y-3 flex-1 h-[600px] flex-col flex">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                    Forme Organiche ({regions.length})
                                </span>
                                <span className="text-xs text-emerald-400 font-bold">
                                    {analyzeProgress && !isAnalyzing ? `✓ ${regions.length} forme` : isAnalyzing ? `⏳ ${scanPct}%...` : ''}
                                </span>
                            </div>

                            {regions.length === 0 ? (
                                <p className="text-xs text-white/40 italic text-center py-4">
                                    {isAnalyzing ? 'Scansione in corso…' : 'Carica un\'immagine per avviare la scansione.'}
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                                    {regions.map((reg, idx) => {
                                        const isDetached  = idx < currentStep;
                                        const isCurrent   = idx === currentStep - 1;
                                        const isSelected  = selectedRegion?.idCode === reg.idCode;
                                        return (
                                            <div
                                                key={reg.idCode}
                                                onClick={() => setSelectedRegion(reg)}
                                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-[10px] ${
                                                    isSelected || isCurrent
                                                        ? 'bg-cyan-950/80 border-amber-400 ring-1 ring-amber-400'
                                                        : isDetached
                                                            ? 'bg-white/8 border-white/10 text-white/80'
                                                            : 'bg-white/3 border-white/5 text-white/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded border border-white/20" style={{ backgroundColor: reg.hex }}></span>
                                                    <span className="font-bold text-amber-300">{reg.idCode}</span>
                                                    <span className="text-white/60">{reg.percentage}% · {reg.pixelCount.toLocaleString()}px</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-cyan-300">{reg.noteName}</span>
                                                    <i className={`fas text-xs ${isDetached ? 'fa-check text-emerald-400' : 'fa-hourglass text-white/20'}`}></i>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* IN-PAGE RESULTS DASHBOARD COMPACT */}
            {isAiProcessing && (
                <div className="mt-8 max-w-3xl mx-auto border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl">
                    <ProcessingView steps={aiProcessingSteps} imageUrl={uploadedImageUrl} />
                </div>
            )}
            
            {finalResult && uploadedImageUrl && !isAiProcessing && (
                <div className="mt-12 mb-20 animate-fade-in-up border border-cyan-500/30 bg-slate-950/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center gap-3 border-b border-white/10 pb-4">
                        <i className="fas fa-file-medical-alt text-cyan-400"></i>
                        Referto Medico & Valigia Forense
                    </h2>
                    
                    <div className="flex flex-col gap-8">
                        {/* ABBINAMENTO TRADIZIONE ACUSTICA */}
                        {finalResult.culturalSelectionResult && (
                            <InfoCard
                                title="Archetipo Culturale & Tradizione Acustica"
                                icon="fa-globe-americas"
                                className="w-full relative overflow-hidden bg-gradient-to-br from-amber-950/40 via-orange-950/20 to-black border-amber-500/40 shadow-xl shadow-amber-950/20"
                            >
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                                                <i className="fas fa-music text-sm"></i>
                                                Tradizione Assegnata all'Opera
                                            </div>
                                            <h3 className="text-xl font-extrabold text-white flex items-center gap-3">
                                                {finalResult.culturalSelectionResult.tradition.name}
                                            </h3>
                                            <p className="text-xs text-amber-200/80 italic">
                                                {finalResult.culturalSelectionResult.tradition.description}
                                            </p>
                                        </div>
                                        <div className="bg-black/40 px-4 py-2 rounded-lg border border-amber-500/30 text-right min-w-[150px]">
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Famiglia Culturale</span>
                                            <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                                                {finalResult.culturalSelectionResult.tradition.cultural_family}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        Questa tradizione definisce l'estrazione delle frequenze dai frammenti visivi (pixel) e il loro comportamento acustico (Microtonalità, Base Freq: {finalResult.culturalSelectionResult.tradition.baseFrequency}Hz). Durante l'esposizione museale (Modalità Kiosk), i movimenti del visitatore innescheranno note puramente sintetiche coerenti con questo ecosistema.
                                    </p>
                                </div>
                            </InfoCard>
                        )}
                        {/* WHO CLASSIFICATION COMPLETA (INJECTED) */}
                        {finalResult.healthClassification && (
                            <InfoCard
                                title="WHO Health Agent — Classificazione Terapeutica Visiva"
                                icon="fa-heart-pulse"
                                className="w-full relative overflow-hidden bg-gradient-to-br from-emerald-950/40 via-teal-950/20 to-black border-emerald-500/40 shadow-xl shadow-emerald-950/20"
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
                                                {finalResult.healthClassification.primaryCategory.label}
                                                <span className="text-sm px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold">
                                                    {(finalResult.healthClassification.primaryCategory.score * 100).toFixed(0)}% Rilevanza
                                                </span>
                                            </h3>
                                            <p className="text-xs text-emerald-200/80 italic">
                                                {finalResult.healthClassification.primaryCategory.visualReason}
                                            </p>
                                        </div>
                                        <div className="bg-black/40 px-4 py-2 rounded-lg border border-emerald-500/30 text-right">
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Linee Guida Attive</span>
                                            <span className="text-xs font-mono font-bold text-emerald-300">
                                                {finalResult.healthClassification.activeCategories.length} su 5 Categorie WHO
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
                                            {finalResult.healthClassification.allScores.map((scoreObj) => {
                                                const isActive = scoreObj.score >= 0.3;
                                                const isPrimary = scoreObj.category === finalResult.healthClassification!.primaryCategory.category;
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
                                            {finalResult.healthClassification.primaryCategory.whoDirective}
                                        </p>
                                    </div>
                                </div>
                            </InfoCard>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* LEFT COLUMN: SALVATAGGIO & DOWNLOADS */}
                            <div className="flex flex-col gap-6">
                                {/* SALVATAGGIO IN GALLERIA */}
                                <div className="bg-black/40 border border-white/10 rounded-xl p-5 shadow-inner shadow-black/50">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <i className="fas fa-cloud-upload-alt text-emerald-400"></i> Salva in Galleria
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        <input 
                                            type="text" 
                                            placeholder="Titolo dell'opera..."
                                            value={workTitle}
                                            onChange={(e) => setWorkTitle(e.target.value)}
                                            className="w-full bg-white/5 border border-white/20 p-2.5 rounded-lg text-white text-sm outline-none focus:border-emerald-400/50 transition-all"
                                        />
                                        <textarea 
                                            placeholder="Descrizione opzionale..."
                                            value={workDescription}
                                            onChange={(e) => setWorkDescription(e.target.value)}
                                            className="w-full bg-white/5 border border-white/20 p-2.5 rounded-lg text-white text-sm outline-none focus:border-emerald-400/50 transition-all resize-none"
                                            rows={2}
                                        />
                                        <button 
                                            onClick={handleSaveToGallery}
                                            disabled={isSaving || hasSaved}
                                            className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                                                hasSaved 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:scale-[1.02] text-white border border-emerald-400/50'
                                            }`}
                                        >
                                            {isSaving ? <i className="fas fa-spinner fa-spin text-lg"></i> : hasSaved ? <i className="fas fa-check text-lg"></i> : <i className="fas fa-save text-lg"></i>}
                                            {isSaving ? 'Salvataggio...' : hasSaved ? 'Salvato in Galleria' : 'Salva Referto e Opera'}
                                        </button>
                                        {hasSaved && savedWorkId && (
                                            <button 
                                                onClick={() => window.open(`${window.location.origin}/live/${savedWorkId}?kiosk=true`, '_blank')}
                                                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-[1.02] text-white border border-cyan-400/50 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg"
                                            >
                                                <i className="fas fa-desktop text-lg text-white"></i>
                                                Avvia Modalità Esposizione (Live)
                                            </button>
                                        )}
                                        <p className="text-[10px] text-white/40 mt-1 text-center">
                                            Il salvataggio include la classificazione WHO, la valigia forense e il prompt AI in modo immutabile.
                                        </p>
                                    </div>
                                </div>

                                {/* DOWNLOADS (Moved here) */}
                                <div className="bg-black/40 border border-white/10 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <i className="fas fa-download text-cyan-400"></i> Esportazione
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={() => saveAs(finalResult.audioOutput?.audioWavBlob!, `${uploadedFileName}_organico.wav`)}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                                        >
                                            <i className="fas fa-file-audio text-amber-400 text-lg"></i>
                                            Scarica Audio Originale (WAV)
                                        </button>
                                        <button 
                                            onClick={() => saveAs(finalResult.sacContainer?.blob!, `${uploadedFileName}_certificato.sac`)}
                                            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-[1.02] border border-cyan-400/50 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg"
                                        >
                                            <i className="fas fa-fingerprint text-white text-lg"></i>
                                            Scarica Valigia Forense (.SAC)
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-white/40 mt-3 text-center">
                                        Il file .SAC contiene il WAV, l'immagine originale e la firma crittografica SHA-256.
                                    </p>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: AI PROMPT */}
                            <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-5 flex flex-col h-full">
                                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><i className="fas fa-robot"></i> Prompt AI Compositivo</span>
                                    <button 
                                        onClick={() => {
                                            let promptToCopy = '';
                                            if (activePromptTab === 'suno') promptToCopy = (finalResult.musicGenerationPrompt?.suno_prompt || '') + '\n\n' + (finalResult.musicGenerationPrompt?.suno_lyrics || '');
                                            if (activePromptTab === 'udio') promptToCopy = finalResult.musicGenerationPrompt?.udio_prompt || '';
                                            if (activePromptTab === 'soundverse') promptToCopy = finalResult.musicGenerationPrompt?.soundverse_prompt || finalResult.musicGenerationPrompt?.technical_parameters || '';
                                            navigator.clipboard.writeText(promptToCopy);
                                            alert("Prompt copiato negli appunti!");
                                        }}
                                        className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 rounded text-[10px] font-bold border border-purple-500/40 transition-colors"
                                    >
                                        <i className="fas fa-copy"></i> COPIA
                                    </button>
                                </h3>
                                
                                {/* SELETTORE TAB PROMPT */}
                                <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-white/10 pb-3 mt-2">
                                    <button
                                        onClick={() => setActivePromptTab('suno')}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'suno' ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <i className="fas fa-bolt mr-1.5"></i> SUNO
                                    </button>
                                    <button
                                        onClick={() => setActivePromptTab('udio')}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'udio' ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <i className="fas fa-wave-square mr-1.5"></i> UDIO
                                    </button>
                                    <button
                                        onClick={() => setActivePromptTab('soundverse')}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all shadow-lg ${activePromptTab === 'soundverse' ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <i className="fas fa-compact-disc mr-1.5"></i> SOUNDVERSE
                                    </button>
                                </div>

                                <p className="text-[10px] text-white/50 mb-3">
                                    {activePromptTab === 'suno' && "Copia e incolla in Suno per generare il brano con una timeline terapeutica precisa."}
                                    {activePromptTab === 'udio' && "Copia e incolla in Udio (Modalità Manuale) per texture sonore e sub-bassi psicoacustici."}
                                    {activePromptTab === 'soundverse' && "Prompt analitico usato nativamente per Soundverse AI."}
                                </p>

                                <div className="bg-black/60 rounded-lg p-4 flex-grow border border-white/5 overflow-y-auto max-h-[300px]">
                                    <pre className="text-[11px] text-purple-100 font-mono whitespace-pre-wrap leading-relaxed">
                                        {activePromptTab === 'suno' && (
                                            <>
                                                <span className="text-purple-300 font-bold block mb-2">// SUNO PROMPT & TIMELINE</span>
                                                {finalResult.musicGenerationPrompt?.suno_prompt || 'Prompt non disponibile.'}
                                                <br /><br />
                                                <span className="text-purple-400 font-bold block mb-1">Lyrics / Struttura Temporale:</span>
                                                {finalResult.musicGenerationPrompt?.suno_lyrics || ''}
                                            </>
                                        )}
                                        {activePromptTab === 'udio' && (
                                            <>
                                                <span className="text-blue-300 font-bold block mb-2">// UDIO PROMPT</span>
                                                {finalResult.musicGenerationPrompt?.udio_prompt || 'Prompt non disponibile.'}
                                            </>
                                        )}
                                        {activePromptTab === 'soundverse' && (
                                            <>
                                                <span className="text-emerald-300 font-bold block mb-2">// SOUNDVERSE PROMPT</span>
                                                {finalResult.musicGenerationPrompt?.soundverse_prompt || finalResult.musicGenerationPrompt?.technical_parameters || 'Prompt non disponibile.'}
                                            </>
                                        )}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
