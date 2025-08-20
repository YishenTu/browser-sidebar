/**
 * @file Message Handler Tests
 *
 * Comprehensive tests for the background service worker message handling system.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  MessageHandlerRegistry,
  DefaultHandlers,
  createDefaultMessageHandler,
  type MessageHandler,
} from '../../src/background/messageHandler.js';
import { createMessage } from '../../src/types/messages.js';
import { type ErrorPayload, type ToggleSidebarPayload } from '../../src/types/messages.js';

// Mock Chrome APIs
const mockSendResponse = vi.fn();
const mockSender: chrome.runtime.MessageSender = {
  tab: { id: 123, url: 'https://example.com' },
  id: 'test-extension-id',
};

describe('MessageHandlerRegistry', () => {
  let registry: MessageHandlerRegistry;

  beforeEach(() => {
    registry = new MessageHandlerRegistry();
    mockSendResponse.mockClear();
  });

  describe('Handler Registration', () => {
    it('should register a handler for a message type', () => {
      const handler: MessageHandler = vi.fn().mockResolvedValue('test response');

      registry.registerHandler('PING', handler, 'Test ping handler');

      expect(registry.hasHandler('PING')).toBe(true);
      expect(registry.getRegisteredTypes()).toContain('PING');
    });

    it('should unregister a handler', () => {
      const handler: MessageHandler = vi.fn();

      registry.registerHandler('PING', handler);
      expect(registry.hasHandler('PING')).toBe(true);

      const removed = registry.unregisterHandler('PING');
      expect(removed).toBe(true);
      expect(registry.hasHandler('PING')).toBe(false);
    });

    it('should return false when unregistering non-existent handler', () => {
      const removed = registry.unregisterHandler('PING');
      expect(removed).toBe(false);
    });

    it('should replace existing handler when registering same type', () => {
      const handler1: MessageHandler = vi.fn().mockResolvedValue('response1');
      const handler2: MessageHandler = vi.fn().mockResolvedValue('response2');

      registry.registerHandler('PING', handler1);
      registry.registerHandler('PING', handler2);

      expect(registry.getRegisteredTypes()).toEqual(['PING']);
    });
  });

  describe('Message Handling', () => {
    it('should handle valid messages with registered handlers', async () => {
      const handler: MessageHandler = vi.fn().mockResolvedValue('test response');
      registry.registerHandler('PING', handler);

      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith(message, mockSender);
      expect(mockSendResponse).toHaveBeenCalledWith('test response');
    });

    it('should handle synchronous handlers', async () => {
      const handler: MessageHandler = vi.fn().mockReturnValue('sync response');
      registry.registerHandler('PING', handler);

      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(true);
      expect(mockSendResponse).toHaveBeenCalledWith('sync response');
    });

    it('should handle asynchronous handlers', async () => {
      const handler: MessageHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async response';
      });
      registry.registerHandler('PING', handler);

      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(true);
      expect(mockSendResponse).toHaveBeenCalledWith('async response');
    });

    it('should return error for invalid message format', async () => {
      const invalidMessage = { invalid: 'message' };

      const result = await registry.handleMessage(invalidMessage, mockSender, mockSendResponse);

      expect(result).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR',
          payload: expect.objectContaining({
            message: 'Invalid message format',
            code: 'INVALID_MESSAGE',
          }),
        })
      );
    });

    it('should return error for unregistered message type', async () => {
      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR',
          payload: expect.objectContaining({
            message: 'No handler for message type: PING',
            code: 'NO_HANDLER',
          }),
        })
      );
    });

    it('should handle handler errors gracefully', async () => {
      const error = new Error('Handler failed');
      const handler: MessageHandler = vi.fn().mockRejectedValue(error);
      registry.registerHandler('PING', handler);

      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR',
          payload: expect.objectContaining({
            message: 'Handler failed',
            code: 'HANDLER_ERROR',
            details: expect.objectContaining({
              originalMessage: message,
              error: 'Error: Handler failed',
            }),
          }),
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      const handler: MessageHandler = vi.fn().mockImplementation(() => {
        throw 'String error';
      });
      registry.registerHandler('PING', handler);

      const message = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const result = await registry.handleMessage(message, mockSender, mockSendResponse);

      expect(result).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR',
          payload: expect.objectContaining({
            message: 'String error',
            code: 'HANDLER_ERROR',
          }),
        })
      );
    });
  });

  describe('Registry Information', () => {
    it('should return empty array for no registered handlers', () => {
      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    it('should return all registered message types', () => {
      registry.registerHandler('PING', vi.fn());
      registry.registerHandler('TOGGLE_SIDEBAR', vi.fn());
      registry.registerHandler('CLOSE_SIDEBAR', vi.fn());

      const types = registry.getRegisteredTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('PING');
      expect(types).toContain('TOGGLE_SIDEBAR');
      expect(types).toContain('CLOSE_SIDEBAR');
    });

    it('should check handler existence correctly', () => {
      expect(registry.hasHandler('PING')).toBe(false);

      registry.registerHandler('PING', vi.fn());
      expect(registry.hasHandler('PING')).toBe(true);
    });
  });
});

describe('DefaultHandlers', () => {
  beforeEach(() => {
    mockSendResponse.mockClear();
  });

  describe('handlePing', () => {
    it('should respond to PING with PONG', async () => {
      const pingMessage = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      const response = await DefaultHandlers.handlePing(pingMessage, mockSender);

      expect(response).toEqual(
        expect.objectContaining({
          type: 'PONG',
          source: 'background',
          target: 'content',
        })
      );
    });

    it('should log ping source information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const pingMessage = createMessage({
        type: 'PING',
        source: 'content',
        target: 'background',
      });

      await DefaultHandlers.handlePing(pingMessage, mockSender);

      expect(consoleSpy).toHaveBeenCalledWith('PING received from:', mockSender.tab?.id);

      consoleSpy.mockRestore();
    });

    it('should handle ping from extension (no tab)', async () => {
      const extensionSender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
      };

      const pingMessage = createMessage({
        type: 'PING',
        source: 'sidebar',
        target: 'background',
      });

      const response = await DefaultHandlers.handlePing(pingMessage, extensionSender);

      expect(response.type).toBe('PONG');
      expect(response.target).toBe('sidebar');
    });
  });

  describe('handleError', () => {
    it('should log error messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorMessage = createMessage<ErrorPayload>({
        type: 'ERROR',
        payload: {
          message: 'Test error',
          code: 'TEST_ERROR',
        },
        source: 'content',
        target: 'background',
      });

      await DefaultHandlers.handleError(errorMessage, mockSender);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error message received:',
        errorMessage.payload,
        'from:',
        mockSender
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('createDefaultMessageHandler', () => {
  it('should create a registry with default handlers', () => {
    const registry = createDefaultMessageHandler();

    expect(registry.hasHandler('PING')).toBe(true);
    expect(registry.hasHandler('ERROR')).toBe(true);

    const registeredTypes = registry.getRegisteredTypes();
    expect(registeredTypes).toContain('PING');
    expect(registeredTypes).toContain('ERROR');
  });

  it('should handle PING messages correctly', async () => {
    const registry = createDefaultMessageHandler();

    const pingMessage = createMessage({
      type: 'PING',
      source: 'content',
      target: 'background',
    });

    const result = await registry.handleMessage(pingMessage, mockSender, mockSendResponse);

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PONG',
        source: 'background',
        target: 'content',
      })
    );
  });

  it('should handle ERROR messages correctly', async () => {
    const registry = createDefaultMessageHandler();

    const errorMessage = createMessage<ErrorPayload>({
      type: 'ERROR',
      payload: {
        message: 'Test error',
        code: 'TEST_ERROR',
      },
      source: 'content',
      target: 'background',
    });

    const result = await registry.handleMessage(errorMessage, mockSender, mockSendResponse);

    expect(result).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledWith(undefined);
  });
});

describe('Integration Tests', () => {
  let registry: MessageHandlerRegistry;

  beforeEach(() => {
    registry = createDefaultMessageHandler();
  });

  it('should handle multiple message types in sequence', async () => {
    // Register a custom handler
    const customHandler: MessageHandler<ToggleSidebarPayload, string> = vi
      .fn()
      .mockResolvedValue('sidebar toggled');
    registry.registerHandler('TOGGLE_SIDEBAR', customHandler);

    // Test PING
    const pingMessage = createMessage({
      type: 'PING',
      source: 'content',
      target: 'background',
    });

    await registry.handleMessage(pingMessage, mockSender, mockSendResponse);
    expect(mockSendResponse).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'PONG' }));

    mockSendResponse.mockClear();

    // Test TOGGLE_SIDEBAR
    const toggleMessage = createMessage<ToggleSidebarPayload>({
      type: 'TOGGLE_SIDEBAR',
      payload: { show: true },
      source: 'background',
      target: 'content',
    });

    await registry.handleMessage(toggleMessage, mockSender, mockSendResponse);
    expect(customHandler).toHaveBeenCalledWith(toggleMessage, mockSender);
    expect(mockSendResponse).toHaveBeenLastCalledWith('sidebar toggled');
  });

  it('should maintain handler isolation', async () => {
    const handler1 = vi.fn().mockResolvedValue('response1');
    const handler2 = vi.fn().mockResolvedValue('response2');

    registry.registerHandler('EXTRACT_CONTENT', handler1);
    registry.registerHandler('SEND_TO_AI', handler2);

    const message1 = createMessage({
      type: 'EXTRACT_CONTENT',
      source: 'sidebar',
      target: 'background',
    });

    const message2 = createMessage({
      type: 'SEND_TO_AI',
      source: 'sidebar',
      target: 'background',
    });

    await registry.handleMessage(message1, mockSender, mockSendResponse);
    expect(handler1).toHaveBeenCalledWith(message1, mockSender);
    expect(handler2).not.toHaveBeenCalled();

    await registry.handleMessage(message2, mockSender, mockSendResponse);
    expect(handler2).toHaveBeenCalledWith(message2, mockSender);
    expect(handler1).toHaveBeenCalledTimes(1);
  });

  it('should handle concurrent messages safely', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const slowHandler: MessageHandler = vi.fn().mockImplementation(async () => {
      await delay(50);
      return 'slow response';
    });

    const fastHandler: MessageHandler = vi.fn().mockImplementation(async () => {
      await delay(10);
      return 'fast response';
    });

    registry.registerHandler('EXTRACT_CONTENT', slowHandler);
    registry.registerHandler('SEND_TO_AI', fastHandler);

    const slowMessage = createMessage({
      type: 'EXTRACT_CONTENT',
      source: 'sidebar',
      target: 'background',
    });

    const fastMessage = createMessage({
      type: 'SEND_TO_AI',
      source: 'sidebar',
      target: 'background',
    });

    const mockSendResponse1 = vi.fn();
    const mockSendResponse2 = vi.fn();

    // Start both handlers concurrently
    const promise1 = registry.handleMessage(slowMessage, mockSender, mockSendResponse1);
    const promise2 = registry.handleMessage(fastMessage, mockSender, mockSendResponse2);

    await Promise.all([promise1, promise2]);

    expect(slowHandler).toHaveBeenCalledWith(slowMessage, mockSender);
    expect(fastHandler).toHaveBeenCalledWith(fastMessage, mockSender);
    expect(mockSendResponse1).toHaveBeenCalledWith('slow response');
    expect(mockSendResponse2).toHaveBeenCalledWith('fast response');
  });
});
