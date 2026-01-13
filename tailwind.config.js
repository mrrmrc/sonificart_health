/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        'brand-primary': '#09090b',
        'brand-secondary': '#18181b',
        'brand-accent': '#0d9488',
        'brand-accent-light': '#2dd4bf',
        'brand-purple': '#8b5cf6',
        'brand-pink': '#ec4899',
        'brand-text-primary': '#f4f4f5',
        'brand-text-secondary': '#a1a1aa',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'fade-in-up': 'fadeInUp 1s ease-out forwards',
        'spin': 'spin 1s linear infinite',
        'scan': 'scanVertical 4s ease-in-out infinite',
        'sound-wave': 'soundWave 1s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s infinite',
        'gradient-x': 'gradientX 15s ease infinite',
        'shimmer': 'shimmer 2s infinite',
        'zoom-in': 'zoomIn 0.3s ease-out forwards',
        'drift-slow': 'drift 25s ease-in-out infinite',
        'drift-medium': 'drift 18s ease-in-out infinite reverse',
        'blob': 'blob 7s infinite',
        'scan-overlay': 'scanOverlay 4s ease-in-out infinite',
        'spin-slow': 'spin 15s linear infinite',
        'reverse-spin': 'reverseSpin 10s linear infinite',
        'progress-indeterminate': 'progressIndeterminate 1.5s infinite linear',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        fadeInUp: { '0%': { opacity: 0, transform: 'translateY(30px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        scanVertical: { '0%, 100%': { top: '0%', opacity: 0 }, '10%': { opacity: 1 }, '90%': { opacity: 1 }, '50%': { top: '100%', opacity: 1 } },
        scanOverlay: { '0%': { height: '0%', opacity: 0 }, '15%': { height: '0%', opacity: 1 }, '50%': { height: '100%', opacity: 1 }, '51%': { opacity: 0 }, '100%': { opacity: 0 } },
        soundWave: { '0%, 100%': { height: '10%' }, '50%': { height: '100%' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-15px)' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 10px #0d9488', opacity: 1 }, '50%': { boxShadow: '0 0 30px #2dd4bf', opacity: 0.8 } },
        gradientX: { '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' }, '50%': { 'background-size': '200% 200%', 'background-position': 'right center' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        zoomIn: { '0%': { opacity: 0, transform: 'scale(0.9)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        drift: { '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' }, '33%': { transform: 'translate(2%, -3%) rotate(2deg)' }, '66%': { transform: 'translate(-2%, 1%) rotate(-1deg)' } },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        reverseSpin: {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' }
        },
        progressIndeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }
    },
  },
  plugins: [],
}