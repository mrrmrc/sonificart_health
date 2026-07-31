import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult } from "../types";
import { fileToBase64 } from "../utils/fileUtils";

// --- CONFIGURAZIONE CHIAVE ---
import { api as backendApi } from './api';

let cachedApiKey: string | null = null;
let lastApiKeyFetchTime = 0;

export async function getGeminiApiKey(): Promise<string> {
    if (cachedApiKey && (Date.now() - lastApiKeyFetchTime < 60000 * 5)) return cachedApiKey;
    try {
        const keyRaw = await backendApi.getAppSetting('gemini_api_key');
        const cleanKey = keyRaw ? keyRaw.replace(/<[^>]*>?/gm, '').trim() : '';
        if (cleanKey) {
            cachedApiKey = cleanKey;
            lastApiKeyFetchTime = Date.now();
            return cleanKey;
        }
    } catch(e) {
        console.warn("API Key non trovata nel DB, uso fallback o vuota", e);
    }
    // Fallback alla vecchia chiave per non rompere il sistema (se ancora attiva) o restituire vuoto
    return "AIzaSyBtEtAu3W09-UAp7J0mc2x07HwvQt3UqAE"; 
}
export async function describeImageContent(imageFile: File): Promise<string> {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
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

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // PROMPT ALTAMENTE DETTAGLIATO - FUSIONE SEMANTICA AGGRESSIVA - FORZATURA DURATA
    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer senior, specializzato nella "FUSIONE SEMANTICA" tra dati visivi e traduzioni culturali musicali per AI generative (Suno, Udio).

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
4. **FEDELTÀ AL RIFERIMENTO (CRITICO)**: Il prompt deve ordinare all'AI di restare estremanente fedele alla struttura armonica e ritmica del file WAV caricato. Usa tag come "[Very faithful to reference]", "[Maintain original melody]", "[Instrumental focus]".

FORZATURA DURATA SUNO (CRITICO):
- Inizia SEMPRE con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [Fast Ending], [No Extension], [Strictly Instrumental], [No Vocals]".
- Termina SEMPRE con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".

REGOLE PER "suno_lyrics" (IMPORTANTE):
- NON SCRIVERE TESTO POETICO O DESCRIZIONI FUORI DAI MARKER.
- Usa solo marcatori temporali e tag musicali brevi tra parentesi quadre.
- Esempio corretto: "[0:00] [Intro Instrumental] [0:30] [Middle Section Instrumental] [End at ${durationSeconds.toFixed(0)}s]"
- Evita formati come "[0:00] La voce dice..." perché Suno la canterà. Usa solo istruzioni per l'orchestra/sintetizzatori.

STRUTTURA OUTPUT RICHIESTA (JSON):
- **main_prompt_ita**: Descrizione poetica e tecnica che spieghi come la musicalità '${tradition.name}' descriva specificamente '${imageDescription}'.
- **technical_parameters**: BPM, Chiave, Scala, e Strumentazione Ibrida suggerita.
- **justification**: Spiegazione di come il soggetto visivo sia stato fuso con la tradizione musicale.
- **suno_prompt**: Il mega-prompt di tag. DEVE contenere sia i tag musicali che i tag del SOGGETTO VISIVO.
- **udio_prompt**: Tag separati da virgola (Musicali + Visivi + Durata).
- **negative_prompt**: Elementi da evitare.
- **suno_lyrics**: Marcatori temporali e tag strutturali strumentali ESCLUSIVAMENTE in parentesi quadre per obbligare la durata di ${durationSeconds.toFixed(0)} secondi.

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
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "negative_prompt", "suno_lyrics"]
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
            negative_prompt: "percussion, text, speech",
            suno_lyrics: "[0:00] Intro, [0:30] Development, [End]"
        };
    }
}

export async function generateHealthEvidencePrompt(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    scanPatternName: string,
    imageDescription: string,
    durationSeconds: number
): Promise<MusicGenerationPrompt> {

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Google mancante.");
    }

    // Fetch Admin Configuration
    const adminPromptRaw = await backendApi.getAppSetting('agent_health_prompt');
    const adminDocUrlRaw = await backendApi.getAppSetting('agent_health_document');
    const adminPrompt = adminPromptRaw ? adminPromptRaw.replace(/<[^>]*>?/gm, '').trim() : '';
    const adminDocUrl = adminDocUrlRaw ? adminDocUrlRaw.replace(/<[^>]*>?/gm, '').trim() : '';

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Base knowledge string
    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer senior, specializzato nella creazione di musica terapeutica e per il benessere.

