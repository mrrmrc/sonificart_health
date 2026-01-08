
import { SonificationResult } from '../types';

interface VideoGenOptions {
    imageUrl: string;
    audioBlob: Blob;
    duration?: number; // in seconds (optional, defaults to audio length)
    title?: string;
    author?: string;
    onProgress?: (progress: number) => void;
}

export const VideoGenService = {
    generateVideo: async ({ imageUrl, audioBlob, duration, title, author, onProgress }: VideoGenOptions): Promise<Blob> => {

        // 1. Layout Config
        const VIDEO_W = 1280;
        const VIDEO_H = 720;
        const FOOTER_H = 180;
        const TOTAL_H = VIDEO_H + FOOTER_H;

        // 2. Setup Canvas
        const canvas = document.createElement('canvas');
        canvas.width = VIDEO_W;
        canvas.height = TOTAL_H;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error("Could not create canvas context");

        // 3. Load Resources
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.onload = () => resolve(i);
            i.onerror = (e) => reject(new Error("Failed to load image"));
            i.src = imageUrl;
        });

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const finalDuration = (duration && duration > 0 && duration < Infinity)
            ? duration
            : audioBuffer.duration;

        console.log(`[VideoGen] Starting. Detected Duration: ${finalDuration}s`);

        // Destinations
        const dest = audioCtx.createMediaStreamDestination();
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyser.connect(dest);

        // 3. MediaRecorder
        const canvasStream = canvas.captureStream(30); // 30 FPS
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
            ? 'video/webm; codecs=vp9'
            : 'video/webm';

        const recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 3000000 // 3 Mbps
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
            let isStopped = false;
            let animationFrameId: number;

            // Cleanup function
            const cleanup = () => {
                if (isStopped) return;
                isStopped = true;

                if (recorder.state !== 'inactive') recorder.stop();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);

                try {
                    source.stop();
                    source.disconnect();
                    analyser.disconnect();
                    audioCtx.close();
                } catch (e) { /* ignore */ }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/mp4' });
                resolve(blob);
            };

            recorder.onerror = (e) => {
                cleanup();
                reject(new Error("Recorder Error: " + e));
            };

            // STRICT STOP TRIGGER
            source.onended = () => {
                console.log("[VideoGen] Audio source ended. Stopping.");
                cleanup();
            };

            // Fallback timeout
            setTimeout(() => {
                if (!isStopped) cleanup();
            }, (finalDuration + 3) * 1000); // 3s extra tolerance

            // START
            recorder.start();
            source.start();
            const startTime = audioCtx.currentTime;

            // 4. Render Loop
            const draw = () => {
                if (isStopped) return;

                const now = audioCtx.currentTime - startTime;

                // Progress
                const progress = finalDuration > 0 ? Math.min((now / finalDuration), 1.0) : 0;
                if (onProgress) onProgress(progress * 100);

                try {
                    // --- LAYOUT RENDERING ---

                    // A. Top Area: Image (VIDEO_W x VIDEO_H)
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, VIDEO_W, TOTAL_H);

                    // Draw Image Cleanly (Cover)
                    const imgAspect = img.naturalWidth / img.naturalHeight;
                    const canvasAspect = VIDEO_W / VIDEO_H;
                    let dw, dh, dx, dy;

                    if (canvasAspect > imgAspect) {
                        dw = VIDEO_W; dh = VIDEO_W / imgAspect;
                        dx = 0; dy = (VIDEO_H - dh) / 2;
                    } else {
                        dh = VIDEO_H; dw = VIDEO_H * imgAspect;
                        dy = 0; dx = (VIDEO_W - dw) / 2;
                    }

                    // Save Clip for Image Area
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, VIDEO_W, VIDEO_H);
                    ctx.clip();

                    ctx.drawImage(img, dx, dy, dw, dh);

                    // --- B. Image Cursor (Grid Scanning) ---
                    // No dimming, just a highlight/cursor

                    const cols = 16;
                    const rows = 9;
                    const totalBlocks = cols * rows;

                    const currentBlockTotalIndex = Math.floor(progress * totalBlocks);
                    const currentBlockIndex = Math.min(currentBlockTotalIndex, totalBlocks - 1);

                    const blockW = VIDEO_W / cols;
                    const blockH = VIDEO_H / rows;

                    const col = currentBlockIndex % cols;
                    const row = Math.floor(currentBlockIndex / cols);

                    const bx = col * blockW;
                    const by = row * blockH;

                    // Audio Reactivity
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    analyser.getByteTimeDomainData(dataArray);

                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const v = (dataArray[i] - 128) / 128.0;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / bufferLength);
                    const volume = Math.min(rms * 5, 1);

                    // Draw Cursor Border
                    ctx.strokeStyle = `rgba(45, 212, 191, ${0.6 + (volume * 0.4)})`; // Cyan
                    ctx.lineWidth = 3 + (volume * 2);
                    ctx.shadowColor = '#2dd4bf'; // Cyan Glow
                    ctx.shadowBlur = 10 + (volume * 10);

                    ctx.strokeRect(bx, by, blockW, blockH);

                    // Subtle glass highlight inside cursor
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (volume * 0.1)})`;
                    ctx.fillRect(bx, by, blockW, blockH);

                    ctx.restore(); // End Image Clip


                    // --- C. Footer Area (VIDEO_W x FOOTER_H) ---
                    const footerY = VIDEO_H;

                    // Background Footer
                    ctx.fillStyle = '#111';
                    ctx.fillRect(0, footerY, VIDEO_W, FOOTER_H);

                    // Separator Line
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(0, footerY);
                    ctx.lineTo(VIDEO_W, footerY);
                    ctx.stroke();

                    // Text Info
                    ctx.shadowBlur = 0;
                    if (title) {
                        ctx.font = 'bold 32px Arial';
                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#fff';
                        ctx.fillText(title.toUpperCase(), 40, footerY + 60);

                        if (author) {
                            ctx.font = '24px Arial';
                            ctx.fillStyle = '#aaa';
                            ctx.fillText(author, 40, footerY + 100);
                        }
                    }

                    // Waveform/Spectrum in Footer (Right side)
                    const waveX = VIDEO_W / 2;
                    const waveW = VIDEO_W / 2 - 40;
                    const waveH = FOOTER_H - 40;
                    const waveY = footerY + 20;
                    const waveCenterY = waveY + (waveH / 2);

                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#2dd4bf'; // Cyan
                    ctx.beginPath();

                    const sliceW = waveW / bufferLength;
                    let wx = waveX;

                    for (let i = 0; i < bufferLength; i += 4) { // Ship every 4 for simpler line
                        const v = dataArray[i] / 128.0;
                        const wy = waveCenterY + ((v - 1) * (waveH / 2));

                        if (i === 0) ctx.moveTo(wx, wy);
                        else ctx.lineTo(wx, wy);

                        wx += sliceW * 4;
                    }
                    ctx.stroke();

                    animationFrameId = window.setTimeout(draw, 1000 / 30); // Target 30 FPS exactly
                } catch (drawErr) {
                    cleanup();
                }
            };

            draw();
        });
    }
};
