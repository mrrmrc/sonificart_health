
import { SonificationResult } from '../types';
import { LOGO_SVG_STRING } from '../components/Logo';

// Helper to detect supported MIME types
function getSupportedMimeType(): string {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log(`Using supported video MIME type: ${type}`);
            return type;
        }
    }
    return ''; // Fallback will let the browser decide default
}

export async function generateSonificationVideo(
    result: SonificationResult,
    onProgress: (progress: number) => void,
    metadata?: { title: string, author: string }
): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
        let audioCtx: AudioContext | null = null;
        let recorder: MediaRecorder | null = null;
        let source: AudioBufferSourceNode | null = null;
        let animationFrameId: number | null = null;

        try {
            // 1. Detect Mime Type first
            const mimeType = getSupportedMimeType();
            if (!mimeType && !MediaRecorder.isTypeSupported('video/webm')) {
                throw new Error("Il tuo browser non supporta la registrazione video tramite Canvas.");
            }

            // 2. Setup Canvas (Full HD 1920x1080)
            const width = 1920;
            const height = 1080;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error("Impossibile inizializzare il contesto grafico 2D.");

            // Fill black immediately
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // 3. Setup Audio Context & Source
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtx = new AudioContextClass();
            
            // Decode the WAV blob to an AudioBuffer
            const audioData = await result.audioOutput.audioWavBlob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(audioData);
            
            source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            // DO NOT connect to audioCtx.destination to render silently in background. 
            source.disconnect(); 
            source.connect(dest); 

            // 4. Load Assets (Image & Logo)
            const loadImage = (src: string): Promise<HTMLImageElement> => {
                return new Promise((res, rej) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous"; // Critical for canvas export safety
                    img.onload = () => res(img);
                    img.onerror = (e) => rej(new Error("Errore caricamento immagine per il video."));
                    img.src = src;
                });
            };

            const img = await loadImage(result.standardizedImageUrl);

            // Prepare Logo from SVG string
            const svg64 = btoa(unescape(encodeURIComponent(LOGO_SVG_STRING))); // Safe unicode encoding
            const b64Start = 'data:image/svg+xml;base64,';
            const logoImg = await loadImage(b64Start + svg64);

            // 5. Setup MediaRecorder
            const canvasStream = canvas.captureStream(30); // 30 FPS
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);

            recorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType || undefined,
                videoBitsPerSecond: 8000000 // 8 Mbps High Quality
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                try {
                    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
                    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
                    resolve(blob);
                } catch (e) {
                    reject(e);
                }
            };

            recorder.onerror = (e) => {
                console.error("Recorder Error:", e);
                reject(new Error("Errore durante la registrazione del video via MediaRecorder."));
            };

            // 6. Start Process
            const duration = audioBuffer.duration;
            // Need to resume context if it's suspended (browser policy)
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            // Small buffer to ensure stream is ready
            source.start(0); 
            recorder.start();
            const startTime = audioCtx.currentTime;

            const events = result.audioOutput.events.filter(e => !e.isAccompaniment);
            const gridSize = result.blockAnalysisResult.gridSize;
            
            // LAYOUT CALCULATIONS (Forensic Style)
            const footerHeight = 200; 
            const headerHeight = 60;
            const mainAreaHeight = height - footerHeight - headerHeight;
            const mainAreaY = headerHeight;
            
            // Calculate scale to fit image perfectly in the center
            const scale = Math.min(width / 512, mainAreaHeight / 512) * 0.9; 
            const drawW = 512 * scale;
            const drawH = 512 * scale;
            const drawX = (width - drawW) / 2;
            const drawY = mainAreaY + (mainAreaHeight - drawH) / 2;

            const title = metadata?.title || "Opera Senza Titolo";
            const author = metadata?.author || "SonificA.R.T. User";

            const draw = () => {
                if (!audioCtx) return;

                const now = audioCtx.currentTime;
                const elapsed = now - startTime;
                const progress = Math.min(1, Math.max(0, elapsed / duration));
                
                onProgress(progress * 100);

                if (elapsed >= duration + 0.5) { // End condition
                    if (recorder && recorder.state === 'recording') {
                        recorder.stop();
                        if (source) source.stop();
                    }
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    return;
                }

                // --- RENDER FRAME ---
                
                // 1. Background (Tech/Forensic Black)
                ctx.fillStyle = '#050505';
                ctx.fillRect(0, 0, width, height);

                // 2. Header (Status Bar)
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, width, headerHeight);
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, headerHeight); ctx.lineTo(width, headerHeight); ctx.stroke();

                ctx.font = 'bold 20px "Courier New", monospace';
                ctx.fillStyle = '#2dd4bf'; // Teal
                ctx.textAlign = 'left';
                ctx.fillText("SONIFICART FRAMEWORK v1.0 • KINETIC PROOF", 40, 38);
                
                ctx.textAlign = 'right';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`HASH: ${result.imageHash.substring(0, 16)}... [VERIFIED]`, width - 40, 38);

                // --- WATERMARK (Background) ---
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.rotate(-Math.PI / 12);
                ctx.font = 'bold 120px sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.textAlign = 'center';
                ctx.fillText("FORENSIC", 0, 0);
                ctx.restore();

                // 3. Source Image
                ctx.drawImage(img, drawX, drawY, drawW, drawH);

                // 4. Grid Overlay (Technical)
                ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)'; // Brand Accent low opacity
                ctx.lineWidth = 1;
                const cellW = drawW / gridSize;
                const cellH = drawH / gridSize;
                
                if (gridSize <= 64) {
                    ctx.beginPath();
                    for (let i = 0; i <= gridSize; i++) {
                        ctx.moveTo(drawX + i * cellW, drawY);
                        ctx.lineTo(drawX + i * cellW, drawY + drawH);
                        ctx.moveTo(drawX, drawY + i * cellH);
                        ctx.lineTo(drawX + drawW, drawY + i * cellH);
                    }
                    ctx.stroke();
                }

                // 5. Active Cursor & Telemetry Data
                const activeEvent = events.find(e => 
                    e.time <= elapsed && (e.time + e.duration) > elapsed
                );

                let currentNote = "---";
                let currentFreq = "--- Hz";
                let coordX = "--";
                let coordY = "--";
                let rgbVal = "RGB(---,---,---)";

                if (activeEvent) {
                    const bx = activeEvent.sourceBlock.position.x;
                    const by = activeEvent.sourceBlock.position.y;
                    
                    coordX = bx.toString().padStart(2,'0');
                    coordY = by.toString().padStart(2,'0');
                    
                    // Highlight Box (Targeting Reticle style)
                    const cx = drawX + bx * cellW;
                    const cy = drawY + by * cellH;
                    
                    ctx.fillStyle = 'rgba(45, 212, 191, 0.4)';
                    ctx.fillRect(cx, cy, cellW, cellH);
                    
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx, cy, cellW, cellH);
                    
                    // Crosshair lines to axis
                    ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
                    ctx.setLineDash([5, 5]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cx + cellW/2, drawY); ctx.lineTo(cx + cellW/2, drawY + drawH); // Vertical
                    ctx.moveTo(drawX, cy + cellH/2); ctx.lineTo(drawX + drawW, cy + cellH/2); // Horizontal
                    ctx.stroke();
                    ctx.setLineDash([]);

                    currentNote = activeEvent.noteName;
                    currentFreq = `${(440 * Math.pow(2, (activeEvent.midiFloat - 69) / 12)).toFixed(2)} Hz`;
                    const {r, g, b} = activeEvent.sourceBlock;
                    rgbVal = `RGB(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
                }

                // --- 6. FOOTER (Telemetry Dashboard) ---
                const footerY = height - footerHeight;
                
                // Separator Line
                ctx.fillStyle = '#2dd4bf';
                ctx.fillRect(0, footerY, width, 2);
                
                // Footer Background
                ctx.fillStyle = '#020617';
                ctx.fillRect(0, footerY + 2, width, footerHeight);

                // --- TELEMETRY COLUMNS ---
                const col1X = 60;
                const col2X = 500;
                const col3X = 1000;
                const col4X = 1500;
                const row1Y = footerY + 60;
                const row2Y = footerY + 120;

                // Labels font
                ctx.font = '14px "Inter", sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'left';
                
                ctx.fillText("TIMESTAMP (SYNC)", col1X, row1Y - 30);
                ctx.fillText("GRID COORDINATES", col2X, row1Y - 30);
                ctx.fillText("AUDIO FREQUENCY", col3X, row1Y - 30);
                ctx.fillText("COLOR DATA", col4X, row1Y - 30);

                // Values font (Monospace for precision)
                ctx.font = 'bold 36px "Courier New", monospace';
                ctx.fillStyle = '#f8fafc';

                // 1. TIME
                ctx.fillText(`T+${elapsed.toFixed(3)}s`, col1X, row1Y + 10);
                
                // 2. COORDS
                ctx.fillStyle = '#2dd4bf'; // Accent color for location
                ctx.fillText(`[X:${coordX}, Y:${coordY}]`, col2X, row1Y + 10);
                
                // 3. FREQ
                ctx.fillStyle = '#a855f7'; // Purple for audio
                ctx.fillText(`${currentNote} / ${currentFreq}`, col3X, row1Y + 10);

                // 4. COLOR
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px "Courier New", monospace';
                ctx.fillText(rgbVal, col4X, row1Y + 10);

                // Sub-info (Title/Tradition)
                ctx.font = '16px "Inter", sans-serif';
                ctx.fillStyle = '#475569';
                ctx.fillText(`PROJECT: ${title.toUpperCase()}`, col1X, row2Y);
                ctx.fillText(`TRADITION: ${result.culturalSelectionResult.tradition.name.toUpperCase()}`, col2X, row2Y);
                ctx.fillText(`PATTERN: ${result.scanPattern.name.toUpperCase()}`, col3X, row2Y);

                // Logo Stamp
                ctx.drawImage(logoImg, width - 140, footerY + 40, 100, 100);

                // Progress Bar at bottom
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, height - 10, width, 10);
                ctx.fillStyle = '#2dd4bf';
                ctx.fillRect(0, height - 10, width * progress, 10);

                animationFrameId = requestAnimationFrame(draw);
            };

            draw();

        } catch (error) {
            // Cleanup on error
            if (audioCtx) audioCtx.close();
            console.error("Video Generation Failed:", error);
            reject(error);
        }
    });
}
