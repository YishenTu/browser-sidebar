/**
 * @file BaseProvider Abstract Class
 *
 * Abstract base class for all AI providers that implements the AIProvider interface.
 * Provides shared functionality for configuration management, request validation,
 * error handling, rate limiting preparation, and streaming helpers.
 *
 * Each concrete provider must implement the abstract methods:
 * - initialize()
 * - validateConfig()
 * - testConnection()
 * - chat()
 * - streamChat()
 * - getModels()
 * - getModel()
 * - formatError()
 */

import type {
  AIProvider,
  ProviderType,
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ModelConfig,
  ProviderCapabilities,
  ProviderValidationResult,
  ProviderError,
  ErrorType,
} from '../types/providers';

/**
 * Rate limiting status information
 */
export interface RateLimitStatus {
  requestCount: number;
  windowStart: Date;
  nextResetTime: Date;
}

/**
 * Abstract base provider class implementing common functionality
 */
export abstract class BaseProvider implements AIProvider {
  public readonly type: ProviderType;
  public readonly name: string;
  public readonly capabilities: ProviderCapabilities;

  private config: ProviderConfig | null = null;
  protected requestTimestamps: number[] = [];
  private readonly REQUEST_WINDOW_MS = 60000; // 1 minute window for rate limiting

  constructor(type: ProviderType, name: string, capabilities: ProviderCapabilities) {
    this.type = type;
    this.name = name;
    this.capabilities = capabilities;
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Initialize the provider with configuration
   * Must be implemented by concrete providers
   */
  abstract initialize(config: ProviderConfig): Promise<void>;

  /**
   * Set configuration after validation
   * Called by concrete providers after successful validation
   */
  protected setConfig(config: ProviderConfig): void {
    const validation = this.validateConfig(config.config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    this.config = config;
  }

  /**
   * Get current configuration
   */
  public getConfig(): ProviderConfig | null {
    return this.config;
  }

  /**
   * Check if provider is configured
   */
  public isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Reset provider configuration
   */
  public reset(): void {
    this.config = null;
    this.requestTimestamps = [];
  }

  /**
   * Validate provider configuration
   * Must be implemented by concrete providers
   */
  abstract validateConfig(config: Record<string, unknown>): ProviderValidationResult;

  /**
   * Test connection to provider
   * Must be implemented by concrete providers
   */
  abstract testConnection(): Promise<boolean>;

  // ============================================================================
  // Chat Methods
  // ============================================================================

  /**
   * Send chat messages and get response
   * Must be implemented by concrete providers
   */
  abstract chat(messages: ProviderChatMessage[], config?: Record<string, unknown>): Promise<ProviderResponse>;

  /**
   * Stream chat messages
   * Must be implemented by concrete providers
   */
  abstract streamChat(messages: ProviderChatMessage[], config?: Record<string, unknown>): AsyncIterable<StreamChunk>;

  // ============================================================================
  // Model Methods
  // ============================================================================

  /**
   * Get available models
   * Must be implemented by concrete providers
   */
  abstract getModels(): ModelConfig[];

  /**
   * Get specific model by ID
   * Must be implemented by concrete providers
   */
  abstract getModel(id: string): ModelConfig | undefined;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format error into provider error structure
   * Must be implemented by concrete providers
   */
  abstract formatError(error: unknown): ProviderError;

  // ============================================================================
  // Shared Functionality
  // ============================================================================

  /**
   * Create a standardized provider error
   */
  protected createError(
    type: ErrorType,
    message: string,
    code: string,
    options: {
      retryAfter?: number;
      details?: Record<string, unknown>;
    } = {}
  ): ProviderError {
    const error: ProviderError = {
      type,
      message,
      code,
      provider: this.type,
    };

    if (options.retryAfter !== undefined) {
      error.retryAfter = options.retryAfter;
    }

    if (options.details) {
      error.details = {
        timestamp: new Date(),
        ...options.details,
      };
    }

    return error;
  }

  /**
   * Validate messages before sending
   */
  protected validateMessages(messages: ProviderChatMessage[]): void {
    if (!this.isConfigured()) {
      throw new Error('Provider not initialized');
    }

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
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.id === 'string' &&
      typeof message.role === 'string' &&
      ['user', 'assistant', 'system'].includes(message.role) &&
      typeof message.content === 'string' &&
      message.timestamp instanceof Date
    );
  }

  // ============================================================================
  // Rate Limiting Preparation
  // ============================================================================

  /**
   * Track request timestamp for rate limiting
   */
  protected trackRequest(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.cleanOldRequests();
  }

  /**
   * Get request history for rate limiting
   */
  public getRequestHistory(): number[] {
    this.cleanOldRequests();
    return [...this.requestTimestamps];
  }

  /**
   * Get current rate limiting status
   */
  public getRateLimitStatus(): RateLimitStatus {
    this.cleanOldRequests();
    const windowStart = new Date(Date.now() - this.REQUEST_WINDOW_MS);
    const nextResetTime = new Date(Date.now() + this.REQUEST_WINDOW_MS);

    return {
      requestCount: this.requestTimestamps.length,
      windowStart,
      nextResetTime,
    };
  }

  /**
   * Clean old request timestamps outside the window
   */
  private cleanOldRequests(): void {
    const cutoff = Date.now() - this.REQUEST_WINDOW_MS;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > cutoff);
  }

  // ============================================================================
  // Streaming Helpers
  // ============================================================================

  /**
   * Extract content from stream chunk
   */
  public extractContentFromChunk(chunk: StreamChunk): string | null {
    if (!chunk.choices || chunk.choices.length === 0) {
      return null;
    }

    const choice = chunk.choices[0];
    return choice?.delta?.content || null;
  }

  /**
   * Check if stream is complete
   */
  public isStreamComplete(chunk: StreamChunk): boolean {
    if (!chunk.choices || chunk.choices.length === 0) {
      return false;
    }

    const choice = chunk.choices[0];
    return choice?.finishReason === 'stop' || choice?.finishReason === 'length';
  }

  /**
   * Validate configuration is set before operations
   */
  protected ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Provider not initialized');
    }
  }

  /**
   * Wrapper for chat that includes validation and tracking
   */
  protected async performChat(
    messages: ProviderChatMessage[],
    chatImplementation: (
      messages: ProviderChatMessage[],
      config?: Record<string, unknown>
    ) => Promise<ProviderResponse>,
    config?: Record<string, unknown>
  ): Promise<ProviderResponse> {
    this.validateMessages(messages);
    this.trackRequest();
    return await chatImplementation(messages, config);
  }

  /**
   * Wrapper for stream chat that includes validation and tracking
   */
  protected async *performStreamChat(
    messages: ProviderChatMessage[],
    streamImplementation: (
      messages: ProviderChatMessage[],
      config?: Record<string, unknown>
    ) => AsyncIterable<StreamChunk>,
    config?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    this.validateMessages(messages);
    this.trackRequest();

    for await (const chunk of streamImplementation(messages, config)) {
      yield chunk;
    }
  }
}
