/**
 * @file OpenAI Provider Implementation
 *
 * OpenAI provider using Response API with reasoning_effort support.
 * Implements streaming responses, error handling, and request cancellation.
 *
 * Features:
 * - OpenAI Responses API integration
 * - Reasoning effort parameter (low/medium/high)
 * - Streaming with token buffering
 * - Request cancellation with AbortController
 * - Comprehensive error handling
 * - Model management and token estimation
 */

import { BaseProvider } from '../BaseProvider';
import { OpenAIClient } from './OpenAIClient';
import { buildRequest } from './requestBuilder';
import { parseResponse, extractSearchMetadataFromEvent } from './responseParser';
import { OpenAIStreamProcessor } from './streamProcessor';
import {
  formatError as formatOpenAIError,
  withErrorHandling,
  withErrorHandlingGenerator,
} from './errorHandler';
import { createFallbackSearchMetadata } from './searchMetadata';
import {
  getModelsByProvider,
  getModelById,
  modelExists,
  type ModelConfig,
} from '../../config/models';
import type {
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ProviderValidationResult,
  OpenAIConfig,
} from '../../types/providers';
import type { OpenAIChatConfig } from './types';

/**
 * OpenAI Provider implementing Response API
 */
export class OpenAIProvider extends BaseProvider {
  private openaiClient: OpenAIClient;

  constructor() {
    const openaiModels = getModelsByProvider('openai');
    super('openai', 'OpenAI', {
      streaming: true,
      temperature: false,
      reasoning: true,
      thinking: false,
      multimodal: true,
      functionCalling: false,
      maxContextLength: 400000,
      supportedModels: openaiModels.map(m => m.id),
    });

    this.openaiClient = new OpenAIClient();
  }

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    const openaiConfig = config.config as OpenAIConfig;

    // Validate configuration first using our own validation
    const validation = this.validateConfig(openaiConfig);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Extend config with custom options for Response API
    const extendedConfig = {
      ...openaiConfig,
      customOptions: {
        timeout: 120000, // 2 minutes for Response API
        maxRetries: 3,
        ...(openaiConfig as any).customOptions,
      },
    };

    await this.openaiClient.initialize(extendedConfig);
    this.setConfig(config);
  }

  /**
   * Validate OpenAI configuration
   */
  validateConfig(config: any): ProviderValidationResult {
    const errors: string[] = [];

    // Validate API key
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      errors.push('Invalid API key');
    } else if (!config.apiKey.startsWith('sk-')) {
      errors.push('API key must start with "sk-"');
    }

    // Validate model
    if (!config.model || typeof config.model !== 'string') {
      errors.push('Invalid model');
    } else if (!modelExists(config.model)) {
      errors.push(`Unknown model: ${config.model}`);
    }

    // Validate reasoning effort (only valid parameter for OpenAI)
    if (config.reasoningEffort !== undefined) {
      if (
        typeof config.reasoningEffort !== 'string' ||
        !['minimal', 'low', 'medium', 'high'].includes(config.reasoningEffort)
      ) {
        errors.push('Invalid reasoning effort');
      }
    }

    // Legacy parameters are ignored silently

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    this.ensureConfigured();
    try {
      return await this.openaiClient.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * Send chat messages using OpenAI Response API
   */
  async chat(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): Promise<ProviderResponse> {
    return this.performChat(messages, this.sendMessage.bind(this), config);
  }

  /**
   * Stream chat messages using OpenAI Response API
   */
  async *streamChat(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(messages, this.streamMessage.bind(this), config);
  }

  // ============================================================================
  // Internal Chat Implementation
  // ============================================================================

  /**
   * Send a single chat request to OpenAI API
   */
  private async sendMessage(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): Promise<ProviderResponse> {
    this.ensureConfigured();

    const openaiInstance = this.openaiClient.getOpenAIInstance();
    if (!openaiInstance) {
      throw new Error('OpenAI client not initialized');
    }

    const currentConfig = this.getConfig()?.config as OpenAIConfig;
    if (!currentConfig) {
      throw new Error('Provider configuration not found');
    }

    const request = buildRequest(messages, currentConfig, config);

    return withErrorHandling(async () => {
      // Use Responses API with AbortSignal passed via RequestOptions
      const response = await (openaiInstance as any).responses.create(request, {
        signal: config?.signal,
      });

      return parseResponse(response, currentConfig.model);
    });
  }

  /**
   * Stream chat messages from OpenAI API
   */
  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();

    yield* withErrorHandlingGenerator(
      async function* (this: OpenAIProvider) {
        const openaiInstance = this.openaiClient.getOpenAIInstance();
        if (!openaiInstance) {
          throw new Error('OpenAI client not initialized');
        }

        const currentConfig = this.getConfig()?.config as OpenAIConfig;
        if (!currentConfig) {
          throw new Error('Provider configuration not found');
        }

        // Build streaming request
        const request = buildRequest(messages, currentConfig, { ...config, stream: true });

        // Use responses.create with stream: true (there is no separate stream method)
        const asyncIterable = await (openaiInstance as any).responses.create(request, {
          signal: config?.signal,
        });

        // Initialize stream processor
        const processor = new OpenAIStreamProcessor(
          currentConfig.model,
          currentConfig.reasoningEffort !== undefined
        );

        for await (const event of asyncIterable as any) {
          try {
            // Process event and yield chunk if applicable
            const chunk = processor.processEvent(event);
            if (chunk) {
              yield chunk;
            }

            // Also check for search metadata events
            const searchMetadata = extractSearchMetadataFromEvent(event);
            if (searchMetadata && !processor.getSearchMetadata()) {
              // Store metadata in processor for inclusion in subsequent chunks
              createFallbackSearchMetadata(event.item?.action?.query, messages);
              // Processor will include this in future chunks
            }
          } catch (parseError) {
            console.warn('Error parsing stream chunk:', parseError);
            continue;
          }
        }
      }.bind(this)
    );
  }

  /**
   * Get available OpenAI models
   */
  getModels(): ModelConfig[] {
    return getModelsByProvider('openai');
  }

  /**
   * Get specific model by ID
   */
  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }

  /**
   * Format error into provider error structure
   */
  formatError(error: any) {
    return formatOpenAIError(error);
  }
}
