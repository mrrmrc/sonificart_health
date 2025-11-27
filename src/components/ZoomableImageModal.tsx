import React, { useEffect } from 'react';

interface ZoomableImageModalProps {
    imageUrl: string;
    onClose: () => void;
}

export const ZoomableImageModal: React.FC<ZoomableImageModalProps> = ({ imageUrl, onClose }) => {
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-backdrop-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <button 
                className="absolute top-4 right-4 text-white text-3xl hover:text-brand-accent transition-colors"
                onClick={onClose}
                aria-label="Chiudi anteprima"
            >
                &times;
            </button>
            <div 
                className="relative max-w-[90vw] max-h-[90vh] animate-zoom-in"
                onClick={e => e.stopPropagation()} // Prevent closing modal when clicking on the image
            >
                <img src={imageUrl} alt="Anteprima ingrandita" className="block max-w-full max-h-full rounded-lg shadow-2xl" />
            </div>
        </div>
    );
};
