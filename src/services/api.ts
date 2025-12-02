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
        // ... (Il tuo codice originale di saveSonification che salva Base64) ...
        // QUESTO VA BENE, NON LO TOCCO PER ORA
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        let imageBase64 = "";
        try {
            const response = await fetch(result.standardizedImageUrl);
            const blob = await response.blob();
            imageBase64 = await blobToBase64(blob);
        } catch (e) { }

        if (USE_MOCK_BACKEND) return; // Mock omesso

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

    // --- NUOVA FUNZIONE SEPARATA PER L'UPLOAD (FIX 401 ERROR) ---
    uploadMediaFile: async (file: File): Promise<{ url: string, type: string }> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Autenticazione richiesta per l'upload");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('auth_token', token); // Mettiamo il token qui, il PHP lo legge da $_POST

        const response = await fetch(`${API_BASE_URL}/index.php?action=upload_media`, {
            method: 'POST',
            body: formData, // Non usiamo JSON qui
        });

        return await handleResponse(response);
    },

    // --- GET HISTORY ---
    getHistory: async (): Promise<DashboardEntry[]> => {
        // ... (Tuo codice originale per getHistory)
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");
        if (USE_MOCK_BACKEND) return [];
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_token: token })
        });
        return await handleResponse(response);
    },

    clearHistory: async (): Promise<void> => {
        // ... (Tuo codice originale)
    },

    /**
     * PUBLISH (AGGIORNATA: Usa la nuova funzione di upload)
     */
    publishFromHistory: async (
        entry: DashboardEntry,
        metadata: { title: string, description: string, tags: string[] },
        user: User,
        customMediaFile?: File | null // Parametro opzionale per il file
    ): Promise<void> => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) throw new Error("Non autenticato");

        let uploadedUrl = null;
        let uploadedType = null;

        // 1. PRIMA carica il file, se l'utente ne ha scelto uno
        if (customMediaFile) {
            try {
                // Chiama la nuova funzione di upload dedicata che abbiamo creato
                const uploadResult = await api.uploadMediaFile(customMediaFile);
                uploadedUrl = uploadResult.url;
                uploadedType = uploadResult.type;
            } catch (e) {
                console.error("Errore upload media:", e);
                throw new Error("Impossibile caricare il file media. L'operazione è stata annullata.");
            }
        }

        if (USE_MOCK_BACKEND) return; // Mock omesso

        // 2. POI invia i metadati (in JSON) per pubblicare
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

    getShowcase: async (): Promise<ShowcaseProject[]> => {
        // ... (Tuo codice originale)
    },

    // --- ADMIN FUNCTIONS (Invariate) ---
    addShowcaseItem: async (item: Omit<ShowcaseProject, 'id'>): Promise<void> => { /*...*/ },
    updateShowcaseItem: async (item: ShowcaseProject): Promise<void> => { /*...*/ },
    deleteShowcaseItem: async (id: string): Promise<void> => { /*...*/ },
    getSystemStats: async (): Promise<SystemStats> => { /*...*/ },
    getSystemLogs: async (): Promise<SystemLog[]> => { /*...*/ },
    getAllUsers: async (): Promise<User[]> => { /*...*/ },
    adminCreateUser: async (user: Partial<User>): Promise<void> => { /*...*/ },
    updateUser: async (user: User): Promise<void> => { /*...*/ },
    deleteUser: async (id: string): Promise<void> => { /*...*/ }
};