import React, { useState, useEffect } from 'react';
import { ZoomableImageModal } from './ZoomableImageModal';

interface ImagePreviewProps {
    file: File;
    imageUrl: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


export const ImagePreview: React.FC<ImagePreviewProps> = ({ file, imageUrl }) => {
    const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setDimensions({ width: img.width, height: img.height });
        };
        img.src = imageUrl;

        // Cleanup function to handle component unmounting before image loads
        return () => {
            img.onload = null;
        };
    }, [imageUrl]);

    return (
        <>
            <div className="my-6 p-4 bg-brand-secondary/50 border border-brand-secondary rounded-lg flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
                <div 
                    className="w-24 h-24 flex-shrink-0 bg-brand-primary rounded-md overflow-hidden border-2 border-brand-secondary cursor-zoom-in transition-transform hover:scale-105"
                    onClick={() => setIsZoomed(true)}
                    title="Clicca per ingrandire"
                >
                     <img src={imageUrl} alt="Anteprima" className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow text-center sm:text-left">
                    <h4 className="font-bold text-white truncate" title={file.name}>{file.name}</h4>
                    <div className="text-xs text-brand-text-secondary mt-2 flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1">
                        {dimensions && (
                            <span className="flex items-center gap-2">
                                <i className="fas fa-ruler-combined w-4 text-center"></i>
                                <span>{dimensions.width} x {dimensions.height}px</span>
                            </span>
                        )}
                        <span className="flex items-center gap-2">
                            <i className="fas fa-database w-4 text-center"></i>
                            <span>{formatBytes(file.size)}</span>
                        </span>
                    </div>
                </div>
            </div>
            {isZoomed && <ZoomableImageModal imageUrl={imageUrl} onClose={() => setIsZoomed(false)} />}
        </>
    );
};
