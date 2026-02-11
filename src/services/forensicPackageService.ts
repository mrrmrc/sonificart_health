/**
 * Forensic Package Service
 * 
 * Creates and reads .sac forensic packages that contain:
 * - The ORIGINAL untouched file (for verification)
 * - The sonification audio (WAV)
 * - Complete metadata and hashes
 * 
 * This ensures that the original file can be extracted and verified
 * even years after the sonification was created.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SonificationResult, OriginalFileMetadata } from '../types';
import { calculateSHA256, bufferToHex } from '../utils/cryptoUtils';
import { createSacContainer } from './sacService';

export interface ForensicPackageManifest {
    version: string;
    created_at: string;
    framework_version: string;

    // Original file info - THE SEAL
    original_file: {
        hash_sha256: string;
        size_bytes: number;
        filename: string;
        dimensions: { width: number; height: number };
        mime_type: string;
    };

    // Processed file info (for reference)
    processed_file: {
        hash_sha256: string;
        dimensions: { width: number; height: number };
    };

    // Audio info
    audio: {
        hash_sha256: string;
        duration_seconds: number;
        events_count: number;
    };

    // Sonification metadata
    sonification: {
        paradigm: string;
        tradition_name: string;
        cultural_family: string;
        scan_pattern: string;
        bpm: number;
    };
}

export interface ForensicPackageContents {
    manifest: ForensicPackageManifest;
    originalFileBlob: Blob;
    originalFileName: string;
    audioBlob: Blob;
    thumbnailBlob?: Blob;
}

/**
 * Calculate original file hash and dimensions BEFORE any processing
 */
export async function analyzeOriginalFile(file: File): Promise<OriginalFileMetadata> {
    // Get hash of original file bytes (untouched)
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await calculateSHA256(arrayBuffer);
    const hash = bufferToHex(hashBuffer);

    // Get original dimensions
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for dimension analysis'));
        };
        img.src = URL.createObjectURL(file);
    });

    // Create a blob from the file for storage
    const originalBlob = new Blob([arrayBuffer], { type: file.type || 'image/jpeg' });

    return {
        hash,
        size: file.size,
        name: file.name,
        dimensions,
        type: file.type || 'image/jpeg',
        originalBlob
    };
}

export interface CreateForensicPackageInput {
    originalBlob: Blob;
    originalMetadata: OriginalFileMetadata;
    result: SonificationResult;
    title?: string;
}

/**
 * Create a forensic package (.sac) that includes the original file
 * implementation: Surperset of Standard SAC
 */
export async function createForensicPackage(
    input: CreateForensicPackageInput
): Promise<Blob> {
    const { originalBlob, originalMetadata, result, title } = input;
    const timestamp = new Date().toISOString();

    // 1. Prepare data for Base SAC
    // We need to fetch the image blob since 'result' usually has it as a URL
    const imageResponse = await fetch(result.standardizedImageUrl);
    const imageBlob = await imageResponse.blob();

    // 2. Create the Base Standard SAC
    // This ensures all root files (generated_audio, block_analysis, etc.) are present
    const baseSac = await createSacContainer({
        imageHash: result.imageHash || 'unknown',
        audioHash: result.audioHash || 'unknown',
        config: result.configUsed,
        blockAnalysisResult: result.blockAnalysisResult,
        culturalSelectionResult: result.culturalSelectionResult,
        transformedEvents: result.audioOutput.events.filter(e => !e.isAccompaniment),
        totalDuration: result.audioOutput.duration,
        canvas: null, // Not needed if we provide imageJpegBlob
        imageJpegBlob: imageBlob,
        audioWavBlob: result.audioOutput.audioWavBlob,
        midiBlob: result.audioOutput.midiBlob,
        scanPattern: result.scanPattern,
        title: title || result.title,
        acquisitionMetadata: result.acquisitionMetadata
    });

    // 3. Load the Base SAC into JSZip to add Forensic Extras
    const zip = await JSZip.loadAsync(baseSac.blob);

    // 4. Add Forensic Extras: The Original "Seal"
    const originalFileBuffer = await originalBlob.arrayBuffer();
    zip.file(`original/${originalMetadata.name}`, originalFileBuffer);

    // 5. Create the Forensic Manifest (Specialized metadata)
    const manifest: ForensicPackageManifest = {
        version: '1.0.0',
        created_at: timestamp,
        framework_version: '1.0.0',

        original_file: {
            hash_sha256: originalMetadata.hash,
            size_bytes: originalMetadata.size,
            filename: originalMetadata.name,
            dimensions: originalMetadata.dimensions,
            mime_type: originalMetadata.type
        },

        processed_file: {
            hash_sha256: result.validationHashes?.imageBlobHash || 'unknown',
            dimensions: { width: 512, height: 512 }
        },

        audio: {
            hash_sha256: result.validationHashes?.audioBlobHash || 'unknown',
            duration_seconds: result.audioOutput.duration,
            events_count: result.audioOutput.eventsCount
        },

        sonification: {
            paradigm: result.paradigm,
            tradition_name: result.culturalSelectionResult?.tradition?.name || 'Unknown',
            cultural_family: result.culturalSelectionResult?.tradition?.cultural_family || 'Unknown',
            scan_pattern: result.scanPattern?.name || 'Unknown',
            bpm: result.configUsed?.bpm || 120
        }
    };

    // Use TextEncoder to ensure identical bytes for both Hashing and Zipping
    const manifestString = JSON.stringify(manifest, null, 2);
    const encoder = new TextEncoder();
    const manifestBuffer = encoder.encode(manifestString);

    zip.file('manifest.json', manifestBuffer);

    // 6. UPDATE Integrity Manifest
    // The base SAC has an integrity_manifest.json, but it doesn't know about our new files.
    // We must update it to include the hash of 'original/...' and 'manifest.json'
    // so that the Verification Portal accepts them as valid parts of the container.

    const integrityFile = zip.file("integrity_manifest.json");
    let integrityManifest: any = {};

    if (integrityFile) {
        const integrityContent = await integrityFile.async('string');
        integrityManifest = JSON.parse(integrityContent);
    } else {
        // Should not happen if createSacContainer works, but fallback:
        integrityManifest = { integrity: { file_hashes: {} } };
    }

    // Hash the new inclusions using the exact buffers we put in the zip
    const manifestHash = await calculateSHA256(manifestBuffer.buffer);

    // We already have originalFileBuffer (ArrayBuffer)
    const originalHash = await calculateSHA256(originalFileBuffer);

    // Update hashes in manifest
    integrityManifest.integrity.file_hashes['manifest.json'] = {
        sha256: bufferToHex(manifestHash),
        size_bytes: manifestBuffer.byteLength
    };

    integrityManifest.integrity.file_hashes[`original/${originalMetadata.name}`] = {
        sha256: bufferToHex(originalHash),
        size_bytes: originalFileBuffer.byteLength
    };

    // Update container version to denote Forensic
    integrityManifest.integrity.container_version = "SAC-FORENSIC-1.1";

    // Write back updated integrity manifest (using TextEncoder here too for consistency, though less critical since it's not hashed itself)
    zip.file("integrity_manifest.json", JSON.stringify(integrityManifest, null, 2));

    // 7. Generate Final Package
    const packageBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    return packageBlob;
}

