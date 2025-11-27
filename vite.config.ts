import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: This ensures assets are loaded relatively (e.g., "./assets/..." instead of "/assets/...")
  // preventing 404s and MIME type errors on shared hosting or subdirectories.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});