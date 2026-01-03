const API_BASE_URL = 'https://sonificart.com/api';
const randomUser = `test_${Date.now()}`;
const randomEmail = `${randomUser}@example.com`;
const randomPass = 'test1234';

async function runTest() {
    try {
        console.log(`1. Registering temp user: ${randomEmail}`);
        const regRes = await fetch(`${API_BASE_URL}/index.php?action=register`, {
            method: 'POST',
            body: JSON.stringify({ name: randomUser, email: randomEmail, password: randomPass }),
            headers: { 'Content-Type': 'application/json' }
        });
        const regData = await regRes.json();

        let token;
        let userId;

        if (regData.token) {
            token = regData.token;
            userId = regData.user.id;
        } else if (regData.error === 'Email esistente') {
            console.log("User exists, logging in...");
            const loginRes = await fetch(`${API_BASE_URL}/index.php?action=login`, {
                method: 'POST',
                body: JSON.stringify({ email: randomEmail, password: randomPass }),
                headers: { 'Content-Type': 'application/json' }
            });
            const loginData = await loginRes.json();
            token = loginData.token;
            userId = loginData.user.id;
        }

        if (!token) throw new Error("Could not get token");
        console.log(`2. Authenticated. Token: ${token.substring(0, 10)}...`);

        // 3. Save Sonification with Custom Title
        const customTitle = "MY_CUSTOM_TEST_TITLE_" + Date.now();
        console.log(`3. Saving sonification with title: "${customTitle}"`);

        const formData = new FormData();
        formData.append('auth_token', token);
        formData.append('imageHash', 'test_hash_' + Date.now());
        formData.append('paradigm', 'scientific');
        formData.append('title', customTitle);
        formData.append('traditionName', 'WRONG_NAME_SHOULD_NOT_APPEAR');

        // Minimal valid base64 images
        const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const emptyWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

        formData.append('imageUrl', pixel);
        formData.append('audioData', emptyWav);

        // Note: In real app, we send Blobs (imageFile, audioFile) via FormData
        // Here we simulate the fallback base64 or file upload if supported by server
        // The backend supports base64 input fields 'imageUrl' and 'audioData' if files are missing.
        // But let's check backend/index.php again... 
        // Yes: $imgUrl = isset($_FILES['imageFile']) ? ... : saveBase64File($input['imageUrl']...);

        const saveRes = await fetch(`${API_BASE_URL}/index.php?action=save_sonification&auth_token=${token}`, {
            method: 'POST',
            body: formData
        });
        const saveData = await saveRes.json();
        console.log("Save Response:", saveData);

        if (!saveData.success) throw new Error("Save failed: " + JSON.stringify(saveData));

        // 4. Fetch History
        console.log("4. Fetching history...");
        const histRes = await fetch(`${API_BASE_URL}/index.php?action=get_history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ auth_token: token }).toString()
        });
        const history = await histRes.json();

        if (!Array.isArray(history) || history.length === 0) {
            console.error("No history found!");
            return;
        }

        const latest = history[0];
        console.log("Latest Entry:", {
            id: latest.id,
            title: latest.title,
            traditionName: latest.traditionName
        });

        if (latest.title === customTitle) {
            console.log("SUCCESS: Title saved correctly!");
        } else {
            console.error(`FAILURE: Title mismatch! Expected "${customTitle}", got "${latest.title}"`);
        }

    } catch (e) {
        console.error("Test Error:", e);
    }
}

runTest();
