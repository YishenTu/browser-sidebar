/**
 * @file Chrome Tabs Platform Wrapper Tests
 *
 * Comprehensive unit tests for the tabs wrapper functions testing:
 * - Tab query operations with proper filtering
 * - Message sending to tabs with error handling
 * - Utility functions for tab management
 * - Batch operations and broadcast messaging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActiveTabId,
  getTab,
  queryTabs,
  getAllTabs,
  getTabs,
  sendMessageToTab,
  sendMessageToTabs,
  broadcastMessage,
  isTabAccessible,
  waitForTabReady,
  getTabsByWindow,
  getTabsByDomain,
  findTabsByUrl,
  checkContentScriptHealth,
  type TabQueryOptions,
  type SendMessageOptions,
  type TabMessageResult,
  type TabOperationResult,
} from '@/platform/chrome/tabs';
import type { TabInfo } from '@/types/tabs';
import type { TypedMessage } from '@/types/messages';

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    sendMessage: vi.fn(),
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
  },
};

// Set up global chrome mock
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

// Mock createTabInfoFromChromeTab and isRestrictedUrl
vi.mock('@/types/tabs', () => ({
  createTabInfoFromChromeTab: vi.fn(
    (chromeTab: chrome.tabs.Tab): TabInfo => ({
      id: chromeTab.id!,
      title: chromeTab.title!,
      url: chromeTab.url!,
      domain: new URL(chromeTab.url!).hostname,
      windowId: chromeTab.windowId!,
      favIconUrl: chromeTab.favIconUrl,
      active: chromeTab.active!,
      index: chromeTab.index!,
      pinned: chromeTab.pinned!,
      status: chromeTab.status as 'loading' | 'complete' | undefined,
    })
  ),
}));

vi.mock('@/shared/utils/restrictedUrls', () => ({
  isRestrictedUrl: vi.fn(
    (url: string) => url.startsWith('chrome://') || url.startsWith('chrome-extension://')
  ),
}));

// Sample tab data
const createMockChromeTab = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => ({
  id: 1,
  title: 'Test Page',
  url: 'https://example.com',
  windowId: 1,
  active: true,
  index: 0,
  pinned: false,
  status: 'complete',
  ...overrides,
});

const createMockTabInfo = (overrides: Partial<TabInfo> = {}): TabInfo => ({
  id: 1,
  title: 'Test Page',
  url: 'https://example.com',
  domain: 'example.com',
  windowId: 1,
  active: true,
  index: 0,
  pinned: false,
  status: 'complete',
  ...overrides,
});

describe('getActiveTabId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return active tab ID', async () => {
    const mockTab = createMockChromeTab({ id: 123, active: true });
    mockChrome.tabs.query.mockResolvedValue([mockTab]);

    const result = await getActiveTabId();

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(result).toBe(123);
  });

  it('should return null when no active tab found', async () => {
    mockChrome.tabs.query.mockResolvedValue([]);

    const result = await getActiveTabId();

    expect(result).toBeNull();
  });

  it('should return null when tab has no ID', async () => {
    const mockTab = createMockChromeTab({ id: undefined });
    mockChrome.tabs.query.mockResolvedValue([mockTab]);

    const result = await getActiveTabId();

    expect(result).toBeNull();
  });

  it('should handle query errors', async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

    const result = await getActiveTabId();

    expect(result).toBeNull();
  });
});

describe('getTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tab info for valid tab', async () => {
    const mockTab = createMockChromeTab({ id: 123, url: 'https://example.com' });
    mockChrome.tabs.get.mockResolvedValue(mockTab);

    const result = await getTab(123);

    expect(mockChrome.tabs.get).toHaveBeenCalledWith(123);
    expect(result).toEqual(
      expect.objectContaining({
        id: 123,
        url: 'https://example.com',
        domain: 'example.com',
      })
    );
  });

  it('should return null for restricted URLs', async () => {
    const mockTab = createMockChromeTab({ url: 'chrome://settings' });
    mockChrome.tabs.get.mockResolvedValue(mockTab);

    const result = await getTab(123);

    expect(result).toBeNull();
  });

  it('should return null when tab has no URL', async () => {
    const mockTab = createMockChromeTab({ url: undefined });
    mockChrome.tabs.get.mockResolvedValue(mockTab);

    const result = await getTab(123);

    expect(result).toBeNull();
  });

  it('should return null when tab not found', async () => {
    mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

    const result = await getTab(999);

    expect(result).toBeNull();
  });
});

describe('queryTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query tabs with options', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com', active: true }),
      createMockChromeTab({ id: 2, url: 'https://google.com', active: false }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const options: TabQueryOptions = { active: true, currentWindow: true };
    const result = await queryTabs(options);

    expect(mockChrome.tabs.query).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        currentWindow: true,
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
  });

  it('should filter out restricted URLs', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: 'chrome://settings' }),
      createMockChromeTab({ id: 3, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await queryTabs();

    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual([1, 3]);
  });

  it('should handle query errors', async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

    const result = await queryTabs();

    expect(result).toEqual([]);
  });

  it('should filter tabs without URLs', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: undefined }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await queryTabs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe('getAllTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all accessible tabs', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await getAllTabs();

    expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
    expect(result).toHaveLength(2);
  });
});

describe('getTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get multiple tabs by IDs', async () => {
    mockChrome.tabs.get
      .mockResolvedValueOnce(createMockChromeTab({ id: 1, url: 'https://example.com' }))
      .mockResolvedValueOnce(createMockChromeTab({ id: 2, url: 'https://google.com' }))
      .mockRejectedValueOnce(new Error('Tab not found'));

    const result = await getTabs([1, 2, 999]);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual([1, 2]);
  });
});

describe('sendMessageToTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should send message successfully', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const expectedResponse = { type: 'PONG' };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      setTimeout(() => callback(expectedResponse), 0);
    });

    const result = await sendMessageToTab(123, message);

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message, expect.any(Function));
    expect(result.success).toBe(true);
    expect(result.response).toBe(expectedResponse);
  });

  it('should handle message timeout', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const options: SendMessageOptions = { timeout: 100 };

    mockChrome.tabs.sendMessage.mockImplementation(() => {
      // Never call callback to simulate timeout
    });

    const result = await sendMessageToTab(123, message, options);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TIMEOUT');
    expect(result.error).toContain('timeout');
  });

  it('should handle chrome runtime errors', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      mockChrome.runtime.lastError = { message: 'Receiving end does not exist' };
      setTimeout(() => callback(undefined), 0);
    });

    const result = await sendMessageToTab(123, message);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('RUNTIME_ERROR');
    expect(result.error).toContain('Receiving end does not exist');
  });

  it('should handle no response', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      setTimeout(() => callback(undefined), 0);
    });

    const result = await sendMessageToTab(123, message);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_RESPONSE');
  });

  it('should send with frame ID', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };
    const options: SendMessageOptions = { frameId: 5 };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, opts, callback) => {
      setTimeout(() => callback({ success: true }), 0);
    });

    await sendMessageToTab(123, message, options);

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      message,
      { frameId: 5 },
      expect.any(Function)
    );
  });

  it('should handle send errors', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.tabs.sendMessage.mockImplementation(() => {
      throw new Error('Send failed');
    });

    const result = await sendMessageToTab(123, message);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SEND_ERROR');
    expect(result.error).toContain('Send failed');
  });
});

describe('sendMessageToTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should send message to multiple tabs', async () => {
    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    mockChrome.tabs.sendMessage
      .mockImplementationOnce((tabId, msg, callback) => {
        setTimeout(() => {
          mockChrome.runtime.lastError = null;
          callback({ success: true });
        }, 0);
      })
      .mockImplementationOnce((tabId, msg, callback) => {
        setTimeout(() => {
          mockChrome.runtime.lastError = { message: 'Tab not found' };
          callback(undefined);
        }, 0);
      });

    const results = await sendMessageToTabs([1, 2], message);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].tabId).toBe(1);
    expect(results[1].success).toBe(false);
    expect(results[1].tabId).toBe(2);
  });
});

describe('broadcastMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should broadcast to all accessible tabs', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      setTimeout(() => callback({ success: true }), 0);
    });

    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    const results = await broadcastMessage(message);

    expect(results).toHaveLength(2);
    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should use tab query options', async () => {
    const mockTabs = [createMockChromeTab({ id: 1, active: true })];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      setTimeout(() => callback({ success: true }), 0);
    });

    const message: TypedMessage = {
      id: 'test-id',
      type: 'PING',
      timestamp: Date.now(),
      source: 'background',
      target: 'content',
    };

    await broadcastMessage(message, {}, { active: true });

    expect(mockChrome.tabs.query).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });
});

describe('isTabAccessible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for accessible tab', async () => {
    mockChrome.tabs.get.mockResolvedValue(createMockChromeTab({ url: 'https://example.com' }));

    const result = await isTabAccessible(123);

    expect(result).toBe(true);
  });

  it('should return false for restricted tab', async () => {
    mockChrome.tabs.get.mockResolvedValue(createMockChromeTab({ url: 'chrome://settings' }));

    const result = await isTabAccessible(123);

    expect(result).toBe(false);
  });

  it('should return false when tab not found', async () => {
    mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

    const result = await isTabAccessible(999);

    expect(result).toBe(false);
  });
});

describe('waitForTabReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve when tab is ready', async () => {
    mockChrome.tabs.get.mockResolvedValue(createMockChromeTab({ status: 'complete' }));

    const result = await waitForTabReady(123, 1000, 100);

    expect(result).toBe(true);
  });

  it('should timeout when tab never becomes ready', async () => {
    mockChrome.tabs.get.mockResolvedValue(createMockChromeTab({ status: 'loading' }));

    const result = await waitForTabReady(123, 100, 50);

    expect(result).toBe(false);
  });

  it('should return false when tab not found', async () => {
    mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

    const result = await waitForTabReady(999, 1000, 100);

    expect(result).toBe(false);
  });
});

describe('getTabsByWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should group tabs by window', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, windowId: 10, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, windowId: 10, url: 'https://google.com' }),
      createMockChromeTab({ id: 3, windowId: 20, url: 'https://github.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await getTabsByWindow();

    expect(result[10]).toHaveLength(2);
    expect(result[20]).toHaveLength(1);
    expect(result[10].map(t => t.id)).toEqual([1, 2]);
    expect(result[20][0].id).toBe(3);
  });
});

describe('getTabsByDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should group tabs by domain', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com/page1' }),
      createMockChromeTab({ id: 2, url: 'https://example.com/page2' }),
      createMockChromeTab({ id: 3, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await getTabsByDomain();

    expect(result['example.com']).toHaveLength(2);
    expect(result['google.com']).toHaveLength(1);
  });
});

describe('findTabsByUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find tabs by exact URL match', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await findTabsByUrl('https://example.com', true);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should find tabs by regex pattern', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com/test' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
      createMockChromeTab({ id: 3, url: 'https://example.org/test' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await findTabsByUrl(/example\.(com|org)/);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual([1, 3]);
  });

  it('should find tabs by string pattern (case insensitive)', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://EXAMPLE.com' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await findTabsByUrl('example');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe('checkContentScriptHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should check content script health for specific tabs', async () => {
    mockChrome.tabs.sendMessage
      .mockImplementationOnce((tabId, msg, callback) => {
        setTimeout(() => {
          mockChrome.runtime.lastError = null;
          callback({ type: 'PONG' });
        }, 0);
      })
      .mockImplementationOnce((tabId, msg, callback) => {
        setTimeout(() => {
          mockChrome.runtime.lastError = { message: 'No receiving end' };
          callback(undefined);
        }, 0);
      });

    const result = await checkContentScriptHealth([1, 2], 1000);

    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
  });

  it('should check all tabs when no specific IDs provided', async () => {
    const mockTabs = [
      createMockChromeTab({ id: 1, url: 'https://example.com' }),
      createMockChromeTab({ id: 2, url: 'https://google.com' }),
    ];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
      mockChrome.runtime.lastError = null;
      setTimeout(() => callback({ type: 'PONG' }), 0);
    });

    const result = await checkContentScriptHealth([], 1000);

    expect(result[1]).toBe(true);
    expect(result[2]).toBe(true);
  });

  it('should handle ping failures', async () => {
    mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, opts, callback) => {
      throw new Error('Send failed');
    });

    const result = await checkContentScriptHealth([1], 1000);

    expect(result[1]).toBe(false);
  });
});
