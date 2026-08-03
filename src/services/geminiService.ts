import { GoogleGenAI, Type } from "@google/genai";
import { MusicGenerationPrompt, Tradition, BlockAnalysisResult, HealthClassificationResult } from "../types";
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
    } catch (e) {
        console.warn("API Key non trovata nel DB, uso fallback o vuota", e);
    }
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
            model: 'gemini-2.5-flash',
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

    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer senior, specializzato nella "FUSIONE SEMANTICA" tra dati visivi e traduzioni culturali musicali per AI generative (Suno, Udio, Soundverse.ai).

OBIETTIVO: Creare una guida musicale che sia un ibrido perfetto tra il "Soggetto dell'Immagine" e la "Tradizione Musicale" suggerita dal framework SonificA.R.T.

DATI DI INPUT:
- SOGGETTO VISIVO (CRITICO): "${imageDescription}"
- TRADIZIONE MUSICALE: '${tradition.name}' (Carattere: '${tradition.character}')
- Descrizione Cultura: "${tradition.description}"
- Statistiche Colore (CIE LAB): Saturazione al ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Diversità cromatica al ${(analysisStats.hue_diversity * 100).toFixed(0)}%
- DURATA DA RISPETTARE: ${durationSeconds.toFixed(1)} secondi.
- Pattern di Scansione: '${scanPatternName}'

REQUISITI DI FUSIONE SEMANTICA (MANDATORI):
1. **Iniezione Parole Chiave Visive**: Devi inserire nel prompt i termini chiave estratti dal SOGGETTO VISIVO ("${imageDescription}").
2. **Ibridazione Strumentale**: Non limitarti alla strumentazione classica della tradizione '${tradition.name}'. Inventa suoni ibridi basati sull'immagine.
3. **Atmosfera Contestuale**: L'atmosfera deve riflettere il luogo/soggetto dell'immagine.
4. **FEDELTÀ AL RIFERIMENTO (CRITICO)**: Il prompt deve ordinare all'AI di restare estremamente fedele alla struttura armonica e ritmica del file WAV caricato. Usa tag come "[Very faithful to reference]", "[Maintain original melody]", "[Instrumental focus]".

FORZATURA DURATA SUNO (CRITICO):
- Inizia SEMPRE con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [Fast Ending], [No Extension], [Strictly Instrumental], [No Vocals]".
- Termina SEMPRE con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".

STRUTTURA OUTPUT RICHIESTA (JSON):
- **main_prompt_ita**: Descrizione poetica e tecnica che spieghi come la musicalità '${tradition.name}' descriva specificamente '${imageDescription}'.
- **technical_parameters**: BPM, Chiave, Scala, e Strumentazione Ibrida suggerita.
- **justification**: Spiegazione di come il soggetto visivo sia stato fuso con la tradizione musicale.
- **suno_prompt**: Il mega-prompt di tag per Suno AI.
- **udio_prompt**: Tag separati da virgola per Udio AI.
- **soundverse_prompt**: Prompt formattato per Soundverse.ai. Formato: "Genre: [Genere] | Tempo: Auto BPM | Key: [Chiave] | Style: [Atmosfera] | Instruments: [Strumenti] | Reference Sync: [Maintain original scan melody] | Duration: ${durationSeconds.toFixed(0)}s".
- **negative_prompt**: Elementi da evitare.
- **suno_lyrics**: Marcatori temporali e tag strutturali strumentali ESCLUSIVAMENTE in parentesi quadre per obbligare la durata di ${durationSeconds.toFixed(0)} secondi.

