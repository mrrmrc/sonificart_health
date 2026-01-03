/**
 * Image Normalization Service
 * 
 * Provides advanced colorimetric normalization to ensure consistent sonification
 * regardless of photographic conditions (lighting, exposure, white balance).
 * 
 * Algorithms:
 * - White Balance: Hybrid Gray World + White Patch
 * - Exposure: CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * - Contrast: Adaptive normalization with target standard deviation
 * 
 * @module imageNormalizationService
 */

export interface NormalizationOptions {
    whiteBalance: boolean;
    exposure: boolean;
    contrast: boolean;
    claheClipLimit?: number;
    claheTileSize?: number;
    targetContrast?: number;
}

export interface NormalizationReport {
    applied: string[];
    metrics: {
        whiteBalanceShift: { r: number; g: number; b: number };
        exposureAdjustment: number;
        contrastImprovement: number;
    };
    quality: {
        colorTemperature: number;
        colorAccuracy: number;
        dynamicRange: number;
    };
    processingTime: number;
}

interface RGBStats {
    r: number;
    g: number;
    b: number;
}

interface LABPixel {
    l: number;
    a: number;
    b: number;
}

// ============================================================================
// COLOR SPACE CONVERSIONS
// ============================================================================

function rgbToLab(r: number, g: number, b: number): LABPixel {
    // Normalize RGB to 0-1
    let R = r / 255;
    let G = g / 255;
    let B = b / 255;

    // Apply gamma correction (sRGB to linear RGB)
    R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
    G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
    B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

    // Convert to XYZ (D65 illuminant)
    const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

    // Normalize by D65 white point
    let x = X / 0.95047;
    let y = Y / 1.00000;
    let z = Z / 1.08883;

    // Apply Lab transformation
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

    return {
        l: (116 * y) - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
}

function labToRgb(l: number, a: number, b: number): { r: number; g: number; b: number } {
    // Lab to XYZ
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const x3 = x * x * x;
    const y3 = y * y * y;
    const z3 = z * z * z;

    x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
    y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
    z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

    // Denormalize by D65 white point
    x *= 0.95047;
    y *= 1.00000;
    z *= 1.08883;

    // XYZ to linear RGB
    let R = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    let G = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    let B = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // Apply gamma correction (linear RGB to sRGB)
    R = R > 0.0031308 ? 1.055 * Math.pow(R, 1 / 2.4) - 0.055 : 12.92 * R;
    G = G > 0.0031308 ? 1.055 * Math.pow(G, 1 / 2.4) - 0.055 : 12.92 * G;
    B = B > 0.0031308 ? 1.055 * Math.pow(B, 1 / 2.4) - 0.055 : 12.92 * B;

    return {
        r: Math.max(0, Math.min(255, Math.round(R * 255))),
        g: Math.max(0, Math.min(255, Math.round(G * 255))),
        b: Math.max(0, Math.min(255, Math.round(B * 255)))
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateAverageRGB(imageData: ImageData): RGBStats {
    const data = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0;
    const pixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
    }

    return {
        r: sumR / pixels,
        g: sumG / pixels,
        b: sumB / pixels
    };
}

function calculateMeanLuminance(imageData: ImageData): number {
    const data = imageData.data;
    let sum = 0;
    const pixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += gray;
    }

    return sum / pixels;
}

function calculateStdDev(imageData: ImageData): number {
    const data = imageData.data;
    const pixels = data.length / 4;
    let sum = 0, sumSq = 0;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += gray;
        sumSq += gray * gray;
    }

    const mean = sum / pixels;
    const variance = (sumSq / pixels) - (mean * mean);
    return Math.sqrt(Math.max(0, variance));
}

function estimateColorTemperature(avgRGB: RGBStats): number {
    // Simplified color temperature estimation using R/B ratio
    // Based on Planckian locus approximation
    const ratio = avgRGB.b / avgRGB.r;

    // Empirical mapping (rough approximation)
    // ratio ~0.7 → 3000K (warm/tungsten)
    // ratio ~1.0 → 6500K (daylight/D65)
    // ratio ~1.3 → 10000K (cool/shade)

    if (ratio < 0.7) return 2500;
    if (ratio > 1.3) return 10000;

    return 2500 + (ratio - 0.7) * (10000 - 2500) / 0.6;
}