/**
 * Read a forensic package and extract contents for verification
 */
export async function readForensicPackage(packageFile: File): Promise<ForensicPackageContents> {
    const zip = await JSZip.loadAsync(packageFile);

    // Read manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
        throw new Error('Invalid forensic package: manifest.json not found');
    }
    const manifestContent = await manifestFile.async('string');
    const manifest: ForensicPackageManifest = JSON.parse(manifestContent);

    // Find and read the original file
    const originalFolder = zip.folder('original');
    if (!originalFolder) {
        throw new Error('Invalid forensic package: original folder not found');
    }

    let originalFileBlob: Blob | null = null;
    let originalFileName = manifest.original_file.filename;

    originalFolder.forEach(async (relativePath, file) => {
        if (!file.dir) {
            originalFileName = relativePath;
        }
    });

    const originalFileEntry = zip.file(`original/${originalFileName}`);
    if (!originalFileEntry) {
        throw new Error(`Original file not found in package: ${originalFileName}`);
    }
    originalFileBlob = await originalFileEntry.async('blob');

    // Read audio
    const audioFile = zip.file('audio/sonification.wav');
    if (!audioFile) {
        throw new Error('Invalid forensic package: audio not found');
    }
    const audioBlob = await audioFile.async('blob');

    // Read thumbnail (optional)
    let thumbnailBlob: Blob | undefined;
    const thumbnailFile = zip.file('thumbnail/preview.jpg');
    if (thumbnailFile) {
        thumbnailBlob = await thumbnailFile.async('blob');
    }

    return {
        manifest,
        originalFileBlob,
        originalFileName,
        audioBlob,
        thumbnailBlob
    };
}

/**
 * Verify a file against a forensic package
 * Returns true if the file matches the certified original
 */
export async function verifyFileAgainstPackage(
    fileToVerify: File,
    packageContents: ForensicPackageContents
): Promise<{
    isMatch: boolean;
    details: {
        expectedHash: string;
        actualHash: string;
        expectedSize: number;
        actualSize: number;
        hashMatch: boolean;
        sizeMatch: boolean;
    };
}> {
    // Calculate hash of the file to verify
    const arrayBuffer = await fileToVerify.arrayBuffer();
    const hashBuffer = await calculateSHA256(arrayBuffer);
    const actualHash = bufferToHex(hashBuffer);

    const expectedHash = packageContents.manifest.original_file.hash_sha256;
    const expectedSize = packageContents.manifest.original_file.size_bytes;
    const actualSize = fileToVerify.size;

    const hashMatch = actualHash === expectedHash;
    const sizeMatch = actualSize === expectedSize;

    return {
        isMatch: hashMatch && sizeMatch,
        details: {
            expectedHash,
            actualHash,
            expectedSize,
            actualSize,
            hashMatch,
            sizeMatch
        }
    };
}

/**
 * Extract the original file from a forensic package
 */
export async function extractOriginalFromPackage(
    packageContents: ForensicPackageContents
): Promise<{ blob: Blob; fileName: string; metadata: ForensicPackageManifest['original_file'] }> {
    return {
        blob: packageContents.originalFileBlob,
        fileName: packageContents.originalFileName,
        metadata: packageContents.manifest.original_file
    };
}

/**
 * Download a forensic package
 */
export function downloadForensicPackage(blob: Blob, fileName: string): void {
    saveAs(blob, fileName);
}
