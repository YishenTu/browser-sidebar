/**
 * Simplified integration tests for message roundtrip
 * Tests the core message flow without complex mocking
 */

import { describe, it, expect } from 'vitest';
import { createMessage, isValidMessage } from '@/types/messages';
import { MessageValidator } from '@/utils/messageValidation';

describe('Message Protocol Integration', () => {
  describe('Message Creation and Validation', () => {
    it('should create valid TOGGLE_SIDEBAR messages', () => {
      const message = createMessage('TOGGLE_SIDEBAR', { tabId: 1 }, 'background');

      expect(message).toBeDefined();
      expect(message.type).toBe('TOGGLE_SIDEBAR');
      expect(message.payload).toEqual({ tabId: 1 });
      expect(message.source).toBe('background');
      expect(message.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it('should create valid CLOSE_SIDEBAR messages', () => {
      const message = createMessage('CLOSE_SIDEBAR', { tabId: 1 }, 'background');

      expect(message).toBeDefined();
      expect(message.type).toBe('CLOSE_SIDEBAR');
      expect(message.payload).toEqual({ tabId: 1 });
      expect(message.source).toBe('background');
    });

    it('should validate messages correctly', () => {
      const validMessage = createMessage('TOGGLE_SIDEBAR', { tabId: 1 }, 'background');
      const validation = MessageValidator.validate(validMessage);

      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should detect invalid messages', () => {
      const invalidMessage = { type: 'INVALID', payload: {} };
      const validation = MessageValidator.validate(invalidMessage);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('Message Type Guards', () => {
    it('should correctly identify valid messages', () => {
      const message = createMessage('PING', {}, 'content');
      expect(isValidMessage(message)).toBe(true);
    });

    it('should reject invalid message structures', () => {
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage(undefined)).toBe(false);
      expect(isValidMessage({})).toBe(false);
      expect(isValidMessage({ type: 'TEST' })).toBe(false);
      expect(
        isValidMessage({
          type: 'TEST',
          payload: {},
          // Missing required fields
        })
      ).toBe(false);
    });
  });

  describe('PING/PONG Message Flow', () => {
    it('should create matching PING/PONG pairs', () => {
      const ping = createMessage('PING', {}, 'content');
      const pong = createMessage(
        'PONG',
        {
          originalId: ping.id,
          source: 'background',
        },
        'background'
      );

      expect(pong.type).toBe('PONG');
      expect(pong.payload.originalId).toBe(ping.id);
      expect(pong.payload.source).toBe('background');
    });
  });

  describe('Content Extraction Messages', () => {
    it('should create EXTRACT_CONTENT request', () => {
      const message = createMessage(
        'EXTRACT_CONTENT',
        {
          selector: 'body',
          options: { includeImages: false },
        },
        'sidebar'
      );

      expect(message.type).toBe('EXTRACT_CONTENT');
      expect(message.source).toBe('sidebar');
      expect(message.payload.selector).toBe('body');
    });

    it('should create CONTENT_EXTRACTED response', () => {
      const message = createMessage(
        'CONTENT_EXTRACTED',
        {
          content: 'Page content here',
          url: 'https://example.com',
          title: 'Example Page',
        },
        'content'
      );

      expect(message.type).toBe('CONTENT_EXTRACTED');
      expect(message.source).toBe('content');
      expect(message.payload.content).toBe('Page content here');
    });
  });

  describe('Error Messages', () => {
    it('should create ERROR messages with proper structure', () => {
      const message = createMessage(
        'ERROR',
        {
          error: 'Something went wrong',
          code: 'GENERIC_ERROR',
          details: { context: 'test' },
        },
        'background'
      );

      expect(message.type).toBe('ERROR');
      expect(message.payload.error).toBe('Something went wrong');
      expect(message.payload.code).toBe('GENERIC_ERROR');
      expect(message.payload.details).toEqual({ context: 'test' });
    });
  });

  describe('Message Source and Target', () => {
    it('should set correct sources for different components', () => {
      const backgroundMsg = createMessage('PING', {}, 'background');
      const contentMsg = createMessage('PING', {}, 'content');
      const sidebarMsg = createMessage('PING', {}, 'sidebar');

      expect(backgroundMsg.source).toBe('background');
      expect(contentMsg.source).toBe('content');
      expect(sidebarMsg.source).toBe('sidebar');
    });

    it('should allow setting optional target', () => {
      const message = createMessage(
        'SEND_TO_AI',
        {
          content: 'test',
          query: 'test query',
        },
        'sidebar'
      );

      // Add target after creation
      message.target = 'background';

      expect(message.target).toBe('background');
    });
  });

  describe('Message ID Generation', () => {
    it('should generate unique IDs for each message', () => {
      const messages = Array.from({ length: 100 }, () => createMessage('PING', {}, 'background'));

      const ids = messages.map(m => m.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });

    it('should follow ID format pattern', () => {
      const message = createMessage('PING', {}, 'background');

      // ID format: msg_<timestamp>_<random>
      expect(message.id).toMatch(/^msg_\d{13}_[a-z0-9]{7}$/);
    });
  });

  describe('Timestamp Generation', () => {
    it('should include accurate timestamps', () => {
      const before = Date.now();
      const message = createMessage('PING', {}, 'background');
      const after = Date.now();

      expect(message.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
