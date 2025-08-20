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
} from '../types/messages.js';

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
        console.warn('Invalid message format received:', message);
        this.sendErrorResponse(sendResponse, 'Invalid message format', 'INVALID_MESSAGE');
        return false;
      }

      // Check if handler exists
      const handlerRegistration = this.handlers.get(message.type);
      if (!handlerRegistration) {
        console.warn('No handler registered for message type:', message.type);
        this.sendErrorResponse(sendResponse, `No handler for message type: ${message.type}`, 'NO_HANDLER');
        return false;
      }

      console.log(`Handling message type: ${message.type}`, { message, sender });

      // Execute handler
      const result = await handlerRegistration.handler(message, sender);

      // Send response
      sendResponse(result);
      return true;

    } catch (error) {
      console.error('Error handling message:', error, { message, sender });
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
    sender: chrome.runtime.MessageSender
  ): Promise<Message<void>> {
    console.log('PING received from:', sender.tab?.id || sender.id);
    
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
    message: Message<ErrorPayload>,
    sender: chrome.runtime.MessageSender
  ): Promise<void> {
    console.error('Error message received:', message.payload, 'from:', sender);
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

  return registry;
}