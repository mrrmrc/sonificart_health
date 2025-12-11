import React, { useEffect, useRef } from 'react';
import { BlockData } from '../types';

interface ScanPathOverlayProps {
    blocks: BlockData[];
    gridSize: number;
    imageRect: { x: number; y: number; width: number; height: number };
}

export const ScanPathOverlay: React.FC<ScanPathOverlayProps> = React.memo(({ blocks, gridSize, imageRect }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calcola i bordi effettivi dell'immagine (esclude filler/letterbox)
    const computeContentBounds = () => {
        if (!blocks || blocks.length === 0) return { minX: 0, minY: 0, maxX: gridSize - 1, maxY: gridSize - 1 };
        let minX = gridSize - 1, minY = gridSize - 1, maxX = 0, maxY = 0;
        let found = false;
        blocks.forEach(b => {
            if (!b.isFiller) {
                found = true;
                minX = Math.min(minX, b.position.x);
                minY = Math.min(minY, b.position.y);
                maxX = Math.max(maxX, b.position.x);
                maxY = Math.max(maxY, b.position.y);
            }
        });
        if (!found) return { minX: 0, minY: 0, maxX: gridSize - 1, maxY: gridSize - 1 };
        return { minX, minY, maxX, maxY };
    };

    const contentBounds = computeContentBounds();
    const usableWidthBlocks = contentBounds.maxX - contentBounds.minX + 1;
    const usableHeightBlocks = contentBounds.maxY - contentBounds.minY + 1;

    // Mappa dalla griglia 0..gridSize alla porzione visibile dell'immagine renderizzata
    const offsetX = imageRect.x + (contentBounds.minX / gridSize) * imageRect.width;
    const offsetY = imageRect.y + (contentBounds.minY / gridSize) * imageRect.height;
    const renderWidth = imageRect.width * (usableWidthBlocks / gridSize);
    const renderHeight = imageRect.height * (usableHeightBlocks / gridSize);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || renderWidth === 0 || renderHeight === 0 || !gridSize) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = renderWidth * dpr;
        canvas.height = renderHeight * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, renderWidth, renderHeight);

        const cellWidth = renderWidth / usableWidthBlocks;
        const cellHeight = renderHeight / usableHeightBlocks;

        // Disegno griglia leggera; niente maschera nera sui filler per evitare bande
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (let i = 1; i < usableWidthBlocks; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellWidth, 0);
            ctx.lineTo(i * cellWidth, renderHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * cellHeight);
            ctx.lineTo(renderWidth, i * cellHeight);
            ctx.stroke();
        }

    }, [blocks, gridSize, renderWidth, renderHeight, usableWidthBlocks, usableHeightBlocks, contentBounds]);

    if (!gridSize || renderWidth === 0) return null;

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{
                left: `${offsetX}px`,
                top: `${offsetY}px`,
                width: `${renderWidth}px`,
                height: `${renderHeight}px`,
            }}
        />
    );
});
