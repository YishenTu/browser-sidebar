import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatStore } from '../../src/store/chat';

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useChatStore.getState().clearConversation();
    });
  });

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.activeMessageId).toBeNull();
      expect(result.current.conversationId).toBeNull();
    });
  });

  describe('Message Addition', () => {
    it('should add user message correctly', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          role: 'user',
          content: 'Hello, AI!',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      const message = result.current.messages[0];

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, AI!');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.status).toBe('sent');
    });

    it('should add AI message correctly', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'Hello! How can I help you?',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      const message = result.current.messages[0];

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello! How can I help you?');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.status).toBe('received');
    });

    it('should add messages with custom options', () => {
      const { result } = renderHook(() => useChatStore());
      const customId = 'custom-message-id';
      const customTimestamp = new Date('2024-01-01');

      act(() => {
        result.current.addMessage({
          role: 'user',
          content: 'Custom message',
          id: customId,
          timestamp: customTimestamp,
          status: 'error',
        });
      });

      const message = result.current.messages[0];
      expect(message.id).toBe(customId);
      expect(message.timestamp).toEqual(customTimestamp);
      expect(message.status).toBe('error');
    });

    it('should maintain message order', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({ role: 'user', content: 'First message' });
        result.current.addMessage({ role: 'assistant', content: 'Second message' });
        result.current.addMessage({ role: 'user', content: 'Third message' });
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].content).toBe('First message');
      expect(result.current.messages[1].content).toBe('Second message');
      expect(result.current.messages[2].content).toBe('Third message');
    });
  });

  describe('Message Updates', () => {
    it('should update message content', () => {
      const { result } = renderHook(() => useChatStore());
      const messageId: string;

      act(() => {
        result.current.addMessage({ role: 'assistant', content: 'Initial content' });
      });

      // Check that message was added
      expect(result.current.messages).toHaveLength(1);
      messageId = result.current.messages[0].id;

      act(() => {
        result.current.updateMessage(messageId, { content: 'Updated content' });
      });

      const message = result.current.messages[0];
      expect(message.content).toBe('Updated content');
      expect(message.id).toBe(messageId);
    });

    it('should update message status', () => {
      const { result } = renderHook(() => useChatStore());
      const messageId: string;

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Test message' });
      });

      expect(result.current.messages).toHaveLength(1);
      messageId = result.current.messages[0].id;

      act(() => {
        result.current.updateMessage(messageId, { status: 'sending' });
      });

      expect(result.current.messages[0].status).toBe('sending');

      act(() => {
        result.current.updateMessage(messageId, { status: 'sent' });
      });

      expect(result.current.messages[0].status).toBe('sent');
    });

    it('should append content during streaming', () => {
      const { result } = renderHook(() => useChatStore());
      const messageId: string;

      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'Initial',
          status: 'streaming',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      messageId = result.current.messages[0].id;

      act(() => {
        result.current.appendToMessage(messageId, ' content');
      });

      expect(result.current.messages[0].content).toBe('Initial content');

      act(() => {
        result.current.appendToMessage(messageId, ' more text');
      });

      expect(result.current.messages[0].content).toBe('Initial content more text');
    });

    it('should not update non-existent message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Test message' });
      });

      const originalMessage = result.current.messages[0];

      act(() => {
        result.current.updateMessage('non-existent-id', { content: 'Should not update' });
      });

      expect(result.current.messages[0]).toEqual(originalMessage);
    });
  });

  describe('Message Deletion', () => {
    it('should delete specific message', () => {
      const { result } = renderHook(() => useChatStore());
      const messageIdToDelete: string;

      act(() => {
        result.current.addMessage({ role: 'user', content: 'First message' });
        result.current.addMessage({ role: 'assistant', content: 'Second message' });
        result.current.addMessage({ role: 'user', content: 'Third message' });
      });

      expect(result.current.messages).toHaveLength(3);
      messageIdToDelete = result.current.messages[1].id;

      act(() => {
        result.current.deleteMessage(messageIdToDelete);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('First message');
      expect(result.current.messages[1].content).toBe('Third message');
    });

    it('should handle deletion of non-existent message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Test message' });
      });

      const originalMessages = [...result.current.messages];

      act(() => {
        result.current.deleteMessage('non-existent-id');
      });

      expect(result.current.messages).toEqual(originalMessages);
    });
  });

  describe('Conversation Management', () => {
    it('should clear entire conversation', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Message 1' });
        result.current.addMessage({ role: 'assistant', content: 'Message 2' });
        result.current.addMessage({ role: 'user', content: 'Message 3' });
        result.current.setError('Some error');
        result.current.setLoading(true);
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.error).toBe('Some error');
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.clearConversation();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.activeMessageId).toBeNull();
    });

    it('should start new conversation with ID', () => {
      const { result } = renderHook(() => useChatStore());
      const conversationId = 'conv-123';

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Old message' });
        result.current.startNewConversation(conversationId);
      });

      expect(result.current.conversationId).toBe(conversationId);
      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Loading State', () => {
    it('should set and clear loading state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should set and clear error state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError('Connection failed');
      });

      expect(result.current.error).toBe('Connection failed');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Active Message Tracking', () => {
    it('should set and clear active message for streaming', () => {
      const { result } = renderHook(() => useChatStore());
      const messageId: string;

      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'Streaming message',
          status: 'streaming',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      messageId = result.current.messages[0].id;

      act(() => {
        result.current.setActiveMessage(messageId);
      });

      expect(result.current.activeMessageId).toBe(messageId);

      act(() => {
        result.current.clearActiveMessage();
      });

      expect(result.current.activeMessageId).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should get messages by role', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({ role: 'user', content: 'User message 1' });
        result.current.addMessage({ role: 'assistant', content: 'AI message 1' });
        result.current.addMessage({ role: 'user', content: 'User message 2' });
        result.current.addMessage({ role: 'assistant', content: 'AI message 2' });
      });

      const userMessages = result.current.getUserMessages();
      const assistantMessages = result.current.getAssistantMessages();

      expect(userMessages).toHaveLength(2);
      expect(assistantMessages).toHaveLength(2);
      expect(userMessages[0].content).toBe('User message 1');
      expect(userMessages[1].content).toBe('User message 2');
      expect(assistantMessages[0].content).toBe('AI message 1');
      expect(assistantMessages[1].content).toBe('AI message 2');
    });

    it('should get last message', () => {
      const { result } = renderHook(() => useChatStore());

      // No messages initially
      expect(result.current.getLastMessage()).toBeUndefined();

      act(() => {
        result.current.addMessage({ role: 'user', content: 'First message' });
        result.current.addMessage({ role: 'assistant', content: 'Last message' });
      });

      const lastMessage = result.current.getLastMessage();
      expect(lastMessage?.content).toBe('Last message');
      expect(lastMessage?.role).toBe('assistant');
    });

    it('should get message by ID', () => {
      const { result } = renderHook(() => useChatStore());
      const messageId: string;

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Test message' });
      });

      expect(result.current.messages).toHaveLength(1);
      messageId = result.current.messages[0].id;

      const foundMessage = result.current.getMessageById(messageId);
      expect(foundMessage?.content).toBe('Test message');
      expect(foundMessage?.id).toBe(messageId);

      const notFound = result.current.getMessageById('non-existent');
      expect(notFound).toBeUndefined();
    });

    it('should check if conversation has messages', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.hasMessages()).toBe(false);

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Test message' });
      });

      expect(result.current.hasMessages()).toBe(true);

      act(() => {
        result.current.clearConversation();
      });

      expect(result.current.hasMessages()).toBe(false);
    });

    it('should count messages', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.getMessageCount()).toBe(0);

      act(() => {
        result.current.addMessage({ role: 'user', content: 'Message 1' });
        result.current.addMessage({ role: 'assistant', content: 'Message 2' });
        result.current.addMessage({ role: 'user', content: 'Message 3' });
      });

      expect(result.current.getMessageCount()).toBe(3);
    });
  });

  describe('Streaming Support', () => {
    it('should handle streaming message lifecycle', () => {
      const { result } = renderHook(() => useChatStore());

      // Start streaming message
      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'Hello',
          status: 'streaming',
        });
      });

      const messageId = result.current.messages[0].id;
      expect(result.current.messages[0].status).toBe('streaming');

      // Set as active for streaming
      act(() => {
        result.current.setActiveMessage(messageId);
      });

      expect(result.current.activeMessageId).toBe(messageId);

      // Stream more content
      act(() => {
        result.current.appendToMessage(messageId, ', world!');
      });

      expect(result.current.messages[0].content).toBe('Hello, world!');

      // Complete streaming
      act(() => {
        result.current.updateMessage(messageId, { status: 'received' });
        result.current.clearActiveMessage();
      });

      expect(result.current.messages[0].status).toBe('received');
      expect(result.current.activeMessageId).toBeNull();
    });

    it('should handle multiple streaming messages', () => {
      const { result } = renderHook(() => useChatStore());

      // Add first streaming message
      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'First',
          status: 'streaming',
        });
      });

      const firstId = result.current.messages[0].id;

      // Add second streaming message
      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'Second',
          status: 'streaming',
        });
      });

      const secondId = result.current.messages[1].id;

      // Complete first message
      act(() => {
        result.current.updateMessage(firstId, { status: 'received' });
      });

      // Continue streaming second
      act(() => {
        result.current.setActiveMessage(secondId);
        result.current.appendToMessage(secondId, ' message');
      });

      expect(result.current.messages[0].status).toBe('received');
      expect(result.current.messages[1].content).toBe('Second message');
      expect(result.current.messages[1].status).toBe('streaming');
      expect(result.current.activeMessageId).toBe(secondId);
    });
  });

  describe('Message Status Transitions', () => {
    it('should handle user message status transitions', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          role: 'user',
          content: 'Test message',
          status: 'sending',
        });
      });

      const messageId = result.current.messages[0].id;
      expect(result.current.messages[0].status).toBe('sending');

      act(() => {
        result.current.updateMessage(messageId, { status: 'sent' });
      });

      expect(result.current.messages[0].status).toBe('sent');
    });

    it('should handle AI message status transitions', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          role: 'assistant',
          content: 'AI response',
          status: 'streaming',
        });
      });

      const messageId = result.current.messages[0].id;
      expect(result.current.messages[0].status).toBe('streaming');

      act(() => {
        result.current.updateMessage(messageId, { status: 'received' });
      });

      expect(result.current.messages[0].status).toBe('received');
    });

    it('should handle error status', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          role: 'user',
          content: 'Failed message',
          status: 'sending',
        });
      });

      const messageId = result.current.messages[0].id;

      act(() => {
        result.current.updateMessage(messageId, {
          status: 'error',
          error: 'Network connection failed',
        });
      });

      const message = result.current.messages[0];
      expect(message.status).toBe('error');
      expect(message.error).toBe('Network connection failed');
    });
  });
});
