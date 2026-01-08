import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export interface FaceMetrics {
    yaw: number;   // Left/Right rotation (-1 to 1)
    pitch: number; // Up/Down rotation (-1 to 1)
    roll: number;  // Tilt (-1 to 1)
    x: number;     // Head X position normalized
    y: number;     // Head Y position normalized
    z: number;     // Distance (Zoom) - 0(Close) to 1(Far)

    // Expressions
    mouthOpen: number; // 0 to 1
    smile: number;     // 0 to 1
    eyebrowRise: number; // 0 to 1 -- Focus/Surprise

    // Eyes (Approximate Gaze)
    gazeX: number; // -1 (Left) to 1 (Right)
    gazeY: number; // -1 (Up) to 1 (Down)

    // Visualization
    landmarks?: { x: number, y: number }[]; // For drawing mesh

    isActive: boolean;
}

class WebcamService {
    private faceMesh: FaceMesh | null = null;
    private camera: Camera | null = null;
    private videoElement: HTMLVideoElement | null = null;

    // Current State
    private metrics: FaceMetrics = {
        yaw: 0, pitch: 0, roll: 0,
        x: 0.5, y: 0.5, z: 0.5,
        mouthOpen: 0, smile: 0, eyebrowRise: 0,
        gazeX: 0, gazeY: 0,
        isActive: false
    };

    public async initialize(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement;

        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true, // Crucial for Iris/Eyes
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.faceMesh && this.videoElement) {
                    await this.faceMesh.send({ image: this.videoElement });
                }
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
        this.metrics.isActive = true;
    }

    private onResults(results: any) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return; // No face detected
        }

        const landmarks = results.multiFaceLandmarks[0];

        // --- 1. HEAD POSE (Simplified Estimation) ---
        // Nose tip: 1, Left Eye: 33, Right Eye: 263
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        // Yaw: Difference in Z between eyes? No, better use X relativity
        const midEyeX = (leftEye.x + rightEye.x) / 2;
        const noseOffsetX = nose.x - midEyeX;
        // Sensitivity factor
        this.metrics.yaw = Math.max(-1, Math.min(1, noseOffsetX * 8)); // Amplified

        const midEyeY = (leftEye.y + rightEye.y) / 2;
        const noseOffsetY = nose.y - midEyeY;
        this.metrics.pitch = Math.max(-1, Math.min(1, noseOffsetY * 8));

        this.metrics.x = nose.x;
        this.metrics.y = nose.y;

        // Z estimation (Depth-invariant ref)
        const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);

        // CALIBRATION:
        // EyeDist 0.06 -> Approx 60cm (Far) -> z = 1.0
        // EyeDist 0.25 -> Approx 15cm (Close) -> z = 0.0
        // Formula: z = 1 - (eyeDist - 0.06) / (0.25 - 0.06)
        // Values < 0.06 (Very Far) -> z > 1 (Clamp to 1)
        // Values > 0.25 (Very Close) -> z < 0 (Clamp to 0)

        const rawZ = 1.0 - (eyeDist - 0.06) / 0.19;
        this.metrics.z = Math.max(0, Math.min(1, rawZ));

        // --- 2. EXPRESSIONS ---
        // Mouth: Top 13, Bottom 14
        const mouthTop = landmarks[13];
        const mouthBottom = landmarks[14];
        const mouthOpenDist = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);

        // Normalize mouth open by eye distance (scale invariant)
        const mouthOpenRatio = mouthOpenDist / eyeDist;
        this.metrics.mouthOpen = Math.min(1, Math.max(0, (mouthOpenRatio - 0.1) * 3)); // Threshold 0.1, Amp 3

        // Smile: Corners 61 (Left), 291 (Right). 
        const mouthLeft = landmarks[61];
        const mouthRight = landmarks[291];
        const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);

        // Normalize smile by eye distance
        const smileRatio = mouthWidth / eyeDist;
        // LOWER THRESHOLD: was 1.3, now 1.15 to be more sensitive
        this.metrics.smile = Math.min(1, Math.max(0, (smileRatio - 1.15) * 4));

        // --- 3. GAZE (Iris Tracking) ---
        // Iris: 468 (Left), 473 (Right)
        if (landmarks.length > 468) {
            const leftIris = landmarks[468];
            // Compare iris center to eye corners (33 and 133 for left eye)
            const lEyeLeft = landmarks[33];
            const lEyeRight = landmarks[133];
            const eyeWidth = Math.abs(lEyeLeft.x - lEyeRight.x);

            if (eyeWidth > 0) {
                const irisRelX = (leftIris.x - lEyeLeft.x) / eyeWidth;
                // 0.5 is center. < 0.5 Left, > 0.5 Right
                this.metrics.gazeX = (irisRelX - 0.5) * 4; // Normalized -1 to 1

                const eyeH = Math.abs(landmarks[159].y - landmarks[145].y); // Upper vs Lower lid
                const irisRelY = (leftIris.y - landmarks[159].y) / eyeH;
                this.metrics.gazeY = (irisRelY - 0.5) * 4;
            }
        }

        // --- 4. LANDMARKS FOR VISUALIZATION ---
        // Pass a subset of landmarks to draw face mesh
        // We only need a coarse mesh for the UI effect
        // 468 points is a lot to copy every frame, let's just pass the raw array reference?
        // Actually, let's map a subset for performance if needed, but for now copying is likely fine for 468 points.
        // Let's just map x,y to avoid sending full structure
        this.metrics.landmarks = landmarks.map((l: any) => ({ x: l.x, y: l.y }));
    }

    public getMetrics(): FaceMetrics {
        return { ...this.metrics };
    }

    public stop() {
        if (this.camera) {
            this.camera.stop();
        }
        if (this.faceMesh) {
            this.faceMesh.close();
        }
        this.metrics.isActive = false;

        // Stop stream
        if (this.videoElement && this.videoElement.srcObject) {
            const stream = this.videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
    }
}

export default new WebcamService();
