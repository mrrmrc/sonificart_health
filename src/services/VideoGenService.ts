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
    // PREMIUM VIDEO LAYOUT - Gradient Background, Sinusoidal Waves, Visible Typography
    // ═══════════════════════════════════════════════════════════════════════════════════

    // --- TOP LEFT BRANDING: Logo + "SonificA.R.T." ---
    if (logo) {
        ctx.save();

        // Semi-transparent dark bar behind branding for visibility
        const brandBg = ctx.createLinearGradient(0, 0, 300, 0);
        brandBg.addColorStop(0, 'rgba(0,0,0,0.7)');
        brandBg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = brandBg;
        ctx.fillRect(0, 0, 350, 80);

        const logoSize = 45;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(logo, 25, 18, logoSize, logoSize);

        // Text "SonificA.R.T."
        ctx.font = 'bold 26px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText('Sonific', 80, 45);

        // Colored "A.R.T."
        const sonificWidth = ctx.measureText('Sonific').width;
        ctx.fillStyle = '#2dd4bf';
        ctx.fillText('A.R.T.', 80 + sonificWidth, 45);

        // Subtitle
        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = 2;
        ctx.fillText('DETERMINISTIC DATA SONIFICATION FRAMEWORK', 80, 60);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // --- FOOTER BACKGROUND (Premium Gradient, not flat black) ---
    const footerY = VideoH;
    const footerGrad = ctx.createLinearGradient(0, footerY, 0, footerY + FooterH);
    footerGrad.addColorStop(0, '#0a1520');    // Deep dark blue
    footerGrad.addColorStop(0.3, '#0d1f2d');  // Slightly lighter
    footerGrad.addColorStop(1, '#0a0f14');    // Very dark
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, footerY, W, FooterH);

    // Animated gradient line separator at top of footer
    const sepGrad = ctx.createLinearGradient(0, footerY, W, footerY);
    sepGrad.addColorStop(0, 'rgba(45, 212, 191, 0.3)');
    sepGrad.addColorStop(0.3, '#2dd4bf');
    sepGrad.addColorStop(0.5, '#a855f7');
    sepGrad.addColorStop(0.7, '#2dd4bf');
    sepGrad.addColorStop(1, 'rgba(45, 212, 191, 0.3)');
    ctx.fillStyle = sepGrad;
    ctx.fillRect(0, footerY, W, 4);

    // Subtle glow effect below separator
    const glowGrad = ctx.createLinearGradient(0, footerY, 0, footerY + 30);
    glowGrad.addColorStop(0, 'rgba(45, 212, 191, 0.15)');
    glowGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, footerY + 4, W, 26);

    // --- FOOTER CONTENT ---
    const margin = 50;
    const contentStartY = footerY + 35;

    // Title (Large, Bold, White with shadow)
    ctx.save();
    ctx.font = 'bold 34px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    const titleText = (title || "OPERA SENZA TITOLO").toUpperCase();
    ctx.fillText(titleText, margin, contentStartY + 25);
    ctx.restore();

    // Author (Medium, Cyan color for visibility)
    ctx.font = '18px Arial';
    ctx.fillStyle = '#2dd4bf';
    const authorText = (author || "SonificA.R.T.").toUpperCase();
    ctx.fillText(authorText, margin, contentStartY + 55);

    // --- SINUSOIDAL WAVE VISUALIZATION ---
    const waveY = contentStartY + 95;
    const waveWidth = W * 0.40;
    const waveHeight = 40;
    const waveCenterY = waveY + waveHeight / 2;

    ctx.save();

    // Wave shadow/glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(45, 212, 191, 0.5)';

    // Draw smooth sinusoidal wave
    ctx.beginPath();
    ctx.moveTo(margin, waveCenterY);

    const points = 100;
    for (let i = 0; i <= points; i++) {
        const x = margin + (i / points) * waveWidth;

        // Sample multiple frequency bins for a smoother wave
        const freqIndex = Math.floor((i / points) * freqData.length * 0.4);
        const amp1 = (freqData[freqIndex] || 0) / 255;
        const amp2 = (freqData[Math.min(freqIndex + 5, freqData.length - 1)] || 0) / 255;
        const amplitude = (amp1 + amp2) / 2;

        // Create wave oscillation based on position and audio
        const baseWave = Math.sin((i / points) * Math.PI * 6 + time * 3) * (waveHeight * 0.3);
        const audioWave = amplitude * waveHeight * 0.6;

        const y = waveCenterY + baseWave * (0.3 + amplitude * 0.7) + (Math.random() - 0.5) * audioWave * 0.2;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    // Gradient stroke for wave
    const waveGrad = ctx.createLinearGradient(margin, 0, margin + waveWidth, 0);
    waveGrad.addColorStop(0, '#2dd4bf');
    waveGrad.addColorStop(0.5, '#60d5f5');
    waveGrad.addColorStop(1, '#a855f7');

    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw a second, fainter wave for depth
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const x = margin + (i / points) * waveWidth;
        const freqIndex = Math.floor((i / points) * freqData.length * 0.3);
        const amplitude = (freqData[freqIndex] || 0) / 255;
        const y = waveCenterY + Math.sin((i / points) * Math.PI * 4 + time * 2) * waveHeight * 0.2 * (0.5 + amplitude);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Date & Description (Below wave)
    ctx.font = '14px Arial';
    ctx.fillStyle = '#8899aa';
    const dateText = date || new Date().toLocaleDateString('it-IT');
    ctx.fillText(dateText, margin, contentStartY + 155);

    if (description && description.trim().length > 0) {
        ctx.font = 'italic 14px Arial';
        ctx.fillStyle = '#aabbcc';
        const maxWidth = W * 0.35;
        let truncated = description;
        if (ctx.measureText(truncated).width > maxWidth) {
            while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
            }
            truncated += "...";
        }
        ctx.fillText(truncated, margin + 100, contentStartY + 155);
    }

    // --- RIGHT SIDE: Large Logo with Glow ---
    if (logo) {
        const logoSize = 90;
        const logoX = W - margin - logoSize - 30;
        const logoY = footerY + (FooterH - logoSize) / 2;

        ctx.save();

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 15, 0, Math.PI * 2);
        const ringGrad = ctx.createRadialGradient(
            logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2,
            logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 20
        );
        ringGrad.addColorStop(0, 'rgba(45, 212, 191, 0.2)');
        ringGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = ringGrad;
        ctx.fill();

        // Inner ring
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Logo
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
        ctx.restore();
    }

    // Website watermark (far right bottom)
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = 'rgba(45, 212, 191, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('sonificart.com', W - margin, footerY + FooterH - 18);
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
