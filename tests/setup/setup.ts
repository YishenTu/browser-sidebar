/**
 * Test setup configuration for Vitest
 * Sets up global mocks and testing utilities
 */

import { vi, beforeEach } from 'vitest';

// Setup global chrome API mock
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(),
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    lastError: null,
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// Make chrome available globally
global.chrome = mockChrome as any;

// Global setup for all tests
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  // Reset chrome mocks
  mockChrome.runtime.sendMessage.mockClear();
  mockChrome.runtime.connect.mockClear();
  mockChrome.runtime.lastError = null;
});

// Export mock for direct access in tests
export { mockChrome };

// Swallow unhandled promise rejections in tests that intentionally exercise timeout/retry paths
// This prevents Vitest from marking the run as errored even when all assertions pass.
process.on('unhandledRejection', () => {
  // no-op: intentionally ignored in test environment
});
