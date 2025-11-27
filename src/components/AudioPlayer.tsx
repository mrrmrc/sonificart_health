
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
    audioUrl: string;
    onPlay?: () => void;
    onStop?: () => void;
    onTimeUpdate?: (time: number) => void;
    audioRef: React.RefObject<HTMLAudioElement>;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioRef, audioUrl, onPlay, onStop, onTimeUpdate }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const progressRef = useRef<HTMLDivElement>(null);

    const onLoadedMetadata = useCallback(() => {
        if(audioRef.current) setDuration(audioRef.current.duration);
    }, [audioRef]);

    const onTimeUpdateCallback = useCallback(() => {
        if(audioRef.current) {
            const { currentTime, duration } = audioRef.current;
            setCurrentTime(currentTime);
            setProgress((currentTime / duration) * 100);
            if(onTimeUpdate) onTimeUpdate(currentTime);
        }
    }, [onTimeUpdate, audioRef]);

    const onEnded = useCallback(() => {
        setIsPlaying(false);
        if(onStop) onStop();
    }, [onStop]);


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

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            if(onStop) onStop();
        } else {
            audio.play().catch(e => console.error("Audio play failed:", e));
            if(onPlay) onPlay();
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
    
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    return (
        <div className="mt-4 w-full flex items-center gap-3 bg-brand-primary/50 p-3 rounded-lg border border-brand-secondary">
            <audio ref={audioRef} preload="auto"></audio>
            <button onClick={togglePlayPause} className="text-brand-accent text-2xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                <i className={`fas ${isPlaying ? 'fa-pause-circle' : 'fa-play-circle'}`}></i>
            </button>
            <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-brand-text-secondary font-mono w-10 text-center">{formatTime(currentTime)}</span>
                <div ref={progressRef} onClick={handleProgressClick} className="w-full h-2 bg-brand-secondary rounded-full cursor-pointer">
                    <div style={{ width: `${progress}%`}} className="h-full bg-brand-accent rounded-full transition-all duration-150"></div>
                </div>
                <span className="text-xs text-brand-text-secondary font-mono w-10 text-center">{formatTime(duration)}</span>
            </div>
        </div>
    );
};
