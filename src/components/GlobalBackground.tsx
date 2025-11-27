
import React from 'react';

export const GlobalBackground: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0f172a]">
            
            {/* Base Gradient - Lighter, deeply colored distinct from black */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0f172a] opacity-80"></div>

            {/* Animated Mesh Gradients - Simulating Audio/Visual Fluidity */}
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-drift-slow"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-teal-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-drift-medium"></div>
            <div className="absolute top-[40%] left-[40%] w-[40vw] h-[40vw] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[80px] animate-pulse-glow"></div>

            {/* Soundwave Simulation Lines */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/3 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-sound-wave" style={{ animationDuration: '3s' }}></div>
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-sound-wave" style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
                <div className="absolute top-2/3 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-pink-400 to-transparent animate-sound-wave" style={{ animationDuration: '4s', animationDelay: '2s' }}></div>
            </div>

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
