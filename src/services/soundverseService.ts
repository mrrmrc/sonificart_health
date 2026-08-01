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
        `index.php?action=${actionName}`,
        `/index.php?action=${actionName}`,
        `/api/index.php?action=${actionName}`,
        `api/index.php?action=${actionName}`,
        `backend/index.php?action=${actionName}`
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
            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch (e) {
                // Tenta estrazione se avvolto da HTML
                const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (match) {
                    try { data = JSON.parse(match[0]); } catch (inner) {}
                }
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

/**
 * Controllo pre-flight preventivo della connessione e validità dell'API Key Soundverse
 */
export async function checkSoundverseApi(apiKeyOverride?: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
        const apiKey = apiKeyOverride || (await getSoundverseApiKey());
        const data = await callPhpProxy('soundverse_check', { apiKey });
        return { success: true, message: data.message };
    } catch (e: any) {
        return { success: false, error: e.message || "Impossibile verificare l'API Key Soundverse." };
    }
}

export async function generateSoundverseAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null,
    onProgress?: SoundverseProgressCallback
): Promise<SoundverseGenerationResponse> {
    onProgress?.(5, "Pre-Flight Handshake API", "Verifica preventiva di connettività ed autenticazione con Soundverse...");
    
    const apiKey = await getSoundverseApiKey();

    const checkRes = await checkSoundverseApi(apiKey);
    if (!checkRes.success) {
        throw new Error(`Test Connessione API Soundverse Fallito: ${checkRes.error || 'API Key non valida'}`);
    }

    onProgress?.(15, "API Verificata & Attiva", "Credenziali e server Soundverse operativi. Avvio elaborazione audio...");

    let audioBase64: string | null = null;

    try {
        onProgress?.(30, "Elaborazione Audio WAV", "Conversione della linea melodica in formato base64 per invio al server...");
        if (audioWavBlob) {
            audioBase64 = await blobToBase64(audioWavBlob);
        } else if (audioWavUrl && audioWavUrl.startsWith('blob:')) {
            try {
                const res = await fetch(audioWavUrl);
                const blob = await res.blob();
                audioBase64 = await blobToBase64(blob);
            } catch (e) {
                console.warn("Impossibile scaricare blob audio localmente:", e);
            }
        }

        onProgress?.(55, "Invio Riferimento WAV & Parametri", "Caricamento riferimento WAV sul server e trasmissione a Soundverse AI...");

        const data = await callPhpProxy('soundverse_generate', {
            apiKey: apiKey,
            prompt: promptText,
            duration: durationSeconds,
            audio_base64: audioBase64,
            audioUrl: (audioWavUrl && !audioWavUrl.startsWith('blob:')) ? audioWavUrl : null
        });

        onProgress?.(80, "Sintesi Neurale Soundverse AI", "Elaborazione della composizione musicale generativa...");

        if (data.error) {
            const errDetail = data.attempted ? ` (Tentati ${data.attempted.length} endpoint)` : '';
            throw new Error((data.error || 'Errore server') + errDetail);
        }

        onProgress?.(95, "Finalizzazione Traccia", "Formattazione traccia audio generata...");

        const audioUrl = data.audio_url || data.url || data.audioUrl || data.output_url || data.audio || (data.data && (data.data.audio_url || data.data.url));

        if (!audioUrl) {
            if (data.id || data.job_id) {
                onProgress?.(100, "Richiesta Presa in Carico", "Soundverse ha preso in carico il job di sintesi.");
                return {
                    success: true,
                    audioUrl: data.audio_url || null,
                    raw: data
                };
            }
            throw new Error("Impossibile recuperare l'URL audio generato da Soundverse AI.");
        }

        onProgress?.(100, "Completato", "Traccia generata con successo!");
        return {
            success: true,
            audioUrl: audioUrl,
            raw: data
        };

    } catch (e: any) {
        console.error("Errore generazione Soundverse AI:", e);
        return {
            success: false,
            error: e.message || "Errore sconosciuto durante la generazione con Soundverse AI."
        };
    }
}
