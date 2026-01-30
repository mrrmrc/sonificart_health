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
    // 1. COMPOSITE BACKGROUND (The "Floating" Effect)
    // Draw base black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, VideoH);

    // Draw blurred background cover
    ctx.save();
    ctx.filter = 'blur(60px) brightness(0.35) saturate(0.8)'; // Slightly more muted for better focus
    // Scale image to cover entire area
    const coverRatio = W / VideoH;
    const imgRatio = img.width / img.height;
    let cw = W, ch = VideoH;
    if (imgRatio > coverRatio) {
        cw = VideoH * imgRatio;
    } else {
        ch = W / imgRatio;
    }
    ctx.drawImage(img, (W - cw) / 2, (VideoH - ch) / 2, cw, ch);

    // Add a subtle radial vignette for depth
    const vignette = ctx.createRadialGradient(W / 2, VideoH / 2, 0, W / 2, VideoH / 2, W / 1.5);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, VideoH);
    ctx.restore();

    // 2. MAIN IMAGE (Floating with Shadow)
    let dw = W;
    let dh = VideoH;
    let dx = 0;
    let dy = 0;

    const canvasRatio = W / VideoH;
    if (imgRatio > canvasRatio) {
        dh = W / imgRatio;
        dy = (VideoH - dh) / 2;
    } else {
        dw = VideoH * imgRatio;
        dx = (W - dw) / 2;
    }

    ctx.save();
    // Neutral glow for floating effect (no offset to maintain centering)
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw the image - Slightly larger for better impact (0.98 scale)
    const scale = 0.98;
    const zDw = dw * scale;
    const zDh = dh * scale;
    const zDx = dx + (dw * (1 - scale) / 2);
    const zDy = dy + (dh * (1 - scale) / 2);

    ctx.drawImage(img, zDx, zDy, zDw, zDh);
    ctx.restore();

    // 3. Synced Scanning Effect & Pixel Sonification
    const progress = Math.min(1, Math.max(0, time / duration));

    // Constrain scan to visual bounds of the ARTWORK
    const scanStart = (visualBounds.minX - dx) * scale + zDx;
    const scanEnd = (visualBounds.maxX - dx) * scale + zDx;
    const scanWidth = scanEnd - scanStart;
    const scanX = Math.floor(scanStart + (progress * scanWidth));

    // A. Draw Scanline
    ctx.save();
    ctx.beginPath();
    ctx.rect(zDx, zDy, zDw, zDh);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, 0, VideoH);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
    grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(scanX - 1, zDy, 3, zDh);

    // B. Pixel Viz (Interactive Particles)
    if (pixelData) {
        const sampleStep = 18;
        const vizWidth = 100;
        ctx.lineWidth = 2.5;

        for (let y = zDy; y < zDy + zDh; y += sampleStep) {
            const sy = Math.floor(y);
            if (sy < 0 || sy >= VideoH) continue;
            // Use W for pixelData indexing as it was grabbed from current canvas width
            const idx = (sy * W + scanX) * 4;
            if (idx < 0 || idx >= pixelData.length - 4) continue;

            const r = pixelData[idx];
            const g = pixelData[idx + 1];
            const b = pixelData[idx + 2];
            const brightness = (r + g + b) / 3;

            if (brightness > 40) {
                const fIdx = Math.floor(((y - zDy) / zDh) * (freqData.length / 2));
                const amp = freqData[fIdx] || 0;
                if (amp > 15) {
                    const size = (amp / 255) * vizWidth * (brightness / 255);
                    ctx.strokeStyle = `rgba(${r},${g},${b}, ${amp / 180})`;
                    ctx.beginPath();
                    ctx.moveTo(scanX - size, y);
                    ctx.lineTo(scanX + size, y);
                    ctx.stroke();
                }
            }
        }
    }
    ctx.restore();

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SONIFICART PREMIER VIDEO LAYOUT - Final Polish (Legibility & Aesthetics)
    // ═══════════════════════════════════════════════════════════════════════════════════

    // --- FOOTER BACKGROUND (Pure Deep Black) ---
    const footerY = VideoH;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, footerY, W, FooterH);

    // --- PROGRESS BAR (Ultra-thin, elegant) ---
    const progressBarHeight = 3;
    const progressWidth = Math.floor(progress * W);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, footerY, W, progressBarHeight);

    const progGrad = ctx.createLinearGradient(0, footerY, W, footerY);
    progGrad.addColorStop(0, '#2dd4bf');
    progGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = progGrad;
    ctx.fillRect(0, footerY, progressWidth, progressBarHeight);

    // --- 3-COLUMN LAYOUT REDESIGN (Non-overlapping) ---
    const paddingX = 60;

    // Column Definitions
    const colLeftWidth = 450;
    const colRightWidth = 400;
    const colCenterWidth = W - (colLeftWidth + colRightWidth + (paddingX * 2));

    const colLeftX = paddingX;
    const colCenterX = colLeftX + colLeftWidth;
    const colRightX = W - colRightWidth - paddingX;

    // === LEFT COLUMN: METADATA ===
    ctx.save();
    // TITLE (Large & Premium)
    ctx.font = '900 34px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const displayTitleStr = (title || "Opera Senza Titolo").toUpperCase();

    // Handle truncate if title too long
    let titleToDraw = displayTitleStr;
    if (ctx.measureText(titleToDraw).width > colLeftWidth) {
        while (ctx.measureText(titleToDraw + "...").width > colLeftWidth && titleToDraw.length > 0) {
            titleToDraw = titleToDraw.slice(0, -1);
        }
        titleToDraw += "...";
    }
    ctx.fillText(titleToDraw, colLeftX, footerY + 70);

    // AUTHOR
    ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#2dd4bf';
    const authorText = (author || "SonificART").toUpperCase();
    ctx.fillText(authorText, colLeftX, footerY + 110);

    // DATE
    ctx.font = '500 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const dateStrFormatted = date || new Date().toLocaleDateString('it-IT');
    ctx.fillText(dateStrFormatted, colLeftX, footerY + 140);

    // DESCRIPTION (New!)
    if (description) {
        ctx.font = 'italic 500 16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        let descToDraw = description;
        if (ctx.measureText(descToDraw).width > colLeftWidth) {
            descToDraw = descToDraw.substring(0, 60) + "...";
        }
        ctx.fillText(descToDraw, colLeftX, footerY + 175);
    }
    ctx.restore();

    // === CENTER COLUMN: DYNAMIC SPECTRUM ===
    const barAreaWidth = colCenterWidth - 40;
    const barAreaX = colCenterX + 20;
    const barAreaY = footerY + 65;
    const barAreaHeight = 80;
    const numBars = 32; // Fewer bars for cleaner look
    const barWidth = (barAreaWidth / numBars) * 0.7;
    const barGap = (barAreaWidth / numBars) * 0.3;

    ctx.save();
    for (let i = 0; i < numBars; i++) {
        const freqIndex = Math.floor((i / numBars) * freqData.length * 0.4);
        const ampValue = (freqData[freqIndex] || 0) / 255;
        const bH = Math.max(4, ampValue * barAreaHeight);
        const bx = barAreaX + i * (barWidth + barGap);
        const by = barAreaY + barAreaHeight - bH;

        const bGrad = ctx.createLinearGradient(bx, by + bH, bx, by);
        bGrad.addColorStop(0, '#2dd4bf');
        bGrad.addColorStop(1, '#60a5fa');

        ctx.fillStyle = bGrad;
        ctx.fillRect(bx, by, barWidth, bH);

        if (ampValue > 0.7) {
            ctx.shadowColor = '#2dd4bf';
            ctx.shadowBlur = 10;
            ctx.fillRect(bx, by, barWidth, bH);
        }
    }
    ctx.restore();

    // === RIGHT COLUMN: BRANDING (Aligned & Premium) ===
    if (logo) {
        ctx.save();
        const logoSize = 110;
        const lx = colRightX;
        const ly = footerY + (FooterH - logoSize) / 2 + 10;

        // Draw Eye Icon with glow
        ctx.shadowColor = 'rgba(45, 212, 191, 0.4)';
        ctx.shadowBlur = 25;
        ctx.drawImage(logo, lx, ly, logoSize, logoSize);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';

        // "SONIFIC"
        ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('SONIFIC', lx + logoSize + 22, ly + 40);
        const sonificWidth = ctx.measureText('SONIFIC').width;

        // "A.R.T."
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText('A.R.T.', lx + logoSize + 22 + sonificWidth + 8, ly + 40);
        const artWidth = ctx.measureText('A.R.T.').width;

        // Version 
        ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText('v1.0', lx + logoSize + 22 + sonificWidth + artWidth + 15, ly + 40);

        // Subtitle
        ctx.font = '800 10px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('DETERMINISTIC DATA SONIFICATION FRAMEWORK', lx + logoSize + 23, ly + 65);

        // Website URL (Teal)
        ctx.font = '900 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText('WWW.SONIFICART.COM', lx + logoSize + 23, ly + 90);
        ctx.restore();
    }
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
