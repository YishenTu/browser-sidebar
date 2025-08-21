import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    threads: false,
    setupFiles: './tests/setup/setup.ts',
    // Exclude legacy or backup tests and build outputs
    exclude: ['node_modules/**', 'dist/**', 'tests.backup/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.{js,ts}',
        'dist/**',
        '.eslintrc.js',
        'src/types/**',
        '**/*.d.ts',
        '**/index.{js,ts,tsx}', // Exclude entry points
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sidebar': resolve(__dirname, './src/sidebar'),
      '@components': resolve(__dirname, './src/sidebar/components'),
      '@hooks': resolve(__dirname, './src/sidebar/hooks'),
      '@providers': resolve(__dirname, './src/providers'),
      '@storage': resolve(__dirname, './src/storage'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
