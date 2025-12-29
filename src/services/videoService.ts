
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
    options?: { title?: string, author?: string, overrideAudioBlob?: Blob }
): Promise<Blob> {
    const metadata = options; // For compatibility with the internal usage of 'metadata' variable

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

            // Decode the selected audio (either override or original)
            const audioToDecode = options?.overrideAudioBlob || result.audioOutput.audioWavBlob;
            const audioData = await audioToDecode.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(audioData);

            source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const dest = audioCtx.createMediaStreamDestination();
            source.connect(analyser);
            analyser.connect(dest);
            // Connect only to destination for background rendering

            // 4. Load Assets (Image & Logo)
            const loadImage = (src: string): Promise<HTMLImageElement> => {
                return new Promise((res, rej) => {
                    const img = new Image();
                    const timeout = setTimeout(() => {
                        img.src = ''; // Cancel loading
                        rej(new Error("Timeout caricamento asset immagine (10s). Verifica la connessione."));
                    }, 10000);

                    img.crossOrigin = "anonymous";
                    img.onload = () => { clearTimeout(timeout); res(img); };
                    img.onerror = () => { clearTimeout(timeout); rej(new Error("Errore caricamento immagine sorgente.")); };
                    img.src = src;
                });
            };

            console.log("VideoService: Loading image from", result.standardizedImageUrl);
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

            // STATE FOR ANIMATION
            let lastEventIndex = -1;
            let currentImpulse = 0; // 0 to 1, decays over time
            let cursorX = 0; // For Lerp
            let cursorY = 0; // For Lerp
            let cursorHistory: { x: number, y: number }[] = [];
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

                // PRE-CALCULATE ACTIVE EVENT FOR EFFECTS
                const activeEvent = events.find(e =>
                    e.time <= elapsed && (e.time + e.duration) > elapsed
                );

                onProgress(progress * 100);

                if (elapsed >= duration) { // End condition: EXACT DURATION
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

                // --- ANALYZE AUDIO & EVENTS FOR RHYTHMIC IMPACT ---
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avgVolume = sum / dataArray.length;
                const audioLevel = avgVolume / 255;
                const bassLevel = (dataArray[0] + dataArray[1] + dataArray[2]) / (3 * 255);

                // Detect Note Attack (New Event)
                // We already have activeEvent from the top of the loop
                const activeEventIndex = events.indexOf(activeEvent as any);

                if (activeEventIndex !== -1 && activeEventIndex !== lastEventIndex) {
                    currentImpulse = 1.0; // TRIGGER KICK
                    lastEventIndex = activeEventIndex;
                } else {
                    currentImpulse *= 0.9; // Decay
                }

                // Combined Impact: Audio Energy + Rythmic Kick
                const totalImpact = (audioLevel * 0.4) + (currentImpulse * 0.6);

                // 3. Image Effects (Kick & Pulse)
                // Much stronger pulse on note attacks
                const pulseScale = 1 + (totalImpact * 0.15) + (bassLevel * 0.05);
                const currentDrawW = drawW * pulseScale;
                const currentDrawH = drawH * pulseScale;
                const currentDrawX = (width - currentDrawW) / 2;
                const currentDrawY = mainAreaY + (mainAreaHeight - currentDrawH) / 2;

                // GRID KICK (Elastic Distortion on Bass)
                const gridDistortion = bassLevel * 20;

                // --- SYNESTHETIC BLOOM (Reactive Color Flash) ---
                if (totalImpact > 0.01) {
                    const gradient = ctx.createRadialGradient(
                        width / 2, mainAreaY + mainAreaHeight / 2, 0,
                        width / 2, mainAreaY + mainAreaHeight / 2, drawW * (1.2 + totalImpact)
                    );

                    const alpha = totalImpact * (activeEvent ? 0.8 : 0.4);
                    // If Impulse is high, flash white/bright
                    const baseColor = activeEvent ?
                        { r: activeEvent.sourceBlock.r, g: activeEvent.sourceBlock.g, b: activeEvent.sourceBlock.b } :
                        { r: 45, g: 212, b: 191 };

                    // Flash effect on attack
                    const flashMix = currentImpulse * 150;
                    const r = Math.min(255, baseColor.r + flashMix);
                    const g = Math.min(255, baseColor.g + flashMix);
                    const b = Math.min(255, baseColor.b + flashMix);

                    const bloomColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;

                    gradient.addColorStop(0, bloomColor);
                    gradient.addColorStop(0.3 + (totalImpact * 0.2), bloomColor.replace(/[\d\.]+\)$/, (alpha * 0.1).toFixed(2) + ")"));
                    gradient.addColorStop(1, 'transparent');

                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, mainAreaY, width, mainAreaHeight);
                    ctx.restore();
                }

                // --- DYNAMIC VIGNETTE ---
                // Tightens on beats
                const vigSize = 0.8 - (currentImpulse * 0.1);
                const vignetteStrength = 0.5 + (bassLevel * 0.3);
                const vigGrad = ctx.createRadialGradient(width / 2, height / 2, drawW * 0.5, width / 2, height / 2, width * vigSize);
                vigGrad.addColorStop(0, 'transparent');
                vigGrad.addColorStop(1, `rgba(0,0,0, ${vignetteStrength})`);
                ctx.fillStyle = vigGrad;
                ctx.fillRect(0, 0, width, height);

                // Render Base Image
                ctx.save();
                if (currentImpulse > 0.8) { // Glitch/Shake on Note Attack
                    const shake = currentImpulse * 15;
                    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
                    // Chromatic Aberration Simulation (simplifed shift)
                    ctx.globalAlpha = 0.7;
                    ctx.drawImage(img, currentDrawX + 5, currentDrawY, currentDrawW, currentDrawH);
                    ctx.globalAlpha = 1.0;
                }
                ctx.drawImage(img, currentDrawX, currentDrawY, currentDrawW, currentDrawH);
                ctx.restore();

                // 4. Grid Overlay (Technical)
                ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)'; // Brand Accent low opacity
                ctx.lineWidth = 1;
                const cellW = drawW / gridSize;
                const cellH = drawH / gridSize;

                if (gridSize <= 64) {
                    ctx.beginPath();
                    for (let i = 0; i <= gridSize; i++) {
                        // Elastic Grid Lines
                        const x = drawX + i * cellW;
                        const y = drawY + i * cellH;

                        // Vertical Lines with distortion
                        ctx.moveTo(x, drawY);
                        if (i % 2 === 0 && gridDistortion > 1) {
                            ctx.quadraticCurveTo(x + (Math.sin(now * 10 + i) * gridDistortion), drawY + drawH / 2, x, drawY + drawH);
                        } else {
                            ctx.lineTo(x, drawY + drawH);
                        }

                        // Horizontal Lines
                        ctx.moveTo(drawX, y);
                        if (i % 2 !== 0 && gridDistortion > 1) {
                            ctx.quadraticCurveTo(drawX + drawW / 2, y + (Math.cos(now * 10 + i) * gridDistortion), drawX + drawW, y);
                        } else {
                            ctx.lineTo(drawX + drawW, y);
                        }
                    }
                    ctx.stroke();
                }

                // --- 5. Active Cursor & Telemetry Data
                let currentNote = "---";
                let currentFreq = "--- Hz";
                let coordX = "--";
                let coordY = "--";
                let rgbVal = "RGB(---,---,---)";

                if (activeEvent) {
                    const bx = activeEvent.sourceBlock.position.x;
                    const by = activeEvent.sourceBlock.position.y;

                    coordX = bx.toString().padStart(2, '0');
                    coordY = by.toString().padStart(2, '0');

                    // Highlight Box (Targeting Reticle style)
                    const targetCx = drawX + bx * cellW;
                    const targetCy = drawY + by * cellH;

                    // LERP Cursor Position (Smooth movement)
                    const lerpSpeed = 0.2 + (currentImpulse * 0.5); // Faster on beat
                    if (cursorX === 0 && cursorY === 0) { cursorX = targetCx; cursorY = targetCy; }
                    cursorX += (targetCx - cursorX) * lerpSpeed;
                    cursorY += (targetCy - cursorY) * lerpSpeed;

                    const activeCx = cursorX;
                    const activeCy = cursorY;

                    // Update Cursor History
                    cursorHistory.push({ x: activeCx + cellW / 2, y: activeCy + cellH / 2 }); // Store center of cell
                    if (cursorHistory.length > 20) cursorHistory.shift();

                    // Draw Trail
                    if (cursorHistory.length > 1) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(${activeEvent.sourceBlock.r}, ${activeEvent.sourceBlock.g}, ${activeEvent.sourceBlock.b}, 0.5)`;
                        ctx.lineWidth = 4 * pulseScale;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo(cursorHistory[0].x, cursorHistory[0].y);
                        for (let p of cursorHistory) ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    }

                    // --- POLYMORPHIC CURSOR ---
                    const dynamicImpact = 0.4 + (totalImpact * 0.8);

                    // Shape morphing based on MIDI note (Freq)
                    // Low (Bass) -> Circle/Pentagon
                    // Mid -> Square
                    // High -> Triangle/Star
                    const note = activeEvent.midiFloat;
                    ctx.fillStyle = `rgba(${activeEvent.sourceBlock.r}, ${activeEvent.sourceBlock.g}, ${activeEvent.sourceBlock.b}, ${dynamicImpact})`;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2 + currentImpulse * 3;

                    const size = (cellW / 2) * (1 + currentImpulse * 0.5);
                    const centerX = activeCx + cellW / 2;
                    const centerY = activeCy + cellH / 2;

                    ctx.beginPath();
                    if (note < 50) {
                        // Bass: Pentagon
                        for (let i = 0; i < 5; i++) {
                            const angle = (i * 2 * Math.PI / 5) - Math.PI / 2 + (now * 2);
                            const x = centerX + size * Math.cos(angle);
                            const y = centerY + size * Math.sin(angle);
                            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                    } else if (note < 70) {
                        // Mid: Square / Diamond
                        // Morph from square (0 rot) to diamond (45 rot) based on impact
                        ctx.save();
                        ctx.translate(centerX, centerY);
                        ctx.rotate(currentImpulse * Math.PI);
                        ctx.rect(-size / 1.5, -size / 1.5, size * 1.3, size * 1.3);
                        ctx.restore();
                    } else {
                        // High: Triangle / Star
                        for (let i = 0; i < 3; i++) {
                            const angle = (i * 2 * Math.PI / 3) - Math.PI / 2 + (now * 5);
                            const x = centerX + size * Math.cos(angle);
                            const y = centerY + size * Math.sin(angle);
                            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                    }

                    ctx.fill();
                    ctx.stroke();

                    // Crosshair lines to axis (Target Lock)
                    ctx.strokeStyle = `rgba(${activeEvent.sourceBlock.r}, ${activeEvent.sourceBlock.g}, ${activeEvent.sourceBlock.b}, 0.6)`;
                    ctx.setLineDash([10, 10]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(centerX, drawY); ctx.lineTo(centerX, drawY + drawH); // Vertical
                    ctx.moveTo(drawX, centerY); ctx.lineTo(drawX + drawW, centerY); // Horizontal
                    ctx.stroke();
                    ctx.setLineDash([]);

                    currentNote = activeEvent.noteName;
                    currentFreq = `${(440 * Math.pow(2, (activeEvent.midiFloat - 69) / 12)).toFixed(2)} Hz`;
                    const { r, g, b } = activeEvent.sourceBlock;
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
                ctx.fillText(`PROJECT: ${title.toUpperCase()}${options?.overrideAudioBlob ? ' (SINESTESIA POTENZIATA)' : ''}`, col1X, row2Y);
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
