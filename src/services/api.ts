import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE ---
export const USE_MOCK_BACKEND = false;
const API_BASE_URL = 'https://sonificart.com/api';

const STORAGE_KEYS = {
    TOKEN: 'sonificart_auth_token',
};

const handleResponse = async (response: Response) => {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || data.message || `HTTP Error ${response.status}`);
        return data;
    } catch (e) {
        console.error("Server Error:", text);
        throw new Error("Errore server. Controlla la console.");
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
        let imgBase64 = "", audioBase64 = "";
        try {
            const img = new Image(); img.src = result.standardizedImageUrl; await new Promise(r => img.onload = r);
            const c = document.createElement('canvas'); c.width = 600; c.height = (img.height / img.width) * 600;
            c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height); imgBase64 = c.toDataURL('image/jpeg', 0.85);

            const reader = new FileReader();
            await new Promise((res) => { reader.onloadend = () => { audioBase64 = reader.result as string; res(true); }; reader.readAsDataURL(result.audioOutput.audioWavBlob); });
        } catch (e) { }

        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageHash: result.imageHash, paradigm, traditionName: result.culturalSelectionResult.tradition.name, imageUrl: imgBase64, audioData: audioBase64, auth_token: token })
        });
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
        await fetch(`${API_BASE_URL}/index.php?action=delete_history_item`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, auth_token: token }) });
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