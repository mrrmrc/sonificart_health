import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    '__BUILD_TIME__': JSON.stringify(new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }))
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://sonificarthealth.sviluppo.host',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'internet',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  }
});