Rispondi SOLO con il JSON.`
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
                        suno_prompt: { type: Type.STRING },
                        udio_prompt: { type: Type.STRING },
                        soundverse_prompt: { type: Type.STRING },
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "soundverse_prompt", "negative_prompt", "suno_lyrics"]
                }
            }
        });

        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("Risposta vuota da Gemini");
        return JSON.parse(jsonText) as MusicGenerationPrompt;
    } catch (e) {
        console.error("Errore Gemini Prompt:", e);
        return {
            main_prompt_ita: "Generazione basata su algoritmi deterministici",
            technical_parameters: "Auto BPM",
            justification: "Errore connessione AI, uso parametri standard.",
            suno_prompt: "[Experimental], [Instrumental], [Cinematic], [Ambient]",
            udio_prompt: "experimental, instrumental, cinematic, ambient",
            soundverse_prompt: "Genre: Cinematic Ambient | Style: Experimental | Instruments: Synthesizer | Duration: 60s",
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
    durationSeconds: number,
    healthClassification?: HealthClassificationResult | null
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

    const configBpm = healthClassification?.primaryCategory.targetBpm || 74;

    const healthSection = healthClassification
        ? `
--- INIZIO CLASSIFICAZIONE TERAPEUTICA VISIVA ---
${healthClassification.promptFragment}
--- FINE CLASSIFICAZIONE TERAPEUTICA VISIVA ---`
        : `5. **RAG (DOCUMENTO PDF ALLEGATO)**: Se è presente un documento PDF allegato a questa conversazione, applica tutte le sue linee guida (es. WHO Health Evidence Report) per massimizzare il potenziale curativo e di benessere della sonificazione.`;

    const textPart = {
        text: `RUOLO: Sei un esperto Music Prompt Engineer senior, specializzato nella creazione di musica terapeutica e per il benessere per AI generative (Suno, Udio, Soundverse.ai).

OBIETTIVO: Creare un prompt musicale che promuova attivamente il benessere psicofisico, l'energia vitale, la socializzazione o la riduzione dello stress MA CON UNA REGOLA CRITICA: EVITARE QUALSIASI ELEMENTO CHE PROVOCHI SONNO, LETARGIA O RILASSAMENTO PROFONDO DA NINNA NANNA.

DATI DI INPUT:
- SOGGETTO VISIVO: "${imageDescription}"
- TRADIZIONE MUSICALE: '${tradition.name}' (Carattere: '${tradition.character}')
- ISTRUZIONI AMMINISTRATORE (DA RISPETTARE TASSATIVAMENTE): "${adminPrompt}"
- Statistiche Colore (CIE LAB): Saturazione al ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Diversità cromatica al ${(analysisStats.hue_diversity * 100).toFixed(0)}%
- DURATA DA RISPETTARE: ${durationSeconds.toFixed(1)} secondi.
- Pattern di Scansione: '${scanPatternName}'
- BPM CLINICO WHO RIGIDO: ${configBpm} BPM

REQUISITI DI FUSIONE E SALUTE (MANDATORI):
1. **Benessere Attivo**: Il brano deve stimolare la mente, favorire emozioni positive, dare energia, o supportare l'espressione emotiva e la vitalità.
2. **DIVIETO ASSOLUTO DI EFFETTO SONNIFERO**: Non usare termini come "lullaby", "sleepy", "deep relaxation", "droning", "somnolent". Scegli invece "uplifting", "energizing", "bright", "mindful", "active wellness".
3. **Integrazione Cultura**: Fonda la tradizione musicale con il Soggetto Visivo.
4. **FEDELTÀ AL RIFERIMENTO**: Il prompt deve ordinare all'AI di restare fedele alla struttura armonica e ritmica del file WAV caricato. Usa tag come "[Maintain original melody]", "[Instrumental focus]".
${healthSection}

FORZATURA E COMPLETEZZA PROMPT (MANDATORI):
- suno_prompt: Inizia SEMPRE con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [${configBpm} BPM], [Strict Tempo], [Strictly Instrumental], [No Vocals]". Includi la scala, gli strumenti clinici WHO, i filtri spettrali ed i tag di sincronizzazione alla melodia di riferimento. Termina con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".
- udio_prompt: Tag separati da virgola includendo ${configBpm} BPM, genere, strumentazione clinica e riferimento audio.
- soundverse_prompt: Prompt strutturato per Soundverse.ai in formato: "Genre: Cinematic Health Ambient | Tempo: ${configBpm} BPM | Key: [Chiave/Scala] | Style: Mindful, ${healthClassification?.primaryCategory.label || 'Wellness'} | Instruments: [Strumenti Clinici WHO] | Spectrum: Low-pass filter <3.5kHz | Reference Sync: [Maintain original scan melody] | Duration: ${durationSeconds.toFixed(0)}s".

