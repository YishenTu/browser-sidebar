/**
 * Gemini Provider (compat shim backed by transport + core)
 */
import { GeminiStreamProcessor } from '@/core/ai/gemini/streamProcessor';
import { buildRequest, buildHeaders, buildApiUrl } from '@/core/ai/gemini/requestBuilder';
import { convertToStreamChunk, processStreamChunk } from '@/core/ai/gemini/responseParser';
import { withErrorHandlingGenerator } from '@/core/ai/gemini/errorHandler';
import { debugLog } from '@/utils/debug';
import type {
  ProviderChatMessage,
  StreamChunk,
  GeminiConfig,
  FinishReason,
  ProviderConfig,
  ProviderError,
  ProviderValidationResult,
} from '@/types/providers';
import type { GeminiRequest } from '@/core/ai/gemini/types';
import { getModelsByProvider, getModelById, type ModelConfig } from '@/config/models';
import type { GeminiChatConfig } from '@/core/ai/gemini/types';
import type { Transport } from '@/transport/types';
import { BaseEngine } from '../BaseEngine';

export class GeminiProvider extends BaseEngine {
  constructor(transport?: Transport) {
    super(
      'gemini',
      'Google Gemini',
      {
        streaming: true,
        temperature: true,
        reasoning: false,
        thinking: true,
        multimodal: true,
        functionCalling: false,
        maxContextLength: 1000000,
        supportedModels: [],
      },
      transport
    );
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.setConfig(config);
  }
  validateConfig(): ProviderValidationResult {
    return { isValid: true, errors: [] };
  }
  async hasRequiredConfig(): Promise<boolean> {
    return true;
  }

  override async *streamChat(
    messages: ProviderChatMessage[],
    config?: GeminiChatConfig
  ): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      this.streamMessage.bind(this),
      config as Record<string, unknown>
    );
  }

  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: GeminiChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    const request = buildRequest(messages, geminiConfig, config);

    // Log the actual Gemini request
    debugLog('GeminiProvider', '=== Gemini Request ===');
    debugLog('GeminiProvider', JSON.stringify(request, null, 2));
    debugLog('GeminiProvider', '=====================');

    const url = buildApiUrl(
      `/models/${geminiConfig.model}:streamGenerateContent`,
      geminiConfig.apiKey,
      geminiConfig.endpoint
    );
    if (!this.getTransport()) throw new Error('Transport not available');
    yield* this.streamWithTransport(url, request, config, geminiConfig);
  }

  private async *streamWithTransport(
    url: string,
    request: GeminiRequest,
    config?: GeminiChatConfig,
    geminiConfig?: GeminiConfig
  ): AsyncIterable<StreamChunk> {
    const transport = this.getTransport();
    if (!transport || !geminiConfig) throw new Error('Transport or config not available');
    let lastFinishReason: FinishReason = null;
    yield* withErrorHandlingGenerator(async function* () {
      const transportRequest = {
        url,
        method: 'POST' as const,
        headers: buildHeaders(geminiConfig.apiKey),
        body: JSON.stringify(request),
        stream: true,
        signal: config?.signal,
      };
      const processor = new GeminiStreamProcessor();
      const decoder = new TextDecoder();
      for await (const chunk of transport.stream(transportRequest)) {
        if (config?.signal?.aborted) throw new Error('Request aborted');
        const textChunk = decoder.decode(chunk, { stream: true });
        const objects = processor.processChunk(textChunk);
        for (const item of objects) {
          const streamChunk = convertToStreamChunk(item, geminiConfig.model);
          const processedChunk = processStreamChunk(streamChunk, config, geminiConfig.showThoughts);
          if (processedChunk.choices[0]?.finishReason)
            lastFinishReason = processedChunk.choices[0].finishReason;
          const hasContent = processedChunk.choices[0]?.delta?.content;
          const hasThinking = processedChunk.choices[0]?.delta?.thinking;
          const isCompletion = processedChunk.choices[0]?.finishReason;
          const hasMetadata = processedChunk.metadata?.['searchResults'];
          if (hasContent || hasThinking || isCompletion || hasMetadata) yield processedChunk;
        }
      }
      if (lastFinishReason) {
        yield {
          id: `gemini-complete-${Date.now()}`,
          object: 'response.chunk',
          created: Math.floor(Date.now() / 1000),
          model: geminiConfig.model,
          choices: [{ index: 0, delta: {}, finishReason: lastFinishReason }],
        } as StreamChunk;
      }
    });
  }

  getModels(): ModelConfig[] {
    return getModelsByProvider('gemini');
  }
  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }
  formatError(error: unknown): ProviderError {
    return {
      type: 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'UNKNOWN_ERROR',
      provider: 'gemini',
    } as ProviderError;
  }
}
