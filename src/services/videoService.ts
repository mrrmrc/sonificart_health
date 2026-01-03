
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
            const footerHeight = 180; // Reduced to give more space
            const margin = 20; // Minimal margins

            // Image Dimensions
            const naturalW = img.naturalWidth || 512;
            const naturalH = img.naturalHeight || 512;

            // Calculate scale to fill width or height (Contain but MAXIMIZED)
            const scaleX = (width - margin * 2) / naturalW;
            const scaleY = (height - footerHeight - margin) / naturalH;
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

            // OPTIMIZATION: Pre-calculate filtered events to avoid doing it every frame (60fps)
            const videoEvents = result.audioOutput.events.filter(e => !e.isAccompaniment);
            const originalDuration = result.audioOutput.duration || 30; // Fallback

            const draw = () => {
                try {
                    if (!audioCtx) return;
                    const now = audioCtx.currentTime;
                    const elapsed = now - startTime;
                    const progress = Math.min(1, Math.max(0, elapsed / duration));
                    onProgress(progress * 100);

                    if (elapsed >= duration) {
                        // Stop exactly at duration (or slightly after to prevent audio cut)
                        if (recorder && recorder.state === 'recording') {
                            recorder.stop();
                            if (source) {
                                try { source.stop(); } catch (e) { }
                            }
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

                    // Reduced loops for analysis if possible, but 70% of bins is okay.
                    for (let i = 0; i < usefulBins; i += 2) { // OPTIMIZATION: Skip every other bin for speed (negligible visual difference)
                        const val = dataArray[i];
                        sum += val;
                        weightedSum += i * val;
                        if (i < 20) bassSum += val;
                        if (i > midPoint) highSum += val;
                    }

                    // Adjust sums because we skipped bins
                    sum *= 2;
                    weightedSum *= 2; // Rough approx

                    const avgVol = sum / usefulBins;
                    const normalizedVol = avgVol / 255;
                    const normalizedBass = (bassSum / 10) / 255; // Adjusted for loop skip

                    // SPACE COORDINATION: Centroid maps frequency to horizontal position (0 to 1)
                    const centroid = sum > 0 ? (weightedSum / sum) / usefulBins : 0.5;
                    const targetX_norm = centroid;
                    const targetL = (highSum / (usefulBins - midPoint)) / 255 * 100 * 2; // Adjusted

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
                        // SYNC MODE: Normalize current time to original sonification timeline
                        // This ensures the cursor follows the original scan pattern
                        // but stretched/compressed to fit the new audio duration.
                        const normalizedTime = (elapsed / duration) * originalDuration;

                        // Find event using pre-calculated array
                        // Optimization: Use binary search or assume events are sorted? They are usually sorted.
                        // For now, simpler optimization: Since time moves forward, we could cache the last index?
                        // But finding in a few hundred/thousand items is okay if not creating new arrays.
                        const active = videoEvents.find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);

                        if (active && active.sourceBlock) {
                            const nX = (active.sourceBlock.position.x / gridSize) - 0.5;
                            const nY = (active.sourceBlock.position.y / gridSize) - 0.5;
                            targetX = centerX + (nX * effW);
                            targetY = centerY + (nY * effH);
                        } else if (videoEvents.length > 0) {
                            // Interpolate for fluidity
                            const lastEvent = videoEvents[videoEvents.length - 1];
                            if (normalizedTime >= lastEvent.time) {
                                const b = lastEvent.sourceBlock;
                                targetX = centerX + ((b.position.x / gridSize - 0.5) * effW);
                                targetY = centerY + ((b.position.y / gridSize - 0.5) * effH);
                            }
                        }
                    } else {
                        const active = videoEvents.find(e => e.time <= elapsed && (e.time + e.duration) > elapsed);
                        if (active && active.sourceBlock) {
                            const nX = (active.sourceBlock.position.x / gridSize) - 0.5;
                            const nY = (active.sourceBlock.position.y / gridSize) - 0.5;
                            targetX = centerX + (nX * effW);
                            targetY = centerY + (nY * effH);
                        }
                    }

                    cursorX += (targetX - cursorX) * 0.15;
                    cursorY += (targetY - cursorY) * 0.15;

                    // Particles (Optimized)
                    if (normalizedVol > 0.05 && particles.length < 50) { // Limit max particles
                        const count = Math.min(2, Math.floor(normalizedVol * 3)); // Reduce spawn rate
                        for (let i = 0; i < count; i++) {
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
                        p.life -= 0.02; // Faster fade to cleanup quicker
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

                    const footerY = height - 180;
                    const grd = ctx.createLinearGradient(0, footerY, 0, height);
                    grd.addColorStop(0, 'rgba(0,0,0,0)');
                    grd.addColorStop(0.4, 'rgba(0,0,0,0.8)');
                    grd.addColorStop(1, 'rgba(0,0,0,0.95)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, footerY, width, 180);

                    // Re-calculate some audio values for the bars
                    const lowFreq = bassSum / 10 / 255; // Adjusted
                    const midFreq = (sum / usefulBins) / 255;
                    const highFreq = (highSum / (usefulBins - midPoint)) / 255;

                    // RGB Values from current analysis (to tint the bars)
                    let currentR = 255, currentG = 255, currentB = 255;
                    // Find out what block we are currently analyzing to get the RGB
                    if (!isSyncMode) {
                        const active = videoEvents.find(e => e.time <= elapsed && (e.time + e.duration) > elapsed);
                        if (active && active.sourceBlock) {
                            currentR = active.sourceBlock.r;
                            currentG = active.sourceBlock.g;
                            currentB = active.sourceBlock.b;
                        }
                    } else {
                        // Sync Mode RGB logic
                        const normalizedTime = (elapsed / duration) * originalDuration;
                        const active = videoEvents.find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);
                        if (active && active.sourceBlock) {
                            currentR = active.sourceBlock.r;
                            currentG = active.sourceBlock.g;
                            currentB = active.sourceBlock.b;
                        }
                    }

                    // --- DRAW RGB LED BARS ---
                    const barWidth = 12;
                    const barGap = 40;
                    const barsStartX = width - 450;
                    const barsY = height - 60;
                    const maxBarH = 100;

                    const drawLEDBar = (x: number, val: number, r: number, g: number, b: number, label: string) => {
                        const h = val * maxBarH;
                        // Glow shadow
                        ctx.shadowBlur = 15 + val * 20;
                        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;

                        // LED segments look
                        const segments = 10;
                        const segH = maxBarH / segments;
                        for (let i = 0; i < segments; i++) {
                            const segY = barsY - (i + 1) * segH;
                            const isActive = (i / segments) < val;
                            ctx.fillStyle = isActive ? `rgba(${r},${g},${b},1)` : `rgba(${r},${g},${b},0.15)`;
                            ctx.fillRect(x, segY + 1, barWidth, segH - 2);
                        }

                        ctx.shadowBlur = 0;
                        ctx.font = 'bold 10px "Inter", sans-serif';
                        ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
                        ctx.fillText(label, x - 5, barsY + 15);
                    };

                    drawLEDBar(barsStartX, lowFreq, currentR, 50, 50, 'LOW');
                    drawLEDBar(barsStartX + barGap, midFreq, 50, currentG, 50, 'MID');
                    drawLEDBar(barsStartX + barGap * 2, highFreq, 50, 50, currentB, 'HIGH');

                    // Title & Author (Left aligned)
                    ctx.font = '600 42px "Outfit", sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(title.toUpperCase(), 60, height - 95);
                    ctx.font = '300 24px "Inter", sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.fillText(author, 60, height - 55);

                    // Progress Bar (Slimmer)
                    ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    ctx.fillRect(60, height - 145, width - 360, 3);
                    ctx.fillStyle = '#fff';
                    ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
                    ctx.fillRect(60, height - 145, (width - 360) * progress, 3);
                    ctx.shadowBlur = 0;

                    // Logo
                    ctx.drawImage(logoImg, width - 180, height - 150, 90, 90);

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