STRUTTURA OUTPUT RICHIESTA (JSON):
- **main_prompt_ita**: Descrizione poetica e tecnica del brano.
- **technical_parameters**: BPM, Chiave, Scala, e Strumentazione coerenti con le direttive WHO.
- **justification**: Spiegazione di come il prompt rispetti le direttive WHO SPECIFICHE.
- **suno_prompt**: Il mega-prompt di tag per Suno.
- **udio_prompt**: Tag separati da virgola per Udio.
- **soundverse_prompt**: Il prompt strutturato per Soundverse.ai.
- **negative_prompt**: Elementi da evitare (OBBLIGATORIAMENTE includere termini soporiferi o noiosi).
- **suno_lyrics**: Marcatori temporali.

Rispondi SOLO con il JSON.`
    };

    const parts: any[] = [textPart];

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
            model: 'gemini-2.5-flash',
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
                        soundverse_prompt: { type: Type.STRING },
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "soundverse_prompt", "negative_prompt", "suno_lyrics"]
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
            technical_parameters: `${configBpm} BPM`,
            justification: "Errore AI, fallback attivato.",
            suno_prompt: `[Duration: ${durationSeconds.toFixed(0)}s], [${configBpm} BPM], [Strictly Instrumental], [Uplifting], [Positive Energy]`,
            udio_prompt: `uplifting, energizing, instrumental, ${configBpm} bpm`,
            soundverse_prompt: `Genre: Cinematic Health Ambient | Tempo: ${configBpm} BPM | Style: Mindful Wellness | Instruments: Cello, Flute, Soft Pad | Duration: ${durationSeconds.toFixed(0)}s`,
            negative_prompt: "lullaby, sleepy, droning",
            suno_lyrics: "[0:00] Intro, [End]"
        };
    }
}

export async function extractDirectivesFromPDF(pdfUrl: string): Promise<string> {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) throw new Error("Chiave API Google mancante.");

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Errore nel recupero del PDF");
    const blob = await response.blob();
    const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const pdfPart = {
        inlineData: { mimeType: 'application/pdf', data: base64Pdf },
    };
    const textPart = {
        text: `Sei un esperto neuroscienziato clinico e musicoterapeuta senior. Analizza questo documento ufficiale (es. WHO Health Evidence Network Report 67) in modo ESTREMAMENTE APPROFONDITO ed esaustivo.

Estrai le direttive medico-musicali dettagliate per ciascuna delle 5 categorie di intervento salute/benessere. Per OGNI categoria (Calming/Stress, Regolazione Fisiologica/Dolore, Cognitivo/Motorio, Connessione Sociale/Emotiva, Motivazione/Adesione), specifica in dettaglio:
1. TEMPO & RITMO: Range di BPM clinici e pattern ritmici (es. entrainment, Iso-principio, RAS Auditory Motor Cueing).
2. ARMONIA & SCALE: Struttura armonica, scale e intervalli consigliati vs intervalli vietati.
3. TIMBRO & SPETTRO: Inviluppi timbrici, spettrali (taglio frequenze in kHz) e strumentazione clinica raccomandata.
4. DINAMICA & LUFS: Range dinamico e gestione dei transienti/inviluppi.
5. OBIETTIVO NEUROFISIOLOGICO: Target neurofisiologico specifico (tono vagale, cortisolo, ossitocina, dopamina striatale, cueing motorio).

