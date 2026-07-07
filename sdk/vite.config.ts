import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
  build: {
    lib: {
      entry: 'src/widget.tsx',
      name: 'CSWidget',
      fileName: 'cs-widget',
      formats: ['iife'],
    },
  },
});