// ============================================================================
// WHITE BALANCE CORRECTION
// ============================================================================

/**
 * Corrects white balance using hybrid Gray World + White Patch algorithm
 * 
 * Gray World: Assumes average color should be neutral gray
 * White Patch: Assumes brightest pixels should be white
 * 
 * @param imageData - Input image data
 * @returns Corrected image data
 */
function correctWhiteBalance(imageData: ImageData): ImageData {
    const data = imageData.data;
    const pixels = data.length / 4;

    // Step 1: Calculate statistics for Gray World
    let sumR = 0, sumG = 0, sumB = 0;
    let maxR = 0, maxG = 0, maxB = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        sumR += r;
        sumG += g;
        sumB += b;

        if (r > maxR) maxR = r;
        if (g > maxG) maxG = g;
        if (b > maxB) maxB = b;
    }

    const avgR = sumR / pixels;
    const avgG = sumG / pixels;
    const avgB = sumB / pixels;
    const avgGray = (avgR + avgG + avgB) / 3;

    // Step 2: Gray World scaling factors
    const scaleR_gw = avgGray / (avgR || 1);
    const scaleG_gw = avgGray / (avgG || 1);
    const scaleB_gw = avgGray / (avgB || 1);

    // Step 3: White Patch scaling factors
    const maxWhite = 255;
    const scaleR_wp = maxWhite / (maxR || 1);
    const scaleG_wp = maxWhite / (maxG || 1);
    const scaleB_wp = maxWhite / (maxB || 1);

    // Step 4: Hybrid approach (70% Gray World, 30% White Patch)
    const scaleR = scaleR_gw * 0.7 + scaleR_wp * 0.3;
    const scaleG = scaleG_gw * 0.7 + scaleG_wp * 0.3;
    const scaleB = scaleB_gw * 0.7 + scaleB_wp * 0.3;

    // Step 5: Apply correction
    const corrected = new ImageData(imageData.width, imageData.height);
    for (let i = 0; i < data.length; i += 4) {
        corrected.data[i] = Math.min(255, Math.max(0, data[i] * scaleR));
        corrected.data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scaleG));
        corrected.data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scaleB));
        corrected.data[i + 3] = data[i + 3]; // Alpha unchanged
    }

    return corrected;
}

// ============================================================================
// EXPOSURE CORRECTION (CLAHE)
// ============================================================================

/**
 * Applies CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Works on L* channel in LAB color space to preserve hue
 * 
 * @param imageData - Input image data
 * @param clipLimit - Contrast limiting parameter (default: 2.0)
 * @param tileSize - Size of local tiles (default: 8)
 * @returns Corrected image data
 */
function correctExposure(
    imageData: ImageData,
    clipLimit: number = 2.0,
    tileSize: number = 8
): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert RGB to LAB
    const labData: LABPixel[] = [];
    for (let i = 0; i < data.length; i += 4) {
        labData.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
    }

    // Extract L* channel
    const lChannel = labData.map(p => p.l);

    // Apply CLAHE on L* channel
    const enhancedL = applyCLAHE(lChannel, width, height, clipLimit, tileSize);

    // Reconstruct LAB with enhanced L*
    for (let i = 0; i < labData.length; i++) {
        labData[i].l = enhancedL[i];
    }

    // Convert back to RGB
    const corrected = new ImageData(width, height);
    for (let i = 0; i < labData.length; i++) {
        const rgb = labToRgb(labData[i].l, labData[i].a, labData[i].b);
        corrected.data[i * 4] = rgb.r;
        corrected.data[i * 4 + 1] = rgb.g;
        corrected.data[i * 4 + 2] = rgb.b;
        corrected.data[i * 4 + 3] = data[i * 4 + 3]; // Alpha
    }

    return corrected;
}

