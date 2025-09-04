import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sidebar': resolve(__dirname, './src/sidebar'),
      '@components': resolve(__dirname, './src/sidebar/components'),
      '@hooks': resolve(__dirname, './src/sidebar/hooks'),
      '@contexts': resolve(__dirname, './src/sidebar/contexts'),
      '@ui': resolve(__dirname, './src/sidebar/components/ui'),
      '@engine': resolve(__dirname, './src/core/engine'),
      '@extension': resolve(__dirname, './src/extension'),
      '@content': resolve(__dirname, './src/content'),
      '@data': resolve(__dirname, './src/data'),
      '@storage': resolve(__dirname, './src/data/storage'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      '@store': resolve(__dirname, './src/data/store'),
      '@security': resolve(__dirname, './src/data/security'),
      '@core': resolve(__dirname, './src/core'),
      '@transport': resolve(__dirname, './src/transport'),
      '@platform': resolve(__dirname, './src/platform'),
      '@config': resolve(__dirname, './src/config'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
