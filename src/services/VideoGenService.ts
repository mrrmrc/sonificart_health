import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { LOGO_SVG_STRING } from '../components/Logo';

export interface VideoGenOptions {
    audioUrl: string | Blob;
    imageUrl: string | Blob;
    title?: string;
    subtitle?: string;
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
    subtitle?: string, date?: string
) {
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

    // A. Zoom (Fixed 1.0 for Precision Alignment)
    const zoom = 1;
    const zDw = dw * zoom;
    const zDh = dh * zoom;
    const zDx = dx - (zDw - dw) / 2;
    const zDy = dy - (zDh - dh) / 2;

    ctx.drawImage(img, zDx, zDy, zDw, zDh);

    // 2. Synced Scanning Effect & Pixel Sonification
    // Use Visual Bounds for Scanline
    const progress = Math.min(1, Math.max(0, time / duration));
    const scanStart = visualBounds.minX;
    const scanWidth = visualBounds.width;
    const scanX = Math.floor(scanStart + (progress * scanWidth));

    // A. Draw Scanline
    // Clip to image area to avoid drawing on margins
    ctx.save();
    ctx.beginPath();
    // Clip to visual bounds instead of geometry bounds
    ctx.rect(visualBounds.minX, zDy, visualBounds.width, zDh);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, 0, VideoH);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
    grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)'); // Increased opacity
    grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(scanX - 1, zDy, 3, zDh); // Scanline restricted to Image Height

    // B. Pixel Viz (Sonification Curve) attached to Scanline
    if (pixelData) {
        const sampleStep = 15;
        const vizWidth = 80; // Wider curve

        ctx.lineWidth = 3; // Thicker line

        for (let y = zDy; y < zDy + zDh; y += sampleStep) {
            const sy = Math.floor(y);
            if (sy < 0 || sy >= VideoH) continue;

            const idx = (sy * W + scanX) * 4; // Sample from scanX
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

    // BRANDING WATERMARK (Top-Left)
    if (logo) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.drawImage(logo, 30, 30, 80, 80);
        ctx.restore();
    }

    // 3. Footer
    const footerY = VideoH;

    // Solid Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, footerY, W, FooterH);

    // Separator (Align with Visual Bounds)
    const sepGrad = ctx.createLinearGradient(visualBounds.minX, footerY, visualBounds.maxX, footerY);
    sepGrad.addColorStop(0, '#00ffff');
    sepGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = sepGrad;
    ctx.fillRect(visualBounds.minX, footerY, visualBounds.width, 4);

    // A. Left: Logo & Meta
    const leftMargin = 40;
    const contentY = footerY + 30; // Start content lower

    // Logo (SVG Bitmap)
    if (logo) {
        ctx.drawImage(logo, leftMargin, contentY, 100, 100);
    }

    // Text Group
    const textX = leftMargin + 120;
    const textBaseY = contentY + 10;

    ctx.textAlign = 'left';

    // Title
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText((title || "Opera Senza Nome").toUpperCase(), textX, textBaseY + 30);

    // Subtitle & Date
    ctx.font = '20px Arial';
    ctx.fillStyle = '#dddddd';
    const dateText = date || new Date().toLocaleDateString('it-IT');
    const subText = subtitle ? `${subtitle} • ${dateText}` : dateText;
    ctx.fillText(subText, textX, textBaseY + 65);

    // B. Center/Right: LED Bar Visualizer
    const vizX = W * 0.50;
    const vizW = W * 0.45;
    const vizH = 120; // Taller bars
    const vizBaseY = footerY + (FooterH - 20);

    const bars = 32;
    const gap = 8;
    const barW = (vizW / bars) - gap;

    const step = Math.floor(freqData.length / bars);

    for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += freqData[i * step + j];
        const val = sum / step;

        const boost = val > 10 ? val * 1.5 : val;
        const h = Math.min(vizH, (boost / 255) * vizH);

        const x = vizX + i * (barW + gap);
        const y = vizBaseY - h;

        const lg = ctx.createLinearGradient(0, y, 0, y + h);
        lg.addColorStop(0, '#00ffff');   // Cyan Top
        lg.addColorStop(0.5, '#2dd4bf'); // Teal Mid
        lg.addColorStop(1, '#0000ff');   // Blue Base

        ctx.fillStyle = lg;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.fillRect(x, y, barW, h);
        ctx.shadowBlur = 0;

        if (h > 5) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y - 6, barW, 4);
        }
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
        const { audioUrl, imageUrl, title, author, subtitle, date, onProgress } = options;
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
                title, author, subtitle, date
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
