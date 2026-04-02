import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    // Do not re-bundle on every cold start — use the cached pre-bundle from .vite/
    force: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      // Poll every 2 s instead of the default 100 ms — reduces CPU and memory pressure
      interval: 2000,
      // Explicitly ignore heavy directories that should never trigger HMR
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
    // Warm up the most-used modules at startup so Vite does not lazily transform
    // them on the first request (avoids a spike of concurrent transforms).
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/Dashboard.tsx',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://backend_api:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
});
