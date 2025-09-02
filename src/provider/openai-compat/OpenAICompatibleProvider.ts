/**
 * OpenAI-Compatible Provider Implementation
 */

import { BaseProvider } from '../BaseProvider';
import { OpenAICompatClient } from './OpenAICompatClient';
import { buildRequest } from './requestBuilder';
import { processStreamChunk } from './streamProcessor';
import { mapErrorToProviderError } from './errorHandler';
import { isBuiltInPreset } from './presets';
import { getModelsByProvider } from '@/config/models';
import type {
  ProviderChatMessage,
  StreamChunk,
  ProviderConfig,
  ProviderValidationResult,
  ProviderError,
  OpenAICompatibleConfig,
} from '@/types/providers';
import { validateOpenAICompatibleConfig } from '@/types/providers';
import type { ModelConfig } from '@/config/models';

export class OpenAICompatibleProvider extends BaseProvider {
  private client: OpenAICompatClient | null = null;
  private compatConfig: OpenAICompatibleConfig | null = null;
  private providerId: string = 'openai_compat';

  constructor() {
    super('openai_compat', 'OpenAI-Compatible', {
      streaming: true,
      temperature: true,
      reasoning: true, // Pass through if model supports
      thinking: false, // Most don't support thinking tokens
      multimodal: false,
      functionCalling: false,
      maxContextLength: 128000, // Varies by provider/model
      supportedModels: [], // Will be populated dynamically
    });
  }

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (config.type !== 'openai_compat') {
      throw new Error('Invalid configuration type for OpenAI-Compatible provider');
    }

    const validation = this.validateConfig(config.config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    this.compatConfig = config.config as OpenAICompatibleConfig;
    this.client = new OpenAICompatClient(this.compatConfig);

    // Extract provider ID from metadata if available
    const metadata = (config.config as Record<string, unknown>)['metadata'] as
      | { providerId?: string }
      | undefined;
    if (metadata?.providerId) {
      this.providerId = metadata.providerId;
    }

    // Update supported models based on provider ID
    if (isBuiltInPreset(this.providerId)) {
      this.capabilities.supportedModels = getModelsByProvider(this.providerId).map(m => m.id);
    } else {
      // For custom providers, use the configured model
      this.capabilities.supportedModels = [this.compatConfig.model];
    }

    // Mark base provider as configured
    this.setConfig(config);

    // Test the connection
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to OpenAI-Compatible endpoint');
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    return validateOpenAICompatibleConfig(config);
  }

  /**
   * Test connection to the endpoint
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

    if (!this.client || !this.compatConfig) {
      throw new Error('Provider not initialized');
    }

    try {
      const request = buildRequest({
        messages,
        config: this.compatConfig,
        systemPrompt: config?.systemPrompt,
      });

      const openai = this.client.getClient();

      const stream = (await openai.chat.completions.create(
        { ...request, stream: true } as Parameters<typeof openai.chat.completions.create>[0],
        { signal: config?.signal }
      )) as AsyncIterable<import('openai/resources/chat/completions').ChatCompletionChunk>;

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
    // For built-in presets, return models from config
    if (isBuiltInPreset(this.providerId)) {
      return getModelsByProvider(this.providerId);
    }

    // For custom providers, return a single model based on config
    if (this.compatConfig) {
      const metadata = (this.compatConfig as Record<string, unknown>)['metadata'] as
        | { modelName?: string }
        | undefined;
      const modelName = metadata?.modelName || this.compatConfig.model;
      return [
        {
          id: this.compatConfig.model,
          name: modelName,
          provider: 'openai_compat',
        },
      ];
    }

    return [];
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
    const models = this.getModels();
    return models.length > 0 && models[0] ? models[0].id : '';
  }
}
