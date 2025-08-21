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
  // @ts-ignore
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
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});