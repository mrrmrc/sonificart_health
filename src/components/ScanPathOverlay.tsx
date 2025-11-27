import React, { useEffect, useRef } from 'react';
import { BlockData } from '../types';

interface ScanPathOverlayProps {
    blocks: BlockData[];
    gridSize: number;
    imageRect: { x: number; y: number; width: number; height: number };
}

export const ScanPathOverlay: React.FC<ScanPathOverlayProps> = React.memo(({ blocks, gridSize, imageRect }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || imageRect.width === 0 || imageRect.height === 0 || !gridSize) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = imageRect.width * dpr;
        canvas.height = imageRect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, imageRect.width, imageRect.height);

        const cellWidth = imageRect.width / gridSize;
        const cellHeight = imageRect.height / gridSize;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        blocks.forEach(block => {
            if (block.isFiller) {
                ctx.fillRect(block.position.x * cellWidth, block.position.y * cellHeight, cellWidth, cellHeight);
            }
        });
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (let i = 1; i < gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellWidth, 0);
            ctx.lineTo(i * cellWidth, imageRect.height);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, i * cellHeight);
            ctx.lineTo(imageRect.width, i * cellHeight);
            ctx.stroke();
        }

    }, [blocks, gridSize, imageRect]);

    if (!gridSize || imageRect.width === 0) return null;

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{
                left: `${imageRect.x}px`,
                top: `${imageRect.y}px`,
                width: `${imageRect.width}px`,
                height: `${imageRect.height}px`,
            }}
        />
    );
});
