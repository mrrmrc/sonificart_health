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
    try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || data.message || `HTTP Error ${response.status}`);
        return data;
    } catch (e) {
        if (e instanceof Error && e.message.includes("File troppo grande")) throw e;
        console.error("Server Error Response:", text);
        // Fallback for non-JSON errors (e.g. PHP Fatal Error HTML)
        throw new Error(`Errore Server (${response.status}): ${text.substring(0, 100)}...`);
    }
};

export const api = {
    login: async (email: string, password: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await handleResponse(response);
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        return data.user;
    },

    register: async (name: string, email: string, password: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
        const data = await handleResponse(response);
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        return data.user;
    },

    requestAccess: async (data: any): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=request_access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, auth_token: token })
        });
    },

    checkSession: async (): Promise<User | null> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return null;
        try {
            const response = await fetch(`${API_BASE_URL}/index.php?action=check_session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token }) });
            const data = await handleResponse(response);
            return data.user;
        } catch { return null; }
    },

    logout: async () => localStorage.removeItem(STORAGE_KEYS.TOKEN),

    consumeCredit: async (userId: string, cost: number) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=consume_credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost, auth_token: token }) });
        const data = await handleResponse(response);
        return data.credits;
    },

    saveSonification: async (result: SonificationResult, paradigm: Paradigm) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

        // Prepare FormData for Multipart Upload (Faster & Robust)
        const formData = new FormData();
        formData.append('auth_token', token || '');
        formData.append('imageHash', result.imageHash);
        formData.append('paradigm', paradigm);
        formData.append('traditionName', result.culturalSelectionResult.tradition.name);

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

        try {
            const response = await fetch(`${API_BASE_URL}/index.php?action=save_sonification&auth_token=${encodeURIComponent(token || '')}`, {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData,
            });
            const data = await handleResponse(response);
            if (!data.success) throw new Error(data.error || "Salvataggio incompleto (Server Error).");
        } catch (error) {
            console.warn("Salvataggio Full fallito, tento salvataggio Lite (no audio)...", error);
            formData.delete('audioFile');

            try {
                const responseLite = await fetch(`${API_BASE_URL}/index.php?action=save_sonification&auth_token=${encodeURIComponent(token || '')}`, {
                    method: 'POST',
                    headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                    body: formData,
                });
                const dataLite = await handleResponse(responseLite);
                if (!dataLite.success) throw new Error(dataLite.error || "Salvataggio Lite fallito.");
                alert("Nota: Il file audio era troppo grande per il server. Sonificazione salvata SENZA audio cache. L'audio verrà rigenerato automaticamente quando aprirai l'opera.");
            } catch (liteError) {
                console.error("Anche il salvataggio Lite è fallito.", liteError);
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

    publishFromHistory: async (entry: DashboardEntry, metadata: any, user: User, customMedia: { url: string, type: string } | null) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=publish_history`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entryId: entry.id,
                metadata,
                customMediaUrl: customMedia?.url,
                customMediaType: customMedia?.type,
                auth_token: token
            })
        });
    },

    getHistory: async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history&t=${new Date().getTime()}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    deleteHistoryItem: async (id: string) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=delete_history_item`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, auth_token: token }) });
        await handleResponse(response);
    },

    getShowcase: async () => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase&t=${new Date().getTime()}`);
        return await handleResponse(response);
    },

    // --- ADMIN FUNCTIONS (RIPRISTINATE) ---

    updateShowcaseItem: async (item: ShowcaseProject) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=update_showcase_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, auth_token: token })
        });
    },

    deleteShowcaseItem: async (id: string) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=delete_showcase_item`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, auth_token: token })
        });
    },

    getAccessRequests: async (): Promise<any[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_get_requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    approveAccessRequest: async (id: string): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_approve_request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, auth_token: token }) });
    },

    rejectAccessRequest: async (id: string): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_reject_request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, auth_token: token }) });
    },

    getSystemStats: async (): Promise<SystemStats> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_stats`, { method: 'POST', body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    getSystemLogs: async (): Promise<SystemLog[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_logs`, { method: 'POST', body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    getAllUsers: async (): Promise<User[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_users`, { method: 'POST', body: JSON.stringify({ auth_token: token }) });
        return await handleResponse(response);
    },

    adminCreateUser: async (u: any) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_create_user`, { method: 'POST', body: JSON.stringify({ ...u, auth_token: token }) });
    },

    updateUser: async (u: any) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_user`, { method: 'POST', body: JSON.stringify({ ...u, auth_token: token }) });
    },

    deleteUser: async (id: string) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=delete_user`, { method: 'POST', body: JSON.stringify({ id, auth_token: token }) });
    },
};