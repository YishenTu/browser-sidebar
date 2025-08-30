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
import type { OpenAIResponse } from './types';
import {
  formatError as formatOpenAIError,
  withErrorHandling,
  withErrorHandlingGenerator,
} from './errorHandler';
import { handleStreamSearchMetadata } from './searchMetadata';
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
      thinking: true,
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
        ...(openaiConfig as { customOptions?: Record<string, unknown> }).customOptions,
      },
    };

    await this.openaiClient.initialize(extendedConfig);
    this.setConfig(config);
  }

  /**
   * Validate OpenAI configuration
   */
  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    const errors: string[] = [];

    // Validate API key
    if (
      !config['apiKey'] ||
      typeof config['apiKey'] !== 'string' ||
      config['apiKey'].trim() === ''
    ) {
      errors.push('Invalid API key');
    } else if (!config['apiKey'].startsWith('sk-')) {
      errors.push('API key must start with "sk-"');
    }

    // Validate model
    if (!config['model'] || typeof config['model'] !== 'string') {
      errors.push('Invalid model');
    } else if (!modelExists(config['model'])) {
      errors.push(`Unknown model: ${config['model']}`);
    }

    // Validate reasoning effort (only valid parameter for OpenAI)
    if (config['reasoningEffort'] !== undefined) {
      if (
        typeof config['reasoningEffort'] !== 'string' ||
        !['minimal', 'low', 'medium', 'high'].includes(config['reasoningEffort'])
      ) {
        errors.push('Invalid reasoning effort');
      }
    }

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
    return this.performChat(
      messages,
      this.sendMessage.bind(this),
      config as Record<string, unknown>
    );
  }

  /**
   * Stream chat messages using OpenAI Response API
   */
  async *streamChat(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      this.streamMessage.bind(this),
      config as Record<string, unknown>
    );
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

    const request = buildRequest(messages, currentConfig, {
      ...config,
      previousResponseId: config?.previousResponseId,
      systemPrompt: config?.systemPrompt,
    });

    // Request logging removed for production

    return withErrorHandling(async () => {
      // Use Responses API with AbortSignal passed via RequestOptions
      const response = await (
        openaiInstance as {
          responses: { create: (req: unknown, opts: unknown) => Promise<unknown> };
        }
      ).responses.create(request, {
        signal: config?.signal,
      });

      return parseResponse(response as OpenAIResponse, currentConfig.model, messages);
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
        const request = buildRequest(messages, currentConfig, {
          ...config,
          stream: true,
          previousResponseId: config?.previousResponseId,
          systemPrompt: config?.systemPrompt,
        });

        // Log the actual OpenAI API request for streaming
        // Request logging removed for production

        // Use responses.create with stream: true (there is no separate stream method)
        const asyncIterable = await (
          openaiInstance as {
            responses: { create: (req: unknown, opts: unknown) => Promise<unknown> };
          }
        ).responses.create(request, {
          signal: config?.signal,
        });

        // Initialize stream processor
        const processor = new OpenAIStreamProcessor(
          currentConfig.model,
          currentConfig.reasoningEffort !== undefined
        );

        let capturedResponseId: string | null = null;

        for await (const event of asyncIterable as AsyncIterable<unknown>) {
          try {
            // Capture the real response ID from OpenAI's response.created event
            // This is the ACTUAL response ID from OpenAI, not our generated chunk IDs
            if (
              !capturedResponseId &&
              (event as any).response?.id &&
              (event as any).response.id.startsWith('resp_')
            ) {
              capturedResponseId = (event as any).response.id;
            }

            // Process event and yield chunk if applicable
            const chunk = processor.processEvent(event as any);
            if (chunk) {
              // Inject the REAL response ID into metadata, not the chunk ID
              if (capturedResponseId) {
                chunk.metadata = {
                  ...chunk.metadata,
                  responseId: capturedResponseId,
                };
              }
              yield chunk;
            }

            // Handle search metadata using centralized logic
            const searchMetadata = extractSearchMetadataFromEvent(event as any);
            const updatedMetadata = handleStreamSearchMetadata(
              event as any,
              searchMetadata,
              processor.getSearchMetadata(),
              messages
            );

            // Update processor if metadata changed
            if (updatedMetadata && updatedMetadata !== processor.getSearchMetadata()) {
              processor.setSearchMetadata(updatedMetadata);
            }
          } catch (parseError) {
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
  formatError(error: unknown) {
    return formatOpenAIError(error);
  }
}
