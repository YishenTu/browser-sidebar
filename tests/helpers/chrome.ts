/**
 * @file Chrome API Helpers
 *
 * Utilities for testing Chrome extension APIs:
 * - createChromeStub() - Create a comprehensive Chrome API mock
 * - createPortStub() - Create a mock Chrome runtime.Port for MV3 streaming
 * - Storage mock with in-memory persistence
 */

import { vi, type Mock } from 'vitest';

// =============================================================================
// Types
// =============================================================================

/**
 * Chrome storage mock with in-memory data store.
 */
export interface ChromeStorageMock {
  data: Map<string, unknown>;
  get: Mock;
  set: Mock;
  remove: Mock;
  clear: Mock;
  getBytesInUse: Mock;
  QUOTA_BYTES: number;
}

/**
 * Chrome port event mock with required Chrome API methods.
 */
export interface ChromePortEventMock<T extends (...args: unknown[]) => void> {
  addListener: Mock;
  removeListener: Mock;
  hasListener: Mock;
  hasListeners: Mock;
  getRules: Mock;
  removeRules: Mock;
  addRules: Mock;
  _listeners: Set<T>;
}

/**
 * Chrome port mock for message passing.
 */
export interface ChromePortMock {
  name: string;
  postMessage: Mock;
  disconnect: Mock;
  onMessage: ChromePortEventMock<(message: unknown) => void>;
  onDisconnect: ChromePortEventMock<() => void>;
  /** Simulate receiving a message on this port */
  simulateMessage: (message: unknown) => void;
  /** Simulate disconnect */
  simulateDisconnect: () => void;
}

/**
 * Extended chrome stub helper methods interface.
 */
export interface ChromeStubHelpers {
  /** Get local storage mock */
  _getLocalStorage: () => ChromeStorageMock;
  /** Get sync storage mock */
  _getSyncStorage: () => ChromeStorageMock;
  /** Get session storage mock */
  _getSessionStorage: () => ChromeStorageMock;
  /** Reset all storage data */
  _resetStorage: () => void;
  /** Get all created ports */
  _getPorts: () => ChromePortMock[];
  /** Clear all ports */
  _clearPorts: () => void;
}

/**
 * Chrome stub with helper methods.
 */
export type ChromeStubExtended = typeof chrome & ChromeStubHelpers;

// =============================================================================
// Storage Mock Factory
// =============================================================================

/**
 * Create a Chrome storage area mock with in-memory persistence.
 *
 * @param quotaBytes - Storage quota in bytes
 * @returns Chrome storage area mock
 */
