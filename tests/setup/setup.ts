// Global test setup for Vitest
import '@testing-library/jest-dom';

// Polyfill minimal crypto for environments that require it
if (!(globalThis as any).crypto) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { webcrypto } = require('node:crypto');
  (globalThis as any).crypto = webcrypto;
}
