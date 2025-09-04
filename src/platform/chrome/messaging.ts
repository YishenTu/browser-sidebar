/**
 * @file Chrome Platform Messaging Wrapper
 *
 * Provides a unified MessageBus interface with Chrome-specific implementations
 * for cross-context communication, request/response patterns, broadcasting,
 * and typed event emitters.
 */

import {
  Message,
  MessageType,
  MessageSource,
  TypedMessage,
  isValidMessage,
  isMessageOfType,
} from '../../types/messages';
import {
  MessageBus,
  MessageListener,
  UnsubscribeFunction,
  SendOptions,
  getMessageBus,
  ping,
} from '../../extension/messaging';
import {
  StandardResponse,
  createErrorResponse,
  ErrorResponse,
} from '../../extension/messaging/responses';
import { ExtensionError, ErrorCode } from '../../extension/messaging/errors';

/**
 * Request/Response pattern timeout configuration
 */
export interface RequestOptions extends SendOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retry attempts (default: 2) */
  retries?: number;
  /** Request ID for tracking (auto-generated if not provided) */
  requestId?: string;
}

/**
 * Event emitter subscription options
 */
export interface EventSubscriptionOptions {
  /** Only handle events from specific sources */
  sourceFilter?: MessageSource[];
  /** Only handle events with specific targets */
  targetFilter?: MessageSource[];
  /** Auto-unsubscribe after first match */
  once?: boolean;
}

/**
 * Broadcasting options for multi-target messaging
 */
export interface BroadcastOptions {
  /** Target contexts to broadcast to */
  targets: MessageSource[];
  /** Timeout for each target (default: 5000ms) */
  timeout?: number;
  /** Continue broadcasting even if some targets fail */
  continueOnError?: boolean;
}

/**
 * Request tracking for response correlation
 */
