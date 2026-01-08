import { SonificationResult, Tradition } from '../types';
import { LOGO_SVG_STRING } from '../components/Logo';
import WebcamService from './WebcamService';

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
    options?: { title?: string, author?: string, overrideAudioBlob?: Blob, useWebcam?: boolean }
): Promise<Blob> {
    const metadata = options;
    const isSyncMode = !!options?.overrideAudioBlob;
    const useWebcam = !!options?.useWebcam;

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

            // Prepare Logo
            const svg64 = btoa(unescape(encodeURIComponent(LOGO_SVG_STRING)));
            const logoImg = await loadImage('data:image/svg+xml;base64,' + svg64);

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
                    // continue without webcam but set flag false? For now keep true but metrics will be default
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
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
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
            const footerHeight = 180;
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
            const particles: any[] = [];

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

                    if (elapsed >= duration) {
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
                        // Z is approx distance. Closer (larger face) -> louder?
                        // metrics.z is smaller when closer? usually.
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
                        // metrics.x/y are 0-1. Center 0.5.
                        camX = (metrics.x - 0.5) * -100; // Invert motion for window effect
                        camY = (metrics.y - 0.5) * -80;

                        // Lean in to zoom
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
                        // metrics.gazeX/Y from -1 to 1.
                        const gazeTargetX = centerX + (metrics.gazeX * (effW * 0.8)); // limit range
                        const gazeTargetY = centerY + (metrics.gazeY * (effH * 0.8));

                        targetX = gazeTargetX;
                        targetY = gazeTargetY;

                        // Smoother interpolation for eyes
                        cursorX += (targetX - cursorX) * 0.08;
                        cursorY += (targetY - cursorY) * 0.08;
                    } else {
                        // AUTO SYNC MODE (Fallback or non-webcam)
                        if (isSyncMode) {
                            const normalizedTime = (elapsed / duration) * originalDuration;
                            /* 
                             * SYNC LOGIC FIXED:
                             * Find close events or interpolate
                             */
                            let active = videoEvents.find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);

                            // scan back if gap
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
                            } else if (videoEvents.length > 0) {
                                const last = videoEvents[videoEvents.length - 1];
                                if (normalizedTime >= last.time) {
                                    const b = last.sourceBlock;
                                    targetX = centerX + ((b.position.x / gridSize - 0.5) * effW);
                                    targetY = centerY + ((b.position.y / gridSize - 0.5) * effH);
                                }
                            }
                        } else {
                            const active = videoEvents.find(e => e.time <= elapsed && (e.time + e.duration) > elapsed);
                            if (active && active.sourceBlock) {
                                targetX = centerX + ((active.sourceBlock.position.x / gridSize) - 0.5) * effW;
                                targetY = centerY + ((active.sourceBlock.position.y / gridSize) - 0.5) * effH;
                            }
                        }
                        cursorX += (targetX - cursorX) * 0.15;
                        cursorY += (targetY - cursorY) * 0.15;
                    }

                    // --- PARTICLES ---
                    // Boost particles on "Awe" (Mouth open) or Bass
                    const aweFactor = useWebcam ? metrics.mouthOpen : 0;
                    if ((normalizedBass > 0.05 || aweFactor > 0.2) && particles.length < 50) {
                        const count = 1 + Math.floor(aweFactor * 5); // Burst if awe
                        for (let i = 0; i < count; i++) {
                            particles.push({
                                x: cursorX, y: cursorY,
                                vx: (Math.random() - 0.5) * (2 + normalizedBass * 8 + aweFactor * 10),
                                vy: (Math.random() - 0.5) * (2 + normalizedBass * 8 + aweFactor * 10),
                                life: 1.0,
                                size: 10 + Math.random() * 20,
                                color: (useWebcam && metrics.smile > 0.5) ? '#ffd700' : '#ffffff' // Gold particles if smiling
                            });
                        }
                    }

                    particles.forEach(p => {
                        p.x += p.vx; p.y += p.vy;
                        p.life -= 0.02;
                        if (p.life > 0) {
                            ctx.globalAlpha = p.life * 0.7;
                            ctx.fillStyle = p.color || '#fff';
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
                            ctx.fill();
                        }
                    });
                    while (particles.length > 0 && particles[0].life <= 0) particles.shift();

                    // Draw Cursor
                    ctx.globalAlpha = 1.0;
                    ctx.save();
                    ctx.translate(cursorX, cursorY);
                    const cursorSize = 12 + (normalizedBass * 25) + (aweFactor * 20);
                    ctx.shadowColor = 'white';
                    ctx.shadowBlur = 15 + avgVol * 30;
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, cursorSize, 0, Math.PI * 2);
                    ctx.stroke();
                    // Inner fill
                    ctx.fillStyle = `rgba(255,255,255, ${0.4 + avgVol * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, cursorSize * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // --- FOOTER & LED BARS ---
                    // (Keep the centered layout we fixed previously)
                    const footerY = height - 180;
                    const grd = ctx.createLinearGradient(0, footerY, 0, height);
                    grd.addColorStop(0, 'rgba(0,0,0,0)');
                    grd.addColorStop(1, 'rgba(0,0,0,0.95)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, footerY, width, 180);

                    // Colors logic
                    let currentR = 255, currentG = 255, currentB = 255;
                    // Just use white/gold if performance, or map from block if synced
                    if (useWebcam) {
                        // Map expression to color? 
                        // Smile -> Warm, Frown -> Cool
                        const warmth = metrics.smile;
                        currentR = 200 + (warmth * 55);
                        currentG = 200 + (warmth * 55);
                        currentB = 255 - (warmth * 100);
                    } else {
                        // ... (Existing RGB logic for auto mode) ...
                        // Re-implement fast find or keep it simple
                        if (!isSyncMode) {
                            const active = videoEvents.find(e => e.time <= elapsed && (e.time + e.duration) > elapsed);
                            if (active?.sourceBlock) {
                                currentR = active.sourceBlock.r; currentG = active.sourceBlock.g; currentB = active.sourceBlock.b;
                            }
                        } else {
                            const normalizedTime = (elapsed / duration) * originalDuration;
                            const active = videoEvents.find(e => e.time <= normalizedTime && (e.time + e.duration) > normalizedTime);
                            if (active?.sourceBlock) {
                                currentR = active.sourceBlock.r; currentG = active.sourceBlock.g; currentB = active.sourceBlock.b;
                            }
                        }
                    }

                    const barWidth = 12;
                    const barGap = 40;
                    const totalBarsWidth = (barWidth * 3) + (barGap * 2);
                    const barsStartX = (width / 2) - (totalBarsWidth / 2);
                    const barsY = height - 60;
                    const maxBarH = 100;

                    const drawLEDBar = (x: number, val: number, r: number, g: number, b: number, label: string) => {
                        const segments = 12;
                        const segH = maxBarH / segments;
                        ctx.shadowBlur = 30 + val * 40;
                        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
                        for (let i = 0; i < segments; i++) {
                            const segY = barsY - (i + 1) * segH;
                            const isActive = (i / segments) < val;
                            ctx.fillStyle = isActive ? `rgba(${r},${g},${b},1)` : `rgba(${r},${g},${b},0.1)`;
                            const pulse = isActive ? (val * 2) : 0;
                            ctx.fillRect(x - pulse / 2, segY + 2, barWidth + pulse, segH - 3);
                        }
                        ctx.shadowBlur = 0;
                        ctx.font = 'bold 12px "Inter", sans-serif';
                        ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
                        ctx.fillText(label, x - 5, barsY + 20);
                    };

                    const lowFreq = normalizedBass;
                    const midFreq = avgVol;
                    const highFreq = avgVol * (1 + (metrics.smile || 0)); // Smile boosts highs visual

                    drawLEDBar(barsStartX, lowFreq, currentR, 50, 50, 'LOW');
                    drawLEDBar(barsStartX + barGap, midFreq, 50, currentG, 50, 'MID');
                    drawLEDBar(barsStartX + barGap * 2, highFreq, 50, 50, currentB, 'HIGH');

                    // Title
                    ctx.font = '600 42px "Outfit", sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.fillText((metadata?.title || "SINFONIA VISIVA").toUpperCase(), 60, height - 95);
                    ctx.font = '300 24px "Inter", sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.fillText(metadata?.author || "SonificA.R.T.", 60, height - 55);

                    // Logo
                    ctx.drawImage(logoImg, width - 180, height - 150, 90, 90);

                    // Performance Indicator
                    if (useWebcam) {
                        ctx.fillStyle = 'red';
                        ctx.beginPath(); ctx.arc(width - 200, 60, 10, 0, Math.PI * 2); ctx.fill();
                        ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#fff';
                        ctx.fillText('REC', width - 180, 65);
                    }


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
