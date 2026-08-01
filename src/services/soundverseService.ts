import { api as backendApi } from './api';
import { blobToBase64 } from './audioUtils';

const DEFAULT_SOUNDVERSE_KEY = "sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl";

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

export async function generateSoundverseAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null,
    onProgress?: SoundverseProgressCallback
): Promise<SoundverseGenerationResponse> {
    onProgress?.(10, "Inizializzazione", "Verifica API Key Soundverse e parametri clinici...");
    const apiKey = await getSoundverseApiKey();

    let audioBase64: string | null = null;

    try {
        onProgress?.(25, "Elaborazione Audio WAV", "Conversione della linea melodica in formato base64...");
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

        onProgress?.(50, "Invio a Server & Proxy API", "Caricamento riferimento WAV sul server e connessione a Soundverse AI...");

        const candidatePhpUrls = [
            '/api/index.php?action=soundverse_generate',
            'api/index.php?action=soundverse_generate',
            'index.php?action=soundverse_generate',
            'backend/index.php?action=soundverse_generate'
        ];

        let response: Response | null = null;
        let fetchErr: any = null;

        for (const phpUrl of candidatePhpUrls) {
            try {
                const res = await fetch(phpUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: apiKey,
                        prompt: promptText,
                        duration: durationSeconds,
                        audio_base64: audioBase64,
                        audioUrl: (audioWavUrl && !audioWavUrl.startsWith('blob:')) ? audioWavUrl : null
                    })
                });

                if (res.ok || res.status !== 404) {
                    response = res;
                    break;
                }
            } catch (err) {
                fetchErr = err;
            }
        }

        if (!response) {
            throw new Error(`Impossibile raggiungere il server PHP proxy. ${fetchErr?.message || ''}`);
        }

        onProgress?.(80, "Sintesi Neurale Soundverse AI", "Analisi risposta dai server Soundverse...");

        const data = await response.json();

        if (!response.ok || data.error) {
            const errDetail = data.attempted ? ` (Tentati ${data.attempted.length} endpoint)` : '';
            throw new Error((data.error || `Errore server (${response.status})`) + errDetail);
        }

        onProgress?.(95, "Finalizzazione Traccia", "Formattazione output audio...");

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