export function createStorageMock(quotaBytes: number = 5242880): ChromeStorageMock {
  const data = new Map<string, unknown>();

  const mock: ChromeStorageMock = {
    data,
    QUOTA_BYTES: quotaBytes,

    get: vi.fn().mockImplementation((keys, callback) => {
      const result: Record<string, unknown> = {};

      if (keys === null || keys === undefined) {
        // Get all
        data.forEach((value, key) => {
          result[key] = value;
        });
      } else if (typeof keys === 'string') {
        // Single key
        if (data.has(keys)) {
          result[keys] = data.get(keys);
        }
      } else if (Array.isArray(keys)) {
        // Array of keys
        for (const key of keys) {
          if (data.has(key)) {
            result[key] = data.get(key);
          }
        }
      } else if (typeof keys === 'object') {
        // Object with default values
        for (const [key, defaultValue] of Object.entries(keys)) {
          result[key] = data.has(key) ? data.get(key) : defaultValue;
        }
      }

      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    }),

    set: vi.fn().mockImplementation((items, callback) => {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),

    remove: vi.fn().mockImplementation((keys, callback) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      for (const key of keysArray) {
        data.delete(key);
      }
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),

    clear: vi.fn().mockImplementation(callback => {
      data.clear();
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),

    getBytesInUse: vi.fn().mockImplementation((keys, callback) => {
      let size = 0;
      const keysToCheck =
        keys === null ? Array.from(data.keys()) : Array.isArray(keys) ? keys : [keys];

      for (const key of keysToCheck) {
        if (data.has(key)) {
          size += JSON.stringify(data.get(key)).length * 2; // Rough UTF-16 estimate
        }
      }

      if (callback) {
        callback(size);
      }
      return Promise.resolve(size);
    }),
  };

  return mock;
}

// =============================================================================
// Port Mock Factory
// =============================================================================

/**
 * Create a Chrome runtime.Port mock for MV3 port-based messaging.
 *
 * @param name - Port name
 * @returns Port mock with simulation methods
 *
 * @example
 * ```ts
 * const port = createPortStub('my-port');
 *
 * // Set up listener
 * port.onMessage.addListener((msg) => {
 *   console.log('Received:', msg);
 * });
 *
 * // Simulate receiving a message
 * port.simulateMessage({ type: 'DATA', payload: 'test' });
 *
 * // Assert postMessage was called
 * expect(port.postMessage).toHaveBeenCalledWith({ type: 'RESPONSE' });
 * ```
 */
export function createPortStub(name: string = 'test-port'): ChromePortMock {
  const messageListeners = new Set<(message: unknown) => void>();
  const disconnectListeners = new Set<() => void>();

  const port: ChromePortMock = {
    name,

    postMessage: vi.fn(),
    disconnect: vi.fn().mockImplementation(() => {
      disconnectListeners.forEach(listener => {
        try {
          listener();
        } catch (e) {
          // Ignore listener errors
        }
      });
    }),

    onMessage: {
      addListener: vi.fn().mockImplementation(listener => {
        messageListeners.add(listener);
      }),
      removeListener: vi.fn().mockImplementation(listener => {
        messageListeners.delete(listener);
      }),
      hasListener: vi.fn().mockImplementation(listener => messageListeners.has(listener)),
      hasListeners: vi.fn().mockImplementation(() => messageListeners.size > 0),
      getRules: vi.fn().mockResolvedValue([]),
      removeRules: vi.fn().mockResolvedValue(undefined),
      addRules: vi.fn().mockResolvedValue(undefined),
      _listeners: messageListeners,
    },

    onDisconnect: {
      addListener: vi.fn().mockImplementation(listener => {
        disconnectListeners.add(listener);
      }),
      removeListener: vi.fn().mockImplementation(listener => {
        disconnectListeners.delete(listener);
      }),
      hasListener: vi.fn().mockImplementation(listener => disconnectListeners.has(listener)),
      hasListeners: vi.fn().mockImplementation(() => disconnectListeners.size > 0),
      getRules: vi.fn().mockResolvedValue([]),
      removeRules: vi.fn().mockResolvedValue(undefined),
      addRules: vi.fn().mockResolvedValue(undefined),
      _listeners: disconnectListeners,
    },

    simulateMessage(message: unknown): void {
      messageListeners.forEach(listener => {
        try {
          listener(message);
        } catch (e) {
          // Ignore listener errors during simulation
        }
      });
    },

    simulateDisconnect(): void {
      disconnectListeners.forEach(listener => {
        try {
          listener();
        } catch (e) {
          // Ignore listener errors
        }
      });
    },
  };

  return port;
}

// =============================================================================
// Chrome Stub Factory
// =============================================================================

/**
 * Create a comprehensive Chrome API stub for testing.
 * This creates a more feature-complete stub than the minimal one in setup.ts.
 *
 * @returns Extended Chrome stub with helper methods
 *
 * @example
 * ```ts
 * const chrome = createChromeStub();
 *
 * // Pre-populate storage
 * chrome._getLocalStorage().data.set('myKey', { value: 'test' });
 *
 * // Use in tests
 * await chrome.storage.local.get('myKey');
 *
 * // Reset storage between tests
 * chrome._resetStorage();
 * ```
 */
export function createChromeStub(): ChromeStubExtended {
  const localStorage = createStorageMock(5242880);
  const syncStorage = createStorageMock(102400);
  const sessionStorage = createStorageMock(5242880);
  const ports: ChromePortMock[] = [];

  const storageChangeListeners: Set<
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
  > = new Set();

  const stub: ChromeStubExtended = {
    runtime: {
      id: 'test-extension-id',
      lastError: undefined,
      getManifest: vi.fn().mockReturnValue({
        version: '1.0.0',
        name: 'Test Extension',
        manifest_version: 3,
      }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      connect: vi.fn().mockImplementation((options?: { name?: string }) => {
        const port = createPortStub(options?.name ?? 'test-port');
        ports.push(port);
        return port as unknown as chrome.runtime.Port;
      }),
      onConnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    },

    storage: {
      local: localStorage as unknown as chrome.storage.LocalStorageArea,
      sync: {
        ...syncStorage,
        QUOTA_BYTES_PER_ITEM: 8192,
        MAX_ITEMS: 512,
        MAX_WRITE_OPERATIONS_PER_HOUR: 1800,
        MAX_WRITE_OPERATIONS_PER_MINUTE: 120,
      } as unknown as chrome.storage.SyncStorageArea,
      session: sessionStorage as unknown as chrome.storage.StorageArea,
      onChanged: {
        addListener: vi.fn().mockImplementation(listener => {
          storageChangeListeners.add(listener);
        }),
        removeListener: vi.fn().mockImplementation(listener => {
          storageChangeListeners.delete(listener);
        }),
        hasListener: vi.fn().mockImplementation(listener => storageChangeListeners.has(listener)),
        hasListeners: vi.fn().mockImplementation(() => storageChangeListeners.size > 0),
      },
    },

    tabs: {
      query: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        windowId: 1,
      }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      remove: vi.fn().mockResolvedValue(undefined),
      getCurrent: vi.fn().mockResolvedValue({
        id: 1,
        url: 'https://example.com',
        title: 'Example',
      }),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      onActivated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
    },

    action: {
      onClicked: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      setIcon: vi.fn().mockResolvedValue(undefined),
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
      setPopup: vi.fn().mockResolvedValue(undefined),
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
    },

    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
      insertCSS: vi.fn().mockResolvedValue(undefined),
      removeCSS: vi.fn().mockResolvedValue(undefined),
    },

    alarms: {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(true),
      clearAll: vi.fn().mockResolvedValue(true),
      onAlarm: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
    },

    // Helper methods
    _getLocalStorage: () => localStorage,
    _getSyncStorage: () => syncStorage,
    _getSessionStorage: () => sessionStorage,
    _resetStorage: () => {
      localStorage.data.clear();
      syncStorage.data.clear();
      sessionStorage.data.clear();
    },
    _getPorts: () => [...ports],
    _clearPorts: () => {
      ports.length = 0;
    },
  } as unknown as ChromeStubExtended;

  return stub;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Install a chrome stub as the global chrome object.
 *
 * @param stub - Chrome stub to install (creates a new one if not provided)
 * @returns The installed stub
 */
export function installChromeStub(stub?: ChromeStubExtended): ChromeStubExtended {
  const chromeStub = stub ?? createChromeStub();
  globalThis.chrome = chromeStub as unknown as typeof chrome;
  return chromeStub;
}

/**
 * Pre-populate chrome storage with test data.
 *
 * @param stub - Chrome stub
 * @param area - Storage area ('local', 'sync', 'session')
 * @param data - Data to populate
 */
export function populateStorage(
  stub: ChromeStubExtended,
  area: 'local' | 'sync' | 'session',
  data: Record<string, unknown>
): void {
  const storage =
    area === 'local'
      ? stub._getLocalStorage()
      : area === 'sync'
        ? stub._getSyncStorage()
        : stub._getSessionStorage();

  for (const [key, value] of Object.entries(data)) {
    storage.data.set(key, value);
  }
}

/**
 * Simulate a storage change event.
 *
 * @param changes - Storage changes to emit
 * @param areaName - Storage area name
 */
export function simulateStorageChange(
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: 'local' | 'sync' | 'session'
): void {
  const listeners = vi.mocked(chrome.storage.onChanged.addListener).mock.calls;
  for (const [listener] of listeners) {
    if (typeof listener === 'function') {
      listener(changes as Record<string, chrome.storage.StorageChange>, areaName);
    }
  }
}

/**
 * Get all messages sent via runtime.sendMessage.
 */
export function getSentMessages(): unknown[] {
  return vi.mocked(chrome.runtime.sendMessage).mock.calls.map(call => call[0]);
}

/**
 * Get all messages sent to a specific tab.
 *
 * @param tabId - Tab ID to filter by (optional)
 */
export function getTabMessages(tabId?: number): Array<{ tabId: number; message: unknown }> {
  const calls = vi.mocked(chrome.tabs.sendMessage).mock.calls;
  return calls
    .filter(([id]) => tabId === undefined || id === tabId)
    .map(([id, message]) => ({ tabId: id, message }));
}
