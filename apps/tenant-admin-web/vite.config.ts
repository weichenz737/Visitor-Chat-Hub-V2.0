import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5177 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/antd') || id.includes('@ant-design/icons')) {
            return 'antd';
          }
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'socket-io';
          }
          if (
            id.includes('node_modules/react/')
            || id.includes('node_modules/react-dom/')
            || id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
