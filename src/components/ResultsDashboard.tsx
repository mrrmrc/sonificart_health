import React, {
    useState,
    useCallback,
    useRef,
    useEffect,
    useMemo
} from 'react';
import { SonificationResult, TransformedNoteEvent, User } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { ScanPathOverlay } from './ScanPathOverlay';
import { CursorHighlight } from './CursorHighlight';
import { CursorLoupe } from './CursorLoupe';
import { MusicSheet } from './MusicSheet';
import saveAs from 'file-saver';
import { generateSonificationVideo } from '../services/videoService';
import { createSacContainer } from '../services/sacService';
import { useLanguage } from '../contexts/LanguageContext';

/* ===========================
   UI HELPERS
=========================== */

const InfoCard: React.FC<{
    title: string;
    icon: string;
    children: React.ReactNode;
    className?: string;
}> = ({ title, icon, children, className }) => (
    <div className={`bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary ${className || ''}`}>
        <h4 className="font-bold text-brand-accent mb-3 flex items-center gap-2">
            <i className={`fas ${icon}`} />
            <span>{title}</span>
        </h4>
        <div className="space-y-2 text-sm text-brand-text-primary relative h-full">
            {children}
        </div>
    </div>
);

const DataRow: React.FC<{
    label: string;
    value: string | number | React.ReactNode;
}> = ({ label, value }) => (
    <div className="flex justify-between items-start gap-2">
        <span className="text-brand-text-secondary flex-shrink-0">{label}:</span>
        <span className="font-mono text-right break-words">{value}</span>
    </div>
);

