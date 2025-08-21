/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sidebar': resolve(__dirname, './src/sidebar'),
      '@components': resolve(__dirname, './src/sidebar/components'),
      '@hooks': resolve(__dirname, './src/sidebar/hooks'),
      '@contexts': resolve(__dirname, './src/sidebar/contexts'),
      '@ui': resolve(__dirname, './src/sidebar/components/ui'),
      '@provider': resolve(__dirname, './src/provider'),
      '@backend': resolve(__dirname, './src/backend'),
      '@tabext': resolve(__dirname, './src/tabext'),
      '@core': resolve(__dirname, './src/core'),
      '@storage': resolve(__dirname, './src/storage'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@store': resolve(__dirname, './src/store'),
    },
  },
});