OBIETTIVO: Creare un prompt musicale che promuova attivamente il benessere psicofisico, l'energia vitale, la socializzazione o la riduzione dello stress MA CON UNA REGOLA CRITICA: EVITARE QUALSIASI ELEMENTO CHE PROVOCHI SONNO, LETARGIA O RILASSAMENTO PROFONDO DA NINNA NANNA.

DATI DI INPUT:
- SOGGETTO VISIVO: "${imageDescription}"
- TRADIZIONE MUSICALE: '${tradition.name}' (Carattere: '${tradition.character}')
- ISTRUZIONI AMMINISTRATORE (DA RISPETTARE TASSATIVAMENTE): "${adminPrompt}"
- Statistiche Colore (CIE LAB): Saturazione al ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Diversità cromatica al ${(analysisStats.hue_diversity * 100).toFixed(0)}%
- DURATA DA RISPETTARE: ${durationSeconds.toFixed(1)} secondi.
- Pattern di Scansione: '${scanPatternName}'

REQUISITI DI FUSIONE E SALUTE (MANDATORI):
1. **Benessere Attivo**: Il brano deve stimolare la mente, favorire emozioni positive, dare energia, o supportare l'espressione emotiva e la vitalità.
2. **DIVIETO ASSOLUTO DI EFFETTO SONNIFERO**: Non usare termini come "lullaby", "sleepy", "deep relaxation", "droning", "somnolent". Scegli invece "uplifting", "energizing", "bright", "mindful", "active wellness".
3. **Integrazione Cultura**: Fonda la tradizione musicale con il Soggetto Visivo.
4. **FEDELTÀ AL RIFERIMENTO**: Il prompt deve ordinare all'AI di restare fedele alla struttura armonica e ritmica del file WAV caricato. Usa tag come "[Maintain original melody]", "[Instrumental focus]".
5. **RAG (DOCUMENTO PDF ALLEGHATO)**: Se è presente un documento PDF allegato a questa conversazione, applica tutte le sue linee guida (es. WHO Health Evidence Report) per massimizzare il potenziale curativo e di benessere della sonificazione.

FORZATURA DURATA SUNO (CRITICO):
- Inizia SEMPRE con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [Fast Ending], [No Extension], [Strictly Instrumental], [No Vocals]".
- Termina SEMPRE con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".

STRUTTURA OUTPUT RICHIESTA (JSON):
- **main_prompt_ita**: Descrizione poetica e tecnica del brano, focalizzata sui benefici sul benessere.
- **technical_parameters**: BPM, Chiave, Scala, e Strumentazione.
- **justification**: Spiegazione di come il prompt rispetti le istruzioni dell'admin e l'eventuale PDF, mantenendo l'energia vitale.
- **suno_prompt**: Il mega-prompt di tag per Suno.
- **udio_prompt**: Tag separati da virgola per Udio.
- **negative_prompt**: Elementi da evitare (OBBLIGATORIAMENTE includere termini soporiferi o noiosi).
- **suno_lyrics**: Marcatori temporali.

Rispondi SOLO con il JSON.`
    };

    const parts: any[] = [textPart];

    // Se c'è un documento, scaricalo e allega a Gemini come PDF InlineData
    if (adminDocUrl) {
        try {
            const pdfResponse = await fetch(adminDocUrl);
            if (pdfResponse.ok) {
                const pdfBlob = await pdfResponse.blob();
                const pdfFile = new File([pdfBlob], "agent.pdf", { type: "application/pdf" });
                const base64Pdf = await fileToBase64(pdfFile);
                parts.push({
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: base64Pdf
                    }
                });
            } else {
                console.warn("Impossibile scaricare il PDF dell'agente:", adminDocUrl);
            }
        } catch (e) {
            console.error("Errore nel download o allegato del PDF dell'agente:", e);
        }
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: parts },
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
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "negative_prompt", "suno_lyrics"]
                }
            }
        });

        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("Risposta vuota da Gemini");
        return JSON.parse(jsonText) as MusicGenerationPrompt;
    } catch (e) {
        console.error("Errore Gemini Health Prompt:", e);
        return {
            main_prompt_ita: "Generazione Wellness standard",
            technical_parameters: "Auto BPM",
            justification: "Errore AI, fallback attivato.",
            suno_prompt: "[Uplifting], [Energizing], [Instrumental], [Positive Energy]",
            udio_prompt: "uplifting, energizing, instrumental, positive energy",
            negative_prompt: "lullaby, sleepy, droning",
            suno_lyrics: "[0:00] Intro, [End]"
        };
    }
}
