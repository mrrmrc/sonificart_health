import { api as backendApi } from './api';
import { blobToBase64 } from './audioUtils';

export type MusicProviderType = 'soundverse' | 'custom_webhook' | 'generic_rest';

export interface MusicAiProvider {
    id: string;
    name: string;
    type: MusicProviderType;
    apiKey: string;
    endpointUrl?: string;
    authHeaderName?: string;
    isDefault: boolean;
    description?: string;
    created_at?: string;
}

export interface MusicGenerationResponse {
    success: boolean;
    audioUrl?: string;
    error?: string;
    providerName?: string;
    raw?: any;
}

export type MusicProgressCallback = (
    pct: number,
    status: string,
    detail: string
) => void;

function getLocalAuthToken(): string {
    return localStorage.getItem('sonificart_auth_token') || sessionStorage.getItem('sonificart_auth_token') || '';
}

/**
 * Provider Soundverse predefinito
 */
export const DEFAULT_SOUNDVERSE_PROVIDER: MusicAiProvider = {
    id: 'provider_soundverse_default',
    name: 'Soundverse AI (Predefinito)',
    type: 'soundverse',
    apiKey: 'sksoundverse_ivOVxIp9fudT87xVfqjPUWIB7SHSis9QTRojifOh3k_rKyiz-g1iadzoCtH8GzQl',
    endpointUrl: 'https://apiv2.soundverse.ai/v7/generate/music',
    authHeaderName: 'Authorization',
    isDefault: true,
    description: 'Motore Soundverse AI originale (v7/v1)'
};

/**
 * Helper per chiamare in modo resiliente il backend PHP
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
                continue;
            }

            const text = await res.text();
            const trimmedText = text.trim();
            if (trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html') || trimmedText.includes('@context') || trimmedText.includes('<script')) {
                continue;
            }

            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch (e) {}

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
 * Carica l'elenco dei provider e identifica quello attivo
 */
export async function getMusicProviders(): Promise<{ providers: MusicAiProvider[]; activeProvider: MusicAiProvider }> {
    try {
        const rawJson = await backendApi.getAppSetting('music_ai_providers');
        const activeId = await backendApi.getAppSetting('active_music_ai_provider');
        
        let providers: MusicAiProvider[] = [];
        if (rawJson) {
            try {
                const cleaned = rawJson.replace(/<[^>]*>?/gm, '').trim();
                if (cleaned) {
                    providers = JSON.parse(cleaned);
                }
            } catch (e) {
                console.warn("Errore parsing music_ai_providers JSON:", e);
            }
        }

        if (!Array.isArray(providers) || providers.length === 0) {
            const dbSvKey = (await backendApi.getAppSetting('soundverse_api_key')).replace(/<[^>]*>?/gm, '').trim();
            providers = [{
                ...DEFAULT_SOUNDVERSE_PROVIDER,
                apiKey: dbSvKey || DEFAULT_SOUNDVERSE_PROVIDER.apiKey
            }];
        }

        let active = providers.find(p => p.id === activeId) || providers.find(p => p.isDefault) || providers[0];

        return { providers, activeProvider: active };
    } catch (e) {
        console.warn("Errore caricamento provider musica, uso fallback Soundverse:", e);
        return { providers: [DEFAULT_SOUNDVERSE_PROVIDER], activeProvider: DEFAULT_SOUNDVERSE_PROVIDER };
    }
}

/**
 * Salva l'elenco dei provider e imposta quello attivo
 */
export async function saveMusicProviders(providers: MusicAiProvider[], activeId: string): Promise<boolean> {
    try {
        const updatedProviders = providers.map(p => ({
            ...p,
            isDefault: p.id === activeId
        }));

        await backendApi.updateAppSetting('music_ai_providers', JSON.stringify(updatedProviders));
        await backendApi.updateAppSetting('active_music_ai_provider', activeId);

        const svProvider = updatedProviders.find(p => p.type === 'soundverse');
        if (svProvider && svProvider.apiKey) {
            await backendApi.updateAppSetting('soundverse_api_key', svProvider.apiKey);
        }

        return true;
    } catch (e) {
        console.error("Errore salvataggio provider musica:", e);
        throw e;
    }
}

