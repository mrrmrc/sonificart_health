
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
    audioUrl: string;
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void; // Legacy synonym for onPause
    onEnded?: () => void;
    onTimeUpdate?: (time: number) => void;
    audioRef: React.RefObject<HTMLAudioElement>;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    audioRef,
    audioUrl,
    onPlay: onPlayProp,
    onPause: onPauseProp,
    onStop: onStopProp,
    onEnded: onEndedProp,
    onTimeUpdate
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1); // 0 to 1
    const [isMuted, setIsMuted] = useState(false);

    const progressRef = useRef<HTMLDivElement>(null);

    const onLoadedMetadata = useCallback(() => {
        if (audioRef.current) setDuration(audioRef.current.duration);
    }, [audioRef]);

    const onTimeUpdateCallback = useCallback(() => {
        if (audioRef.current) {
            const { currentTime, duration } = audioRef.current;
            setCurrentTime(currentTime);
            setProgress((currentTime / duration) * 100);
            if (onTimeUpdate) onTimeUpdate(currentTime);
        }
    }, [onTimeUpdate, audioRef]);

    const onEnded = useCallback(() => {
        setIsPlaying(false);
        if (onEndedProp) onEndedProp();
        if (onStopProp) onStopProp();
    }, [onEndedProp, onStopProp]);


    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdateCallback);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdateCallback);
            audio.removeEventListener('ended', onEnded);
        };
    }, [onLoadedMetadata, onTimeUpdateCallback, onEnded, audioRef]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.load();
        }
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
    }, [audioUrl, audioRef])

    // Sync volume with audio element
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted, audioRef]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            if (onPauseProp) onPauseProp();
            if (onStopProp) onStopProp();
        } else {
            audio.play().catch(e => console.error("Audio play failed:", e));
            if (onPlayProp) onPlayProp();
        }
        setIsPlaying(!isPlaying);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const progressBar = progressRef.current;
        const audio = audioRef.current;
        if (!progressBar || !audio || !duration) return;

        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = progressBar.offsetWidth;

        audio.currentTime = (clickX / width) * duration;
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (newVolume > 0) setIsMuted(false);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const getVolumeIcon = () => {
        if (isMuted || volume === 0) return 'fa-volume-mute';
        if (volume < 0.5) return 'fa-volume-low';
        return 'fa-volume-high';
    };

    return (
        <div className="mt-4 w-full bg-brand-primary/50 p-3 rounded-lg border border-brand-secondary">
            <audio ref={audioRef} preload="auto"></audio>
            {/* Main Row: Play + Progress */}
            <div className="flex items-center gap-3">
                <button onClick={togglePlayPause} className="text-brand-accent text-2xl w-10 h-10 flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform">
                    <i className={`fas ${isPlaying ? 'fa-pause-circle' : 'fa-play-circle'}`}></i>
                </button>
                <div className="flex items-center gap-2 w-full">
                    <span className="text-xs text-brand-text-secondary font-mono w-10 text-center">{formatTime(currentTime)}</span>
                    <div ref={progressRef} onClick={handleProgressClick} className="w-full h-2 bg-brand-secondary rounded-full cursor-pointer">
                        <div style={{ width: `${progress}%` }} className="h-full bg-brand-accent rounded-full transition-all duration-150"></div>
                    </div>
                    <span className="text-xs text-brand-text-secondary font-mono w-10 text-center">{formatTime(duration)}</span>
                </div>
            </div>
            {/* Volume Row */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-brand-secondary/30">
                <button onClick={toggleMute} className="text-brand-text-secondary hover:text-brand-accent transition-colors w-6 flex items-center justify-center">
                    <i className={`fas ${getVolumeIcon()}`}></i>
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-brand-secondary rounded-full appearance-none cursor-pointer accent-brand-accent"
                    style={{
                        background: `linear-gradient(to right, var(--color-brand-accent) ${(isMuted ? 0 : volume) * 100}%, var(--color-brand-secondary) ${(isMuted ? 0 : volume) * 100}%)`
                    }}
                />
                <span className="text-[10px] text-brand-text-secondary font-mono w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
        </div>
    );
};
