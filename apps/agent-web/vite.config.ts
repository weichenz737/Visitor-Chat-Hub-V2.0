import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: '客服工作台',
        short_name: '客服工作台',
        description: 'Visitor Chat Hub 客服工作台',
        theme_color: '#4338ca',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api') ||
              url.pathname.startsWith('/auth') ||
              url.pathname.startsWith('/upload') ||
              url.pathname.startsWith('/uploads') ||
              url.pathname.startsWith('/socket.io'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