Fornisci una sintesi ad alta precisione scientifica e clinica (ampia e dettagliata, circa 400-600 parole), ben formattata per punti per ciascuna delle 5 categorie.`
    };
    try {
        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [pdfPart, textPart] }
        });
        return aiResponse.text?.trim() || "";
    } catch (e) {
        console.error("Errore Gemini PDF Extraction:", e);
        throw e;
    }
}

export async function generateAiComposerPrompt(
    tradition: Tradition,
    analysisStats: BlockAnalysisResult['globalStats'],
    imageDescription: string,
    durationSeconds: number,
    healthClassification?: HealthClassificationResult | null,
    melodyNotesSequence?: string
): Promise<MusicGenerationPrompt> {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Google mancante.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const configBpm = healthClassification?.primaryCategory.targetBpm || 74;

    const healthSection = healthClassification
        ? `
--- CLASSIFICAZIONE OLISTICA TERAPEUTICA WHO ---
${healthClassification.promptFragment}
--- FINE CLASSIFICAZIONE WHO ---`
        : `Applica tutte le linee guida del WHO Health Evidence Network Report 67 per la composizione medica e terapeutica.`;

    const textPart = {
        text: `RUOLO: Sei un Maestro Compositore AI Senior e Neuroscienziato della Musica, specializzato nell'interpretazione OLISTICA delle opere d'arte visiva secondo i principi clinici del WHO (Health Evidence Network Report 67).

SVOLGIMENTO (PARADIGMA AI COMPOSER):
Non sei vincolato da una traduzione matematica nota-per-nota pixel-per-pixel. Agisci invece come un compositore umano/AI che valuta l'opera d'arte nella sua totalità (contenuto visivo, colori, atmosfera, carica emotiva) e compone un'opera musicale originale perfettamente orientata al benessere ed all'obiettivo medico identificato, basandosi sulla linea melodica estratta dall'opera.

DATI DI INPUT:
- OPERA D'ARTE (SOGGETTO VISIVO): "${imageDescription}"
- TRADIZIONE E CARATTERE MUSICALE: '${tradition.name}' (Profilo: '${tradition.character}')
- LINEA MELODICA ESTRATTA DAI PIXEL DELL'OPERA: "${melodyNotesSequence || 'D4 - E4 - G4 - A4 - C5'}"
- BPM CLINICO TARGET WHO: ${configBpm} BPM
- DURATA ESATTA DA RISPETTARE: ${durationSeconds.toFixed(0)} secondi.
- STATISTICHE CROMATICHE: Saturazione ${(analysisStats.avg_saturation * 100).toFixed(0)}%, Diversità cromatica ${(analysisStats.hue_diversity * 100).toFixed(0)}%
${healthSection}

REQUISITI DI SINFONIA PITTORICO-CLINICA WHO (MANDATORI E CRUCIALI):
1. **Inclusione della Linea Melodica Estratta (FONDAMENTALE)**:
   Includi ESPLICITAMENTE nei prompt la LINEA MELODICA / MOTIVO NOTA ESTRATTO DALLE SCANSIONI DEI PIXEL ("${melodyNotesSequence || 'D4 - E4 - G4 - A4'}"), di modo che l'AI musicale segua il tema melodico preciso derivato dall'opera visiva.

2. **Inclusione dello Stile Pittorico e del Soggetto dell'Opera**:
   Includi lo STILE ARTISTICO / PITTORICO dell'opera (es. Impressionismo di Monet, Cubismo Geometrizzato, Barocco Chiaroscuro, Arte Moderna Astratta, Rinascimentale) ed il SOGGETTO VISIVO ("${imageDescription}").

