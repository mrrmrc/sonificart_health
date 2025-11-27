import React from 'react';

interface CursorHighlightProps {
    gridSize: number;
    imageRect: { x: number; y: number; width: number; height: number };
    activeBlockPosition: { x: number; y: number } | null;
}

export const CursorHighlight: React.FC<CursorHighlightProps> = React.memo(({ gridSize, imageRect, activeBlockPosition }) => {
    if (!activeBlockPosition || imageRect.width === 0) {
        return null;
    }

    const { x: gridX, y: gridY } = activeBlockPosition;
    const stepX = imageRect.width / gridSize;
    const stepY = imageRect.height / gridSize;

    const styles: React.CSSProperties = {
        position: 'absolute',
        left: `${imageRect.x + gridX * stepX}px`,
        top: `${imageRect.y + gridY * stepY}px`,
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