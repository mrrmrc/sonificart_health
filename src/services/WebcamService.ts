import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

export interface BodyMetrics {
    // Head Position/Rotation (for Parallax)
    yaw: number;   
    pitch: number; 
    x: number;     
    y: number;     
    z: number;     

    // Hands
    leftHandX: number;
    leftHandY: number;
    rightHandX: number;
    rightHandY: number;

    // Body
    armSpan: number; // Normalized distance between hands (0 to 1)

    // Visualization
    landmarks?: { x: number, y: number, z?: number, visibility?: number }[];

    isActive: boolean;
}

class WebcamService {
    private pose: Pose | null = null;
    private camera: Camera | null = null;
    private videoElement: HTMLVideoElement | null = null;

    // Current State
    private metrics: BodyMetrics = {
        yaw: 0, pitch: 0,
        x: 0.5, y: 0.5, z: 0.5,
        leftHandX: 0.5, leftHandY: 0.5,
        rightHandX: 0.5, rightHandY: 0.5,
        armSpan: 0,
        isActive: false
    };

    public async initialize(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement;

        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        this.pose.setOptions({
            modelComplexity: 1, // 0=Lite, 1=Full, 2=Heavy
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.pose && this.videoElement) {
                    await this.pose.send({ image: this.videoElement });
                }
            },
            width: 640,
            height: 480
        });

        await this.camera.start();
        this.metrics.isActive = true;
    }

    private onResults(results: any) {
        if (!results.poseLandmarks) {
            return; // No body detected
        }

        const landmarks = results.poseLandmarks;

        // Pose Landmarks Mapping:
        // 0: nose, 2: right eye, 5: left eye, 7: right ear, 8: left ear
        // 11: right shoulder, 12: left shoulder
        // 15: right wrist, 16: left wrist
        // Note: Mediapipe is mirrored normally, but let's just stick to the index.
        const nose = landmarks[0];
        const rightEye = landmarks[2];
        const leftEye = landmarks[5];
        const rightShoulder = landmarks[11];
        const leftShoulder = landmarks[12];
        const rightWrist = landmarks[15];
        const leftWrist = landmarks[16];

        // --- 1. HEAD POSE (For Parallax) ---
        const midEyeX = (leftEye.x + rightEye.x) / 2;
        const noseOffsetX = nose.x - midEyeX;
        this.metrics.yaw = Math.max(-1, Math.min(1, noseOffsetX * 5));

        const midEyeY = (leftEye.y + rightEye.y) / 2;
        const noseOffsetY = nose.y - midEyeY;
        this.metrics.pitch = Math.max(-1, Math.min(1, noseOffsetY * 5));

        this.metrics.x = nose.x;
        this.metrics.y = nose.y;

        // Z estimation based on shoulder width
        const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        // Calibration:
        // shoulderDist 0.1 -> Far (z = 1)
        // shoulderDist 0.5 -> Close (z = 0)
        const rawZ = 1.0 - (shoulderDist - 0.1) / 0.4;
        this.metrics.z = Math.max(0, Math.min(1, rawZ));

        // --- 2. HANDS & ARMS ---
        this.metrics.leftHandX = leftWrist.x;
        this.metrics.leftHandY = leftWrist.y;
        this.metrics.rightHandX = rightWrist.x;
        this.metrics.rightHandY = rightWrist.y;

        const wristDist = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
        // Normalize by shoulder dist so it's depth-invariant
        const armSpanRatio = wristDist / Math.max(0.01, shoulderDist);
        // Ratio usually between 0.5 (hands together) and 3.0 (T-pose)
        this.metrics.armSpan = Math.max(0, Math.min(1, (armSpanRatio - 0.5) / 2.5));

        // --- 3. LANDMARKS FOR VISUALIZATION (Skeleton) ---
        this.metrics.landmarks = landmarks;
    }

    public getMetrics(): BodyMetrics {
        return { ...this.metrics };
    }

    public stop() {
        if (this.camera) {
            this.camera.stop();
        }
        if (this.pose) {
            this.pose.close();
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
