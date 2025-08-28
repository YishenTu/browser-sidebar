/* eslint-disable no-console */
/**
 * @file Message Handler
 *
 * Provides a centralized message handling system for the background service worker.
 * Routes messages to appropriate handlers and manages error handling.
 */

import {
  Message,
  MessageType,
  isValidMessage,
  createMessage,
  ErrorPayload,
  GetTabIdPayload,
  GetAllTabsResponsePayload,
  ExtractTabPayload,
  ExtractTabContentResponsePayload,
  CleanupTabCachePayload,
} from '@/types/messages';
import { TabManager } from './tabManager';

/**
 * Type for message handler functions
 */
export type MessageHandler<T = unknown, R = unknown> = (
  message: Message<T>,
  sender: chrome.runtime.MessageSender
) => Promise<R> | R;

/**
 * Interface for handler registration
 */
export interface HandlerRegistration<T = unknown, R = unknown> {
  handler: MessageHandler<T, R>;
  description?: string;
}

/**
 * Central message handler that routes messages to appropriate handlers
 */
export class MessageHandlerRegistry {
  private handlers = new Map<MessageType, HandlerRegistration>();

  /**
   * Register a handler for a specific message type
   *
   * @param type - Message type to handle
   * @param handler - Handler function
   * @param description - Optional description for debugging
   */
  registerHandler<T = unknown, R = unknown>(
    type: MessageType,
    handler: MessageHandler<T, R>,
    description?: string
  ): void {
    this.handlers.set(type, { handler: handler as MessageHandler, description });
  }

  /**
   * Unregister a handler for a specific message type
   *
   * @param type - Message type to unregister
   */
  unregisterHandler(type: MessageType): boolean {
    return this.handlers.delete(type);
  }

  /**
   * Get all registered message types
   *
   * @returns Array of registered message types
   */
  getRegisteredTypes(): MessageType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a handler is registered for a message type
   *
   * @param type - Message type to check
   * @returns True if handler is registered
   */
  hasHandler(type: MessageType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Handle an incoming message by routing to appropriate handler
   *
   * @param message - The incoming message
   * @param sender - Message sender information
   * @param sendResponse - Response callback
   * @returns True if message was handled asynchronously
   */
  async handleMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): Promise<boolean> {
    try {
      // Validate message format
      if (!isValidMessage(message)) {
        this.sendErrorResponse(sendResponse, 'Invalid message format', 'INVALID_MESSAGE');
        return false;
      }

      // Check if handler exists
      const handlerRegistration = this.handlers.get(message.type);
      if (!handlerRegistration) {
        this.sendErrorResponse(
          sendResponse,
          `No handler for message type: ${message.type}`,
          'NO_HANDLER'
        );
        return false;
      }


      // Execute handler
      const result = await handlerRegistration.handler(message, sender);

      // Send response
      sendResponse(result);
      return true;
    } catch (error) {
      this.sendErrorResponse(
        sendResponse,
        error instanceof Error ? error.message : String(error),
        'HANDLER_ERROR',
        { originalMessage: message, error: String(error) }
      );
      return false;
    }
  }

  /**
   * Send a standardized error response
   *
   * @param sendResponse - Response callback
   * @param message - Error message
   * @param code - Error code
   * @param details - Additional error details
   */
  private sendErrorResponse(
    sendResponse: (response?: unknown) => void,
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): void {
    const errorMessage = createMessage<ErrorPayload>({
      type: 'ERROR',
      payload: {
        message,
        code,
        details,
      },
      source: 'background',
      target: 'content', // Default target, could be dynamic
    });

    sendResponse(errorMessage);
  }
}

/**
 * Default message handlers for core functionality
 */
