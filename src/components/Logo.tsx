
import React from 'react';

interface LogoProps {
  className?: string;
}

// Exporting the SVG string for use in non-React contexts (like Canvas/Video generation)
export const LOGO_SVG_STRING = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="logo_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  
  <!-- Outer Iris/Ring -->
  <circle cx="50" cy="50" r="42" stroke="url(#logo_grad)" stroke-width="3" stroke-opacity="0.9" />
  
  <!-- Inner Geometric Waves -->
  <path d="M 20 50 Q 50 15 80 50 Q 50 85 20 50 Z" stroke="white" stroke-width="1.5" fill="url(#logo_grad)" fill-opacity="0.1" />
  <path d="M 35 50 Q 50 30 65 50 Q 50 70 35 50 Z" stroke="white" stroke-width="1" stroke-opacity="0.6" fill="none" />

  <!-- Central Core (Pupil/Source) -->
  <circle cx="50" cy="50" r="6" fill="white" filter="url(#glow)" />

  <!-- Cardinal Sound Markers -->
  <rect x="48" y="5" width="4" height="8" rx="2" fill="#2dd4bf" />
  <rect x="48" y="87" width="4" height="8" rx="2" fill="#a855f7" />
  <rect x="5" y="48" width="8" height="4" rx="2" fill="#2dd4bf" />
  <rect x="87" y="48" width="8" height="4" rx="2" fill="#a855f7" />
</svg>
`;

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={{ __html: LOGO_SVG_STRING }} 
    />
  );
};
