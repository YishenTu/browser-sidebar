/**
 * @file Conversation Storage Implementation
 *
 * Comprehensive conversation persistence layer with CRUD operations, search functionality,
 * pagination, error handling, and concurrent operation safety.
 *
 * Features:
 * - CRUD operations for conversations using IndexedDB
 * - Text search across titles and message content
 * - Tag-based search with OR logic
 * - Pagination with customizable sorting
 * - Error handling with meaningful messages
 * - Safe concurrent operations
 * - Performance optimization for large datasets
 * - Metadata management and validation
 */

import type { IndexedDBWrapper } from './indexedDB';
import { dbInstance } from './indexedDB';
import { OBJECT_STORES } from './schema';
import {
  type ConversationData,
  type ConversationStorageCreate,
  type ConversationStorageUpdate,
  createStorageConversation,
  updateStorageConversation,
  validateConversationForStorage,
} from '../types/conversation';
import type { ChatMessage } from '../types/chat';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Search options for conversation queries
 */
export interface SearchOptions {
  /** Case insensitive search (default: true) */
  caseSensitive?: boolean;
  /** Include archived conversations (default: false) */
  includeArchived?: boolean;
  /** Limit results (default: no limit) */
  limit?: number;
  /** Sort field (default: 'updatedAt') */
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'messageCount';
  /** Sort order (default: 'desc') */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options for conversation retrieval
 */
export interface PaginationOptions {
  /** Number of conversations per page (default: 20) */
  limit?: number;
  /** Starting offset (default: 0) */
  offset?: number;
  /** Sort field (default: 'updatedAt') */
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'messageCount';
  /** Sort order (default: 'desc') */
  sortOrder?: 'asc' | 'desc';
  /** Include archived conversations (default: false) */
  includeArchived?: boolean;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of results for current page */
  conversations: T[];
  /** Whether there are more results available */
  hasMore: boolean;
  /** Total number of conversations (all pages) */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
}

/**
 * Date range for filtering conversations
 */
export interface DateRange {
  /** Start date (inclusive) */
  from: number;
  /** End date (inclusive) */
  to: number;
}

// =============================================================================
// ConversationStorage Class
// =============================================================================

export class ConversationStorage {
  private db: IndexedDBWrapper;

  constructor(dbWrapper?: IndexedDBWrapper) {
    this.db = dbWrapper || dbInstance;
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new conversation
   */
  async createConversation(
    title: string,
    data: ConversationStorageCreate = {}
  ): Promise<ConversationData> {
    // Validate input
    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new Error('Conversation title is required and cannot be empty');
    }

    try {
      // Create conversation with proper metadata
      const conversation = createStorageConversation(title.trim(), data);

      // Validate conversation structure
      const validation = validateConversationForStorage(conversation);
      if (!validation.isValid) {
        throw new Error(`Invalid conversation data: ${validation.errors.join(', ')}`);
      }

      // Attempt to save to database
      await this.db.add(OBJECT_STORES.CONVERSATIONS, conversation);

      return conversation;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          throw new Error(`Conversation with id ${data.id} already exists`);
        }
        throw error;
      }
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(id: string): Promise<ConversationData | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid conversation ID is required');
    }

