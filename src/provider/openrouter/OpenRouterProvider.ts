/**
 * OpenRouter Provider Implementation
 */

import { BaseProvider } from '../BaseProvider';
import { OpenRouterClient } from './OpenRouterClient';
import { buildRequest } from './requestBuilder';
import { processStreamChunk } from './streamProcessor';
import { mapErrorToProviderError } from './errorHandler';
import { DEFAULT_OPENROUTER_MODEL_ID, getModelsByProvider } from '@/config/models';
import type {
  ProviderChatMessage,
  StreamChunk,
  ProviderConfig,
  ProviderValidationResult,
  ProviderError,
  OpenRouterConfig,
} from '@/types/providers';
import { validateOpenRouterConfig } from '@/types/providers';
import type { ModelConfig } from '@/config/models';

export class OpenRouterProvider extends BaseProvider {
  private client: OpenRouterClient | null = null;
  private openRouterConfig: OpenRouterConfig | null = null;

  constructor() {
    super('openrouter', 'OpenRouter', {
      streaming: true,
      temperature: false,
      reasoning: true,
      thinking: true,
      multimodal: false,
      functionCalling: false,
      maxContextLength: 200000, // Varies by model
      supportedModels: getModelsByProvider('openrouter').map(m => m.id),
    });
  }

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (config.type !== 'openrouter') {
      throw new Error('Invalid configuration type for OpenRouter provider');
    }

    const validation = this.validateConfig(config.config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.openRouterConfig = config.config as OpenRouterConfig;
    this.client = new OpenRouterClient(this.openRouterConfig);

    // Mark base provider as configured for ensureConfigured()/validation
    this.setConfig(config);

    // Test the connection
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to OpenRouter');
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    return validateOpenRouterConfig(config);
  }

  /**
   * Test connection to OpenRouter
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    return this.client.testConnection();
  }

  /**
   * Stream chat completion
   */
  async *streamChat(messages: ProviderChatMessage[], config?: unknown): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      this.streamMessage.bind(this),
      config as Record<string, unknown>
    );
  }

  /**
   * Internal streaming implementation
   */
  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: { signal?: AbortSignal; systemPrompt?: string }
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();

    if (!this.client || !this.openRouterConfig) {
      throw new Error('Provider not initialized');
    }

    try {
      const request = buildRequest({
        messages,
        config: this.openRouterConfig,
        systemPrompt: config?.systemPrompt,
      });

      const openai = this.client.getClient();

      const stream = (await openai.chat.completions.create(
        { ...request, stream: true } as Parameters<typeof openai.chat.completions.create>[0],
        { signal: config?.signal }
      )) as AsyncIterable<any>;

      for await (const chunk of stream) {
        const processedChunk = processStreamChunk(chunk);
        if (processedChunk) {
          yield processedChunk;
        }
      }
    } catch (error) {
      const formatted = this.formatError(error);
      const err = new Error(formatted.message) as Error & typeof formatted;
      Object.assign(err, formatted);
      throw err;
    }
  }

  /**
   * Get available models
   */
  getModels(): ModelConfig[] {
    return getModelsByProvider('openrouter');
  }

  /**
   * Get a specific model
   */
  getModel(id: string): ModelConfig | undefined {
    return this.getModels().find(model => model.id === id);
  }

  /**
   * Format error to ProviderError
   */
  formatError(error: unknown): ProviderError {
    return mapErrorToProviderError(error);
  }

  /**
   * Get default model ID
   */
  getDefaultModelId(): string {
    return DEFAULT_OPENROUTER_MODEL_ID;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: OpenRouterConfig): Promise<void> {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Accept OpenRouterConfig directly (not wrapped). The caller already provides the provider-specific config.
    this.openRouterConfig = config;
    if (this.client) {
      this.client.updateConfig(this.openRouterConfig);
    } else {
      this.client = new OpenRouterClient(this.openRouterConfig);
    }

    // Keep BaseProvider config in sync
    this.setConfig({ type: 'openrouter', config: this.openRouterConfig });

    // Test the connection with new config
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to OpenRouter with new configuration');
    }
  }
}
