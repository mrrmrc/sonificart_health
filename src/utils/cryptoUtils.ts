export async function calculateSHA256(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    return await window.crypto.subtle.digest('SHA-256', buffer);
}

export function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
