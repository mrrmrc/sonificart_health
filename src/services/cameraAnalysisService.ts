/**
 * Camera Analysis Service
 * 
 * Provides real-time analysis of camera feed for guided photo capture.
 * Analyzes exposure, white balance, contrast, and stability to guide users
 * in capturing standardized photos.
 * 
 * @module cameraAnalysisService
 */

export interface MetricStatus {
    value: number;
    status: 'good' | 'warning' | 'bad';
    message: string;
}

export interface CameraFrameAnalysis {
    exposure: MetricStatus & { ev: number; histogram: number[] };
    whiteBalance: MetricStatus & { temperature: number; deviation: number };
    contrast: MetricStatus & { rms: number };
    stability: MetricStatus & { motion: number };
    focus: MetricStatus & { sharpness: number };
    overallReady: boolean;
}

// Store previous frame for motion detection
let previousFrameData: ImageData | null = null;

// ============================================================================
// EXPOSURE ANALYSIS
// ============================================================================

function analyzeExposure(imageData: ImageData): CameraFrameAnalysis['exposure'] {
    const histogram = new Array(256).fill(0);
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;

    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram[gray]++;
    }

    let sumLuminance = 0;
    for (let i = 0; i < histogram.length; i++) {
        sumLuminance += histogram[i] * i;
    }
    const meanLuminance = sumLuminance / totalPixels;
    const ev = (meanLuminance - 128) / 32;

    let status: 'good' | 'warning' | 'bad' = 'good';
    let message = 'Ottimale';

    if (Math.abs(ev) > 1.2) {
        status = 'bad';
        message = ev < 0 ? 'Troppo scura' : 'Troppo chiara';
    } else if (Math.abs(ev) > 0.6) {
        status = 'warning';
        message = 'Luce sub-ottimale';
    }

    return { value: meanLuminance, ev, histogram, status, message };
}

// ============================================================================
// WHITE BALANCE ANALYSIS
// ============================================================================

function analyzeWhiteBalance(imageData: ImageData): CameraFrameAnalysis['whiteBalance'] {
    const data = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0;
    const pixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
    }

    const avgR = sumR / pixels;
    const avgB = sumB / pixels;
    const ratio = avgB / (avgR || 1);

    let temperature = 6500;
    if (ratio < 0.7) temperature = 3000;
    else if (ratio < 1.0) temperature = 4500;
    else if (ratio > 1.3) temperature = 9000;

    const deviation = Math.abs(temperature - 6500);
    let status: 'good' | 'warning' | 'bad' = 'good';
    let message = 'Corretto';

    if (deviation > 1500) {
        status = 'bad';
        message = temperature < 6500 ? 'Luce troppo calda' : 'Luce troppo fredda';
    } else if (deviation > 500) {
        status = 'warning';
        message = 'Bilanciamento non ideale';
    }

    return { value: temperature, temperature, deviation, status, message };
}

// ============================================================================
// CONTRAST ANALYSIS
// ============================================================================

function analyzeContrast(imageData: ImageData): CameraFrameAnalysis['contrast'] {
    const data = imageData.data;
    const pixels = data.length / 4;

    let sumL = 0, sumL2 = 0;
    for (let i = 0; i < data.length; i += 4) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sumL += l;
        sumL2 += l * l;
    }

    const mean = sumL / pixels;
    const variance = (sumL2 / pixels) - (mean * mean);
    const rms = (Math.sqrt(Math.max(0, variance)) / 255) * 100;

    let status: 'good' | 'warning' | 'bad' = 'good';
    let message = 'Ottimale';

    if (rms < 10) {
        status = 'bad';
        message = 'Troppo piatto';
    } else if (rms < 20) {
        status = 'warning';
        message = 'Contrasto basso';
    }

    return { value: rms, rms, status, message };
}

// ============================================================================
// STABILITY & FOCUS ANALYSIS
// ============================================================================

