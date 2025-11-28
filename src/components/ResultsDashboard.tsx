import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SonificationResult, TransformedNoteEvent, User } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { QrCodeDisplay } from './QrCodeDisplay';
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

const ValidationItem: React.FC<{ result: { passed: boolean; message: string; } }> = ({ result }) => (
    <div className={`flex items-center gap-2 p-2 rounded-md ${result.passed ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${result.passed ? 'bg-green-500' : 'bg-yellow-500'}`}>
            <i className={`fas ${result.passed ? 'fa-check' : 'fa-info-circle'}`}></i>
        </div>
        <span className="text-xs font-mono text-brand-text-primary">{result.message}</span>
    </div>
);

const StatBar: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div>
        <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-brand-text-secondary">{label}</span>
            <span className="font-mono text-white">{Math.round(value)}%</span>
        </div>
        <div className="w-full bg-brand-primary/70 rounded-full h-2">
            <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${value}%` }}></div>
        </div>
    </div>
);


interface ResultsDashboardProps {
    result: SonificationResult;
    imageUrl: string;
    onReset: () => void;
    onSave: () => void; // NUOVA PROP AGGIUNTA
    user: User | null;
    onRequestAccess: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ result, imageUrl, onReset, onSave, user, onRequestAccess }) => {
    const [imageRenderInfo, setImageRenderInfo] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [playbackTime, setPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeEvent, setActiveEvent] = useState<TransformedNoteEvent | null>(null);

    // Video Export States
    const [isVideoRendering, setIsVideoRendering] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);

    // Initialize generated video blob from result if it exists (from SAC)
    const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(result.generatedVideoBlob || null);

    // Video Metadata Modal States
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [videoTitle, setVideoTitle] = useState("Composizione Sonora");
    const [videoAuthor, setVideoAuthor] = useState("SonificA.R.T. User");

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastEventIndexRef = useRef(0);

    const isArtisticMode = !!result.musicGenerationPrompt;
    const isManualScan = useMemo(() => result.scanPattern.name.startsWith("Manuale:"), [result.scanPattern.name]);
    const isPro = !!user?.isPro;

    const displayImage = result.standardizedImageUrl;

    const verificationUrl = useMemo(() => {
        return `${window.location.origin}?verify=${result.imageHash}`;
    }, [result.imageHash]);

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
        return () => {
            imageEl.removeEventListener('load', handleLoad);
            resizeObserver.disconnect();
        };
    }, [calculateImageRect, displayImage]);


    const melodyEvents = useMemo(() =>
        result.audioOutput.events.filter(e => !e.isAccompaniment),
        [result.audioOutput.events]
    );

    useEffect(() => {
        if (!isPlaying || playbackTime < 0 || melodyEvents.length === 0) return;

        let searchStartIndex = lastEventIndexRef.current;
        if (playbackTime < melodyEvents[searchStartIndex].time) searchStartIndex = 0;

        let newEventIndex = -1;
        for (let i = searchStartIndex; i < melodyEvents.length; i++) {
            if (melodyEvents[i].time + melodyEvents[i].duration > playbackTime) {
                newEventIndex = i;
                break;
            }
        }
        if (newEventIndex === -1 && playbackTime >= result.audioOutput.duration) {
            newEventIndex = melodyEvents.length - 1;
        }

        if (newEventIndex !== -1) {
            if (!activeEvent || activeEvent.time !== melodyEvents[newEventIndex].time) {
                setActiveEvent(melodyEvents[newEventIndex]);
            }
            lastEventIndexRef.current = newEventIndex;
        }

    }, [playbackTime, isPlaying, result.audioOutput.duration, melodyEvents, activeEvent]);


    const handleTimeUpdate = useCallback((time: number) => setPlaybackTime(time), []);
    const handlePlay = () => setIsPlaying(true);
    const handleStop = () => {
        setIsPlaying(false);
        if (audioRef.current && audioRef.current.ended) {
            setActiveEvent(null);
            lastEventIndexRef.current = 0;
        }
    };

    const copyPrompt = () => {
        if (result.musicGenerationPrompt?.stability_prompt) {
            navigator.clipboard.writeText(result.musicGenerationPrompt.stability_prompt);
            alert("Prompt copiato negli appunti!");
        }
    };

    // MAIN BUTTON HANDLER
    const handleVideoAction = () => {
        if (generatedVideoBlob) {
            // Directly download if exists
            saveAs(generatedVideoBlob, `kinetic_proof_${result.imageHash.substring(0, 8)}.mp4`);
        } else {
            // Open modal to generate
            setIsVideoModalOpen(true);
        }
    };

    const startVideoGeneration = async () => {
        setIsVideoModalOpen(false);
        setIsVideoRendering(true);
        setVideoProgress(0);

        try {
            const blob = await generateSonificationVideo(
                result,
                (p) => setVideoProgress(p),
                { title: videoTitle || "Opera Senza Titolo", author: videoAuthor || "Anonimo" }
            );
            setGeneratedVideoBlob(blob); // Save blob to state for SAC inclusion and immediate download
            saveAs(blob, `kinetic_proof_${result.imageHash.substring(0, 8)}.mp4`);
        } catch (e) {
            console.error("Video generation failed:", e);
            alert("Errore nella generazione del video: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setIsVideoRendering(false);
        }
    };

    const handleDownloadSac = async () => {
        try {
            // Re-create SAC with video if available
            // We need a temporary canvas for the image blob generation required by createSacContainer
            const canvas = new OffscreenCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = result.standardizedImageUrl;
            await new Promise(r => { img.onload = r; });
            ctx?.drawImage(img, 0, 0, 512, 512);

            const sacContainer = await createSacContainer({
                imageHash: result.imageHash,
                audioHash: result.audioHash,
                config: result.configUsed,
                blockAnalysisResult: result.blockAnalysisResult,
                culturalSelectionResult: result.culturalSelectionResult,
                transformedEvents: result.audioOutput.events.filter(e => !e.isAccompaniment), // store only melody events in json to save space, logic handles param
                canvas: canvas,
                audioWavBlob: result.audioOutput.audioWavBlob,
                midiBlob: result.audioOutput.midiBlob,
                totalDuration: result.audioOutput.duration,
                scanPattern: result.scanPattern,
                videoBlob: generatedVideoBlob || undefined // Include video if generated
            });

            saveAs(sacContainer.blob, sacContainer.fileName);

        } catch (e) {
            console.error("SAC download failed", e);
            // Fallback to original container if re-generation fails
            saveAs(result.sacContainer.blob, result.sacContainer.fileName);
        }
    };

    const visualProfile = useMemo(() => {
        const stats = result.blockAnalysisResult.globalStats;
        return { lightness: stats.avg_L, saturation: stats.avg_saturation * 100, hueDiversity: stats.hue_diversity * 100 };
    }, [result]);

    const audioProfile = useMemo(() => {
        const events = result.audioOutput.events.filter(e => !e.isAccompaniment);
        if (events.length === 0) return { pitch: { low: 0, mid: 0, high: 0 }, dynamics: { soft: 0, mid: 0, loud: 0 } };
        let low = 0, midPitch = 0, high = 0;
        let soft = 0, midDynamics = 0, loud = 0;
        events.forEach(event => {
            if (event.midiFloat < 60) low++; else if (event.midiFloat < 84) midPitch++; else high++;
            if (event.velocity < 43) soft++; else if (event.velocity < 86) midDynamics++; else loud++;
        });
        const total = events.length;
        return {
            pitch: { low: (low / total) * 100, mid: (midPitch / total) * 100, high: (high / total) * 100 },
            dynamics: { soft: (soft / total) * 100, mid: (midDynamics / total) * 100, loud: (loud / total) * 100 },
        };
    }, [result]);


    return (
        <div className="animate-fade-in">
            {/* VIDEO METADATA CONFIGURATION MODAL */}
            {isVideoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
                    <div className="bg-brand-secondary p-6 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full animate-zoom-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fas fa-video text-brand-accent"></i>
                            Prova Forense Cinetica
                        </h3>
                        <p className="text-sm text-brand-text-secondary mb-6">
                            Generazione del file MP4 che certifica la causalità tra pixel e suono. Il video includerà la telemetria in sovraimpressione (Timestamp e Coordinate).
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Titolo Opera (Metadata)</label>
                                <input
                                    type="text"
                                    className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none"
                                    value={videoTitle}
                                    onChange={e => setVideoTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-text-secondary uppercase mb-1">Autore / Artista</label>
                                <input
                                    type="text"
                                    className="w-full bg-brand-primary border border-brand-secondary p-2 rounded text-white focus:border-brand-accent focus:outline-none"
                                    value={videoAuthor}
                                    onChange={e => setVideoAuthor(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsVideoModalOpen(false)}
                                className="px-4 py-2 rounded-md text-sm font-bold text-brand-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={startVideoGeneration}
                                className="px-6 py-2 rounded-md text-sm font-bold bg-brand-accent text-brand-primary hover:bg-brand-accent-light transition-colors shadow-lg"
                            >
                                <i className="fas fa-fingerprint mr-2"></i> Renderizza Prova
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIDEO RENDERING MODAL */}
            {isVideoRendering && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="bg-brand-secondary p-8 rounded-xl shadow-2xl border border-brand-accent/30 max-w-md w-full text-center">
                        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto mb-6"></div>
                        <h3 className="text-2xl font-bold text-white mb-2">Audit Forense in Corso...</h3>
                        <p className="text-brand-text-secondary text-sm mb-6">
                            Sincronizzazione telemetria e generazione prova cinetica.<br />
                            Tempo stimato: {(result.audioOutput.duration / 60).toFixed(1)} min.
                        </p>
                        <div className="w-full bg-brand-primary rounded-full h-4 border border-brand-secondary overflow-hidden">
                            <div
                                className="bg-brand-accent h-full transition-all duration-200 ease-linear"
                                style={{ width: `${videoProgress}%` }}
                            ></div>
                        </div>
                        <p className="mt-2 text-xs font-mono text-brand-accent-light">{Math.round(videoProgress)}%</p>
                    </div>
                </div>
            )}

            {/* PULSANTE INDIETRO SPOSTATO NEL BOX INTERATTIVO */}
            <div className="text-center mb-6 hidden">
                <button onClick={onReset} className="bg-brand-accent text-brand-primary font-bold py-2 px-6 rounded-full hover:bg-brand-accent-light transition-colors">
                    <i className="fas fa-arrow-left mr-2"></i> Sonifica un'altra immagine
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3 space-y-4">
                    <div ref={containerRef} className="relative aspect-square bg-brand-primary/30 rounded-md overflow-hidden border border-brand-secondary group">
                        <img ref={imageRef} src={displayImage} alt="Standardized Analysis View" className="w-full h-full object-contain" />

                        <div className="absolute top-2 right-2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="bg-black/70 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-sm">
                                Vista Analisi Standardizzata (512px)
                            </span>
                        </div>

                        <ScanPathOverlay
                            blocks={result.blockAnalysisResult.blocks}
                            gridSize={result.blockAnalysisResult.gridSize}
                            imageRect={imageRenderInfo}
                        />
                        <CursorHighlight
                            gridSize={result.blockAnalysisResult.gridSize}
                            imageRect={imageRenderInfo}
                            activeBlockPosition={activeEvent?.sourceBlock.position ?? null}
                        />
                    </div>
                    <CursorLoupe
                        activeEvent={activeEvent}
                        isPlaying={isPlaying}
                    />
                </div>

                <div className="lg:col-span-2 bg-brand-secondary/50 p-6 rounded-lg">
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-palette text-brand-accent"></i><span>Profilo Cromatico</span></h4>
                            <div className="space-y-3">
                                <StatBar label="Luminosità" value={visualProfile.lightness} colorClass="bg-gray-300" />
                                <StatBar label="Saturazione" value={visualProfile.saturation} colorClass="bg-brand-accent-light" />
                                <StatBar label="Diversità Tonalità" value={visualProfile.hueDiversity} colorClass="bg-purple-500" />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-base border-b border-brand-secondary pb-2"><i className="fas fa-music text-brand-accent"></i><span>Profilo Sonoro Scientifico</span></h4>
                            <div className="space-y-4">
                                <div>
                                    <h5 className="text-sm text-brand-text-secondary mb-2">Altezza Note</h5>
                                    <div className="space-y-2">
                                        <StatBar label="Gravi" value={audioProfile.pitch.low} colorClass="bg-teal-700" />
                                        <StatBar label="Medie" value={audioProfile.pitch.mid} colorClass="bg-teal-500" />
                                        <StatBar label="Acute" value={audioProfile.pitch.high} colorClass="bg-teal-300" />
                                    </div>
                                </div>
                                <div>
                                    <h5 className="text-sm text-brand-text-secondary mb-2">Dinamica Espressiva</h5>
                                    <div className="space-y-2">
                                        <StatBar label="Piano" value={audioProfile.dynamics.soft} colorClass="bg-cyan-700" />
                                        <StatBar label="Medio" value={audioProfile.dynamics.mid} colorClass="bg-cyan-500" />
                                        <StatBar label="Forte" value={audioProfile.dynamics.loud} colorClass="bg-cyan-300" />
                                    </div>
                                </div>
                                <div className="bg-brand-primary/30 p-3 rounded-lg border border-brand-secondary">
                                    <h5 className="text-sm text-brand-text-secondary mb-2 text-center">Profilo Sonoro Interattivo</h5>
                                    <AudioPlayer audioRef={audioRef} audioUrl={result.audioOutput.audioUrl} onTimeUpdate={handleTimeUpdate} onPlay={handlePlay} onStop={handleStop} />
                                    <MusicSheet activeEvent={activeEvent} />

                                    {/* --- NUOVI PULSANTI AZIONE --- */}
                                    <div className="flex gap-3 mt-4 pt-3 border-t border-brand-secondary/30">
                                        <button onClick={onReset} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 rounded text-xs font-bold transition-colors border border-red-500/30">
                                            <i className="fas fa-times mr-2"></i> ANNULLA
                                        </button>
                                        <button onClick={onSave} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 py-2 rounded text-xs font-bold transition-colors border border-green-500/30">
                                            <i className="fas fa-save mr-2"></i> SALVA E ARCHIVIA
                                        </button>
                                    </div>
                                    {/* --------------------------------- */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* ... Resto del codice invariato ... */}
                {isArtisticMode && result.musicGenerationPrompt && (
                    <InfoCard title="💡 Concept & Interpretazione AI" icon="fa-wand-magic-sparkles" className="lg:col-span-3 relative overflow-hidden">
                        <div className='space-y-4'>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <h5 className="text-brand-text-secondary text-xs font-bold">PROMPT GENERATIVO:</h5>
                                    <button onClick={copyPrompt} className="text-xs text-brand-accent hover:text-white transition-colors">
                                        <i className="fas fa-copy mr-1"></i> Copia
                                    </button>
                                </div>
                                <div className="bg-brand-primary/70 p-3 rounded-md text-sm font-mono text-green-400 break-words border border-green-900/50">
                                    {result.musicGenerationPrompt.stability_prompt}
                                </div>
                            </div>
                            <div>
                                <h5 className="text-brand-text-secondary text-xs mb-1 font-bold">Concept (Ita):</h5>
                                <p className="text-sm text-brand-text-secondary">
                                    {result.musicGenerationPrompt.main_prompt_ita}
                                </p>
                            </div>
                        </div>
                    </InfoCard>
                )}

                <InfoCard
                    title={isManualScan ? "Tipo Scansione" : "Selezione Culturale"}
                    icon={isManualScan ? "fa-layer-group" : "fa-globe-americas"}
                >
                    {isManualScan ? (
                        <>
                            <DataRow label="Pattern Scelto" value={<span className="text-brand-accent font-bold">{result.scanPattern.name.replace("Manuale: ", "")}</span>} />
                            <DataRow label="Modalità" value="Manuale (Override Utente)" />
                            <div className="my-2 border-t border-brand-secondary/50"></div>
                            <p className="text-xs text-brand-text-secondary mb-1 font-bold">Tradizione Musicale in Uso:</p>
                            <DataRow label="Nome" value={result.culturalSelectionResult.tradition.name} />
                            <DataRow label="Origine" value={result.culturalSelectionResult.tradition.cultural_family} />
                        </>
                    ) : (
                        <>
                            <DataRow label="Tradizione" value={result.culturalSelectionResult.tradition.name} />
                            <DataRow label="Famiglia" value={result.culturalSelectionResult.tradition.cultural_family} />
                            <DataRow label="Percorso Scansione" value={result.scanPattern.name} />
                            <DataRow label="Score" value={result.culturalSelectionResult.scoreBreakdown.total.toFixed(4)} />
                        </>
                    )}
                </InfoCard>

                <InfoCard title="Analisi & Sintesi" icon="fa-cogs">
                    <DataRow label="Griglia" value={`${result.blockAnalysisResult.gridSize}x${result.blockAnalysisResult.gridSize}`} />
                    <DataRow label="Eventi Audio" value={result.audioOutput.eventsCount} />
                    <DataRow label="Durata" value={`${result.audioOutput.duration.toFixed(2)}s`} />
                    <DataRow label="Qualità Audio" value="44.1kHz WAV" />
                </InfoCard>
                <InfoCard title="Certificato Forense" icon="fa-fingerprint">
                    <DataRow label="Image Hash" value={result.imageHash.substring(0, 16) + '...'} />
                    <DataRow label="Audio Hash" value={result.audioHash.substring(0, 16) + '...'} />
                    <DataRow label="Framework Ver." value="1.0" />
                </InfoCard>
                <InfoCard title="Performance" icon="fa-bolt">
                    <DataRow label="Tempo Totale" value={`${result.performanceMetrics.totalProcessingTime.toFixed(0)} ms`} />
                    {Object.entries(result.performanceMetrics)
                        .filter(([key]) => key !== 'totalProcessingTime')
                        .map(([key, value]) => (
                            <DataRow key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={`${(value as number).toFixed(0)} ms`} />
                        ))
                    }
                </InfoCard>

                <InfoCard title="Validazione Crittografica (QR)" icon="fa-qrcode">
                    {isPro ? (
                        <QrCodeDisplay
                            data={verificationUrl}
                            fileName={`QR_Cert_${result.imageHash.substring(0, 8)}.png`}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 bg-black/30 rounded-lg border border-white/5 relative overflow-hidden group cursor-pointer" onClick={onRequestAccess}>
                            <div className="absolute inset-0 backdrop-blur-sm"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent mb-2">
                                    <i className="fas fa-lock"></i>
                                </div>
                                <span className="text-xs font-bold text-white">Funzionalità Pro</span>
                                <span className="text-[10px] text-brand-text-secondary">Ascolto tramite QR bloccato</span>
                            </div>
                        </div>
                    )}
                </InfoCard>

                <InfoCard title="Download Artefatti" icon="fa-download">
                    <div className="flex flex-col gap-2 mt-2 relative">

                        {!isPro && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-lg text-center p-4 border border-brand-accent/20">
                                <i className="fas fa-lock text-2xl text-brand-accent mb-2"></i>
                                <h4 className="text-white font-bold text-sm">Download Bloccato</h4>
                                <p className="text-xs text-brand-text-secondary mb-3">Richiedi la licenza Pro per scaricare i certificati.</p>
                                <button onClick={onRequestAccess} className="px-4 py-1.5 bg-brand-accent text-black text-xs font-bold rounded-full hover:bg-brand-accent-light">
                                    Sblocca Ora
                                </button>
                            </div>
                        )}

                        <button disabled={!isPro} onClick={() => saveAs(result.audioOutput.audioWavBlob, 'generated_audio.wav')} className="w-full bg-brand-accent/20 text-brand-accent py-1 rounded hover:bg-brand-accent/30 disabled:opacity-50">
                            <i className="fas fa-file-audio mr-2"></i> Download WAV
                        </button>
                        <button disabled={!isPro} onClick={() => saveAs(result.audioOutput.midiBlob, 'musical_notation.mid')} className="w-full bg-brand-accent/20 text-brand-accent py-1 rounded hover:bg-brand-accent/30 disabled:opacity-50">
                            <i className="fas fa-music mr-2"></i> Download MIDI (Multi-track)
                        </button>

                        <button disabled={!isPro} onClick={handleVideoAction} className="w-full bg-purple-600/30 text-purple-300 py-1 rounded hover:bg-purple-600/50 border border-purple-500/30 relative overflow-hidden group disabled:opacity-50">
                            {generatedVideoBlob && <div className="absolute inset-0 bg-green-500/20"></div>}
                            <span className="relative z-10 flex items-center justify-center">
                                {generatedVideoBlob ? <i className="fas fa-file-video mr-2 text-green-400"></i> : <i className="fas fa-video mr-2"></i>}
                                {generatedVideoBlob ? "Download Video Forense (.mp4)" : "Genera Prova Cinetica (Kinetic Proof)"}
                            </span>
                        </button>

                        <button disabled={!isPro} onClick={handleDownloadSac} className="w-full bg-brand-accent font-bold text-brand-primary py-2 rounded hover:bg-brand-accent-light mt-2 shadow-lg disabled:opacity-50 disabled:bg-gray-600">
                            <i className="fas fa-box mr-2"></i> Download SAC Container
                        </button>
                        {generatedVideoBlob && (
                            <p className="text-[10px] text-center text-green-400">
                                *La prova video è inclusa nel file SAC
                            </p>
                        )}
                    </div>
                </InfoCard>

                {!isArtisticMode && (
                    <InfoCard title="Suite di Validazione" icon="fa-check-double" className="md:col-span-2 lg:col-span-1">
                        <ValidationItem result={result.validationResult.determinism} />
                        <ValidationItem result={result.validationResult.coverage} />
                        <ValidationItem result={result.validationResult.robustness} />
                        <ValidationItem result={result.validationResult.grid} />
                    </InfoCard>
                )}
            </div>
        </div>
    );
};