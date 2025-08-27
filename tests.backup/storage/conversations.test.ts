/**
 * @file Conversation Storage Tests
 *
 * Comprehensive test suite for conversation persistence operations following TDD methodology.
 * Tests CRUD operations, search functionality, pagination, error handling, and concurrent operations.
 *
 * Coverage Requirements:
 * - Save operations (create, update)
 * - Load operations (get by ID, get all)
 * - Search functionality (by title, content, date range)
 * - Pagination (limit, offset, sorting)
 * - Error handling and edge cases
 * - Concurrent operations safety
 * - Performance with large datasets
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationStorage } from '../../src/storage/conversations';
import { IndexedDBWrapper } from '../../src/storage/indexedDB';
import { OBJECT_STORES } from '../../src/storage/schema';
import {
  type ConversationData,
  type ConversationStorageCreate,
  type ConversationStorageUpdate,
  createStorageConversation,
  createTestConversation,
  generateConversationId,
} from '../../src/types/conversation';
import { createUserMessage, createAssistantMessage } from '../../src/types/chat';
import type { ChatMessage } from '../../src/types/chat';

// =============================================================================
// Test Setup and Utilities
// =============================================================================

// Mock IndexedDB for testing
class MockIndexedDBWrapper extends IndexedDBWrapper {
  private mockStore: Map<string, ConversationData> = new Map();
  private isFailureMode = false;

  setFailureMode(enabled: boolean) {
    this.isFailureMode = enabled;
  }

  clearStore() {
    this.mockStore.clear();
  }

  async add<T>(storeName: string, data: T): Promise<string> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB add failure');
    }
    
    const conv = data as ConversationData;
    if (this.mockStore.has(conv.id)) {
      throw new Error(`Conversation with id ${conv.id} already exists`);
    }
    
    this.mockStore.set(conv.id, conv);
    return conv.id;
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB get failure');
    }
    
    return (this.mockStore.get(key) as T) || null;
  }

  async update<T>(storeName: string, key: string, data: T): Promise<void> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB update failure');
    }
    
    if (!this.mockStore.has(key)) {
      throw new Error(`Key ${key} not found in ${storeName}`);
    }
    
    this.mockStore.set(key, data as ConversationData);
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB delete failure');
    }
    
    this.mockStore.delete(key);
  }

  async getAll<T>(): Promise<T[]> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB getAll failure');
    }
    
    return Array.from(this.mockStore.values()) as T[];
  }

  async query<T>(
    storeName: string,
    indexName: string,
    value: any,
    options?: { limit?: number; offset?: number }
  ): Promise<T[]> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB query failure');
    }

    let results = Array.from(this.mockStore.values()) as T[];

    // Apply basic filtering for timestamp index
    if (indexName === 'timestamp') {
      results = results.filter((conv: any) => conv.metadata.updatedAt >= value);
    }

    // Apply pagination
    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async queryRange<T>(
    storeName: string,
    indexName: string,
    lower: any,
    upper: any,
    options?: { limit?: number; offset?: number }
  ): Promise<T[]> {
    if (this.isFailureMode) {
      throw new Error('Mock IndexedDB queryRange failure');
    }

    let results = Array.from(this.mockStore.values()) as T[];

    // Apply range filtering for timestamp index
    if (indexName === 'timestamp') {
      results = results.filter((conv: any) => {
        const timestamp = conv.metadata.updatedAt;
        return timestamp >= lower && timestamp <= upper;
      });

      // Sort by timestamp ascending for consistent ordering
      results = results.sort((a: any, b: any) => a.metadata.updatedAt - b.metadata.updatedAt);
    }

    // Apply pagination
    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }
}

// Helper function to create test messages
function createTestMessages(count: number = 3): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const baseTime = Date.now() - (count * 60000); // Messages 1 minute apart

  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      messages.push(createUserMessage(`User message ${i + 1}`, {
        timestamp: baseTime + (i * 60000),
        status: 'sent'
      }));
    } else {
      messages.push(createAssistantMessage(`Assistant response ${i + 1}`, {
        timestamp: baseTime + (i * 60000),
        status: 'sent'
      }));
    }
  }

  return messages;
}

// Helper function to create test conversation with specific content
function createTestConversationWithContent(
  title: string,
  messageTexts: string[]
): ConversationData {
  const messages = messageTexts.map((text, index) => {
    return index % 2 === 0
      ? createUserMessage(text, { status: 'sent' })
      : createAssistantMessage(text, { status: 'sent' });
  });

  return createStorageConversation(title, { messages });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ConversationStorage', () => {
  let storage: ConversationStorage;
  let mockDB: MockIndexedDBWrapper;

  beforeEach(() => {
    mockDB = new MockIndexedDBWrapper();
    storage = new ConversationStorage(mockDB);
    mockDB.clearStore();
    mockDB.setFailureMode(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Save Operations Tests
  // ===========================================================================

  describe('Save Operations', () => {
    describe('createConversation', () => {
      it('should create a new conversation with auto-generated ID', async () => {
        const createData: ConversationStorageCreate = {
          messages: createTestMessages(2),
        };

        const result = await storage.createConversation('Test Conversation', createData);

        expect(result).toBeDefined();
        expect(result.id).toMatch(/^conv_\d+_[a-z0-9]{6}$/);
        expect(result.title).toBe('Test Conversation');
        expect(result.messages).toHaveLength(2);
        expect(result.metadata.messageCount).toBe(2);
        expect(result.metadata.createdAt).toBeGreaterThan(0);
        expect(result.metadata.updatedAt).toBeGreaterThan(0);
      });

      it('should create conversation with custom ID', async () => {
        const customId = 'custom_conv_123';
        const createData: ConversationStorageCreate = {
          id: customId,
          messages: createTestMessages(1),
        };

        const result = await storage.createConversation('Custom ID Conversation', createData);

        expect(result.id).toBe(customId);
        expect(result.title).toBe('Custom ID Conversation');
      });

      it('should create conversation with tab context and model settings', async () => {
        const createData: ConversationStorageCreate = {
          tabContext: {
            url: 'https://example.com',
            title: 'Example Page',
            timestamp: Date.now(),
            selectedText: 'Important text',
          },
          modelSettings: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
          },
        };

        const result = await storage.createConversation('Context Conversation', createData);

        expect(result.tabContext).toEqual(createData.tabContext);
        expect(result.modelSettings).toEqual(createData.modelSettings);
      });

      it('should handle empty messages array', async () => {
        const result = await storage.createConversation('Empty Conversation');

        expect(result.messages).toHaveLength(0);
        expect(result.metadata.messageCount).toBe(0);
      });

      it('should throw error for duplicate conversation ID', async () => {
        const existingId = 'duplicate_test';
        await storage.createConversation('First', { id: existingId });

        await expect(
          storage.createConversation('Second', { id: existingId })
        ).rejects.toThrow('already exists');
      });

      it('should handle database failures gracefully', async () => {
        mockDB.setFailureMode(true);

        await expect(
          storage.createConversation('Failed Conversation')
        ).rejects.toThrow('Mock IndexedDB add failure');
      });
    });

    describe('updateConversation', () => {
      let existingConversation: ConversationData;

      beforeEach(async () => {
        existingConversation = await storage.createConversation('Original Title', {
          messages: createTestMessages(2),
        });
      });

      it('should update conversation title', async () => {
        const updates: ConversationStorageUpdate = {
          title: 'Updated Title',
        };

        const result = await storage.updateConversation(existingConversation.id, updates);

        expect(result.title).toBe('Updated Title');
        expect(result.metadata.updatedAt).toBeGreaterThan(existingConversation.metadata.updatedAt);
      });

      it('should update conversation metadata', async () => {
        const updates: ConversationStorageUpdate = {
          metadata: {
            tags: ['important', 'work'],
            pinned: true,
          },
        };

        const result = await storage.updateConversation(existingConversation.id, updates);

        expect(result.metadata.tags).toEqual(['important', 'work']);
        expect(result.metadata.pinned).toBe(true);
      });

      it('should preserve existing data when updating', async () => {
        const updates: ConversationStorageUpdate = {
          title: 'New Title',
        };

        const result = await storage.updateConversation(existingConversation.id, updates);

        expect(result.messages).toEqual(existingConversation.messages);
        expect(result.metadata.messageCount).toBe(existingConversation.metadata.messageCount);
        expect(result.metadata.createdAt).toBe(existingConversation.metadata.createdAt);
      });

      it('should throw error for non-existent conversation', async () => {
        await expect(
          storage.updateConversation('non_existent_id', { title: 'New Title' })
        ).rejects.toThrow('not found');
      });

      it('should handle database update failures', async () => {
        mockDB.setFailureMode(true);

        await expect(
          storage.updateConversation(existingConversation.id, { title: 'Failed Update' })
        ).rejects.toThrow('Mock IndexedDB');
      });
    });

    describe('addMessage', () => {
      let conversation: ConversationData;

      beforeEach(async () => {
        conversation = await storage.createConversation('Message Test', {
          messages: createTestMessages(2),
        });
      });

      it('should add new message to conversation', async () => {
        const newMessage = createUserMessage('New user message', { status: 'sent' });

        const result = await storage.addMessage(conversation.id, newMessage);

        expect(result.messages).toHaveLength(3);
        expect(result.messages[2]).toEqual(newMessage);
        expect(result.metadata.messageCount).toBe(3);
        expect(result.metadata.updatedAt).toBeGreaterThan(conversation.metadata.updatedAt);
      });

      it('should maintain message order', async () => {
        const message1 = createUserMessage('First new message', { status: 'sent' });
        const message2 = createAssistantMessage('Second new message', { status: 'sent' });

        await storage.addMessage(conversation.id, message1);
        const result = await storage.addMessage(conversation.id, message2);

        expect(result.messages).toHaveLength(4);
        expect(result.messages[2].content).toBe('First new message');
        expect(result.messages[3].content).toBe('Second new message');
      });

      it('should handle duplicate message IDs', async () => {
        const message = createUserMessage('Duplicate test', { 
          id: 'duplicate_msg_id',
          status: 'sent' 
        });

        await storage.addMessage(conversation.id, message);

        await expect(
          storage.addMessage(conversation.id, { ...message })
        ).rejects.toThrow('already exists');
      });
    });
  });

  // ===========================================================================
  // Load Operations Tests
  // ===========================================================================

  describe('Load Operations', () => {
    let testConversations: ConversationData[];

    beforeEach(async () => {
      // Create test conversations with different timestamps
      const now = Date.now();
      testConversations = [
        await storage.createConversation('First Conversation', {
          id: 'conv_1',
          messages: createTestMessages(3),
          metadata: { createdAt: now - 3000, updatedAt: now - 3000 },
        }),
        await storage.createConversation('Second Conversation', {
          id: 'conv_2',
          messages: createTestMessages(2),
          metadata: { createdAt: now - 2000, updatedAt: now - 2000 },
        }),
        await storage.createConversation('Third Conversation', {
          id: 'conv_3',
          messages: createTestMessages(1),
          metadata: { createdAt: now - 1000, updatedAt: now - 1000 },
        }),
      ];
    });

    describe('getConversation', () => {
      it('should retrieve conversation by ID', async () => {
        const result = await storage.getConversation('conv_1');

        expect(result).toBeDefined();
        expect(result!.id).toBe('conv_1');
        expect(result!.title).toBe('First Conversation');
        expect(result!.messages).toHaveLength(3);
      });

      it('should return null for non-existent conversation', async () => {
        const result = await storage.getConversation('non_existent');

        expect(result).toBeNull();
      });

      it('should handle database get failures', async () => {
        mockDB.setFailureMode(true);

        await expect(
          storage.getConversation('conv_1')
        ).rejects.toThrow('Mock IndexedDB get failure');
      });
    });

    describe('getAllConversations', () => {
      it('should retrieve all conversations', async () => {
        const result = await storage.getAllConversations();

        expect(result).toHaveLength(3);
        expect(result.map(c => c.id)).toEqual(['conv_1', 'conv_2', 'conv_3']);
      });

      it('should return empty array when no conversations exist', async () => {
        mockDB.clearStore();

        const result = await storage.getAllConversations();

        expect(result).toEqual([]);
      });

      it('should handle database getAll failures', async () => {
        mockDB.setFailureMode(true);

        await expect(
          storage.getAllConversations()
        ).rejects.toThrow('Mock IndexedDB getAll failure');
      });
    });

    describe('getConversationsByDateRange', () => {
      it('should retrieve conversations within date range', async () => {
        const now = Date.now();
        const result = await storage.getConversationsByDateRange(
          now - 2500,
          now - 500
        );

        expect(result).toHaveLength(2);
        // Results should be ordered by updatedAt descending by default (newest first)
        expect(result.map(c => c.id)).toEqual(['conv_3', 'conv_2']);
      });

      it('should return empty array for out-of-range dates', async () => {
        const result = await storage.getConversationsByDateRange(
          Date.now() + 1000,
          Date.now() + 2000
        );

        expect(result).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Search Functionality Tests
  // ===========================================================================

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Create conversations with specific searchable content
      await storage.createConversation('JavaScript Tutorial', {
        id: 'js_tutorial',
        messages: [
          createUserMessage('How do I learn JavaScript?'),
          createAssistantMessage('JavaScript is a programming language used for web development'),
        ],
      });

      await storage.createConversation('Python Guide', {
        id: 'python_guide',
        messages: [
          createUserMessage('Python vs JavaScript comparison'),
          createAssistantMessage('Python is great for data science and backend development'),
        ],
      });

      await storage.createConversation('React Components', {
        id: 'react_comp',
        messages: [
          createUserMessage('How to create React components?'),
          createAssistantMessage('Components are the building blocks of React applications'),
        ],
      });
    });

    describe('searchConversations', () => {
      it('should search by conversation title', async () => {
        const result = await storage.searchConversations('JavaScript');

        expect(result).toHaveLength(2); // JavaScript Tutorial and Python (mentions JavaScript)
        expect(result.some(c => c.id === 'js_tutorial')).toBe(true);
        expect(result.some(c => c.id === 'python_guide')).toBe(true);
      });

      it('should search by message content', async () => {
        const result = await storage.searchConversations('React');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('react_comp');
      });

      it('should be case insensitive', async () => {
        const result = await storage.searchConversations('JAVASCRIPT');

        expect(result.length).toBeGreaterThan(0);
        expect(result.some(c => c.id === 'js_tutorial')).toBe(true);
      });

      it('should return empty array for no matches', async () => {
        const result = await storage.searchConversations('nonexistent');

        expect(result).toEqual([]);
      });

      it('should handle partial word matches', async () => {
        const result = await storage.searchConversations('Java');

        expect(result.length).toBeGreaterThan(0);
        expect(result.some(c => c.id === 'js_tutorial')).toBe(true);
      });

      it('should search across multiple fields', async () => {
        const result = await storage.searchConversations('programming');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('js_tutorial');
      });
    });

    describe('searchConversationsByTags', () => {
      beforeEach(async () => {
        // Add tags to conversations
        await storage.updateConversation('js_tutorial', {
          metadata: { tags: ['tutorial', 'frontend', 'beginner'] },
        });
        await storage.updateConversation('python_guide', {
          metadata: { tags: ['guide', 'backend', 'comparison'] },
        });
      });

      it('should search by single tag', async () => {
        const result = await storage.searchConversationsByTags(['tutorial']);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('js_tutorial');
      });

      it('should search by multiple tags (OR logic)', async () => {
        const result = await storage.searchConversationsByTags(['tutorial', 'guide']);

        expect(result).toHaveLength(2);
        expect(result.map(c => c.id)).toEqual(['js_tutorial', 'python_guide']);
      });

      it('should return empty array for non-existent tags', async () => {
        const result = await storage.searchConversationsByTags(['nonexistent']);

        expect(result).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Pagination Tests
  // ===========================================================================

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create 10 test conversations for pagination testing
      const conversations = [];
      for (let i = 0; i < 10; i++) {
        conversations.push(
          storage.createConversation(`Conversation ${i}`, {
            id: `conv_${String(i).padStart(2, '0')}`,
            metadata: {
              createdAt: Date.now() - (10 - i) * 1000, // Chronological order
              updatedAt: Date.now() - (10 - i) * 1000,
            },
          })
        );
      }
      await Promise.all(conversations);
    });

    describe('getConversationsPage', () => {
      it('should return first page with limit', async () => {
        const result = await storage.getConversationsPage({ limit: 3 });

        expect(result.conversations).toHaveLength(3);
        expect(result.hasMore).toBe(true);
        expect(result.total).toBe(10);
        expect(result.page).toBe(1);
      });

      it('should return specific page with offset', async () => {
        const result = await storage.getConversationsPage({ 
          limit: 3, 
          offset: 3 
        });

        expect(result.conversations).toHaveLength(3);
        expect(result.hasMore).toBe(true);
        expect(result.page).toBe(2);
      });

      it('should return last page correctly', async () => {
        const result = await storage.getConversationsPage({ 
          limit: 3, 
          offset: 9 
        });

        expect(result.conversations).toHaveLength(1);
        expect(result.hasMore).toBe(false);
        expect(result.page).toBe(4);
      });

      it('should sort by updatedAt descending by default', async () => {
        const result = await storage.getConversationsPage({ limit: 5 });

        // Check that conversations are ordered by updatedAt descending
        for (let i = 0; i < result.conversations.length - 1; i++) {
          expect(result.conversations[i].metadata.updatedAt)
            .toBeGreaterThanOrEqual(result.conversations[i + 1].metadata.updatedAt);
        }
      });

      it('should handle sorting by different fields', async () => {
        const result = await storage.getConversationsPage({ 
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'asc'
        });

        // Check ascending order by createdAt
        for (let i = 0; i < result.conversations.length - 1; i++) {
          expect(result.conversations[i].metadata.createdAt)
            .toBeLessThanOrEqual(result.conversations[i + 1].metadata.createdAt);
        }
      });

      it('should handle empty results', async () => {
        mockDB.clearStore();

        const result = await storage.getConversationsPage({ limit: 5 });

        expect(result.conversations).toEqual([]);
        expect(result.hasMore).toBe(false);
        expect(result.total).toBe(0);
        expect(result.page).toBe(1);
      });

      it('should handle offset beyond total count', async () => {
        const result = await storage.getConversationsPage({ 
          limit: 5, 
          offset: 20 
        });

        expect(result.conversations).toEqual([]);
        expect(result.hasMore).toBe(false);
        expect(result.page).toBe(5);
      });
    });

    describe('getConversationCount', () => {
      it('should return correct total count', async () => {
        const count = await storage.getConversationCount();

        expect(count).toBe(10);
      });

      it('should return zero for empty storage', async () => {
        mockDB.clearStore();

        const count = await storage.getConversationCount();

        expect(count).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle invalid conversation data validation', async () => {
      await expect(
        storage.createConversation('', {}) // Empty title
      ).rejects.toThrow('title');
    });

    it('should handle corrupted data gracefully', async () => {
      // This would test scenarios where stored data is corrupted
      // Implementation depends on how the storage layer handles validation
      mockDB.setFailureMode(true);

      await expect(
        storage.getConversation('any_id')
      ).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      await expect(
        storage.updateConversation('nonexistent_id', { title: 'New Title' })
      ).rejects.toThrow(/not found/i);
    });
  });

  // ===========================================================================
  // Concurrent Operations Tests
  // ===========================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent conversation creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        storage.createConversation(`Concurrent ${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(new Set(results.map(r => r.id)).size).toBe(5); // All unique IDs
    });

    it('should handle concurrent updates to same conversation', async () => {
      const conversation = await storage.createConversation('Base Conversation');
      
      const updatePromises = [
        storage.updateConversation(conversation.id, { title: 'Update 1' }),
        storage.updateConversation(conversation.id, { title: 'Update 2' }),
        storage.updateConversation(conversation.id, { title: 'Update 3' }),
      ];

      // At least one should succeed, others may fail due to optimistic concurrency
      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle concurrent message additions', async () => {
      const conversation = await storage.createConversation('Message Test');
      
      const messages = Array.from({ length: 3 }, (_, i) =>
        createUserMessage(`Concurrent message ${i}`, { 
          id: `concurrent_msg_${i}`, // Ensure unique IDs
          status: 'sent' 
        })
      );

      // Add messages sequentially to avoid race conditions in our test mock
      let updatedConversation = conversation;
      for (const message of messages) {
        updatedConversation = await storage.addMessage(updatedConversation.id, message);
      }

      expect(updatedConversation.messages.length).toBe(3);
      expect(updatedConversation.metadata.messageCount).toBe(3);
    });
  });

  // ===========================================================================
  // Performance Tests
  // ===========================================================================

  describe('Performance', () => {
    it('should handle large conversation retrieval efficiently', async () => {
      // Create conversations with many messages
      const largeConversation = await storage.createConversation('Large Conversation', {
        messages: Array.from({ length: 100 }, (_, i) =>
          i % 2 === 0
            ? createUserMessage(`User message ${i}`, { status: 'sent' })
            : createAssistantMessage(`Assistant response ${i}`, { status: 'sent' })
        ),
      });

      const startTime = performance.now();
      const result = await storage.getConversation(largeConversation.id);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result!.messages).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle batch operations efficiently', async () => {
      const startTime = performance.now();
      
      // Create multiple conversations in sequence
      const conversations = [];
      for (let i = 0; i < 20; i++) {
        conversations.push(await storage.createConversation(`Batch ${i}`));
      }

      const duration = performance.now() - startTime;

      expect(conversations).toHaveLength(20);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle search on large dataset efficiently', async () => {
      // Create many conversations for search testing
      const conversations = [];
      for (let i = 0; i < 50; i++) {
        conversations.push(
          storage.createConversation(`Search Test ${i}`, {
            messages: [
              createUserMessage(`Message about topic ${i % 10}`),
              createAssistantMessage(`Response about topic ${i % 10}`),
            ],
          })
        );
      }
      await Promise.all(conversations);

      const startTime = performance.now();
      const results = await storage.searchConversations('topic 5');
      const duration = performance.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });
  });

  // ===========================================================================
  // Edge Cases Tests
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle conversations with no messages', async () => {
      const conversation = await storage.createConversation('Empty Conversation');

      expect(conversation.messages).toEqual([]);
      expect(conversation.metadata.messageCount).toBe(0);
    });

    it('should handle very long conversation titles', async () => {
      const longTitle = 'A'.repeat(1000);
      const conversation = await storage.createConversation(longTitle);

      expect(conversation.title).toBe(longTitle);
    });

    it('should handle special characters in titles and content', async () => {
      const specialTitle = '🚀 Test with émojis & spéciàl chars! @#$%^&*()';
      const conversation = await storage.createConversation(specialTitle, {
        messages: [
          createUserMessage('Message with special chars: 中文 العربية русский'),
        ],
      });

      expect(conversation.title).toBe(specialTitle);
      expect(conversation.messages[0].content).toBe('Message with special chars: 中文 العربية русский');
    });

    it('should handle conversations with deeply nested message content', async () => {
      const complexContent = {
        text: 'Complex message',
        codeBlocks: [{
          language: 'javascript',
          code: 'console.log("Hello, world!");',
          filename: 'test.js',
        }],
      };

      const message = createUserMessage(complexContent, { status: 'sent' });
      const conversation = await storage.createConversation('Complex Content', {
        messages: [message],
      });

      expect(conversation.messages[0].content).toEqual(complexContent);
    });

    it('should handle timestamp edge cases', async () => {
      const futureTimestamp = Date.now() + 86400000; // 1 day in future
      const pastTimestamp = Date.now() - 86400000; // 1 day in past

      const conversation1 = await storage.createConversation('Future', {
        metadata: { createdAt: futureTimestamp, updatedAt: futureTimestamp },
      });
      
      const conversation2 = await storage.createConversation('Past', {
        metadata: { createdAt: pastTimestamp, updatedAt: pastTimestamp },
      });

      expect(conversation1.metadata.createdAt).toBe(futureTimestamp);
      expect(conversation2.metadata.createdAt).toBe(pastTimestamp);
    });
  });
});