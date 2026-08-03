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

export async function generateSoundverseAudioTrack(
    promptText: string,
    durationSeconds: number = 60,
    audioWavBlob?: Blob | null,
    audioWavUrl?: string | null,
    onProgress?: SoundverseProgressCallback
): Promise<SoundverseGenerationResponse> {
    onProgress?.(5, "Pre-Flight Handshake API", "Verifica REALE di connettività ed autenticazione con Soundverse...");
    
    const apiKey = await getSoundverseApiKey();

    const checkRes = await checkSoundverseApi(apiKey);
    if (!checkRes.success) {
        // Mostra dettagli diagnostici del pre-flight reale
        const checkDetail = checkRes.checkLog
            ? checkRes.checkLog.map((l: any) => `[${l.url || ''}] → HTTP ${l.code || '?'} ${l.err || 'OK'}`).join(' | ')
            : '';
        const errorMsg = `Pre-Flight Fallito: ${checkRes.error || 'API Key non valida'}${checkDetail ? '\n\nDettagli: ' + checkDetail : ''}`;
        onProgress?.(10, "❌ Pre-Flight FALLITO", errorMsg);
        throw new Error(errorMsg);
    }

    onProgress?.(15, "✅ API Verificata (Check Reale)", `Credenziali verificate con successo. ${checkRes.message || ''} Avvio elaborazione audio...`);

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

        onProgress?.(50, "Invio a Soundverse AI", "Trasmissione prompt e parametri agli endpoint API aggiornati (v7/v1)...");

        const data = await callPhpProxy('soundverse_generate', {
            apiKey: apiKey,
            prompt: promptText,
            duration: durationSeconds,
            audio_base64: audioBase64,
            audioUrl: (audioWavUrl && !audioWavUrl.startsWith('blob:')) ? audioWavUrl : null
        });

        // === DEBUG: Log completo della risposta backend per diagnostica ===
        console.log('[Soundverse] Risposta completa dal backend:', JSON.stringify(data, null, 2));
        if (data.stepLog) {
            console.log('[Soundverse] StepLog:', data.stepLog);
        }

        // --- Log dettagliato di ogni step dal backend ---
        if (data.stepLog && Array.isArray(data.stepLog)) {
            for (const step of data.stepLog) {
                switch (step.step) {
                    case 'ATTEMPT':
                        onProgress?.(55, `🔄 Tentativo: ${step.endpoint}`, `Connessione a ${step.url}...`);
                        break;
                    case 'RESPONSE': {
                        const emoji = (step.httpCode >= 200 && step.httpCode < 300) ? '✅' : (step.httpCode === 401 || step.httpCode === 403) ? '🔒' : '❌';
                        onProgress?.(60, `${emoji} ${step.endpoint}: HTTP ${step.httpCode}`, step.curlError || step.responsePreview?.substring(0, 100) || '');
                        break;
                    }
                    case 'AUTH_FAIL':
                        onProgress?.(60, "🔒 Autenticazione Fallita", step.detail || 'API Key rifiutata');
                        break;
                    case 'SUCCESS':
                        onProgress?.(65, `✅ ${step.endpoint}`, step.detail || 'Risposta positiva');
                        break;
                    case 'JOB_CREATED':
                        onProgress?.(70, "🔄 Job Asincrono Creato", `Job ID: ${step.jobId} — In attesa elaborazione Soundverse...`);
                        break;
                    case 'POLL': {
                        const pct = Math.min(70 + (step.attempt || 0) * 1, 90);
                        onProgress?.(pct, `🔄 Polling #${step.attempt}`, `Stato: ${step.status || 'in elaborazione'}...`);
                        break;
                    }
                    case 'POLL_COMPLETE':
                        onProgress?.(92, "✅ Generazione Completata", step.detail || 'Audio pronto');
                        break;
                    case 'JOB_FAILED':
                        onProgress?.(75, "❌ Job Fallito", step.detail || 'Errore sconosciuto');
                        break;
                    case 'POLL_TIMEOUT':
                        onProgress?.(80, "⏰ Timeout Polling", step.detail || 'Elaborazione non completata nel tempo previsto');
                        break;
                    case 'ENDPOINT_FAIL':
                        onProgress?.(55, `❌ ${step.endpoint}: HTTP ${step.httpCode}`, step.detail || '');
                        break;
                    case 'CURL_ERROR':
                        onProgress?.(55, `❌ Errore Connessione: ${step.endpoint}`, step.detail || '');
                        break;
                }
            }
        }

        // Controlla errore nella risposta
        if (data.error || data.success === false) {
            const stepCount = data.stepLog ? data.stepLog.length : 0;
            const errMsg = data.error || 'Errore server Soundverse';
            throw new Error(`${errMsg} (${stepCount} step diagnostici eseguiti)`);
        }

        onProgress?.(95, "Finalizzazione Traccia", "Formattazione traccia audio generata...");

        const isValidAudioUrlStr = (str: string): boolean => {
            if (typeof str !== 'string') return false;
            if (!str.startsWith('http://') && !str.startsWith('https://')) return false;
            if (str.includes('sonificart.com') || str.includes('schema.org')) return false;
            const lower = str.toLowerCase();
            return lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.ogg') || lower.includes('.flac') || lower.includes('.m4a') || lower.includes('.aac') || lower.includes('soundverse') || lower.includes('cdn') || lower.includes('audio') || lower.includes('media');
        };

        // --- Estrazione robusta dell'URL audio (cerca in profondità nella risposta) ---
        const findAudioUrl = (obj: any, depth: number = 0): string | null => {
            if (!obj || depth > 5) return null;
            if (typeof obj === 'string' && isValidAudioUrlStr(obj)) {
                return obj;
            }
            if (typeof obj !== 'object') return null;
            
            // Campi prioritari da controllare
            const priorityKeys = ['audio_url', 'audioUrl', 'output_url', 'audio', 'download_url', 'file_url', 'mp3_url', 'wav_url', 'url', 'src', 'source', 'link', 'path'];
            for (const key of priorityKeys) {
                if (obj[key] && isValidAudioUrlStr(obj[key])) {
                    return obj[key];
                }
            }
            
            // Cerca ricorsivamente in sotto-oggetti e array
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = findAudioUrl(item, depth + 1);
                    if (found) return found;
                }
            } else {
                for (const key of Object.keys(obj)) {
                    if (['stepLog', 'checkLog', 'raw', 'author', 'offers', '@context'].includes(key)) continue; // Skip diagnostic & metadata fields
                    const found = findAudioUrl(obj[key], depth + 1);
                    if (found) return found;
                }
            }
            return null;
        };

        // Prima prova i campi noti, poi ricerca profonda
        let audioUrl = data.audio_url || data.url || data.audioUrl || data.output_url || data.audio || (data.data && (data.data.audio_url || data.data.url));
        
        if (!audioUrl) {
            console.log('[Soundverse] URL non trovato nei campi standard, ricerca profonda...');
            audioUrl = findAudioUrl(data);
            if (audioUrl) {
                console.log('[Soundverse] URL trovato con ricerca profonda:', audioUrl);
            }
        }

        // Cerca anche job_id in profondità
        const findJobId = (obj: any): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of ['job_id', 'id', 'task_id', 'generation_id', 'request_id']) {
                if (obj[key] && typeof obj[key] === 'string') return obj[key];
            }
            if (obj.data && typeof obj.data === 'object') return findJobId(obj.data);
            return null;
        };

        if (!audioUrl) {
            const jobId = findJobId(data);
            if (jobId) {
                onProgress?.(100, "Richiesta Presa in Carico", `Soundverse ha preso in carico il job (ID: ${jobId}). Controlla la dashboard Soundverse.`);
                return {
                    success: true,
                    audioUrl: undefined,
                    raw: data
                };
            }
            
            // Log dettagliato per debug: mostra le chiavi della risposta
            const dataKeys = Object.keys(data).filter(k => !['stepLog', 'checkLog'].includes(k));
            console.error('[Soundverse] Nessun URL audio e nessun job_id trovato. Chiavi risposta:', dataKeys, 'Dati:', JSON.stringify(data, null, 2));
            throw new Error(`Impossibile recuperare l'URL audio. Chiavi nella risposta: [${dataKeys.join(', ')}]. Controlla la Console per la risposta completa.`);
        }

        onProgress?.(100, "✅ Completato", "Traccia generata con successo!");
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
