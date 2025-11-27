
import { ShowcaseProject } from '../types';

export const showcaseProjects: ShowcaseProject[] = [
    {
        id: 'project-001',
        title: "Studio sulla Gioconda",
        date: "2025-02-15",
        author: "Dr. Marco Mirra",
        description: "Una sonificazione scientifica del capolavoro di Leonardo. L'analisi ha rivelato una corrispondenza sorprendente con le scale modali del rinascimento italiano, ma con inflessioni cromatiche tipiche della tradizione 'Raga Yaman' a causa dell'invecchiamento della vernice.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/800px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
        paradigm: "scientific",
        tradition: "Maqam Saba (Shift Cromatico)",
        tags: ["Arte Classica", "Rinascimento", "Studio Colore"],
        stats: {
            duration: "3m 45s",
            notes: 4096
        }
    },
    {
        id: 'project-002',
        title: "Nebula Pillars of Creation",
        date: "2025-02-10",
        author: "Team SonificART",
        description: "Utilizzando le immagini del telescopio James Webb, abbiamo mappato la densità dei gas interstellari in dinamiche sonore. I colori infrarossi traslati nello spettro visibile hanno generato texture ambientali profonde.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/800px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg",
        paradigm: "hybrid",
        tradition: "Minimalismo Meditativo",
        tags: ["Astronomia", "Spazio", "Ambient"],
        stats: {
            duration: "5m 20s",
            notes: 16384
        }
    },
    {
        id: 'project-003',
        title: "Urban Glitch: Tokyo Night",
        date: "2025-01-28",
        author: "Artist X",
        description: "Un approccio puramente artistico alla fotografia notturna urbana. Le luci al neon sature hanno innescato algoritmi ad alta energia, producendo ritmi sincopati e sintetizzatori aggressivi.",
        imageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92a3a8?q=80&w=800&auto=format&fit=crop",
        paradigm: "artistic",
        tradition: "Synthwave Neo-Orientale",
        tags: ["Urbano", "Cyberpunk", "Elettronica"],
        stats: {
            duration: "2m 15s",
            notes: 1024
        }
    },
    {
        id: 'project-004',
        title: "Frattali di Mandelbrot",
        date: "2025-01-15",
        author: "MathLab",
        description: "La matematica diventa musica. L'infinita complessità del bordo del set di Mandelbrot genera melodie che non si ripetono mai, seguendo pattern frattali auto-similari.",
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Mandel_zoom_00_mandelbrot_set.jpg/800px-Mandel_zoom_00_mandelbrot_set.jpg",
        paradigm: "scientific",
        tradition: "Dodecafonia Algoritmica",
        tags: ["Matematica", "Frattali", "Generativo"],
        stats: {
            duration: "10m 00s",
            notes: 8192
        }
    }
];
