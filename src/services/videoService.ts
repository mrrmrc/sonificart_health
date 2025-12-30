
import { SonificationResult, Tradition } from '../types';
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

// --- PARTICLE SYSTEM ---
class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;

    constructor(x: number, y: number, color: string, speed: number) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.life = 1.0;
        this.maxLife = 1.0 + Math.random() * 0.5;
        this.color = color;
        this.size = 2 + Math.random() * 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02; // Fade out
        // Float upwards slightly (dreamy gravity)
        this.vy -= 0.05;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

export async function generateSonificationVideo(
    result: SonificationResult,
    onProgress: (progress: number) => void,
    options?: { title?: string, author?: string, overrideAudioBlob?: Blob }
): Promise<Blob> {
    const metadata = options;
    const isSyncMode = !!options?.overrideAudioBlob;

    return new Promise(async (resolve, reject) => {
        let audioCtx: AudioContext | null = null;
        let recorder: MediaRecorder | null = null;
        let source: AudioBufferSourceNode | null = null;
        let animationFrameId: number | null = null;

        try {
            // 1. Detect Mime Type
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

            // 3. Setup Audio
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtx = new AudioContextClass();

            // Decode audio
            const audioToDecode = options?.overrideAudioBlob || result.audioOutput.audioWavBlob;
            const audioData = await audioToDecode.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(audioData);

            source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048; // High res for smooth visuals
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const timeDataArray = new Uint8Array(bufferLength);

            // Setup Gain Node to ensure volume
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 1.0;

            const dest = audioCtx.createMediaStreamDestination();
            source.connect(analyser);
            analyser.connect(dest);

            // Connect to speakers via gain for monitoring
            source.connect(gainNode);
            // MUTED FOR GENERATION: User request "senza dover riascoltare"
            // We set gain to 0.0 instead of disconnecting, to ensure the AudioContext clock keeps running reliably.
            gainNode.gain.value = 0.0;
            gainNode.connect(audioCtx.destination);

            // 4. Load Assets
            const loadImage = (src: string): Promise<HTMLImageElement> => {
                return new Promise((res, rej) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => res(img);
                    img.onerror = () => rej(new Error("Errore caricamento immagine."));
                    img.src = src;
                });
            };

            const img = await loadImage(result.standardizedImageUrl);

            // OPTIMIZATION: Pre-render blurred background
            // Real-time blur(60px) on 1080p is very heavy. cache it.
            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = 512; // Lower res is fine for blur
            bgCanvas.height = 512;
            const bgCtx = bgCanvas.getContext('2d');
            if (bgCtx) {
                bgCtx.filter = 'blur(40px) brightness(0.6) saturate(1.2)';
                bgCtx.drawImage(img, 0, 0, 512, 512);
            }

            // --- PERFORMANCE OPTIMIZATION: Pre-render Glow Sprite ---
            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = 30;
            glowCanvas.height = 30;
            const gc = glowCanvas.getContext('2d');
            if (gc) {
                const grad = gc.createRadialGradient(15, 15, 0, 15, 15, 15);
                grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                gc.fillStyle = grad;
                gc.fillRect(0, 0, 30, 30);
            }

            // Prepare Logo
            const svg64 = btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)));
            const logoImg = await loadImage('data:image/svg+xml;base64,' + svg64);

            // 5. Setup Recorder
            const canvasStream = canvas.captureStream(30);
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);

            recorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType || undefined,
                videoBitsPerSecond: 6000000 // 6 Mbps for high-end cinematic quality
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
                if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
                resolve(blob);
            };

            // 6. Animation State
            const duration = audioBuffer.duration;
            if (audioCtx.state === 'suspended') await audioCtx.resume();

            source.start(0);
            recorder.start();
            const startTime = audioCtx.currentTime;

            // --- LAYOUT CONFIGURATION ---
            // Naximize Space usage as per user request
            const footerHeight = 220;
            const margin = 40; // Small margin for a sleek border-less look

            // Image Dimensions
            const naturalW = img.naturalWidth || 512;
            const naturalH = img.naturalHeight || 512;

            // Calculate scale to fill width or height (Contain but MAXIMIZED)
            const scaleX = (width - margin * 2) / naturalW;
            const scaleY = (height - margin * 2) / naturalH;
            const baseScale = Math.min(scaleX, scaleY);

            const imgW = naturalW * baseScale;
            const imgH = naturalH * baseScale;

            // Cursor State
            let cursorX = width / 2;
            let cursorY = height / 2;
            let targetX = cursorX;
            let targetY = cursorY;
            const particles: any[] = []; // Changed to use sprite

            const blocks = result.blockAnalysisResult.blocks;
            const gridSize = result.blockAnalysisResult.gridSize;

            const draw = () => {
                try {
                    if (!audioCtx) return;
                    const now = audioCtx.currentTime;
                    const elapsed = now - startTime;
                    const progress = Math.min(1, Math.max(0, elapsed / duration));
                    onProgress(progress * 100);

                    if (elapsed >= duration) {
                        if (recorder && recorder.state === 'recording') {
                            recorder.stop();
                            if (source) source.stop();
                        }
                        if (animationFrameId) cancelAnimationFrame(animationFrameId);
                        return;
                    }

                    // --- AUDIO ANALYSIS ---
                    analyser.getByteFrequencyData(dataArray);
                    analyser.getByteTimeDomainData(timeDataArray);

                    let sum = 0;
                    let weightedSum = 0;
                    let highSum = 0;
                    let bassSum = 0;
                    const usefulBins = Math.floor(bufferLength * 0.7);
                    const midPoint = Math.floor(usefulBins * 0.5);

                    for (let i = 0; i < usefulBins; i++) {
                        const val = dataArray[i];
                        sum += val;
                        weightedSum += i * val;
                        if (i < 20) bassSum += val;
                        if (i > midPoint) highSum += val;
                    }

                    const avgVol = sum / usefulBins;
                    const normalizedVol = avgVol / 255;
                    const normalizedBass = (bassSum / 20) / 255;

                    // SPACE COORDINATION: Centroid maps frequency to horizontal position (0 to 1)
                    const centroid = sum > 0 ? (weightedSum / sum) / usefulBins : 0.5;
                    const targetX_norm = centroid; // Low freq = Left, High freq = Right
                    const targetL = (highSum / (usefulBins - midPoint)) / 255 * 100;

                    // --- 2. RENDERING ---
                    const camX = Math.sin(now * 0.3) * 25;
                    const camY = Math.cos(now * 0.25) * 15;
                    const zoomDrift = 1.0 + (Math.sin(now * 0.15) * 0.02);

                    ctx.save();
                    ctx.fillStyle = '#050505';
                    ctx.fillRect(0, 0, width, height);

                    // Background (Parallax)
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    const bgScale = Math.max(width / 512, height / 512) * 1.5;
                    ctx.scale(bgScale, bgScale);
                    ctx.translate(camX * 0.3, camY * 0.3);
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(bgCanvas, -256, -256, 512, 512);
                    ctx.restore();

                    // Main Artwork
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    ctx.scale(zoomDrift, zoomDrift);
                    ctx.translate(camX, camY);

                    ctx.globalAlpha = 1.0;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 40;
                    ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
                    ctx.restore();

                    // --- 3. CURSOR LOGIC ---
                    const centerX = width / 2 + camX * zoomDrift;
                    const centerY = height / 2 + camY * zoomDrift;
                    const effW = imgW * zoomDrift;
                    const effH = imgH * zoomDrift;

                    if (isSyncMode) {
                        const chaos = timeDataArray[10] + timeDataArray[100];
                        const seedIndex = Math.floor((timeDataArray[0] + chaos + elapsed * 50) % blocks.length);

                        let bestBlock = blocks[seedIndex];
                        let minScore = 99999;

                        // Select block that matches both Brightness and Frequency position
                        for (let i = 0; i < 30; i++) {
                            const idx = (seedIndex + i * 17) % blocks.length;
                            const b = blocks[idx];
                            if (!b || b.isFiller) continue;
                            const bX_norm = b.position.x / gridSize;
                            const score = Math.abs(b.lab.l - targetL) + Math.abs(bX_norm - targetX_norm) * 80;
                            if (score < minScore) { minScore = score; bestBlock = b; }
                        }

                        if (bestBlock) {
                            const nX = (bestBlock.position.x / gridSize) - 0.5;
                            const nY = (bestBlock.position.y / gridSize) - 0.5;
                            targetX = centerX + (nX * effW);
                            targetY = centerY + (nY * effH);
                        }
                    } else {
                        const events = result.audioOutput.events.filter(e => !e.isAccompaniment);
                        const active = events.find(e => e.time <= elapsed && (e.time + e.duration) > elapsed);
                        if (active && active.sourceBlock) {
                            const nX = (active.sourceBlock.position.x / gridSize) - 0.5;
                            const nY = (active.sourceBlock.position.y / gridSize) - 0.5;
                            targetX = centerX + (nX * effW);
                            targetY = centerY + (nY * effH);
                        }
                    }

                    cursorX += (targetX - cursorX) * 0.15;
                    cursorY += (targetY - cursorY) * 0.15;

                    // Particles (Sprite Based)
                    if (normalizedVol > 0.05) {
                        for (let i = 0; i < (Math.floor(normalizedVol * 4) + 1); i++) {
                            particles.push({
                                x: cursorX, y: cursorY,
                                vx: (Math.random() - 0.5) * (2 + normalizedBass * 8),
                                vy: (Math.random() - 0.5) * (2 + normalizedBass * 8),
                                life: 1.0,
                                size: 10 + Math.random() * 20
                            });
                        }
                    }

                    particles.forEach(p => {
                        p.x += p.vx; p.y += p.vy;
                        p.vx *= 0.98; p.vy *= 0.98;
                        p.life -= 0.015;
                        if (p.life > 0) {
                            ctx.globalAlpha = p.life * 0.7;
                            const s = p.size * (0.5 + p.life * 0.5);
                            ctx.drawImage(glowCanvas, p.x - s / 2, p.y - s / 2, s, s);
                        }
                    });
                    while (particles.length > 0 && particles[0].life <= 0) particles.shift();

                    // Cursor Drawing
                    ctx.globalAlpha = 1.0;
                    ctx.save();
                    ctx.translate(cursorX, cursorY);
                    const cursorSize = 12 + (normalizedBass * 25);
                    ctx.shadowColor = 'white';
                    ctx.shadowBlur = 15 + normalizedVol * 30;
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, cursorSize, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = `rgba(255,255,255, ${0.4 + normalizedVol * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, cursorSize * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // --- 6. FOOTER OVERLAY ---
                    const title = metadata?.title || "SINFONIA VISIVA";
                    const author = metadata?.author || "SonificA.R.T.";

                    const grd = ctx.createLinearGradient(0, height - 220, 0, height);
                    grd.addColorStop(0, 'rgba(0,0,0,0)');
                    grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
                    grd.addColorStop(1, 'rgba(0,0,0,0.9)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, height - 220, width, 220);

                    // Waveform
                    const startX = 60, endX = width - 260, waveW = endX - startX, waveY = height - 100;
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(startX, height - 190, waveW, 2);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(startX, height - 190, waveW * progress, 2);

                    ctx.font = '300 36px "Inter", sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(title.toUpperCase(), 60, height - 90);
                    ctx.font = '100 22px "Inter", sans-serif';
                    ctx.fillStyle = '#aaa';
                    ctx.fillText(author, 60, height - 55);

                    const waveGrd = ctx.createLinearGradient(startX, 0, endX, 0);
                    waveGrd.addColorStop(0, '#ff3366'); waveGrd.addColorStop(0.5, '#ffcc00'); waveGrd.addColorStop(1, '#00ccff');
                    ctx.strokeStyle = waveGrd;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    const sX = waveW / usefulBins;
                    ctx.moveTo(startX, waveY);
                    for (let i = 0; i < usefulBins; i += 3) {
                        const v = dataArray[i];
                        ctx.lineTo(startX + (i * sX), waveY - (v / 255 * 100));
                    }
                    ctx.lineTo(endX, waveY);
                    ctx.stroke();

                    // Logo
                    ctx.drawImage(logoImg, width - 200, height - 160, 110, 110);

                    ctx.restore();
                    animationFrameId = requestAnimationFrame(draw);
                } catch (e: any) {
                    console.error("Critical Drawing Error:", e);
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    reject(e);
                }
            };

            draw();

        } catch (error) {
            if (audioCtx) audioCtx.close();
            console.error("Video Generation Failed:", error);
            reject(error);
        }
    });
}
