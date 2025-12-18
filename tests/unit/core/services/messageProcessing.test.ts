/**
 * @file Message Processing Service Tests
 *
 * Tests for message format conversion and processing utilities.
 */

import { describe, it, expect } from 'vitest';
import { convertToProviderMessages, type BaseMessage } from '@core/services/messageProcessing';

// Helper to create a BaseMessage
function createBaseMessage(overrides: Partial<BaseMessage> = {}): BaseMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Test content',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('convertToProviderMessages', () => {
  describe('first message case', () => {
    it('should use userMessage directly when only one user message exists', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Hello' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({
        id: 'asst-1',
        role: 'assistant',
        content: '',
      });
      const userMessage = createBaseMessage({
        id: 'user-1',
        role: 'user',
        content: 'Hello',
      });

      const result = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('user-1');
      expect(result[0]!.content).toBe('Hello');
      expect(result[0]!.role).toBe('user');
    });

    it('should handle first message with object content', () => {
      const currentMessages = [
        createBaseMessage({
          id: 'user-1',
          role: 'user',
          content: { text: 'Object content' },
        }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-1', role: 'assistant' });
      const userMessage = createBaseMessage({
        id: 'user-1',
        role: 'user',
        content: { text: 'Object content' },
      });

      const result = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      expect(result[0]!.content).toBe('Object content');
    });
  });

  describe('follow-up messages case', () => {
    it('should include all non-empty messages except current assistant', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'First question' }),
        createBaseMessage({
          id: 'asst-1',
          role: 'assistant',
          content: 'First answer',
        }),
        createBaseMessage({ id: 'user-2', role: 'user', content: 'Second question' }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result).toHaveLength(3);
      expect(result.map(m => m.id)).toEqual(['user-1', 'asst-1', 'user-2']);
    });

    it('should exclude empty messages', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Hello' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: '' }),
        createBaseMessage({ id: 'user-2', role: 'user', content: '  ' }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      // Only user-1 has non-empty content
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('user-1');
    });
  });

  describe('timestamp normalization', () => {
    it('should convert Date timestamp to Date', () => {
      const date = new Date('2024-06-15T10:30:00Z');
      const currentMessages = [createBaseMessage({ id: 'user-1', role: 'user', timestamp: date })];
      const assistantMessage = createBaseMessage({ id: 'asst-1', role: 'assistant' });
      const userMessage = createBaseMessage({ id: 'user-1', timestamp: date });

      const result = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      expect(result[0]!.timestamp).toBeInstanceOf(Date);
      expect(result[0]!.timestamp.getTime()).toBe(date.getTime());
    });

    it('should convert numeric timestamp to Date', () => {
      const timestamp = 1718447400000; // 2024-06-15T10:30:00Z
      const currentMessages = [createBaseMessage({ id: 'user-1', role: 'user', timestamp })];
      const assistantMessage = createBaseMessage({ id: 'asst-1', role: 'assistant' });
      const userMessage = createBaseMessage({ id: 'user-1', timestamp });

      const result = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      expect(result[0]!.timestamp).toBeInstanceOf(Date);
      expect(result[0]!.timestamp.getTime()).toBe(timestamp);
    });
  });

  describe('content extraction', () => {
    it('should extract string content directly', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'String content' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: 'Response' }),
        createBaseMessage({ id: 'user-2', role: 'user', content: 'Follow up' }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result[0]!.content).toBe('String content');
    });

    it('should extract text from object content', () => {
      const currentMessages = [
        createBaseMessage({
          id: 'user-1',
          role: 'user',
          content: { text: 'Object text', extra: 'ignored' },
        }),
        createBaseMessage({
          id: 'asst-1',
          role: 'assistant',
          content: { text: 'Response text' },
        }),
        createBaseMessage({ id: 'user-2', role: 'user', content: 'Second' }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result[0]!.content).toBe('Object text');
      expect(result[1]!.content).toBe('Response text');
    });

    it('should filter out messages with object content without text property', () => {
      // When content is an object without .text property, getContent returns ''
      // Messages with empty content are filtered out
      const contentWithNoText = { notText: 'value' } as unknown as string;
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'First message' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: 'Response' }),
        createBaseMessage({
          id: 'user-2',
          role: 'user',
          content: contentWithNoText,
        }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      // Follow-up case: filters out empty content
      const result = convertToProviderMessages(currentMessages, assistantMessage);

      // user-2 with object content { notText } is filtered because getContent returns ''
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['user-1', 'asst-1']);
    });
  });

  describe('message filtering', () => {
    it('should exclude the empty assistant message being created', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Question 1' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: 'Answer 1' }),
        createBaseMessage({ id: 'user-2', role: 'user', content: 'Question 2' }),
        createBaseMessage({ id: 'new-asst', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({
        id: 'new-asst',
        role: 'assistant',
        content: '',
      });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result.map(m => m.id)).not.toContain('new-asst');
    });

    it('should handle multiple empty user messages', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Valid' }),
        createBaseMessage({ id: 'user-2', role: 'user', content: '' }),
        createBaseMessage({ id: 'user-3', role: 'user', content: '   ' }),
        createBaseMessage({ id: 'user-4', role: 'user', content: 'Also valid' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-1', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result.map(m => m.id)).toEqual(['user-1', 'user-4']);
    });
  });

  describe('role mapping', () => {
    it('should preserve user role', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Hello' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-1', role: 'assistant' });
      const userMessage = createBaseMessage({ id: 'user-1', role: 'user' });

      const result = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      expect(result[0]!.role).toBe('user');
    });

    it('should preserve assistant role', () => {
      const currentMessages = [
        createBaseMessage({ id: 'user-1', role: 'user', content: 'Question' }),
        createBaseMessage({ id: 'asst-1', role: 'assistant', content: 'Answer' }),
        createBaseMessage({ id: 'user-2', role: 'user', content: 'Follow up' }),
        createBaseMessage({ id: 'asst-2', role: 'assistant', content: '' }),
      ];
      const assistantMessage = createBaseMessage({ id: 'asst-2', role: 'assistant' });

      const result = convertToProviderMessages(currentMessages, assistantMessage);

      expect(result[1]!.role).toBe('assistant');
    });
  });
});
