import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult } from "../types";
import { fileToBase64 } from "../utils/fileUtils";

// --- CONFIGURAZIONE CHIAVE ---
// Incolla qui la tua chiave Google Gemini (inizia con AIza...)
const GOOGLE_API_KEY = "AIzaSyBtEtAu3W09-UAp7J0mc2x07HwvQt3UqAE";

export async function describeImageContent(imageFile: File): Promise<string> {
    // Controllo manuale della chiave
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("INSERISCI")) {
        throw new Error("Chiave API Google mancante. Inseriscila nel file geminiService.ts");
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

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
            model: 'gemini-2.0-flash', // Usa il modello flash che è più veloce ed economico
            contents: { parts: [imagePart, textPart] }
        });
        return response.text?.trim() || "Descrizione non disponibile";
    } catch (e) {
        console.error("Errore Gemini Descrizione:", e);
        // Non blocchiamo tutto se fallisce la descrizione, torniamo un testo generico
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

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("INSERISCI")) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    const textPart = {
        text: `RUOLO: Sei un esperto di Prompt Engineering per **STABILITY AI - STABLE AUDIO**.
OBIETTIVO: Creare metadati musicali partendo da dati visivi.

INPUT:
1.  **VISUAL:** "${imageDescription}"
2.  **DATI:**
    -   Tradizione: '${tradition.name}' ('${tradition.character}')
    -   Saturazione ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Varianza ${analysisStats.avg_variance.toFixed(2)}
    -   Scan: '${scanPatternName}'

OUTPUT RICHIESTO (JSON):
Genera un JSON valido con:
- **main_prompt_ita**: Descrizione sintetica (IT).
- **technical_parameters**: Parametri tecnici (BPM, Key).
- **justification**: Motivo della scelta.
- **stability_prompt**: Prompt INGLESE per Stability AI. (Es: "Atmospheric, [Instrument], [Mood], slow tempo").
- **negative_prompt**: Elementi da evitare INGLESE.

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
                        stability_prompt: { type: Type.STRING },
                        negative_prompt: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "stability_prompt", "negative_prompt"]
                }
            }
        });

        const jsonText = response.text?.trim();

        if (!jsonText) {
            // Fallback manuale se l'AI risponde vuoto
            return {
                main_prompt_ita: "Composizione generata da analisi cromatica",
                technical_parameters: "120 BPM, C Major",
                justification: "Fallback algoritmico",
                stability_prompt: "Ambient electronic soundscape, meditative, high quality",
                negative_prompt: "drums, noise, low quality"
            };
        }

        return JSON.parse(jsonText) as MusicGenerationPrompt;

    } catch (e) {
        console.error("Errore Gemini Prompt:", e);
        // Fallback di emergenza per non bloccare l'utente
        return {
            main_prompt_ita: "Generazione basata su algoritmi deterministici",
            technical_parameters: "Auto BPM",
            justification: "Errore connessione AI, uso parametri standard.",
            stability_prompt: "Cinematic score, emotional, orchestral, clear sound",
            negative_prompt: "percussion, text, speech"
        };
    }
}