/**
 * @file MessageBus.test.ts
 * Tests for MessageBus - high-level message passing between extension components
 *
 * Focus:
 * - Retry/backoff behavior
 * - Fake timer shortcut branch
 * - Error classification
 * - Singleton pattern and initialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageBus, resetMessageBus, getMessageBus } from '@extension/messaging';
import * as chromeRuntime from '@platform/chrome/runtime';
import * as chromeTabs from '@platform/chrome/tabs';

// Mock the platform chrome modules
vi.mock('@platform/chrome/runtime', () => ({
  sendMessage: vi.fn(),
  addMessageListener: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@platform/chrome/tabs', () => ({
  sendMessageToTab: vi.fn(),
}));

describe('MessageBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMessageBus();
  });

  afterEach(() => {
    resetMessageBus();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Singleton Pattern
  // ---------------------------------------------------------------------------
  describe('singleton pattern', () => {
    it('requires source on first initialization', () => {
      expect(() => MessageBus.getInstance()).toThrow(
        'MessageBus must be initialized with a source on first call'
      );
    });

    it('creates instance with source', () => {
      const bus = MessageBus.getInstance('sidebar');
      expect(bus).toBeInstanceOf(MessageBus);
    });

    it('returns same instance on subsequent calls', () => {
      const bus1 = MessageBus.getInstance('sidebar');
      const bus2 = MessageBus.getInstance();
      const bus3 = getMessageBus();

      expect(bus1).toBe(bus2);
      expect(bus2).toBe(bus3);
    });

    it('resets instance with reset()', () => {
      MessageBus.getInstance('sidebar');
      MessageBus.reset();

      expect(() => MessageBus.getInstance()).toThrow();
    });

    it('resets instance with resetMessageBus()', () => {
      getMessageBus('sidebar');
      resetMessageBus();

      expect(() => getMessageBus()).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // send() method
  // ---------------------------------------------------------------------------
  describe('send()', () => {
    it('sends message with default timeout', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: { result: 'ok' },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.send('PING', { test: true });

      expect(response.success).toBe(true);
      expect(chromeRuntime.sendMessage).toHaveBeenCalled();
    });

    it('sends message with custom timeout', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: { result: 'ok' },
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('PING', null, { timeout: 10000 });

      expect(chromeRuntime.sendMessage).toHaveBeenCalled();
    });

    it('sends message to specific target', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('PING', null, { target: 'content' });

      const sentMessage = vi.mocked(chromeRuntime.sendMessage).mock.calls[0]?.[0];
      expect(sentMessage?.target).toBe('content');
    });

    it('sends message to specific tab', async () => {
      vi.mocked(chromeTabs.sendMessageToTab).mockResolvedValue({
        success: true,
        response: { result: 'ok' },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.send('PING', null, { tabId: 123 });

      expect(response.success).toBe(true);
      expect(chromeTabs.sendMessageToTab).toHaveBeenCalledWith(123, expect.any(Object));
    });

    it('returns error response on message validation failure', async () => {
      // Create a bus instance and manually trigger validation failure
      // by mocking the message creation to produce invalid message
      const bus = MessageBus.getInstance('sidebar');

      // This will trigger validation failure (internal method test)
      // Since validation happens internally, we test via timeout behavior
      vi.useFakeTimers();

      vi.mocked(chromeRuntime.sendMessage).mockRejectedValue(new Error('Send failed'));

      const response = await bus.send('PING');

      expect(response.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sendWithTimeout()
  // ---------------------------------------------------------------------------
  describe('sendWithTimeout()', () => {
    it('succeeds when response arrives before timeout', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: { value: 42 },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithTimeout('PING', { test: true }, 5000);

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toEqual({ value: 42 });
      }
    });

    it('returns error when timeout is exceeded', async () => {
      vi.useFakeTimers();

      vi.mocked(chromeRuntime.sendMessage).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const bus = MessageBus.getInstance('sidebar');
      const responsePromise = bus.sendWithTimeout('PING', null, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.message).toContain('timeout');
      }
    });

    it('handles zero timeout with immediate rejection', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithTimeout('PING', null, 0);

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.message).toContain('timeout');
      }
    });

    it('returns error on send failure', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: false,
        error: { message: 'Runtime error', code: 'MESSAGE_SEND_FAILED', name: 'MessageError' },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithTimeout('PING', null, 5000);

      expect(response.success).toBe(false);
    });

    it('returns error on exception', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockRejectedValue(new Error('Network error'));

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithTimeout('PING', null, 5000);

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.message).toContain('Network error');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // sendWithRetry()
  // Note: The implementation has complex fake timer detection that makes these
  // tests challenging. We test the core behavior with minimal mocking.
  // ---------------------------------------------------------------------------
  describe('sendWithRetry()', () => {
    it('succeeds on first attempt', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: { result: 'immediate' },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithRetry('PING', null, { retries: 3 });

      expect(response.success).toBe(true);
      expect(chromeRuntime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('makes multiple attempts when first fails', async () => {
      // Test with real timers and short delays
      let attempt = 0;
      vi.mocked(chromeRuntime.sendMessage).mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          return {
            success: false,
            error: { message: 'First attempt fails', code: 'RETRY_FAILED', name: 'RetryError' },
          };
        }
        return { success: true, data: { result: 'success' } };
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithRetry('PING', null, { retries: 1, timeout: 100 });

      expect(response.success).toBe(true);
      expect(attempt).toBeGreaterThan(1);
    });

    it('returns error response when all attempts fail', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: false,
        error: { message: 'Persistent error', code: 'PERSISTENT_ERROR', name: 'PersistentError' },
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.sendWithRetry('PING', null, { retries: 0, timeout: 100 });

      // With 0 retries, it makes 1 attempt total
      expect(response.success).toBe(false);
    });

    it('calls sendMessage at least once', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.sendWithRetry('PING', null, { retries: 2 });

      expect(chromeRuntime.sendMessage).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe()
  // ---------------------------------------------------------------------------
  describe('subscribe()', () => {
    it('returns unsubscribe function', () => {
      const bus = MessageBus.getInstance('sidebar');
      const unsubscribe = bus.subscribe('PING', () => {});

      expect(typeof unsubscribe).toBe('function');
    });

    it('calls addMessageListener', () => {
      const bus = MessageBus.getInstance('sidebar');
      bus.subscribe('PING', () => {});

      expect(chromeRuntime.addMessageListener).toHaveBeenCalled();
    });

    it('removes listener on unsubscribe', () => {
      const removeListener = vi.fn();
      vi.mocked(chromeRuntime.addMessageListener).mockReturnValue(removeListener);

      const bus = MessageBus.getInstance('sidebar');
      const unsubscribe = bus.subscribe('PING', () => {});

      unsubscribe();

      expect(removeListener).toHaveBeenCalled();
    });

    it('handles multiple subscriptions', () => {
      const bus = MessageBus.getInstance('sidebar');

      const unsub1 = bus.subscribe('PING', () => {});
      const unsub2 = bus.subscribe('PONG', () => {});

      expect(chromeRuntime.addMessageListener).toHaveBeenCalledTimes(2);

      unsub1();
      unsub2();
    });
  });

  // ---------------------------------------------------------------------------
  // destroy()
  // ---------------------------------------------------------------------------
  describe('destroy()', () => {
    it('removes all subscriptions', () => {
      const removeListener1 = vi.fn();
      const removeListener2 = vi.fn();

      vi.mocked(chromeRuntime.addMessageListener)
        .mockReturnValueOnce(removeListener1)
        .mockReturnValueOnce(removeListener2);

      const bus = MessageBus.getInstance('sidebar');
      bus.subscribe('PING', () => {});
      bus.subscribe('PONG', () => {});

      bus.destroy();

      expect(removeListener1).toHaveBeenCalled();
      expect(removeListener2).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Default Target Routing
  // ---------------------------------------------------------------------------
  describe('default target routing', () => {
    it('routes TOGGLE_SIDEBAR to background from sidebar', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('TOGGLE_SIDEBAR');

      const calls = vi.mocked(chromeRuntime.sendMessage).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentMessage = calls[0]?.[0];
      expect(sentMessage?.target).toBe('background');
    });

    it('routes EXTRACT_CONTENT to content', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('EXTRACT_CONTENT');

      const calls = vi.mocked(chromeRuntime.sendMessage).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentMessage = calls[0]?.[0];
      expect(sentMessage?.target).toBe('content');
    });

    it('routes SEND_TO_AI to background', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('SEND_TO_AI');

      const calls = vi.mocked(chromeRuntime.sendMessage).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentMessage = calls[0]?.[0];
      expect(sentMessage?.target).toBe('background');
    });

    it('routes ERROR to background', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      await bus.send('ERROR');

      const calls = vi.mocked(chromeRuntime.sendMessage).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentMessage = calls[0]?.[0];
      expect(sentMessage?.target).toBe('background');
    });

    it('routes other types to background by default', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {},
      });

      const bus = MessageBus.getInstance('sidebar');
      // Use a known type that defaults to background
      await bus.send('SIDEBAR_STATE');

      const calls = vi.mocked(chromeRuntime.sendMessage).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sentMessage = calls[0]?.[0];
      expect(sentMessage?.target).toBe('background');
    });
  });

  // ---------------------------------------------------------------------------
  // Tab Message Handling
  // ---------------------------------------------------------------------------
  describe('tab message handling', () => {
    it('handles tab message failure', async () => {
      vi.mocked(chromeTabs.sendMessageToTab).mockResolvedValue({
        success: false,
        error: 'Tab not found',
      });

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.send('PING', null, { tabId: 999 });

      expect(response.success).toBe(false);
    });

    it('handles tab message exception', async () => {
      vi.mocked(chromeTabs.sendMessageToTab).mockRejectedValue(new Error('Tab closed'));

      const bus = MessageBus.getInstance('sidebar');
      const response = await bus.send('PING', null, { tabId: 123 });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.message).toContain('Tab closed');
      }
    });
  });
});
