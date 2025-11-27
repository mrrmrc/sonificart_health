import { BlockAnalysisResult, BlockData } from '../types';

// --- Color utility functions (self-contained for portability) ---
function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s, v };
}

function rgbToLab(r: number, g: number, b: number): { l: number, a: number, b: number } {
    let R = r / 255, G = g / 255, B = b / 255;
    R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
    G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
    B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
    
    const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

    let x = X / 0.95047, y = Y / 1.00000, z = Z / 1.08883;
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

    return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}


/**
 * Performs a detailed analysis of image blocks. This is the computationally intensive
 * core of the sonification process. It is a pure function, making it portable
 * to a Web Worker or a server-side environment.
 * @param imageData The raw pixel data of the standardized 512x512 image.
 * @param pixelCount The total number of blocks to divide the image into (e.g., 1024, 4096).
 * @param imageBounds The position and size of the actual image within the 512x512 canvas.
 * @returns A comprehensive analysis result for all blocks.
 */
export function performBlockAnalysis(
    imageData: ImageData, 
    pixelCount: number, 
    imageBounds: {x: number, y: number, width: number, height: number}
): BlockAnalysisResult {
    const gridSize = Math.sqrt(pixelCount);
    const blockWidth = 512 / gridSize, blockHeight = 512 / gridSize;
    const blocks: BlockData[] = [];
    let totalL = 0, totalA = 0, totalB = 0, totalS = 0, totalVariance = 0, contentBlockCount = 0;
    const hueCounts: { [key: number]: number } = {};

    for (let gridY = 0; gridY < gridSize; gridY++) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
            let r = 0, g = 0, b = 0, count = 0;
            let sumL = 0, sumL2 = 0; // For variance calculation

            const startX = Math.floor(gridX * blockWidth);
            const startY = Math.floor(gridY * blockHeight);
            
            const blockCenterX = startX + blockWidth / 2;
            const blockCenterY = startY + blockHeight / 2;

            const isFiller = blockCenterX < imageBounds.x || blockCenterX > imageBounds.x + imageBounds.width ||
                             blockCenterY < imageBounds.y || blockCenterY > imageBounds.y + imageBounds.height;

            if (!isFiller) {
                 for (let y = startY; y < startY + blockHeight; y++) {
                    for (let x = startX; x < startX + blockWidth; x++) {
                        const i = (y * 512 + x) * 4;
                        const R = imageData.data[i];
                        const G = imageData.data[i+1];
                        const B = imageData.data[i+2];

                        r += R; g += G; b += B;
                        
                        // Luminance for variance calculation
                        const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
                        sumL += l;
                        sumL2 += l * l;

                        count++;
                    }
                }
                const avgR = r/count, avgG = g/count, avgB = b/count;

                const avgL = sumL / count;
                const avgL2 = sumL2 / count;
                const variance = avgL2 - (avgL * avgL);
                
                const hsv = rgbToHsv(avgR, avgG, avgB);
                const lab = rgbToLab(avgR, avgG, avgB);
                
                totalL += lab.l; totalA += lab.a; totalB += lab.b; totalS += hsv.s; totalVariance += variance;
                const hueBin = Math.floor(hsv.h / 10) * 10;
                hueCounts[hueBin] = (hueCounts[hueBin] || 0) + 1;
                contentBlockCount++;

                blocks.push({
                    r: avgR, g: avgG, b: avgB,
                    position: { x: gridX, y: gridY },
                    hsv, lab, variance, isFiller: false,
                });
            } else {
                 blocks.push({
                    r: 0, g: 0, b: 0,
                    position: { x: gridX, y: gridY },
                    hsv: {h:0, s:0, v:0}, lab: {l:0, a:0, b:0}, variance: 0, isFiller: true,
                });
            }
        }
    }
    
    const hueDiversity = Object.keys(hueCounts).length / 36; // Normalize to 0-1 range (36 bins)
    const safeContentBlockCount = contentBlockCount > 0 ? contentBlockCount : 1;
    
    return {
        blocks,
        totalPixelsAnalyzed: 512 * 512,
        coveragePercentage: 100,
        analysisMethod: 'Grid 100% Coverage',
        gridSize,
        blockSize: blockWidth,
        globalStats: { 
            avg_L: totalL/safeContentBlockCount, 
            avg_a: totalA/safeContentBlockCount, 
            avg_b: totalB/safeContentBlockCount, 
            avg_saturation: totalS/safeContentBlockCount, 
            hue_diversity: hueDiversity,
            avg_variance: totalVariance / safeContentBlockCount,
        }
    };
}
