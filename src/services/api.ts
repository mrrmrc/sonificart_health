import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm, StemMapping } from '../types';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE ---
export const USE_MOCK_BACKEND = false;
// Relativo all'origine del sito: funziona su qualsiasi dominio dove viene servito
// il frontend, purché il backend PHP stia nella cartella /api della stessa web root.
const API_BASE_URL = '/api';

const STORAGE_KEYS = {
    TOKEN: 'sonificart_auth_token',
};

// --- AUTH HELPERS ---
const getToken = (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || sessionStorage.getItem(STORAGE_KEYS.TOKEN);
};

const setAuthToken = (token: string, remember: boolean) => {
    if (remember) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    } else {
        sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
};

const clearAuthToken = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
};

const handleResponse = async (response: Response) => {
    if (response.status === 413) {
        throw new Error("File troppo grande (Errore 413). Il server ha rifiutato l'upload. Riduci la durata o contatta l'assistenza per aumentare il limite di upload.");
    }

    const text = await response.text();
    let data: any = null;

    try {
        data = JSON.parse(text);
    } catch (e) {
        // Resilience: try to extract JSON if response is mangled
        const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
            try { data = JSON.parse(match[0]); } catch (inner) { /* ignore */ }
        }
    }

    if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Errore ${response.status}`;
        if (data) {
            throw new Error(errorMessage);
        } else {
            throw new Error(`Errore Server (${response.status}): ${text.substring(0, 120)}...`);
        }
    }

    // New: If status is OK but data is null (parsing failed), throw valid error with text
    if (!data) {
        console.warn("Server responded with non-JSON:", text);
        // If response is empty, it might be a silent success but it's risky to assume.
        // Let's return a success object if empty, OR throw if it looks like an error.
        if (!text.trim()) return { success: true }; // Assume empty 200 OK is success

        // Otherwise throw with content
        throw new Error(`Risposta Server Non Valida: ${text.substring(0, 100)}`);
    }

    return data;
};

export const api = {
    login: async (email: string, password: string, rememberMe: boolean = false): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await handleResponse(response);
        const receivedToken = data.token || data.auth_token;
        if (receivedToken && receivedToken !== 'undefined' && receivedToken !== 'null') {
            setAuthToken(receivedToken, rememberMe);
        } else if (data.user && data.user.token) {
            setAuthToken(data.user.token, rememberMe);
        }
        return data.user;
    },

    register: async (name: string, email: string, password: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await handleResponse(response);
        const receivedToken = data.token || data.auth_token;
        if (receivedToken && receivedToken !== 'undefined' && receivedToken !== 'null') {
            setAuthToken(receivedToken, true);
        } else if (data.user && data.user.token) {
            setAuthToken(data.user.token, true);
        }
        return data.user;
    },

    requestAccess: async (data: any): Promise<void> => {
        const token = getToken();
        const params = new URLSearchParams();
        Object.keys(data).forEach(key => params.append(key, data[key]));
        if (token) params.append('auth_token', token);

        await fetch(`${API_BASE_URL}/index.php?action=request_access`, {
            method: 'POST',
            body: params
        });
    },

    checkSession: async (): Promise<User | null> => {
        const token = getToken();
        if (!token || token === 'undefined' || token === 'null') {
            if (token) clearAuthToken();
            return null;
        }
        try {
            // TRIPLE PASS authentication for maximum stability (now DOUBLE PASS to avoid HPP blocks)
            const url = `${API_BASE_URL}/index.php?action=check_session`;
            const params = new URLSearchParams();
            params.append('auth_token', token);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });
            const data = await handleResponse(response);
            if (!data.user) {
                console.warn("Session check returned no user, clearing token.");
                clearAuthToken();
                return null;
            }
            return data.user;
        } catch (error) {
            const msg = error instanceof Error ? error.message : "";
            const lowercaseMsg = msg.toLowerCase();

            // Definitive authentication failures
            if (lowercaseMsg.includes("unauthorized") ||
                lowercaseMsg.includes("not found") ||
                lowercaseMsg.includes("credenziali") ||
                lowercaseMsg.includes("invalid token")) {
                console.warn("Session check definitively failed, clearing token:", msg);
                clearAuthToken();
            } else {
                console.error("Network/Server error during checkSession. Holding token.", error);
            }
            return null;
        }
    },

    logout: async () => clearAuthToken(),

    consumeCredit: async (userId: string, cost: number) => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('cost', cost.toString());
        if (token) params.append('auth_token', token);

        const url = `${API_BASE_URL}/index.php?action=consume_credits&auth_token=${encodeURIComponent(token || '')}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`
            },
            body: params
        });
        const data = await handleResponse(response);
        return data.credits;
    },

    saveSonification: async (result: SonificationResult, paradigm: Paradigm, title?: string, description?: string) => {
        const token = getToken();

        if (!token) {
            console.error("Save attempt failed: No auth token found in localStorage.");
            throw new Error("Sessione non valida o scaduta. Effettua nuovamente il login per salvare la tua opera.");
        }

        // Prepare FormData for Multipart Upload (Faster & Robust)
        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('imageHash', result.imageHash);
        formData.append('paradigm', paradigm);
        const validTitle = (title && title.trim().length > 0) ? title : `Opera del ${new Date().toLocaleDateString()}`;
        formData.append('title', validTitle);
        if (description) formData.append('description', description); // NEW
        formData.append('traditionName', result.culturalSelectionResult.tradition.name);

        // JSON Fields
        formData.append('musicGenerationPrompt', JSON.stringify(result.musicGenerationPrompt));
        formData.append('configUsed', JSON.stringify(result.configUsed));
        formData.append('blockData', JSON.stringify(result.blockAnalysisResult));
        if (result.healthClassification) {
            formData.append('healthClassification', JSON.stringify(result.healthClassification));
        }

        // Extended Metadata for Restore
        if (result.audioHash) formData.append('audioHash', result.audioHash);
        if (result.acquisitionMetadata) formData.append('acquisitionMetadata', JSON.stringify(result.acquisitionMetadata));
        if (result.validationHashes) formData.append('validationHashes', JSON.stringify(result.validationHashes));

        // Optimize Events
        const compressedEvents = result.audioOutput.events.map(e => [
            Number(e.time.toFixed(3)),
            Number(e.duration.toFixed(3)),
            Number(e.midiFloat.toFixed(2)),
            Math.round(e.velocity),
            e.sourceBlock?.position.x ?? -1,
            e.sourceBlock?.position.y ?? -1,
            e.noteName
        ]);
        formData.append('events', JSON.stringify(compressedEvents));

        // Files
        try {
            // Image: Convert DataURL/URL to Blob
            const imgRes = await fetch(result.standardizedImageUrl);
            const imgBlob = await imgRes.blob();
            formData.append('imageFile', imgBlob, "image.jpg");

            // Audio: Use existing Blob - Save to ORIGINAL audio field (immutable)
            if (result.audioOutput.audioWavBlob) {
                formData.append('audioFile', result.audioOutput.audioWavBlob, "audio.wav");
                formData.append('saveToOriginalAudio', 'true'); // Flag for backend to save to original_audio_url
            }
        } catch (e) {
            console.error("Error preparing blobs for upload", e);
            throw new Error("Errore nella preparazione dei file per l'upload.");
        }

        const urlWithToken = `${API_BASE_URL}/index.php?action=save_sonification&auth_token=${encodeURIComponent(token)}`;

        try {
            console.log("Attempting full save...", result.imageHash);
            const response = await fetch(urlWithToken, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });
            const data = await handleResponse(response);
            if (!data.success) throw new Error(data.error || "Salvataggio incompleto (Server Error).");
            return data; // returns { success: true, id: "..." }
        } catch (error) {
            console.warn("Salvataggio Full fallito (probabilmente limiti upload o timeout), tento salvataggio Lite (no audio)...", error);

            // Re-prepare formData without audio for Lite attempt
            formData.delete('audioFile');

            try {
                const responseLite = await fetch(urlWithToken, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData,
                });
                const dataLite = await handleResponse(responseLite);
                if (!dataLite.success) throw new Error(dataLite.error || "Salvataggio Lite fallito.");
                return dataLite;
            } catch (liteError) {
                console.error("Anche il salvataggio Lite è fallito.", liteError);
                if (liteError instanceof Error && (liteError.message.includes("401") || liteError.message.toLowerCase().includes("unauthorized"))) {
                    throw new Error("Errore di autenticazione (401). Prova a fare logout e rientrare.");
                }
                throw new Error("Impossibile salvare l'opera. Verifica la connessione o contatta l'assistenza.");
            }
        }
    },

    uploadChunk: async (formData: FormData): Promise<any> => {
        const token = getToken();
        if (token) formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=upload_chunk`, {
            method: 'POST',
            body: formData,
        });
        return handleResponse(response);
    },

    attachVideoToHistory: async (entryId: string, videoBlob: Blob, fileName: string = "generated_video.mp4", onProgress?: (p: number) => void): Promise<string> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const file = new File([videoBlob], fileName, { type: videoBlob.type });
        let finalUrl = "";

        // 1. CHUNKED UPLOAD STRATEGY (for files > 2MB)
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        if (totalChunks > 1) {
            console.log(`Starting chunked upload for ${fileName} (${totalChunks} chunks)`);
            const uploadId = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '')}`;

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk_data', chunk, fileName);
                formData.append('upload_session_id', uploadId);
                formData.append('chunk_index', String(i));
                formData.append('total_chunks', String(totalChunks));
                formData.append('file_ext', fileName.split('.').pop() || 'mp4');
                if (token) formData.append('auth_token', token);

                // Manual fetch to upload_chunk endpoint
                const response = await fetch(`${API_BASE_URL}/index.php?action=upload_chunk`, {
                    method: 'POST',
                    body: formData
                });
                const data = await handleResponse(response);
                if (data.success && data.url) {
                    finalUrl = data.url; // Last chunk returns URL
                }

                if (onProgress) {
                    const percent = Math.round(((i + 1) / totalChunks) * 100);
                    onProgress(percent);
                }
            }
        }

        // 2. ATTACH TO HISTORY
        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('entryId', entryId);

        if (finalUrl) {
            formData.append('videoUrl', finalUrl); // Pass the URL we just got
        } else {
            // If small enough, or chunking failed/skipped, send file directly
            formData.append('videoFile', file);
        }

        const response = await fetch(`${API_BASE_URL}/index.php?action=attach_video_to_history`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.videoUrl;
    },

    detachVideoFromHistory: async (entryId: string): Promise<boolean> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('id', entryId);

        const response = await fetch(`${API_BASE_URL}/index.php?action=detach_video_from_history`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.success;
    },

    generateVideoServer: async (entryId: string): Promise<any> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('entryId', entryId);

        const response = await fetch(`${API_BASE_URL}/index.php?action=generate_video_ffmpeg`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data; // Returns { success: true, status: 'processing', jobId: ... }
    },

    checkGenerationStatus: async (entryId: string): Promise<{ status: string, videoUrl?: string, error?: string, message?: string }> => {
        const token = getToken();
        const formData = new FormData();
        formData.append('entryId', entryId);
        if (token) formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=check_generation_status`, {
            method: 'POST',
            body: formData
        });
        return await handleResponse(response);
    },

    // --- ATTACH AUDIO TO HISTORY (NEW) ---
    updateHistoryItemConfig: async (id: string, config: any): Promise<boolean> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('id', id);
        formData.append('configUsed', JSON.stringify(config));

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_history_item`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.success;
    },

    // Update title/description for a history item (accessible to PRO users, unlike admin-only updateMetadata)
    updateHistoryItemMetadata: async (id: string, title: string, subtitle: string, description: string): Promise<boolean> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('id', id);
        formData.append('title', title);
        formData.append('subtitle', subtitle);
        formData.append('description', description);

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_history_item`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        const data = await handleResponse(response);
        return data.success;
    },

    attachAudioToHistory: async (entryId: string, audioBlob: Blob, fileName: string = "uploaded_audio.mp3", onProgress?: (p: number) => void): Promise<string> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const file = new File([audioBlob], fileName, { type: audioBlob.type });
        let finalUrl = "";

        // 1. Chunked Upload for Large Audio
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        if (totalChunks > 1) {
            const uploadId = `aud-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]/g, '')}`;
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk_data', chunk, fileName);
                formData.append('upload_session_id', uploadId);
                formData.append('chunk_index', String(i));
                formData.append('total_chunks', String(totalChunks));
                formData.append('file_ext', fileName.split('.').pop() || 'mp3');
                if (token) formData.append('auth_token', token);

                const response = await fetch(`${API_BASE_URL}/index.php?action=upload_chunk`, {
                    method: 'POST',
                    body: formData
                });
                const data = await handleResponse(response);
                if (data.success && data.url) finalUrl = data.url;

                if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));
            }
        }

        // 2. Attach
        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('entryId', entryId);
        if (finalUrl) {
            formData.append('audioUrl', finalUrl);
        } else {
            formData.append('audioFile', file);
        }

        const response = await fetch(`${API_BASE_URL}/index.php?action=attach_audio_to_history`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.audioUrl;
    },

    publishFromHistory: async (entryId: string, metadata: any, customMedia: { url: string, type: string } | null) => {
        const token = getToken();
        const body = {
            entryId: entryId,
            metadata: metadata,
            customMediaUrl: customMedia?.url || null,
            customMediaType: customMedia?.type || null,
            auth_token: token
        };

        const response = await fetch(`${API_BASE_URL}/index.php?action=publish_history&auth_token=${encodeURIComponent(token || '')}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        return await handleResponse(response);
    },

    updateProfile: async (data: { name?: string, email?: string, avatarUrl?: string, customLogoUrl?: string, password?: string }) => {
        const token = getToken();
        const params = new URLSearchParams();
        Object.keys(data).forEach(key => params.append(key, (data as any)[key]));
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`
            },
            body: params
        });
        return await handleResponse(response);
    },

    getHistory: async () => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const url = `${API_BASE_URL}/index.php?action=get_history&auth_token=${encodeURIComponent(token)}&t=${new Date().getTime()}`;

        // TRIPLE PASS: URL, Header, and Body
        const params = new URLSearchParams();
        params.append('auth_token', token);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });
            return await handleResponse(response);
        } catch (e) {
            // Robust Fallback: try GET with token in URL and Header if POST feels too heavy (413) or fails
            console.warn("History POST failed, attempting GET fallback...", e);
            const getResponse = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await handleResponse(getResponse);
        }
    },

    // Lazy load full details for a single history item (including heavy JSON fields)
    getHistoryItem: async (id: string): Promise<DashboardEntry> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");

        const params = new URLSearchParams();
        params.append('auth_token', token);
        params.append('id', id);

        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    deleteHistoryItem: async (id: string) => {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/index.php?action=delete_history_item`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, auth_token: token })
        });
        await handleResponse(response);
    },

    // Upload custom/elaborated audio (Suno, Udio, etc.) - This does NOT overwrite the original sonification audio
    uploadHistoryAudio: async (id: string, file: File): Promise<string> => {
        const token = getToken();
        const formData = new FormData();
        formData.append('entryId', id);
        formData.append('audioFile', file);
        formData.append('saveToCustomAudio', 'true'); // Flag for backend: save to audioUrl (custom), NOT originalAudioUrl
        if (token) formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=attach_audio_to_history`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.audioUrl;
    },

    // --- DYNAMIC STEM ENGINE API ---
    uploadHistoryStems: async (id: string, files: File[]): Promise<string[]> => {
        const token = getToken();
        const formData = new FormData();
        formData.append('entryId', id);
        files.forEach((file, index) => {
            formData.append(`stems[]`, file);
        });
        if (token) formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=upload_history_stems`, {
            method: 'POST',
            body: formData
        });
        const data = await handleResponse(response);
        return data.stemUrls; // Backend should return array of relative URLs
    },

    updateHistoryItemStemsMapping: async (id: string, mappings: StemMapping[]): Promise<void> => {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/index.php?action=update_stems_mapping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, mappings, auth_token: token })
        });
        await handleResponse(response);
    },

    getShowcase: async (includeAll: boolean = false) => {
        const token = getToken();
        let url = `${API_BASE_URL}/index.php?action=get_showcase${includeAll ? '&all=1' : ''}&t=${new Date().getTime()}`;
        if (token) {
            url += `&auth_token=${token}`;
        }
        const response = await fetch(url);
        return await handleResponse(response);
    },

    // --- ADMIN FUNCTIONS ---

    updateShowcaseItem: async (item: Partial<ShowcaseProject> & { id: string }) => {
        const token = getToken();
        const params = new URLSearchParams();
        Object.keys(item).forEach(key => params.append(key, (item as any)[key]));
        if (token) params.append('auth_token', token);

        await fetch(`${API_BASE_URL}/index.php?action=update_showcase_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    deleteShowcaseItem: async (id: string) => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=delete_showcase_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        await handleResponse(response);
    },

    getAccessRequests: async (): Promise<any[]> => {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_get_requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    approveAccessRequest: async (id: string): Promise<any> => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_approve_request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return handleResponse(response);
    },

    rejectAccessRequest: async (id: string): Promise<any> => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_reject_request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return handleResponse(response);
    },

    updateAccessRequest: async (id: string, field: string, value: boolean): Promise<any> => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('id', id);
        params.append('field', field);
        params.append('value', value.toString());
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_update_request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return handleResponse(response);
    },

    uploadAgentDocument: async (file: File): Promise<string> => {
        const token = getToken();
        if (!token) throw new Error("Non autenticato");

        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = `${Date.now()}_agentdoc`;
        let finalUrl = "";

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('chunk_data', chunk, file.name);
            formData.append('upload_session_id', uploadId);
            formData.append('chunk_index', String(i));
            formData.append('total_chunks', String(totalChunks));
            formData.append('file_ext', 'pdf');
            if (token) formData.append('auth_token', token);

            const response = await fetch(`${API_BASE_URL}/index.php?action=upload_chunk`, {
                method: 'POST',
                body: formData
            });

            const data = await handleResponse(response);
            if (i === totalChunks - 1) {
                if (data.fileUrl) {
                    finalUrl = window.location.origin + data.fileUrl; // convert relative to absolute
                } else if (data.url) {
                    finalUrl = data.url;
                }
            }
        }
        return finalUrl;
    },

    updateMetadata: async (id: string, title: string, subtitle: string, description: string): Promise<void> => {
        const token = getToken();
        if (!token) throw new Error("Non autenticato");

        const data = new FormData();
        data.append('auth_token', token);
        data.append('id', id);
        data.append('title', title);
        data.append('subtitle', subtitle);
        data.append('description', description);

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_metadata`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: data
        });
        await handleResponse(response);
    },

    logEvent: async (action: string, details?: string) => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('evt_action', action);
        if (details) params.append('evt_details', details);
        if (token) params.append('auth_token', token);

        // Fire and forget - no await on handleResponse
        fetch(`${API_BASE_URL}/index.php?action=log_event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        }).catch(err => console.error("Log error", err));
    },

    getSystemStats: async (): Promise<SystemStats> => {
        const token = getToken();
        const params = new URLSearchParams();
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getSystemLogs: async (): Promise<SystemLog[]> => {
        const token = getToken();
        const params = new URLSearchParams();
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getDbTables: async (): Promise<string[]> => {
        const token = getToken();
        const params = new URLSearchParams();
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_db_tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getDbTableContent: async (table: string): Promise<{ columns: string[], rows: any[] }> => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('table', table);
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_table_content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    adminUpdateCell: async (table: string, id: string, column: string, value: any): Promise<void> => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('table', table);
        params.append('id', id);
        params.append('column', column);
        params.append('value', value === null ? 'NULL' : String(value));
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_update_table_row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        await handleResponse(response);
    },

    getUserInfo: async (id: string): Promise<Partial<User>> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_user_info&id=${id}`);
        return await handleResponse(response);
    },

    getAllUsers: async (): Promise<User[]> => {
        const token = getToken();
        const params = new URLSearchParams();
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    adminCreateUser: async (u: any) => {
        const token = getToken();
        const params = new URLSearchParams();
        Object.keys(u).forEach(key => params.append(key, u[key]));
        if (token) params.append('auth_token', token);
        await fetch(`${API_BASE_URL}/index.php?action=admin_create_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    updateUser: async (u: any) => {
        const token = getToken();
        const params = new URLSearchParams();
        Object.keys(u).forEach(key => params.append(key, u[key]));
        if (token) params.append('auth_token', token);
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    deleteUser: async (id: string) => {
        const token = getToken();
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);
        await fetch(`${API_BASE_URL}/index.php?action=delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    impersonateUser: async (id: string): Promise<{ token: string, user: User }> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");
        const params = new URLSearchParams();
        params.append('auth_token', token);
        params.append('id', id);

        const response = await fetch(`${API_BASE_URL}/index.php?action=impersonate_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getPublicProfile: async (id: string) => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_public_profile&id=${id}`);
        return await handleResponse(response);
    },

    getAppSetting: async (key: string): Promise<string> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_app_setting&key=${key}`);
        const data = await handleResponse(response);
        return data.content;
    },

    updateAppSetting: async (key: string, content: string): Promise<void> => {
        const token = getToken();
        if (!token) throw new Error("Unauthorized");
        const params = new URLSearchParams();
        params.append('auth_token', token);
        params.append('key', key);
        params.append('content', content);

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_app_setting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        await handleResponse(response);
    },

    getPrivacyPolicy: async (): Promise<string> => {
        return api.getAppSetting('privacy_policy');
    },

    updatePrivacyPolicy: async (content: string): Promise<void> => {
        return api.updateAppSetting('privacy_policy', content);
    },

    cleanAuthSession: () => {
        clearAuthToken();
        window.location.reload();
    },



    getWhoAgentConfig: async (): Promise<any> => {
        try {
            const content = await api.getAppSetting('who_agent_config');
            if (content) return JSON.parse(content);
        } catch (e) { console.error("Error loading who_agent_config", e); }
        return null;
    },

    updateWhoAgentConfig: async (config: any): Promise<void> => {
        return api.updateAppSetting('who_agent_config', JSON.stringify(config));
    },

    logCookieConsent: async (prefs: { analytics: boolean, marketing: boolean }, uuid: string) => {
        const token = getToken();
        await fetch(`${API_BASE_URL}/index.php?action=log_cookie_consent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...prefs, uuid, auth_token: token })
        }).catch(err => console.error("Cookie log error", err));
    },

    getCookieLogs: async (): Promise<any[]> => {
        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_cookie_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    }
};