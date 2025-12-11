import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult } from "../types";
import { fileToBase64 } from "../utils/fileUtils";

// --- CONFIGURAZIONE CHIAVE ---
const GOOGLE_API_KEY = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process as any).env?.VITE_GEMINI_API_KEY : "");

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
    scanPatternName: string
): Promise<MusicGenerationPrompt> {
    return generateMusicPromptFromAnalysisHybrid(tradition, analysisStats, scanPatternName, "Analisi Scientifica Pura");
}

export async function generateMusicPromptFromAnalysisHybrid(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string,
    imageDescription: string
): Promise<MusicGenerationPrompt> {

    if (!GOOGLE_API_KEY) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    // PROMPT OTTIMIZZATO MULTI-PIATTAFORMA
    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer per le principali AI generative (Suno, Udio, Stable Audio).
OBIETTIVO: Creare metadati musicali precisi partendo da una sonificazione visiva.

INPUT VISIVO: "${imageDescription}"
DATI SONIFICAZIONE:
- Tradizione: '${tradition.name}' ('${tradition.character}')
- Saturazione Colore: ${(analysisStats.avg_saturation * 100).toFixed(0)}%
- Pattern Scansione: '${scanPatternName}'

COMPITO: Genera 3 varianti di prompt per estendere/arrangiare questa sonificazione.
1. **SUNO v3.5**: Usa "Meta Tags" tra parentesi quadre. Esempio: "[Dark Ambient], [Oud Solo], [Experimental]".
2. **UDIO**: Usa tags descrittivi separati da virgola. Esempio: dark ambient, oud solo, cinematic, slow tempo.
3. **STABILITY / MUSICGEN**: Usa una frase descrittiva fluida in inglese. Esempio: "A dark ambient track featuring an oud solo...".

REGOLE:
- L'audio di input è sperimentale/microtonale: usa tag come "[Experimental]", "[Abstract]" per guidare l'AI.
- Se non c'è voce nell'immagine, specifica sempre "[Instrumental]".

OUTPUT RICHIESTO (JSON):
Genera un JSON valido con:
- **main_prompt_ita**: Descrizione estetica sintetica in Italiano.
- **technical_parameters**: BPM e Chiave (es. "Free Tempo, Microtonal").
- **justification**: Motivo tecnico della scelta.
- **suno_prompt**: Prompt ottimizzato per SUNO (Meta Tags).
- **udio_prompt**: Prompt ottimizzato per UDIO (Tags).
- **stability_prompt**: Prompt ottimizzato per STABILITY (Discorsivo).
- **negative_prompt**: Elementi da evitare (Inglese).

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
                        negative_prompt: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "stability_prompt", "negative_prompt"]
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
            negative_prompt: "percussion, text, speech"
        };
    }
}
