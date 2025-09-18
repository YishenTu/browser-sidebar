/**
 * OpenRouter Provider (compat shim backed by transport + core)
 */
import { BaseEngine } from '../BaseEngine';
import { buildRequest } from '@/core/ai/openrouter/requestBuilder';
import { processStreamChunk } from '@/core/ai/openrouter/streamProcessor';
import { mapErrorToProviderError } from '@/core/ai/openrouter/errorHandler';
import type { OpenRouterRequestOptions } from '@/core/ai/openrouter/types';
import { getModelsByProvider, getDefaultModelForProvider } from '@/config/models';
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
import type { Transport } from '@/transport/types';
import { getExtensionId } from '@/platform/chrome/runtime';

export class OpenRouterProvider extends BaseEngine {
  private openRouterConfig: OpenRouterConfig | null = null;

  constructor(transport?: Transport) {
    super(
      'openrouter',
      'OpenRouter',
      {
        streaming: true,
        temperature: false,
        reasoning: true,
        thinking: true,
        multimodal: false,
        functionCalling: false,
        maxContextLength: 200000,
        supportedModels: getModelsByProvider('openrouter').map(m => m.id),
      },
      transport
    );
  }

  async initialize(config: ProviderConfig): Promise<void> {
    if (config.type !== 'openrouter')
      throw new Error('Invalid configuration type for OpenRouter provider');
    const validation = this.validateConfig(config.config);
    if (!validation.isValid)
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    this.openRouterConfig = config.config as OpenRouterConfig;
    this.setConfig(config);
    const hasConfig = await this.hasRequiredConfig();
    if (!hasConfig) throw new Error('Missing required configuration for OpenRouter provider');
  }

  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    return validateOpenRouterConfig(config);
  }

  async hasRequiredConfig(): Promise<boolean> {
    return !!(
      this.openRouterConfig &&
      this.openRouterConfig.apiKey &&
      this.openRouterConfig.apiKey.length > 0
    );
  }

  async *streamChat(messages: ProviderChatMessage[], config?: unknown): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      this.streamMessage.bind(this),
      config as Record<string, unknown>
    );
  }

  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: { signal?: AbortSignal; systemPrompt?: string }
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    if (!this.openRouterConfig) throw new Error('Provider not initialized');

    try {
      const request = buildRequest({
        messages,
        config: this.openRouterConfig,
        systemPrompt: config?.systemPrompt,
      });

      // OpenRouter request logging removed for production

      if (this.transport) {
        yield* this.streamViaTransport(request, config?.signal);
      } else {
        throw new Error('Transport not available');
      }
    } catch (error) {
      const formatted = this.formatError(error);
      const err = new Error(formatted.message) as Error & typeof formatted;
      Object.assign(err, formatted);
      throw err;
    }
  }

  private async *streamViaTransport(
    request: OpenRouterRequestOptions,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    if (!this.transport || !this.openRouterConfig)
      throw new Error('Transport or config not available');
    const extensionId = getExtensionId();
    const transportRequest = {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST' as const,
      headers: {
        Authorization: `Bearer ${this.openRouterConfig.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          this.openRouterConfig.headers?.referer || `chrome-extension://${extensionId}`,
        'X-Title': this.openRouterConfig.headers?.title || 'AI Browser Sidebar',
      },
      body: JSON.stringify({ ...request, stream: true }),
      stream: true,
      signal,
    };
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of this.transport.stream(transportRequest)) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const processedChunk = processStreamChunk(parsed);
            if (processedChunk) yield processedChunk;
          } catch (e) {
            // Failed to parse SSE chunk
          }
        }
      }
    }
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const processedChunk = processStreamChunk(parsed);
          if (processedChunk) yield processedChunk;
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }
  }

  getModels(): ModelConfig[] {
    return getModelsByProvider('openrouter');
  }
  getModel(id: string): ModelConfig | undefined {
    return this.getModels().find(m => m.id === id);
  }
  formatError(error: unknown): ProviderError {
    return mapErrorToProviderError(error);
  }
  getDefaultModelId(): string {
    return getDefaultModelForProvider('openrouter')!;
  }
  async updateConfig(config: OpenRouterConfig): Promise<void> {
    const validation = this.validateConfig(config);
    if (!validation.isValid)
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    this.openRouterConfig = config;
    // No client object in transport-only implementation
    this.setConfig({ type: 'openrouter', config: this.openRouterConfig });
    const hasConfig = await this.hasRequiredConfig();
    if (!hasConfig) throw new Error('Missing required configuration for OpenRouter provider');
  }
}
