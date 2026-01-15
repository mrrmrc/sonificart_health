import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { LOGO_SVG_STRING } from '../components/Logo';

export interface VideoGenOptions {
    audioUrl: string | Blob;
    imageUrl: string | Blob;
    title?: string;
    subtitle?: string;
    description?: string; // New
    date?: string;
    author?: string;
    duration?: number; // Optional override
    onProgress: (percent: number) => void;
}

// --- HELPER: Visual State ---
interface VisualState {
    imageData: ImageData | null;
}

// --- HELPER: SVG to Bitmap ---
async function svgToBitmap(svgString: string, size: number = 100): Promise<ImageBitmap> {
    const svg64 = btoa(svgString);
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    const img = new Image();
    img.src = image64;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => reject(new Error("SVG Load Error"));
    });

    // Fix: Explicitly resize to handle SVGs without natural dimensions
    return createImageBitmap(img, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: 'high'
    });
}

// --- HELPER: Get Visible Bounds (Trim Transparency/Black) ---
const getVisibleBounds = (pixelData: Uint8ClampedArray, width: number, height: number, minBrightness = 10) => {
    let minX = width;
    let maxX = 0;

    for (let y = 0; y < height; y += 4) { // Scan every 4th line for speed
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixelData[idx];
            const g = pixelData[idx + 1];
            const b = pixelData[idx + 2];
            const a = pixelData[idx + 3];

            if (a > 20 && (r + g + b) > minBrightness) { // Ignore fully transparent or pitch black
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
            }
        }
    }
    // Safety fallback
    if (minX > maxX) return { minX: 0, maxX: width, width };
    return { minX, maxX, width: maxX - minX };
};

