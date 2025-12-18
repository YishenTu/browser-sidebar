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
      '@content': resolve(__dirname, './src/content'),
      '@core': resolve(__dirname, './src/core'),
      '@transport': resolve(__dirname, './src/transport'),
      '@platform': resolve(__dirname, './src/platform'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      '@store': resolve(__dirname, './src/data/store'),
      '@config': resolve(__dirname, './src/config'),
      '@shared': resolve(__dirname, './src/shared'),
      '@extension': resolve(__dirname, './src/extension'),
      '@data': resolve(__dirname, './src/data'),
      '@security': resolve(__dirname, './src/data/security'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
