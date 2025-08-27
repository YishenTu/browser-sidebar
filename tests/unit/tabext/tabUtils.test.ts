/**
 * @file Tab Utilities Tests
 *
 * Unit tests for the tab utility functions that interact with
 * the background script to retrieve tab information.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentTabId, getCurrentTabIdSafe, exampleUsage } from '@/tabext/tabUtils';
import { getMessageBus } from '@/extension/messaging';

// Mock the messaging system
vi.mock('@/extension/messaging', () => ({
  getMessageBus: vi.fn(),
  MessageBus: {
    getInstance: vi.fn(),
  },
}));

describe('Tab Utilities', () => {
  let mockMessageBus: any;

  beforeEach(() => {
    mockMessageBus = {
      sendWithRetry: vi.fn(),
    };
    vi.mocked(getMessageBus).mockReturnValue(mockMessageBus);
    // Clear console methods for testing
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentTabId', () => {
    test('should return tab ID when message succeeds', async () => {
      const expectedTabId = 123;
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: { tabId: expectedTabId },
      });

      const result = await getCurrentTabId();

      expect(result).toBe(expectedTabId);
      expect(getMessageBus).toHaveBeenCalledWith('content');
      expect(mockMessageBus.sendWithRetry).toHaveBeenCalledWith('GET_TAB_ID');
    });

    test('should throw error when message fails', async () => {
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: false,
        error: { message: 'Background script error' },
      });

      await expect(getCurrentTabId()).rejects.toThrow(
        'Failed to get tab ID: Background script error'
      );
    });

    test('should throw error when tab ID is missing from response', async () => {
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: {}, // Missing tabId
      });

      await expect(getCurrentTabId()).rejects.toThrow('Tab ID not found in response');
    });

    test('should throw error when tab ID is null', async () => {
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: { tabId: null },
      });

      await expect(getCurrentTabId()).rejects.toThrow('Tab ID not found in response');
    });

    test('should handle message bus exceptions', async () => {
      mockMessageBus.sendWithRetry.mockRejectedValue(new Error('Connection failed'));

      await expect(getCurrentTabId()).rejects.toThrow(
        'Unable to get current tab ID: Connection failed'
      );
    });

    test('should handle non-Error exceptions', async () => {
      mockMessageBus.sendWithRetry.mockRejectedValue('String error');

      await expect(getCurrentTabId()).rejects.toThrow('Unable to get current tab ID: String error');
    });
  });

  describe('getCurrentTabIdSafe', () => {
    test('should return tab ID when message succeeds', async () => {
      const expectedTabId = 456;
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: { tabId: expectedTabId },
      });

      const result = await getCurrentTabIdSafe();

      expect(result).toBe(expectedTabId);
    });

    test('should return null when message fails', async () => {
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: false,
        error: { message: 'Background script error' },
      });

      const result = await getCurrentTabIdSafe();

      expect(result).toBe(null);
    });

    test('should return null when tab ID is missing', async () => {
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await getCurrentTabIdSafe();

      expect(result).toBe(null);
    });

    test('should return null on exceptions', async () => {
      mockMessageBus.sendWithRetry.mockRejectedValue(new Error('Connection failed'));

      const result = await getCurrentTabIdSafe();

      expect(result).toBe(null);
    });
  });

  describe('exampleUsage', () => {
    test('should log tab ID when successful', async () => {
      const expectedTabId = 789;
      mockMessageBus.sendWithRetry.mockResolvedValue({
        success: true,
        data: { tabId: expectedTabId },
      });

      await exampleUsage();

      expect(console.log).toHaveBeenCalledWith('Getting current tab ID...');
      expect(console.log).toHaveBeenCalledWith('Current tab ID:', expectedTabId);
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should handle failures gracefully with fallback', async () => {
      // First call (getCurrentTabId) fails
      // Second call (getCurrentTabIdSafe) succeeds
      mockMessageBus.sendWithRetry
        .mockResolvedValueOnce({
          success: false,
          error: { message: 'First attempt failed' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { tabId: 999 },
        });

      await exampleUsage();

      expect(console.log).toHaveBeenCalledWith('Getting current tab ID...');
      expect(console.error).toHaveBeenCalledWith('Failed to get tab ID:', expect.any(Error));
      expect(console.log).toHaveBeenCalledWith('Got tab ID via safe method:', 999);
    });

    test('should handle complete failure', async () => {
      // Both calls fail
      mockMessageBus.sendWithRetry
        .mockResolvedValueOnce({
          success: false,
          error: { message: 'First attempt failed' },
        })
        .mockResolvedValueOnce({
          success: false,
          error: { message: 'Second attempt also failed' },
        });

      await exampleUsage();

      expect(console.log).toHaveBeenCalledWith('Getting current tab ID...');
      expect(console.error).toHaveBeenCalledWith('Failed to get tab ID:', expect.any(Error));
      expect(console.warn).toHaveBeenCalledWith('Unable to determine tab ID');
    });
  });
});
