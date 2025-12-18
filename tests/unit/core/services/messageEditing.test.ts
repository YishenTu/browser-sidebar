/**
 * @file Message Editing Service Tests
 *
 * Tests for message editing logic including content priority rules and metadata builders.
 */

import { describe, it, expect } from 'vitest';
import {
  getEditableContent,
  prepareEditMetadata,
  buildMessageMetadata,
  prepareMessageContent,
  type EditingState,
} from '@core/services/messageEditing';
import type { ChatMessage } from '@store/chat';

// Helper to create a minimal ChatMessage
function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'default content',
    displayContent: undefined,
    timestamp: new Date(),
    metadata: {},
    ...overrides,
  } as ChatMessage;
}

describe('getEditableContent', () => {
  describe('role filtering', () => {
    it('should return empty string for assistant messages', () => {
      const message = createMessage({ role: 'assistant' });
      expect(getEditableContent(message)).toBe('');
    });

    it('should return empty string for system messages', () => {
      const message = createMessage({ role: 'system' as 'user' });
      expect(getEditableContent(message)).toBe('');
    });
  });

  describe('slash command handling', () => {
    it('should use displayContent for slash commands', () => {
      const message = createMessage({
        content: 'Expanded prompt text',
        displayContent: '/summarize',
        metadata: { usedSlashCommand: true },
      });

      expect(getEditableContent(message)).toBe('/summarize');
    });

    it('should fall back to content when displayContent is missing for slash commands', () => {
      const message = createMessage({
        content: 'Expanded prompt text',
        displayContent: undefined,
        metadata: { usedSlashCommand: true },
      });

      expect(getEditableContent(message)).toBe('Expanded prompt text');
    });
  });

  describe('tab context handling', () => {
    it('should use originalUserContent when present', () => {
      const message = createMessage({
        content: 'Content with tab context injected',
        displayContent: 'Content with tab context injected',
        metadata: { originalUserContent: 'Original user input' },
      });

      expect(getEditableContent(message)).toBe('Original user input');
    });
  });

  describe('default content priority', () => {
    it('should prefer displayContent over content', () => {
      const message = createMessage({
        content: 'Raw content',
        displayContent: 'Display content',
      });

      expect(getEditableContent(message)).toBe('Display content');
    });

    it('should fall back to content when displayContent is missing', () => {
      const message = createMessage({
        content: 'Raw content only',
        displayContent: undefined,
      });

      expect(getEditableContent(message)).toBe('Raw content only');
    });
  });
});

describe('prepareEditMetadata', () => {
  const createMessages = (): ChatMessage[] => [
    createMessage({ id: 'msg-1', role: 'user', content: 'First message' }),
    createMessage({ id: 'msg-2', role: 'assistant', content: 'Response' }),
    createMessage({ id: 'msg-3', role: 'user', content: 'Second message' }),
  ];

  describe('first message detection', () => {
    it('should detect first user message', () => {
      const messages = createMessages();
      const editingState: EditingState = { id: 'msg-1', content: 'First message' };

      const result = prepareEditMetadata(messages, editingState);

      expect(result.isFirstMessage).toBe(true);
    });

    it('should not mark non-first user message as first', () => {
      const messages = createMessages();
      const editingState: EditingState = { id: 'msg-3', content: 'Second message' };

      const result = prepareEditMetadata(messages, editingState);

      expect(result.isFirstMessage).toBe(false);
    });
  });

  describe('metadata preservation', () => {
    it('should preserve original message metadata', () => {
      const messages = [
        createMessage({
          id: 'msg-1',
          metadata: { customKey: 'customValue', attachments: ['file1.png'] },
        }),
      ];
      const editingState: EditingState = { id: 'msg-1', content: 'content' };

      const result = prepareEditMetadata(messages, editingState);

      expect(result.metadata).toEqual({ customKey: 'customValue', attachments: ['file1.png'] });
    });

    it('should return empty metadata for message without metadata', () => {
      const messages = [createMessage({ id: 'msg-1', metadata: undefined })];
      const editingState: EditingState = { id: 'msg-1', content: 'content' };

      const result = prepareEditMetadata(messages, editingState);

      expect(result.metadata).toEqual({});
    });
  });

  describe('missing message handling', () => {
    it('should return defaults when message not found', () => {
      const messages = createMessages();
      const editingState: EditingState = { id: 'non-existent', content: 'content' };

      const result = prepareEditMetadata(messages, editingState);

      expect(result.isFirstMessage).toBe(false);
      expect(result.metadata).toEqual({});
    });
  });
});

