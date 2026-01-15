/**
 * WebM Metadata Injector
 * Adds metadata (title, author, etc.) to a WebM video blob
 * by manipulating the EBML structure
 */

// EBML/WebM Tag IDs
const EBML_TAG_SEGMENT = 0x18538067;
const EBML_TAG_INFO = 0x1549A966;
const EBML_TAG_TITLE = 0x7BA9;
const EBML_TAG_MUXING_APP = 0x4D80;
const EBML_TAG_WRITING_APP = 0x5741;
const EBML_TAG_DATE_UTC = 0x4461;
const EBML_TAG_TAGS = 0x1254C367;
const EBML_TAG_TAG = 0x7373;
const EBML_TAG_SIMPLE_TAG = 0x67C8;
const EBML_TAG_TAG_NAME = 0x45A3;
const EBML_TAG_TAG_STRING = 0x4487;

// Helper to encode EBML variable-size integer
function encodeVint(value: number): Uint8Array {
    if (value < 0x7F) {
        return new Uint8Array([0x80 | value]);
    } else if (value < 0x3FFF) {
        return new Uint8Array([0x40 | (value >> 8), value & 0xFF]);
    } else if (value < 0x1FFFFF) {
        return new Uint8Array([0x20 | (value >> 16), (value >> 8) & 0xFF, value & 0xFF]);
    } else if (value < 0x0FFFFFFF) {
        return new Uint8Array([0x10 | (value >> 24), (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]);
    }
    throw new Error("Value too large for VINT encoding");
}

// Helper to encode EBML element ID
function encodeElementId(id: number): Uint8Array {
    if (id <= 0xFF) return new Uint8Array([id]);
    if (id <= 0xFFFF) return new Uint8Array([(id >> 8) & 0xFF, id & 0xFF]);
    if (id <= 0xFFFFFF) return new Uint8Array([(id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF]);
    return new Uint8Array([(id >> 24) & 0xFF, (id >> 16) & 0xFF, (id >> 8) & 0xFF, id & 0xFF]);
}

// Create an EBML string element
function createStringElement(tagId: number, value: string): Uint8Array {
    const idBytes = encodeElementId(tagId);
    const valueBytes = new TextEncoder().encode(value);
    const sizeBytes = encodeVint(valueBytes.length);

    const result = new Uint8Array(idBytes.length + sizeBytes.length + valueBytes.length);
    result.set(idBytes, 0);
    result.set(sizeBytes, idBytes.length);
    result.set(valueBytes, idBytes.length + sizeBytes.length);
    return result;
}

// Create a SimpleTag element (name + value)
function createSimpleTag(name: string, value: string): Uint8Array {
    const nameElement = createStringElement(EBML_TAG_TAG_NAME, name);
    const valueElement = createStringElement(EBML_TAG_TAG_STRING, value);

    const tagId = encodeElementId(EBML_TAG_SIMPLE_TAG);
    const contentLength = nameElement.length + valueElement.length;
    const sizeBytes = encodeVint(contentLength);

    const result = new Uint8Array(tagId.length + sizeBytes.length + contentLength);
    let offset = 0;
    result.set(tagId, offset); offset += tagId.length;
    result.set(sizeBytes, offset); offset += sizeBytes.length;
    result.set(nameElement, offset); offset += nameElement.length;
    result.set(valueElement, offset);

    return result;
}

// Create Tags container with metadata
function createTagsElement(metadata: { title?: string; author?: string; description?: string; date?: string }): Uint8Array {
    const simpleTags: Uint8Array[] = [];

    if (metadata.title) simpleTags.push(createSimpleTag("TITLE", metadata.title));
    if (metadata.author) simpleTags.push(createSimpleTag("ARTIST", metadata.author));
    if (metadata.description) simpleTags.push(createSimpleTag("DESCRIPTION", metadata.description));
    if (metadata.date) simpleTags.push(createSimpleTag("DATE_RELEASED", metadata.date));
    simpleTags.push(createSimpleTag("ENCODER", "SonificART Video Generator"));
    simpleTags.push(createSimpleTag("COPYRIGHT", `© ${new Date().getFullYear()} SonificART`));

    // Combine all simple tags into a Tag element
    const tagContent = simpleTags.reduce((acc, tag) => {
        const combined = new Uint8Array(acc.length + tag.length);
        combined.set(acc, 0);
        combined.set(tag, acc.length);
        return combined;
    }, new Uint8Array(0));

    const tagId = encodeElementId(EBML_TAG_TAG);
    const tagSize = encodeVint(tagContent.length);

    const tagElement = new Uint8Array(tagId.length + tagSize.length + tagContent.length);
    tagElement.set(tagId, 0);
    tagElement.set(tagSize, tagId.length);
    tagElement.set(tagContent, tagId.length + tagSize.length);

    // Wrap in Tags container
    const tagsId = encodeElementId(EBML_TAG_TAGS);
    const tagsSize = encodeVint(tagElement.length);

    const tagsElement = new Uint8Array(tagsId.length + tagsSize.length + tagElement.length);
    tagsElement.set(tagsId, 0);
    tagsElement.set(tagsSize, tagsId.length);
    tagsElement.set(tagElement, tagsId.length + tagsSize.length);

    return tagsElement;
}

/**
 * Injects metadata into a WebM blob
 * Note: This is a simplified implementation that appends Tags to the end of the file.
 * Full EBML editing would require parsing and rewriting the Segment element.
 */
export async function injectWebMMetadata(
    blob: Blob,
    metadata: { title?: string; author?: string; description?: string }
): Promise<Blob> {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const originalData = new Uint8Array(arrayBuffer);

        // Create Tags element with metadata
        const tagsElement = createTagsElement({
            ...metadata,
            date: new Date().toISOString().slice(0, 10)
        });

        // Append Tags to the end of the file
        // Note: For proper WebM structure, Tags should be inside the Segment,
        // but many players will still read Tags appended at the end
        const newData = new Uint8Array(originalData.length + tagsElement.length);
        newData.set(originalData, 0);
        newData.set(tagsElement, originalData.length);

        return new Blob([newData], { type: blob.type });
    } catch (error) {
        console.warn("Failed to inject metadata into WebM:", error);
        return blob; // Return original blob if injection fails
    }
}

/**
 * Alternative: Generate metadata as a separate sidecar JSON file
 * This can be used for archival purposes
 */
export function generateMetadataJson(metadata: {
    title?: string;
    author?: string;
    description?: string;
    duration?: number;
    imageHash?: string;
}): string {
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: metadata.title || "SonificART Video",
        author: {
            "@type": "Person",
            name: metadata.author || "SonificART User"
        },
        description: metadata.description || "Deterministic sonification video generated by SonificART",
        uploadDate: new Date().toISOString(),
        duration: metadata.duration ? `PT${Math.floor(metadata.duration)}S` : undefined,
        encodingFormat: "video/webm",
        creator: {
            "@type": "Organization",
            name: "SonificART",
            url: "https://sonificart.com"
        },
        copyrightYear: new Date().getFullYear(),
        copyrightHolder: "SonificART",
        identifier: metadata.imageHash
    }, null, 2);
}
