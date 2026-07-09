import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'socket-io';
          }
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode';
          }
          if (
            id.includes('node_modules/react/')
            || id.includes('node_modules/react-dom/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
