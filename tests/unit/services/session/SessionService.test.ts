/**
 * @file Session Service Tests
 *
 * Tests for session management including key generation, cleanup,
 * and URL normalization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock that's available at hoist time
const { mockStore } = vi.hoisted(() => {
  return {
    mockStore: {
      clearSession: vi.fn(),
      clearTabSessions: vi.fn(),
      hasSession: vi.fn().mockReturnValue(true),
      getAllSessionKeys: vi.fn().mockReturnValue([]),
      sessions: {} as Record<string, { lastAccessedAt: number }>,
    },
  };
});

// Mock the session store - this runs at module evaluation time
vi.mock('@store/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => mockStore,
  },
}));

// Import after mock setup
import {
  SessionService,
  createSessionService,
  type SessionServiceConfig,
} from '@services/session/SessionService';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    // Reset mocks
    mockStore.clearSession.mockReset();
    mockStore.clearTabSessions.mockReset();
    mockStore.hasSession.mockReset().mockReturnValue(true);
    mockStore.getAllSessionKeys.mockReset().mockReturnValue([]);
    mockStore.sessions = {};

    service = new SessionService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const svc = new SessionService();
      // Default includeQuery is true, includeHash is false
      const key1 = svc.getSessionKey(1, 'https://example.com/page?query=1');
      expect(key1).toContain('query=1');

      const key2 = svc.getSessionKey(1, 'https://example.com/page#section');
      expect(key2).not.toContain('#section');
    });

    it('should accept custom config', () => {
      const svc = new SessionService({
        includeQuery: false,
        includeHash: true,
      });

      const key1 = svc.getSessionKey(1, 'https://example.com/page?query=1');
      expect(key1).not.toContain('query=1');

      const key2 = svc.getSessionKey(1, 'https://example.com/page#section');
      expect(key2).toContain('#section');
    });
  });

  describe('getSessionKey', () => {
    it('should generate key with tabId and normalized URL', () => {
      const key = service.getSessionKey(123, 'https://example.com/page');

      expect(key).toBe('tab_123:https://example.com/page');
    });

    it('should include query string by default', () => {
      const key = service.getSessionKey(123, 'https://example.com/page?id=1&sort=asc');

      expect(key).toContain('?id=1&sort=asc');
    });

    it('should exclude hash by default', () => {
      const key = service.getSessionKey(123, 'https://example.com/page#section');

      expect(key).not.toContain('#section');
    });

    it('should remove trailing slash', () => {
      const key = service.getSessionKey(123, 'https://example.com/page/');

      expect(key).toBe('tab_123:https://example.com/page');
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info object', () => {
      const info = service.getSessionInfo(123, 'https://example.com/page?q=1');

      expect(info).toEqual({
        sessionKey: 'tab_123:https://example.com/page?q=1',
        tabId: 123,
        url: 'https://example.com/page?q=1',
        normalizedUrl: 'https://example.com/page?q=1',
      });
    });
  });

  describe('clearSession', () => {
    it('should call store clearSession', () => {
      service.clearSession('tab_1:https://example.com');

      expect(mockStore.clearSession).toHaveBeenCalledWith('tab_1:https://example.com');
    });

    it('should throw wrapped error on store failure', () => {
      mockStore.clearSession.mockImplementationOnce(() => {
        throw new Error('Store error');
      });

      expect(() => service.clearSession('key')).toThrow('Failed to clear session: Store error');
    });
  });

  describe('clearTabSessions', () => {
    it('should call store clearTabSessions', () => {
      service.clearTabSessions(123);

      expect(mockStore.clearTabSessions).toHaveBeenCalledWith(123);
    });

    it('should throw wrapped error on store failure', () => {
      mockStore.clearTabSessions.mockImplementationOnce(() => {
        throw new Error('Store error');
      });

      expect(() => service.clearTabSessions(123)).toThrow(
        'Failed to clear tab sessions: Store error'
      );
    });
  });

  describe('hasSession', () => {
    it('should return true when session exists', () => {
      mockStore.hasSession.mockReturnValue(true);

      expect(service.hasSession(1, 'https://example.com')).toBe(true);
    });

    it('should return false when session does not exist', () => {
      mockStore.hasSession.mockReturnValue(false);

      expect(service.hasSession(1, 'https://example.com')).toBe(false);
    });

    it('should throw wrapped error on store failure', () => {
      mockStore.hasSession.mockImplementationOnce(() => {
        throw new Error('Store error');
      });

      expect(() => service.hasSession(1, 'url')).toThrow('Failed to check session');
    });
  });

  describe('getAllSessionKeys', () => {
    it('should return all session keys', () => {
      mockStore.getAllSessionKeys.mockReturnValue(['key1', 'key2', 'key3']);

      expect(service.getAllSessionKeys()).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return empty array on error', () => {
      mockStore.getAllSessionKeys.mockImplementationOnce(() => {
        throw new Error('Error');
      });

      expect(service.getAllSessionKeys()).toEqual([]);
    });
  });

  describe('getTabSessions', () => {
    it('should filter sessions by tab ID', () => {
      mockStore.getAllSessionKeys.mockReturnValue([
        'tab_1:https://a.com',
        'tab_1:https://b.com',
        'tab_2:https://c.com',
      ]);

      expect(service.getTabSessions(1)).toEqual(['tab_1:https://a.com', 'tab_1:https://b.com']);
    });

    it('should return empty array when no matching sessions', () => {
      mockStore.getAllSessionKeys.mockReturnValue(['tab_1:url']);

      expect(service.getTabSessions(999)).toEqual([]);
    });
  });

  describe('parseSessionKey', () => {
    it('should parse valid session key', () => {
      const result = service.parseSessionKey('tab_123:https://example.com/page');

      expect(result).toEqual({
        tabId: 123,
        url: 'https://example.com/page',
      });
    });

    it('should return null for invalid format', () => {
      expect(service.parseSessionKey('invalid')).toBeNull();
      expect(service.parseSessionKey('tab_abc:url')).toBeNull();
    });
  });

  describe('isSameSession', () => {
    it('should return true for same normalized URLs', () => {
      expect(service.isSameSession('https://example.com/page/', 'https://example.com/page')).toBe(
        true
      );
    });

    it('should return false for different URLs', () => {
      expect(service.isSameSession('https://example.com/page1', 'https://example.com/page2')).toBe(
        false
      );
    });

    it('should consider query params when includeQuery is true', () => {
      expect(
        service.isSameSession('https://example.com/page?a=1', 'https://example.com/page?a=2')
      ).toBe(false);
    });
  });

  describe('cleanupInactiveSessions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clean up sessions older than maxAge', () => {
      const now = Date.now();
      mockStore.sessions = {
        'old-session': { lastAccessedAt: now - 25 * 60 * 60 * 1000 }, // 25 hours ago
        'new-session': { lastAccessedAt: now - 1 * 60 * 60 * 1000 }, // 1 hour ago
      };

      const cleaned = service.cleanupInactiveSessions({ maxAge: 24 * 60 * 60 * 1000 });

      expect(cleaned).toBe(1);
      expect(mockStore.clearSession).toHaveBeenCalledWith('old-session');
    });

    it('should clean up excess sessions based on maxSessions', () => {
      const now = Date.now();
      mockStore.sessions = {
        'session-1': { lastAccessedAt: now - 5000 },
        'session-2': { lastAccessedAt: now - 4000 },
        'session-3': { lastAccessedAt: now - 3000 },
        'session-4': { lastAccessedAt: now - 2000 },
        'session-5': { lastAccessedAt: now - 1000 },
      };

      const cleaned = service.cleanupInactiveSessions({
        maxSessions: 3,
        maxAge: Infinity,
      });

      expect(cleaned).toBe(2);
    });

    it('should use default maxAge of 24 hours', () => {
      const now = Date.now();
      mockStore.sessions = {
        old: { lastAccessedAt: now - 25 * 60 * 60 * 1000 },
      };

      service.cleanupInactiveSessions({});

      expect(mockStore.clearSession).toHaveBeenCalled();
    });

    it('should use default maxSessions of 100', () => {
      const now = Date.now();
      mockStore.sessions = {};

      // Create 105 sessions
      for (let i = 0; i < 105; i++) {
        mockStore.sessions[`session-${i}`] = { lastAccessedAt: now - i * 1000 };
      }

      const cleaned = service.cleanupInactiveSessions({ maxAge: Infinity });

      expect(cleaned).toBe(5);
    });
  });

  describe('URL normalization', () => {
    it('should preserve data: URLs as-is', () => {
      const key = service.getSessionKey(1, 'data:text/html,<h1>Hello</h1>');

      expect(key).toBe('tab_1:data:text/html,<h1>Hello</h1>');
    });

    it('should preserve blob: URLs as-is', () => {
      const key = service.getSessionKey(1, 'blob:https://example.com/uuid');

      expect(key).toBe('tab_1:blob:https://example.com/uuid');
    });

    it('should preserve file: URLs as-is', () => {
      const key = service.getSessionKey(1, 'file:///path/to/file.html');

      expect(key).toBe('tab_1:file:///path/to/file.html');
    });

    it('should preserve chrome:// URLs as-is', () => {
      const key = service.getSessionKey(1, 'chrome://extensions');

      expect(key).toBe('tab_1:chrome://extensions');
    });

    it('should handle invalid URLs gracefully', () => {
      const key = service.getSessionKey(1, 'not a valid url');

      expect(key).toBe('tab_1:not a valid url');
    });

    it('should decode URI encoded paths', () => {
      const key = service.getSessionKey(1, 'https://example.com/path%20with%20spaces');

      expect(key).toContain('path with spaces');
    });
  });

  describe('custom normalizeUrlFn', () => {
    it('should use custom normalization function', () => {
      const customNormalizer = vi.fn().mockReturnValue('custom-normalized');
      const svc = new SessionService({ normalizeUrlFn: customNormalizer });

      const key = svc.getSessionKey(1, 'https://example.com');

      expect(customNormalizer).toHaveBeenCalledWith('https://example.com');
      expect(key).toBe('tab_1:custom-normalized');
    });
  });
});

describe('createSessionService', () => {
  it('should create service with default config', () => {
    const service = createSessionService();
    expect(service).toBeInstanceOf(SessionService);
  });

  it('should create service with custom config', () => {
    const config: SessionServiceConfig = { includeQuery: false };
    const service = createSessionService(config);
    expect(service).toBeInstanceOf(SessionService);
  });
});