export class DefaultHandlers {
  /**
   * Handler for PING messages - responds with PONG
   */
  static async handlePing(
    message: Message<void>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<void>> {

    return createMessage<void>({
      type: 'PONG',
      source: 'background',
      target: message.source,
    });
  }

  /**
   * Handler for error messages - logs the error
   */
  static async handleError(
    _message: Message<ErrorPayload>,
    _sender: chrome.runtime.MessageSender
  ): Promise<void> {
    // Error logging handled elsewhere
  }

  /**
   * Handler for content script readiness notification
   */
  static async handleContentReady(
    message: Message<unknown>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<unknown>> {
    // Echo back an acknowledgement using the same payload
    return createMessage({
      type: 'CONTENT_READY',
      payload: message.payload,
      source: 'background',
      target: message.source,
    });
  }

  /**
   * Handler for sidebar state notifications (opened/closed)
   */
  static async handleSidebarState(
    message: Message<unknown>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<unknown>> {
    return createMessage({
      type: 'SIDEBAR_STATE',
      payload: message.payload,
      source: 'background',
      target: message.source,
    });
  }

  /**
   * Handler for tab ID requests - returns the sender's tab ID
   */
  static async handleGetTabId(
    message: Message<void>,
    sender: chrome.runtime.MessageSender
  ): Promise<Message<GetTabIdPayload>> {

    // Ensure sender has a tab ID
    if (!sender.tab?.id) {
      throw new Error('Unable to determine tab ID from sender');
    }

    return createMessage<GetTabIdPayload>({
      type: 'GET_TAB_ID',
      payload: {
        tabId: sender.tab.id,
      },
      source: 'background',
      target: message.source,
    });
  }

  /**
   * Handler for GET_ALL_TABS requests - returns all accessible tabs
   */
  static async handleGetAllTabs(
    message: Message<void>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<GetAllTabsResponsePayload>> {

    try {
      // Get TabManager instance
      const tabManager = TabManager.getInstance();
      
      // Get all accessible tabs
      const tabs = await tabManager.getAllTabs();
      
      // Sort by lastAccessed (most recent first)
      const sortedTabs = tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);


      return createMessage<GetAllTabsResponsePayload>({
        type: 'GET_ALL_TABS',
        payload: {
          tabs: sortedTabs,
        },
        source: 'background',
        target: message.source,
      });
    } catch (error) {
      throw new Error(`Failed to get all tabs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handler for EXTRACT_TAB_CONTENT requests - extracts content from a specific tab
   */
  static async handleExtractTabContent(
    message: Message<ExtractTabPayload>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<ExtractTabContentResponsePayload>> {

    if (!message.payload || typeof message.payload.tabId !== 'number') {
      throw new Error('Invalid EXTRACT_TAB_CONTENT payload: tabId is required');
    }

    const { tabId, options } = message.payload;
    
    try {
      // Get TabManager instance
      const tabManager = TabManager.getInstance();

      // Set timeout to 5 seconds as per requirements, or use provided timeout
      const extractionOptions = {
        ...options,
        timeout: options?.timeout || 5000, // 5-second timeout as per requirements
      };


      // Use TabManager's extractTabContent method which handles cache checking and updating
      const content = await tabManager.extractTabContent(tabId, extractionOptions);

      if (!content) {
        // TabManager returns null for various failure cases (tab closed, restricted URL, etc.)
        throw new Error(`Failed to extract content from tab ${tabId}: tab may be closed, restricted, or content script unavailable`);
      }


      return createMessage<ExtractTabContentResponsePayload>({
        type: 'EXTRACT_TAB_CONTENT',
        payload: {
          content,
          tabId,
        },
        source: 'background',
        target: message.source,
      });
    } catch (error) {

      // Provide descriptive error messages based on common failure scenarios
      let errorMessage = `Failed to extract content from tab ${tabId}`;

      if (error instanceof Error) {
        const msg = error.message || '';
        if (msg.includes('Could not establish connection') || msg.includes('Receiving end does not exist')) {
          errorMessage = `Tab ${tabId} does not have a content script available or is not accessible`;
        } else if (msg.includes('restricted URL') || msg.includes('Cannot extract from restricted URL')) {
          // Only classify as restricted when we have a clear restricted URL signal
          errorMessage = `Tab ${tabId} contains a restricted URL that cannot be accessed`;
        } else if (msg.includes('timeout') || msg.includes('timed out')) {
          errorMessage = `Content extraction from tab ${tabId} timed out after ${options?.timeout || 5000}ms`;
        } else {
          errorMessage = `${errorMessage}: ${msg}`;
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Handler for CLEANUP_TAB_CACHE requests - clears cache for specified tabs
   */
  static async handleCleanupTabCache(
    message: Message<CleanupTabCachePayload>,
    _sender: chrome.runtime.MessageSender
  ): Promise<Message<void>> {

    if (!message.payload) {
      throw new Error('Invalid CLEANUP_TAB_CACHE payload: payload is required');
    }

    const { tabIds } = message.payload;

    try {
      // Get TabManager instance
      const tabManager = TabManager.getInstance();
      const cache = tabManager.getTabContentCache();

      if (tabIds.length === 0) {
        // Clear all cache if no specific tab IDs provided
        await cache.clear();
      } else {
        // Clear specific tab IDs
        for (const tabId of tabIds) {
          await cache.clear(tabId);
        }
      }


      return createMessage<void>({
        type: 'CLEANUP_TAB_CACHE',
        source: 'background',
        target: message.source,
      });
    } catch (error) {
      throw new Error(`Failed to cleanup tab cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Create and configure the default message handler registry
 *
 * @returns Configured MessageHandlerRegistry instance
 */
export function createDefaultMessageHandler(): MessageHandlerRegistry {
  const registry = new MessageHandlerRegistry();

  // Register default handlers
  registry.registerHandler('PING', DefaultHandlers.handlePing, 'Health check ping/pong');
  registry.registerHandler('ERROR', DefaultHandlers.handleError, 'Error message logging');
  registry.registerHandler(
    'CONTENT_READY',
    DefaultHandlers.handleContentReady,
    'Content script ready ack'
  );
  registry.registerHandler(
    'SIDEBAR_STATE',
    DefaultHandlers.handleSidebarState,
    'Sidebar state ack'
  );
  registry.registerHandler('GET_TAB_ID', DefaultHandlers.handleGetTabId, 'Return sender tab ID');
  registry.registerHandler('GET_ALL_TABS', DefaultHandlers.handleGetAllTabs, 'Return all accessible tabs');
  registry.registerHandler('EXTRACT_TAB_CONTENT', DefaultHandlers.handleExtractTabContent, 'Extract content from specific tab with cache and timeout handling');
  registry.registerHandler('CLEANUP_TAB_CACHE', DefaultHandlers.handleCleanupTabCache, 'Clear cached content for specified tabs');

  return registry;
}
/* eslint-disable no-console */
