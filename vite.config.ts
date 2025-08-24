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
      '@provider': resolve(__dirname, './src/provider'),
      '@extension': resolve(__dirname, './src/extension'),
      '@tabext': resolve(__dirname, './src/tabext'),
      '@data': resolve(__dirname, './src/data'),
      '@storage': resolve(__dirname, './src/data/storage'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      '@store': resolve(__dirname, './src/data/store'),
      '@security': resolve(__dirname, './src/data/security'),
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
