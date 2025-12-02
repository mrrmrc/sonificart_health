import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { showcaseProjects as initialShowcaseData } from '../data/showcaseData';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE DEPLOY ---
// false = Usa il backend PHP (Produzione)
// true = Usa la simulazione locale (Sviluppo)
export const USE_MOCK_BACKEND = false;

// Punta alla cartella api relativa (URL Assoluto per sicurezza)
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

// Helper per gestire le risposte PHP in modo robusto
const handleResponse = async (response: Response) => {
    const text = await response.text(); // Legge sempre il testo
    try {
        const data = JSON.parse(text);
        if (!response.ok) {
            // Se la risposta non è OK (es. 401, 403), l'errore è nel JSON
            throw new Error(data.error || data.message || `HTTP Error ${response.status}`);
        }
        return data;
    } catch (e) {
        // Se JSON.parse fallisce, significa che il server ha risposto con HTML o testo non JSON
        console.error("CRITICAL SERVER ERROR (Non JSON):", text);
        throw new Error("Errore di comunicazione con il server. Vedi console per dettagli PHP.");
    }
};

export const api = {

    /**
     * Authenticate user
     */
    login: async (email: string, password: string): Promise<User> => {
        if (USE_MOCK_BACKEND) {
            // (Mock logic)
            return { id: 'u_mock', name: 'Mock User', email, isPro: true, isAdmin: true, credits: 9999, registeredAt: '' };
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

    /**
     * Register new user
     */
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

    /**
     * Check current session
     */
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

    /**
     * Logout
     */
    logout: async (): Promise<void> => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
    },

    /**
     * Consume a credit
     */
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

    /**
     * Register artifact
     */
    registerArtifact: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        // Funzione opzionale, mantenuta
    },

    /**
     * Save sonification (CON AUDIO)
     */
    saveSonification: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        // Prepara Immagine e Audio
        let imageBase64 = ""; let audioBase64 = "";
        try {
            const img = new Image(); img.src = result.standardizedImageUrl; await new Promise(r => img.onload = r);
            const canvas = document.createElement('canvas'); const scale = 600 / img.width;
            canvas.width = 600; canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); imageBase64 = canvas.toDataURL('image/jpeg', 0.8); }
        } catch (e) { }

        try {
            if (result.audioOutput.audioWavBlob) {
                const reader = new FileReader();
                await new Promise((resolve, reject) => {
                    reader.onloadend = () => { audioBase64 = reader.result as string; resolve(true); };
                    reader.onerror = reject;
                    reader.readAsDataURL(result.audioOutput.audioWavBlob);
                });
            }
        } catch (e) { }

        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageHash: result.imageHash, paradigm, traditionName: result.culturalSelectionResult.tradition.name,
                imageUrl: imageBase64, audioData: audioBase64, auth_token: token
            })
        });
    },

    // --- NUOVA FUNZIONE SEPARATA PER L'UPLOAD (FIX 401 ERROR) ---
    uploadMediaFile: async (file: File): Promise<{ url: string, type: string }> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Autenticazione richiesta");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('auth_token', token);

        const response = await fetch(`${API_BASE_URL}/index.php?action=upload_media`, {
            method: 'POST',
            body: formData,
        });

        return await handleResponse(response);
    },

    /**
     * Get History
     */
    getHistory: async (): Promise<DashboardEntry[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    deleteHistoryItem: async (id: string): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        // Invia ID e Token al PHP
        await fetch(`${API_BASE_URL}/index.php?action=delete_history_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, auth_token: token })
        });
    },

    /**
     * Clear History
     */
    clearHistory: async (): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        await fetch(`${API_BASE_URL}/index.php?action=clear_history`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token })
        });
    },

    /**
     * Publish from History (AGGIORNATA)
     */
    publishFromHistory: async (
        entry: DashboardEntry,
        metadata: { title: string, description: string, tags: string[] },
        user: User,
        customMediaFile?: File | null
    ): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        let uploadedUrl = null;
        let uploadedType = null;

        if (customMediaFile) {
            try {
                const uploadResult = await api.uploadMediaFile(customMediaFile);
                uploadedUrl = uploadResult.url;
                uploadedType = uploadResult.type;
            } catch (e) {
                console.error(e);
                throw new Error("Impossibile caricare il file.");
            }
        }

        await fetch(`${API_BASE_URL}/index.php?action=publish_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entryId: entry.id,
                metadata,
                customMediaUrl: uploadedUrl,
                customMediaType: uploadedType,
                auth_token: token
            })
        });
    },

    /**
     * Get Showcase
     */
    getShowcase: async (): Promise<ShowcaseProject[]> => {
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase`);
        return await handleResponse(response);
    },

    // --- ADMIN FUNCTIONS (CODICE RIPRISTINATO DAL TUO ORIGINALE) ---
    addShowcaseItem: async (item: Omit<ShowcaseProject, 'id'>): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_add_showcase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, auth_token: token })
        });
    },

    updateShowcaseItem: async (item: ShowcaseProject): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_showcase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, auth_token: token })
        });
    },

    deleteShowcaseItem: async (id: string): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_delete_showcase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, auth_token: token })
        });
    },

    getSystemStats: async (): Promise<SystemStats> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return { totalUsers: 0, activeUsers24h: 0, totalSonifications: 0, serverHealth: { cpu: 0, memory: 0, uptime: "" }, apiStatus: { gemini: { serviceName: "", used: 0, limit: 0, unit: "", costEstimated: 0 }, storage: { serviceName: "", used: 0, limit: 0, unit: "", costEstimated: 0 }, paddle: { serviceName: "", used: 0, limit: 0, unit: "", costEstimated: 0 } } };
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    getSystemLogs: async (): Promise<SystemLog[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return [];
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    getAllUsers: async (): Promise<User[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return [];
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    adminCreateUser: async (user: Partial<User>): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_create_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...user, auth_token: token })
        });
    },

    updateUser: async (user: User): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...user, auth_token: token })
        });
    },

    deleteUser: async (id: string): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return;
        await fetch(`${API_BASE_URL}/index.php?action=admin_delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, auth_token: token })
        });
    }
};