function applyCLAHE(
    channel: number[],
    width: number,
    height: number,
    clipLimit: number,
    tileSize: number
): number[] {
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);

    // Calculate histogram and CDF for each tile
    const cdfs: number[][][] = [];
    for (let ty = 0; ty < tilesY; ty++) {
        cdfs[ty] = [];
        for (let tx = 0; tx < tilesX; tx++) {
            const hist = calculateTileHistogram(channel, width, height, tx, ty, tileSize);
            const clippedHist = clipHistogram(hist, clipLimit, tileSize);
            cdfs[ty][tx] = calculateCDF(clippedHist);
        }
    }

    // Apply transformation with bilinear interpolation
    const result = new Array(channel.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const value = channel[idx];

            // Find tile coordinates
            const tx = Math.min(Math.floor(x / tileSize), tilesX - 1);
            const ty = Math.min(Math.floor(y / tileSize), tilesY - 1);

            // Position within tile (0-1)
            const xInTile = (x % tileSize) / tileSize;
            const yInTile = (y % tileSize) / tileSize;

            // Bilinear interpolation between 4 neighboring tile CDFs
            const bin = Math.floor(value);
            let interpolated = 0;

            if (tx < tilesX - 1 && ty < tilesY - 1) {
                const v00 = cdfs[ty][tx][bin];
                const v10 = cdfs[ty][tx + 1][bin];
                const v01 = cdfs[ty + 1][tx][bin];
                const v11 = cdfs[ty + 1][tx + 1][bin];

                const v0 = v00 * (1 - xInTile) + v10 * xInTile;
                const v1 = v01 * (1 - xInTile) + v11 * xInTile;
                interpolated = v0 * (1 - yInTile) + v1 * yInTile;
            } else {
                interpolated = cdfs[ty][tx][bin];
            }

            result[idx] = interpolated * 100; // Scale back to L* range (0-100)
        }
    }

    return result;
}

function calculateTileHistogram(
    channel: number[],
    width: number,
    height: number,
    tx: number,
    ty: number,
    tileSize: number
): number[] {
    const hist = new Array(101).fill(0); // L* range 0-100

    const startX = tx * tileSize;
    const startY = ty * tileSize;
    const endX = Math.min(startX + tileSize, width);
    const endY = Math.min(startY + tileSize, height);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const idx = y * width + x;
            const bin = Math.min(100, Math.max(0, Math.floor(channel[idx])));
            hist[bin]++;
        }
    }

    return hist;
}

function clipHistogram(hist: number[], clipLimit: number, tileSize: number): number[] {
    const totalPixels = tileSize * tileSize;
    const clipThreshold = (clipLimit * totalPixels) / hist.length;

    let clippedHist = [...hist];
    let excess = 0;

    // Clip histogram
    for (let i = 0; i < clippedHist.length; i++) {
        if (clippedHist[i] > clipThreshold) {
            excess += clippedHist[i] - clipThreshold;
            clippedHist[i] = clipThreshold;
        }
    }

    // Redistribute excess uniformly
    const redistribution = excess / clippedHist.length;
    for (let i = 0; i < clippedHist.length; i++) {
        clippedHist[i] += redistribution;
    }

    return clippedHist;
}

function calculateCDF(hist: number[]): number[] {
    const cdf = new Array(hist.length);
    const total = hist.reduce((sum, val) => sum + val, 0);

    let cumulative = 0;
    for (let i = 0; i < hist.length; i++) {
        cumulative += hist[i];
        cdf[i] = cumulative / total;
    }

    return cdf;
}

// ============================================================================
// CONTRAST NORMALIZATION
// ============================================================================

/**
 * Normalizes contrast to a target standard deviation
 * 
 * @param imageData - Input image data
 * @param targetStdDev - Target standard deviation (default: 50)
 * @returns Corrected image data
 */
function normalizeContrast(imageData: ImageData, targetStdDev: number = 50): ImageData {
    const data = imageData.data;
    const pixels = data.length / 4;

    // Calculate current mean and std dev
    let sum = 0, sumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += gray;
        sumSq += gray * gray;
    }

    const mean = sum / pixels;
    const variance = (sumSq / pixels) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Avoid division by zero
    if (stdDev < 1) return imageData;

    // Calculate scaling factor
    const scale = targetStdDev / stdDev;

    // Apply normalization
    const corrected = new ImageData(imageData.width, imageData.height);
    for (let i = 0; i < data.length; i += 4) {
        corrected.data[i] = Math.min(255, Math.max(0, (data[i] - mean) * scale + mean));
        corrected.data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - mean) * scale + mean));
        corrected.data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - mean) * scale + mean));
        corrected.data[i + 3] = data[i + 3];
    }

    return corrected;
}

