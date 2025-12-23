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
    console.log("--- STABILITY SERVICE V2.1 ACTIVATED (Model: stable-audio-2.5) ---");
    if (!STABILITY_API_KEY) {
        throw new Error("Stability API Key missing. Please configure VITE_STABILITY_API_KEY.");
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("model", "stable-audio-2.5");
    formData.append("output_format", "mp3");

    // DURATION CONTROL: Arrotondamento al secondo intero
    const finalDuration = Math.min(Math.max(Math.round(durationSeconds), 1), 180);
    formData.append("seconds_total", finalDuration.toString());

    // NATURAL QUALITY: Parametri bilanciati per evitare distorsioni digitali
    formData.append("cfg_scale", "7.5");
    formData.append("steps", "8");

    if (negativePrompt) {
        formData.append("negative_prompt", negativePrompt);
    }

    // Modalità AUDIO-TO-AUDIO: Usiamo il WAV della sonificazione come guida strutturale
    if (referenceAudio) {
        console.log("Using Audio-to-Audio guidance (Balanced Sync)...");
        formData.append("audio", referenceAudio);
        formData.append("content_strength", "0.45");
    }

    // Step 1: Start the generation - UPDATED ENDPOINT as per user suggestion
    // We strictly use stable-audio-2.5 as instructed.
    const endpointType = referenceAudio ? "audio-to-audio" : "text-to-audio";
    const primaryUrl = `https://api.stability.ai/v2beta/audio/stable-audio-2/${endpointType}`;

    console.log(`Stability AI: Calling ${endpointType} with model stable-audio-2.5...`);

    let response = await fetch(primaryUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${STABILITY_API_KEY}`,
            "Accept": "application/json"
        },
        body: formData
    });

    // FALLBACK: If 404, maybe the user's suggestion was slightly off or the model field handles the routing
    if (response.status === 404) {
        console.warn("Primary endpoint 404, attempting fallback to /stable-audio-2/generate...");
        response = await fetch("https://api.stability.ai/v2beta/audio/stable-audio-2/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STABILITY_API_KEY}`,
                "Accept": "application/json"
            },
            body: formData
        });
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stability AI Error (${response.status}): ${errorText}`);
    }

    const resultJson = await response.json();
    console.log("Stability AI Full Response Received.");

    // MODALITA' DIRETTA: Se l'API restituisce direttamente l'audio (base64)
    if (resultJson.audio) {
        console.log("Stability AI returned audio DIRECTLY (Base64). Decoding...");
        const byteCharacters = atob(resultJson.audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'audio/mpeg' });
    }

    const id = resultJson.id || resultJson.task_id || resultJson.job_id;

    if (!id) {
        throw new Error(`Stability AI Error: Response contains neither Audio nor Task ID. Response Preview: ${JSON.stringify(resultJson).substring(0, 100)}...`);
    }

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
