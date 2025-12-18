/**
 * @file Error Utility Tests
 *
 * Tests for error classification and source detection utilities.
 */

import { describe, it, expect } from 'vitest';
import { isNetworkError, isAuthError, getErrorSource } from '@core/utils/errorUtils';

describe('isNetworkError', () => {
  describe('string input', () => {
    it('should detect network keyword', () => {
      expect(isNetworkError('Network request failed')).toBe(true);
      expect(isNetworkError('NETWORK_ERROR')).toBe(true);
    });

    it('should detect timeout keyword', () => {
      expect(isNetworkError('Request timeout')).toBe(true);
      expect(isNetworkError('TIMEOUT exceeded')).toBe(true);
    });

    it('should detect connection keyword', () => {
      expect(isNetworkError('Connection refused')).toBe(true);
      expect(isNetworkError('Lost connection to server')).toBe(true);
    });

    it('should detect fetch keyword', () => {
      expect(isNetworkError('fetch failed')).toBe(true);
      expect(isNetworkError('Failed to fetch')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isNetworkError('NETWORK ERROR')).toBe(true);
      expect(isNetworkError('Network Error')).toBe(true);
      expect(isNetworkError('network error')).toBe(true);
    });

    it('should return false for non-network errors', () => {
      expect(isNetworkError('Invalid input')).toBe(false);
      expect(isNetworkError('Permission denied')).toBe(false);
    });
  });

  describe('Error object input', () => {
    it('should detect network error from Error message', () => {
      const error = new Error('Network request failed');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for non-network Error', () => {
      const error = new Error('Invalid data');
      expect(isNetworkError(error)).toBe(false);
    });
  });
});

describe('isAuthError', () => {
  describe('string input', () => {
    it('should detect unauthorized keyword', () => {
      expect(isAuthError('Unauthorized access')).toBe(true);
      expect(isAuthError('UNAUTHORIZED')).toBe(true);
    });

    it('should detect 401 status code', () => {
      expect(isAuthError('Error: 401 Unauthorized')).toBe(true);
      expect(isAuthError('HTTP 401 response')).toBe(true);
    });

    it('should detect 403 status code', () => {
      expect(isAuthError('Error: 403 Forbidden')).toBe(true);
      expect(isAuthError('HTTP 403 response')).toBe(true);
    });

    it('should detect api key keyword', () => {
      expect(isAuthError('Invalid API key')).toBe(true);
      expect(isAuthError('API Key required')).toBe(true);
      expect(isAuthError('api key expired')).toBe(true);
    });

    it('should detect authentication keyword', () => {
      expect(isAuthError('Authentication failed')).toBe(true);
      expect(isAuthError('AUTHENTICATION_ERROR')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isAuthError('UNAUTHORIZED')).toBe(true);
      expect(isAuthError('Unauthorized')).toBe(true);
      expect(isAuthError('unauthorized')).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      expect(isAuthError('Network error')).toBe(false);
      expect(isAuthError('Invalid input')).toBe(false);
    });
  });

  describe('Error object input', () => {
    it('should detect auth error from Error message', () => {
      const error = new Error('Invalid API key');
      expect(isAuthError(error)).toBe(true);
    });

    it('should return false for non-auth Error', () => {
      const error = new Error('Network timeout');
      expect(isAuthError(error)).toBe(false);
    });
  });
});

describe('getErrorSource', () => {
  describe('network source', () => {
    it('should return network for network errors', () => {
      expect(getErrorSource('Network request failed')).toBe('network');
      expect(getErrorSource(new Error('Connection timeout'))).toBe('network');
    });
  });

  describe('provider source', () => {
    it('should return provider for auth errors', () => {
      expect(getErrorSource('Invalid API key')).toBe('provider');
      expect(getErrorSource(new Error('401 Unauthorized'))).toBe('provider');
    });

    it('should return provider for provider-related errors', () => {
      expect(getErrorSource('Provider initialization failed')).toBe('provider');
      expect(getErrorSource('provider error')).toBe('provider');
    });

    it('should return provider for API-related errors', () => {
      expect(getErrorSource('API rate limit exceeded')).toBe('provider');
      expect(getErrorSource('Invalid API response')).toBe('provider');
    });
  });

  describe('chat source', () => {
    it('should return chat for chat-related errors', () => {
      expect(getErrorSource('Chat session expired')).toBe('chat');
      expect(getErrorSource('Failed to load chat history')).toBe('chat');
    });

    it('should return chat for message-related errors', () => {
      expect(getErrorSource('Message send failed')).toBe('chat');
      expect(getErrorSource('Invalid message format')).toBe('chat');
    });
  });

  describe('settings source', () => {
    it('should return settings for settings-related errors', () => {
      expect(getErrorSource('Settings validation failed')).toBe('settings');
      expect(getErrorSource('Failed to load settings')).toBe('settings');
    });

    it('should return settings for storage-related errors', () => {
      expect(getErrorSource('Storage quota exceeded')).toBe('settings');
      expect(getErrorSource('Storage access denied')).toBe('settings');
    });
  });

  describe('unknown source', () => {
    it('should return unknown for unclassified errors', () => {
      expect(getErrorSource('Something went wrong')).toBe('unknown');
      expect(getErrorSource(new Error('Generic error'))).toBe('unknown');
    });

    it('should return unknown for empty message', () => {
      expect(getErrorSource('')).toBe('unknown');
    });
  });

  describe('classification precedence', () => {
    it('should prioritize network over other classifications', () => {
      // Network errors take precedence
      expect(getErrorSource('Network error in chat')).toBe('network');
    });

    it('should prioritize auth over provider when both match', () => {
      // Auth is checked second, so provider keywords in auth errors still return provider
      expect(getErrorSource('Unauthorized API access')).toBe('provider');
    });
  });

  describe('Error object input', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Network timeout');
      expect(getErrorSource(error)).toBe('network');
    });

    it('should handle Error with complex message', () => {
      const error = new Error('Failed to authenticate with API provider');
      expect(getErrorSource(error)).toBe('provider');
    });
  });
});
