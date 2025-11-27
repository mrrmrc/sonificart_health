
export interface VideoConfig {
    type: 'youtube' | 'vimeo' | 'native';
    src: string;
}

export const getVideoConfig = (url: string, autoplay: boolean = true): VideoConfig | null => {
    if (!url) return null;
    const cleanUrl = url.trim();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    // 1. YOUTUBE DETECTION (Standard, Embed, Short, Mobile)
    if (cleanUrl.match(/youtu\.?be/) || cleanUrl.includes('youtube.com')) {
        // Regex robusta per catturare ID da vari formati (inclusi shorts)
        const ytIdMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^#&?]{11})/);
        
        if (ytIdMatch && ytIdMatch[1]) {
            const videoId = ytIdMatch[1];
            
            // Estrazione timestamp (supporta ?t=120s o &t=120)
            const timeMatch = cleanUrl.match(/[?&]t=([^&]+)/);
            let startTime = '';
            if (timeMatch) {
                const timeStr = timeMatch[1].replace('s', ''); 
                startTime = `&start=${timeStr}`;
            }

            // FIX CRITICO: Aggiunta 'origin' per evitare errori di configurazione player su alcuni browser
            return { 
                type: 'youtube', 
                src: `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? '1' : '0'}&rel=0&modestbranding=1&origin=${origin}${startTime}` 
            };
        }
        return null; // ID non trovato, evita fallback errati
    }

    // 2. VIMEO DETECTION
    if (cleanUrl.match(/vimeo\.com/)) {
        const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/);
        if (vimeoMatch && vimeoMatch[1]) {
            return { 
                type: 'vimeo', 
                src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=${autoplay ? '1' : '0'}` 
            };
        }
        return null;
    }

    // 3. NATIVE FALLBACK (Solo se estensione valida)
    // Impedisce di caricare HTML o link generici in un tag <video> che genererebbe errore
    if (/\.(mp4|webm|ogg|mov)$/i.test(cleanUrl)) {
        return { type: 'native', src: cleanUrl };
    }

    return null; // URL non riconosciuto come video valido
};
