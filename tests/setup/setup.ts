/**
 * @file Test Setup
 *
 * Global test setup for Vitest. This file is loaded before all tests.
 * Configures:
 * - Network denial by default (fetch throws unless overridden)
 * - Required polyfills (crypto, TextEncoder/Decoder, Blob/File)
 * - Minimal chrome stub to prevent import-time crashes
 * - Optional IndexedDB support
 * - Global cleanup after each test
 */

import { vi, afterEach, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';

// =============================================================================
// Network Denial
// =============================================================================

/**
 * Default fetch stub that throws on any network request.
 * Tests that need network access must explicitly mock fetch.
 */
const denyNetworkFetch = vi.fn().mockImplementation((url: string | URL | Request) => {
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
  throw new Error(
    `[Test] Network request blocked: ${urlString}\n` +
      'Tests must not make real network requests. Mock fetch for this test.'
  );
});

// Store original fetch for restoration
const originalFetch = globalThis.fetch;
// Store original chrome for restoration (if present)
const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

beforeAll(() => {
  globalThis.fetch = denyNetworkFetch as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// =============================================================================
// Polyfills
// =============================================================================

// TextEncoder/TextDecoder are available in jsdom but ensure they exist
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

// Crypto polyfill for Node environment
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
  const { webcrypto } = await import('crypto');
  globalThis.crypto = webcrypto as unknown as Crypto;
}

// Blob and File are available in jsdom but ensure they exist
if (typeof globalThis.Blob === 'undefined') {
  const { Blob } = await import('buffer');
  globalThis.Blob = Blob as unknown as typeof globalThis.Blob;
}

// =============================================================================
// Chrome API Stub
// =============================================================================

/**
 * Minimal chrome stub to prevent import-time crashes.
 * Tests that need chrome APIs should use createChromeStub() from helpers/chrome.ts
 */
const minimalChromeStub: typeof chrome = {
  runtime: {
    id: 'test-extension-id',
    lastError: undefined,
    getManifest: vi.fn().mockReturnValue({ version: '1.0.0' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
    connect: vi.fn().mockReturnValue({
      name: 'test-port',
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
        hasListeners: vi.fn().mockReturnValue(false),
      },
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
    local: {
      get: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((_items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(callback => {
        if (callback) callback();
        return Promise.resolve();
      }),
      getBytesInUse: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback(0);
        return Promise.resolve(0);
      }),
      QUOTA_BYTES: 5242880,
    },
    sync: {
      get: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((_items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(callback => {
        if (callback) callback();
        return Promise.resolve();
      }),
      getBytesInUse: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback(0);
        return Promise.resolve(0);
      }),
      QUOTA_BYTES: 102400,
      QUOTA_BYTES_PER_ITEM: 8192,
    },
    session: {
      get: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation((_items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: vi.fn().mockImplementation((_keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(callback => {
        if (callback) callback();
        return Promise.resolve();
      }),
      QUOTA_BYTES: 5242880,
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com', title: 'Example' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    remove: vi.fn().mockResolvedValue(undefined),
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
} as unknown as typeof chrome;

// Install chrome stub globally
globalThis.chrome = minimalChromeStub;

// =============================================================================
// Global Cleanup
// =============================================================================

afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Restore all mocked modules
  vi.restoreAllMocks();

  // Clear all timers if fake timers were used
  vi.useRealTimers();

  // Reset chrome to the minimal stub (in case a test overwrote it)
  globalThis.chrome = minimalChromeStub;

  // Reset fetch to deny network (in case a test overrode it)
  globalThis.fetch = denyNetworkFetch as typeof fetch;
});

// =============================================================================
// Exports for Test Utilities
// =============================================================================

/**
 * Allow tests to temporarily enable real fetch for specific tests.
 * Usage: enableRealFetch() in beforeEach, it will be reset in afterEach.
 */
export function enableRealFetch(): void {
  globalThis.fetch = originalFetch;
}

/**
 * Create a mock fetch that returns a specific response.
 * @param response - Response to return
 * @param options - Optional response options
 */
export function mockFetch(
  response: unknown,
  options: { status?: number; headers?: Record<string, string> } = {}
): void {
  const { status = 200, headers = { 'Content-Type': 'application/json' } } = options;

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(response),
    text: vi
      .fn()
      .mockResolvedValue(typeof response === 'string' ? response : JSON.stringify(response)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(response)])),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    clone: vi.fn().mockReturnThis(),
    body: null,
    bodyUsed: false,
  } as unknown as Response);
}

/**
 * Create a mock fetch that returns a streaming response.
 * @param chunks - Array of chunks to stream
 */
export function mockStreamingFetch(chunks: string[]): void {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const mockReader = {
    read: vi.fn().mockImplementation(async () => {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++];
        return { done: false, value: encoder.encode(chunk) };
      }
      return { done: true, value: undefined };
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
  };

  const mockBody = {
    getReader: vi.fn().mockReturnValue(mockReader),
    cancel: vi.fn(),
    locked: false,
    pipeTo: vi.fn(),
    pipeThrough: vi.fn(),
    tee: vi.fn(),
  };

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    body: mockBody,
    bodyUsed: false,
    clone: vi.fn().mockReturnThis(),
  } as unknown as Response);
}

/**
 * Get the chrome stub for inspection or modification in tests.
 */
export function getChromeStub(): typeof chrome {
  return globalThis.chrome;
}

/**
 * Reset chrome storage mock data.
 */
export function resetChromeStorage(): void {
  const storage = globalThis.chrome.storage;

  // Reset local storage mock
  vi.mocked(storage.local.get).mockImplementation((_keys, callback) => {
    if (callback) callback({});
    return Promise.resolve({});
  });

  // Reset sync storage mock
  vi.mocked(storage.sync.get).mockImplementation((_keys, callback) => {
    if (callback) callback({});
    return Promise.resolve({});
  });

  // Reset session storage mock
  vi.mocked(storage.session.get).mockImplementation((_keys, callback) => {
    if (callback) callback({});
    return Promise.resolve({});
  });
}

// Restore original chrome after all tests finish
afterAll(() => {
  if (originalChrome !== undefined) {
    (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
  }
});