// --- HELPER: Draw Frame (Shared Logic) ---
function drawFrame(
    ctx: CanvasRenderingContext2D,
    img: ImageBitmap,
    logo: ImageBitmap | null,
    pixelData: Uint8ClampedArray | null,
    freqData: Uint8Array,
    time: number,
    duration: number,
    W: number, H: number,
    VideoH: number, FooterH: number, SafeArea: number,
    visualBounds: { minX: number, maxX: number, width: number },
    title?: string, author?: string,
    subtitle?: string, date?: string, description?: string
) {
    // ... (Lines 80-199 retained implicitly, wait tool replaces specific block. 
    // I need to be careful with range. I will replace the function signature and the footer logic.
    // Since replacing the whole function is safer for "signature + footer + visualizer" simultaneous edit.)

    // 1. Draw Image (Contain Mode with subtle zoom)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, VideoH);

    const imgRatio = img.width / img.height;
    const canvasRatio = W / VideoH;
    let dw = W;
    let dh = VideoH;
    let dx = 0;
    let dy = 0;

    if (imgRatio > canvasRatio) {
        dh = W / imgRatio;
        dy = (VideoH - dh) / 2;
    } else {
        dw = VideoH * imgRatio;
        dx = (W - dw) / 2;
    }

    // A. Zoom (Fixed 1.0)
    const zDw = dw;
    const zDh = dh;
    const zDx = dx;
    const zDy = dy;

    ctx.drawImage(img, zDx, zDy, zDw, zDh);

    // 2. Synced Scanning Effect & Pixel Sonification
    const progress = Math.min(1, Math.max(0, time / duration));
    const scanStart = visualBounds.minX;
    const scanWidth = visualBounds.width;
    const scanX = Math.floor(scanStart + (progress * scanWidth));

    // A. Draw Scanline
    ctx.save();
    ctx.beginPath();
    ctx.rect(visualBounds.minX, zDy, visualBounds.width, zDh);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, 0, VideoH);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
    grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(scanX - 1, zDy, 3, zDh);

    // B. Pixel Viz
    if (pixelData) {
        const sampleStep = 15;
        const vizWidth = 80;
        ctx.lineWidth = 3;

        for (let y = zDy; y < zDy + zDh; y += sampleStep) {
            const sy = Math.floor(y);
            if (sy < 0 || sy >= VideoH) continue;
            const idx = (sy * W + scanX) * 4;
            if (idx < 0 || idx >= pixelData.length - 4) continue;
            const r = pixelData[idx];
            const g = pixelData[idx + 1];
            const b = pixelData[idx + 2];
            const brightness = (r + g + b) / 3;

            if (brightness > 30) {
                const fIdx = Math.floor(((y - zDy) / zDh) * (freqData.length / 2));
                const amp = freqData[fIdx] || 0;
                if (amp > 20) {
                    const size = (amp / 255) * vizWidth * (brightness / 255);
                    ctx.strokeStyle = `rgba(${r},${g},${b}, ${amp / 200})`;
                    ctx.beginPath();
                    ctx.moveTo(scanX - size, y);
                    ctx.quadraticCurveTo(scanX, y - size / 2, scanX + size, y);
                    ctx.stroke();
                }
            }
        }
    }
    ctx.restore();

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SONIFICART PREMIUM VIDEO LAYOUT - Redesigned with 3-column footer
    // Left: Title, Description, Author/Date | Center: Compact Audio Bars | Right: Logo
    // ═══════════════════════════════════════════════════════════════════════════════════

    // --- TOP LEFT BRANDING: Logo + "SonificA.R.T." (Refined) ---
    if (logo) {
        ctx.save();

        // Elegant gradient bar behind branding
        const brandBg = ctx.createLinearGradient(0, 0, 400, 0);
        brandBg.addColorStop(0, 'rgba(10, 21, 32, 0.95)');
        brandBg.addColorStop(0.7, 'rgba(10, 21, 32, 0.6)');
        brandBg.addColorStop(1, 'rgba(10, 21, 32, 0)');
        ctx.fillStyle = brandBg;
        ctx.fillRect(0, 0, 420, 70);

        // Accent line under branding
        const accentGrad = ctx.createLinearGradient(0, 70, 350, 70);
        accentGrad.addColorStop(0, '#2dd4bf');
        accentGrad.addColorStop(0.5, '#a855f7');
        accentGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = accentGrad;
        ctx.fillRect(0, 68, 350, 2);

        const logoSize = 40;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(logo, 20, 14, logoSize, logoSize);

        // Text "SonificA.R.T."
        ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText('Sonific', 70, 40);

        // Colored "A.R.T."
        const sonificWidth = ctx.measureText('Sonific').width;
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText('A.R.T.', 70 + sonificWidth, 40);

        // Tagline
        ctx.font = '9px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 0;
        ctx.fillText('DETERMINISTIC SONIFICATION FRAMEWORK', 70, 54);
        ctx.restore();
    }

    // --- FOOTER BACKGROUND (Premium Dark Gradient) ---
    const footerY = VideoH;
    const footerGrad = ctx.createLinearGradient(0, footerY, 0, footerY + FooterH);
    footerGrad.addColorStop(0, '#0d1820');
    footerGrad.addColorStop(0.4, '#0a1218');
    footerGrad.addColorStop(1, '#060a0e');
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, footerY, W, FooterH);

    // --- PROGRESS BAR (Elegant, integrated at top of footer) ---
    const progressBarHeight = 4;
    const progressWidth = Math.floor(progress * W);

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, footerY, W, progressBarHeight);

    // Progress fill with gradient
    const progGrad = ctx.createLinearGradient(0, footerY, W, footerY);
    progGrad.addColorStop(0, '#2dd4bf');
    progGrad.addColorStop(0.5, '#60d5f5');
    progGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = progGrad;
    ctx.fillRect(0, footerY, progressWidth, progressBarHeight);

    // Glow at progress head
    if (progressWidth > 0) {
        const glowGrad = ctx.createRadialGradient(progressWidth, footerY + 2, 0, progressWidth, footerY + 2, 20);
        glowGrad.addColorStop(0, 'rgba(45, 212, 191, 0.8)');
        glowGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(progressWidth - 20, footerY, 40, 10);
    }

    // --- 3-COLUMN LAYOUT ---
    // Column widths: Left 55% | Center 25% | Right 20%
    const colLeftWidth = W * 0.55;
    const colCenterWidth = W * 0.25;
    const colRightWidth = W * 0.20;
    const colLeftX = 30;
    const colCenterX = colLeftWidth;
    const colRightX = colLeftWidth + colCenterWidth;
    const contentY = footerY + progressBarHeight + 15;

    // === LEFT COLUMN: Title, Description, Author/Date ===
    ctx.save();

    // TITLE (Large, prominent)
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    const titleStr = (title || "Opera Senza Titolo");
    const maxTitleWidth = colLeftWidth - 60;
    let displayTitle = titleStr;
    if (ctx.measureText(displayTitle).width > maxTitleWidth) {
        while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 0) {
            displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += '...';
    }
    ctx.fillText(displayTitle, colLeftX, contentY + 30);
    ctx.restore();

    // DESCRIPTION (Below title, smaller, with text wrap)
    if (description) {
        ctx.save();
        ctx.font = '16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'left';

        const maxDescWidth = colLeftWidth - 60;
        let displayDesc = description;
        if (ctx.measureText(displayDesc).width > maxDescWidth * 2) {
            while (ctx.measureText(displayDesc + '...').width > maxDescWidth * 2 && displayDesc.length > 0) {
                displayDesc = displayDesc.slice(0, -1);
            }
            displayDesc += '...';
        }

        // Word wrap for 2 lines max
        const words = displayDesc.split(' ');
        let line1 = '';
        let line2 = '';
        let onLine1 = true;

        for (const word of words) {
            const testLine = onLine1 ? line1 + word + ' ' : line2 + word + ' ';
            if (ctx.measureText(testLine.trim()).width <= maxDescWidth) {
                if (onLine1) line1 = testLine;
                else line2 = testLine;
            } else if (onLine1) {
                onLine1 = false;
                line2 = word + ' ';
            }
        }

        ctx.fillText(line1.trim(), colLeftX, contentY + 60);
        if (line2.trim()) {
            ctx.fillText(line2.trim(), colLeftX, contentY + 80);
        }
        ctx.restore();
    }

    // AUTHOR & DATE (Bottom of left column)
    ctx.save();
    const authorDateY = contentY + 120;

    // Author with accent color
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#2dd4bf';
    const authorStr = author || "SonificART";
    ctx.fillText(authorStr.toUpperCase(), colLeftX, authorDateY);

    // Separator dot
    const authorWidth = ctx.measureText(authorStr.toUpperCase()).width;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('  •  ', colLeftX + authorWidth, authorDateY);

    // Date
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const dateStr = date || new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.fillText(dateStr, colLeftX + authorWidth + 40, authorDateY);
    ctx.restore();

    // === CENTER COLUMN: Compact Audio Equalizer Bars ===
    const barAreaX = colCenterX + 20;
    const barAreaWidth = colCenterWidth - 40;
    const barAreaY = contentY + 20;
    const barAreaHeight = 100;
    const numBars = 24;
    const barWidth = (barAreaWidth / numBars) * 0.7;
    const barGap = (barAreaWidth / numBars) * 0.3;

    ctx.save();
    for (let i = 0; i < numBars; i++) {
        const freqIndex = Math.floor((i / numBars) * freqData.length * 0.6);
        const amp = (freqData[freqIndex] || 0) / 255;
        const barHeight = Math.max(4, amp * barAreaHeight * 0.9);
        const x = barAreaX + i * (barWidth + barGap);
        const y = barAreaY + barAreaHeight - barHeight;

        // Bar gradient (cyan to purple based on position)
        const barGrad = ctx.createLinearGradient(x, y + barHeight, x, y);
        const colorPos = i / numBars;
        if (colorPos < 0.5) {
            barGrad.addColorStop(0, '#2dd4bf');
            barGrad.addColorStop(1, '#60d5f5');
        } else {
            barGrad.addColorStop(0, '#60d5f5');
            barGrad.addColorStop(1, '#a855f7');
        }

        ctx.fillStyle = barGrad;

        // Rounded bar
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
        ctx.fill();

        // Glow effect on active bars
        if (amp > 0.3) {
            ctx.shadowColor = colorPos < 0.5 ? '#2dd4bf' : '#a855f7';
            ctx.shadowBlur = amp * 15;
        }
    }
    ctx.shadowBlur = 0;

    // Label under equalizer
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('AUDIO SPECTRUM', barAreaX + barAreaWidth / 2, barAreaY + barAreaHeight + 20);
    ctx.restore();

    // === RIGHT COLUMN: Logo & Branding ===
    if (logo) {
        ctx.save();
        const logoSize = 80;
        const logoX = colRightX + (colRightWidth - logoSize) / 2;
        const logoY = contentY + 20;

        // Subtle glow behind logo
        const logoGlow = ctx.createRadialGradient(logoX + logoSize / 2, logoY + logoSize / 2, 0, logoX + logoSize / 2, logoY + logoSize / 2, logoSize);
        logoGlow.addColorStop(0, 'rgba(45, 212, 191, 0.15)');
        logoGlow.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = logoGlow;
        ctx.fillRect(logoX - 20, logoY - 20, logoSize + 40, logoSize + 40);

        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

        // Text under logo
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SONIFIC', logoX + logoSize / 2, logoY + logoSize + 20);
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText('A.R.T.', logoX + logoSize / 2 + ctx.measureText('SONIFIC').width / 2 + 2, logoY + logoSize + 20);

        // Version/Tagline
        ctx.font = '9px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('sonificart.com', logoX + logoSize / 2, logoY + logoSize + 35);
        ctx.restore();
    }

    // --- Decorative corner accents ---
    ctx.save();
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.3)';
    ctx.lineWidth = 2;

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(10, footerY + FooterH - 30);
    ctx.lineTo(10, footerY + FooterH - 10);
    ctx.lineTo(30, footerY + FooterH - 10);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(W - 10, footerY + FooterH - 30);
    ctx.lineTo(W - 10, footerY + FooterH - 10);
    ctx.lineTo(W - 30, footerY + FooterH - 10);
    ctx.stroke();
    ctx.restore();
}


