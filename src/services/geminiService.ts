import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult } from "../types";
import { fileToBase64 } from "../utils/fileUtils";

// --- CONFIGURAZIONE CHIAVE ---
const GOOGLE_API_KEY = "AIzaSyBtEtAu3W09-UAp7J0mc2x07HwvQt3UqAE";
export async function describeImageContent(imageFile: File): Promise<string> {
    if (!GOOGLE_API_KEY) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
    const base64Image = await fileToBase64(imageFile);

    const imagePart = {
        inlineData: { mimeType: imageFile.type, data: base64Image },
    };

    const textPart = {
        text: "Descrivi il contenuto di questa immagine in modo oggettivo, in una singola frase concisa in italiano. Concentrati sugli elementi principali e sull'atmosfera generale.",
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [imagePart, textPart] }
        });
        return response.text?.trim() || "Descrizione non disponibile";
    } catch (e) {
        console.error("Errore Gemini Descrizione:", e);
        return "Opera d'arte astratta e suggestiva.";
    }
}

export async function generateMusicPromptFromAnalysis(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string,
    durationSeconds: number,
    imageDescription: string = "Analisi Scientifica Pura"
): Promise<MusicGenerationPrompt> {
    return generateMusicPromptFromAnalysisHybrid(tradition, analysisStats, scanPatternName, imageDescription, durationSeconds);
}

export async function generateMusicPromptFromAnalysisHybrid(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string,
    imageDescription: string,
    durationSeconds: number
): Promise<MusicGenerationPrompt> {

    if (!GOOGLE_API_KEY) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    // PROMPT ALTAMENTE DETTAGLIATO - FUSIONE SEMANTICA AGGRESSIVA - FORZATURA DURATA
    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer senior, specializzato nella "FUSIONE SEMANTICA" tra dati visivi e traduzioni culturali musicali per AI generative (Suno, Udio, Stable Audio).

OBIETTIVO: Creare una guida musicale che sia un ibrido perfetto tra il "Soggetto dell'Immagine" e la "Tradizione Musicale" suggerita dal framework SonificA.R.T.

DATI DI INPUT:
- SOGGETTO VISIVO (CRITICO): "${imageDescription}"
- TRADIZIONE MUSICALE: '${tradition.name}' (Carattere: '${tradition.character}')
- Descrizione Cultura: "${tradition.description}"
- Statistiche Colore (CIE LAB): Saturazione al ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Diversità cromatica al ${(analysisStats.hue_diversity * 100).toFixed(0)}%
- DURATA DA RISPETTARE: ${durationSeconds.toFixed(1)} secondi.
- Pattern di Scansione: '${scanPatternName}'

REQUISITI DI FUSIONE SEMANTICA (MANDATORI):
1. **Iniezione Parole Chiave Visive**: Devi inserire nel prompt i termini chiave estratti dal SOGGETTO VISIVO ("${imageDescription}"). Se vedi "Stonehenge", il prompt DEVE contenere parole come "Ancient Stones", "Monoliths", "Sarsen stones", "Druidic silence", "Neolithic ritual".
2. **Ibridazione Strumentale**: Non limitarti alla strumentazione classica della tradizione '${tradition.name}'. Inventa suoni ibridi basati sull'immagine. (Es: Se è Stonehenge + Andaluso: "Stone-percussion echoing between monoliths", "Oud melody carried by the morning wind over Salisbury Plain").
3. **Atmosfera Contestuale**: L'atmosfera non deve essere solo quella della tradizione, ma deve riflettere il luogo/soggetto dell'immagine.
4. **COESIONE ARTISTICA**: Il prompt deve suggerire all'AI di integrare la tessitura sonora del file WAV di riferimento in modo fluido e armonioso, mantenendo la coerenza con l'atmosfera visiva.

FORZATURA DURATA SUNO (CRITICO):
- Inizia SEMPRE con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [Fast Ending], [No Extension]".
- Termina SEMPRE con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".

STRUTTURA OUTPUT RICHIESTA (JSON):
- **main_prompt_ita**: Descrizione poetica e tecnica che spieghi come la musicalità '${tradition.name}' descriva specificamente '${imageDescription}'.
- **technical_parameters**: BPM, Chiave, Scala, e Strumentazione Ibrida suggerita.
- **justification**: Spiegazione di come il soggetto visivo sia stato fuso con la tradizione musicale.
- **suno_prompt**: Il mega-prompt di tag. DEVE contenere sia i tag musicali che i tag del SOGGETTO VISIVO.
- **udio_prompt**: Tag separati da virgola (Musicali + Visivi + Durata).
- **stability_prompt**: Descrizione fluida (Musicali + Visivi + Durata).
- **negative_prompt**: Elementi da evitare.
- **suno_lyrics**: Marcatori temporali basati sulla durata di ${durationSeconds.toFixed(0)} secondi. Inserisci un marcatore ogni 30 secondi (es: [0:00], [0:30], [1:00]) accompagnato da una breve descrizione della sezione strumentale (es: [0:00] Intro Ambientale, [0:30] Sviluppo Ritmico).

Rispondi SOLO con il JSON.`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        main_prompt_ita: { type: Type.STRING },
                        technical_parameters: { type: Type.STRING },
                        justification: { type: Type.STRING },
                        suno_prompt: { type: Type.STRING },
                        udio_prompt: { type: Type.STRING },
                        stability_prompt: { type: Type.STRING },
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "stability_prompt", "negative_prompt", "suno_lyrics"]
                }
            }
        });

        const jsonText = response.text?.trim();

        if (!jsonText) throw new Error("Risposta vuota da Gemini");

        return JSON.parse(jsonText) as MusicGenerationPrompt;

    } catch (e) {
        console.error("Errore Gemini Prompt:", e);
        // Fallback robusto con tutti i campi
        return {
            main_prompt_ita: "Generazione basata su algoritmi deterministici",
            technical_parameters: "Auto BPM",
            justification: "Errore connessione AI, uso parametri standard.",
            suno_prompt: "[Experimental], [Instrumental], [Cinematic], [Ambient]",
            udio_prompt: "experimental, instrumental, cinematic, ambient",
            stability_prompt: "Cinematic score, emotional, orchestral, clear sound",
            negative_prompt: "percussion, text, speech",
            suno_lyrics: "[0:00] Intro, [0:30] Development, [End]"
        };
    }
}
