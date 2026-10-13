import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Core React framework — always loaded first
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('/react/')) {
            return 'vendor-react';
          }
          // Heavy streaming libs — deferred until WatchPage lazy chunk loads
          if (id.includes('dashjs') || id.includes('dash.js')) {
            return 'vendor-dashjs';
          }
          if (id.includes('hls.js') || id.includes('hls/')) {
            return 'vendor-hlsjs';
          }
          if (id.includes('@hevcjs') || id.includes('hevc')) {
            return 'vendor-hevc';
          }
          // Icon library — small, common across all pages
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // React Query — shared data-fetching layer
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
        },
      },
    },
    // Use esbuild for minification (faster build + smaller output than default)
    minify: 'esbuild',
    target: 'es2015',            // broadest mobile browser support
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    // Reduce base64 inlining threshold so small assets get their own cacheable URL
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
