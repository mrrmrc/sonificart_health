const STABILITY_API_KEY = (import.meta as any)?.env?.VITE_STABILITY_API_KEY || "sk-napribfKqSbLsQNmSg2CPfjzpqRLv1tNvZ9AWcXztELQk6oI";

/**
 * Generates audio using Stability AI's Stable Audio v2.0
 * Implements Audio-to-Audio (structure guidance) and PDC (Precision Duration Control).
 */
export async function generateStabilityAudio(
    prompt: string,
    negativePrompt: string = "",
    durationSeconds: number = 45,
    referenceAudio?: Blob
): Promise<Blob> {
    console.log("--- STABILITY SERVICE V2.1 ACTIVATED (Endpoint: stable-audio-2) ---");
    if (!STABILITY_API_KEY) {
        throw new Error("Stability API Key missing. Please configure VITE_STABILITY_API_KEY.");
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("output_format", "mp3");
    formData.append("seconds_total", Math.min(Math.round(durationSeconds), 120).toString()); // Stability limit is 120-180s depending on plan

    if (negativePrompt) {
        formData.append("negative_prompt", negativePrompt);
    }

    // Modalità AUDIO-TO-AUDIO: Usiamo il WAV della sonificazione come guida strutturale
    if (referenceAudio) {
        console.log("Using Audio-to-Audio reference for perfect sync...");
        formData.append("audio_source", referenceAudio);
    }

    // Step 1: Start the generation - FIXED ENDPOINT to avoid 404 (stable-audio-2)
    const response = await fetch("https://api.stability.ai/v2beta/audio/stable-audio-2/generate", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${STABILITY_API_KEY}`,
            "Accept": "application/json"
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stability AI Init Error: ${response.status} - ${errorText}`);
    }

    const { id } = await response.json();
    console.log(`Stability AI Generation Started. Task ID: ${id}`);

    // Step 2: Poll for completion
    const pollInterval = 4000; // 4 seconds
    const maxAttempts = 30; // 2 minutes total
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Polling Stability AI (Attempt ${attempts}/ ${maxAttempts})...`);

        const resultResponse = await fetch(`https://api.stability.ai/v2beta/audio/stable-audio-2/result/${id}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${STABILITY_API_KEY}`,
                "Accept": "audio/*"
            }
        });

        if (resultResponse.status === 202) {
            // Still processing
            await new Promise(r => setTimeout(r, pollInterval));
            continue;
        }

        if (resultResponse.status === 200) {
            // Success!
            const audioBlob = await resultResponse.blob();
            console.log("Stability AI Audio successfully generated!");
            return audioBlob;
        }

        // If we get here, it's an error status (4xx or 5xx)
        const errorText = await resultResponse.text();
        throw new Error(`Stability AI Polling Error: ${resultResponse.status} - ${errorText}`);
    }

    throw new Error("Stability AI Generation timed out after 2 minutes.");
}
