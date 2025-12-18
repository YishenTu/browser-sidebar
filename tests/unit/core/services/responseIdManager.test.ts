/**
 * @file Response ID Manager Tests
 *
 * Tests for the response ID manager that handles provider response IDs
 * for conversation continuity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a mock session data holder
let mockSessionData: {
  lastResponseId?: string | null;
  lastResponseProvider?: string | null;
} | null = null;

// Mock the session store before importing responseIdManager
vi.mock('@store/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      getActiveSession: () => mockSessionData,
      updateActiveSession: (updates: Record<string, unknown>) => {
        if (mockSessionData) {
          mockSessionData = { ...mockSessionData, ...updates };
        }
      },
    }),
  },
}));

// Import after mock setup
import { responseIdManager } from '@core/services/responseIdManager';

describe('responseIdManager', () => {
  beforeEach(() => {
    // Reset mock session data
    mockSessionData = null;
    // Clear manager's internal state
    responseIdManager.clearResponseId();
  });

  describe('supportsProvider', () => {
    it('should return true for openai', () => {
      expect(responseIdManager.supportsProvider('openai')).toBe(true);
    });

    it('should return true for grok', () => {
      expect(responseIdManager.supportsProvider('grok')).toBe(true);
    });

    it('should return false for gemini', () => {
      expect(responseIdManager.supportsProvider('gemini')).toBe(false);
    });

    it('should return false for openrouter', () => {
      expect(responseIdManager.supportsProvider('openrouter')).toBe(false);
    });

    it('should return false for null', () => {
      expect(responseIdManager.supportsProvider(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(responseIdManager.supportsProvider(undefined)).toBe(false);
    });
  });

  describe('storeResponseId', () => {
    it('should store response ID for openai', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');
      responseIdManager.storeResponseId('openai', 'resp-123');

      expect(mockSessionData.lastResponseId).toBe('resp-123');
      expect(mockSessionData.lastResponseProvider).toBe('openai');
    });

    it('should store response ID for grok', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('grok');
      responseIdManager.storeResponseId('grok', 'resp-456');

      expect(mockSessionData.lastResponseId).toBe('resp-456');
      expect(mockSessionData.lastResponseProvider).toBe('grok');
    });

    it('should not store response ID for unsupported provider', () => {
      mockSessionData = {};
      responseIdManager.storeResponseId('gemini', 'resp-789');

      expect(mockSessionData.lastResponseId).toBeUndefined();
    });

    it('should not store empty response ID', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');
      responseIdManager.storeResponseId('openai', '');

      expect(mockSessionData.lastResponseId).toBeUndefined();
    });

    it('should do nothing when no active session', () => {
      mockSessionData = null;
      // Should not throw
      responseIdManager.storeResponseId('openai', 'resp-123');
      expect(mockSessionData).toBeNull();
    });
  });

  describe('getResponseId', () => {
    it('should return stored response ID for active provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-stored',
        lastResponseProvider: 'openai',
      };
      responseIdManager.setActiveProvider('openai');

      const result = responseIdManager.getResponseId();

      expect(result).toBe('resp-stored');
    });

    it('should return null for mismatched provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-stored',
        lastResponseProvider: 'openai',
      };

      const result = responseIdManager.getResponseId('grok');

      expect(result).toBeNull();
    });

    it('should return null when no response ID stored', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');

      expect(responseIdManager.getResponseId()).toBeNull();
    });

    it('should return null for unsupported provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-123',
        lastResponseProvider: 'gemini',
      };

      expect(responseIdManager.getResponseId('gemini')).toBeNull();
    });

    it('should return null when no active session', () => {
      mockSessionData = null;
      expect(responseIdManager.getResponseId()).toBeNull();
    });
  });

  describe('setActiveProvider', () => {
    it('should clear response ID when switching providers', () => {
      mockSessionData = {
        lastResponseId: 'resp-openai',
        lastResponseProvider: 'openai',
      };
      responseIdManager.setActiveProvider('openai');

      // Switch to different provider
      responseIdManager.setActiveProvider('grok');

      expect(mockSessionData.lastResponseId).toBeNull();
    });

    it('should clear response ID when setting unsupported provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-openai',
        lastResponseProvider: 'openai',
      };
      responseIdManager.setActiveProvider('openai');

      responseIdManager.setActiveProvider('gemini');

      expect(mockSessionData.lastResponseId).toBeNull();
    });

    it('should clear response ID when setting null provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-openai',
        lastResponseProvider: 'openai',
      };
      responseIdManager.setActiveProvider('openai');

      responseIdManager.setActiveProvider(null);

      expect(mockSessionData.lastResponseId).toBeNull();
    });

    it('should not clear response ID when setting same provider', () => {
      mockSessionData = {
        lastResponseId: 'resp-openai',
        lastResponseProvider: 'openai',
      };
      responseIdManager.setActiveProvider('openai');

      responseIdManager.setActiveProvider('openai');

      expect(mockSessionData.lastResponseId).toBe('resp-openai');
    });
  });

  describe('clearResponseId', () => {
    it('should clear stored response ID', () => {
      mockSessionData = {
        lastResponseId: 'resp-123',
        lastResponseProvider: 'openai',
      };

      responseIdManager.clearResponseId();

      expect(mockSessionData.lastResponseId).toBeNull();
      expect(mockSessionData.lastResponseProvider).toBeNull();
    });

    it('should be safe to call when nothing stored', () => {
      mockSessionData = {};

      // Should not throw
      responseIdManager.clearResponseId();

      expect(mockSessionData.lastResponseId).toBeUndefined();
    });

    it('should be safe to call when no session', () => {
      mockSessionData = null;

      // Should not throw
      responseIdManager.clearResponseId();

      expect(mockSessionData).toBeNull();
    });
  });

  describe('provider switching scenarios', () => {
    it('should preserve response ID when staying with same provider', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');
      responseIdManager.storeResponseId('openai', 'resp-1');

      // Make another request with same provider
      responseIdManager.setActiveProvider('openai');

      expect(mockSessionData.lastResponseId).toBe('resp-1');
    });

    it('should clear response ID when switching from openai to grok', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');
      responseIdManager.storeResponseId('openai', 'resp-openai');

      responseIdManager.setActiveProvider('grok');

      expect(mockSessionData.lastResponseId).toBeNull();
    });

    it('should clear response ID when switching from grok to openai', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('grok');
      responseIdManager.storeResponseId('grok', 'resp-grok');

      responseIdManager.setActiveProvider('openai');

      expect(mockSessionData.lastResponseId).toBeNull();
    });

    it('should clear response ID when switching to unsupported provider', () => {
      mockSessionData = {};
      responseIdManager.setActiveProvider('openai');
      responseIdManager.storeResponseId('openai', 'resp-openai');

      responseIdManager.setActiveProvider('gemini');

      expect(mockSessionData.lastResponseId).toBeNull();
    });
  });
});
