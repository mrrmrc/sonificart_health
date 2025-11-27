import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult } from "../types";
import { fileToBase64 } from "../utils/fileUtils";

export async function describeImageContent(imageFile: File): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const base64Image = await fileToBase64(imageFile);

    const imagePart = {
        inlineData: {
            mimeType: imageFile.type,
            data: base64Image,
        },
    };

    const textPart = {
        text: "Descrivi il contenuto di questa immagine in modo oggettivo, in una singola frase concisa in italiano. Concentrati sugli elementi principali e sull'atmosfera generale.",
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] }
        });
        // FIX: Add null check for response.text
        return response.text?.trim() || "Descrizione non disponibile";
    } catch (e) {
        console.error("Errore nella chiamata all'API Gemini per la descrizione dell'immagine:", e);
        throw new Error("Impossibile generare la descrizione dell'immagine dall'AI.");
    }
}


export async function generateMusicPromptFromAnalysis(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string
): Promise<MusicGenerationPrompt> {
    // This function remains for backward compatibility or Scientific mode
    // For Stability AI we mostly use the Hybrid function below
    return generateMusicPromptFromAnalysisHybrid(tradition, analysisStats, scanPatternName, "Analisi Scientifica Pura");
}


export async function generateMusicPromptFromAnalysisHybrid(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string,
    imageDescription: string
): Promise<MusicGenerationPrompt> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const textPart = {
        text: `RUOLO: Sei un esperto di Prompt Engineering per **STABILITY AI - STABLE AUDIO** (AI Music Generation).
Il tuo obiettivo è creare i metadati perfetti per trasformare un'analisi visiva e culturale in una traccia musicale utilizzando Stability AI.

CONTESTO FORNITO:
1.  **SOGGETTO VISIVO (Immagine Reale):** "${imageDescription}"
2.  **DATI SCIENTIFICI (Analisi Colore/Tradizione):**
    -   Tradizione: '${tradition.name}' (Carattere: '${tradition.character}')
    -   Stats: Saturazione ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Complessità ${analysisStats.avg_variance.toFixed(2)}
    -   Scan: '${scanPatternName}'

OBIETTIVO:
Crea un prompt descrittivo ottimizzato per Stability AI (Stable Audio). Questo modello richiede descrizioni testuali fluide e dettagliate dell'atmosfera, degli strumenti e del genere.

COMPITO RICHIESTO (Rispondi in JSON):
Genera un oggetto JSON con i seguenti campi:
- **main_prompt_ita**: Una descrizione sintetica in Italiano del concept (per l'utente).
- **technical_parameters**: Parametri tecnici leggibili (BPM, Key, ecc).
- **justification**: Perché hai scelto questo stile basandoti sui dati scientifici.
- **stability_prompt**: Il prompt principale in INGLESE per Stability AI. Deve essere descrittivo. (Es: "Atmospheric, meditative drone music featuring [Instrument], [Mood], slow tempo, high quality").
- **negative_prompt**: Elementi da evitare in INGLESE (Es: "drums, percussion, vocals, low quality").

Rispondi SOLO con un oggetto JSON valido.`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        main_prompt_ita: { type: Type.STRING },
                        technical_parameters: { type: Type.STRING },
                        justification: { type: Type.STRING },
                        stability_prompt: { type: Type.STRING, description: "Optimized prompt for Stability AI" },
                        negative_prompt: { type: Type.STRING, description: "Negative prompt for Stability AI" }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "stability_prompt", "negative_prompt"]
                }
            }
        });

        // FIX: Add null check for response.text
        const jsonText = response.text?.trim();

        if (!jsonText) {
            throw new Error("Empty response from AI");
        }

        const result = JSON.parse(jsonText) as MusicGenerationPrompt;

        return result;

    } catch (e) {
        console.error("Errore nella chiamata all'API Gemini per il prompt Stability AI:", e);
        throw new Error("Impossibile generare il prompt musicale per Stability AI.");
    }
}