/**
 * Testa la connettività di un provider specifico
 */
export async function testMusicProvider(provider: MusicAiProvider): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const res = await callPhpProxy('music_ai_test', { provider });
        return res;
    } catch (e: any) {
        return { success: false, error: e.message || "Test connessione fallito." };
    }
}

/**
 * Genera una traccia audio musicale usando il provider attivo (o specificato)
 */
export async function generateAiAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null,
    onProgress?: MusicProgressCallback,
    providerOverride?: MusicAiProvider
): Promise<MusicGenerationResponse> {
    const { activeProvider } = await getMusicProviders();
    const providerToUse = providerOverride || activeProvider;

    onProgress?.(5, `Inizializzazione Engine (${providerToUse.name})`, `Connessione al motore AI: ${providerToUse.name}...`);

    let audioBase64: string | null = null;
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

    onProgress?.(30, `Invio a ${providerToUse.name}`, `Trasmissione prompt e parametri a ${providerToUse.endpointUrl || providerToUse.name}...`);

    const data = await callPhpProxy('music_ai_generate', {
        provider: providerToUse,
        prompt: promptText,
        duration: durationSeconds,
        audio_base64: audioBase64,
        audioUrl: (audioWavUrl && !audioWavUrl.startsWith('blob:')) ? audioWavUrl : null
    });

    if (data.stepLog && Array.isArray(data.stepLog)) {
        for (const step of data.stepLog) {
            if (step.step === 'POLL') {
                onProgress?.(75, `In elaborazione (${step.status || 'polling'})`, `Attesa completamento traccia...`);
            }
        }
    }

    if (data.error || data.success === false) {
        throw new Error(data.error || `Errore generazione da ${providerToUse.name}`);
    }

    const isValidAudioUrlStr = (str: string): boolean => {
        if (typeof str !== 'string') return false;
        if (!str.startsWith('http://') && !str.startsWith('https://')) return false;
        if (str.includes('sonificart.com') || str.includes('schema.org')) return false;
        const lower = str.toLowerCase();
        return lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.ogg') || lower.includes('.flac') || lower.includes('.m4a') || lower.includes('.aac') || lower.includes('soundverse') || lower.includes('cdn') || lower.includes('audio') || lower.includes('media');
    };

    const findAudioUrl = (obj: any, depth: number = 0): string | null => {
        if (!obj || depth > 5) return null;
        if (typeof obj === 'string' && isValidAudioUrlStr(obj)) return obj;
        if (typeof obj !== 'object') return null;
        const priorityKeys = ['audio_url', 'audioUrl', 'output_url', 'audio', 'download_url', 'file_url', 'mp3_url', 'wav_url', 'url', 'src', 'source', 'link', 'path'];
        for (const key of priorityKeys) {
            if (obj[key] && isValidAudioUrlStr(obj[key])) return obj[key];
        }
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = findAudioUrl(item, depth + 1);
                if (found) return found;
            }
        } else {
            for (const key of Object.keys(obj)) {
                if (['stepLog', 'checkLog', 'raw', 'author', 'offers', '@context'].includes(key)) continue;
                const found = findAudioUrl(obj[key], depth + 1);
                if (found) return found;
            }
        }
        return null;
    };

    let audioUrl = data.audio_url || data.url || data.audioUrl || data.output_url || data.audio || (data.data && (data.data.audio_url || data.data.url));
    if (!audioUrl) {
        audioUrl = findAudioUrl(data);
    }

    if (!audioUrl) {
        throw new Error(`Impossibile recuperare l'URL audio restituito da ${providerToUse.name}.`);
    }

    onProgress?.(100, "✅ Completato", `Traccia generata con successo da ${providerToUse.name}!`);

    return {
        success: true,
        audioUrl,
        providerName: providerToUse.name,
        raw: data
    };
}
