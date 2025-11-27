
import { DashboardEntry, SonificationResult, ShowcaseProject, User, SystemStats, SystemLog, Paradigm } from '../types';
import { showcaseProjects as initialShowcaseData } from '../data/showcaseData';
import { blobToBase64 } from './audioUtils';

// --- CONFIGURATION FOR DEPLOY ---
// Set to FALSE to use your real PHP/MySQL backend
export const USE_MOCK_BACKEND = false; 

// In production (on your server), this points to the /api folder relative to the domain
const API_BASE_URL = '/api'; 

const STORAGE_KEYS = {
    TOKEN: 'sonificart_auth_token',
    HISTORY: 'sonification_history',
    SHOWCASE: 'sonification_showcase',
    USERS: 'sonificart_users',
    STATS: 'sonificart_stats',
    LOGS: 'sonificart_system_logs',
    REGISTRY: 'sonificart_global_registry'
};

// Helper to handle PHP responses which might be finicky on shared hosting
const handleResponse = async (response: Response) => {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP Error ${response.status}`);
        }
        return data;
    } catch (e) {
        console.error("Invalid JSON response from server:", text);
        throw new Error("Errore di comunicazione con il server (Risposta non valida).");
    }
};

// --- API SERVICE ---

export const api = {
    
    /**
     * Authenticate user
     */
    login: async (email: string, password: string): Promise<User> => {
        if (USE_MOCK_BACKEND) {
             throw new Error("Mock backend should be disabled for deploy.");
        } else {
            // PHP Backend Call
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
             throw new Error("Mock backend should be disabled for deploy.");
        } else {
            const response = await fetch(`${API_BASE_URL}/index.php?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await handleResponse(response);
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
            return null;
        } else {
            try {
                const response = await fetch(`${API_BASE_URL}/index.php?action=check_session`, {
                    headers: { 'Authorization': `Bearer ${token}` }
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
        if (USE_MOCK_BACKEND) {
             return 999;
        } else {
            const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
            const response = await fetch(`${API_BASE_URL}/index.php?action=consume_credits`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cost })
            });
            const data = await handleResponse(response);
            return data.credits;
        }
    },

    /**
     * Register artifact (for tracking/stats)
     */
    registerArtifact: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        if (USE_MOCK_BACKEND) return;
        
        try {
            await fetch(`${API_BASE_URL}/index.php?action=register_artifact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hash: result.imageHash,
                    paradigm,
                    duration: result.audioOutput.duration
                })
            });
        } catch (e) {
            console.warn("Failed to register artifact stats", e);
        }
    },

    /**
     * Save sonification to user history
     */
    saveSonification: async (result: SonificationResult, paradigm: Paradigm): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return;

        // Note: StandardizedImageUrl is currently a blob URL which won't persist. 
        // In production, you should upload the image or send base64.
        await fetch(`${API_BASE_URL}/index.php?action=save_sonification`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                imageHash: result.imageHash,
                paradigm,
                traditionName: result.culturalSelectionResult.tradition.name,
                timestamp: new Date().toISOString()
            })
        });
    },

    /**
     * Get User History
     */
    getHistory: async (): Promise<DashboardEntry[]> => {
        if (USE_MOCK_BACKEND) return [];

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await handleResponse(response);
        return data.history || [];
    },

    /**
     * Clear User History
     */
    clearHistory: async (): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=clear_history`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    /**
     * Publish from History to Showcase
     */
    publishFromHistory: async (entry: DashboardEntry, metadata: { title: string; description: string; tags: string[] }, user: User): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=publish_history_item`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                historyId: entry.id,
                ...metadata
            })
        });
    },

    /**
     * Get Showcase
     */
    getShowcase: async (): Promise<ShowcaseProject[]> => {
        if (USE_MOCK_BACKEND) return initialShowcaseData;

        const response = await fetch(`${API_BASE_URL}/index.php?action=get_showcase`);
        const data = await handleResponse(response);
        return data.projects || [];
    },

    // --- ADMIN METHODS ---

    getSystemStats: async (): Promise<SystemStats> => {
        if (USE_MOCK_BACKEND) throw new Error("No mock stats");
        
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await handleResponse(response);
    },

    getAllUsers: async (): Promise<User[]> => {
        if (USE_MOCK_BACKEND) return [];

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await handleResponse(response);
        return data.users;
    },

    getSystemLogs: async (): Promise<SystemLog[]> => {
        if (USE_MOCK_BACKEND) return [];

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await handleResponse(response);
        return data.logs;
    },

     /**
     * Create User (Admin)
     */
     adminCreateUser: async (user: Partial<User> & { password?: string }): Promise<User> => {
        if (USE_MOCK_BACKEND) throw new Error("Backend required");

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const response = await fetch(`${API_BASE_URL}/index.php?action=admin_create_user`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        const data = await handleResponse(response);
        return data.user;
    },

    updateUser: async (user: Partial<User> & { password?: string }): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_user`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
    },

    deleteUser: async (id: string): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_delete_user`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });
    },

    addShowcaseItem: async (item: Omit<ShowcaseProject, 'id'>): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_add_showcase`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
        });
    },

    updateShowcaseItem: async (item: ShowcaseProject): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_update_showcase`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
        });
    },

    deleteShowcaseItem: async (id: string): Promise<void> => {
        if (USE_MOCK_BACKEND) return;

        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        await fetch(`${API_BASE_URL}/index.php?action=admin_delete_showcase`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });
    }
};
