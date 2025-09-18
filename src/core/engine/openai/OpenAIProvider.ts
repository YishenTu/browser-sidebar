/**
 * OpenAI Provider (compat shim backed by transport + core)
 */
import { BaseEngine } from '../BaseEngine';
import { buildRequest } from '@/core/ai/openai/requestBuilder';
import { extractSearchMetadataFromEvent } from '@/core/ai/openai/responseParser';
import { OpenAIStreamProcessor } from '@/core/ai/openai/streamProcessor';
import {
  formatError as formatOpenAIError,
  withErrorHandlingGenerator,
} from '@/core/ai/openai/errorHandler';
import { handleStreamSearchMetadata } from '@/core/ai/openai/searchMetadata';
import { getModelsByProvider, getModelById, modelExists, type ModelConfig } from '@/config/models';
import { debugLog } from '@/utils/debug';
import type { Transport } from '@/transport/types';
import type {
  ProviderConfig,
  ProviderChatMessage,
  StreamChunk,
  ProviderValidationResult,
  OpenAIConfig,
} from '@/types/providers';
import type { OpenAIChatConfig } from '@/core/ai/openai/types';

export class OpenAIProvider extends BaseEngine {
  constructor(transport?: Transport) {
    const openaiModels = getModelsByProvider('openai');
    super(
      'openai',
      'OpenAI',
      {
        streaming: true,
        temperature: false,
        reasoning: true,
        thinking: true,
        multimodal: true,
        functionCalling: false,
        maxContextLength: 400000,
        supportedModels: openaiModels.map(m => m.id),
      },
      transport
    );
  }

  async initialize(config: ProviderConfig): Promise<void> {
    const openaiConfig = config.config as OpenAIConfig;
    const validation = this.validateConfig(openaiConfig);
    if (!validation.isValid)
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    this.setConfig(config);
  }

  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    const errors: string[] = [];
    if (
      !config['apiKey'] ||
      typeof config['apiKey'] !== 'string' ||
      config['apiKey'].trim() === ''
    ) {
      errors.push('Invalid API key');
    }
    if (!config['model'] || typeof config['model'] !== 'string') {
      errors.push('Invalid model');
    } else if (!modelExists(config['model'])) {
      errors.push(`Unknown model: ${config['model']}`);
    }
    if (config['reasoningEffort'] !== undefined) {
      if (
        typeof config['reasoningEffort'] !== 'string' ||
        !['minimal', 'low', 'medium', 'high'].includes(config['reasoningEffort'])
      ) {
        errors.push('Invalid reasoning effort');
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  async hasRequiredConfig(): Promise<boolean> {
    try {
      const cfg = this.getConfig();
      if (!cfg || !cfg.config) return false;
      const openaiConfig = cfg.config as OpenAIConfig;
      return !!(openaiConfig.apiKey && openaiConfig.apiKey.length > 0);
    } catch {
      return false;
    }
  }

  async *streamChat(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): AsyncIterable<StreamChunk> {
    const transport = this.getTransport();
    if (!transport) throw new Error('Transport not available');
    yield* this.performStreamChat(
      messages,
      this.streamMessageWithTransport.bind(this),
      config as Record<string, unknown>
    );
  }

  private async *streamMessageWithTransport(
    messages: ProviderChatMessage[],
    config?: OpenAIChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    const transport = this.getTransport();
    if (!transport) throw new Error('Transport not available');

    yield* withErrorHandlingGenerator(
      async function* (this: OpenAIProvider) {
        const currentConfig = this.getConfig()?.config as OpenAIConfig;
        if (!currentConfig) throw new Error('Provider configuration not found');

        const request = buildRequest(messages, currentConfig, {
          ...config,
          stream: true,
          previousResponseId: config?.previousResponseId,
          systemPrompt: config?.systemPrompt,
        });

        // Log the actual OpenAI request
        debugLog('OpenAIProvider', '=== OpenAI Request ===');
        debugLog('OpenAIProvider', JSON.stringify(request, null, 2));
        debugLog('OpenAIProvider', '=====================');

        const transportRequest = {
          url: 'https://api.openai.com/v1/responses',
          method: 'POST' as const,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentConfig.apiKey}`,
          },
          body: JSON.stringify(request),
          stream: true,
          signal: config?.signal,
        };

        const processor = new OpenAIStreamProcessor(
          currentConfig.model,
          currentConfig.reasoningEffort !== undefined
        );
        let capturedResponseId: string | null = null;

        for await (const chunk of transport.stream(transportRequest)) {
          try {
            const chunkStr = new TextDecoder().decode(chunk);
            const lines = chunkStr.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const event = JSON.parse(data);
                if (!capturedResponseId && event.response?.id?.startsWith('resp_')) {
                  capturedResponseId = event.response.id;
                }
                const streamChunk = processor.processEvent(event);
                if (streamChunk) {
                  if (capturedResponseId) {
                    streamChunk.metadata = {
                      ...streamChunk.metadata,
                      responseId: capturedResponseId,
                    };
                  }
                  yield streamChunk;
                }
                const searchMetadata = extractSearchMetadataFromEvent(event);
                const updatedMetadata = handleStreamSearchMetadata(
                  event,
                  searchMetadata,
                  processor.getSearchMetadata(),
                  messages
                );
                if (updatedMetadata && updatedMetadata !== processor.getSearchMetadata()) {
                  processor.setSearchMetadata(updatedMetadata);
                }
              } catch {
                continue;
              }
            }
          } catch {
            continue;
          }
        }
      }.bind(this)
    );
  }

  getModels(): ModelConfig[] {
    return getModelsByProvider('openai');
  }
  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }
  formatError(error: unknown) {
    return formatOpenAIError(error);
  }
}
