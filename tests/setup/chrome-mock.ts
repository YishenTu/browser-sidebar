import { beforeEach, afterEach, vi } from 'vitest';
import { createChromeMocks } from '../mocks/chrome';

/**
 * Chrome API mock setup for tests
 *
 * This module:
 * - Sets up fresh Chrome API mocks before each test
 * - Clears all mock functions after each test
 * - Provides utilities for test-specific mock configurations
 */

declare global {
  interface Window {
    chrome: typeof chrome;
  }

  const chrome: any;
}

let mockChrome: ReturnType<typeof createChromeMocks>;

/**
 * Sets up Chrome API mocks before each test
 */
beforeEach(() => {
  // Create fresh mocks for each test
  mockChrome = createChromeMocks();

  // Set up global chrome object
  global.chrome = mockChrome as any;

  // Also set on window for browser environment compatibility
  if (typeof window !== 'undefined') {
    (window as any).chrome = mockChrome;
  }
});

/**
 * Clears all Chrome API mocks after each test
 */
afterEach(() => {
  // Clear all mock functions
  if (mockChrome) {
    vi.clearAllMocks();

    // Clear runtime mocks
    if (mockChrome.runtime) {
      Object.values(mockChrome.runtime).forEach(prop => {
        if (typeof prop === 'function' && 'mockClear' in prop) {
          (prop as any).mockClear();
        } else if (prop && typeof prop === 'object') {
          Object.values(prop).forEach(nestedProp => {
            if (typeof nestedProp === 'function' && 'mockClear' in nestedProp) {
              (nestedProp as any).mockClear();
            }
          });
        }
      });
    }

    // Clear storage mocks
    if (mockChrome.storage) {
      ['local', 'sync', 'session', 'managed'].forEach(area => {
        const storageArea = (mockChrome.storage as any)[area];
        if (storageArea) {
          Object.values(storageArea).forEach(method => {
            if (typeof method === 'function' && 'mockClear' in method) {
              (method as any).mockClear();
            } else if (method && typeof method === 'object') {
              Object.values(method).forEach(nestedMethod => {
                if (typeof nestedMethod === 'function' && 'mockClear' in nestedMethod) {
                  (nestedMethod as any).mockClear();
                }
              });
            }
          });
        }
      });
    }

    // Clear tabs mocks
    if (mockChrome.tabs) {
      Object.values(mockChrome.tabs).forEach(method => {
        if (typeof method === 'function' && 'mockClear' in method) {
          (method as any).mockClear();
        } else if (method && typeof method === 'object') {
          Object.values(method).forEach(nestedMethod => {
            if (typeof nestedMethod === 'function' && 'mockClear' in nestedMethod) {
              (nestedMethod as any).mockClear();
            }
          });
        }
      });
    }

    // Clear action mocks
    if (mockChrome.action) {
      Object.values(mockChrome.action).forEach(method => {
        if (typeof method === 'function' && 'mockClear' in method) {
          (method as any).mockClear();
        } else if (method && typeof method === 'object') {
          Object.values(method).forEach(nestedMethod => {
            if (typeof nestedMethod === 'function' && 'mockClear' in nestedMethod) {
              (nestedMethod as any).mockClear();
            }
          });
        }
      });
    }
  }

  // Reset lastError
  if (global.chrome?.runtime) {
    global.chrome.runtime.lastError = null;
  }
});

/**
 * Utility functions for test-specific mock configurations
 */
export const chromeMockUtils = {
  /**
   * Configure runtime.sendMessage to simulate an error
   */
  simulateRuntimeError: (errorMessage: string = 'Mock runtime error') => {
    if (global.chrome?.runtime) {
      global.chrome.runtime.lastError = { message: errorMessage };
      global.chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error(errorMessage);
      });
    }
  },

  /**
   * Configure storage APIs to simulate quota exceeded error
   */
  simulateStorageQuotaError: () => {
    if (global.chrome?.storage?.local) {
      const error = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      global.chrome.storage.local.set.mockImplementation(() => {
        throw error;
      });
    }
  },

  /**
   * Configure tabs.query to return specific tabs
   */
  setMockTabs: (tabs: any[]) => {
    if (global.chrome?.tabs?.query) {
      global.chrome.tabs.query.mockImplementation((queryInfo: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback(tabs), 0);
        } else {
          return Promise.resolve(tabs);
        }
      });
    }
  },

  /**
   * Configure storage to return specific data
   */
  setStorageData: (area: 'local' | 'sync' | 'session', data: Record<string, any>) => {
    if (global.chrome?.storage?.[area]?.get) {
      global.chrome.storage[area].get.mockImplementation((keys?: any, callback?: any) => {
        let result = data;

        // Filter by keys if specified
        if (keys) {
          if (typeof keys === 'string') {
            result = keys in data ? { [keys]: data[keys] } : {};
          } else if (Array.isArray(keys)) {
            result = keys.reduce((acc, key) => {
              if (key in data) {
                acc[key] = data[key];
              }
              return acc;
            }, {});
          } else if (typeof keys === 'object') {
            // keys is default values object
            result = { ...keys, ...data };
          }
        }

        if (callback) {
          setTimeout(() => callback(result), 0);
        } else {
          return Promise.resolve(result);
        }
      });
    }
  },

  /**
   * Simulate a message being received by onMessage listeners
   */
  simulateMessage: (message: any, sender?: any, sendResponse?: any) => {
    if (global.chrome?.runtime?.onMessage?.addListener) {
      const listeners = (global.chrome.runtime.onMessage.addListener as any).mock.calls;
      listeners.forEach(([listener]: [any]) => {
        if (typeof listener === 'function') {
          listener(message, sender || { tab: { id: 1 } }, sendResponse || (() => {}));
        }
      });
    }
  },

  /**
   * Get the current mock Chrome object for direct manipulation
   */
  getMockChrome: () => mockChrome,

  /**
   * Reset all mocks to their default state
   */
  resetMocks: () => {
    mockChrome = createChromeMocks();
    global.chrome = mockChrome as any;
    if (typeof window !== 'undefined') {
      (window as any).chrome = mockChrome;
    }
  },
};

// Export the mock for direct access if needed
export { mockChrome };
