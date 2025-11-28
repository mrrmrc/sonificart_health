import React from 'react';

export const GlobalBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0f172a]">

            {/* Base Gradient - Lighter, deeply colored distinct from black */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0f172a] opacity-80"></div>

            {/* Static Mesh Gradients - Animations removed */}
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[100px]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-teal-600/30 rounded-full mix-blend-screen filter blur-[100px]"></div>
            <div className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[80px]"></div>

            {/* Subtle Grid Texture for Structure */}
            <div
                className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px)',
                    backgroundSize: '100px 100px'
                }}
            ></div>

            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(transparent_40%,_#020617_100%)]"></div>
        </div>
    );
};