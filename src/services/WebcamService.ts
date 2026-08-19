import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';

export interface BodyMetrics {
    // Head Position/Rotation
    yaw: number;   
    pitch: number; 
    headRoll: number;
    gazeX: number;
    gazeY: number;
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
    torsoX: number;

    // Computed
    armSpan: number; // Normalized distance between hands
    shoulderTilt: number; // Rotation of shoulders

    // Dynamics (Skeleton Agent)
    energyLevel: number;
    openness: number;

    // Facial Expressions
    smile: number;
    mouthOpen: number;
    eyebrows: number;

    // Visualization
    landmarks?: { x: number, y: number, z?: number, visibility?: number }[];
    faceLandmarks?: { x: number, y: number, z?: number, visibility?: number }[];
    leftHandLandmarks?: { x: number, y: number, z?: number, visibility?: number }[];
    rightHandLandmarks?: { x: number, y: number, z?: number, visibility?: number }[];
    isActive: boolean;
    // Per-limb depth
    leftHandZ: number;
    rightHandZ: number;
    headZ: number;
}

class WebcamService {
    private holistic: Holistic | null = null;
    private camera: Camera | null = null;
    private videoElement: HTMLVideoElement | null = null;

    // Calibration Baseline
    private isCalibrating = false;
    private baselineOffsets: Partial<BodyMetrics> = {};
    private frameCount = 0;
    private accumulators: Partial<Record<keyof BodyMetrics, number>> = {};

    // Dynamics state
    private lastFrameTime = 0;
    private prevMetrics: Partial<BodyMetrics> = {};

    // Current State
    private metrics: BodyMetrics = {
        yaw: 0, pitch: 0, headRoll: 0, gazeX: 0, gazeY: 0,
        x: 0.5, y: 0.5, z: 0.5,
        leftHandX: 0.5, leftHandY: 0.5,
        rightHandX: 0.5, rightHandY: 0.5,
        leftShoulderY: 0.5, rightShoulderY: 0.5,
        leftElbowY: 0.5, rightElbowY: 0.5,
        leftKneeY: 0.5, rightKneeY: 0.5,
        leftFootY: 0.5, rightFootY: 0.5,
        torsoY: 0.5, torsoX: 0.5, shoulderTilt: 0.5,
        armSpan: 0.5,
        energyLevel: 0, openness: 0.5,
        smile: 0, mouthOpen: 0, eyebrows: 0.5,
        leftHandZ: 0.5, rightHandZ: 0.5, headZ: 0.5,
        isActive: false
    };

