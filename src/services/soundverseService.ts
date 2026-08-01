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

export async function generateSoundverseAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null
): Promise<SoundverseGenerationResponse> {
    const apiKey = await getSoundverseApiKey();

    let audioBase64: string | null = null;

    try {
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

        const response = await fetch('/api/index.php?action=soundverse_generate', {
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

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || `Errore server (${response.status})`);
        }

        const audioUrl = data.audio_url || data.url || data.audioUrl || data.output_url || data.audio || (data.data && (data.data.audio_url || data.data.url));

        if (!audioUrl) {
            if (data.id || data.job_id) {
                return {
                    success: true,
                    audioUrl: data.audio_url || null,
                    raw: data
                };
            }
            throw new Error("Impossibile recuperare l'URL audio generato da Soundverse AI.");
        }

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
