/**
 * @file Tests for Chat Types and Type Guards
 *
 * Comprehensive tests for the chat system including message types,
 * conversation structure, and runtime type validation.
 *
 * Following TDD methodology - these tests are written first to define
 * the expected behavior of the chat type system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import types and type guards (to be implemented)
import {
  ChatMessage,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  MessageRole,
  MessageStatus,
  MessageContent,
  CodeBlock,
  Conversation,
  StreamingContent,

  // Type guards
  isChatMessage,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  isValidMessageRole,
  isValidMessageStatus,
  isCodeBlock,
  isStreamingContent,
  isConversation,

  // Helper functions
  createChatMessage,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createConversation,
} from '../../src/types/chat';

describe('Chat Message Type Guards', () => {
  beforeEach(() => {
    // Mock Date.now for consistent timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isChatMessage', () => {
    it('should validate correct chat message structure', () => {
      const message: ChatMessage = {
        id: 'msg_123',
        role: 'user',
        content: 'Hello world',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isChatMessage(message)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isChatMessage(null)).toBe(false);
      expect(isChatMessage(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isChatMessage('string')).toBe(false);
      expect(isChatMessage(123)).toBe(false);
      expect(isChatMessage(true)).toBe(false);
      expect(isChatMessage([])).toBe(false);
    });

    it('should reject message with missing required fields', () => {
      expect(isChatMessage({})).toBe(false);
      expect(isChatMessage({ id: 'msg_123' })).toBe(false);
      expect(isChatMessage({ id: 'msg_123', role: 'user' })).toBe(false);
      expect(
        isChatMessage({
          id: 'msg_123',
          role: 'user',
          content: 'Hello',
        })
      ).toBe(false);
    });

    it('should reject message with invalid field types', () => {
      expect(
        isChatMessage({
          id: 123, // should be string
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
          status: 'sent',
        })
      ).toBe(false);

      expect(
        isChatMessage({
          id: 'msg_123',
          role: 'invalid_role', // should be valid MessageRole
          content: 'Hello',
          timestamp: Date.now(),
          status: 'sent',
        })
      ).toBe(false);

      expect(
        isChatMessage({
          id: 'msg_123',
          role: 'user',
          content: 123, // should be string or MessageContent
          timestamp: Date.now(),
          status: 'sent',
        })
      ).toBe(false);
    });

    it('should validate message with complex content structure', () => {
      const messageWithCodeBlock: ChatMessage = {
        id: 'msg_123',
        role: 'assistant',
        content: {
          text: 'Here is some code:',
          codeBlocks: [
            {
              language: 'typescript',
              code: 'const x = 42;',
              filename: 'example.ts',
            },
          ],
        },
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isChatMessage(messageWithCodeBlock)).toBe(true);
    });

    it('should validate message with streaming content', () => {
      const streamingMessage: ChatMessage = {
        id: 'msg_123',
        role: 'assistant',
        content: {
          text: 'Partial response...',
          isStreaming: true,
          streamingId: 'stream_456',
        },
        timestamp: Date.now(),
        status: 'streaming',
      };

      expect(isChatMessage(streamingMessage)).toBe(true);
    });
  });

  describe('isUserMessage', () => {
    it('should validate user message', () => {
      const userMessage: UserMessage = {
        id: 'msg_123',
        role: 'user',
        content: 'Hello AI',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isUserMessage(userMessage)).toBe(true);
    });

    it('should reject non-user messages', () => {
      const assistantMessage: AssistantMessage = {
        id: 'msg_123',
        role: 'assistant',
        content: 'Hello human',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isUserMessage(assistantMessage)).toBe(false);
    });

    it('should reject invalid messages', () => {
      expect(isUserMessage(null)).toBe(false);
      expect(isUserMessage({ role: 'user' })).toBe(false);
    });
  });

  describe('isAssistantMessage', () => {
    it('should validate assistant message', () => {
      const assistantMessage: AssistantMessage = {
        id: 'msg_123',
        role: 'assistant',
        content: 'Hello human',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isAssistantMessage(assistantMessage)).toBe(true);
    });

    it('should reject non-assistant messages', () => {
      const userMessage: UserMessage = {
        id: 'msg_123',
        role: 'user',
        content: 'Hello AI',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isAssistantMessage(userMessage)).toBe(false);
    });
  });

  describe('isSystemMessage', () => {
    it('should validate system message', () => {
      const systemMessage: SystemMessage = {
        id: 'msg_123',
        role: 'system',
        content: 'Chat initialized',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isSystemMessage(systemMessage)).toBe(true);
    });

    it('should reject non-system messages', () => {
      const userMessage: UserMessage = {
        id: 'msg_123',
        role: 'user',
        content: 'Hello AI',
        timestamp: Date.now(),
        status: 'sent',
      };

      expect(isSystemMessage(userMessage)).toBe(false);
    });
  });

  describe('isValidMessageRole', () => {
    it('should validate valid roles', () => {
      expect(isValidMessageRole('user')).toBe(true);
      expect(isValidMessageRole('assistant')).toBe(true);
      expect(isValidMessageRole('system')).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(isValidMessageRole('admin')).toBe(false);
      expect(isValidMessageRole('bot')).toBe(false);
      expect(isValidMessageRole('')).toBe(false);
      expect(isValidMessageRole(null)).toBe(false);
      expect(isValidMessageRole(undefined)).toBe(false);
    });
  });

  describe('isValidMessageStatus', () => {
    it('should validate valid statuses', () => {
      expect(isValidMessageStatus('sending')).toBe(true);
      expect(isValidMessageStatus('sent')).toBe(true);
      expect(isValidMessageStatus('error')).toBe(true);
      expect(isValidMessageStatus('streaming')).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(isValidMessageStatus('delivered')).toBe(false);
      expect(isValidMessageStatus('read')).toBe(false);
      expect(isValidMessageStatus('')).toBe(false);
      expect(isValidMessageStatus(null)).toBe(false);
      expect(isValidMessageStatus(undefined)).toBe(false);
    });
  });

  describe('isCodeBlock', () => {
    it('should validate code block structure', () => {
      const codeBlock: CodeBlock = {
        language: 'typescript',
        code: 'const x = 42;',
        filename: 'example.ts',
      };

      expect(isCodeBlock(codeBlock)).toBe(true);
    });

    it('should validate code block without filename', () => {
      const codeBlock: CodeBlock = {
        language: 'javascript',
        code: 'console.log("hello");',
      };

      expect(isCodeBlock(codeBlock)).toBe(true);
    });

    it('should reject invalid code blocks', () => {
      expect(isCodeBlock(null)).toBe(false);
      expect(isCodeBlock({})).toBe(false);
      expect(isCodeBlock({ language: 'js' })).toBe(false);
      expect(isCodeBlock({ code: 'test' })).toBe(false);
      expect(
        isCodeBlock({
          language: 123,
          code: 'test',
        })
      ).toBe(false);
    });
  });

  describe('isStreamingContent', () => {
    it('should validate streaming content', () => {
      const streamingContent: StreamingContent = {
        text: 'Partial response...',
        isStreaming: true,
        streamingId: 'stream_456',
      };

      expect(isStreamingContent(streamingContent)).toBe(true);
    });

    it('should validate completed streaming content', () => {
      const completedContent: StreamingContent = {
        text: 'Complete response',
        isStreaming: false,
        streamingId: 'stream_456',
      };

      expect(isStreamingContent(completedContent)).toBe(true);
    });

    it('should reject invalid streaming content', () => {
      expect(isStreamingContent(null)).toBe(false);
      expect(isStreamingContent({})).toBe(false);
      expect(
        isStreamingContent({
          text: 'test',
          isStreaming: 'true', // should be boolean
        })
      ).toBe(false);
    });
  });

  describe('isConversation', () => {
    it('should validate conversation structure', () => {
      const conversation: Conversation = {
        id: 'conv_123',
        title: 'Test Conversation',
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now(),
            status: 'sent',
          },
        ],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
        },
      };

      expect(isConversation(conversation)).toBe(true);
    });

    it('should validate empty conversation', () => {
      const conversation: Conversation = {
        id: 'conv_123',
        title: 'Empty Conversation',
        messages: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        },
      };

      expect(isConversation(conversation)).toBe(true);
    });

    it('should reject invalid conversations', () => {
      expect(isConversation(null)).toBe(false);
      expect(isConversation({})).toBe(false);
      expect(
        isConversation({
          id: 'conv_123',
          title: 'Test',
          messages: 'not-an-array',
        })
      ).toBe(false);
    });
  });
});

describe('Message Creation Helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createChatMessage', () => {
    it('should create message with unique ID', () => {
      const message1 = createChatMessage({
        role: 'user',
        content: 'Hello',
      });

      const message2 = createChatMessage({
        role: 'user',
        content: 'Hello',
      });

      expect(message1.id).not.toBe(message2.id);
      expect(message1.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(message2.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should create message with correct timestamp', () => {
      const beforeTime = Date.now();
      const message = createChatMessage({
        role: 'user',
        content: 'Hello',
      });
      const afterTime = Date.now();

      expect(message.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(message.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should create message with default status', () => {
      const message = createChatMessage({
        role: 'user',
        content: 'Hello',
      });

      expect(message.status).toBe('sending');
    });

    it('should create message with provided status', () => {
      const message = createChatMessage({
        role: 'user',
        content: 'Hello',
        status: 'sent',
      });

      expect(message.status).toBe('sent');
    });

    it('should create message with complex content', () => {
      const message = createChatMessage({
        role: 'assistant',
        content: {
          text: 'Here is code:',
          codeBlocks: [
            {
              language: 'typescript',
              code: 'const x = 42;',
            },
          ],
        },
      });

      expect(message.content).toEqual({
        text: 'Here is code:',
        codeBlocks: [
          {
            language: 'typescript',
            code: 'const x = 42;',
          },
        ],
      });
    });
  });

  describe('createUserMessage', () => {
    it('should create user message', () => {
      const message = createUserMessage('Hello AI');

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello AI');
      expect(message.status).toBe('sending');
      expect(isUserMessage(message)).toBe(true);
    });

    it('should create user message with custom status', () => {
      const message = createUserMessage('Hello AI', { status: 'sent' });

      expect(message.status).toBe('sent');
    });
  });

  describe('createAssistantMessage', () => {
    it('should create assistant message', () => {
      const message = createAssistantMessage('Hello human');

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello human');
      expect(message.status).toBe('sending');
      expect(isAssistantMessage(message)).toBe(true);
    });

    it('should create assistant message with streaming content', () => {
      const content: StreamingContent = {
        text: 'Streaming...',
        isStreaming: true,
        streamingId: 'stream_123',
      };

      const message = createAssistantMessage(content, { status: 'streaming' });

      expect(message.content).toEqual(content);
      expect(message.status).toBe('streaming');
    });
  });

  describe('createSystemMessage', () => {
    it('should create system message', () => {
      const message = createSystemMessage('System initialized');

      expect(message.role).toBe('system');
      expect(message.content).toBe('System initialized');
      expect(message.status).toBe('sent'); // System messages are usually sent immediately
      expect(isSystemMessage(message)).toBe(true);
    });
  });

  describe('createConversation', () => {
    it('should create empty conversation', () => {
      const conversation = createConversation('Test Conversation');

      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.messages).toEqual([]);
      expect(conversation.metadata.messageCount).toBe(0);
      expect(conversation.id).toMatch(/^conv_\d+_[a-z0-9]+$/);
    });

    it('should create conversation with messages', () => {
      const messages = [createUserMessage('Hello'), createAssistantMessage('Hi there')];

      const conversation = createConversation('Test Conversation', { messages });

      expect(conversation.messages).toEqual(messages);
      expect(conversation.metadata.messageCount).toBe(2);
    });

    it('should create conversation with custom ID', () => {
      const conversation = createConversation('Test', { id: 'custom_conv_123' });

      expect(conversation.id).toBe('custom_conv_123');
    });
  });
});

describe('Type Compilation Tests', () => {
  it('should allow assignment of valid message roles', () => {
    const validRoles: MessageRole[] = ['user', 'assistant', 'system'];

    validRoles.forEach(role => {
      expect(typeof role).toBe('string');
      expect(['user', 'assistant', 'system']).toContain(role);
    });
  });

  it('should allow assignment of valid message statuses', () => {
    const validStatuses: MessageStatus[] = ['sending', 'sent', 'error', 'streaming'];

    validStatuses.forEach(status => {
      expect(typeof status).toBe('string');
      expect(['sending', 'sent', 'error', 'streaming']).toContain(status);
    });
  });

  it('should support union types for MessageContent', () => {
    const stringContent: MessageContent = 'Simple text';
    const objectContent: MessageContent = {
      text: 'Text with code',
      codeBlocks: [
        {
          language: 'javascript',
          code: 'console.log("test");',
        },
      ],
    };
    const streamingContent: MessageContent = {
      text: 'Streaming text',
      isStreaming: true,
      streamingId: 'stream_123',
    };

    expect(typeof stringContent).toBe('string');
    expect(typeof objectContent).toBe('object');
    expect(typeof streamingContent).toBe('object');
  });

  it('should enforce required fields in ChatMessage', () => {
    // This test ensures TypeScript compilation requirements
    const message: ChatMessage = {
      id: 'msg_123',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      status: 'sent',
      // Optional fields can be omitted
    };

    expect(message.id).toBeDefined();
    expect(message.role).toBeDefined();
    expect(message.content).toBeDefined();
    expect(message.timestamp).toBeDefined();
    expect(message.status).toBeDefined();
  });

  it('should enforce required fields in Conversation', () => {
    const conversation: Conversation = {
      id: 'conv_123',
      title: 'Test Conversation',
      messages: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      },
    };

    expect(conversation.id).toBeDefined();
    expect(conversation.title).toBeDefined();
    expect(conversation.messages).toBeDefined();
    expect(conversation.metadata).toBeDefined();
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle empty string content', () => {
    const message = createChatMessage({
      role: 'user',
      content: '',
    });

    expect(message.content).toBe('');
    expect(isChatMessage(message)).toBe(true);
  });

  it('should handle very long content', () => {
    const longContent = 'A'.repeat(10000);
    const message = createChatMessage({
      role: 'user',
      content: longContent,
    });

    expect(message.content).toBe(longContent);
    expect(isChatMessage(message)).toBe(true);
  });

  it('should handle special characters in content', () => {
    const specialContent = 'Hello 👋 with émojis and àccénts';
    const message = createChatMessage({
      role: 'user',
      content: specialContent,
    });

    expect(message.content).toBe(specialContent);
    expect(isChatMessage(message)).toBe(true);
  });

  it('should handle malformed objects gracefully', () => {
    const malformedObject = {
      id: null,
      role: undefined,
      content: {},
      timestamp: 'invalid',
      status: 123,
    };

    expect(isChatMessage(malformedObject)).toBe(false);
  });

  it('should handle circular references', () => {
    const circular: any = { role: 'user' };
    circular.self = circular;

    expect(isChatMessage(circular)).toBe(false);
  });
});
