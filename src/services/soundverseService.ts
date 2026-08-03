import { api as backendApi } from './api';
import { blobToBase64 } from './audioUtils';

const DEFAULT_SOUNDVERSE_KEY = "sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl";

function getLocalAuthToken(): string {
    return localStorage.getItem('sonificart_auth_token') || sessionStorage.getItem('sonificart_auth_token') || '';
}

export async function getSoundverseApiKey(): Promise<string> {
    try {
        const keyRaw = await backendApi.getAppSetting('soundverse_api_key');
        const cleanKey = keyRaw ? keyRaw.replace(/<[^>]*>?/gm, '').trim() : '';
        if (cleanKey) {
            return cleanKey;
        }
    } catch (e) {
        console.warn("Soundverse API key non trovata nel DB, uso fallback.", e);
    }
    return DEFAULT_SOUNDVERSE_KEY;
}

export interface SoundverseGenerationResponse {
    success: boolean;
    audioUrl?: string;
    error?: string;
    raw?: any;
}

export type SoundverseProgressCallback = (
    pct: number,
    status: string,
    detail: string
) => void;

/**
 * Helper per chiamare in modo resiliente il backend PHP gestendo eventuali HTML o rotte 404
 */
async function callPhpProxy(actionName: string, payloadData: Record<string, any>): Promise<any> {
    const token = getLocalAuthToken();
    const candidatePhpUrls = [
        `/api/index.php?action=${actionName}`,
        `api/index.php?action=${actionName}`,
        `backend/index.php?action=${actionName}`,
        `/index.php?action=${actionName}`,
        `index.php?action=${actionName}`
    ];

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const bodyStr = JSON.stringify({
        action: actionName,
        auth_token: token,
        ...payloadData
    });

    let lastError: any = null;

    for (const phpUrl of candidatePhpUrls) {
        try {
            const res = await fetch(phpUrl, {
                method: 'POST',
                headers,
                body: bodyStr
            });

            if (res.status === 404) {
                continue; // Rotta 404: prova la rotta successiva
            }

            const text = await res.text();
            
            // Se la risposta e' una pagina HTML (React SPA fallback), ignora e prova la rotta successiva
            const trimmedText = text.trim();
            if (trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html') || trimmedText.includes('@context') || trimmedText.includes('<script')) {
                continue;
            }

            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch (e) {
                // Se non e' JSON valido, non tentare estrazione da HTML
            }

            if (data) {
                if (!res.ok && data.error) {
                    throw new Error(data.error);
                }
                return data;
            } else {
                throw new Error(`Risposta server non valida (${res.status}): ${text.substring(0, 80)}...`);
            }
        } catch (err: any) {
            lastError = err;
        }
    }

    throw new Error(lastError?.message || "Impossibile contattare il server backend PHP.");
}

export interface SoundverseBalanceResponse {
    success: boolean;
    totalCredits?: number;
    baseEffective?: number;
    extraCents?: number;
    error?: string;
    raw?: any;
}

/**
 * Recupera il saldo crediti/token Soundverse in tempo reale dall'API
 */
export async function getSoundverseBalance(apiKeyOverride?: string): Promise<SoundverseBalanceResponse> {
    try {
        const apiKey = apiKeyOverride || (await getSoundverseApiKey());
        const data = await callPhpProxy('soundverse_balance', { apiKey });
        if (data.success === false) {
            return { success: false, error: data.error || "Impossibile recuperare i crediti Soundverse." };
        }
        return {
            success: true,
            totalCredits: data.totalCredits ?? 0,
            baseEffective: data.baseEffective ?? 0,
            extraCents: data.extraCents ?? 0,
            raw: data.raw
        };
    } catch (e: any) {
        return { success: false, error: e.message || "Errore durante la lettura del saldo crediti Soundverse." };
    }
}

/**
 * Controllo pre-flight preventivo della connessione e validità dell'API Key Soundverse
 */
export async function checkSoundverseApi(apiKeyOverride?: string): Promise<{ success: boolean; error?: string; message?: string; totalCredits?: number; checkLog?: any[] }> {
    try {
        const apiKey = apiKeyOverride || (await getSoundverseApiKey());
        const data = await callPhpProxy('soundverse_check', { apiKey });
        // Il backend ora restituisce sempre HTTP 200 con success: true/false
        if (data.success === false) {
            return { success: false, error: data.error || "Verifica API Key fallita.", checkLog: data.checkLog };
        }
        return { success: true, message: data.message, totalCredits: data.totalCredits, checkLog: data.checkLog };
    } catch (e: any) {
        return { success: false, error: e.message || "Impossibile verificare l'API Key Soundverse." };
    }
}

import { generateAiAudioTrack } from './musicAiService';

export async function generateSoundverseAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null,
    onProgress?: SoundverseProgressCallback
): Promise<SoundverseGenerationResponse> {
    return generateAiAudioTrack(
        promptText,
        durationSeconds,
        audioWavBlob,
        audioWavUrl,
        onProgress
    );
}
