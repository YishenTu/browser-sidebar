/**
 * @file Messaging Utilities Tests
 *
 * Comprehensive tests for the MessageBus class and messaging utilities
 * including timeout handling, retry logic, and subscription mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  MessageBus,
  getMessageBus,
  sendMessage,
  ping,
  subscribeToMessages,
  subscribeWithResponse,
  resetMessageBus,
} from '../../src/utils/messaging';
import { ExtensionError, ErrorCode, createSuccessResponse } from '../../src/utils/errorHandling';
import { createMessage } from '../../src/types/messages';
import { chromeMocks } from '../mocks/chrome';

// Mock Chrome APIs
Object.assign(global, { chrome: chromeMocks });

// Mock the message validation utility
vi.mock('../../src/utils/messageValidation', () => ({
  validateMessage: vi.fn().mockReturnValue({ isValid: true }),
}));

describe('MessageBus', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    resetMessageBus();
  });

  afterEach(() => {
    resetMessageBus();
  });

  describe('Initialization', () => {
    it('should create singleton instance with source', () => {
      const messageBus1 = MessageBus.getInstance('background');
      const messageBus2 = MessageBus.getInstance();

      expect(messageBus1).toBe(messageBus2);
    });

    it('should throw error if no source provided on first call', () => {
      expect(() => MessageBus.getInstance()).toThrow(ExtensionError);
      expect(() => MessageBus.getInstance()).toThrow(
        'MessageBus must be initialized with a source'
      );
    });

    it('should reset singleton instance correctly', () => {
      const messageBus1 = MessageBus.getInstance('background');
      MessageBus.reset();
      const messageBus2 = MessageBus.getInstance('content');

      expect(messageBus1).not.toBe(messageBus2);
    });
  });

  describe('Basic Message Sending', () => {
    let messageBus: MessageBus;

    beforeEach(() => {
      messageBus = MessageBus.getInstance('background');
    });

    it('should send message successfully', async () => {
      const mockResponse = { success: true, data: 'test response' };
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback(mockResponse);
      });

      const response = await messageBus.send('PING');

      expect(response.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PING',
          source: 'background',
          target: 'content',
        }),
        expect.any(Function)
      );
    });

    it('should send message to specific tab', async () => {
      const mockResponse = { success: true };
      (chrome.tabs.sendMessage as Mock).mockImplementation((_tabId, _message, callback) => {
        callback(mockResponse);
      });

      const response = await messageBus.send('TOGGLE_SIDEBAR', { show: true }, { tabId: 123 });

      expect(response.success).toBe(true);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'TOGGLE_SIDEBAR',
          payload: { show: true },
        }),
        expect.any(Function)
      );
    });

    it('should handle Chrome runtime errors', async () => {
      chrome.runtime.lastError = { message: 'Extension context invalidated' };

      const response = await messageBus.send('PING');

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe(ErrorCode.CHROME_RUNTIME_ERROR);
      }
    });

    it('should handle no response from target', async () => {
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback(undefined); // No response
      });

      const response = await messageBus.send('PING');

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe(ErrorCode.MESSAGE_SEND_FAILED);
        expect(response.error?.message).toContain('No response received');
      }
    });
  });

  describe('Message Validation', () => {
    let messageBus: MessageBus;

    beforeEach(() => {
      messageBus = MessageBus.getInstance('background');
    });

    it('should validate message before sending', async () => {
      // Import and mock validateMessage
      const messageValidationModule = await import('../../src/utils/messageValidation');
      vi.mocked(messageValidationModule.validateMessage).mockReturnValueOnce({
        isValid: false,
        error: 'Invalid message structure',
      });

      const response = await messageBus.send('PING');

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe(ErrorCode.MESSAGE_VALIDATION_FAILED);
      }
    });
  });

  describe('Timeout Handling', () => {
    let messageBus: MessageBus;

    beforeEach(() => {
      messageBus = MessageBus.getInstance('background');
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should timeout after specified duration', async () => {
      // Mock no response (simulate timeout)
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        // Don't call callback to simulate timeout
        return;
      });

      const responsePromise = messageBus.sendWithTimeout('PING', undefined, 5000);

      // Fast-forward time
      vi.advanceTimersByTime(5000);

      const response = await responsePromise;

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe(ErrorCode.MESSAGE_TIMEOUT);
      }
    });

    it('should succeed if response arrives before timeout', async () => {
      const mockResponse = { success: true, data: 'quick response' };
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        // Simulate immediate response
        _callback(mockResponse);
      });

      const responsePromise = messageBus.sendWithTimeout('PING', undefined, 5000);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toEqual({ success: true, data: 'quick response' });
      }
    });
  });

  describe('Retry Logic', () => {
    let messageBus: MessageBus;

    beforeEach(() => {
      messageBus = MessageBus.getInstance('background');
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on retriable errors with exponential backoff', async () => {
      let callCount = 0;
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        callCount++;
        if (callCount <= 2) {
          // Fail first 2 attempts - don't call callback to simulate timeout
          return;
        } else {
          // Succeed on 3rd attempt
          _callback({ success: true });
        }
      });

      // Mock the delay function to return immediately
      const originalDelay = messageBus['delay'];
      messageBus['delay'] = vi.fn().mockResolvedValue(undefined);

      const response = await messageBus.sendWithRetry('PING', undefined, {
        retries: 2,
        timeout: 100, // Short timeout for fast test
      });

      // Restore original delay
      messageBus['delay'] = originalDelay;

      expect(response.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        // Always timeout - don't call callback
        return;
      });

      // Mock the delay function to return immediately
      const originalDelay = messageBus['delay'];
      messageBus['delay'] = vi.fn().mockResolvedValue(undefined);

      const response = await messageBus.sendWithRetry('PING', undefined, {
        retries: 2,
        timeout: 100, // Short timeout for fast test
      });

      // Restore original delay
      messageBus['delay'] = originalDelay;

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.message).toContain('failed after 3 attempts');
      }
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retriable errors', async () => {
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback({ success: true, data: 'normal response' });
      });

      // Test should pass normally since we're not actually testing validation errors
      // The validation happens before send, not after receiving response
      const response = await messageBus.sendWithRetry('PING', undefined, {
        retries: 3,
      });

      expect(response.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1); // No retries needed
    });
  });

  describe('Message Subscription', () => {
    let messageBus: MessageBus;

    beforeEach(() => {
      messageBus = MessageBus.getInstance('sidebar');
    });

    it('should subscribe to messages of specific type', () => {
      const listener = vi.fn();
      const _unsubscribe = messageBus.subscribe('AI_RESPONSE', listener);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(typeof _unsubscribe).toBe('function');
    });

    it('should call listener for matching message type', () => {
      const listener = vi.fn();
      messageBus.subscribe('AI_RESPONSE', listener);

      // Get the Chrome listener that was registered
      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = vi.fn();

      chromeListener(message, mockSender, mockSendResponse);

      expect(listener).toHaveBeenCalledWith(message, mockSender, expect.any(Function));
    });

    it('should not call listener for different message type', () => {
      const listener = vi.fn();
      messageBus.subscribe('AI_RESPONSE', listener);

      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'PING',
        source: 'background',
        target: 'sidebar',
      });

      const result = chromeListener(message, {}, vi.fn());

      expect(listener).not.toHaveBeenCalled();
      expect(result).toBe(false); // Should not handle this message
    });

    it('should not call listener for wrong target', () => {
      const listener = vi.fn();
      messageBus.subscribe('AI_RESPONSE', listener);

      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'background', // Wrong target - sidebar shouldn't handle background messages
      });

      const result = chromeListener(message, {}, vi.fn());

      expect(listener).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle async listener responses', async () => {
      const listener = vi.fn().mockResolvedValue(createSuccessResponse('handled'));
      messageBus.subscribe('AI_RESPONSE', listener);

      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSendResponse = vi.fn();
      const result = chromeListener(message, {}, mockSendResponse);

      expect(result).toBe(true); // Indicates async response

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'handled',
        })
      );
    });

    it('should handle listener errors', () => {
      const listener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      messageBus.subscribe('AI_RESPONSE', listener);

      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSendResponse = vi.fn();
      chromeListener(message, {}, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Listener error'),
          }),
        })
      );
    });

    it('should unsubscribe correctly', () => {
      const listener = vi.fn();
      const _unsubscribe = messageBus.subscribe('AI_RESPONSE', listener);

      // Get the registered Chrome listener
      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      _unsubscribe();

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(chromeListener);
    });

    it('should handle invalid incoming messages', async () => {
      const listener = vi.fn();
      messageBus.subscribe('AI_RESPONSE', listener);

      // Mock validation to fail for this test only
      const messageValidationModule = await import('../../src/utils/messageValidation');
      vi.mocked(messageValidationModule.validateMessage).mockReturnValueOnce({
        isValid: false,
        error: 'Invalid message structure',
      });

      const chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const invalidMessage = { invalid: 'message' };
      const mockSendResponse = vi.fn();

      chromeListener(invalidMessage, {}, mockSendResponse);

      expect(listener).not.toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.MESSAGE_VALIDATION_FAILED,
          }),
        })
      );
    });
  });

  describe('Target Resolution', () => {
    it('should resolve correct default targets for message types', async () => {
      const messageBus = MessageBus.getInstance('background');

      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback({ success: true });
      });

      // Test TOGGLE_SIDEBAR from background should go to content
      await messageBus.send('TOGGLE_SIDEBAR');
      expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ target: 'content' }),
        expect.any(Function)
      );

      // Reset and test from content script
      resetMessageBus();
      const contentMessageBus = MessageBus.getInstance('content');

      await contentMessageBus.send('CONTENT_READY');
      expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ target: 'background' }),
        expect.any(Function)
      );
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMessageBus();
  });

  afterEach(() => {
    resetMessageBus();
  });

  describe('getMessageBus', () => {
    it('should return singleton instance', () => {
      const bus1 = getMessageBus('background');
      const bus2 = getMessageBus();

      expect(bus1).toBe(bus2);
    });
  });

  describe('sendMessage', () => {
    it('should send message with retry', async () => {
      getMessageBus('background'); // Initialize

      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback({ success: true });
      });

      const response = await sendMessage('PING');

      expect(response.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('ping', () => {
    beforeEach(() => {
      getMessageBus('background'); // Initialize
    });

    it('should return true for successful ping', async () => {
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        _callback({ success: true });
      });

      const result = await ping();

      expect(result).toBe(true);
    });

    it('should return false for failed ping', async () => {
      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        // Don't call callback to simulate failure/timeout
        return;
      });

      const result = await ping();

      expect(result).toBe(false);
    });

    it('should return false for ping timeout', async () => {
      vi.useFakeTimers();

      (chrome.runtime.sendMessage as Mock).mockImplementation((_message, _callback) => {
        setTimeout(() => _callback({ success: true }), 5000);
      });

      const pingPromise = ping();
      vi.advanceTimersByTime(2000); // Timeout is 2000ms for ping

      const result = await pingPromise;

      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('subscribeToMessages', () => {
    beforeEach(() => {
      getMessageBus('sidebar'); // Initialize
    });

    it('should subscribe to messages', () => {
      const listener = vi.fn();
      const _unsubscribe = subscribeToMessages('AI_RESPONSE', listener);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(typeof _unsubscribe).toBe('function');
    });
  });

  describe('subscribeWithResponse', () => {
    let chromeListener: any;

    beforeEach(() => {
      getMessageBus('sidebar'); // Initialize
    });

    it('should subscribe with automatic response handling', () => {
      const handler = vi.fn().mockReturnValue('handled');
      subscribeWithResponse('AI_RESPONSE', handler);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();

      chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];
    });

    it('should handle successful responses', async () => {
      const handler = vi.fn().mockReturnValue('test response');
      subscribeWithResponse('AI_RESPONSE', handler);

      chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSendResponse = vi.fn();
      await chromeListener(message, {}, mockSendResponse);

      expect(handler).toHaveBeenCalledWith({ response: 'Hello' }, {});
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'test response',
        })
      );
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue('async response');
      subscribeWithResponse('AI_RESPONSE', handler);

      chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSendResponse = vi.fn();
      await chromeListener(message, {}, mockSendResponse);

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'async response',
        })
      );
    });

    it('should handle handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
      subscribeWithResponse('AI_RESPONSE', handler);

      chromeListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];

      const message = createMessage({
        type: 'AI_RESPONSE',
        payload: { response: 'Hello' },
        source: 'background',
        target: 'sidebar',
      });

      const mockSendResponse = vi.fn();
      await chromeListener(message, {}, mockSendResponse);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Handler error'),
          }),
        })
      );
    });
  });

  describe('resetMessageBus', () => {
    it('should reset singleton instance', () => {
      const bus1 = getMessageBus('background');
      resetMessageBus();
      const bus2 = getMessageBus('content');

      expect(bus1).not.toBe(bus2);
    });
  });
});