describe('buildMessageMetadata', () => {
  describe('editing mode', () => {
    it('should return edited message metadata when wasEditing is true', () => {
      const editedMetadata = { preserved: 'value', attachments: ['file.png'] };

      const result = buildMessageMetadata(true, editedMetadata, {
        expandedPrompt: 'ignored',
        attachments: [{ type: 'image', data: 'data' }],
      });

      expect(result).toEqual(editedMetadata);
    });
  });

  describe('new message mode', () => {
    it('should set usedSlashCommand flag when expandedPrompt exists', () => {
      const result = buildMessageMetadata(
        false,
        {},
        {
          expandedPrompt: 'Expanded text',
        }
      );

      expect(result['usedSlashCommand']).toBe(true);
    });

    it('should set usedSlashCommand to false when no expandedPrompt', () => {
      const result = buildMessageMetadata(false, {}, {});

      expect(result['usedSlashCommand']).toBe(false);
    });

    it('should include attachments when provided', () => {
      const attachments = [{ type: 'image', data: 'base64data', mimeType: 'image/png' }];
      const result = buildMessageMetadata(false, {}, { attachments });

      expect(result['attachments']).toEqual(attachments);
    });

    it('should not include attachments key when not provided', () => {
      const result = buildMessageMetadata(false, {}, {});

      expect(result).not.toHaveProperty('attachments');
    });

    it('should include modelOverride when provided', () => {
      const result = buildMessageMetadata(false, {}, { modelOverride: 'gpt-4' });

      expect(result['modelOverride']).toBe('gpt-4');
    });

    it('should not include modelOverride key when not provided', () => {
      const result = buildMessageMetadata(false, {}, {});

      expect(result).not.toHaveProperty('modelOverride');
    });

    it('should spread all metadata fields from input', () => {
      const result = buildMessageMetadata(
        false,
        {},
        {
          expandedPrompt: 'prompt',
          attachments: [{ type: 'file', fileUri: 'uri', mimeType: 'text/plain' }],
          modelOverride: 'model',
        }
      );

      expect(result['usedSlashCommand']).toBe(true);
      expect(result['attachments']).toBeDefined();
      expect(result['modelOverride']).toBe('model');
      expect(result['expandedPrompt']).toBe('prompt');
    });
  });
});

describe('prepareMessageContent', () => {
  describe('slash command expansion', () => {
    it('should use expandedPrompt as messageContent when available', () => {
      const result = prepareMessageContent('/summarize', {
        expandedPrompt: 'Please summarize the following:',
      });

      expect(result.messageContent).toBe('Please summarize the following:');
    });

    it('should always use userInput as displayContent', () => {
      const result = prepareMessageContent('/summarize', {
        expandedPrompt: 'Please summarize the following:',
      });

      expect(result.displayContent).toBe('/summarize');
    });
  });

  describe('regular message handling', () => {
    it('should use userInput for both when no expandedPrompt', () => {
      const result = prepareMessageContent('Hello, world!', {});

      expect(result.messageContent).toBe('Hello, world!');
      expect(result.displayContent).toBe('Hello, world!');
    });

    it('should handle undefined metadata', () => {
      const result = prepareMessageContent('Hello', undefined);

      expect(result.messageContent).toBe('Hello');
      expect(result.displayContent).toBe('Hello');
    });
  });
});
