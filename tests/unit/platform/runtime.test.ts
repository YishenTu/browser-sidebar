/**
 * @file Chrome Runtime Wrapper Tests
 *
 * Comprehensive unit tests for the runtime wrapper functions testing:
 * - Type-safe message passing
 * - Error normalization and handling
 * - Event listener utilities
 * - Async/await patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChromeRuntimeError,
  normalizeRuntimeError,
  checkRuntimeError,
  sendMessage,
  sendMessageAsync,
  addMessageListener,
  addInstalledListener,
  addStartupListener,
  addConnectListener,
  connect,
  getManifest,
  getURL,
  getPlatformInfo,
  waitForExtensionContext,
  isExtensionContext,
  createMessageSender,
  type MessageResponse,
  type SendMessageOptions,
  type EventListenerOptions,
} from '@/platform/chrome/runtime';
import type { TypedMessage } from '@/types/messages';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(),
    getManifest: vi.fn(),
    getURL: vi.fn(),
    getPlatformInfo: vi.fn(),
    id: 'test-extension-id',
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

// Set up global chrome mock
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

describe('ChromeRuntimeError', () => {
  it('should create error with correct properties', () => {
    const originalError = { message: 'Chrome error' };
    const error = new ChromeRuntimeError('Test error', 'TEST_CODE', originalError);

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ChromeRuntimeError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.originalError).toBe(originalError);
  });

  it('should use default code if not provided', () => {
    const error = new ChromeRuntimeError('Test error');
    expect(error.code).toBe('RUNTIME_ERROR');
  });
});

describe('normalizeRuntimeError', () => {
  beforeEach(() => {
    mockChrome.runtime.lastError = null;
  });

  it('should create error from chrome.runtime.lastError', () => {
    const chromeError = { message: 'Chrome runtime error' };
    mockChrome.runtime.lastError = chromeError;

    const error = normalizeRuntimeError('Fallback message');

    expect(error.message).toBe('Chrome runtime error');
    expect(error.originalError).toBe(chromeError);
  });

  it('should use fallback message when no chrome error', () => {
    const error = normalizeRuntimeError('Fallback message', 'FALLBACK_CODE');

    expect(error.message).toBe('Fallback message');
    expect(error.code).toBe('FALLBACK_CODE');
    expect(error.originalError).toBeUndefined();
  });

  it('should use fallback when chrome error has no message', () => {
    mockChrome.runtime.lastError = {};

    const error = normalizeRuntimeError('Fallback message');

    expect(error.message).toBe('Fallback message');
  });
});

describe('checkRuntimeError', () => {
  beforeEach(() => {
    mockChrome.runtime.lastError = null;
  });

  it('should not throw when no error', () => {
    expect(() => checkRuntimeError('Test operation')).not.toThrow();
  });

  it('should throw normalized error when chrome error exists', () => {
    const chromeError = { message: 'Chrome error occurred' };
    mockChrome.runtime.lastError = chromeError;

    expect(() => checkRuntimeError('Test operation')).toThrow(ChromeRuntimeError);
    expect(() => checkRuntimeError('Test operation')).toThrow('Chrome error occurred');
  });
});

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should send message via chrome.runtime.sendMessage', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const expectedResponse = { success: true };

    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      setTimeout(() => callback(expectedResponse), 0);
    });

    const result = await sendMessage(message);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
    expect(result.success).toBe(true);
    expect(result.data).toEqual(expectedResponse);
  });

  it('should send message to tab when tabId provided', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const options: SendMessageOptions = { tabId: 123 };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      setTimeout(() => callback({ pong: true }), 0);
    });

    const result = await sendMessage(message, options);

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message, expect.any(Function));
    expect(result.success).toBe(true);
  });

  it('should handle timeout', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const options: SendMessageOptions = { timeout: 100 };

    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // Never call callback to simulate timeout
    });

    const result = await sendMessage(message, options);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
    expect(result.error?.message).toBe('Message timeout');
  });

  it('should handle chrome runtime errors', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      mockChrome.runtime.lastError = { message: 'Extension context invalidated.' };
      setTimeout(() => callback(undefined), 0);
    });

    const result = await sendMessage(message);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Extension context invalidated.');
  });

  it('should handle send errors', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Send failed');
    });

    const result = await sendMessage(message);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SEND_ERROR');
    expect(result.error?.message).toContain('Send failed');
  });
});

describe('sendMessageAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should return response data on success', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const expectedResponse = { pong: true };

    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      setTimeout(() => callback(expectedResponse), 0);
    });

    const result = await sendMessageAsync(message);

    expect(result).toEqual(expectedResponse);
  });

  it('should throw error on failure', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      mockChrome.runtime.lastError = { message: 'Failed to send' };
      setTimeout(() => callback(undefined), 0);
    });

    await expect(sendMessageAsync(message)).rejects.toThrow(ChromeRuntimeError);
  });
});

describe('addMessageListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add message listener', () => {
    const listener = vi.fn();
    const cleanup = addMessageListener(listener);

    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof cleanup).toBe('function');
  });

  it('should handle sync listener responses', () => {
    const listener = vi.fn().mockReturnValue(true);
    addMessageListener(listener);

    // Get the wrapped listener that was added
    const wrappedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

    const message = { type: 'PING' };
    const sender = { tab: { id: 1 } };
    const sendResponse = vi.fn();

    const result = wrappedListener(message, sender, sendResponse);

    expect(listener).toHaveBeenCalledWith(message, sender, sendResponse);
    expect(result).toBe(true);
  });

  it('should handle async listener responses', async () => {
    const listener = vi.fn().mockResolvedValue({ pong: true });
    const options: EventListenerOptions = {
      handleErrors: true,
      onError: vi.fn(),
    };

    addMessageListener(listener, options);

    const wrappedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const result = wrappedListener({}, {}, vi.fn());

    expect(result).toBe(true); // Should return true for async handling
    await new Promise(resolve => setTimeout(resolve, 0)); // Let async handler run
    expect(listener).toHaveBeenCalled();
  });

  it('should handle listener errors', () => {
    const listener = vi.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    const onError = vi.fn();

    addMessageListener(listener, { handleErrors: true, onError });

    const wrappedListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const result = wrappedListener({}, {}, vi.fn());

    expect(result).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.any(ChromeRuntimeError));
  });

  it('should cleanup listener on returned function call', () => {
    const listener = vi.fn();
    const cleanup = addMessageListener(listener);

    cleanup();

    expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalled();
  });
});

describe('addInstalledListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add installed listener', () => {
    const listener = vi.fn();
    const cleanup = addInstalledListener(listener);

    expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof cleanup).toBe('function');
  });

  it('should handle listener errors', async () => {
    const listener = vi.fn().mockRejectedValue(new Error('Install error'));
    const onError = vi.fn();

    addInstalledListener(listener, { handleErrors: true, onError });

    const wrappedListener = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
    await wrappedListener({ reason: 'install' });

    expect(onError).toHaveBeenCalledWith(expect.any(ChromeRuntimeError));
  });
});

describe('addStartupListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add startup listener', () => {
    const listener = vi.fn();
    const cleanup = addStartupListener(listener);

    expect(mockChrome.runtime.onStartup.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof cleanup).toBe('function');
  });
});

describe('addConnectListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add connect listener', () => {
    const listener = vi.fn();
    const cleanup = addConnectListener(listener);

    expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof cleanup).toBe('function');
  });
});

describe('connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should create connection', () => {
    const mockPort = {
      onDisconnect: {
        addListener: vi.fn(),
      },
    };
    mockChrome.runtime.connect.mockReturnValue(mockPort);

    const connectInfo = { name: 'test-port' };
    const result = connect(connectInfo);

    expect(mockChrome.runtime.connect).toHaveBeenCalledWith(connectInfo);
    expect(result).toBe(mockPort);
    expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
  });

  it('should handle connection errors', () => {
    mockChrome.runtime.connect.mockImplementation(() => {
      throw new Error('Connection failed');
    });

    expect(() => connect()).toThrow(ChromeRuntimeError);
  });
});

describe('getManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return manifest', () => {
    const mockManifest = { version: '1.0.0' };
    mockChrome.runtime.getManifest.mockReturnValue(mockManifest);

    const result = getManifest();

    expect(result).toBe(mockManifest);
  });

  it('should handle manifest errors', () => {
    mockChrome.runtime.getManifest.mockImplementation(() => {
      throw new Error('Manifest error');
    });

    expect(() => getManifest()).toThrow(ChromeRuntimeError);
  });
});

describe('getURL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return extension URL', () => {
    const path = 'popup.html';
    const expectedURL = 'chrome-extension://test-id/popup.html';
    mockChrome.runtime.getURL.mockReturnValue(expectedURL);

    const result = getURL(path);

    expect(mockChrome.runtime.getURL).toHaveBeenCalledWith(path);
    expect(result).toBe(expectedURL);
  });

  it('should handle URL errors', () => {
    mockChrome.runtime.getURL.mockImplementation(() => {
      throw new Error('URL error');
    });

    expect(() => getURL('test.html')).toThrow(ChromeRuntimeError);
  });
});

describe('getPlatformInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should return platform info', async () => {
    const mockPlatformInfo = { os: 'mac', arch: 'x86-64' };
    mockChrome.runtime.getPlatformInfo.mockImplementation(callback => {
      setTimeout(() => callback(mockPlatformInfo), 0);
    });

    const result = await getPlatformInfo();

    expect(result).toBe(mockPlatformInfo);
  });

  it('should handle platform info errors', async () => {
    mockChrome.runtime.getPlatformInfo.mockImplementation(callback => {
      mockChrome.runtime.lastError = { message: 'Platform error' };
      setTimeout(() => callback(null), 0);
    });

    await expect(getPlatformInfo()).rejects.toThrow(ChromeRuntimeError);
  });
});

describe('waitForExtensionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should resolve when context is ready', async () => {
    mockChrome.runtime.id = 'test-extension-id';
    mockChrome.runtime.getPlatformInfo.mockImplementation(callback => {
      setTimeout(() => callback({ os: 'mac', arch: 'x86-64' }), 0);
    });

    const result = await waitForExtensionContext(1000);

    expect(result).toBe(true);
  });

  it('should timeout when context not ready', async () => {
    mockChrome.runtime.id = undefined;

    const result = await waitForExtensionContext(100);

    expect(result).toBe(false);
  });
});

describe('isExtensionContext', () => {
  it('should return true when chrome.runtime.id exists', () => {
    mockChrome.runtime.id = 'test-extension-id';

    const result = isExtensionContext();

    expect(result).toBe(true);
  });

  it('should return false when chrome.runtime.id missing', () => {
    mockChrome.runtime.id = undefined;

    const result = isExtensionContext();

    expect(result).toBe(false);
  });

  it('should handle chrome not available', () => {
    const originalChrome = global.chrome;
    // @ts-expect-error: simulate missing chrome in global for this test
    delete global.chrome;

    const result = isExtensionContext();

    expect(result).toBe(false);

    // Restore chrome
    global.chrome = originalChrome;
  });
});

describe('createMessageSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should create message sender with defaults', async () => {
    const messageDefaults = { source: 'background' as const, target: 'content' as const };
    const defaultOptions = { timeout: 3000 };

    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      setTimeout(() => callback({ success: true }), 0);
    });

    const sender = createMessageSender(messageDefaults, defaultOptions);
    const result = await sender({
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'background',
        target: 'content',
        type: 'PING',
      }),
      expect.any(Function)
    );
  });
});
