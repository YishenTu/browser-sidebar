/**
 * @file Tests for Message Types and Protocol
 *
 * Comprehensive tests for the message passing system including
 * message creation, validation, and type guards.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMessage,
  isValidMessage,
  isMessageOfType,
  MessageType,
  MessageSource,
  ToggleSidebarPayload,
  ExtractContentPayload,
  ContentExtractedPayload,
  SendToAIPayload,
  AIResponsePayload,
  ErrorPayload,
} from '../../src/types/messages';
import {
  MessageValidator,
  validateMessage,
  isValidMessageOfType,
} from '../../src/utils/messageValidation';

describe('Message Creation', () => {
  beforeEach(() => {
    // Mock Date.now for consistent timestamps in tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create message with unique ID', () => {
    const message1 = createMessage({
      type: 'PING',
      source: 'background',
      target: 'content',
    });

    const message2 = createMessage({
      type: 'PING',
      source: 'background',
      target: 'content',
    });

    expect(message1.id).not.toBe(message2.id);
    expect(message1.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    expect(message2.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
  });

  it('should create message with correct timestamp', () => {
    const beforeTime = Date.now();
    const message = createMessage({
      type: 'PING',
      source: 'background',
      target: 'content',
    });
    const afterTime = Date.now();

    expect(message.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(message.timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should create message with provided fields', () => {
    const payload = { show: true };
    const message = createMessage<ToggleSidebarPayload>({
      type: 'TOGGLE_SIDEBAR',
      payload,
      source: 'background',
      target: 'content',
    });

    expect(message.type).toBe('TOGGLE_SIDEBAR');
    expect(message.payload).toEqual(payload);
    expect(message.source).toBe('background');
    expect(message.target).toBe('content');
  });

  it('should create message without payload', () => {
    const message = createMessage({
      type: 'PING',
      source: 'background',
      target: 'content',
    });

    expect(message.payload).toBeUndefined();
  });
});

describe('Message Validation', () => {
  describe('isValidMessage', () => {
    it('should validate correct message structure', () => {
      const message = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      expect(isValidMessage(message)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidMessage('string')).toBe(false);
      expect(isValidMessage(123)).toBe(false);
      expect(isValidMessage(true)).toBe(false);
    });

    it('should reject message with missing required fields', () => {
      expect(isValidMessage({})).toBe(false);
      expect(isValidMessage({ id: 'test' })).toBe(false);
      expect(isValidMessage({ id: 'test', type: 'PING' })).toBe(false);
    });

    it('should reject message with invalid field types', () => {
      expect(
        isValidMessage({
          id: 123, // should be string
          type: 'PING',
          timestamp: Date.now(),
          source: 'background',
          target: 'content',
        })
      ).toBe(false);

      expect(
        isValidMessage({
          id: 'test',
          type: 123, // should be string
          timestamp: Date.now(),
          source: 'background',
          target: 'content',
        })
      ).toBe(false);
    });

    it('should reject message with invalid message type', () => {
      expect(
        isValidMessage({
          id: 'test',
          type: 'INVALID_TYPE',
          timestamp: Date.now(),
          source: 'background',
          target: 'content',
        })
      ).toBe(false);
    });

    it('should reject message with invalid source/target', () => {
      expect(
        isValidMessage({
          id: 'test',
          type: 'PING',
          timestamp: Date.now(),
          source: 'invalid',
          target: 'content',
        })
      ).toBe(false);

      expect(
        isValidMessage({
          id: 'test',
          type: 'PING',
          timestamp: Date.now(),
          source: 'background',
          target: 'invalid',
        })
      ).toBe(false);
    });
  });

  describe('isMessageOfType', () => {
    it('should correctly identify message type', () => {
      const pingMessage = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      const toggleMessage = createMessage({
        type: 'TOGGLE_SIDEBAR',
        source: 'background',
        target: 'content',
      });

      expect(isMessageOfType(pingMessage, 'PING')).toBe(true);
      expect(isMessageOfType(pingMessage, 'TOGGLE_SIDEBAR')).toBe(false);
      expect(isMessageOfType(toggleMessage, 'TOGGLE_SIDEBAR')).toBe(true);
      expect(isMessageOfType(toggleMessage, 'PING')).toBe(false);
    });
  });
});

describe('MessageValidator', () => {
  describe('validate', () => {
    it('should validate correct message', () => {
      const message = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      const result = MessageValidator.validate(message);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid message structure', () => {
      const result = MessageValidator.validate({ invalid: 'message' });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message structure');
    });

    it('should reject invalid message ID format', () => {
      const message = {
        id: 'invalid-id',
        type: 'PING' as MessageType,
        timestamp: Date.now(),
        source: 'background' as MessageSource,
        target: 'content' as MessageSource,
      };

      const result = MessageValidator.validate(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message ID format');
    });

    it('should reject invalid timestamp', () => {
      const message = {
        id: 'msg_1234567890_abc123',
        type: 'PING' as MessageType,
        timestamp: -1, // Invalid timestamp
        source: 'background' as MessageSource,
        target: 'content' as MessageSource,
      };

      const result = MessageValidator.validate(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp');
    });
  });

  describe('validatePayload', () => {
    it('should validate TOGGLE_SIDEBAR payload', () => {
      // Valid payload
      let result = MessageValidator.validatePayload('TOGGLE_SIDEBAR', { show: true });
      expect(result.isValid).toBe(true);

      // Valid undefined payload
      result = MessageValidator.validatePayload('TOGGLE_SIDEBAR', undefined);
      expect(result.isValid).toBe(true);

      // Invalid payload type
      result = MessageValidator.validatePayload('TOGGLE_SIDEBAR', 'invalid');
      expect(result.isValid).toBe(false);

      // Invalid show property type
      result = MessageValidator.validatePayload('TOGGLE_SIDEBAR', { show: 'true' });
      expect(result.isValid).toBe(false);
    });

    it('should validate EXTRACT_CONTENT payload', () => {
      // Valid payload
      let result = MessageValidator.validatePayload('EXTRACT_CONTENT', {
        selectors: ['.content', '#main'],
        includeImages: true,
      });
      expect(result.isValid).toBe(true);

      // Valid undefined payload
      result = MessageValidator.validatePayload('EXTRACT_CONTENT', undefined);
      expect(result.isValid).toBe(true);

      // Invalid selectors type
      result = MessageValidator.validatePayload('EXTRACT_CONTENT', {
        selectors: 'invalid',
      });
      expect(result.isValid).toBe(false);

      // Invalid selectors array content
      result = MessageValidator.validatePayload('EXTRACT_CONTENT', {
        selectors: [123, 456],
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate CONTENT_EXTRACTED payload', () => {
      const validPayload: ContentExtractedPayload = {
        text: 'Extracted content',
        title: 'Page Title',
        url: 'https://example.com',
        images: ['image1.jpg', 'image2.png'],
      };

      // Valid payload
      let result = MessageValidator.validatePayload('CONTENT_EXTRACTED', validPayload);
      expect(result.isValid).toBe(true);

      // Missing required field
      result = MessageValidator.validatePayload('CONTENT_EXTRACTED', {
        title: 'Page Title',
        url: 'https://example.com',
      });
      expect(result.isValid).toBe(false);

      // Invalid images array
      result = MessageValidator.validatePayload('CONTENT_EXTRACTED', {
        text: 'Content',
        title: 'Title',
        url: 'https://example.com',
        images: [123, 456],
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate SEND_TO_AI payload', () => {
      const validPayload: SendToAIPayload = {
        message: 'Hello AI',
        context: 'Page context',
      };

      // Valid payload
      let result = MessageValidator.validatePayload('SEND_TO_AI', validPayload);
      expect(result.isValid).toBe(true);

      // Missing required field
      result = MessageValidator.validatePayload('SEND_TO_AI', {
        context: 'Page context',
      });
      expect(result.isValid).toBe(false);

      // Empty message
      result = MessageValidator.validatePayload('SEND_TO_AI', {
        message: '   ',
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate AI_RESPONSE payload', () => {
      const validPayload: AIResponsePayload = {
        response: 'AI response',
        isStreaming: true,
        isFinal: false,
      };

      // Valid payload
      let result = MessageValidator.validatePayload('AI_RESPONSE', validPayload);
      expect(result.isValid).toBe(true);

      // Missing required field
      result = MessageValidator.validatePayload('AI_RESPONSE', {
        isStreaming: true,
      });
      expect(result.isValid).toBe(false);

      // Invalid boolean types
      result = MessageValidator.validatePayload('AI_RESPONSE', {
        response: 'AI response',
        isStreaming: 'true',
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate ERROR payload', () => {
      const validPayload: ErrorPayload = {
        message: 'Error occurred',
        code: 'ERR_001',
      };

      // Valid payload
      let result = MessageValidator.validatePayload('ERROR', validPayload);
      expect(result.isValid).toBe(true);

      // Missing required field
      result = MessageValidator.validatePayload('ERROR', {
        code: 'ERR_001',
      });
      expect(result.isValid).toBe(false);

      // Empty message
      result = MessageValidator.validatePayload('ERROR', {
        message: '',
      });
      expect(result.isValid).toBe(false);
    });

    it('should validate messages with no payload', () => {
      const noPayloadTypes: MessageType[] = ['CLOSE_SIDEBAR', 'PING', 'PONG'];

      noPayloadTypes.forEach(type => {
        // Valid undefined payload
        let result = MessageValidator.validatePayload(type, undefined);
        expect(result.isValid).toBe(true);

        // Invalid non-undefined payload
        result = MessageValidator.validatePayload(type, { data: 'invalid' });
        expect(result.isValid).toBe(false);
      });
    });
  });
});

describe('Utility Functions', () => {
  describe('validateMessage', () => {
    it('should be an alias for MessageValidator.validate', () => {
      const message = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      const result1 = validateMessage(message);
      const result2 = MessageValidator.validate(message);

      expect(result1).toEqual(result2);
    });
  });

  describe('isValidMessageOfType', () => {
    it('should validate message and check type', () => {
      const pingMessage = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      expect(isValidMessageOfType(pingMessage, 'PING')).toBe(true);
      expect(isValidMessageOfType(pingMessage, 'PONG')).toBe(false);
      expect(isValidMessageOfType({ invalid: 'message' }, 'PING')).toBe(false);
    });
  });
});

describe('Type Safety', () => {
  it('should maintain type safety with createMessage', () => {
    const toggleMessage = createMessage<ToggleSidebarPayload>({
      type: 'TOGGLE_SIDEBAR',
      payload: { show: true },
      source: 'background',
      target: 'content',
    });

    // TypeScript should infer the correct type
    expect(toggleMessage.payload?.show).toBe(true);
  });

  it('should work with specific message types', () => {
    const extractMessage = createMessage<ExtractContentPayload>({
      type: 'EXTRACT_CONTENT',
      payload: {
        selectors: ['.content'],
        includeImages: true,
      },
      source: 'content',
      target: 'background',
    });

    expect(extractMessage.payload?.selectors).toEqual(['.content']);
    expect(extractMessage.payload?.includeImages).toBe(true);
  });
});
