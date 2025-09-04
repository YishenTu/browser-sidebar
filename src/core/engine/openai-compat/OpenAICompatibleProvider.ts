import { BaseEngine } from '../BaseEngine';
import { OpenAICompatClient } from './OpenAICompatClient';
import { buildRequest } from '@/core/ai/openai-compat/requestBuilder';
import { processStreamChunk } from '@/core/ai/openai-compat/streamProcessor';
import { mapErrorToProviderError } from '@/core/ai/openai-compat/errorHandler';
import { getModelsByProvider, isBuiltInPreset } from '@/config/models';
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

export class OpenAICompatibleProvider extends BaseEngine {
  private client: OpenAICompatClient | null = null;
  private compatConfig: OpenAICompatibleConfig | null = null;
  private providerId: string = 'openai_compat';

  constructor() {
    super('openai_compat', 'OpenAI-Compatible', {
      streaming: true,
      temperature: true,
      reasoning: true,
      thinking: false,
      multimodal: false,
      functionCalling: false,
      maxContextLength: 128000,
      supportedModels: [],
    });
  }

  async initialize(config: ProviderConfig): Promise<void> {
    if (config.type !== 'openai_compat')
      throw new Error('Invalid configuration type for OpenAI-Compatible provider');
    const validation = this.validateConfig(config.config);
    if (!validation.isValid)
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    this.compatConfig = config.config as OpenAICompatibleConfig;
    this.client = new OpenAICompatClient(this.compatConfig);
    const metadata = (config.config as { metadata?: { providerId?: string } })['metadata'];
    if (metadata?.providerId) this.providerId = metadata.providerId;
    if (isBuiltInPreset(this.providerId))
      this.capabilities.supportedModels = getModelsByProvider(this.providerId).map(m => m.id);
    else this.capabilities.supportedModels = [this.compatConfig.model];
    this.setConfig(config);
    if (!(await this.hasRequiredConfig()))
      throw new Error('Missing required configuration for OpenAI-Compatible provider');
  }

  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    return validateOpenAICompatibleConfig(config);
  }
  async hasRequiredConfig(): Promise<boolean> {
    return !!(this.compatConfig && this.compatConfig.apiKey && this.compatConfig.baseURL);
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
    if (!this.client || !this.compatConfig) throw new Error('Provider not initialized');
    try {
      const request = buildRequest({
        messages,
        config: this.compatConfig,
        systemPrompt: config?.systemPrompt,
      });

      // OpenAI-Compatible request logging removed for production

      const stream = this.client.streamCompletion(
        request as unknown as Record<string, unknown>,
        config?.signal
      );
      for await (const raw of stream) {
        const processed = processStreamChunk(raw);
        if (processed) yield processed;
      }
    } catch (error) {
      const formatted = this.formatError(error);
      const err = new Error(formatted.message) as Error & typeof formatted;
      Object.assign(err, formatted);
      throw err;
    }
  }

  getModels(): ModelConfig[] {
    if (isBuiltInPreset(this.providerId)) return getModelsByProvider(this.providerId);
    if (this.compatConfig) {
      const metadata = (
        this.compatConfig as OpenAICompatibleConfig & { metadata?: { modelName?: string } }
      )['metadata'];
      const modelName = metadata?.modelName || this.compatConfig.model;
      return [
        { id: this.compatConfig.model, name: modelName, provider: 'openai_compat' } as ModelConfig,
      ];
    }
    return [];
  }
  getModel(id: string): ModelConfig | undefined {
    return this.getModels().find(m => m.id === id);
  }
  formatError(error: unknown): ProviderError {
    return mapErrorToProviderError(error);
  }
}
