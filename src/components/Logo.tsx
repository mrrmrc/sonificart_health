
import React from 'react';

interface LogoProps {
  className?: string;
}

// Exporting the SVG string for use in non-React contexts (like Canvas/Video generation)
// SIMPLIFIED VERSION - No filters for maximum canvas compatibility
export const LOGO_SVG_STRING = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <linearGradient id="lg2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#2dd4bf" />
    </linearGradient>
  </defs>
  
  <!-- Dark Background -->
  <circle cx="50" cy="50" r="48" fill="#0d1a24" />
  
  <!-- Outer Glowing Ring -->
  <circle cx="50" cy="50" r="45" stroke="url(#lg1)" stroke-width="4" fill="none" />
  <circle cx="50" cy="50" r="43" stroke="rgba(45,212,191,0.3)" stroke-width="1" fill="none" />
  
  <!-- Cardinal Markers -->
  <rect x="46" y="1" width="8" height="12" rx="4" fill="#2dd4bf" />
  <rect x="46" y="87" width="8" height="12" rx="4" fill="#a855f7" />
  <rect x="1" y="46" width="12" height="8" rx="4" fill="#2dd4bf" />
  <rect x="87" y="46" width="12" height="8" rx="4" fill="#a855f7" />
  
  <!-- Eye Shape - Outer -->
  <path d="M 12 50 Q 50 15 88 50 Q 50 85 12 50 Z" 
        stroke="url(#lg1)" stroke-width="2.5" 
        fill="rgba(45,212,191,0.1)" />
  
  <!-- Eye Shape - Inner -->
  <path d="M 25 50 Q 50 28 75 50 Q 50 72 25 50 Z" 
        stroke="rgba(255,255,255,0.5)" stroke-width="1.5" 
        fill="none" />
  
  <!-- Iris Circle -->
  <circle cx="50" cy="50" r="16" stroke="url(#lg2)" stroke-width="2.5" fill="rgba(45,212,191,0.15)" />
  
  <!-- Pupil - Core -->
  <circle cx="50" cy="50" r="10" fill="white" />
  <circle cx="50" cy="50" r="7" fill="#2dd4bf" opacity="0.5" />
  <circle cx="50" cy="50" r="4" fill="white" />
  
  <!-- Highlight -->
  <circle cx="54" cy="46" r="2" fill="white" opacity="0.8" />
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