3. **Formattazione dei Prompt per i Motori AI**:
   - **soundverse_prompt**: DEVE INIZIARE CON TEMA VISIVO E LINEA MELODICA ESTRATTA:
     "Visual Theme: [Stile Pittorico & Soggetto dell'Opera: es. Monet Impressionism Water Lilies / Modern Abstract Cubist Geometry] | Reference Melody Theme: [${melodyNotesSequence || 'Main Motif'}] | Genre: Cinematic Health Composition | Style: Holistic ${healthClassification?.primaryCategory.label || 'Wellness'} | Mood: [Atmosfera Emozionale] | Tempo: ${configBpm} BPM | Instruments: [Strumenti Clinici WHO ed evocativi dello stile pittorico] | Duration: ${durationSeconds.toFixed(0)}s"
   - **suno_prompt**: Inizia con: "[Duration: ${durationSeconds.toFixed(0)}s], [Strictly ${durationSeconds.toFixed(0)} seconds limit], [${configBpm} BPM], [Visual Style: Stile Pittorico dell'Opera], [Melodic Motif: ${melodyNotesSequence || 'Main Motif'}], [Subject: ${imageDescription}], [Strictly Instrumental], [No Vocals]". Termina con: "[Outro: Dissolve at ${durationSeconds.toFixed(0)}s], [End at ${durationSeconds.toFixed(0)}s], [Silence], [End]".
   - **udio_prompt**: Tag descrittivi che combinano lo stile pittorico dell'opera, la linea melodica (${melodyNotesSequence}), il soggetto visivo, ${configBpm} BPM, genere e strumentazione clinica WHO.

4. **Analisi Semantico-Iconografica dell'Opera (MANDATORIO per semantic_analysis)**:
   Fornisci l'oggetto JSON semantic_analysis che spiega l'impatto visivo sul suono:
   - facial_expressions: Descrizione delle espressioni facciali o della carica emotiva dei soggetti visivi.
   - materials_objects: Array di oggetti e materiali riconosciuti (es. ["Armature metalliche", "Cavalli", "Legno"]).
   - natural_elements: Presenza di elementi naturali (es. "Cielo tempestoso", "Luce naturale", "Acqua").
   - pictorial_style: Stile pittorico dell'opera (es. "Rinascimentale / Drammatico", "Impressionista", "Moderno Astratto").
   - acoustic_impact: Spiegazione trasparente dell'impatto acustico.

5. **Generazione Hotspot Visivi per l'HUD sull'Immagine (MANDATORIO 3-5 hotspots)**:
   Fornisci l'array hotspots con 3-5 pin visivi localizzati nell'immagine:
   - id: identificativo univoco (es. "pin_1", "pin_2").
   - label: Titolo del pin (es. "Volti & Emozioni", "Armature Metalliche", "Luce & Chiaroscuro", "Target Clinico WHO").
   - category: uno tra "emotions", "materials", "style", "who_target".
   - x_percent (15-85) e y_percent (15-85): posizione percentuale approssimativa dell'elemento.
   - description: Cosa rileva la Vision AI in quel punto dell'opera.
   - reasoning_step: Spiegazione del ragionamento dell'AI (es. "Fase 2: L'AI rileva forte drammaticità visiva e la associa ad un timbro di archi in registro grave").
   - acoustic_effect: Impatto acustico (es. "Violoncello solo + Percussioni bronzee").

