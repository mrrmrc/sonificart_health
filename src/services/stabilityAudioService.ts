const STABILITY_API_KEY = "sk-napribfKqSbLsQNmSg2CPfjzpqRLv1tNvZ9AWcXztELQk6oI";

/**
 * Generates audio using Stability AI's Stable Audio v2.0
 * Implements polling as the API is asynchronous.
 */
export async function generateStabilityAudio(
    prompt: string,
    negativePrompt: string = "",
    durationSeconds: number = 45
): Promise<Blob> {
    if (!STABILITY_API_KEY) {
        throw new Error("Stability API Key missing");
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("output_format", "mp3");
    if (negativePrompt) {
        formData.append("negative_prompt", negativePrompt);
    }
    // Note: aspect_ratio and other params can be added here if needed

    // Step 1: Start the generation
    const response = await fetch("https://api.stability.ai/v2beta/stable-audio/generate", {
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
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 24; // 2 minutes total
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`Polling Stability AI (Attempt ${attempts})...`);

        const resultResponse = await fetch(`https://api.stability.ai/v2beta/stable-audio/result/${id}`, {
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
            return await resultResponse.blob();
        }

        // If we get here, it's an error status (4xx or 5xx)
        const errorText = await resultResponse.text();
        throw new Error(`Stability AI Polling Error: ${resultResponse.status} - ${errorText}`);
    }

    throw new Error("Stability AI Generation timed out after 2 minutes.");
}
