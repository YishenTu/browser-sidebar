/**
 * @file Chat Service
 *
 * High-level service for managing chat interactions with AI providers.
 * Provides a unified interface for streaming responses, handling cancellation,
 * and managing provider communication.
 *
 * Features:
 * - Streaming chat responses from any configured provider
 * - Request cancellation via AbortController
 * - Consistent StreamChunk format across all providers
 * - Error handling and recovery
 * - Integration with existing provider system
 * - Compatible with refactorMode feature flag
 */

import type { AIProvider, ProviderChatMessage, StreamChunk } from '../../types/providers';
import type { Transport } from '@transport/types';
import { BaseEngine } from '@core/engine/BaseEngine';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for streaming chat requests
 */
export interface StreamOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Previous response ID for conversation continuity (OpenAI Response API) */
  previousResponseId?: string;
  /** System prompt to include in the request */
  systemPrompt?: string;
  /** Provider-specific configuration */
  providerConfig?: Record<string, unknown>;
}

/**
 * Chat service interface
 */
export interface IChatService {
  /**
   * Stream chat responses from the configured provider
   * @param messages Array of chat messages
   * @param options Stream options including cancellation signal
   * @returns Async iterable of stream chunks
   */
  stream(messages: ProviderChatMessage[], options?: StreamOptions): AsyncIterable<StreamChunk>;

  /**
   * Cancel any ongoing streaming request
   */
  cancel(): void;

  /**
   * Check if there's an active streaming request
   */
  isStreaming(): boolean;

  /**
   * Set the AI provider to use for chat requests
   * @param provider The AI provider instance
   */
  setProvider(provider: AIProvider): void;

  /**
   * Get the current AI provider
   */
  getProvider(): AIProvider | null;
}

// ============================================================================
// Chat Service Implementation
// ============================================================================

/**
 * Chat service for managing AI provider interactions
 */
export class ChatService implements IChatService {
  private provider: AIProvider | null = null;
  private abortController: AbortController | null = null;
  private transport?: Transport;

  constructor(provider?: AIProvider, transport?: Transport) {
    if (provider) {
      this.provider = provider;
    }
    this.transport = transport;
  }

  /**
   * Set the AI provider to use for chat requests
   */
  setProvider(provider: AIProvider): void {
    // Cancel any ongoing streaming before switching providers
    this.cancel();

    this.provider = provider;

    // Set transport if available and provider extends BaseEngine
    if (this.transport && provider instanceof BaseEngine) {
      provider.setTransport(this.transport);
    }
  }

  /**
   * Get the current AI provider
   */
  getProvider(): AIProvider | null {
    return this.provider;
  }

  /**
   * Stream chat responses from the configured provider
   */
  async *stream(
    messages: ProviderChatMessage[],
    options: StreamOptions = {}
  ): AsyncIterable<StreamChunk> {
    if (!this.provider) {
      throw new Error('No AI provider configured');
    }

    if (!this.provider.streamChat) {
      throw new Error('Provider does not support streaming');
    }

    // Validate input messages
    this.validateMessages(messages);

    // Cancel any existing stream
    this.cancel();

    // Create new abort controller for this stream
    this.abortController = new AbortController();

    // Use provided signal or create internal one
    const signal = options.signal || this.abortController.signal;

    try {
      // Build provider configuration
      const providerConfig = {
        ...options.providerConfig,
        signal,
        previousResponseId: options.previousResponseId,
        systemPrompt: options.systemPrompt,
      };

      // Start streaming from provider
      const stream = this.provider.streamChat(messages, providerConfig);

      // Yield chunks from the provider stream
      for await (const chunk of stream) {
        // Check if cancelled
        if (signal.aborted) {
          throw new Error('Stream was cancelled');
        }

        yield chunk;
      }
    } catch (error) {
      // Handle streaming errors
      if (signal.aborted) {
        throw new Error('Stream was cancelled');
      }

      // Use provider's error formatting if available
      if (this.provider.formatError) {
        const formattedError = this.provider.formatError(error);
        throw new Error(formattedError.message);
      }

      // Fallback to generic error handling
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Unknown streaming error occurred');
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  /**
   * Cancel any ongoing streaming request
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if there's an active streaming request
   */
  isStreaming(): boolean {
    return this.abortController !== null;
  }

  /**
   * Set transport implementation
   */
  setTransport(transport: Transport): void {
    this.transport = transport;

    // Apply to current provider if it extends BaseEngine
    if (this.provider && this.provider instanceof BaseEngine) {
      this.provider.setTransport(transport);
    }
  }

  /**
   * Get current transport implementation
   */
  getTransport(): Transport | undefined {
    return this.transport;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate input messages
   */
  private validateMessages(messages: ProviderChatMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!this.isValidMessage(message)) {
        throw new Error('Invalid message format');
      }

      if (!message.content || message.content.trim() === '') {
        throw new Error('Message content cannot be empty');
      }
    }
  }

  /**
   * Check if message has valid format
   */
  private isValidMessage(message: unknown): message is ProviderChatMessage {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const messageObj = message as Record<string, unknown>;

    return (
      typeof messageObj['id'] === 'string' &&
      typeof messageObj['role'] === 'string' &&
      ['user', 'assistant', 'system'].includes(messageObj['role']) &&
      typeof messageObj['content'] === 'string' &&
      messageObj['timestamp'] instanceof Date
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new chat service instance
 */
export function createChatService(provider?: AIProvider, transport?: Transport): ChatService {
  return new ChatService(provider, transport);
}

/**
 * Create a chat service with a specific provider
 */
export function createChatServiceWithProvider(
  provider: AIProvider,
  transport?: Transport
): ChatService {
  const service = new ChatService(undefined, transport);
  service.setProvider(provider);
  return service;
}

// ============================================================================
// Default Export
// ============================================================================

export default ChatService;
