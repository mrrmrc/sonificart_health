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
        // Se JSON.parse fallisce, significa che il server ha risposto con HTML o testo non JSON (es. errore PHP)
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
            await new Promise(resolve => setTimeout(resolve, 800));
            const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersStr ? JSON.parse(usersStr) : [];

            if (email === 'pro@sonificart.com' && password === 'demo') {
                const demoUser: User = {
                    id: 'u_demo_pro', name: 'Artista Pro', email, isPro: true, isAdmin: true,
                    registeredAt: new Date().toISOString(), lastLogin: new Date().toISOString(), credits: 9999
                };
                localStorage.setItem(STORAGE_KEYS.TOKEN, 'mock_token_pro');
                return demoUser;
            }

            const user = users.find(u => (u.email === email || u.name === email));
            if (user && password) {
                const token = `mock_token_${user.id}`;
                localStorage.setItem(STORAGE_KEYS.TOKEN, token);
                user.lastLogin = new Date().toISOString();
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
                return user;
            }
            throw new Error("Credenziali non valide");
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
        if (USE_MOCK_BACKEND) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            // ... (Mock logic omitted for brevity)
            throw new Error("Mock register not impl");
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await handleResponse(response);
            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
            return data.user;
        }
    },

    /**
     * Check current session
     */
    checkSession: async (): Promise<User | null> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return null;

        if (USE_MOCK_BACKEND) {
            if (token === 'mock_token_pro') {
                return {
                    id: 'u_demo_pro', name: 'Artista Pro', email: 'pro@sonificart.com', isPro: true, isAdmin: true,
                    registeredAt: new Date().toISOString(), credits: 9999, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pro'
                };
            }
            const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersStr ? JSON.parse(usersStr) : [];
            const userId = token.replace('mock_token_', '');
            return users.find(u => u.id === userId) || null;
        } else {
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

        if (USE_MOCK_BACKEND) {
            return 9999; // Mock always free
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=consume_credits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost, auth_token: token })
            });
            const data = await handleResponse(response);
            return data.credits;
        }
    },

    /**
     * Register artifact
     */
    registerArtifact: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        // Implementation kept minimal
    },

    /**
     * Save sonification (AGGIORNATA: Invia anche l'audio al server)
     */
    saveSonification: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        // 1. Converti Immagine in Base64 (compressa)
        let imageBase64 = "";
        try {
            const img = new Image();
            img.src = result.standardizedImageUrl;
            await new Promise((resolve) => { img.onload = resolve; });
            const canvas = document.createElement('canvas');
            // Resize a 600px per alleggerire il carico sul server
            const scale = 600 / img.width;
            canvas.width = 600;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
            }
        } catch (e) {
            // Fallback
            imageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        }

        // 2. Converti Audio in Base64 (NUOVO!)
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
            console.error("Errore conversione audio", e);
        }

        if (USE_MOCK_BACKEND) return;

        // 3. Invia tutto al PHP
        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageHash: result.imageHash,
                paradigm,
                traditionName: result.culturalSelectionResult.tradition.name,
                imageUrl: imageBase64,
                audioData: audioBase64, // Ecco il payload audio!
                auth_token: token
            })
        });
    },

    // --- GET HISTORY ---
    getHistory: async (): Promise<DashboardEntry[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        if (USE_MOCK_BACKEND) {
            return [];
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth_token: token })
            });
            return await handleResponse(response);
        }
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

    // Admin functions (omitted detail for brevity, standard pass-through)
    addShowcaseItem: async (item: any) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_add_showcase`, { method: 'POST', body: JSON.stringify({ ...item, auth_token: token }) }); },
    updateShowcaseItem: async (item: any) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_update_showcase`, { method: 'POST', body: JSON.stringify({ ...item, auth_token: token }) }); },
    deleteShowcaseItem: async (id: string) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_delete_showcase`, { method: 'POST', body: JSON.stringify({ id, auth_token: token }) }); },

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

    adminCreateUser: async (user: any) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_create_user`, { method: 'POST', body: JSON.stringify({ ...user, auth_token: token }) }); },
    updateUser: async (user: any) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_update_user`, { method: 'POST', body: JSON.stringify({ ...user, auth_token: token }) }); },
    deleteUser: async (id: string) => { const token = localStorage.getItem(STORAGE_KEYS.TOKEN); await fetch(`${API_BASE_URL}/index.php?action=admin_delete_user`, { method: 'POST', body: JSON.stringify({ id, auth_token: token }) }); }
};