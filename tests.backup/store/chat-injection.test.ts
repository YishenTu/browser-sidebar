/**
 * @file Chat Store Injection Tests
 *
 * Unit tests for chat store functionality related to content injection,
 * particularly focusing on displayContent, metadata preservation,
 * and injection logic for first messages.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useChatStore, type ChatMessage, type MessageRole } from '@/data/store/chat';

describe('Chat Store - Injection Functionality', () => {
  // Helper function to perform store operations and get fresh state
  const withFreshStore = <T>(operation: (store: ReturnType<typeof useChatStore.getState>) => T) => {
    const store = useChatStore.getState();
    const result = operation(store);
    return { result, store: useChatStore.getState() };
  };

  // Helper to reset store state before each test
  beforeEach(() => {
    const store = useChatStore.getState();
    store.clearConversation();
    store.setError(null);
    store.setLoading(false);
    store.setActiveMessage(null);
    store.setLastResponseId(null);
  });

  describe('Message Creation with displayContent', () => {
    test('should create message with displayContent field', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Original content with tab context injected',
          displayContent: 'Original user input',
        })
      );

      expect(message.content).toBe('Original content with tab context injected');
      expect(message.displayContent).toBe('Original user input');
      expect(store.messages).toHaveLength(1);
      expect(store.messages[0]?.displayContent).toBe('Original user input');
    });

    test('should create message without displayContent when not provided', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Simple user message',
        })
      );

      expect(message.content).toBe('Simple user message');
      expect(message.displayContent).toBeUndefined();
      expect(store.messages[0]?.displayContent).toBeUndefined();
    });

    test('should handle empty displayContent', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content with empty display',
          displayContent: '',
        })
      );

      expect(message.displayContent).toBe('');
      expect(store.messages[0]?.displayContent).toBe('');
    });

    test('should handle null displayContent gracefully', () => {
      const { result: message, store } = withFreshStore(store =>
        // @ts-expect-error: Testing null handling
        store.addMessage({
          role: 'user',
          content: 'Content with null display',
          displayContent: null,
        })
      );

      expect(message.displayContent).toBeNull();
      expect(store.messages[0]?.displayContent).toBeNull();
    });
  });

  describe('Metadata Preservation', () => {
    test('should preserve all metadata fields including tabId', () => {
      const metadata = {
        hasTabContext: true,
        originalUserContent: 'User typed this',
        tabId: 123,
        tabTitle: 'Test Page Title',
        tabUrl: 'https://example.com',
        customField: 'custom value',
      };

      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Enhanced content',
          displayContent: 'User typed this',
          metadata,
        })
      );

      expect(message.metadata).toEqual(metadata);
      expect(message.metadata?.tabId).toBe(123);
      expect(message.metadata?.hasTabContext).toBe(true);
      expect(message.metadata?.originalUserContent).toBe('User typed this');
      expect(message.metadata?.customField).toBe('custom value');
    });

    test('should handle partial metadata', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
          metadata: {
            tabId: 456,
            hasTabContext: true,
          },
        })
      );

      expect(message.metadata?.tabId).toBe(456);
      expect(message.metadata?.hasTabContext).toBe(true);
      expect(message.metadata?.originalUserContent).toBeUndefined();
      expect(message.metadata?.tabTitle).toBeUndefined();
    });

    test('should handle string tabId', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
          metadata: {
            tabId: 'tab-string-id',
            hasTabContext: true,
          },
        })
      );

      expect(message.metadata?.tabId).toBe('tab-string-id');
      expect(typeof message.metadata?.tabId).toBe('string');
    });

    test('should handle empty metadata object', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
          metadata: {},
        })
      );

      expect(message.metadata).toEqual({});
    });

    test('should handle undefined metadata', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
        })
      );

      expect(message.metadata).toBeUndefined();
    });
  });

  describe('First Message Injection Logic', () => {
    test('should identify first user message in conversation', () => {
      const { result: firstMessage, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'First user message',
          metadata: {
            hasTabContext: true,
            tabId: 123,
          },
        })
      );

      expect(store.messages).toHaveLength(1);
      expect(store.getUserMessages()).toHaveLength(1);
      expect(firstMessage.metadata?.hasTabContext).toBe(true);

      // This would be the first message that could trigger injection
      const userMessages = store.getUserMessages();
      expect(userMessages[0]?.id).toBe(firstMessage.id);
    });

    test('should handle system message before first user message', () => {
      // Add system message first
      withFreshStore(store =>
        store.addMessage({
          role: 'system',
          content: 'System initialization',
        })
      );

      // Add first user message
      const { result: firstUserMessage, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'First user input',
          metadata: {
            hasTabContext: true,
            tabId: 123,
          },
        })
      );

      expect(store.messages).toHaveLength(2);
      expect(store.getUserMessages()).toHaveLength(1);
      expect(store.getUserMessages()[0]?.id).toBe(firstUserMessage.id);
      expect(firstUserMessage.metadata?.hasTabContext).toBe(true);
    });

    test('should distinguish first message from subsequent messages', () => {
      // First message with injection
      const { result: firstMessage } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'First with tab context',
          displayContent: 'First message',
          metadata: {
            hasTabContext: true,
            originalUserContent: 'First message',
            tabId: 123,
          },
        })
      );

      // Assistant response
      withFreshStore(store =>
        store.addMessage({
          role: 'assistant',
          content: 'AI response',
        })
      );

      // Second user message without injection
      const { result: secondMessage, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Second message',
          metadata: {
            hasTabContext: false,
            tabId: 123,
          },
        })
      );

      const userMessages = store.getUserMessages();
      expect(userMessages).toHaveLength(2);
      expect(userMessages[0]?.metadata?.hasTabContext).toBe(true);
      expect(userMessages[1]?.metadata?.hasTabContext).toBe(false);
      expect(userMessages[0]?.displayContent).toBe('First message');
      expect(userMessages[1]?.displayContent).toBeUndefined();
    });
  });

  describe('Subsequent Message Handling', () => {
    test('should handle subsequent messages without injection', () => {
      // Set up initial conversation
      withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'First message with context',
          metadata: { hasTabContext: true, tabId: 123 },
        })
      );

      withFreshStore(store =>
        store.addMessage({
          role: 'assistant',
          content: 'AI response',
        })
      );

      // Add subsequent user message
      const { result: subsequentMessage, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Follow-up question',
          metadata: { hasTabContext: false, tabId: 123 },
        })
      );

      expect(store.getUserMessages()).toHaveLength(2);
      expect(subsequentMessage.metadata?.hasTabContext).toBe(false);
      expect(subsequentMessage.displayContent).toBeUndefined();
    });

    test('should maintain conversation context across multiple messages', () => {
      const messages = [
        {
          role: 'user' as MessageRole,
          content: 'First',
          metadata: { tabId: 123, hasTabContext: true },
        },
        { role: 'assistant' as MessageRole, content: 'Response 1' },
        {
          role: 'user' as MessageRole,
          content: 'Second',
          metadata: { tabId: 123, hasTabContext: false },
        },
        { role: 'assistant' as MessageRole, content: 'Response 2' },
        {
          role: 'user' as MessageRole,
          content: 'Third',
          metadata: { tabId: 123, hasTabContext: false },
        },
      ];

      let store;
      messages.forEach(msg => {
        const result = withFreshStore(s => s.addMessage(msg));
        store = result.store;
      });

      expect(store!.messages).toHaveLength(5);
      expect(store!.getUserMessages()).toHaveLength(3);
      expect(store!.getAssistantMessages()).toHaveLength(2);

      const userMessages = store!.getUserMessages();
      expect(userMessages[0]?.metadata?.hasTabContext).toBe(true);
      expect(userMessages[1]?.metadata?.hasTabContext).toBe(false);
      expect(userMessages[2]?.metadata?.hasTabContext).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null content gracefully', () => {
      const { result: message, store } = withFreshStore(store =>
        // @ts-expect-error: Testing null handling
        store.addMessage({
          role: 'user',
          content: null,
          metadata: { tabId: 123 },
        })
      );

      expect(message.content).toBeNull();
      expect(store.messages).toHaveLength(1);
    });

    test('should handle undefined content gracefully', () => {
      const { result: message, store } = withFreshStore(store =>
        // @ts-expect-error: Testing undefined handling
        store.addMessage({
          role: 'user',
          content: undefined,
          metadata: { tabId: 123 },
        })
      );

      expect(message.content).toBeUndefined();
      expect(store.messages).toHaveLength(1);
    });

    test('should handle empty content string', () => {
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: '',
          displayContent: 'User input was empty',
          metadata: { tabId: 123, hasTabContext: true },
        })
      );

      expect(message.content).toBe('');
      expect(message.displayContent).toBe('User input was empty');
      expect(message.metadata?.hasTabContext).toBe(true);
    });

    test('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      const longDisplayContent = 'B'.repeat(5000);

      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: longContent,
          displayContent: longDisplayContent,
          metadata: { tabId: 123, hasTabContext: true },
        })
      );

      expect(message.content).toBe(longContent);
      expect(message.content).toHaveLength(10000);
      expect(message.displayContent).toBe(longDisplayContent);
      expect(message.displayContent).toHaveLength(5000);
    });

    test('should handle special characters in content', () => {
      const specialContent = 'Content with 🎉 emojis and \n newlines \t tabs "quotes" <tags>';

      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: specialContent,
          displayContent: 'Clean display',
          metadata: { tabId: 123, hasTabContext: true },
        })
      );

      expect(message.content).toBe(specialContent);
      expect(message.displayContent).toBe('Clean display');
    });
  });

  describe('Message Updates with Injection Fields', () => {
    test('should update displayContent via updateMessage', () => {
      const { result: message } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Original content',
          displayContent: 'Original display',
        })
      );

      const { store } = withFreshStore(store =>
        store.updateMessage(message.id, {
          displayContent: 'Updated display',
        })
      );

      const updatedMessage = store.getMessageById(message.id);
      expect(updatedMessage?.displayContent).toBe('Updated display');
      expect(updatedMessage?.content).toBe('Original content'); // Should remain unchanged
    });

    test('should update metadata preserving existing fields', () => {
      const { result: message } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
          metadata: {
            tabId: 123,
            hasTabContext: true,
            originalUserContent: 'Original',
          },
        })
      );

      const { store } = withFreshStore(store =>
        store.updateMessage(message.id, {
          metadata: {
            hasTabContext: false,
            newField: 'new value',
          },
        })
      );

      const updatedMessage = store.getMessageById(message.id);
      expect(updatedMessage?.metadata?.tabId).toBe(123); // Preserved
      expect(updatedMessage?.metadata?.originalUserContent).toBe('Original'); // Preserved
      expect(updatedMessage?.metadata?.hasTabContext).toBe(false); // Updated
      expect(updatedMessage?.metadata?.newField).toBe('new value'); // Added
    });

    test('should handle clearing displayContent', () => {
      const { result: message } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Content',
          displayContent: 'Display',
        })
      );

      const { store } = withFreshStore(store =>
        store.updateMessage(message.id, {
          displayContent: undefined,
        })
      );

      const updatedMessage = store.getMessageById(message.id);
      expect(updatedMessage?.displayContent).toBeUndefined();
    });
  });

  describe('Conversation Management with Injection Data', () => {
    test('should preserve injection data across conversation operations', () => {
      // Add messages with injection data
      const { result: message1 } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Message 1 with context',
          displayContent: 'Message 1',
          metadata: { hasTabContext: true, tabId: 123 },
        })
      );

      withFreshStore(store =>
        store.addMessage({
          role: 'assistant',
          content: 'Response 1',
        })
      );

      const { result: message2 } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Message 2',
          metadata: { hasTabContext: false, tabId: 123 },
        })
      );

      // Edit first message should preserve structure
      const { store } = withFreshStore(store => store.editMessage(message1.id));
      const editedMessage = store.editMessage(message1.id);

      expect(editedMessage?.displayContent).toBe('Message 1');
      expect(editedMessage?.metadata?.hasTabContext).toBe(true);
      expect(store.messages).toHaveLength(1); // Should remove everything after
    });

    test('should handle clearConversation with injection data', () => {
      // Add messages with complex injection data
      const { store: initialStore } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'Complex message',
          displayContent: 'Display',
          metadata: {
            hasTabContext: true,
            tabId: 123,
            tabTitle: 'Test',
            tabUrl: 'https://example.com',
            customData: { nested: 'object' },
          },
        })
      );

      expect(initialStore.messages).toHaveLength(1);

      const { store } = withFreshStore(store => store.clearConversation());

      expect(store.messages).toHaveLength(0);
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('Injection Logic Integration', () => {
    test('should simulate typical injection workflow', () => {
      // Step 1: User types message
      const userInput = 'What is this page about?';

      // Step 2: Content extraction adds tab context
      const extractedContent = 'Page Title: Example\nContent: This is a sample page about...';
      const enhancedContent = `${userInput}\n\n--- Tab Content ---\n${extractedContent}`;

      // Step 3: Store the message with injection data
      const { result: message, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: enhancedContent,
          displayContent: userInput,
          metadata: {
            hasTabContext: true,
            originalUserContent: userInput,
            tabId: 123,
            tabTitle: 'Example Page',
            tabUrl: 'https://example.com',
          },
        })
      );

      // Verify the injection worked correctly
      expect(message.content).toContain('--- Tab Content ---');
      expect(message.content).toContain(extractedContent);
      expect(message.displayContent).toBe(userInput);
      expect(message.metadata?.hasTabContext).toBe(true);
      expect(message.metadata?.originalUserContent).toBe(userInput);

      // Verify it's the first message
      expect(store.getUserMessages()).toHaveLength(1);
      expect(store.getUserMessages()[0]?.id).toBe(message.id);
    });

    test('should simulate subsequent message without injection', () => {
      // Set up first message with injection
      withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: 'First with context\n--- Tab Content ---\nPage data...',
          displayContent: 'First message',
          metadata: {
            hasTabContext: true,
            originalUserContent: 'First message',
            tabId: 123,
          },
        })
      );

      withFreshStore(store =>
        store.addMessage({
          role: 'assistant',
          content: 'AI response to first message',
        })
      );

      // Second message - no injection needed
      const followUp = 'Can you explain more about that?';
      const { result: secondMessage, store } = withFreshStore(store =>
        store.addMessage({
          role: 'user',
          content: followUp, // No tab content added
          // No displayContent since content === user input
          metadata: {
            hasTabContext: false,
            tabId: 123,
          },
        })
      );

      expect(secondMessage.content).toBe(followUp);
      expect(secondMessage.displayContent).toBeUndefined();
      expect(secondMessage.metadata?.hasTabContext).toBe(false);
      expect(store.getUserMessages()).toHaveLength(2);
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large number of messages with injection data efficiently', () => {
      const startTime = performance.now();

      let store;
      // Add 100 messages with injection data
      for (let i = 0; i < 100; i++) {
        const result = withFreshStore(s =>
          s.addMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i} content`,
            displayContent: i % 2 === 0 ? `User message ${i}` : undefined,
            metadata:
              i % 2 === 0
                ? {
                    hasTabContext: i === 0, // Only first message has tab context
                    tabId: 123,
                    messageIndex: i,
                  }
                : undefined,
          })
        );
        store = result.store;
      }

      const endTime = performance.now();

      expect(store!.messages).toHaveLength(100);
      expect(store!.getUserMessages()).toHaveLength(50);
      expect(store!.getAssistantMessages()).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(200); // Should be reasonably fast

      // Verify first message still has injection data
      const firstUserMessage = store!.getUserMessages()[0];
      expect(firstUserMessage?.metadata?.hasTabContext).toBe(true);
    });

    test('should handle memory cleanup when clearing conversation', () => {
      // Add messages with large metadata objects
      let store;
      for (let i = 0; i < 10; i++) {
        const result = withFreshStore(s =>
          s.addMessage({
            role: 'user',
            content: `Message ${i}`,
            displayContent: `Display ${i}`,
            metadata: {
              hasTabContext: true,
              tabId: i,
              largeData: new Array(1000).fill(`data-${i}`),
              complexObject: {
                nested: {
                  deep: {
                    data: `value-${i}`,
                  },
                },
              },
            },
          })
        );
        store = result.store;
      }

      expect(store!.messages).toHaveLength(10);

      const { store: clearedStore } = withFreshStore(store => store.clearConversation());

      expect(clearedStore.messages).toHaveLength(0);
      // All metadata should be cleared from memory
    });
  });
});