Rispondi SOLO con il JSON con campi: main_prompt_ita, technical_parameters, justification, suno_prompt, udio_prompt, soundverse_prompt, negative_prompt, suno_lyrics, semantic_analysis.`
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
                        suno_prompt: { type: Type.STRING },
                        udio_prompt: { type: Type.STRING },
                        soundverse_prompt: { type: Type.STRING },
                        negative_prompt: { type: Type.STRING },
                        suno_lyrics: { type: Type.STRING },
                        semantic_analysis: {
                            type: Type.OBJECT,
                            properties: {
                                facial_expressions: { type: Type.STRING },
                                materials_objects: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                natural_elements: { type: Type.STRING },
                                pictorial_style: { type: Type.STRING },
                                acoustic_impact: { type: Type.STRING },
                                hotspots: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            label: { type: Type.STRING },
                                            category: { type: Type.STRING },
                                            x_percent: { type: Type.NUMBER },
                                            y_percent: { type: Type.NUMBER },
                                            description: { type: Type.STRING },
                                            reasoning_step: { type: Type.STRING },
                                            acoustic_effect: { type: Type.STRING }
                                        },
                                        required: ["id", "label", "category", "x_percent", "y_percent", "description", "reasoning_step", "acoustic_effect"]
                                    }
                                }
                            },
                            required: ["facial_expressions", "materials_objects", "natural_elements", "pictorial_style", "acoustic_impact", "hotspots"]
                        }
                    },
                    required: ["main_prompt_ita", "technical_parameters", "justification", "suno_prompt", "udio_prompt", "soundverse_prompt", "negative_prompt", "suno_lyrics", "semantic_analysis"]
                }
            }
        });
        const jsonText = response.text?.trim();
        if (!jsonText) throw new Error("Risposta vuota da Gemini AI Composer");
        return JSON.parse(jsonText) as MusicGenerationPrompt;
    } catch (e) {
        console.error("Errore Gemini AI Composer Prompt:", e);
        return {
            main_prompt_ita: `Composizione Olistica Terapeutica WHO: ${imageDescription}`,
            technical_parameters: `${configBpm} BPM`,
            justification: "Composizione AI basata sull'interpretazione olistica dell'opera d'arte.",
            suno_prompt: `[Duration: ${durationSeconds.toFixed(0)}s], [${configBpm} BPM], [Visual Theme: ${imageDescription}], [Strictly Instrumental], [Holistic Composition]`,
            udio_prompt: `visual theme: ${imageDescription}, holistic, therapeutic, instrumental, ${configBpm} bpm`,
            soundverse_prompt: `Visual Theme: ${imageDescription} | Genre: Cinematic Health Composition | Tempo: ${configBpm} BPM | Style: Holistic Wellness | Instruments: Cello, Flute, Piano | Duration: ${durationSeconds.toFixed(0)}s`,
            negative_prompt: "lullaby, noisy, harsh",
            suno_lyrics: "[0:00] Intro, [End]",
            semantic_analysis: {
                facial_expressions: "Carica emotiva ed espressiva visiva dell'opera",
                materials_objects: ["Elementi visivi dell'opera"],
                natural_elements: "Atmosfera e luce naturale",
                pictorial_style: "Stile artistico visivo",
                acoustic_impact: "Gli elementi visivi orientano la strumentazione ed il timbro acustico.",
                hotspots: [
                    {
                        id: "pin_1",
                        label: "Volti ed Emozioni",
                        category: "emotions",
                        x_percent: 50,
                        y_percent: 35,
                        description: "Espressioni facciali ed atmosfera espressiva centrale dell'opera",
                        reasoning_step: "Fase 2 (Vision AI): L'AI rileva la drammaticità della scena e la converte in armonie espressive in registro grave.",
                        acoustic_effect: "Violoncello Solo & Archi ad alta tensione"
                    },
                    {
                        id: "pin_2",
                        label: "Oggetti & Strutture",
                        category: "materials",
                        x_percent: 30,
                        y_percent: 65,
                        description: "Texture di materiali (metalli, legni, elementi architettonici)",
                        reasoning_step: "Fase 3 (WHO Impact): L'AI associa la consistenza dei materiali a percussioni metalliche e risonanze bronzee.",
                        acoustic_effect: "Glockenspiel & Percussioni Bronzee"
                    },
                    {
                        id: "pin_3",
                        label: "Target Clinico WHO",
                        category: "who_target",
                        x_percent: 70,
                        y_percent: 50,
                        description: `Target clinico principale ad ${configBpm} BPM`,
                        reasoning_step: `Fase 4 (Composizione WHO): Sintonizzazione dei transienti ritmici a ${configBpm} BPM per l'entrainment neurofisiologico.`,
                        acoustic_effect: `Entrainment Ritmico a ${configBpm} BPM`
                    }
                ]
            }
        };
    }
}
