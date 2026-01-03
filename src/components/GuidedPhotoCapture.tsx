import React, { useRef, useEffect, useState, useCallback } from 'react';
import { analyzeCameraFrame, resetStabilityTracking, getQualityScore, getCaptureTips, CameraFrameAnalysis } from '../services/cameraAnalysisService';

interface GuidedPhotoCaptureProps {
    onCapture: (imageFile: File, acquisitionInfo: { method: 'camera', offsets: any }) => void;
    onCancel: () => void;
}

export const GuidedPhotoCapture: React.FC<GuidedPhotoCaptureProps> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analysisIntervalRef = useRef<number | null>(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [analysis, setAnalysis] = useState<CameraFrameAnalysis | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [qualityScore, setQualityScore] = useState(0);
    const [tips, setTips] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [regulating, setRegulating] = useState<string | null>(null);

    // --- CALIBRATION OFFSETS ---
    const [offsets, setOffsets] = useState({
        exposure: 0,
        whiteBalance: 0,
        contrast: 0,
        stability: 0,
        focus: 0
    });

    useEffect(() => {
        enumerateDevices();
        return () => stopCamera();
    }, []);

    useEffect(() => {
        if (selectedDeviceId || devices.length > 0) {
            initializeCamera();
        }
    }, [selectedDeviceId]);

    const enumerateDevices = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission first
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(videoDevices);
            if (videoDevices.length > 0 && !selectedDeviceId) {
                // Prefer environment camera on mobile, otherwise first available
                const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                setSelectedDeviceId(backCam?.deviceId || videoDevices[0].deviceId);
            }
        } catch (err) {
            console.error('List devices error:', err);
        }
    };

    const initializeCamera = async () => {
        stopCamera();
        try {
            const constraints: MediaStreamConstraints = {
                video: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            // If no selectedDeviceId, fall back to environment mode for mobile
            if (!selectedDeviceId) {
                (constraints.video as MediaTrackConstraints).facingMode = 'environment';
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setCameraReady(true);
                    resetStabilityTracking();
                    startAnalysis();
                };
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError('Impossibile accedere alla fotocamera. Verifica i permessi.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    };

    const startAnalysis = () => {
        analysisIntervalRef.current = window.setInterval(() => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const res = analyzeCameraFrame(videoRef.current);
                setAnalysis(res);
                setQualityScore(getQualityScore(res));
                setTips(getCaptureTips(res));

                if (res.overallReady && countdown === null) {
                    startCountdown();
                }
            }
        }, 500);
    };

    const startCountdown = () => {
        let count = 3;
        setCountdown(count);
        const interval = setInterval(() => {
            count--;
            setCountdown(count);
            if (count === 0) {
                clearInterval(interval);
                capturePhoto();
            }
        }, 1000);
    };

    const getVideoFilter = useCallback(() => {
        const brightness = 1 + (offsets.exposure / 5) * 0.5; // range 0.5 to 1.5
        const contrast = 1 + (offsets.contrast / 50) * 0.5; // range 0.5 to 1.5
        // White balance approximation: use sepia for warm, and hue-rotate for shifting
        const sepia = offsets.whiteBalance < 0 ? Math.abs(offsets.whiteBalance / 5000) * 0.5 : 0;
        const hue = (offsets.whiteBalance / 5000) * 30; // +/- 30 degrees

        return `brightness(${brightness}) contrast(${contrast}) sepia(${sepia}) hue-rotate(${hue}deg)`;
    }, [offsets]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Apply current filters to the captured canvas as well to match preview
            ctx.filter = getVideoFilter();
            ctx.drawImage(video, 0, 0);
        }

        canvas.toBlob(blob => {
            if (blob) {
                onCapture(
                    new File([blob], `standard_${Date.now()}.jpg`, { type: 'image/jpeg' }),
                    { method: 'camera', offsets }
                );
                stopCamera();
            }
        }, 'image/jpeg', 0.95);
    }, [onCapture, stopCamera, offsets, getVideoFilter]);

    const getIcon = (status: 'good' | 'warning' | 'bad') => {
        if (status === 'good') return <i className="fas fa-check-circle text-emerald-500"></i>;
        if (status === 'warning') return <i className="fas fa-exclamation-circle text-amber-500"></i>;
        return <i className="fas fa-times-circle text-rose-500"></i>;
    };

    const getBorder = (status: 'good' | 'warning' | 'bad') => {
        if (status === 'good') return 'border-emerald-500/50';
        if (status === 'warning') return 'border-amber-500/50';
        return 'border-rose-500/50';
    };

    // --- APPLY CALIBRATION ---
    const effectiveAnalysis = analysis ? (() => {
        const updated = { ...analysis };

        // 1. Exposure (Offset applied to EV)
        updated.exposure.ev += offsets.exposure;
        if (Math.abs(updated.exposure.ev) < 0.6) { updated.exposure.status = 'good'; updated.exposure.message = 'Ottimale'; }
        else if (Math.abs(updated.exposure.ev) < 1.2) { updated.exposure.status = 'warning'; updated.exposure.message = 'Luce sub-ottimale'; }
        else { updated.exposure.status = 'bad'; updated.exposure.message = updated.exposure.ev < 0 ? 'Troppo scura' : 'Troppo chiara'; }

        // 2. WB (Offset applied to Temperature)
        const temp = updated.whiteBalance.temperature + offsets.whiteBalance;
        const dev = Math.abs(temp - 6500);
        updated.whiteBalance.deviation = dev;
        if (dev < 500) { updated.whiteBalance.status = 'good'; updated.whiteBalance.message = 'Corretto'; }
        else if (dev < 1500) { updated.whiteBalance.status = 'warning'; updated.whiteBalance.message = 'Bilanciamento non ideale'; }
        else { updated.whiteBalance.status = 'bad'; updated.whiteBalance.message = temp < 6500 ? 'Luce troppo calda' : 'Luce troppo fredda'; }

        // 3. Contrast (Offset applied to RMS)
        updated.contrast.rms += offsets.contrast;
        if (updated.contrast.rms >= 20) { updated.contrast.status = 'good'; updated.contrast.message = 'Ottimale'; }
        else if (updated.contrast.rms >= 10) { updated.contrast.status = 'warning'; updated.contrast.message = 'Contrasto basso'; }
        else { updated.contrast.status = 'bad'; updated.contrast.message = 'Troppo piatto'; }

        // 4. Stability (Offset subtracted from Motion)
        const motion = Math.max(0, updated.stability.motion - offsets.stability);
        updated.stability.motion = motion;
        if (motion < 0.04) { updated.stability.status = 'good'; updated.stability.message = 'Stabile'; }
        else if (motion < 0.1) { updated.stability.status = 'warning'; updated.stability.message = 'Resta immobile'; }
        else { updated.stability.status = 'bad'; updated.stability.message = 'Troppo movimento'; }

        // 5. Focus (Offset applied to Sharpness)
        updated.focus.sharpness += offsets.focus;
        if (updated.focus.sharpness >= 35) { updated.focus.status = 'good'; updated.focus.message = 'Fuoco OK'; }
        else if (updated.focus.sharpness >= 15) { updated.focus.status = 'warning'; updated.focus.message = 'Messa a fuoco bassa'; }
        else { updated.focus.status = 'bad'; updated.focus.message = 'Fuoco insufficiente'; }

        // Overall
        updated.overallReady = updated.exposure.status !== 'bad' && updated.whiteBalance.status !== 'bad' &&
            updated.contrast.status !== 'bad' && updated.stability.status === 'good' && updated.focus.status !== 'bad';

        return updated;
    })() : null;

    const handleAutoCalibrate = (metric: string) => {
        if (!analysis) return;
        setRegulating(metric);

        setTimeout(() => {
            setOffsets(prev => {
                const updated = { ...prev };
                if (metric === 'Esposizione') updated.exposure = -analysis.exposure.ev;
                if (metric === 'Colore') updated.whiteBalance = 6500 - analysis.whiteBalance.temperature;
                if (metric === 'Contrasto') updated.contrast = Math.max(0, 25 - analysis.contrast.rms);
                if (metric === 'Stabilità') updated.stability = analysis.stability.motion;
                if (metric === 'Fuoco') updated.focus = Math.max(0, 40 - analysis.focus.sharpness);
                return updated;
            });
            setRegulating(null);
        }, 1200);
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                <div className="flex flex-col">
                    <h2 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 md:gap-3">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        <span className="truncate max-w-[150px] md:max-w-none text-brand-accent">Analisi Real-time</span>
                    </h2>
                    {devices.length > 1 && (
                        <div className="mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2">
                            <i className="fas fa-video text-[8px] md:text-[10px] text-gray-500"></i>
                            <select
                                value={selectedDeviceId}
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                className="bg-transparent text-[8px] md:text-[10px] text-gray-400 border-none outline-none cursor-pointer focus:text-white transition-colors max-w-[120px] md:max-w-none"
                            >
                                {devices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                                        {device.label || `Camera ${devices.indexOf(device) + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors p-2"><i className="fas fa-times text-sm md:text-base"></i></button>
            </div>

            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover opacity-80 transition-all duration-300"
                    playsInline
                    muted
                    style={{ filter: getVideoFilter() }}
                />

                {analysis && (
                    <div className="absolute top-6 left-6 z-10 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center gap-6 animate-fade-in">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">Punteggio Qualità</span>
                            <div className={`text-4xl font-black font-display ${qualityScore > 80 ? 'text-emerald-500' : qualityScore > 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                {Math.round(getQualityScore(effectiveAnalysis || analysis))}%
                            </div>
                        </div>
                        <div className="h-10 w-px bg-white/10 hidden md:block"></div>
                        <div className="hidden md:flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">Stato Sistema</span>
                            <span className="text-white font-bold text-sm flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${effectiveAnalysis?.overallReady ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                {effectiveAnalysis?.overallReady ? 'SISTEMA PRONTO' : 'CALIBRAZIONE NECESSARIA'}
                            </span>
                        </div>
                    </div>
                )}

                {cameraReady && (
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Griglia Terzi */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-10 md:opacity-20 transition-opacity">
                            {[...Array(9)].map((_, i) => <div key={i} className="border-[0.5px] border-white/50"></div>)}
                        </div>

                        {/* Focus Indicator */}
                        {analysis?.focus.status !== 'good' && !regulating && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                <div className="w-20 h-20 md:w-32 md:h-32 border-2 border-white/30 rounded-full animate-ping mb-2 md:mb-4"></div>
                                <div className="bg-black/60 backdrop-blur-md px-3 py-1 md:px-4 md:py-1.5 rounded-full border border-white/20 text-[8px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] animate-pulse">
                                    Messa a fuoco...
                                </div>
                            </div>
                        )}
                        {regulating && (
                            <div className="absolute inset-0 bg-brand-accent/10 flex items-center justify-center backdrop-blur-[2px] transition-all">
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin mb-4"></div>
                                    <div className="text-white font-black text-xs uppercase tracking-widest bg-black/50 px-4 py-2 rounded-full">Regolazione {regulating}...</div>
                                </div>
                            </div>
                        )}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 text-3xl md:text-4xl font-light">+</div>
                    </div>
                )}

                {countdown !== null && countdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                        <div className="text-8xl md:text-[12rem] font-black text-brand-accent animate-bounce drop-shadow-[0_0_30px_rgba(13,148,136,0.5)]">{countdown}</div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 md:p-10 text-center">
                        <i className="fas fa-exclamation-triangle text-rose-500 text-3xl md:text-5xl mb-4 md:mb-6"></i>
                        <p className="text-white text-sm md:text-lg font-bold mb-4">{error}</p>
                        <button onClick={onCancel} className="px-6 py-2 bg-white/10 rounded-lg text-white font-bold text-sm">Chiudi</button>
                    </div>
                )}
            </div>

            {effectiveAnalysis && (
                <div className="bg-slate-900 border-t border-white/10 p-4 md:p-8 flex flex-col gap-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                        {[
                            { label: 'Esposizione', stat: effectiveAnalysis.exposure, key: 'exposure', min: -5, max: 5, step: 0.1 },
                            { label: 'Colore', stat: effectiveAnalysis.whiteBalance, key: 'whiteBalance', min: -5000, max: 5000, step: 100 },
                            { label: 'Contrasto', stat: effectiveAnalysis.contrast, key: 'contrast', min: -50, max: 50, step: 1 },
                            { label: 'Stabilità', stat: effectiveAnalysis.stability, key: 'stability', min: 0, max: 1, step: 0.01 },
                            { label: 'Fuoco', stat: effectiveAnalysis.focus, key: 'focus', min: -50, max: 50, step: 1 }
                        ].map((m, i) => (
                            <div key={i} className={`bg-black/40 border-t-2 p-4 rounded-xl ${getBorder(m.stat.status)} transition-all flex flex-col items-center text-center group/metric relative`}>
                                <div className="flex items-center gap-2 mb-4">
                                    {getIcon(m.stat.status)}
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{m.label}</span>
                                </div>

                                {/* MANUALE SLIDER (Leve) */}
                                <div className="relative w-full h-32 mb-4 flex items-center justify-center pt-2">
                                    <div className="absolute inset-y-0 w-1 bg-white/5 rounded-full left-1/2 -translate-x-1/2"></div>
                                    <input
                                        type="range"
                                        min={m.min}
                                        max={m.max}
                                        step={m.step}
                                        value={(offsets as any)[m.key]}
                                        onChange={(e) => setOffsets(prev => ({ ...prev, [m.key]: parseFloat(e.target.value) }))}
                                        className="h-28 w-4 appearance-none hover:opacity-100 transition-opacity cursor-pointer z-10"
                                        style={{
                                            WebkitAppearance: 'slider-vertical',
                                            background: 'transparent',
                                            accentColor: 'var(--brand-accent, #0d9488)'
                                        }}
                                    />
                                    {/* Offset indicator dots */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-4 w-1.5 h-1.5 rounded-full bg-white/20"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-1.5 h-1.5 rounded-full bg-white/20"></div>

                                    <div className="absolute -right-3 md:right-0 top-1/2 -translate-y-1/2 text-[7px] md:text-[9px] font-mono text-brand-accent font-bold bg-brand-accent/10 px-1 rounded border border-brand-accent/20">
                                        {(offsets as any)[m.key] > 0 ? '+' : ''}{(offsets as any)[m.key].toFixed(1)}
                                    </div>
                                </div>

                                <div className="text-[10px] text-gray-300 font-bold mb-4 h-8 flex items-center justify-center leading-tight">
                                    {m.stat.message}
                                </div>

                                <button
                                    className={`w-full py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${m.stat.status === 'good' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAutoCalibrate(m.label);
                                    }}
                                >
                                    {m.stat.status === 'good' ? 'CALIBRATO' : 'AUTO'}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-4 flex items-center gap-6">
                        <div className="w-12 h-12 bg-brand-accent/10 rounded-full flex items-center justify-center text-brand-accent shrink-0 text-xl animate-pulse">
                            <i className="fas fa-magic"></i>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest mb-1">Guida Assistita</h4>
                            <p className="text-xs text-gray-400 font-medium">
                                {tips[0] || 'Tutti i sistemi sono pronti per lo scatto di precisione.'}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onCancel} className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-colors">Annulla</button>
                            <button
                                onClick={() => countdown === null && capturePhoto()}
                                className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${effectiveAnalysis?.overallReady ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 active:scale-95' : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'}`}
                            >
                                {countdown !== null ? `SCATTO IN ${countdown}...` : 'SCATTA ORA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};
