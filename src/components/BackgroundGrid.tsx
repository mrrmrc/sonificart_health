
import React, { useEffect, useRef } from 'react';

const BackgroundGrid: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const gridSize = 40; // Size of the grid cells
        const activeCells: { x: number, y: number, color: string, alpha: number, phase: 'in' | 'out' }[] = [];

        const colors = [
            'rgba(13, 148, 136, 1)', // brand-accent (teal)
            'rgba(147, 51, 234, 1)', // purple
            'rgba(236, 72, 153, 1)', // pink
            'rgba(59, 130, 246, 1)', // blue
        ];

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resize);

        const drawGrid = () => {
            ctx.clearRect(0, 0, width, height);

            // Draw Grid Lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;

            for (let x = 0; x <= width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            for (let y = 0; y <= height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Update and Draw Active Cells
            // Remove dead cells
            for (let i = activeCells.length - 1; i >= 0; i--) {
                const cell = activeCells[i];
                if (cell.phase === 'in') {
                    cell.alpha += 0.05;
                    if (cell.alpha >= 0.8) cell.phase = 'out';
                } else {
                    cell.alpha -= 0.02;
                    if (cell.alpha <= 0) {
                        activeCells.splice(i, 1);
                        continue;
                    }
                }

                ctx.fillStyle = cell.color.replace('1)', `${cell.alpha})`);
                ctx.fillRect(cell.x * gridSize, cell.y * gridSize, gridSize, gridSize);

                // Add a glow effect
                ctx.shadowBlur = 15;
                ctx.shadowColor = cell.color;
                ctx.shadowBlur = 0; // Reset for next draw
            }

            // Randomly add new cell
            if (Math.random() < 0.1) { // Chance to spawn
                const x = Math.floor(Math.random() * (width / gridSize));
                const y = Math.floor(Math.random() * (height / gridSize));
                const color = colors[Math.floor(Math.random() * colors.length)];

                // Check if cell is already active
                const exists = activeCells.some(c => c.x === x && c.y === y);
                if (!exists) {
                    activeCells.push({ x, y, color, alpha: 0, phase: 'in' });
                }
            }

            requestAnimationFrame(drawGrid);
        };

        const animationId = requestAnimationFrame(drawGrid);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
            style={{ opacity: 0.6 }} // Adjust global opacity if needed
        />
    );
};

export default BackgroundGrid;
