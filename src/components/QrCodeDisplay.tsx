import React, { useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import saveAs from 'file-saver';

interface QrCodeDisplayProps {
    data: string;
    fileName: string;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({ data, fileName }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && data) {
            QRCode.toCanvas(canvasRef.current, data, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#dfe6e9', // Lighter text color from brand
                    light: '#00000000' // Transparent background
                }
            }, (error) => {
                if (error) console.error('Failed to generate QR Code:', error);
            });
        }
    }, [data]);

    const handleDownload = useCallback(() => {
        if (canvasRef.current) {
            canvasRef.current.toBlob((blob) => {
                if (blob) {
                    saveAs(blob, fileName);
                }
            }, 'image/png');
        }
    }, [fileName]);

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="bg-brand-secondary p-2 rounded-lg border border-brand-secondary/50">
                <canvas ref={canvasRef} />
            </div>
            <p className="text-xs text-brand-text-secondary text-center">
                Scansiona per accedere al portale di verifica pubblico con audio e metadati.
            </p>
            <button
                onClick={handleDownload}
                className="w-full bg-brand-accent/20 text-brand-accent py-1.5 rounded hover:bg-brand-accent/30 text-sm font-bold"
            >
                <i className="fas fa-camera-retro mr-2"></i>
                Download PNG
            </button>
        </div>
    );
};
