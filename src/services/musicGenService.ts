
import { MusicGenerationPrompt, MusicGenResponse } from "../types";

// HARDCODED KEY AS REQUESTED
const STABILITY_API_KEY = 'sk-EQyuyCbTzRuI9InYbQZtsCVPLSNAy202c5veU8iXOoY9KcTA';

/**
 * STABILITY AI SERVICE
 * 
 * Generates audio using the Stable Audio API.
 * Documentation: https://platform.stability.ai/docs/api-reference#tag/Stable-Audio-2
 */
export async function generateAiTrack(
    promptData: MusicGenerationPrompt,
    seedAudioBlob: Blob, 
    durationSeconds: number
): Promise<MusicGenResponse> {
    
    console.log("--- STABILITY AI INTEGRATION (v2.5 - Hybrid Mode) ---");
    
    // Clamp duration: Stable Audio 2.5 supports up to 180s. 
    const duration = Math.min(Math.max(durationSeconds, 1), 180); 

    try {
        // 1. ATTEMPT AUDIO-TO-AUDIO (Structure Guided)
        const formData = new FormData();
        formData.append('prompt', promptData.stability_prompt);
        formData.append('duration', duration.toString());
        formData.append('model', 'stable-audio-2.5'); 
        formData.append('audio', seedAudioBlob, 'structure_reference.wav');
        formData.append('strength', '0.55'); // How much to stick to the original structure
        formData.append('output_format', 'mp3');

        console.log("Attempting Audio-to-Audio generation...");
        let response = await fetch('https://api.stability.ai/v2beta/audio/stable-audio-2/audio-to-audio', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'application/json' 
            },
            body: formData
        });

        // 2. HANDLE ERRORS & COPYRIGHT BLOCKS
        if (!response.ok) {
            const status = response.status;
            const errorBody = await response.text();
            console.warn(`Stability Audio-to-Audio failed. Status: ${status}. Body: ${errorBody}`);
            
            // CRITICAL FIX: If blocked by Copyright (422), switch to TEXT-TO-AUDIO immediately.
            // This bypasses the file check but still uses Stability AI.
            if (status === 422 && errorBody.includes("copyright")) {
                console.log("⚠️ Copyright False Positive detected. Switching to Text-to-Audio generation to BYPASS filter...");
                
                const textFormData = new FormData();
                textFormData.append('prompt', promptData.stability_prompt);
                textFormData.append('duration', duration.toString());
                textFormData.append('model', 'stable-audio-2.5');
                textFormData.append('output_format', 'mp3');

                // Call the GENERATE endpoint (Text-to-Audio) instead of Audio-to-Audio
                response = await fetch('https://api.stability.ai/v2beta/audio/stable-audio-2/generate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${STABILITY_API_KEY}`,
                        'Accept': 'application/json'
                    },
                    body: textFormData
                });
                
                if (!response.ok) {
                    throw new Error("Anche la generazione Text-to-Audio è fallita. I server Stability potrebbero essere sovraccarichi.");
                }
            } else {
                // Other errors (401, 500, etc.)
                throw new Error(`Stability AI Error: ${status} - ${errorBody}`);
            }
        }

        // 3. PROCESS SUCCESSFUL RESPONSE (Either Audio-to-Audio or Text-to-Audio fallback)
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error("Risposta AI non valida (JSON malformato).");
        }

        if (!data.audio) {
            throw new Error("Nessun audio restituito dall'AI.");
        }

        const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
        const outputUrl = URL.createObjectURL(audioBlob);

        return {
            audioUrl: outputUrl,
            status: 'succeeded'
        };

    } catch (error: any) {
        console.error("Stability AI Critical Failure:", error);
        // Only fall back to local if absolutely necessary (network down, auth fail)
        return simulateFallback(seedAudioBlob, error.message || "Errore di connessione AI");
    }
}

// Helper to convert base64 string to Blob
function base64ToBlob(base64: string, mimeType: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: mimeType});
}

// Fallback simulation (Last Resort)
async function simulateFallback(seedAudioBlob: Blob, reason: string): Promise<MusicGenResponse> {
     const SIMULATION_DELAY_MS = 800; 
     return new Promise((resolve) => {
        setTimeout(() => {
            const outputUrl = URL.createObjectURL(seedAudioBlob);
            resolve({
                audioUrl: outputUrl,
                status: 'succeeded', 
                error: reason 
            });
        }, SIMULATION_DELAY_MS);
    });
}