interface PendingRequest<T = unknown> {
  requestId: string;
  resolve: (response: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  timestamp: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (
  data: T,
  context: {
    source: MessageSource;
    target: MessageSource;
    timestamp: number;
  }
) => void | Promise<void>;

/**
 * Unified Chrome messaging wrapper with advanced patterns
 */
export class ChromeMessageBus {
  private static instance: ChromeMessageBus | null = null;
  private messageBus: MessageBus;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventSubscriptions = new Map<string, UnsubscribeFunction>();
  private requestCounter = 0;

  private constructor(private source: MessageSource) {
    this.messageBus = getMessageBus(source);
    this.setupResponseHandler();
  }

  /**
   * Gets or creates the singleton ChromeMessageBus instance
   */
  static getInstance(source?: MessageSource): ChromeMessageBus {
    if (!ChromeMessageBus.instance) {
      if (!source) {
        throw new ExtensionError(
          'ChromeMessageBus must be initialized with a source on first call',
          ErrorCode.CONFIGURATION_ERROR
        );
      }
      ChromeMessageBus.instance = new ChromeMessageBus(source);
    }
    return ChromeMessageBus.instance;
  }

  /**
   * Resets the singleton instance (primarily for testing)
   */
  static reset(): void {
    if (ChromeMessageBus.instance) {
      ChromeMessageBus.instance.destroy();
    }
    ChromeMessageBus.instance = null;
  }

  /**
   * Sends a basic message with optional response
   */
  async send<T = unknown, R = unknown>(
    type: MessageType,
    payload?: T,
    options: SendOptions = {}
  ): Promise<StandardResponse<R>> {
    return this.messageBus.send<T, R>(type, payload, options);
  }

  /**
   * Sends a message with retry logic
   */
  async sendWithRetry<T = unknown, R = unknown>(
    type: MessageType,
    payload?: T,
    options: SendOptions = {}
  ): Promise<StandardResponse<R>> {
    return this.messageBus.sendWithRetry<T, R>(type, payload, options);
  }

  /**
   * Request/Response pattern with correlation IDs
   */
  async request<T = unknown, R = unknown>(
    type: MessageType,
    payload?: T,
    options: RequestOptions = {}
  ): Promise<R> {
    const requestId = options.requestId || this.generateRequestId();
    const timeout = options.timeout || 10000;
    const retries = options.retries || 2;

    // Create enhanced payload with request ID
    const requestPayload = {
      ...payload,
      _requestId: requestId,
      _isRequest: true,
    } as T & { _requestId: string; _isRequest: boolean };

    return new Promise<R>((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new ExtensionError(`Request timeout after ${timeout}ms`, ErrorCode.MESSAGE_TIMEOUT, {
            requestId,
            type,
          })
        );
      }, timeout);

      // Track pending request
      this.pendingRequests.set(requestId, {
        requestId,
        resolve: resolve as (response: unknown) => void,
        reject,
        timeout: timeoutHandle,
        timestamp: Date.now(),
      });

      // Send request with retry logic
      this.messageBus
        .sendWithRetry<typeof requestPayload, R>(type, requestPayload, {
          ...options,
          retries,
        })
        .then(response => {
          if (response.success && response.data !== undefined) {
            // Response will be handled by the response handler
            return;
          } else {
            this.pendingRequests.delete(requestId);
            clearTimeout(timeoutHandle);
            let errorMessage = 'Request failed';
            let errorCode: ErrorCode = ErrorCode.MESSAGE_SEND_FAILED;

            if (!response.success) {
              const errorResponse = response as ErrorResponse;
              errorMessage = errorResponse.error.message;
              errorCode = errorResponse.error.code;
            }

            reject(new ExtensionError(errorMessage, errorCode, { requestId, type }));
          }
        })
        .catch(error => {
          this.pendingRequests.delete(requestId);
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  /**
   * Responds to a request message
   */
  async respond<T = unknown>(requestMessage: Message, responseData: T): Promise<void> {
    const requestPayload = requestMessage.payload as Record<string, unknown>;
    if (!requestPayload?.['_requestId'] || !requestPayload?.['_isRequest']) {
      throw new ExtensionError(
        'Cannot respond to non-request message',
        ErrorCode.MESSAGE_VALIDATION_FAILED
      );
    }

    const responseType = `${requestMessage.type}_RESPONSE` as MessageType;
    const responsePayload = {
      ...responseData,
      _requestId: requestPayload['_requestId'],
      _isResponse: true,
    };

    await this.messageBus.send(responseType, responsePayload, {
      target: requestMessage.source,
      tabId: requestMessage.source === 'content' ? undefined : undefined, // Tab ID handling
    });
  }

  /**
   * Broadcasts a message to multiple targets
   */
  async broadcast<T = unknown>(
    type: MessageType,
    payload: T,
    options: BroadcastOptions
  ): Promise<StandardResponse<unknown>[]> {
    const { targets, timeout = 5000, continueOnError = true } = options;
    const promises = targets.map(target =>
      this.messageBus
        .send(type, payload, { target, timeout })
        .catch(error => (continueOnError ? createErrorResponse(error) : Promise.reject(error)))
    );

    if (continueOnError) {
      return Promise.all(promises);
    } else {
      // Fail fast if any broadcast fails
      const results = await Promise.allSettled(promises);
      const responses: StandardResponse<unknown>[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled') {
          responses.push(result.value);
        } else {
          throw result.reason;
        }
      }

      return responses;
    }
  }

  /**
   * Subscribe to messages with filtering and advanced options
   */
  subscribe<T = unknown>(
    type: MessageType,
    listener: MessageListener<T>,
    options: EventSubscriptionOptions = {}
  ): UnsubscribeFunction {
    const { sourceFilter, targetFilter, once = false } = options;
    const subscriptionId = this.generateSubscriptionId();

    // Wrap listener with filtering logic
    const filteredListener: MessageListener<T> = (message, sender, sendResponse) => {
      // Apply source filter
      if (sourceFilter && !sourceFilter.includes(message.source)) {
        return;
      }

      // Apply target filter
      if (targetFilter && !targetFilter.includes(message.target)) {
        return;
      }

      // Handle one-time subscription
      if (once) {
        const unsub = this.eventSubscriptions.get(subscriptionId);
        if (unsub) {
          unsub();
          this.eventSubscriptions.delete(subscriptionId);
        }
      }

      return listener(message, sender, sendResponse);
    };

    const unsubscribe = this.messageBus.subscribe(type, filteredListener);
    this.eventSubscriptions.set(subscriptionId, unsubscribe);

    return () => {
      unsubscribe();
      this.eventSubscriptions.delete(subscriptionId);
    };
  }

  /**
   * Type-safe event emitter pattern
   */
  emit<T extends TypedMessage>(message: T): Promise<StandardResponse<unknown>> {
    return this.messageBus.send(message.type, message.payload, {
      target: message.target,
    });
  }

  /**
   * Subscribe to typed events with data extraction
   */
  on<T = unknown>(
    type: MessageType,
    handler: EventHandler<T>,
    options: EventSubscriptionOptions = {}
  ): UnsubscribeFunction {
    return this.subscribe<T>(
      type,
      message => {
        handler(message.payload as T, {
          source: message.source,
          target: message.target,
          timestamp: message.timestamp,
        });
      },
      options
    );
  }

  /**
   * One-time event subscription
   */
  once<T = unknown>(
    type: MessageType,
    handler: EventHandler<T>,
    options: Omit<EventSubscriptionOptions, 'once'> = {}
  ): UnsubscribeFunction {
    return this.on<T>(type, handler, { ...options, once: true });
  }

  /**
   * Message validation with detailed error reporting
   */
  validateMessage<T extends Message>(message: unknown): message is T {
    if (!isValidMessage(message)) {
      return false;
    }

    // Additional Chrome-specific validation could be added here
    return true;
  }

  /**
   * Type-safe message type checking
   */
  isMessageType<T extends MessageType>(
    message: Message,
    type: T
  ): message is Message & { type: T } {
    return isMessageOfType(message, type);
  }

  /**
   * Check connectivity to other contexts
   */
  async healthCheck(targets?: MessageSource[]): Promise<Record<MessageSource, boolean>> {
    const targetsToCheck =
      targets ||
      (['background', 'content', 'sidebar'] as MessageSource[]).filter(t => t !== this.source);

    const results: Record<MessageSource, boolean> = {} as Record<MessageSource, boolean>;

    await Promise.all(
      targetsToCheck.map(async target => {
        try {
          results[target] = await ping(target);
        } catch {
          results[target] = false;
        }
      })
    );

    return results;
  }

  /**
   * Get statistics about message bus usage
   */
  getStats(): {
    pendingRequests: number;
    activeSubscriptions: number;
    source: MessageSource;
    uptime: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      activeSubscriptions: this.eventSubscriptions.size,
      source: this.source,
      uptime: Date.now() - ((this as { startTime?: number }).startTime || 0) || Date.now(),
    };
  }

  /**
   * Clean up expired requests and subscriptions
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    const expiredRequests: string[] = [];

    // Collect expired request IDs
    this.pendingRequests.forEach((request, requestId) => {
      if (now - request.timestamp > maxAge) {
        expiredRequests.push(requestId);
      }
    });

    // Clean up expired requests
    expiredRequests.forEach(requestId => {
      const request = this.pendingRequests.get(requestId);
      if (request) {
        clearTimeout(request.timeout);
        request.reject(
          new ExtensionError('Request expired during cleanup', ErrorCode.MESSAGE_TIMEOUT, {
            requestId,
            maxAge,
          })
        );
        this.pendingRequests.delete(requestId);
      }
    });
  }

  /**
   * Destroy the message bus and clean up resources
   */
  destroy(): void {
    // Clear all pending requests
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new ExtensionError('MessageBus destroyed', ErrorCode.CONFIGURATION_ERROR));
    });
    this.pendingRequests.clear();

