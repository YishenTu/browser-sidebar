import { vi } from 'vitest';

// Types for Chrome API methods
type Callback<T = any> = (result: T) => void;

interface ChromeRuntimeError {
  message: string;
}

interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  windowId?: number;
}

/**
 * Comprehensive Chrome API mocks for testing
 * Supports both callback and promise-based APIs where applicable
 */
export const createChromeMocks = () => {
  // Runtime API mocks
  const runtime = {
    // Message passing
    sendMessage: vi.fn().mockImplementation((message: any, callback?: Callback) => {
      const response = { success: true };
      if (callback) {
        // Callback-based API
        setTimeout(() => callback(response), 0);
      } else {
        // Promise-based API
        return Promise.resolve(response);
      }
    }),

    // Event listeners
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    onStartup: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    onSuspend: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    // Extension info
    id: 'test-extension-id',

    // Error handling
    lastError: null as ChromeRuntimeError | null,

    // Manifest
    getManifest: vi.fn().mockReturnValue({
      name: 'Test Extension',
      version: '1.0.0',
      manifest_version: 3,
    }),

    // URL helpers
    getURL: vi
      .fn()
      .mockImplementation((path: string) => `chrome-extension://test-extension-id/${path}`),
  };

  // Storage API mocks
  const createStorageArea = () => ({
    get: vi
      .fn()
      .mockImplementation(
        (keys?: string | string[] | Record<string, any> | null, callback?: Callback) => {
          const result = {};
          if (callback) {
            // Callback-based API
            setTimeout(() => callback(result), 0);
          } else {
            // Promise-based API
            return Promise.resolve(result);
          }
        }
      ),

    set: vi.fn().mockImplementation((items: Record<string, any>, callback?: Callback) => {
      if (callback) {
        // Callback-based API
        setTimeout(() => callback(), 0);
      } else {
        // Promise-based API
        return Promise.resolve();
      }
    }),

    remove: vi.fn().mockImplementation((keys: string | string[], callback?: Callback) => {
      if (callback) {
        // Callback-based API
        setTimeout(() => callback(), 0);
      } else {
        // Promise-based API
        return Promise.resolve();
      }
    }),

    clear: vi.fn().mockImplementation((callback?: Callback) => {
      if (callback) {
        // Callback-based API
        setTimeout(() => callback(), 0);
      } else {
        // Promise-based API
        return Promise.resolve();
      }
    }),

    // Storage change events
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    // Quota information
    getBytesInUse: vi
      .fn()
      .mockImplementation((keys?: string | string[] | null, callback?: Callback<number>) => {
        const bytesInUse = 0;
        if (callback) {
          setTimeout(() => callback(bytesInUse), 0);
        } else {
          return Promise.resolve(bytesInUse);
        }
      }),
  });

  const storage = {
    local: createStorageArea(),
    sync: createStorageArea(),
    session: createStorageArea(),
    managed: {
      get: vi.fn().mockImplementation((keys?: string | string[] | null, callback?: Callback) => {
        const result = {};
        if (callback) {
          setTimeout(() => callback(result), 0);
        } else {
          return Promise.resolve(result);
        }
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
  };

  // Tabs API mocks
  const tabs = {
    query: vi.fn().mockImplementation((queryInfo: any, callback?: Callback<ChromeTab[]>) => {
      const mockTabs: ChromeTab[] = [
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example Site',
          active: true,
          windowId: 1,
        },
      ];

      if (callback) {
        // Callback-based API
        setTimeout(() => callback(mockTabs), 0);
      } else {
        // Promise-based API
        return Promise.resolve(mockTabs);
      }
    }),

    sendMessage: vi.fn().mockImplementation((tabId: number, message: any, callback?: Callback) => {
      const response = { success: true };
      if (callback) {
        // Callback-based API
        setTimeout(() => callback(response), 0);
      } else {
        // Promise-based API
        return Promise.resolve(response);
      }
    }),

    create: vi.fn().mockImplementation((createProperties: any, callback?: Callback<ChromeTab>) => {
      const newTab: ChromeTab = {
        id: Math.floor(Math.random() * 1000) + 2,
        url: createProperties.url || 'chrome://newtab/',
        title: 'New Tab',
        active: createProperties.active !== false,
        windowId: createProperties.windowId || 1,
      };

      if (callback) {
        setTimeout(() => callback(newTab), 0);
      } else {
        return Promise.resolve(newTab);
      }
    }),

    update: vi
      .fn()
      .mockImplementation(
        (tabId: number, updateProperties: any, callback?: Callback<ChromeTab>) => {
          const updatedTab: ChromeTab = {
            id: tabId,
            url: updateProperties.url || 'https://example.com',
            title: updateProperties.title || 'Updated Tab',
            active: updateProperties.active !== false,
            windowId: 1,
          };

          if (callback) {
            setTimeout(() => callback(updatedTab), 0);
          } else {
            return Promise.resolve(updatedTab);
          }
        }
      ),

    get: vi.fn().mockImplementation((tabId: number, callback?: Callback<ChromeTab>) => {
      const tab: ChromeTab = {
        id: tabId,
        url: 'https://example.com',
        title: 'Example Site',
        active: true,
        windowId: 1,
      };

      if (callback) {
        setTimeout(() => callback(tab), 0);
      } else {
        return Promise.resolve(tab);
      }
    }),

    remove: vi.fn().mockImplementation((tabIds: number | number[], callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    // Tab events
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },

    onRemoved: {
      addListener: vi.fn().mockImplementation((callback: any) => {
        // Store callback for direct invocation in tests
        (tabs.onRemoved as any).callback = callback;
      }),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
      // Allow direct callback access for tests
      callback: undefined as any,
    },

    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
  };

  // Action API mocks (for extension icon clicks)
  const action = {
    onClicked: {
      addListener: vi.fn().mockImplementation((callback: any) => {
        // Store callback for direct invocation in tests
        (action.onClicked as any).callback = callback;
      }),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
      // Allow direct callback access for tests
      callback: undefined as any,
    },

    setBadgeText: vi.fn().mockImplementation((details: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    setBadgeBackgroundColor: vi.fn().mockImplementation((details: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    setIcon: vi.fn().mockImplementation((details: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    setTitle: vi.fn().mockImplementation((details: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),
  };

  // SidePanel API mocks (Chrome-specific)
  const sidePanel = {
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    setOptions: vi.fn().mockResolvedValue(undefined),
    getOptions: vi.fn().mockResolvedValue({}),
    open: vi.fn().mockResolvedValue(undefined),
  };

  // Windows API mocks
  const windows = {
    getCurrent: vi.fn().mockImplementation((callback?: Callback) => {
      const currentWindow = { id: 1, focused: true, type: 'normal' };
      if (callback) {
        setTimeout(() => callback(currentWindow), 0);
      } else {
        return Promise.resolve(currentWindow);
      }
    }),

    getAll: vi.fn().mockImplementation((callback?: Callback) => {
      const windows = [{ id: 1, focused: true, type: 'normal' }];
      if (callback) {
        setTimeout(() => callback(windows), 0);
      } else {
        return Promise.resolve(windows);
      }
    }),
  };

  // Scripting API mocks (for dynamic content script injection)
  const scripting = {
    executeScript: vi.fn().mockImplementation((injection: any, callback?: Callback) => {
      const result = [{ result: null }];
      if (callback) {
        setTimeout(() => callback(result), 0);
      } else {
        return Promise.resolve(result);
      }
    }),

    insertCSS: vi.fn().mockImplementation((injection: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    removeCSS: vi.fn().mockImplementation((injection: any, callback?: Callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      } else {
        return Promise.resolve();
      }
    }),

    registerContentScripts: vi.fn().mockResolvedValue(undefined),
    unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
    getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
  };

  return {
    runtime,
    storage,
    tabs,
    action,
    sidePanel,
    windows,
    scripting,
  };
};

export const chromeMocks = createChromeMocks();