    public async initialize(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement;
        this.holistic = new Holistic({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}` });
        this.holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            refineFaceLandmarks: true
        });
        this.holistic.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.videoElement) {
                    if (this.holistic) await this.holistic.send({ image: this.videoElement });
                }
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
                (this.baselineOffsets as any)[key] = (this.accumulators[key as keyof BodyMetrics] as number) / this.frameCount;
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
        
        m.headRoll = (leftEye.y - rightEye.y + 1) / 2;
        
        // Approximate Gaze based on nose offset (simplified)
        m.gazeX = (m.yaw + 1) / 2;
        m.gazeY = (m.pitch + 1) / 2;

        m.x = nose.x;
        m.y = nose.y;

        // Z estimation based on shoulder width
        const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const rawZ = 1.0 - (shoulderDist - 0.1) / 0.4;
        m.z = Math.max(0, Math.min(1, rawZ));

        // --- 2. UPPER BODY ---
        // NOTE: Mirror fix — webcam mirrors left/right visually, so we swap them
        // so that "leftHand" in the metrics corresponds to the user's actual LEFT hand
        m.leftHandX = rightWrist.x; m.leftHandY = rightWrist.y;
        m.rightHandX = leftWrist.x; m.rightHandY = leftWrist.y;
        
        // Per-hand depth from mediapipe z (negative = closer to camera)
        // Normalize: -0.3..+0.3 -> 0..1 (0 = close, 1 = far)
        m.leftHandZ = Math.max(0, Math.min(1, (rightWrist.z + 0.3) / 0.6));
        m.rightHandZ = Math.max(0, Math.min(1, (leftWrist.z + 0.3) / 0.6));
        m.headZ = m.z; // Use shoulder-width based Z for head
        
        m.leftShoulderY = rightShoulder.y; m.rightShoulderY = leftShoulder.y;
        m.leftElbowY = rightElbow.y; m.rightElbowY = leftElbow.y;
        
        const wristDist = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
        const armSpanRatio = wristDist / Math.max(0.01, shoulderDist);
        m.armSpan = Math.max(0, Math.min(1, (armSpanRatio - 0.5) / 2.5));

        m.shoulderTilt = (leftShoulder.y - rightShoulder.y + 1) / 2; // 0.5 is neutral

        // --- 3. LOWER BODY & TORSO ---
        m.torsoY = (leftHip.y + rightHip.y) / 2;
        m.torsoX = (leftShoulder.x + rightShoulder.x) / 2;
        // Mirror fix for knees/feet too
        m.leftKneeY = rightKnee.y; m.rightKneeY = leftKnee.y;
        m.leftFootY = rightAnkle.y; m.rightFootY = leftAnkle.y;

        // --- 4. DYNAMICS (Skeleton Agent) ---
        const now = performance.now();
        const dt = now - this.lastFrameTime;
        this.lastFrameTime = now;
        
        let energy = 0;
        if (this.prevMetrics.leftHandX !== undefined && dt > 0) {
            const dxL = m.leftHandX - this.prevMetrics.leftHandX!;
            const dyL = m.leftHandY - this.prevMetrics.leftHandY!;
            const dxR = m.rightHandX - this.prevMetrics.rightHandX!;
            const dyR = m.rightHandY - this.prevMetrics.rightHandY!;
            const dxN = m.x - this.prevMetrics.x!;
            const dyN = m.y - this.prevMetrics.y!;
            
            const dist = Math.hypot(dxL, dyL) + Math.hypot(dxR, dyR) + Math.hypot(dxN, dyN);
            const rawVelocity = dist / (dt / 1000); // units per second
            
            // smooth energy
            const targetEnergy = Math.min(1, rawVelocity / 3.0); // 3.0 is max expected velocity
            energy = (m.energyLevel || 0) * 0.8 + targetEnergy * 0.2; 
        }
        m.energyLevel = energy;

        // Openness = arm span + upright posture + close distance
        const targetOpenness = (m.armSpan * 0.7) + (Math.max(0, m.pitch + 1) * 0.15) + (Math.max(0, 1 - m.z) * 0.15);
        m.openness = (m.openness || 0.5) * 0.9 + Math.min(1, targetOpenness) * 0.1;

        // save prev
        this.prevMetrics = { leftHandX: m.leftHandX, leftHandY: m.leftHandY, rightHandX: m.rightHandX, rightHandY: m.rightHandY, x: m.x, y: m.y };

        m.landmarks = landmarks;
        m.faceLandmarks = results.faceLandmarks;
        m.leftHandLandmarks = results.leftHandLandmarks; // Note: MediaPipe returns left/right relative to the camera image
        m.rightHandLandmarks = results.rightHandLandmarks; // Since we mirror them visually, we might need to swap them if they look wrong

        if (this.isCalibrating) {
            this.frameCount++;
            ['z', 'armSpan', 'leftHandY', 'rightHandY', 'leftShoulderY', 'rightShoulderY', 'torsoY', 'headYaw', 'headPitch'].forEach(k => {
                const key = k as keyof BodyMetrics;
                this.accumulators[key] = (this.accumulators[key] || 0) + (m[key] as number);
            });
        }
        
        this.onFaceResults(results.faceLandmarks);
    }

    public getMetrics(): BodyMetrics {
        return { ...this.metrics };
    }

    private onFaceResults(landmarks: any) {
        if (!landmarks || landmarks.length === 0) return;

        // Rilevamento Sorriso (distanza tra angoli della bocca vs larghezza del viso)
        const mouthLeft = landmarks[61];
        const mouthRight = landmarks[291];
        const faceLeft = landmarks[234];
        const faceRight = landmarks[454];
        
        const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
        const faceWidth = Math.hypot(faceLeft.x - faceRight.x, faceLeft.y - faceRight.y);
        const smileRatio = mouthWidth / faceWidth;
        // Normalizza (tipicamente varia da ~0.3 (neutro) a ~0.45 (sorriso largo))
        this.metrics.smile = Math.max(0, Math.min(1, (smileRatio - 0.3) / 0.15));

        // Rilevamento Apertura Bocca (distanza labbro superiore/inferiore)
        const upperLipTop = landmarks[13];
        const lowerLipBottom = landmarks[14];
        const mouthHeight = Math.hypot(upperLipTop.x - lowerLipBottom.x, upperLipTop.y - lowerLipBottom.y);
        const mouthOpenRatio = mouthHeight / faceWidth;
        // Normalizza (varia da ~0.0 (chiusa) a ~0.15 (aperta))
        this.metrics.mouthOpen = Math.max(0, Math.min(1, mouthOpenRatio / 0.12));

        // Rilevamento Sopracciglia (distanza tra occhio e sopracciglio)
        const leftEyeTop = landmarks[159];
        const leftEyebrowTop = landmarks[52];
        const eyebrowDist = Math.hypot(leftEyeTop.x - leftEyebrowTop.x, leftEyeTop.y - leftEyebrowTop.y);
        const eyebrowRatio = eyebrowDist / faceWidth;
        // Normalizza (varia da ~0.08 (aggrottate) a ~0.15 (alzate))
        // 0.5 = neutro, > 0.5 = alzate, < 0.5 = aggrottate
        this.metrics.eyebrows = Math.max(0, Math.min(1, (eyebrowRatio - 0.08) / 0.07));
    }

    public stop() {
        if (this.camera) this.camera.stop();
        if (this.holistic) this.holistic.close();
        this.metrics.isActive = false;
        if (this.videoElement && this.videoElement.srcObject) {
            const stream = this.videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
    }
}

export default new WebcamService();
