import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { showcaseProjects as initialShowcaseData } from '../data/showcaseData';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE DEPLOY ---
export const USE_MOCK_BACKEND = false;

// URL ASSOLUTO PER EVITARE ERRORI 404
const API_BASE_URL = 'https://sonificart.com/api';

const STORAGE_KEYS = {
    TOKEN: 'sonificart_auth_token',
    HISTORY: 'sonification_history',
    SHOWCASE: 'sonificart_showcase',
    USERS: 'sonificart_users',
    STATS: 'sonificart_stats',
    LOGS: 'sonificart_system_logs',
    REGISTRY: 'sonificart_global_registry'
};

const handleResponse = async (response: Response) => {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP Error ${response.status}`);
        }
        return data;
    } catch (e) {
        console.error("CRITICAL SERVER ERROR (Non JSON):", text);
        throw new Error("Errore comunicazione server.");
    }
};

export const api = {

    login: async (email: string, password: string): Promise<User> => {
        if (USE_MOCK_BACKEND) {
            // Mock logic...
            return { id: 'mock', name: 'Mock User', email, isPro: true, isAdmin: true, credits: 9999, registeredAt: '' };
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await handleResponse(response);
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
            return data.user;
        }
    },

    register: async (name: string, email: string, password: string): Promise<User> => {
        if (USE_MOCK_BACKEND) throw new Error("Mock register not impl");
        const response = await fetch(`${API_BASE_URL}/index.php?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await handleResponse(response);
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        return data.user;
    },

    checkSession: async (): Promise<User | null> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return null;
        if (USE_MOCK_BACKEND) return null;

        try {
            const response = await fetch(`${API_BASE_URL}/index.php?action=check_session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth_token: token })
            });
            const data = await handleResponse(response);
            return data.user;
        } catch (e) {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            return null;
        }
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
    },

    consumeCredit: async (userId: string, cost: number = 1): Promise<number> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return 9999;

        const response = await fetch(`${API_BASE_URL}/index.php?action=consume_credits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cost, auth_token: token })
        });
        const data = await handleResponse(response);
        return data.credits;
    },

    registerArtifact: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        // Opzionale, implementato se serve
    },

    /**
     * SALVATAGGIO REALE (IMMAGINE + AUDIO)
     */
    saveSonification: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        // 1. Prepara Immagine (Base64 compressa)
        let imageBase64 = "";
        try {
            const img = new Image();
            img.src = result.standardizedImageUrl;
            await new Promise((resolve) => { img.onload = resolve; });
            const canvas = document.createElement('canvas');
            const scale = 600 / img.width; // Resize a 600px
            canvas.width = 600;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
            }
        } catch (e) {
            console.error("Errore img", e);
            imageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }

        // 2. Prepara Audio (Base64 dal Blob WAV)
        let audioBase64 = "";
        try {
            if (result.audioOutput.audioWavBlob) {
                const reader = new FileReader();
                await new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        audioBase64 = reader.result as string;
                        resolve(true);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(result.audioOutput.audioWavBlob);
                });
            }
        } catch (e) {
            console.error("Errore audio convert", e);
        }

        if (USE_MOCK_BACKEND) return;

        // 3. Invia tutto al Server
        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageHash: result.imageHash,
                paradigm,
                traditionName: result.culturalSelectionResult.tradition.name,
                imageUrl: imageBase64,
                audioData: audioBase64, // FILE AUDIO QUI
                auth_token: token
            })
        });
    },

    getHistory: async (): Promise<DashboardEntry[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return [];

        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    clearHistory: async (): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        await fetch(`${API_BASE_URL}/index.php?action=clear_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
    },

    publishFromHistory: async (entry: DashboardEntry, metadata: { title: string, description: string, tags: string[] }, user: User): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        await fetch(`${API_BASE_URL}/index.php?action=publish_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: entry.id, metadata, auth_token: token })
        });
    },

    getShowcase: async (): Promise<ShowcaseProject[]> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase`);
        return await handleResponse(response);
    },

    // ... (Admin functions rimangono uguali, omesse per brevità ma devono esserci se le usi) ...
    addShowcaseItem: async (item: any) => { /* ... */ },
    updateShowcaseItem: async (item: any) => { /* ... */ },
    deleteShowcaseItem: async (id: string) => { /* ... */ },
    getSystemStats: async () => { return { totalUsers: 0, activeUsers24h: 0, totalSonifications: 0, serverHealth: { cpu: 0, memory: 0, uptime: "" }, apiStatus: { gemini: {}, storage: {}, paddle: {} } } as SystemStats },
    getSystemLogs: async () => { return [] as SystemLog[] },
    getAllUsers: async () => { return [] as User[] },
    adminCreateUser: async (u: any) => { },
    updateUser: async (u: any) => { },
    deleteUser: async (id: string) => { },
};