import { SonificationResult, Tradition } from '../types';
import { LOGO_SVG_STRING } from '../components/Logo';
import WebcamService from './WebcamService';
import { injectWebMMetadata } from '../utils/videoMetadata';

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
    options?: {
        title?: string,
        author?: string,
        description?: string,
        overrideAudioBlob?: Blob,
        useWebcam?: boolean,
        cursorType?: 'vertical' | 'horizontal' | 'original' | 'crosshair',
        events?: any[]
    }
): Promise<Blob> {
    const metadata = options;
    const isSyncMode = !!options?.overrideAudioBlob;
    const useWebcam = !!options?.useWebcam;

    console.log("Generating video with metadata:", metadata);

    return new Promise(async (resolve, reject) => {
        let audioCtx: AudioContext | null = null;
        let recorder: MediaRecorder | null = null;
        let source: AudioBufferSourceNode | null = null;
        let animationFrameId: number | null = null;
        let pannerNode: StereoPannerNode | null = null;
        let filterNode: BiquadFilterNode | null = null;
        let masterGain: GainNode | null = null;

        // Temporary video element for webcam (hidden)
        let webcamVideo: HTMLVideoElement | null = null;

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

            // 3. Setup Audio Content
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtx = new AudioContextClass();

            // Decode audio
            const audioToDecode = options?.overrideAudioBlob || result.audioOutput.audioWavBlob;
            const audioData = await audioToDecode.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(audioData);

            source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;

            // --- AUDIO GRAPH SETUP (SINESTHETIC ENGINE) ---
            // Source -> Panner (Head Yaw) -> Filter (Expression) -> Gain (Head Z) -> Analyser -> Dest

            pannerNode = audioCtx.createStereoPanner();
            filterNode = audioCtx.createBiquadFilter();
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 20000; // Open by default

            masterGain = audioCtx.createGain();
            masterGain.gain.value = 1.0;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Connect chain
            source.connect(pannerNode);
            pannerNode.connect(filterNode);
            filterNode.connect(masterGain);
            masterGain.connect(analyser);

            const dest = audioCtx.createMediaStreamDestination();
            analyser.connect(dest); // To Stream

            // To Speakers (muted loopback)
            const monitorGain = audioCtx.createGain();
            monitorGain.gain.value = 0.0; // Mute for recording process (unless we want user to hear?)
            // If performance mode is ON, user MUST hear it to interact!
            if (useWebcam) {
                monitorGain.gain.value = 1.0;
            }
            analyser.connect(monitorGain);
            monitorGain.connect(audioCtx.destination);


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

            // Pre-render blurred background
            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = 512;
            bgCanvas.height = 512;
            const bgCtx = bgCanvas.getContext('2d');
            if (bgCtx) {
                bgCtx.filter = 'blur(40px) brightness(0.6) saturate(1.2)';
                bgCtx.drawImage(img, 0, 0, 512, 512);
            }

            // Prepare Logo - ALWAYS draw programmatically for guaranteed compatibility
            const logoCanvas = document.createElement('canvas');
            logoCanvas.width = 128;
            logoCanvas.height = 128;
            const logoCtx = logoCanvas.getContext('2d');

            if (logoCtx) {
                const cx = 64, cy = 64;

                // Clear and fill background
                logoCtx.clearRect(0, 0, 128, 128);

                // Dark background circle
                logoCtx.fillStyle = '#0d1a24';
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 62, 0, Math.PI * 2);
                logoCtx.fill();

                // Outer ring gradient
                const ringGrad = logoCtx.createLinearGradient(0, 0, 128, 128);
                ringGrad.addColorStop(0, '#2dd4bf');
                ringGrad.addColorStop(1, '#a855f7');
                logoCtx.strokeStyle = ringGrad;
                logoCtx.lineWidth = 5;
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 56, 0, Math.PI * 2);
                logoCtx.stroke();

                // Inner glow ring
                logoCtx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
                logoCtx.lineWidth = 2;
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 52, 0, Math.PI * 2);
                logoCtx.stroke();

                // Eye shape - outer mandorla
                logoCtx.strokeStyle = ringGrad;
                logoCtx.lineWidth = 3;
                logoCtx.beginPath();
                logoCtx.moveTo(10, cy);
                logoCtx.quadraticCurveTo(cx, 12, 118, cy);
                logoCtx.quadraticCurveTo(cx, 116, 10, cy);
                logoCtx.closePath();
                logoCtx.stroke();
                logoCtx.fillStyle = 'rgba(45, 212, 191, 0.1)';
                logoCtx.fill();

                // Eye shape - inner mandorla
                logoCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                logoCtx.lineWidth = 2;
                logoCtx.beginPath();
                logoCtx.moveTo(25, cy);
                logoCtx.quadraticCurveTo(cx, 28, 103, cy);
                logoCtx.quadraticCurveTo(cx, 100, 25, cy);
                logoCtx.closePath();
                logoCtx.stroke();

                // Iris ring
                const irisGrad = logoCtx.createLinearGradient(44, 44, 84, 84);
                irisGrad.addColorStop(0, '#a855f7');
                irisGrad.addColorStop(1, '#2dd4bf');
                logoCtx.strokeStyle = irisGrad;
                logoCtx.lineWidth = 3;
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 20, 0, Math.PI * 2);
                logoCtx.stroke();

                // Pupil - outer white
                logoCtx.fillStyle = '#ffffff';
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 13, 0, Math.PI * 2);
                logoCtx.fill();

                // Pupil - cyan middle
                logoCtx.fillStyle = 'rgba(45, 212, 191, 0.6)';
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 9, 0, Math.PI * 2);
                logoCtx.fill();

                // Pupil - inner white core
                logoCtx.fillStyle = '#ffffff';
                logoCtx.beginPath();
                logoCtx.arc(cx, cy, 5, 0, Math.PI * 2);
                logoCtx.fill();

                // Highlight reflection
                logoCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                logoCtx.beginPath();
                logoCtx.arc(cx + 4, cy - 4, 2, 0, Math.PI * 2);
                logoCtx.fill();

                // Cardinal markers - top and left (cyan)
                logoCtx.fillStyle = '#2dd4bf';
                logoCtx.beginPath();
                logoCtx.roundRect(56, 0, 16, 14, 5);
                logoCtx.fill();
                logoCtx.beginPath();
                logoCtx.roundRect(0, 56, 14, 16, 5);
                logoCtx.fill();

                // Cardinal markers - bottom and right (purple)
                logoCtx.fillStyle = '#a855f7';
                logoCtx.beginPath();
                logoCtx.roundRect(56, 114, 16, 14, 5);
                logoCtx.fill();
                logoCtx.beginPath();
                logoCtx.roundRect(114, 56, 14, 16, 5);
                logoCtx.fill();
            }

            // Create final logo image from canvas
            const logoImg = new Image();
            logoImg.src = logoCanvas.toDataURL('image/png');
            await new Promise<void>((resolve) => {
                logoImg.onload = () => resolve();
                setTimeout(resolve, 500); // Fallback timeout
            });
            console.log("Logo Ready:", logoImg.width, "x", logoImg.height);

            // --- WEBCAM INITIALIZATION ---
            if (useWebcam) {
                try {
                    webcamVideo = document.createElement('video');
                    webcamVideo.autoplay = true;
                    webcamVideo.playsInline = true;
                    webcamVideo.style.display = 'none';
                    document.body.appendChild(webcamVideo); // Needs to be in DOM for MediaPipe? Usually yes.

                    await WebcamService.initialize(webcamVideo);
                    console.log("Webcam Service Initialized");
                } catch (wcError) {
                    console.warn("Webcam failed to init, falling back to auto.", wcError);
                }
            }


            // 5. Setup Recorder
            const canvasStream = canvas.captureStream(30);
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);

            recorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType || undefined,
                videoBitsPerSecond: 6000000
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = async () => {
                let blob = new Blob(chunks, { type: mimeType || 'video/webm' });

                // Inject metadata into WebM file
                if (metadata?.title || metadata?.author || metadata?.description) {
                    try {
                        blob = await injectWebMMetadata(blob, {
                            title: metadata.title,
                            author: metadata.author,
                            description: metadata.description
                        });
                        console.log("Metadata injected into video");
                    } catch (metaError) {
                        console.warn("Failed to inject metadata:", metaError);
                    }
                }

                if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
                if (webcamVideo) {
                    WebcamService.stop();
                    webcamVideo.remove();
                }
                resolve(blob);
            };

            // 6. Animation State
            const duration = audioBuffer.duration;
            if (audioCtx.state === 'suspended') await audioCtx.resume();

            source.start(0);
            recorder.start();
            const startTime = audioCtx.currentTime;

            // Layout
            const footerHeight = 250; // Increased height
            const margin = 20;

            const naturalW = img.naturalWidth || 512;
            const naturalH = img.naturalHeight || 512;
            const scaleX = (width - margin * 2) / naturalW;
            const scaleY = (height - footerHeight - margin) / naturalH;
            const baseScale = Math.min(scaleX, scaleY);
            const imgW = naturalW * baseScale;
            const imgH = naturalH * baseScale;

            // Cursor
            let cursorX = width / 2;
            let cursorY = height / 2;
            let targetX = cursorX;
            let targetY = cursorY;

            const blocks = result.blockAnalysisResult.blocks;
            const gridSize = result.blockAnalysisResult.gridSize;

            const videoEvents = result.audioOutput.events.filter(e => !e.isAccompaniment);
            const maxEventTime = videoEvents.length > 0 ? Math.max(...videoEvents.map(e => e.time + e.duration)) : 30;
            const originalDuration = result.audioOutput.duration || maxEventTime;

            // DRAW LOOP
            const draw = () => {
                try {
                    // Safety check
                    if (!recorder || recorder.state === 'inactive') {
                        if (animationFrameId) cancelAnimationFrame(animationFrameId);
                        return;
                    }

                    if (!audioCtx) return;
                    const now = audioCtx.currentTime;
                    const elapsed = now - startTime;
                    const progress = Math.min(1, Math.max(0, elapsed / duration));
                    onProgress(progress * 100);

                    if (elapsed >= duration + 0.1) {
                        if (recorder && recorder.state === 'recording') recorder.stop();
                        if (animationFrameId) cancelAnimationFrame(animationFrameId);
                        return;
                    }

                    // --- READ WEBCAM METRICS ---
                    let metrics = { yaw: 0, pitch: 0, roll: 0, x: 0.5, y: 0.5, z: 0.5, mouthOpen: 0, smile: 0, gazeX: 0, gazeY: 0, isActive: false };
                    if (useWebcam) {
                        metrics = WebcamService.getMetrics();
                    }

                    // --- UPDATE AUDIO GRAPH (PERFORMANCE) ---
                    if (useWebcam && metrics.isActive && pannerNode && filterNode && masterGain) {
                        // 1. Pan follows Head Yaw (Left/Right look)
                        // Smooth transition
                        const targetPan = -metrics.yaw; // Invert?
                        pannerNode.pan.value += (targetPan - pannerNode.pan.value) * 0.1;

                        // 2. Filter (Brightness) follows Smile + Pitch
                        // Smile opens filter (brighter). Pitch up opens, Pitch down closes.
                        const smileBooster = metrics.smile * 5000;
                        const pitchMod = metrics.pitch * 3000;
                        const targetFreq = 1000 + smileBooster + pitchMod + 500; // Base 1500
                        // Clamped
                        const clampedFreq = Math.max(200, Math.min(22000, targetFreq));
                        filterNode.frequency.value += (clampedFreq - filterNode.frequency.value) * 0.1;

                        // 3. Zoom (Volume/Reverb feel) - approximated by Gain for now
                        // Let's assume z=0 is close, z=1 is far.
                        const targetGain = 0.5 + (1.0 - metrics.z);
                        masterGain.gain.value += (targetGain - masterGain.gain.value) * 0.1;
                    }

                    // --- ANALYSIS ---
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0, bassSum = 0;
                    const usefulBins = Math.floor(bufferLength * 0.7);
                    for (let i = 0; i < usefulBins; i += 2) {
                        const val = dataArray[i];
                        sum += val;
                        if (i < 20) bassSum += val;
                    }
                    const avgVol = (sum * 2) / usefulBins / 255;
                    const normalizedBass = (bassSum * 2 / 10) / 255;

                    // --- RENDERING ---

                    // Camera / Parallax
                    let camX = 0, camY = 0, zoomDrift = 1.0;

                    if (useWebcam && metrics.isActive) {
                        // Head tracking parallax
                        camX = (metrics.x - 0.5) * -100; // Invert motion for window effect
                        camY = (metrics.y - 0.5) * -80;
                        zoomDrift = 1.0 + ((1.0 - metrics.z) * 0.3); // up to 1.3x zoom
                    } else {
                        // Auto mode
                        camX = Math.sin(now * 0.3) * 25;
                        camY = Math.cos(now * 0.25) * 15;
                        zoomDrift = 1.0 + (Math.sin(now * 0.15) * 0.02);
                    }

                    ctx.save();
                    ctx.fillStyle = '#050505';
                    ctx.fillRect(0, 0, width, height);

                    if (ctx) {
                        // FORCE CACHE INVALIDATION LOG - V3.1
                        console.log("[VideoService] Rendering Frame - Layout V3 Active");
                    }

                    // Background
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    const bgScale = Math.max(width / 512, height / 512) * 1.5;
                    ctx.scale(bgScale, bgScale);
                    ctx.translate(camX * 0.2, camY * 0.2); // Less parallax
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(bgCanvas, -256, -256, 512, 512);
                    ctx.restore();

                    // Main Artwork
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    ctx.scale(zoomDrift, zoomDrift);
                    ctx.translate(camX, camY);

                    // Expression effect: Surprise triggers shake/chromatic aberration?
                    // Simple shake
                    if (metrics.mouthOpen > 0.3) {
                        const shake = (Math.random() - 0.5) * 10;
                        ctx.translate(shake, shake);
                    }

                    ctx.globalAlpha = 1.0;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 40;
                    ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
                    ctx.restore();

                    // --- CURSOR LOGIC ---
                    const centerX = width / 2 + camX * zoomDrift;
                    const centerY = height / 2 + camY * zoomDrift;
                    const effW = imgW * zoomDrift;
                    const effH = imgH * zoomDrift;

                    if (useWebcam && metrics.isActive) {
                        // Gaze tracking cursor
                        const gazeTargetX = centerX + (metrics.gazeX * (effW * 0.8)); // limit range
                        const gazeTargetY = centerY + (metrics.gazeY * (effH * 0.8));

                        targetX = gazeTargetX;
                        targetY = gazeTargetY;

                        cursorX += (targetX - cursorX) * 0.08;
                        cursorY += (targetY - cursorY) * 0.08;
                    } else {
                        // AUTO SYNC MODE (Fallback or non-webcam)
                        if (isSyncMode) {
                            const normalizedTime = (elapsed / duration) * originalDuration;
                            let active = videoEvents.find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);

                            if (!active && videoEvents.length > 0) {
                                for (let k = videoEvents.length - 1; k >= 0; k--) {
                                    if (videoEvents[k].time <= normalizedTime) {
                                        active = videoEvents[k];
                                        break;
                                    }
                                }
                            }

                            if (active && active.sourceBlock) {
                                const nX = (active.sourceBlock.position.x / gridSize) - 0.5;
                                const nY = (active.sourceBlock.position.y / gridSize) - 0.5;
                                targetX = centerX + (nX * effW);
                                targetY = centerY + (nY * effH);
                            }
                        }
                    }

                    // --- CURSOR & SCAN LOGIC ---
                    const type = options?.cursorType || 'original';

                    if (type === 'original') {
                        // Deterministic path from sonification
                        const normalizedTime = isSyncMode ? ((elapsed / duration) * originalDuration) : elapsed;
                        let active = (options?.events || videoEvents).find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);
                        if (!active) {
                            active = (options?.events || videoEvents).filter(e => e.time <= normalizedTime).pop();
                        }

                        if (active && active.sourceBlock) {
                            const nX = (active.sourceBlock.position.x / gridSize) - 0.5;
                            const nY = (active.sourceBlock.position.y / gridSize) - 0.5;
                            targetX = centerX + (nX * effW);
                            targetY = centerY + (nY * effH);
                        }

                        // Smooth follow
                        cursorX += (targetX - cursorX) * 0.15;
                        cursorY += (targetY - cursorY) * 0.15;

                        // Draw Square
                        ctx.save();
                        ctx.translate(cursorX, cursorY);
                        const blockW = effW / gridSize;
                        const blockH = effH / gridSize;
                        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                        ctx.shadowBlur = 10 + avgVol * 20;
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(-blockW / 2, -blockH / 2, blockW, blockH);
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + avgVol * 0.4})`;
                        ctx.fillRect(-blockW / 2, -blockH / 2, blockW, blockH);
                        ctx.restore();
                    }
                    else if (type === 'vertical') {
                        const scanX = (centerX - effW / 2) + (progress * effW);
                        const grad = ctx.createLinearGradient(0, centerY - effH / 2, 0, centerY + effH / 2);
                        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
                        grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.7)');
                        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(scanX - 1, centerY - effH / 2, 3, effH);
                    }
                    else if (type === 'horizontal') {
                        const scanY = (centerY - effH / 2) + (progress * effH);
                        const grad = ctx.createLinearGradient(centerX - effW / 2, 0, centerX + effW / 2, 0);
                        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
                        grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.7)');
                        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(centerX - effW / 2, scanY - 1, effW, 3);
                    }
                    else if (type === 'crosshair') {
                        const normalizedTime = isSyncMode ? ((elapsed / duration) * originalDuration) : elapsed;
                        const active = (options?.events || videoEvents).find(e => e.time >= normalizedTime) || videoEvents[videoEvents.length - 1];
                        if (active && active.sourceBlock) {
                            const tX = (centerX - effW / 2) + (active.sourceBlock.position.x / gridSize) * effW + (effW / gridSize / 2);
                            const tY = (centerY - effH / 2) + (active.sourceBlock.position.y / gridSize) * effH + (effH / gridSize / 2);
                            cursorX += (tX - cursorX) * 0.2;
                            cursorY += (tY - cursorY) * 0.2;
                        }

                        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(centerX - effW / 2, cursorY); ctx.lineTo(centerX + effW / 2, cursorY);
                        ctx.moveTo(cursorX, centerY - effH / 2); ctx.lineTo(cursorX, centerY + effH / 2);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(cursorX, cursorY, 20, 0, Math.PI * 2);
                        ctx.stroke();
                    }

                    // ═══════════════════════════════════════════════════════════════════════════════════════
                    // SONIFICART PREMIUM VIDEO LAYOUT V2 - Redesigned 3-Column Footer
                    // Left: Title, Description, Author/Date | Center: Compact Audio Bars | Right: Logo
                    // ═══════════════════════════════════════════════════════════════════════════════════════

                    const footerY = height - 200;
                    const footerH = 200;
                    const footerGrad = ctx.createLinearGradient(0, footerY, 0, height);
                    footerGrad.addColorStop(0, 'rgba(10, 21, 32, 0)');
                    footerGrad.addColorStop(0.1, 'rgba(13, 24, 32, 0.95)');
                    footerGrad.addColorStop(0.5, '#0a1218');
                    footerGrad.addColorStop(1, '#060a0e');
                    ctx.fillStyle = footerGrad;
                    ctx.fillRect(0, footerY, width, footerH);

                    // --- PROGRESS BAR (Elegant, integrated at top of footer) ---
                    const progressBarHeight = 5;
                    const progressWidth = Math.floor(progress * width);

                    // Background track
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(0, footerY, width, progressBarHeight);

                    // Progress fill with gradient
                    const progGrad = ctx.createLinearGradient(0, footerY, width, footerY);
                    progGrad.addColorStop(0, '#2dd4bf');
                    progGrad.addColorStop(0.5, '#60d5f5');
                    progGrad.addColorStop(1, '#a855f7');
                    ctx.fillStyle = progGrad;
                    ctx.fillRect(0, footerY, progressWidth, progressBarHeight);

                    // Glow at progress head
                    if (progressWidth > 0) {
                        const glowGrad = ctx.createRadialGradient(progressWidth, footerY + 2, 0, progressWidth, footerY + 2, 25);
                        glowGrad.addColorStop(0, 'rgba(45, 212, 191, 0.9)');
                        glowGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
                        ctx.fillStyle = glowGrad;
                        ctx.fillRect(progressWidth - 25, footerY, 50, 12);
                    }

                    // --- 2-COLUMN LAYOUT (Enhanced) ---
                    // Left 55% (Info) | Right 45% (Extended Spectrum + Watermark Logo)
                    const colLeftWidth = width * 0.55;
                    const colRightWidth = width * 0.45;
                    const colLeftX = 40;
                    const colRightX = colLeftWidth;
                    const contentY = footerY + progressBarHeight + 20;

                    // === LEFT COLUMN: Title, Description, Author/Date ===
                    ctx.save();

                    // TITLE
                    ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'left';
                    ctx.shadowColor = 'rgba(0,0,0,0.6)';
                    ctx.shadowBlur = 5;
                    const titleStr = (metadata?.title || "Opera Senza Titolo");
                    const maxTitleWidth = colLeftWidth - 80;
                    let displayTitle = titleStr;
                    if (ctx.measureText(displayTitle).width > maxTitleWidth) {
                        while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 0) {
                            displayTitle = displayTitle.slice(0, -1);
                        }
                        displayTitle += '...';
                    }
                    ctx.fillText(displayTitle, colLeftX, contentY + 35);
                    ctx.restore();

                    // DESCRIPTION
                    const descriptionText = metadata?.description || '';
                    if (descriptionText) {
                        ctx.save();
                        ctx.font = '18px "Segoe UI", Arial, sans-serif';
                        ctx.fillStyle = 'rgba(255,255,255,0.7)';
                        ctx.textAlign = 'left';

                        const maxDescWidth = colLeftWidth - 80;
                        let displayDesc = descriptionText;
                        if (ctx.measureText(displayDesc).width > maxDescWidth * 2) {
                            while (ctx.measureText(displayDesc + '...').width > maxDescWidth * 2 && displayDesc.length > 0) {
                                displayDesc = displayDesc.slice(0, -1);
                            }
                            displayDesc += '...';
                        }

                        // Word wrap
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

                        ctx.fillText(line1.trim(), colLeftX, contentY + 68);
                        if (line2.trim()) {
                            ctx.fillText(line2.trim(), colLeftX, contentY + 92);
                        }
                        ctx.restore();
                    }

                    // AUTHOR & DATE (Enlarged and Highlighted)
                    ctx.save();
                    const authorDateY = contentY + 140;

                    // Author with background highlight
                    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
                    const authorStr = metadata?.author || "SonificART";
                    const authorText = authorStr.toUpperCase();
                    const authorMetrics = ctx.measureText(authorText);

                    // Background pill for author
                    ctx.fillStyle = 'rgba(45, 212, 191, 0.15)';
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(colLeftX - 8, authorDateY - 22, authorMetrics.width + 16, 32, 6) : ctx.fillRect(colLeftX - 8, authorDateY - 22, authorMetrics.width + 16, 32);
                    ctx.fill();

                    // Author text
                    ctx.fillStyle = '#2dd4bf';
                    ctx.shadowColor = 'rgba(45, 212, 191, 0.6)';
                    ctx.shadowBlur = 10;
                    ctx.fillText(authorText, colLeftX, authorDateY);

                    // Separator
                    const authorWidth = authorMetrics.width;
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
                    ctx.fillText('  •  ', colLeftX + authorWidth + 16, authorDateY);

                    // Date
                    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    ctx.fillText(dateStr, colLeftX + authorWidth + 60, authorDateY);
                    ctx.restore();

                    // === RIGHT COLUMN: EXTENDED AUDIO SPECTRUM ===
                    const barAreaX = colRightX + 20;
                    const barAreaWidth = colRightWidth - 60; // Use almost full width of right col
                    const barAreaY = contentY + 40; // Slightly lower
                    const barAreaHeight = 90;
                    const numBars = 48; // Increased density
                    const barWidth = (barAreaWidth / numBars) * 0.65;
                    const barGap = (barAreaWidth / numBars) * 0.35;

                    ctx.save();
                    for (let i = 0; i < numBars; i++) {
                        // Logarithmic distribution for better visual
                        const freqIndex = Math.floor((i / numBars) * bufferLength * 0.7);
                        const amp = (dataArray[freqIndex] || 0) / 255;
                        const barHeight = Math.max(4, amp * barAreaHeight);
                        const x = barAreaX + i * (barWidth + barGap);
                        const y = barAreaY + barAreaHeight - barHeight;

                        // Gradient
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

                        // Render Bar
                        const radius = Math.min(barWidth / 2, 4);
                        ctx.beginPath();
                        ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, radius) : ctx.fillRect(x, y, barWidth, barHeight);
                        ctx.fill();

                        // Glow
                        if (amp > 0.4) {
                            ctx.shadowColor = colorPos < 0.5 ? '#2dd4bf' : '#a855f7';
                            ctx.shadowBlur = amp * 12;
                        } else {
                            ctx.shadowBlur = 0;
                        }
                    }
                    ctx.shadowBlur = 0;
                    ctx.restore();

                    // === LOGO WATERMARK (Bottom Right, Large) ===
                    ctx.save();
                    const logoWSize = 100;
                    const logoWX = width - logoWSize - 40;
                    const logoWY = height - logoWSize - 30;

                    // Logo glow
                    ctx.shadowColor = 'rgba(45, 212, 191, 0.4)';
                    ctx.shadowBlur = 20;
                    ctx.globalAlpha = 1.0;
                    ctx.drawImage(logoImg, logoWX, logoWY, logoWSize, logoWSize);
                    ctx.shadowBlur = 0;

                    // Text below logo
                    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'right';
                    ctx.fillText('Sonific', logoWX + logoWSize, logoWY + logoWSize + 25);

                    const sonificW = ctx.measureText('Sonific').width;
                    ctx.fillStyle = '#2dd4bf';
                    ctx.fillText('A.R.T.', logoWX + logoWSize, logoWY + logoWSize + 25);

                    ctx.font = '12px "Segoe UI", Arial, sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.fillText('sonificart.com', logoWX + logoWSize, logoWY + logoWSize + 42);

                    ctx.restore();

                    // --- Decorative corner accents ---
                    ctx.save();
                    ctx.strokeStyle = 'rgba(45, 212, 191, 0.3)';
                    ctx.lineWidth = 2;

                    // Bottom-left corner
                    ctx.beginPath();
                    ctx.moveTo(15, height - 40);
                    ctx.lineTo(15, height - 15);
                    ctx.lineTo(40, height - 15);
                    ctx.stroke();

                    // Bottom-right corner
                    ctx.beginPath();
                    ctx.moveTo(width - 15, height - 40);
                    ctx.lineTo(width - 15, height - 15);
                    ctx.lineTo(width - 40, height - 15);
                    ctx.stroke();
                    ctx.restore();

                    ctx.restore();
                    animationFrameId = requestAnimationFrame(draw);

                } catch (e) {
                    console.error(e);
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    reject(e);
                }
            };

            draw();

        } catch (error) {
            console.error("Video Gen Failed", error);
            if (webcamVideo) webcamVideo.remove();
            reject(error);
        }
    });

}
