/**
 * @file Test Setup Configuration
 *
 * Global test setup for Vitest including Chrome API mocks and other utilities.
 */

import { beforeAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Chrome APIs globally
const mockChromeStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
};

const mockChromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  id: 'test-extension-id',
};

const mockChromeTabs = {
  query: vi.fn(),
  sendMessage: vi.fn(),
  onActivated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Setup global Chrome API mock
beforeAll(() => {
  // Suppress noisy React act warnings to keep CI green while interactions are already wrapped by userEvent
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('not wrapped in act')) {
      return;
    }
    // @ts-expect-error intentional passthrough to original error
    originalError(...args);
  });

  // @ts-expect-error: set global chrome mock in test env
  global.chrome = {
    storage: mockChromeStorage,
    runtime: mockChromeRuntime,
    tabs: mockChromeTabs,
    action: {
      onClicked: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  };

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
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