    // Unsubscribe from all events
    this.eventSubscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    this.eventSubscriptions.clear();

    // Destroy underlying MessageBus
    this.messageBus.destroy();
  }

  /**
   * Set up response message handler for request/response pattern
   */
  private setupResponseHandler(): void {
    // Subscribe to all message types that could be responses
    chrome.runtime.onMessage.addListener((message: unknown, _sender, _sendResponse) => {
      if (!this.validateMessage(message)) {
        return false;
      }

      const typedMessage = message as Message;
      const payload = typedMessage.payload as Record<string, unknown>;

      // Check if this is a response to a pending request
      if (
        payload?.['_isResponse'] &&
        payload?.['_requestId'] &&
        typeof payload['_requestId'] === 'string'
      ) {
        const pendingRequest = this.pendingRequests.get(payload['_requestId'] as string);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(payload['_requestId'] as string);

          // Remove response metadata and resolve with clean data
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _requestId, _isResponse, ...responseData } = payload;
          pendingRequest.resolve(responseData);
          return true;
        }
      }

      return false; // Let other listeners handle non-response messages
    });

    // Track start time for uptime calculation
    (this as unknown as { startTime: number }).startTime = Date.now();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${this.source}_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Convenience exports and factory functions

/**
 * Create or get the Chrome MessageBus instance
 */
