import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE ---
export const USE_MOCK_BACKEND = false;
const API_BASE_URL = 'https://sonificart.com/api';

const STORAGE_KEYS = {
    TOKEN: 'sonificart_auth_token',
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
        // If we have a clean JSON error, throw only that. 
        // Otherwise prefix with technical info for actual server crashes.
        if (data) {
            throw new Error(errorMessage);
        } else {
            throw new Error(`Errore Server (${response.status}): ${text.substring(0, 120)}...`);
        }
    }

    return data;
};

export const api = {
    login: async (email: string, password: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await handleResponse(response);
        if (data.token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
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
        if (data.token && data.token !== 'undefined' && data.token !== 'null') {
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        }
        return data.user;
    },

    requestAccess: async (data: any): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        Object.keys(data).forEach(key => params.append(key, data[key]));
        if (token) params.append('auth_token', token);

        await fetch(`${API_BASE_URL}/index.php?action=request_access`, {
            method: 'POST',
            body: params
        });
    },

    checkSession: async (): Promise<User | null> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token || token === 'undefined' || token === 'null') {
            if (token) localStorage.removeItem(STORAGE_KEYS.TOKEN);
            return null;
        }
        try {
            // TRIPLE PASS authentication for maximum stability
            const url = `${API_BASE_URL}/index.php?action=check_session&auth_token=${encodeURIComponent(token)}`;
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
                localStorage.removeItem(STORAGE_KEYS.TOKEN);
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
                localStorage.removeItem(STORAGE_KEYS.TOKEN);
            } else {
                console.error("Network/Server error during checkSession. Holding token.", error);
            }
            return null;
        }
    },

    logout: async () => localStorage.removeItem(STORAGE_KEYS.TOKEN),

    consumeCredit: async (userId: string, cost: number) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        params.append('cost', cost.toString());
        if (token) params.append('auth_token', token);

        const url = `${API_BASE_URL}/index.php?action=consume_credits&auth_token=${encodeURIComponent(token || '')}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        const data = await handleResponse(response);
        return data.credits;
    },

    saveSonification: async (result: SonificationResult, paradigm: Paradigm, title?: string) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

        if (!token) {
            console.error("Save attempt failed: No auth token found in localStorage.");
            throw new Error("Sessione non valida o scaduta. Effettua nuovamente il login per salvare la tua opera.");
        }

        // Prepare FormData for Multipart Upload (Faster & Robust)
        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('imageHash', result.imageHash);
        formData.append('paradigm', paradigm);
        formData.append('traditionName', title || result.culturalSelectionResult.tradition.name);

        // JSON Fields
        formData.append('musicGenerationPrompt', JSON.stringify(result.musicGenerationPrompt));
        formData.append('configUsed', JSON.stringify(result.configUsed));
        formData.append('blockData', JSON.stringify(result.blockAnalysisResult));

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

            // Audio: Use existing Blob
            if (result.audioOutput.audioWavBlob) {
                formData.append('audioFile', result.audioOutput.audioWavBlob, "audio.wav");
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
            return data;
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (token) formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=upload_chunk`, {
            method: 'POST',
            body: formData,
        });
        return handleResponse(response);
    },

    publishFromHistory: async (entryId: string, metadata: any, customMedia: { url: string, type: string } | null) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const body = {
            entryId: entryId,
            metadata: metadata,
            customMediaUrl: customMedia?.url || null,
            customMediaType: customMedia?.type || null,
            auth_token: token
        };

        const response = await fetch(`${API_BASE_URL}/index.php?action=publish_history&auth_token=${encodeURIComponent(token || '')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await handleResponse(response);
    },

    updateProfile: async (data: { name?: string, email?: string, avatarUrl?: string, customLogoUrl?: string, password?: string }) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        Object.keys(data).forEach(key => params.append(key, (data as any)[key]));
        if (token) params.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=update_profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getHistory: async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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

    deleteHistoryItem: async (id: string) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=delete_history_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, auth_token: token })
        });
        await handleResponse(response);
    },

    getShowcase: async (includeAll: boolean = false) => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase${includeAll ? '&all=1' : ''}&t=${new Date().getTime()}`);
        return await handleResponse(response);
    },

    // --- ADMIN FUNCTIONS ---

    updateShowcaseItem: async (item: Partial<ShowcaseProject> & { id: string }) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);

        await fetch(`${API_BASE_URL}/index.php?action=delete_showcase_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    getAccessRequests: async (): Promise<any[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_get_requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    approveAccessRequest: async (id: string): Promise<any> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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

    getSystemStats: async (): Promise<SystemStats> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        if (token) params.append('auth_token', token);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return await handleResponse(response);
    },

    getUserInfo: async (id: string): Promise<Partial<User>> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_user_info&id=${id}`);
        return await handleResponse(response);
    },

    getAllUsers: async (): Promise<User[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const params = new URLSearchParams();
        params.append('id', id);
        if (token) params.append('auth_token', token);
        await fetch(`${API_BASE_URL}/index.php?action=delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
    },

    cleanAuthSession: () => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        window.location.reload();
    }
};