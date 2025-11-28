import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { showcaseProjects as initialShowcaseData } from '../data/showcaseData';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURAZIONE DEPLOY ---
// false = Usa il backend PHP (Produzione)
// true = Usa la simulazione locale (Sviluppo)
export const USE_MOCK_BACKEND = false;

// Punta alla cartella api relativa. Se il sito è su /a/, questo chiamerà /a/api/index.php
const API_BASE_URL = 'api';

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
            const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersStr ? JSON.parse(usersStr) : [];

            if (users.some(u => u.email === email)) {
                throw new Error("Email già registrata");
            }

            const newUser: User = {
                id: `u_${Date.now()}`,
                name,
                email,
                isPro: false,
                isAdmin: false,
                registeredAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                credits: 5
            };

            users.push(newUser);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            const token = `mock_token_${newUser.id}`;
            localStorage.setItem(STORAGE_KEYS.TOKEN, token);
            return newUser;
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
                    body: JSON.stringify({ auth_token: token }) // TOKEN NEL BODY
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
            const usersStr = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersStr ? JSON.parse(usersStr) : [];
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                if (userId === 'u_demo_pro') return 9999;
                throw new Error("User not found");
            }

            const user = users[userIndex];
            if (user.isPro) return 9999;

            if (user.credits < cost) {
                throw new Error("NO_CREDITS");
            }

            user.credits -= cost;
            users[userIndex] = user;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            return user.credits;

        } else {
            // INVIO TOKEN NEL BODY
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
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return;

        if (USE_MOCK_BACKEND) {
            const regStr = localStorage.getItem(STORAGE_KEYS.REGISTRY);
            const registry = regStr ? JSON.parse(regStr) : [];
            registry.push({ hash: result.imageHash, timestamp: new Date().toISOString(), paradigm });
            localStorage.setItem(STORAGE_KEYS.REGISTRY, JSON.stringify(registry));
            return;
        }

        try {
            await fetch(`${API_BASE_URL}/index.php?action=register_artifact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hash: result.imageHash,
                    paradigm,
                    duration: result.audioOutput.duration,
                    auth_token: token
                })
            });
        } catch (e) { }
    },

    /**
     * Save sonification
     */
    saveSonification: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        let imageBase64 = "";
        try {
            const response = await fetch(result.standardizedImageUrl);
            const blob = await response.blob();
            imageBase64 = await blobToBase64(blob);
        } catch (e) { }

        if (USE_MOCK_BACKEND) {
            const userId = token.replace('mock_token_', '') || 'anonymous';
            const entry: DashboardEntry = {
                id: result.imageHash,
                timestamp: new Date().toISOString(),
                imageUrl: `data:image/jpeg;base64,${imageBase64}`,
                paradigm,
                traditionName: result.culturalSelectionResult.tradition.name,
                validationHashes: result.validationHashes
            };
            const historyStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
            const history = historyStr ? JSON.parse(historyStr) : {};
            if (!history[userId]) history[userId] = [];
            history[userId].unshift(entry);
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
            return;
        }

        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageHash: result.imageHash,
                paradigm,
                traditionName: result.culturalSelectionResult.tradition.name,
                imageUrl: imageBase64,
                auth_token: token
            })
        });
    },

    // --- GET HISTORY (Modificato in POST per inviare token nel body) ---
    getHistory: async (): Promise<DashboardEntry[]> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        if (USE_MOCK_BACKEND) {
            await new Promise(r => setTimeout(r, 500));
            const userId = token.replace('mock_token_', '') || 'anonymous';
            const historyStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
            const history = historyStr ? JSON.parse(historyStr) : {};
            return history[userId] || [];
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

        if (USE_MOCK_BACKEND) {
            await new Promise(r => setTimeout(r, 500));
            const userId = token.replace('mock_token_', '') || 'anonymous';
            const historyStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
            const history = historyStr ? JSON.parse(historyStr) : {};
            history[userId] = [];
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
            return;
        }
        await fetch(`${API_BASE_URL}/index.php?action=clear_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_token: token })
        });
    },

    publishFromHistory: async (entry: DashboardEntry, metadata: { title: string, description: string, tags: string[] }, user: User): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        if (USE_MOCK_BACKEND) {
            await new Promise(r => setTimeout(r, 800));
            const showcaseStr = localStorage.getItem(STORAGE_KEYS.SHOWCASE);
            let showcase: ShowcaseProject[] = showcaseStr ? JSON.parse(showcaseStr) : initialShowcaseData;
            const newProject: ShowcaseProject = {
                id: `proj_${Date.now()}`,
                title: metadata.title,
                date: new Date().toISOString().split('T')[0],
                author: user.name,
                ownerId: user.id,
                description: metadata.description,
                imageUrl: entry.imageUrl,
                paradigm: entry.paradigm,
                tradition: entry.traditionName,
                tags: metadata.tags,
                stats: { duration: "3m 00s", notes: 1024 },
                isPublic: true
            };
            showcase.unshift(newProject);
            localStorage.setItem(STORAGE_KEYS.SHOWCASE, JSON.stringify(showcase));
            return;
        }
        await fetch(`${API_BASE_URL}/index.php?action=publish_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: entry.id, metadata, auth_token: token })
        });
    },

    getShowcase: async (): Promise<ShowcaseProject[]> => {
        if (USE_MOCK_BACKEND) {
            await new Promise(r => setTimeout(r, 600));
            const showcaseStr = localStorage.getItem(STORAGE_KEYS.SHOWCASE);
            if (showcaseStr) return JSON.parse(showcaseStr);
            localStorage.setItem(STORAGE_KEYS.SHOWCASE, JSON.stringify(initialShowcaseData));
            return initialShowcaseData;
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase`);
            return await handleResponse(response);
        }
    },

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