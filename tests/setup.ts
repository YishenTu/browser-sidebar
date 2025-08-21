import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome APIs
(global as any).chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
};

// Suppress noisy React act warnings during tests
const originalError = console.error;
vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('not wrapped in act')) return;
  // @ts-expect-error intentional passthrough to original error
  originalError(...args);
});

// Provide a default matchMedia mock for tests that rely on theme utils
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
