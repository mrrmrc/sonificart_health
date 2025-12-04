import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SonificationResult, TransformedNoteEvent, User } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { ScanPathOverlay } from './ScanPathOverlay';
import { CursorHighlight } from './CursorHighlight';
import { CursorLoupe } from './CursorLoupe';
import { MusicSheet } from './MusicSheet';
import saveAs from 'file-saver';
import { generateSonificationVideo } from '../services/videoService';
import { createSacContainer } from '../services/sacService';

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
            {/* FIX: Mostra max 100% nel testo */}
            <span className="font-mono text-white">{Math.round(Math.min(100, Math.max(0, value || 0)))}%</span>
        </div>
        <div className="w-full bg-brand-primary/70 rounded-full h-2">
            {/* FIX: Forza la larghezza massima al 100% per evitare sforamenti grafici */}
            <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}></div>
        </div>
    </div>
);


interface ResultsDashboardProps {
    result: SonificationResult;
    imageUrl: string;
    onReset: () => void;
    onSave: () => void;
    user: User | null;
    onRequestAccess: () => void;
    isHistoryView?: boolean;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
    result, imageUrl, onReset, onSave, user, onRequestAccess, isHistoryView = false
}) => {
    const [imageRenderInfo, setImageRenderInfo] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [playbackTime, setPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeEvent, setActiveEvent] = useState<TransformedNoteEvent | null>(null);

    const [isVideoRendering, setIsVideoRendering] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(result.generatedVideoBlob || null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [videoTitle, setVideoTitle] = useState("Composizione Sonora");
    const [videoAuthor, setVideoAuthor] = useState("SonificA.R.T. User");

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastEventIndexRef = useRef(0);

    const isArtisticMode = !!result.musicGenerationPrompt;
    const scanPatternName = result.scanPattern?.name || "Pattern Sconosciuto";
    const isManualScan = useMemo(() => scanPatternName.startsWith("Manuale:"), [scanPatternName]);
    const isPro = !!user?.isPro || !!user?.isAdmin;
    const displayImage = result.standardizedImageUrl;
    const safeHash = result.imageHash || "unknown_hash";
    const safeDuration = result.audioOutput?.duration || 0;

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

    const melodyEvents = useMemo(() => (result.audioOutput?.events || []).filter(e => e.isAccompaniment !== true), [result.audioOutput]);

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
    const copyPrompt = () => { if (result.musicGenerationPrompt?.stability_prompt) { navigator.clipboard.writeText(result.musicGenerationPrompt.stability_prompt); alert("Prompt copiato!"); } };
    const handleVideoAction = () => { if (generatedVideoBlob) { saveAs(generatedVideoBlob, `kinetic_proof_${safeHash.substring(0, 8)}.mp4`); } else { setIsVideoModalOpen(true); } };
    const startVideoGeneration = async () => {
        setIsVideoModalOpen(false); setIsVideoRendering(true); setVideoProgress(0);
        try {
            const blob = await generateSonificationVideo(result, (p) => setVideoProgress(p), { title: videoTitle, author: videoAuthor });
            setGeneratedVideoBlob(blob); saveAs(blob, `kinetic_proof_${safeHash.substring(0, 8)}.mp4`);
        } catch (e) { console.error(e); alert("Errore video: " + (e instanceof Error ? e.message : String(e))); } finally { setIsVideoRendering(false); }
    };
    const handleDownloadSac = async () => {
        try {
            const canvas = new OffscreenCanvas(512, 512); const ctx = canvas.getContext('2d');
            const img = new Image(); img.src = result.standardizedImageUrl; await new Promise(r => { img.onload = r; });
            ctx?.drawImage(img, 0, 0, 512, 512);
            const sacContainer = await createSacContainer({ imageHash: result.imageHash, audioHash: result.audioHash, config: result.configUsed, blockAnalysisResult: result.blockAnalysisResult, culturalSelectionResult: result.culturalSelectionResult, transformedEvents: result.audioOutput.events.filter(e => !e.isAccompaniment), canvas: canvas, audioWavBlob: result.audioOutput.audioWavBlob, midiBlob: result.audioOutput.midiBlob, totalDuration: result.audioOutput.duration, scanPattern: result.scanPattern, videoBlob: generatedVideoBlob || undefined });
            saveAs(sacContainer.blob, sacContainer.fileName);
        } catch (e) { console.error("SAC failed", e); if (result.sacContainer?.blob) saveAs(result.sacContainer.blob, result.sacContainer.fileName || "project.sac"); else alert("Errore SAC."); }
    };

    const visualProfile = useMemo(() => {
        const stats = result.blockAnalysisResult?.globalStats || { avg_L: 0, avg_saturation: 0, hue_diversity: 0 };
        // FIX: Se i valori sono già in 0-100, non moltiplicare per 100.
        const sat = stats.avg_saturation > 1 ? stats.avg_saturation : stats.avg_saturation * 100;
        const hue = stats.hue_diversity > 1 ? stats.hue_diversity : stats.hue_diversity * 100;
        return { lightness: stats.avg_L, saturation: sat, hueDiversity: hue };
    }, [result]);

    const audioProfile = useMemo(() => {
        const events = result.audioOutput?.events?.filter(e => !e.isAccompaniment) || [];
        if (events.length === 0) return { pitch: { low: 0, mid: 0, high: 0 }, dynamics: { soft: 0, mid: 0, loud: 0 } };
        let low = 0, midPitch = 0, high = 0; let soft = 0, midDynamics = 0, loud = 0;
        events.forEach(event => { if (event.midiFloat < 60) low++; else if (event.midiFloat < 84) midPitch++; else high++; if (event.velocity < 43) soft++; else if (event.velocity < 86) midDynamics++; else loud++; });
        const total = events.length;
        return { pitch: { low: (low / total) * 100, mid: (midPitch / total) * 100, high: (high / total) * 100 }, dynamics: { soft: (soft / total) * 100, mid: (midDynamics / total) * 100, loud: (loud / total) * 100 } };
    }, [result]);

    // Fix: Accesso sicuro ai dati culturali
    const culturalName = result.culturalSelectionResult?.tradition?.name || "Sconosciuta";
    const culturalFamily = result.culturalSelectionResult?.tradition?.cultural_family || "Generica";
    const culturalScore = result.culturalSelectionResult?.scoreBreakdown?.total || 0;

    return (
        <div className="animate-fade-in">
            {isVideoModalOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4"><div className="bg-brand-secondary p-6 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full animate-zoom-in" onClick={e => e.stopPropagation()}><h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><i className="fas fa-video text-brand-accent"></i> Prova Forense Cinetica</h3><p className="text-sm text-brand-text-secondary mb-6">Generazione del file MP4 che certifica la causalità tra pixel e suono.</p><div className="space-y-4 mb-6"><div><label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Titolo</label><input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} /></div><div><label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Autore</label><input type="text" className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none" value={videoAuthor} onChange={e => setVideoAuthor(e.target.value)} /></div></div><div className="flex justify-end gap-3"><button onClick={() => setIsVideoModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-bold text-brand-text-secondary hover:text-white hover:bg-white/10 transition-colors">Annulla</button><button onClick={startVideoGeneration} className="px-6 py-2 rounded-md text-sm font-bold bg-brand-accent text-brand-primary hover:bg-brand-accent-light transition-colors shadow-lg"><i className="fas fa-fingerprint mr-2"></i> Renderizza</button></div></div></div>)}
            {isVideoRendering && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"><div className="bg-brand-secondary p-8 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full text-center"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto mb-6"></div><h3 className="text-2xl font-bold text-white mb-2">Audit Forense...</h3><p className="text-brand-text-secondary text-sm mb-6">Tempo stimato: {(safeDuration / 60).toFixed(1)} min.</p><div className="w-full bg-brand-primary rounded-full h-4 border border-brand-secondary overflow-hidden"><div className="bg-brand-accent h-full transition-all duration-200 ease-linear" style={{ width: `${videoProgress}%` }}></div></div><p className="mt-2 text-xs font-mono text-brand-accent-light">{Math.round(videoProgress)}%</p></div></div>)}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3 space-y-4">
                    <div ref={containerRef} className="relative aspect-square bg-brand-primary/30 rounded-md overflow-hidden border border-brand-secondary group">
                        <img ref={imageRef} src={displayImage} alt="Analysis View" className="w-full h-full object-contain" />
                        <div className="absolute top-2 right-2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"><span className="bg-black/70 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-sm">Vista Analisi (512px)</span></div>

                        {/* FIX: Controlla che blocks sia un array valido */}
                        {result.blockAnalysisResult && Array.isArray(result.blockAnalysisResult.blocks) && (
                            <ScanPathOverlay blocks={result.blockAnalysisResult.blocks} gridSize={result.blockAnalysisResult.gridSize} imageRect={imageRenderInfo} />
                        )}

                        <CursorHighlight gridSize={result.blockAnalysisResult?.gridSize || 32} imageRect={imageRenderInfo} activeBlockPosition={activeEvent?.sourceBlock?.position ?? null} />
                    </div>
                    <CursorLoupe activeEvent={activeEvent} isPlaying={isPlaying} />
                </div>

                <div className="lg:col-span-2 bg-brand-secondary/50 p-6 rounded-lg">
                    <div className="space-y-6">
                        <div><h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-palette text-brand-accent"></i><span>Profilo Cromatico</span></h4><div className="space-y-3"><StatBar label="Luminosità" value={visualProfile.lightness} colorClass="bg-gray-300" /><StatBar label="Saturazione" value={visualProfile.saturation} colorClass="bg-brand-accent-light" /><StatBar label="Diversità Tonalità" value={visualProfile.hueDiversity} colorClass="bg-purple-500" /></div></div>
                        <div><h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-music text-brand-accent"></i><span>Profilo Sonoro</span></h4><div className="space-y-4"><div><h5 className="text-sm text-brand-text-secondary mb-2">Altezza Note</h5><div className="space-y-2"><StatBar label="Gravi" value={audioProfile.pitch.low} colorClass="bg-teal-700" /><StatBar label="Medie" value={audioProfile.pitch.mid} colorClass="bg-teal-500" /><StatBar label="Acute" value={audioProfile.pitch.high} colorClass="bg-teal-300" /></div></div><div className="bg-brand-primary/30 p-3 rounded-lg border border-brand-secondary"><h5 className="text-sm text-brand-text-secondary mb-2 text-center">{isHistoryView ? "Player (Archivio)" : "Player Interattivo"}</h5><AudioPlayer audioRef={audioRef} audioUrl={result.audioOutput?.audioUrl || ""} onTimeUpdate={handleTimeUpdate} onPlay={handlePlay} onStop={handleStop} /><MusicSheet activeEvent={activeEvent} /><div className="flex gap-3 mt-4 pt-3 border-t border-brand-secondary/30"><button onClick={onReset} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 rounded text-xs font-bold transition-colors border border-red-500/30 flex items-center justify-center gap-2"><i className={`fas ${isHistoryView ? 'fa-arrow-left' : 'fa-times'}`}></i> {isHistoryView ? "TORNA ALLA LISTA" : "ANNULLA"}</button>{!isHistoryView && (<button onClick={onSave} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 py-2 rounded text-xs font-bold transition-colors border border-green-500/30 flex items-center justify-center gap-2"><i className="fas fa-save"></i> SALVA OPERA</button>)}</div></div></div></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isArtisticMode && result.musicGenerationPrompt && (<InfoCard title="Concept & Interpretazione AI" icon="fa-wand-magic-sparkles" className="lg:col-span-3 relative overflow-hidden"><div className='space-y-4'><div><div className="flex justify-between items-center mb-1"><h5 className="text-brand-text-secondary text-xs font-bold">PROMPT:</h5><button onClick={copyPrompt} className="text-xs text-brand-accent hover:text-white transition-colors"><i className="fas fa-copy mr-1"></i> Copia</button></div><div className="bg-brand-primary/70 p-3 rounded-md text-sm font-mono text-green-400 break-words border border-green-900/50">{result.musicGenerationPrompt.stability_prompt}</div></div><div><h5 className="text-brand-text-secondary text-xs mb-1 font-bold">Concept (Ita):</h5><p className="text-sm text-brand-text-secondary">{result.musicGenerationPrompt.main_prompt_ita}</p></div></div></InfoCard>)}
                <InfoCard title={isManualScan ? "Tipo Scansione" : "Selezione Culturale"} icon={isManualScan ? "fa-layer-group" : "fa-globe-americas"}>{isManualScan ? (<><DataRow label="Pattern Scelto" value={<span className="text-brand-accent font-bold">{scanPatternName.replace("Manuale: ", "")}</span>} /><DataRow label="Modalità" value="Manuale" /><div className="my-2 border-t border-brand-secondary/50"></div><p className="text-xs text-brand-text-secondary mb-1 font-bold">Tradizione Musicale:</p><DataRow label="Nome" value={culturalName} /><DataRow label="Origine" value={culturalFamily} /></>) : (<><DataRow label="Tradizione" value={culturalName} /><DataRow label="Famiglia" value={culturalFamily} /><DataRow label="Percorso" value={scanPatternName} /><DataRow label="Score" value={culturalScore.toFixed(4)} /></>)}</InfoCard>
                <InfoCard title="Analisi & Sintesi" icon="fa-cogs"><DataRow label="Griglia" value={`${result.blockAnalysisResult?.gridSize || 32}x${result.blockAnalysisResult?.gridSize || 32}`} /><DataRow label="Eventi Audio" value={result.audioOutput?.eventsCount || 0} /><DataRow label="Durata" value={`${safeDuration.toFixed(2)}s`} /><DataRow label="Qualità Audio" value="44.1kHz WAV" /></InfoCard>
                <InfoCard title="Certificato Forense" icon="fa-fingerprint"><DataRow label="Image Hash" value={safeHash.substring(0, 16) + '...'} /><DataRow label="Audio Hash" value={(result.audioHash || "---").substring(0, 16) + '...'} /><DataRow label="Framework Ver." value="1.0" /></InfoCard>
                <InfoCard title="Performance" icon="fa-bolt"><DataRow label="Tempo Totale" value={`${result.performanceMetrics?.totalProcessingTime?.toFixed(0) || 0} ms`} /></InfoCard>

                {/* Rimosso QR Code e Validazione */}

                <InfoCard title="Download Artefatti" icon="fa-download"><div className="flex flex-col gap-2 mt-2 relative">{!isPro && (<div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-lg text-center p-4 border border-brand-accent/20"><i className="fas fa-lock text-2xl text-brand-accent mb-2"></i><button onClick={onRequestAccess} className="px-4 py-1.5 bg-brand-accent text-black text-xs font-bold rounded-full">Sblocca</button></div>)}<button disabled={!isPro} onClick={() => saveAs(result.audioOutput.audioWavBlob, 'generated_audio.wav')} className="w-full bg-brand-accent/20 text-brand-accent py-1 rounded hover:bg-brand-accent/30 disabled:opacity-50"><i className="fas fa-file-audio mr-2"></i> Download WAV</button><button disabled={!isPro} onClick={() => saveAs(result.audioOutput.midiBlob, 'musical_notation.mid')} className="w-full bg-brand-accent/20 text-brand-accent py-1 rounded hover:bg-brand-accent/30 disabled:opacity-50"><i className="fas fa-music mr-2"></i> Download MIDI</button><button disabled={!isPro} onClick={handleVideoAction} className="w-full bg-purple-600/30 text-purple-300 py-1 rounded hover:bg-purple-600/50 border border-purple-500/30 relative"><i className="fas fa-video mr-2"></i> {generatedVideoBlob ? "Download Video" : "Genera Video"}</button><button disabled={!isPro} onClick={handleDownloadSac} className="w-full bg-brand-accent font-bold text-brand-primary py-2 rounded hover:bg-brand-accent-light mt-2 shadow-lg disabled:opacity-50"><i className="fas fa-box mr-2"></i> Download SAC</button></div></InfoCard>
            </div>
        </div>
    );
};