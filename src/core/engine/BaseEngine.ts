/**
 * Base Engine class for all AI engine implementations
 */
import type {
  AIProvider,
  ProviderType,
  ProviderConfig,
  ProviderChatMessage,
  StreamChunk,
  ModelConfig,
  ProviderCapabilities,
  ProviderValidationResult,
  ProviderError,
  ErrorType,
} from '@/types/providers';
import type { Transport } from '@/transport/types';

export interface RateLimitStatus {
  requestCount: number;
  windowStart: Date;
  nextResetTime: Date;
}

export abstract class BaseEngine implements AIProvider {
  public readonly type: ProviderType;
  public readonly name: string;
  public readonly capabilities: ProviderCapabilities;

  private config: ProviderConfig | null = null;
  protected requestTimestamps: number[] = [];
  private readonly REQUEST_WINDOW_MS = 60000;
  protected transport?: Transport;

  constructor(
    type: ProviderType,
    name: string,
    capabilities: ProviderCapabilities,
    transport?: Transport
  ) {
    this.type = type;
    this.name = name;
    this.capabilities = capabilities;
    this.transport = transport;
  }

  abstract initialize(config: ProviderConfig): Promise<void>;

  protected setConfig(config: ProviderConfig): void {
    const validation = this.validateConfig(config.config as unknown as Record<string, unknown>);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    this.config = config;
  }

  public getConfig(): ProviderConfig | null {
    return this.config;
  }
  public isConfigured(): boolean {
    return this.config !== null;
  }
  public reset(): void {
    this.config = null;
    this.requestTimestamps = [];
  }
  public setTransport(transport: Transport): void {
    this.transport = transport;
  }
  public getTransport(): Transport | undefined {
    return this.transport;
  }

  abstract validateConfig(config: Record<string, unknown>): ProviderValidationResult;
  abstract hasRequiredConfig(): Promise<boolean>;

  public async testConnection(): Promise<boolean> {
    try {
      return await this.hasRequiredConfig();
    } catch {
      return false;
    }
  }

  abstract streamChat(
    messages: ProviderChatMessage[],
    config?: Record<string, unknown>
  ): AsyncIterable<StreamChunk>;

  abstract getModels(): ModelConfig[];
  abstract getModel(id: string): ModelConfig | undefined;
  abstract formatError(error: unknown): ProviderError;

  protected createError(
    type: ErrorType,
    message: string,
    code: string,
    options: { retryAfter?: number; details?: Record<string, unknown> } = {}
  ): ProviderError {
    const base: ProviderError = { type, message, code, provider: this.type };
    const withRetry =
      options.retryAfter !== undefined ? { ...base, retryAfter: options.retryAfter } : base;
    const withDetails = options.details
      ? { ...withRetry, details: { timestamp: new Date(), ...options.details } }
      : withRetry;
    return withDetails;
  }

  protected validateMessages(messages: ProviderChatMessage[]): void {
    if (!this.isConfigured()) throw new Error('Provider not initialized');
    if (!Array.isArray(messages) || messages.length === 0)
      throw new Error('Messages array cannot be empty');
    for (const m of messages) {
      if (!m || typeof m !== 'object') throw new Error('Invalid message format');
      if (!m.content || m.content.trim() === '') throw new Error('Invalid message format');
    }
  }

  protected trackRequest(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    const cutoff = now - this.REQUEST_WINDOW_MS;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > cutoff);
  }

  protected async *performStreamChat(
    messages: ProviderChatMessage[],
    impl: (
      messages: ProviderChatMessage[],
      config?: Record<string, unknown>
    ) => AsyncIterable<StreamChunk>,
    config?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    this.validateMessages(messages);
    this.trackRequest();
    for await (const chunk of impl(messages, config)) yield chunk;
  }

  /** Ensure the provider is configured before use */
  protected ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Provider not initialized');
    }
  }
}
