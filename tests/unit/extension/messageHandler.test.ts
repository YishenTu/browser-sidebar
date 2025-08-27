/**
 * @file Message Handler Tests
 *
 * Unit tests for the background message handler system,
 * particularly focusing on the GET_TAB_ID functionality.
 */

import { describe, test, expect, vi } from 'vitest';
import { MessageHandlerRegistry, DefaultHandlers } from '@/extension/background/messageHandler';
import { createMessage } from '@/types/messages';

describe('MessageHandlerRegistry', () => {
  test('should register and retrieve handlers correctly', () => {
    const registry = new MessageHandlerRegistry();
    const mockHandler = vi.fn().mockResolvedValue('test response');
    
    registry.registerHandler('PING', mockHandler, 'Test handler');
    
    expect(registry.hasHandler('PING')).toBe(true);
    expect(registry.hasHandler('INVALID_TYPE' as any)).toBe(false);
    expect(registry.getRegisteredTypes()).toContain('PING');
  });

  test('should unregister handlers correctly', () => {
    const registry = new MessageHandlerRegistry();
    const mockHandler = vi.fn();
    
    registry.registerHandler('PING', mockHandler);
    expect(registry.hasHandler('PING')).toBe(true);
    
    const result = registry.unregisterHandler('PING');
    expect(result).toBe(true);
    expect(registry.hasHandler('PING')).toBe(false);
  });
});

describe('DefaultHandlers', () => {
  test('should handle PING messages correctly', async () => {
    const message = createMessage({
      type: 'PING',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      tab: { id: 123 },
      id: 'test-extension-id',
    };

    const response = await DefaultHandlers.handlePing(message, sender);
    
    expect(response.type).toBe('PONG');
    expect(response.source).toBe('background');
    expect(response.target).toBe('content');
  });

  test('should handle GET_TAB_ID messages correctly', async () => {
    const message = createMessage({
      type: 'GET_TAB_ID',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      tab: { id: 456 },
      id: 'test-extension-id',
    };

    const response = await DefaultHandlers.handleGetTabId(message, sender);
    
    expect(response.type).toBe('GET_TAB_ID');
    expect(response.source).toBe('background');
    expect(response.target).toBe('content');
    expect(response.payload?.tabId).toBe(456);
  });

  test('should throw error when sender has no tab ID', async () => {
    const message = createMessage({
      type: 'GET_TAB_ID',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      id: 'test-extension-id',
      // No tab property
    };

    await expect(
      DefaultHandlers.handleGetTabId(message, sender)
    ).rejects.toThrow('Unable to determine tab ID from sender');
  });

  test('should throw error when sender tab has no ID', async () => {
    const message = createMessage({
      type: 'GET_TAB_ID',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      tab: {
        // Missing id property
      },
      id: 'test-extension-id',
    };

    await expect(
      DefaultHandlers.handleGetTabId(message, sender)
    ).rejects.toThrow('Unable to determine tab ID from sender');
  });
});

describe('Message Handler Integration', () => {
  test('should handle GET_TAB_ID through the registry', async () => {
    const registry = new MessageHandlerRegistry();
    registry.registerHandler('GET_TAB_ID', DefaultHandlers.handleGetTabId);

    const message = createMessage({
      type: 'GET_TAB_ID',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      tab: { id: 789 },
      id: 'test-extension-id',
    };

    let responseReceived: any = null;
    const mockSendResponse = vi.fn((response: any) => {
      responseReceived = response;
    });

    const handled = await registry.handleMessage(message, sender, mockSendResponse);

    expect(handled).toBe(true);
    expect(mockSendResponse).toHaveBeenCalledOnce();
    expect(responseReceived.type).toBe('GET_TAB_ID');
    expect(responseReceived.payload.tabId).toBe(789);
  });

  test('should handle invalid messages gracefully', async () => {
    const registry = new MessageHandlerRegistry();
    
    const invalidMessage = {
      // Missing required fields
      type: 'GET_TAB_ID',
    };

    const sender: chrome.runtime.MessageSender = {
      tab: { id: 123 },
      id: 'test-extension-id',
    };

    let responseReceived: any = null;
    const mockSendResponse = vi.fn((response: any) => {
      responseReceived = response;
    });

    const handled = await registry.handleMessage(invalidMessage, sender, mockSendResponse);

    expect(handled).toBe(false);
    expect(mockSendResponse).toHaveBeenCalledOnce();
    expect(responseReceived.type).toBe('ERROR');
    expect(responseReceived.payload.code).toBe('INVALID_MESSAGE');
  });

  test('should handle unregistered message types gracefully', async () => {
    const registry = new MessageHandlerRegistry();
    // Register one handler but not GET_TAB_ID
    registry.registerHandler('PING', DefaultHandlers.handlePing);
    
    const unknownMessage = createMessage({
      type: 'GET_TAB_ID',
      source: 'content',
      target: 'background',
    });

    const sender: chrome.runtime.MessageSender = {
      tab: { id: 123 },
      id: 'test-extension-id',
    };

    let responseReceived: any = null;
    const mockSendResponse = vi.fn((response: any) => {
      responseReceived = response;
    });

    const handled = await registry.handleMessage(unknownMessage, sender, mockSendResponse);

    expect(handled).toBe(false);
    expect(mockSendResponse).toHaveBeenCalledOnce();
    expect(responseReceived.type).toBe('ERROR');
    expect(responseReceived.payload.code).toBe('NO_HANDLER');
  });
});