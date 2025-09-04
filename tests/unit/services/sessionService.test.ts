/**
 * Unit tests for SessionService
 * Tests session key generation, URL normalization, and session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SessionService,
  createSessionService,
  sessionService,
} from '../../../src/services/session/SessionService';
import type { SessionData } from '../../../src/data/store/types/session';

// Mock the URL normalizer utility
vi.mock('@shared/utils/urlNormalizer', () => ({
  parseSessionKey: vi.fn(),
}));

// Mock the session store
vi.mock('@store/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      clearSession: vi.fn(),
      clearTabSessions: vi.fn(),
      hasSession: vi.fn(),
      getAllSessionKeys: vi.fn(),
      sessions: {},
    }),
  },
}));

// Import mocked functions after vi.mock calls
import { parseSessionKey } from '@shared/utils/urlNormalizer';
import { useSessionStore } from '@store/stores/sessionStore';

describe('SessionService', () => {
  let service: SessionService;
  let mockStore: ReturnType<typeof useSessionStore.getState>;

  beforeEach(() => {
    service = new SessionService();
    mockStore = useSessionStore.getState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      const defaultService = new SessionService();
      expect(defaultService).toBeInstanceOf(SessionService);
    });

    it('should accept custom configuration', () => {
      const customService = new SessionService({
        includeQuery: false,
        includeHash: true,
      });
      expect(customService).toBeInstanceOf(SessionService);
    });

    it('should use custom normalize function when provided', () => {
      const customNormalizer = vi.fn().mockReturnValue('custom-url');
      const customService = new SessionService({
        normalizeUrlFn: customNormalizer,
      });

      const key = customService.getSessionKey(123, 'https://example.com');
      expect(customNormalizer).toHaveBeenCalledWith('https://example.com');
      expect(key).toBe('tab_123:custom-url');
    });
  });

  describe('getSessionKey', () => {
    it('should generate deterministic session keys', () => {
      const tabId = 123;
      const url = 'https://example.com/page';

      const key1 = service.getSessionKey(tabId, url);
      const key2 = service.getSessionKey(tabId, url);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^tab_123:/);
    });

    it('should generate different keys for different tabs', () => {
      const url = 'https://example.com';

      const key1 = service.getSessionKey(123, url);
      const key2 = service.getSessionKey(456, url);

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^tab_123:/);
      expect(key2).toMatch(/^tab_456:/);
    });

    it('should generate different keys for different URLs', () => {
      const tabId = 123;

      const key1 = service.getSessionKey(tabId, 'https://example.com');
      const key2 = service.getSessionKey(tabId, 'https://example.com/page');

      expect(key1).not.toBe(key2);
    });

    it('should handle zero and negative tab IDs', () => {
      const key1 = service.getSessionKey(0, 'https://example.com');
      const key2 = service.getSessionKey(-1, 'https://example.com');

      expect(key1).toBe('tab_0:https://example.com');
      expect(key2).toBe('tab_-1:https://example.com');
    });
  });

  describe('URL normalization', () => {
    describe('with default configuration', () => {
      it('should remove trailing slashes', () => {
        const key1 = service.getSessionKey(123, 'https://example.com/');
        const key2 = service.getSessionKey(123, 'https://example.com');

        expect(key1).toBe(key2);
        expect(key1).toBe('tab_123:https://example.com');
      });

      it('should include query parameters by default', () => {
        const key = service.getSessionKey(123, 'https://example.com?id=1&name=test');
        expect(key).toBe('tab_123:https://example.com?id=1&name=test');
      });

      it('should exclude hash fragments by default', () => {
        const key1 = service.getSessionKey(123, 'https://example.com#section');
        const key2 = service.getSessionKey(123, 'https://example.com');

        expect(key1).toBe(key2);
        expect(key1).toBe('tab_123:https://example.com');
      });

      it('should normalize complex URLs', () => {
        const url = 'https://example.com/path/to/page/?param=value&other=test#anchor';
        const key = service.getSessionKey(123, url);

        expect(key).toBe('tab_123:https://example.com/path/to/page?param=value&other=test');
      });

      it('should handle URLs with ports', () => {
        const key = service.getSessionKey(123, 'https://localhost:3000/app');
        expect(key).toBe('tab_123:https://localhost:3000/app');
      });

      it('should handle URLs with special characters', () => {
        const key = service.getSessionKey(123, 'https://example.com/path with spaces');
        expect(key).toBe('tab_123:https://example.com/path with spaces');
      });
    });

    describe('with includeQuery: false', () => {
      beforeEach(() => {
        service = new SessionService({ includeQuery: false });
      });

      it('should exclude query parameters', () => {
        const key = service.getSessionKey(123, 'https://example.com?id=1&name=test');
        expect(key).toBe('tab_123:https://example.com');
      });
    });

    describe('with includeHash: true', () => {
      beforeEach(() => {
        service = new SessionService({ includeHash: true });
      });

      it('should include hash fragments', () => {
        const key = service.getSessionKey(123, 'https://example.com#section');
        expect(key).toBe('tab_123:https://example.com#section');
      });

      it('should include both query and hash', () => {
        const key = service.getSessionKey(123, 'https://example.com?id=1#section');
        expect(key).toBe('tab_123:https://example.com?id=1#section');
      });
    });

    describe('with custom configuration', () => {
      beforeEach(() => {
        service = new SessionService({
          includeQuery: false,
          includeHash: true,
        });
      });

      it('should apply custom configuration correctly', () => {
        const url = 'https://example.com/page/?param=value#anchor';
        const key = service.getSessionKey(123, url);

        expect(key).toBe('tab_123:https://example.com/page#anchor');
      });
    });

    describe('with invalid URLs', () => {
      it('should handle invalid URLs gracefully', () => {
        const invalidUrl = 'not-a-url';
        const key = service.getSessionKey(123, invalidUrl);

        expect(key).toBe('tab_123:not-a-url');
      });

      it('should handle empty URLs', () => {
        const key = service.getSessionKey(123, '');
        expect(key).toBe('tab_123:');
      });

      it('should handle special browser URLs', () => {
        const chromeUrl = 'chrome://extensions/';
        const key = service.getSessionKey(123, chromeUrl);

        expect(key).toBe('tab_123:chrome://extensions/');
      });
    });
  });

  describe('getSessionInfo', () => {
    it('should return complete session information', () => {
      const tabId = 123;
      const url = 'https://example.com/page?id=1';

      const info = service.getSessionInfo(tabId, url);

      expect(info).toEqual({
        sessionKey: 'tab_123:https://example.com/page?id=1',
        tabId: 123,
        url: 'https://example.com/page?id=1',
        normalizedUrl: 'https://example.com/page?id=1',
      });
    });

    it('should show URL normalization in session info', () => {
      const info = service.getSessionInfo(123, 'https://example.com/#anchor');

      expect(info.url).toBe('https://example.com/#anchor');
      expect(info.normalizedUrl).toBe('https://example.com');
    });
  });

  describe('clearSession', () => {
    it('should call store clearSession method', () => {
      const sessionKey = 'tab_123:https://example.com';

      service.clearSession(sessionKey);

      expect(mockStore.clearSession).toHaveBeenCalledWith(sessionKey);
      expect(mockStore.clearSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTabSessions', () => {
    it('should call store clearTabSessions method', () => {
      const tabId = 123;

      service.clearTabSessions(tabId);

      expect(mockStore.clearTabSessions).toHaveBeenCalledWith(tabId);
      expect(mockStore.clearTabSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasSession', () => {
    it('should call store hasSession method', () => {
      const tabId = 123;
      const url = 'https://example.com';
      mockStore.hasSession.mockReturnValue(true);

      const result = service.hasSession(tabId, url);

      expect(mockStore.hasSession).toHaveBeenCalledWith(tabId, url);
      expect(result).toBe(true);
    });

    it('should return false when session does not exist', () => {
      mockStore.hasSession.mockReturnValue(false);

      const result = service.hasSession(123, 'https://example.com');

      expect(result).toBe(false);
    });
  });

  describe('getAllSessionKeys', () => {
    it('should return all session keys from store', () => {
      const mockKeys = ['tab_123:https://example.com', 'tab_456:https://test.com'];
      mockStore.getAllSessionKeys.mockReturnValue(mockKeys);

      const result = service.getAllSessionKeys();

      expect(mockStore.getAllSessionKeys).toHaveBeenCalled();
      expect(result).toEqual(mockKeys);
    });

    it('should return empty array when no sessions exist', () => {
      mockStore.getAllSessionKeys.mockReturnValue([]);

      const result = service.getAllSessionKeys();

      expect(result).toEqual([]);
    });
  });

  describe('getTabSessions', () => {
    it('should return sessions for specific tab', () => {
      const allKeys = [
        'tab_123:https://example.com',
        'tab_123:https://example.com/page',
        'tab_456:https://test.com',
        'tab_789:https://another.com',
      ];
      mockStore.getAllSessionKeys.mockReturnValue(allKeys);

      const result = service.getTabSessions(123);

      expect(result).toEqual(['tab_123:https://example.com', 'tab_123:https://example.com/page']);
    });

    it('should return empty array when tab has no sessions', () => {
      const allKeys = ['tab_456:https://test.com'];
      mockStore.getAllSessionKeys.mockReturnValue(allKeys);

      const result = service.getTabSessions(123);

      expect(result).toEqual([]);
    });

    it('should handle edge case with similar tab IDs', () => {
      const allKeys = [
        'tab_1:https://example.com',
        'tab_12:https://example.com',
        'tab_123:https://example.com',
      ];
      mockStore.getAllSessionKeys.mockReturnValue(allKeys);

      const result = service.getTabSessions(12);

      expect(result).toEqual(['tab_12:https://example.com']);
    });
  });

  describe('parseSessionKey', () => {
    it('should delegate to utility function', () => {
      const sessionKey = 'tab_123:https://example.com';
      const mockResult = { tabId: 123, url: 'https://example.com' };
      (parseSessionKey as any).mockReturnValue(mockResult);

      const result = service.parseSessionKey(sessionKey);

      expect(parseSessionKey as any).toHaveBeenCalledWith(sessionKey);
      expect(result).toEqual(mockResult);
    });

    it('should return null for invalid keys', () => {
      const sessionKey = 'invalid-key';
      (parseSessionKey as any).mockReturnValue(null);

      const result = service.parseSessionKey(sessionKey);

      expect(result).toBeNull();
    });
  });

  describe('isSameSession', () => {
    it('should return true for identical URLs', () => {
      const url = 'https://example.com';
      const result = service.isSameSession(url, url);

      expect(result).toBe(true);
    });

    it('should return true for URLs that normalize to same value', () => {
      const url1 = 'https://example.com/';
      const url2 = 'https://example.com';

      const result = service.isSameSession(url1, url2);

      expect(result).toBe(true);
    });

    it('should return true when hash differs (default config)', () => {
      const url1 = 'https://example.com#section1';
      const url2 = 'https://example.com#section2';

      const result = service.isSameSession(url1, url2);

      expect(result).toBe(true);
    });

    it('should return false when query differs', () => {
      const url1 = 'https://example.com?id=1';
      const url2 = 'https://example.com?id=2';

      const result = service.isSameSession(url1, url2);

      expect(result).toBe(false);
    });

    it('should respect includeHash configuration', () => {
      const hashSensitiveService = new SessionService({ includeHash: true });
      const url1 = 'https://example.com#section1';
      const url2 = 'https://example.com#section2';

      const result = hashSensitiveService.isSameSession(url1, url2);

      expect(result).toBe(false);
    });
  });

  describe('cleanupInactiveSessions - simplified testing', () => {
    it('should handle empty sessions gracefully', () => {
      // This test doesn't require complex session mocking
      const cleaned = service.cleanupInactiveSessions();

      // Should return 0 for empty sessions and not crash
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should accept cleanup options', () => {
      const cleaned = service.cleanupInactiveSessions({
        maxAge: 1000,
        maxSessions: 10,
      });

      expect(typeof cleaned).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle store errors gracefully in clearSession', () => {
      mockStore.clearSession.mockImplementation(() => {
        throw new Error('Store error');
      });

      expect(() => service.clearSession('test-key')).toThrow('Store error');
    });

    it('should handle store errors gracefully in hasSession', () => {
      mockStore.hasSession.mockImplementation(() => {
        throw new Error('Store error');
      });

      expect(() => service.hasSession(123, 'https://example.com')).toThrow('Store error');
    });
  });
});

describe('Factory Functions', () => {
  describe('createSessionService', () => {
    it('should create new instance with default config', () => {
      const service = createSessionService();
      expect(service).toBeInstanceOf(SessionService);
    });

    it('should create new instance with custom config', () => {
      const service = createSessionService({
        includeQuery: false,
        includeHash: true,
      });
      expect(service).toBeInstanceOf(SessionService);
    });
  });

  describe('sessionService (default instance)', () => {
    it('should be pre-configured SessionService instance', () => {
      expect(sessionService).toBeInstanceOf(SessionService);
    });
  });
});

describe('Configuration Edge Cases', () => {
  it('should handle undefined configuration values', () => {
    const service = new SessionService({
      includeQuery: undefined,
      includeHash: undefined,
    });

    // Should use defaults
    const key = service.getSessionKey(123, 'https://example.com?q=1#hash');
    expect(key).toBe('tab_123:https://example.com?q=1'); // Query included, hash excluded
  });

  it('should handle null configuration values', () => {
    const service = new SessionService({
      includeQuery: null as any,
      includeHash: null as any,
    });

    // Should use defaults when null (nullish coalescing operator behavior)
    const key = service.getSessionKey(123, 'https://example.com?q=1#hash');
    expect(key).toBe('tab_123:https://example.com?q=1'); // Query included (default), hash excluded (default)
  });

  it('should preserve custom normalizer function reference', () => {
    const customNormalizer = vi.fn().mockReturnValue('normalized');
    const service = new SessionService({ normalizeUrlFn: customNormalizer });

    service.getSessionKey(123, 'test-url');
    service.getSessionKey(456, 'another-url');

    expect(customNormalizer).toHaveBeenCalledTimes(2);
    expect(customNormalizer).toHaveBeenCalledWith('test-url');
    expect(customNormalizer).toHaveBeenCalledWith('another-url');
  });
});

describe('URL Normalization Edge Cases', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  it('should handle data URLs', () => {
    const dataUrl = 'data:text/html,<h1>Hello</h1>';
    const key = service.getSessionKey(123, dataUrl);

    expect(key).toBe(`tab_123:${dataUrl}`);
  });

  it('should handle blob URLs', () => {
    const blobUrl = 'blob:https://example.com/12345678-1234-1234-1234-123456789012';
    const key = service.getSessionKey(123, blobUrl);

    expect(key).toBe(`tab_123:${blobUrl}`);
  });

  it('should handle file URLs', () => {
    const fileUrl = 'file:///Users/test/document.html';
    const key = service.getSessionKey(123, fileUrl);

    expect(key).toBe(`tab_123:${fileUrl}`);
  });

  it('should handle URLs with international domain names', () => {
    const intlUrl = 'https://例え.テスト/パス';
    const key = service.getSessionKey(123, intlUrl);

    expect(key).toMatch(/^tab_123:/);
  });

  it('should handle very long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2000);
    const key = service.getSessionKey(123, longUrl);

    expect(key).toMatch(/^tab_123:/);
    expect(key.length).toBeGreaterThan(2000);
  });
});