export function getChromeMessageBus(source?: MessageSource): ChromeMessageBus {
  return ChromeMessageBus.getInstance(source);
}

/**
 * Initialize the Chrome messaging system for a specific context
 */
export function initializeChromeMessaging(source: MessageSource): ChromeMessageBus {
  return ChromeMessageBus.getInstance(source);
}

/**
 * Send a message with Chrome-specific optimizations
 */
export async function sendChromeMessage<T = unknown, R = unknown>(
  type: MessageType,
  payload?: T,
  options: SendOptions = {}
): Promise<StandardResponse<R>> {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.sendWithRetry<T, R>(type, payload, options);
}

/**
 * Request/response pattern helper
 */
export async function requestResponse<T = unknown, R = unknown>(
  type: MessageType,
  payload?: T,
  options: RequestOptions = {}
): Promise<R> {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.request<T, R>(type, payload, options);
}

/**
 * Broadcast to multiple targets
 */
export async function broadcastMessage<T = unknown>(
  type: MessageType,
  payload: T,
  targets: MessageSource[],
  options: Omit<BroadcastOptions, 'targets'> = {}
): Promise<StandardResponse<unknown>[]> {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.broadcast(type, payload, { targets, ...options });
}

/**
 * Type-safe event subscription
 */
export function subscribeToEvent<T = unknown>(
  type: MessageType,
  handler: EventHandler<T>,
  options: EventSubscriptionOptions = {}
): UnsubscribeFunction {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.on<T>(type, handler, options);
}

/**
 * One-time event subscription
 */
export function subscribeOnce<T = unknown>(
  type: MessageType,
  handler: EventHandler<T>,
  options: Omit<EventSubscriptionOptions, 'once'> = {}
): UnsubscribeFunction {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.once<T>(type, handler, options);
}

/**
 * Health check for all contexts
 */
export async function checkMessagingHealth(
  targets?: MessageSource[]
): Promise<Record<MessageSource, boolean>> {
  const messageBus = ChromeMessageBus.getInstance();
  return messageBus.healthCheck(targets);
}

/**
 * Reset Chrome MessageBus (for testing)
 */
export function resetChromeMessageBus(): void {
  ChromeMessageBus.reset();
}

// Re-export core types and utilities for convenience
export type { Message, MessageType, MessageSource, TypedMessage } from '../../types/messages';

export type { MessageListener, UnsubscribeFunction, SendOptions } from '../../extension/messaging';

export type {
  StandardResponse,
  SuccessResponse,
  ErrorResponse,
} from '../../extension/messaging/responses';

export type { ExtensionError, ErrorCode } from '../../extension/messaging/errors';

export { createMessage, isValidMessage, isMessageOfType } from '../../types/messages';

export { createSuccessResponse, createErrorResponse } from '../../extension/messaging/responses';

// Default export for convenience
export default ChromeMessageBus;
