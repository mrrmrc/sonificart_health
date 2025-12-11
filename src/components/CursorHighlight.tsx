import React from 'react';

interface CursorHighlightProps {
    gridSize: number;
    imageRect: { x: number; y: number; width: number; height: number };
    activeBlockPosition: { x: number; y: number } | null;
    contentBounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export const CursorHighlight: React.FC<CursorHighlightProps> = React.memo(({ gridSize, imageRect, activeBlockPosition, contentBounds }) => {
    if (!activeBlockPosition || imageRect.width === 0) {
        return null;
    }

    // Se sono disponibili i bounds di contenuto (per escludere filler/letterbox), usali
    const minX = contentBounds ? contentBounds.minX : 0;
    const minY = contentBounds ? contentBounds.minY : 0;
    const maxX = contentBounds ? contentBounds.maxX : gridSize - 1;
    const maxY = contentBounds ? contentBounds.maxY : gridSize - 1;
    const usableWidthBlocks = maxX - minX + 1;
    const usableHeightBlocks = maxY - minY + 1;

    const renderWidth = imageRect.width * (usableWidthBlocks / gridSize);
    const renderHeight = imageRect.height * (usableHeightBlocks / gridSize);

    const { x: gridX, y: gridY } = activeBlockPosition;
    const stepX = renderWidth / usableWidthBlocks;
    const stepY = renderHeight / usableHeightBlocks;

    const offsetX = imageRect.x + (minX / gridSize) * imageRect.width;
    const offsetY = imageRect.y + (minY / gridSize) * imageRect.height;

    const styles: React.CSSProperties = {
        position: 'absolute',
        left: `${offsetX + (gridX - minX) * stepX}px`,
        top: `${offsetY + (gridY - minY) * stepY}px`,
        width: `${stepX}px`,
        height: `${stepY}px`,
        border: '2px solid white',
        boxShadow: 'inset 0 0 10px rgba(255, 255, 255, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        transition: 'left 0.05s linear, top 0.05s linear',
        pointerEvents: 'none',
    };

    return <div style={styles} />;
});