const StatBar: React.FC<{
    label: string;
    value: number;
    colorClass: string;
}> = ({ label, value, colorClass }) => {
    const v = Math.round(Math.min(100, Math.max(0, value || 0)));
    return (
        <div>
            <div className="flex justify-between items-center mb-1 text-xs">
                <span className="text-brand-text-secondary">{label}</span>
                <span className="font-mono text-white">{v}%</span>
            </div>
            <div className="w-full bg-brand-primary/70 rounded-full h-2">
                <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${v}%` }} />
            </div>
        </div>
    );
};

/* ===========================
   PROPS
=========================== */

interface ResultsDashboardProps {
    result: SonificationResult;
    imageUrl: string;
    onReset: () => void;
    onSave: () => void;
    user: User | null;
    onRequestAccess: () => void;
    isHistoryView?: boolean;
}

/* ===========================
   COMPONENT
=========================== */

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
    result,
    imageUrl,
    onReset,
    onSave,
    user,
    onRequestAccess,
    isHistoryView = false
}) => {
    const { t } = useLanguage();

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastEventIndexRef = useRef(0);

    /* ===========================
       CORREZIONE BLOCCHI / EVENTI
    =========================== */

    const correctedResult = useMemo(() => {
        const blockAnalysis = result.blockAnalysisResult;
        if (!blockAnalysis?.blocks?.length) return result;

        const img = imageRef.current;
        if (!img?.naturalWidth) return result;

        const { naturalWidth, naturalHeight } = img;
        const ar = naturalWidth / naturalHeight;

        let dw = 512;
        let dh = 512;
        if (ar > 1) dh = 512 / ar;
        else dw = 512 * ar;

        const dx = (512 - dw) / 2;
        const dy = (512 - dh) / 2;
        const imageBounds = { x: dx, y: dy, width: dw, height: dh };

        const gridSize = blockAnalysis.gridSize || 32;
        const blockW = 512 / gridSize;
        const blockH = 512 / gridSize;

        const correctedBlocks = blockAnalysis.blocks.map(block => {
            const cx = block.position.x * blockW + blockW / 2;
            const cy = block.position.y * blockH + blockH / 2;
            const isFiller =
                cx <= imageBounds.x ||
                cx >= imageBounds.x + imageBounds.width ||
                cy <= imageBounds.y ||
                cy >= imageBounds.y + imageBounds.height;

            return { ...block, isFiller };
        });

        const correctedEvents = result.audioOutput.events.map(evt => {
            if (!evt.sourceBlock) return evt;
            const match = correctedBlocks.find(
                b =>
                    b.position.x === evt.sourceBlock!.position.x &&
                    b.position.y === evt.sourceBlock!.position.y
            );
            return { ...evt, sourceBlock: match || evt.sourceBlock };
        });

        return {
            ...result,
            blockAnalysisResult: {
                ...blockAnalysis,
                blocks: correctedBlocks
            },
            audioOutput: {
                ...result.audioOutput,
                events: correctedEvents
            }
        };
    }, [result]);

    /* ===========================
       STATE
    =========================== */

    const [imageRenderInfo, setImageRenderInfo] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [playbackTime, setPlaybackTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeEvent, setActiveEvent] = useState<TransformedNoteEvent | null>(null);
    const [hoverEvent, setHoverEvent] = useState<TransformedNoteEvent | null>(null);

    /* ===========================
       IMAGE LAYOUT
    =========================== */

    const calculateImageRect = useCallback(() => {
        if (!imageRef.current || !containerRef.current) return;
        const { naturalWidth, naturalHeight } = imageRef.current;
        const { clientWidth, clientHeight } = containerRef.current;
        if (!naturalWidth || !clientWidth) return;

        const imgAR = naturalWidth / naturalHeight;
        const contAR = clientWidth / clientHeight;

        let w, h, x, y;
        if (imgAR > contAR) {
            w = clientWidth;
            h = clientWidth / imgAR;
            x = 0;
            y = (clientHeight - h) / 2;
        } else {
            h = clientHeight;
            w = clientHeight * imgAR;
            y = 0;
            x = (clientWidth - w) / 2;
        }

        setImageRenderInfo({ x, y, width: w, height: h });
    }, []);

    useEffect(() => {
        const img = imageRef.current;
        if (!img) return;
        img.onload = calculateImageRect;
        calculateImageRect();
        return () => {
            img.onload = null;
        };
    }, [calculateImageRect, imageUrl]);

    /* ===========================
       RESOLVED EVENTS (PULITO)
    =========================== */

    const resolvedEvents = useMemo(() => {
        const blocks = correctedResult.blockAnalysisResult?.blocks || [];
        const gridSize = correctedResult.blockAnalysisResult?.gridSize || 32;
        const fallbackDuration = correctedResult.configUsed?.noteDurationSeconds || 0.5;
        let runningTime = 0;

        return (correctedResult.audioOutput?.events || [])
            .map((evt, idx) => {
                let block = evt.sourceBlock;

                if (!block?.position) {
                    const bi = typeof evt.sourceBlockIndex === 'number' ? evt.sourceBlockIndex : idx;
                    block =
                        blocks[bi] ||
                        {
                            r: 100,
                            g: 100,
                            b: 100,
                            position: { x: bi % gridSize, y: Math.floor(bi / gridSize) },
                            hsv: { h: 0, s: 0, v: 0 },
                            lab: { l: 50, a: 0, b: 0 },
                            variance: 0,
                            isFiller: false
                        };
                }

                const duration =
                    Number.isFinite(evt.duration) && evt.duration > 0 ? evt.duration : fallbackDuration;
                const time = Number.isFinite(evt.time) ? evt.time : runningTime;
                runningTime = time + duration;

                return {
                    ...evt,
                    time,
                    duration,
                    noteName: evt.noteName || 'C',
                    midiFloat: Number.isFinite(evt.midiFloat) ? evt.midiFloat : 60,
                    velocity: Number.isFinite(evt.velocity) ? evt.velocity : 100,
                    sourceBlock: block,
                    isAccompaniment: evt.isAccompaniment === true
                };
            })
            .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    }, [correctedResult]);

    const melodyEvents = useMemo(
        () => resolvedEvents.filter(e => !e.isAccompaniment && !e.sourceBlock?.isFiller),
        [resolvedEvents]
    );

    /* ===========================
       PLAYBACK → EVENT
    =========================== */

    useEffect(() => {
        if (!isPlaying || !melodyEvents.length) return;

        let start = lastEventIndexRef.current;
        if (playbackTime < (melodyEvents[start]?.time || 0)) start = 0;

        let found = -1;
        for (let i = start; i < melodyEvents.length; i++) {
            const e = melodyEvents[i];
            if (e.time + e.duration > playbackTime) {
                found = i;
                break;
            }
        }

        if (found !== -1 && melodyEvents[found]) {
            setActiveEvent(melodyEvents[found]);
            lastEventIndexRef.current = found;
        }
    }, [playbackTime, isPlaying, melodyEvents]);

    /* ===========================
       RENDER
    =========================== */

    const displayEvent = isPlaying ? activeEvent : hoverEvent || activeEvent;

    return (
        <div className="animate-fade-in">
            <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div
                    ref={containerRef}
                    className="lg:col-span-3 relative aspect-square bg-black rounded-md overflow-hidden border border-brand-secondary"
                >
                    <img
                        ref={imageRef}
                        src={correctedResult.standardizedImageUrl}
                        alt="Analysis"
                        className="w-full h-full object-contain"
                    />

                    {correctedResult.blockAnalysisResult && (
                        <ScanPathOverlay
                            blocks={correctedResult.blockAnalysisResult.blocks}
                            gridSize={correctedResult.blockAnalysisResult.gridSize}
                            imageRect={imageRenderInfo}
                        />
                    )}

                    <CursorHighlight
                        gridSize={correctedResult.blockAnalysisResult?.gridSize || 32}
                        imageRect={imageRenderInfo}
                        activeBlockPosition={displayEvent?.sourceBlock?.position ?? null}
                    />
                </div>

                <div className="lg:col-span-2">
                    <AudioPlayer
                        audioRef={audioRef}
                        audioUrl={correctedResult.audioOutput.audioUrl}
                        onTimeUpdate={setPlaybackTime}
                        onPlay={() => setIsPlaying(true)}
                        onStop={() => {
                            setIsPlaying(false);
                            lastEventIndexRef.current = 0;
                            setActiveEvent(null);
                        }}
                    />
                    <MusicSheet activeEvent={displayEvent} />
                    <CursorLoupe activeEvent={displayEvent} isPlaying={isPlaying} />
                </div>
            </div>
        </div>
    );
};
