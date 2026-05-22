import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: 'all',
    proxy: {
      '/api': 'http://localhost:5000',
      // Proxy WebSocket upgrade requests to the backend
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
});