function analyzeStability(imageData: ImageData): CameraFrameAnalysis['stability'] {
    let motion = 0;
    if (previousFrameData && previousFrameData.width === imageData.width) {
        const d1 = previousFrameData.data;
        const d2 = imageData.data;
        let diff = 0;
        for (let i = 0; i < d1.length; i += 20) { // Sample pixels for speed
            diff += Math.abs(d1[i] - d2[i]);
        }
        motion = diff / (d1.length / 20) / 255;
    }

    previousFrameData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

    let status: 'good' | 'warning' | 'bad' = 'good';
    let message = 'Stabile';

    if (motion > 0.1) {
        status = 'bad';
        message = 'Troppo movimento';
    } else if (motion > 0.04) {
        status = 'warning';
        message = 'Resta immobile';
    }

    return { value: motion, motion, status, message };
}

function analyzeFocus(imageData: ImageData): CameraFrameAnalysis['focus'] {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Laplacian variance for sharpness
    let sum = 0, sumSq = 0, count = 0;
    for (let y = 5; y < height - 5; y += 5) {
        for (let x = 5; x < width - 5; x += 5) {
            const idx = (y * width + x) * 4;
            const l = data[idx];
            // Simple 1D laplacian for speed
            const l_prev = data[idx - 4];
            const l_next = data[idx + 4];
            const lap = l_next + l_prev - 2 * l;
            sum += lap;
            sumSq += lap * lap;
            count++;
        }
    }

    const mean = sum / count;
    const sharpness = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));

    let status: 'good' | 'warning' | 'bad' = 'good';
    let message = 'Fuoco OK';

    // Extremely relaxed thresholds (v1.3) - High tolerance for low-texture art
    if (sharpness < 15) {
        status = 'bad';
        message = 'Fuoco insufficiente';
    } else if (sharpness < 35) {
        status = 'warning';
        message = 'Messa a fuoco bassa';
    }

    return { value: sharpness, sharpness, status, message };
}

// ============================================================================
// MASTER ANALYSIS
// ============================================================================

export function analyzeCameraFrame(videoElement: HTMLVideoElement): CameraFrameAnalysis {
    const canvas = document.createElement('canvas');
    canvas.width = 320; // Lower res for faster analysis
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Context error');

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const exposure = analyzeExposure(imageData);
    const whiteBalance = analyzeWhiteBalance(imageData);
    const contrast = analyzeContrast(imageData);
    const stability = analyzeStability(imageData);
    const focus = analyzeFocus(imageData);

    // v1.3: Proceed if focus is at least 'warning', don't require 'good'
    const overallReady =
        exposure.status !== 'bad' &&
        whiteBalance.status !== 'bad' &&
        contrast.status !== 'bad' &&
        stability.status === 'good' &&
        focus.status !== 'bad';

    return { exposure, whiteBalance, contrast, stability, focus, overallReady };
}

export function resetStabilityTracking(): void {
    previousFrameData = null;
}

export function getQualityScore(analysis: CameraFrameAnalysis): number {
    const s = (st: 'good' | 'warning' | 'bad') => st === 'good' ? 100 : st === 'warning' ? 50 : 0;
    return (s(analysis.exposure.status) + s(analysis.whiteBalance.status) + s(analysis.contrast.status) + s(analysis.stability.status) + s(analysis.focus.status)) / 5;
}

export function getCaptureTips(analysis: CameraFrameAnalysis): string[] {
    const tips: string[] = [];

    if (analysis.focus.status !== 'good') {
        tips.push('🔍 Tocca lo schermo per rimettere a fuoco');
        tips.push('📏 Prova ad allontanarti o avvicinati leggermente');
        tips.push('✨ Assicurati che la lente della camera sia pulita');
    }

    if (analysis.stability.status !== 'good') {
        tips.push('🤚 Tieni il telefono più fermo o appoggialo');
        tips.push('🧘 Trattieni il respiro durante lo scatto');
    }

    if (analysis.exposure.status !== 'good') {
        if (analysis.exposure.ev < 0) tips.push('💡 Avvicinati a una fonte di luce (finestra o LED)');
        else tips.push('☀️ Allontanati dalla luce diretta per evitare riflessi');
    }

    if (analysis.whiteBalance.status !== 'good') {
        tips.push('🎨 Usa una luce bianca naturale, evita luci gialle o colorate');
    }

    if (tips.length === 0) tips.push('✅ Posizione perfetta! Resta così...');

    return tips;
}