// ============================================================================
// MASTER NORMALIZATION PIPELINE
// ============================================================================

/**
 * Normalizes an image file to ensure consistent colorimetric properties
 * 
 * @param file - Input image file
 * @param options - Normalization options
 * @returns Normalized file and detailed report
 */
export async function normalizeImage(
    file: File,
    options: NormalizationOptions = {
        whiteBalance: true,
        exposure: true,
        contrast: true,
        claheClipLimit: 2.0,
        claheTileSize: 8,
        targetContrast: 50
    }
): Promise<{ normalizedFile: File; report: NormalizationReport }> {
    const startTime = performance.now();

    // Load image
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(imageBitmap, 0, 0);

    const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Initialize report
    const beforeStats = calculateAverageRGB(imageData);
    const beforeLuminance = calculateMeanLuminance(imageData);
    const beforeStdDev = calculateStdDev(imageData);
    const beforeTemp = estimateColorTemperature(beforeStats);

    const report: NormalizationReport = {
        applied: [],
        metrics: {
            whiteBalanceShift: { r: 0, g: 0, b: 0 },
            exposureAdjustment: 0,
            contrastImprovement: 0
        },
        quality: {
            colorTemperature: beforeTemp,
            colorAccuracy: 0,
            dynamicRange: 0
        },
        processingTime: 0
    };

    // Step 1: White Balance Correction
    if (options.whiteBalance) {
        imageData = correctWhiteBalance(imageData);
        const afterStats = calculateAverageRGB(imageData);
        report.applied.push('White Balance Correction (Hybrid Gray World + White Patch)');
        report.metrics.whiteBalanceShift = {
            r: afterStats.r - beforeStats.r,
            g: afterStats.g - beforeStats.g,
            b: afterStats.b - beforeStats.b
        };
    }

    // Step 2: Exposure Correction (CLAHE)
    if (options.exposure) {
        imageData = correctExposure(
            imageData,
            options.claheClipLimit || 2.0,
            options.claheTileSize || 8
        );
        const afterLuminance = calculateMeanLuminance(imageData);
        report.applied.push('Exposure Correction (CLAHE)');
        report.metrics.exposureAdjustment = afterLuminance - beforeLuminance;
    }

    // Step 3: Contrast Normalization
    if (options.contrast) {
        imageData = normalizeContrast(imageData, options.targetContrast || 50);
        const afterStdDev = calculateStdDev(imageData);
        report.applied.push('Contrast Normalization');
        report.metrics.contrastImprovement = afterStdDev - beforeStdDev;
    }

    // Calculate final quality metrics
    const finalStats = calculateAverageRGB(imageData);
    const finalTemp = estimateColorTemperature(finalStats);
    const tempDeviation = Math.abs(finalTemp - 6500); // Distance from D65
    const colorAccuracy = Math.max(0, 100 - (tempDeviation / 6500) * 100);

    report.quality.colorTemperature = finalTemp;
    report.quality.colorAccuracy = colorAccuracy;
    report.quality.dynamicRange = calculateStdDev(imageData);

    // Convert back to File
    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert canvas to blob'));
        }, 'image/jpeg', 0.95);
    });

    const normalizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '_normalized.jpg'), {
        type: 'image/jpeg'
    });

    report.processingTime = performance.now() - startTime;

    return { normalizedFile, report };
}

/**
 * Quick validation check for image quality
 * Returns true if image meets basic quality standards
 */
export function validateImageQuality(imageData: ImageData): {
    isValid: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // Check exposure
    const meanLuminance = calculateMeanLuminance(imageData);
    if (meanLuminance < 50) issues.push('Image is underexposed');
    if (meanLuminance > 200) issues.push('Image is overexposed');

    // Check contrast
    const stdDev = calculateStdDev(imageData);
    if (stdDev < 20) issues.push('Image has very low contrast');

    // Check color balance
    const avgRGB = calculateAverageRGB(imageData);
    const colorTemp = estimateColorTemperature(avgRGB);
    if (colorTemp < 4000) issues.push('Image has strong warm color cast');
    if (colorTemp > 9000) issues.push('Image has strong cool color cast');

    return {
        isValid: issues.length === 0,
        issues
    };
}
