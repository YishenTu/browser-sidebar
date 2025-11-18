/**
 * Grok Provider (xAI)
 */
import { BaseEngine } from '../BaseEngine';
import { buildRequest, buildHeaders, buildApiUrl } from '@/core/ai/grok/requestBuilder';
import { GrokStreamProcessor } from '@/core/ai/grok/streamProcessor';
import {
  formatError as formatGrokError,
  withErrorHandlingGenerator,
} from '@/core/ai/grok/errorHandler';
import { getModelsByProvider, getModelById, modelExists, type ModelConfig } from '@/config/models';
import { debugLog } from '@/utils/debug';
import type { Transport } from '@/transport/types';
import type {
  ProviderConfig,
  ProviderChatMessage,
  StreamChunk,
  ProviderValidationResult,
  GrokConfig,
  ProviderError,
} from '@/types/providers';
import type { GrokChatConfig } from '@/core/ai/grok/types';

export class GrokProvider extends BaseEngine {
  constructor(transport?: Transport) {
    const grokModels = getModelsByProvider('grok');
    super(
      'grok',
      'Grok (xAI)',
      {
        streaming: true,
        temperature: false,
        reasoning: false,
        thinking: false,
        multimodal: false,
        functionCalling: false,
        maxContextLength: 128000,
        supportedModels: grokModels.map(m => m.id),
      },
      transport
    );
  }

  async initialize(config: ProviderConfig): Promise<void> {
    const grokConfig = config.config as GrokConfig;
    const validation = this.validateConfig(grokConfig);
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
    return { isValid: errors.length === 0, errors };
  }

  async hasRequiredConfig(): Promise<boolean> {
    try {
      const cfg = this.getConfig();
      if (!cfg || !cfg.config) return false;
      const grokConfig = cfg.config as GrokConfig;
      return !!(grokConfig.apiKey && grokConfig.apiKey.length > 0);
    } catch {
      return false;
    }
  }

  async *streamChat(
    messages: ProviderChatMessage[],
    config?: GrokChatConfig
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
    config?: GrokChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    const transport = this.getTransport();
    if (!transport) throw new Error('Transport not available');

    yield* withErrorHandlingGenerator(
      async function* (this: GrokProvider) {
        const currentConfig = this.getConfig()?.config as GrokConfig;
        if (!currentConfig) throw new Error('Provider configuration not found');

        const request = buildRequest(messages, currentConfig, {
          ...config,
          stream: true,
          previousResponseId: config?.previousResponseId,
          systemPrompt: config?.systemPrompt,
        });

        // Log the actual Grok request
        debugLog('GrokProvider', '=== Grok Request ===');
        debugLog('GrokProvider', JSON.stringify(request, null, 2));
        debugLog('GrokProvider', '====================');

        const url = buildApiUrl();
        const transportRequest = {
          url,
          method: 'POST' as const,
          headers: buildHeaders(currentConfig.apiKey),
          body: JSON.stringify(request),
          stream: true,
          signal: config?.signal,
        };

        const processor = new GrokStreamProcessor(currentConfig.model);
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
                // Capture response ID from the first event - try multiple possible locations
                if (!capturedResponseId && event.id) {
                  capturedResponseId = event.id;
                  debugLog('GrokProvider', `Captured response ID: ${capturedResponseId}`);
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
    return getModelsByProvider('grok');
  }

  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }

  formatError(error: unknown): ProviderError {
    return formatGrokError(error);
  }
}
