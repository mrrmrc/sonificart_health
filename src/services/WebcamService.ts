import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

export interface BodyMetrics {
    // Head Position/Rotation
    yaw: number;   
    pitch: number; 
    x: number;     
    y: number;     
    z: number;     

    // Limbs
    leftHandX: number; leftHandY: number;
    rightHandX: number; rightHandY: number;
    leftShoulderY: number; rightShoulderY: number;
    leftElbowY: number; rightElbowY: number;
    leftKneeY: number; rightKneeY: number;
    leftFootY: number; rightFootY: number;
    torsoY: number;

    // Computed
    armSpan: number; // Normalized distance between hands
    shoulderTilt: number; // Rotation of shoulders

    // Visualization
    landmarks?: { x: number, y: number, z?: number, visibility?: number }[];
    isActive: boolean;
}

class WebcamService {
    private pose: Pose | null = null;
    private camera: Camera | null = null;
    private videoElement: HTMLVideoElement | null = null;

    // Calibration Baseline
    private isCalibrating = false;
    private baselineOffsets: Partial<BodyMetrics> = {};
    private frameCount = 0;
    private accumulators: Partial<Record<keyof BodyMetrics, number>> = {};

    // Current State
    private metrics: BodyMetrics = {
        yaw: 0, pitch: 0,
        x: 0.5, y: 0.5, z: 0.5,
        leftHandX: 0.5, leftHandY: 0.5,
        rightHandX: 0.5, rightHandY: 0.5,
        leftShoulderY: 0.5, rightShoulderY: 0.5,
        leftElbowY: 0.5, rightElbowY: 0.5,
        leftKneeY: 0.5, rightKneeY: 0.5,
        leftFootY: 0.5, rightFootY: 0.5,
        torsoY: 0.5, shoulderTilt: 0.5,
        armSpan: 0.5,
        isActive: false
    };

    public async initialize(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement;
        this.pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        this.pose.onResults(this.onResults.bind(this));
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.pose && this.videoElement) await this.pose.send({ image: this.videoElement });
            },
            width: 640, height: 480
        });
        await this.camera.start();
        this.metrics.isActive = true;
    }

    public startCalibration() {
        this.isCalibrating = true;
        this.frameCount = 0;
        this.accumulators = {};
        this.baselineOffsets = {};
        console.log("Calibration started. Stand still...");
        
        setTimeout(() => {
            this.isCalibrating = false;
            // Compute averages for baseline
            for (const key in this.accumulators) {
                this.baselineOffsets[key as keyof BodyMetrics] = (this.accumulators[key as keyof BodyMetrics] as number) / this.frameCount;
            }
            console.log("Calibration finished.", this.baselineOffsets);
        }, 3000); // 3 seconds calibration phase
    }

    public getBaselineOffsets() {
        return this.baselineOffsets;
    }

    private onResults(results: any) {
        if (!results.poseLandmarks) return;

        const landmarks = results.poseLandmarks;
        const nose = landmarks[0];
        const rightEye = landmarks[2];
        const leftEye = landmarks[5];
        const rightShoulder = landmarks[11];
        const leftShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const leftElbow = landmarks[13];
        const rightWrist = landmarks[15];
        const leftWrist = landmarks[16];
        const rightHip = landmarks[24];
        const leftHip = landmarks[23];
        const rightKnee = landmarks[26];
        const leftKnee = landmarks[25];
        const rightAnkle = landmarks[28];
        const leftAnkle = landmarks[27];

        const m = this.metrics;

        // --- 1. HEAD POSE (For Parallax) ---
        const midEyeX = (leftEye.x + rightEye.x) / 2;
        const noseOffsetX = nose.x - midEyeX;
        m.yaw = Math.max(-1, Math.min(1, noseOffsetX * 5));

        const midEyeY = (leftEye.y + rightEye.y) / 2;
        const noseOffsetY = nose.y - midEyeY;
        m.pitch = Math.max(-1, Math.min(1, noseOffsetY * 5));

        m.x = nose.x;
        m.y = nose.y;

        // Z estimation based on shoulder width
        const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const rawZ = 1.0 - (shoulderDist - 0.1) / 0.4;
        m.z = Math.max(0, Math.min(1, rawZ));

        // --- 2. UPPER BODY ---
        m.leftHandX = leftWrist.x; m.leftHandY = leftWrist.y;
        m.rightHandX = rightWrist.x; m.rightHandY = rightWrist.y;
        
        m.leftShoulderY = leftShoulder.y; m.rightShoulderY = rightShoulder.y;
        m.leftElbowY = leftElbow.y; m.rightElbowY = rightElbow.y;
        
        const wristDist = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
        const armSpanRatio = wristDist / Math.max(0.01, shoulderDist);
        m.armSpan = Math.max(0, Math.min(1, (armSpanRatio - 0.5) / 2.5));

        m.shoulderTilt = (leftShoulder.y - rightShoulder.y + 1) / 2; // 0.5 is neutral

        // --- 3. LOWER BODY & TORSO ---
        m.torsoY = (leftHip.y + rightHip.y) / 2;
        m.leftKneeY = leftKnee.y; m.rightKneeY = rightKnee.y;
        m.leftFootY = leftAnkle.y; m.rightFootY = rightAnkle.y;

        m.landmarks = landmarks;

        if (this.isCalibrating) {
            this.frameCount++;
            ['z', 'armSpan', 'leftHandY', 'rightHandY', 'leftShoulderY', 'rightShoulderY', 'torsoY', 'headYaw', 'headPitch'].forEach(k => {
                const key = k as keyof BodyMetrics;
                this.accumulators[key] = (this.accumulators[key] || 0) + (m[key] as number);
            });
        }
    }

    public getMetrics(): BodyMetrics {
        return { ...this.metrics };
    }

    public stop() {
        if (this.camera) this.camera.stop();
        if (this.pose) this.pose.close();
        this.metrics.isActive = false;
        if (this.videoElement && this.videoElement.srcObject) {
            const stream = this.videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
    }
}

export default new WebcamService();