// Helper: Decode Audio
function decodeAudio(blob: Blob): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const buffer = await audioCtx.decodeAudioData(arrayBuffer);
                resolve(buffer);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

export const VideoGenService = {
    generateVideo: async (options: VideoGenOptions): Promise<Blob> => {
        const { audioUrl, imageUrl, title, author, subtitle, date, description, onProgress } = options;
        console.log("🚀 Starting Turbo Video Generation (Logo + New Viz)...");

        // 1. Load Resources
        console.log("Reading Blobs...");
        const audioBlob = audioUrl instanceof Blob ? audioUrl : await fetch(audioUrl).then(r => r.blob());
        const imageBlob = imageUrl instanceof Blob ? imageUrl : await fetch(imageUrl).then(r => r.blob());

        let audioBuffer: AudioBuffer;
        try {
            audioBuffer = await decodeAudio(audioBlob);
        } catch (e) {
            console.error("Decode Audio Failed:", e);
            throw new Error(`Non riesco a decodificare l'audio. (${e})`);
        }

        const imageBitmap = await createImageBitmap(imageBlob);

        // Load Logo
        const logoBitmap = await svgToBitmap(LOGO_SVG_STRING, 128);

        const duration = options.duration || audioBuffer.duration;

        // 2. Constants
        const FPS = 24;
        const TOTAL_FRAMES = Math.floor(duration * FPS);
        const WIDTH = 1280;
        const HEIGHT = 720 + 200; // Increased Footer based on user feedback
        const VIDEO_W = 1280;
        const VIDEO_H = 720;
        const FOOTER_H = 200;
        const TOP_SAFE_AREA = 120;

        // 3. Muxer Setup
        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: WIDTH,
                height: HEIGHT
            },
            audio: {
                codec: 'aac',
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels
            },
            fastStart: 'in-memory',
            firstTimestampBehavior: 'offset'
        });

        // 4. Setup Canvas & Pixel Data
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext('2d', { alpha: false, deserialized: true } as any) as CanvasRenderingContext2D | null;
        if (!ctx) throw new Error("Canvas Context Failed");

        // Pre-draw image to get pixel data for sonification viz
        // Use exact logic as drawFrame for scaling
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, WIDTH, VIDEO_H);
        const calcRatio = () => {
            const imgRatio = imageBitmap.width / imageBitmap.height;
            const canvasRatio = WIDTH / VIDEO_H;
            if (imgRatio > canvasRatio) {
                const dh = WIDTH / imgRatio;
                const dy = (VIDEO_H - dh) / 2;
                return { dx: 0, dy, dw: WIDTH, dh };
            } else {
                const dw = VIDEO_H * imgRatio;
                const dx = (WIDTH - dw) / 2;
                return { dx, dy: 0, dw, dh: VIDEO_H };
            }
        }
        const { dx, dy, dw, dh } = calcRatio();
        ctx.drawImage(imageBitmap, dx, dy, dw, dh);

        // Grab pixel data 
        let pixelData: Uint8ClampedArray | null = null;
        try {
            const imageData = ctx.getImageData(0, 0, WIDTH, VIDEO_H);
            pixelData = imageData.data;
        } catch (e) {
            console.warn("Could not get pixel data (tainted canvas?)", e);
        }

        // 4b. Calc Visual Bounds
        const visualBounds = pixelData ? getVisibleBounds(pixelData, WIDTH, VIDEO_H) : { minX: dx, maxX: dx + dw, width: dw };

        // 5. Video Encoder Setup
        const videoConfig: VideoEncoderConfig = {
            codec: 'avc1.4d002a',
            width: WIDTH,
            height: HEIGHT,
            bitrate: 5_000_000,
            framerate: FPS,
        };

        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => console.error("Video Encoder Error", e)
        });
        videoEncoder.configure(videoConfig);

        // 6. Audio Encoder Setup
        const audioConfig: AudioEncoderConfig = {
            codec: 'mp4a.40.2',
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            bitrate: 128_000,
        };

        const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (e) => console.error("Audio Encoder Error", e)
        });
        audioEncoder.configure(audioConfig);

        // 7. Offline Processing
        const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.duration * audioBuffer.sampleRate, audioBuffer.sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(offlineCtx.destination);
        source.start(0);

        const freqData = new Uint8Array(analyser.frequencyBinCount);

        let frameIndex = 0;
        const timeStep = 1 / FPS;

        const processFrame = async () => {
            const time = frameIndex * timeStep;
            analyser.getByteFrequencyData(freqData);

            drawFrame(
                ctx!, imageBitmap, logoBitmap, pixelData, freqData, time, duration,
                WIDTH, HEIGHT, VIDEO_H, FOOTER_H, TOP_SAFE_AREA,
                visualBounds,
                title, author, subtitle, date, description
            );

            const frameBitmap = await createImageBitmap(canvas);
            const videoFrame = new VideoFrame(frameBitmap, { timestamp: time * 1_000_000, duration: timeStep * 1_000_000 });

            if (videoEncoder.encodeQueueSize > 20) await videoEncoder.flush();
            videoEncoder.encode(videoFrame, { keyFrame: frameIndex % (FPS * 2) === 0 });
            videoFrame.close();
            frameBitmap.close();
            onProgress(Math.floor((frameIndex / TOTAL_FRAMES) * 80));
        };

        const processLoop = new Promise<void>((resolve, reject) => {
            offlineCtx.oncomplete = () => resolve();
            const tick = (scheduledTime: number) => {
                if (frameIndex >= TOTAL_FRAMES) {
                    offlineCtx.resume();
                    return;
                }
                offlineCtx.suspend(scheduledTime).then(async () => {
                    try { await processFrame(); }
                    catch (err) { reject(err); return; }

                    const nextTime = (frameIndex + 1) * timeStep;
                    frameIndex++;
                    if (nextTime < duration) {
                        tick(nextTime);
                        offlineCtx.resume();
                    } else {
                        offlineCtx.resume();
                    }
                }).catch(reject);
            };
            tick(0);
            offlineCtx.startRendering(); // Start!
        });

        // Feed Audio (Standard Planar)
        const feedAudio = async () => {
            const chunkSize = audioBuffer.sampleRate;
            let offset = 0;
            while (offset < audioBuffer.length) {
                const len = Math.min(chunkSize, audioBuffer.length - offset);
                const rawBuffer = new Float32Array(len * audioBuffer.numberOfChannels);
                for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                    const channel = audioBuffer.getChannelData(ch);
                    rawBuffer.set(channel.subarray(offset, offset + len), ch * len);
                }
                const audioData = new AudioData({
                    format: 'f32-planar',
                    sampleRate: audioBuffer.sampleRate,
                    numberOfFrames: len,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    timestamp: (offset / audioBuffer.sampleRate) * 1_000_000,
                    data: rawBuffer
                });
                audioEncoder.encode(audioData);
                audioData.close();
                offset += len;
                await new Promise(r => setTimeout(r, 0));
            }
        };

        await Promise.all([processLoop, feedAudio()]);

        console.log("Encoding Finished. Flushing...");
        onProgress(90);
        await videoEncoder.flush();
        await audioEncoder.flush();

        console.log("Finalizing Muxer...");
        muxer.finalize();

        const buffer = muxer.target.buffer;
        return new Blob([buffer], { type: 'video/mp4' });
    }
};