    try {
      const conversation = await this.db.get<ConversationData>(
        OBJECT_STORES.CONVERSATIONS,
        id
      );

      return conversation;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve conversation: ${error.message}`);
      }
      throw new Error('Failed to retrieve conversation');
    }
  }

  /**
   * Update an existing conversation
   */
  async updateConversation(
    id: string,
    updates: ConversationStorageUpdate
  ): Promise<ConversationData> {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid conversation ID is required');
    }

    try {
      // Get existing conversation
      const existing = await this.getConversation(id);
      if (!existing) {
        throw new Error(`Conversation with id ${id} not found`);
      }

      // Apply updates
      const updated = updateStorageConversation(existing, updates);

      // Validate updated conversation
      const validation = validateConversationForStorage(updated);
      if (!validation.isValid) {
        throw new Error(`Invalid update data: ${validation.errors.join(', ')}`);
      }

      // Save updated conversation
      await this.db.update(OBJECT_STORES.CONVERSATIONS, id, updated);

      return updated;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update conversation');
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid conversation ID is required');
    }

    try {
      // Verify conversation exists
      const existing = await this.getConversation(id);
      if (!existing) {
        throw new Error(`Conversation with id ${id} not found`);
      }

      // Delete from database
      await this.db.delete(OBJECT_STORES.CONVERSATIONS, id);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete conversation');
    }
  }

  /**
   * Get all conversations
   */
  async getAllConversations(): Promise<ConversationData[]> {
    try {
      const conversations = await this.db.getAll<ConversationData>(
        OBJECT_STORES.CONVERSATIONS
      );

      return conversations || [];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve conversations: ${error.message}`);
      }
      throw new Error('Failed to retrieve conversations');
    }
  }

  /**
   * Add a message to an existing conversation
   */
  async addMessage(
    conversationId: string,
    message: ChatMessage
  ): Promise<ConversationData> {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('Valid conversation ID is required');
    }

    if (!message || typeof message !== 'object') {
      throw new Error('Valid message object is required');
    }

    try {
      // Get existing conversation
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation with id ${conversationId} not found`);
      }

      // Check for duplicate message ID
      if (conversation.messages.some(m => m.id === message.id)) {
        throw new Error(`Message with id ${message.id} already exists in conversation`);
      }

      // Add message and update metadata
      const updatedConversation = {
        ...conversation,
        messages: [...conversation.messages, message],
        metadata: {
          ...conversation.metadata,
          messageCount: conversation.messages.length + 1,
          updatedAt: Math.max(Date.now(), conversation.metadata.updatedAt + 1),
        },
      };

      // Save updated conversation
      await this.db.update(OBJECT_STORES.CONVERSATIONS, conversationId, updatedConversation);

      return updatedConversation;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to add message to conversation');
    }
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Search conversations by text across titles and message content
   */
  async searchConversations(
    query: string,
    options: SearchOptions = {}
  ): Promise<ConversationData[]> {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return [];
    }

    const {
      caseSensitive = false,
      includeArchived = false,
      limit,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    try {
      // Get all conversations
      const allConversations = await this.getAllConversations();

      // Prepare search term
      const searchTerm = caseSensitive ? query.trim() : query.trim().toLowerCase();

      // Filter conversations
      let filteredConversations = allConversations.filter(conversation => {
        // Skip archived if not included
        if (!includeArchived && conversation.metadata.archived) {
          return false;
        }

        // Check title
        const title = caseSensitive ? conversation.title : conversation.title.toLowerCase();
        if (title.includes(searchTerm)) {
          return true;
        }

        // Check message content
        return conversation.messages.some(message => {
          const content = typeof message.content === 'string' 
            ? message.content 
            : typeof message.content === 'object' && 'text' in message.content
              ? message.content.text
              : JSON.stringify(message.content);

          const searchableContent = caseSensitive ? content : content.toLowerCase();
          return searchableContent.includes(searchTerm);
        });
      });

      // Sort results
      filteredConversations = this.sortConversations(filteredConversations, sortBy, sortOrder);

      // Apply limit if specified
      if (limit && limit > 0) {
        filteredConversations = filteredConversations.slice(0, limit);
      }

      return filteredConversations;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search conversations: ${error.message}`);
      }
      throw new Error('Failed to search conversations');
    }
  }

  /**
   * Search conversations by tags
   */
  async searchConversationsByTags(
    tags: string[],
    options: SearchOptions = {}
  ): Promise<ConversationData[]> {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return [];
    }

    const {
      caseSensitive = false,
      includeArchived = false,
      limit,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    try {
      // Get all conversations
      const allConversations = await this.getAllConversations();

      // Prepare search tags
      const searchTags = caseSensitive 
        ? tags.map(tag => tag.trim())
        : tags.map(tag => tag.trim().toLowerCase());

      // Filter conversations by tags (OR logic)
      let filteredConversations = allConversations.filter(conversation => {
        // Skip archived if not included
        if (!includeArchived && conversation.metadata.archived) {
          return false;
        }

        // Check if conversation has any matching tags
        const conversationTags = conversation.metadata.tags || [];
        const compareTags = caseSensitive 
          ? conversationTags 
          : conversationTags.map(tag => tag.toLowerCase());

        return searchTags.some(searchTag => compareTags.includes(searchTag));
      });

      // Sort results
      filteredConversations = this.sortConversations(filteredConversations, sortBy, sortOrder);

      // Apply limit if specified
      if (limit && limit > 0) {
        filteredConversations = filteredConversations.slice(0, limit);
      }

      return filteredConversations;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search conversations by tags: ${error.message}`);
      }
      throw new Error('Failed to search conversations by tags');
    }
  }

  // ===========================================================================
  // Date Range Operations
  // ===========================================================================

  /**
   * Get conversations within a date range
   */
  async getConversationsByDateRange(
    from: number,
    to: number,
    options: SearchOptions = {}
  ): Promise<ConversationData[]> {
    if (!from || !to || typeof from !== 'number' || typeof to !== 'number') {
      throw new Error('Valid from and to timestamps are required');
    }

    if (from > to) {
      throw new Error('From date must be before or equal to to date');
    }

    try {
      // Use IndexedDB range query if available, otherwise filter in memory
      const conversations = await this.db.queryRange<ConversationData>(
        OBJECT_STORES.CONVERSATIONS,
        'timestamp', // Using the timestamp index
        from,
        to
      );

      // Additional filtering and sorting
      const {
        includeArchived = false,
        limit,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = options;

      let filteredConversations = conversations.filter(conversation => {
        // Skip archived if not included
        if (!includeArchived && conversation.metadata.archived) {
          return false;
        }
        return true;
      });

      // Sort results (IndexedDB query already returns them in order)
      filteredConversations = this.sortConversations(filteredConversations, sortBy, sortOrder);

      // Apply limit if specified
      if (limit && limit > 0) {
        filteredConversations = filteredConversations.slice(0, limit);
      }

      return filteredConversations;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get conversations by date range: ${error.message}`);
      }
      throw new Error('Failed to get conversations by date range');
    }
  }

  // ===========================================================================
  // Pagination Operations
  // ===========================================================================

  /**
   * Get a paginated list of conversations
   */
  async getConversationsPage(
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ConversationData>> {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      includeArchived = false,
    } = options;

    try {
      // Get total count for pagination info
      const totalCount = await this.getConversationCount(includeArchived);
      
      // Get all conversations (in a real implementation, this would be optimized)
      const allConversations = await this.getAllConversations();

      // Filter archived conversations if needed
      let filteredConversations = includeArchived 
        ? allConversations 
        : allConversations.filter(conv => !conv.metadata.archived);

      // Sort conversations
      filteredConversations = this.sortConversations(filteredConversations, sortBy, sortOrder);

      // Apply pagination
      const paginatedConversations = filteredConversations.slice(offset, offset + limit);

      // Calculate pagination info
      const page = Math.floor(offset / limit) + 1;
      const hasMore = offset + limit < filteredConversations.length;

      return {
        conversations: paginatedConversations,
        hasMore,
        total: totalCount,
        page,
        limit,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get conversations page: ${error.message}`);
      }
      throw new Error('Failed to get conversations page');
    }
  }

  /**
   * Get total count of conversations
   */
  async getConversationCount(includeArchived: boolean = false): Promise<number> {
    try {
      const conversations = await this.getAllConversations();
      
      if (includeArchived) {
        return conversations.length;
      }
      
      return conversations.filter(conv => !conv.metadata.archived).length;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get conversation count: ${error.message}`);
      }
      throw new Error('Failed to get conversation count');
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Sort conversations by specified field and order
   */
  private sortConversations(
    conversations: ConversationData[],
    sortBy: 'createdAt' | 'updatedAt' | 'title' | 'messageCount',
    sortOrder: 'asc' | 'desc'
  ): ConversationData[] {
    return conversations.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'createdAt':
          comparison = a.metadata.createdAt - b.metadata.createdAt;
          break;
        case 'updatedAt':
          comparison = a.metadata.updatedAt - b.metadata.updatedAt;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'messageCount':
          comparison = a.metadata.messageCount - b.metadata.messageCount;
          break;
        default:
          comparison = a.metadata.updatedAt - b.metadata.updatedAt;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // ===========================================================================
  // Bulk Operations (for performance)
  // ===========================================================================

  /**
   * Create multiple conversations in a batch
   */
  async createConversationsBatch(
    conversations: Array<{ title: string; data?: ConversationStorageCreate }>
  ): Promise<ConversationData[]> {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return [];
    }

    try {
      // Create conversation objects
      const conversationData = conversations.map(({ title, data = {} }) => {
        if (!title || typeof title !== 'string' || title.trim() === '') {
          throw new Error('All conversations must have valid titles');
        }
        return createStorageConversation(title.trim(), data);
      });

      // Validate all conversations
      for (const conv of conversationData) {
        const validation = validateConversationForStorage(conv);
        if (!validation.isValid) {
          throw new Error(`Invalid conversation data: ${validation.errors.join(', ')}`);
        }
      }

      // Batch add to database
      await this.db.batchAdd(OBJECT_STORES.CONVERSATIONS, conversationData);

      return conversationData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create conversations batch');
    }
  }

  /**
   * Delete multiple conversations in a batch
   */
  async deleteConversationsBatch(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return;
    }

    // Validate all IDs
    for (const id of ids) {
      if (!id || typeof id !== 'string') {
        throw new Error('All conversation IDs must be valid strings');
      }
    }

    try {
      // Verify all conversations exist
      for (const id of ids) {
        const existing = await this.getConversation(id);
        if (!existing) {
          throw new Error(`Conversation with id ${id} not found`);
        }
      }

      // Batch delete from database
      await this.db.batchDelete(OBJECT_STORES.CONVERSATIONS, ids);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete conversations batch');
    }
  }

  // ===========================================================================
  // Archive Operations
  // ===========================================================================

  /**
   * Archive a conversation
   */
  async archiveConversation(id: string): Promise<ConversationData> {
    return this.updateConversation(id, {
      metadata: { archived: true, lastActivity: Date.now() },
    });
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(id: string): Promise<ConversationData> {
    return this.updateConversation(id, {
      metadata: { archived: false, lastActivity: Date.now() },
    });
  }

  /**
   * Get all archived conversations
   */
  async getArchivedConversations(): Promise<ConversationData[]> {
    const allConversations = await this.getAllConversations();
    return allConversations.filter(conv => conv.metadata.archived === true);
  }
}

// =============================================================================
// Export Default Instance
// =============================================================================

export const conversationStorage = new ConversationStorage();
export default conversationStorage;