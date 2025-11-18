/**
 * Engine Compatibility: Provider Factory
 */
import { OpenAIProvider } from './openai/OpenAIProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import { OpenRouterProvider } from './openrouter/OpenRouterProvider';
import { OpenAICompatibleProvider } from './openai-compat/OpenAICompatibleProvider';
import { GrokProvider } from './grok/GrokProvider';
import { EngineRegistry } from './EngineRegistry';
import { getModelById, getDefaultModelForProvider } from '@/config/models';
import { DirectFetchTransport } from '@/transport/DirectFetchTransport';
import type { Transport } from '@/transport/types';
import type {
  ProviderType,
  ProviderConfig,
  AIProvider,
  OpenAIConfig,
  GeminiConfig,
  OpenRouterConfig,
  ProviderValidationResult,
} from '@/types/providers';
import {
  validateOpenAIConfig,
  validateGeminiConfig,
  validateOpenRouterConfig,
  validateOpenAICompatibleConfig,
  validateGrokConfig,
  isProviderType,
} from '@/types/providers';

export class EngineFactory {
  private static readonly SUPPORTED_PROVIDERS: ProviderType[] = [
    'openai',
    'gemini',
    'openrouter',
    'openai_compat',
    'grok',
  ] as ProviderType[];

  async createProvider(config: ProviderConfig): Promise<AIProvider> {
    if (!this.isProviderSupported(config.type)) {
      throw new Error(`Unsupported provider type: ${config.type}`);
    }
    if (!config.config || typeof config.config !== 'object') {
      throw new Error('Invalid provider configuration: config object is required');
    }
    const transport: Transport | undefined = new DirectFetchTransport();
    let provider: AIProvider;
    switch (config.type) {
      case 'openai':
        provider = new OpenAIProvider(transport);
        break;
      case 'gemini':
        provider = new GeminiProvider(transport);
        break;
      case 'openrouter':
        provider = new OpenRouterProvider(transport);
        break;
      case 'openai_compat':
        provider = new OpenAICompatibleProvider();
        break;
      case 'grok':
        provider = new GrokProvider(transport);
        break;
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
    try {
      await provider.initialize(config);
      return provider;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error during provider initialization';
      throw new Error(`Failed to initialize ${config.type} provider: ${message}`);
    }
  }

  async createAndRegister(config: ProviderConfig, registry: EngineRegistry): Promise<AIProvider> {
    const provider = await this.createProvider(config);
    const success = registry.register(provider);
    if (!success) throw new Error('Failed to register provider in registry');
    return provider;
  }

  getSupportedProviders(): ProviderType[] {
    return [...EngineFactory.SUPPORTED_PROVIDERS];
  }
  isProviderSupported(type: unknown): type is ProviderType {
    return !!(
      type &&
      typeof type === 'string' &&
      isProviderType(type) &&
      EngineFactory.SUPPORTED_PROVIDERS.includes(type as ProviderType)
    );
  }

  validateConfiguration(config: ProviderConfig): ProviderValidationResult {
    if (!this.isProviderSupported(config.type))
      return { isValid: false, errors: [`Unsupported provider type: ${config.type}`] };
    if (!config.config || typeof config.config !== 'object')
      return {
        isValid: false,
        errors: ['Invalid provider configuration: config object is required'],
      };
    switch (config.type) {
      case 'openai':
        return validateOpenAIConfig(config.config);
      case 'gemini':
        return validateGeminiConfig(config.config);
      case 'openrouter':
        return validateOpenRouterConfig(config.config);
      case 'openai_compat':
        return validateOpenAICompatibleConfig(config.config);
      case 'grok':
        return validateGrokConfig(config.config);
      default:
        return { isValid: false, errors: [`Unsupported provider type: ${config.type}`] };
    }
  }

  async createOpenAIProvider(config: OpenAIConfig): Promise<OpenAIProvider> {
    const providerConfig: ProviderConfig = { type: 'openai', config };
    const provider = await this.createProvider(providerConfig);
    return provider as unknown as OpenAIProvider;
  }
  async createGeminiProvider(config: GeminiConfig): Promise<GeminiProvider> {
    const providerConfig: ProviderConfig = { type: 'gemini', config };
    const provider = await this.createProvider(providerConfig);
    return provider as unknown as GeminiProvider;
  }
  async createProviders(configs: ProviderConfig[]): Promise<AIProvider[]> {
    const providers: AIProvider[] = [];
    const errors: string[] = [];
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      if (!config) {
        errors.push(`Provider ${i}: Configuration is missing`);
        continue;
      }
      try {
        const provider = await this.createProvider(config);
        providers.push(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Provider ${i} (${config.type}): ${message}`);
      }
    }
    if (errors.length > 0)
      throw new Error(`Failed to create some providers:\n${errors.join('\n')}`);
    return providers;
  }
  async createAndRegisterProviders(
    configs: ProviderConfig[],
    registry: EngineRegistry
  ): Promise<AIProvider[]> {
    const providers: AIProvider[] = [];
    const errors: string[] = [];
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      if (!config) {
        errors.push(`Provider ${i}: Configuration is missing`);
        continue;
      }
      try {
        const provider = await this.createAndRegister(config, registry);
        providers.push(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Provider ${i} (${config.type}): ${message}`);
      }
    }
    if (errors.length > 0)
      throw new Error(`Failed to create and register some providers:\n${errors.join('\n')}`);
    return providers;
  }
  createDefaultOpenAIConfig(apiKey: string, model?: string): OpenAIConfig {
    const defaultModel = model || getDefaultModelForProvider('openai')!;
    const modelConfig = getModelById(defaultModel);
    return {
      apiKey,
      model: defaultModel,
      reasoningEffort: modelConfig?.reasoningEffort || 'low',
    } as OpenAIConfig;
  }
  createDefaultGeminiConfig(apiKey: string, model?: string): GeminiConfig {
    const defaultModel = model || getDefaultModelForProvider('gemini')!;
    const modelCfg = getModelById(defaultModel);
    return {
      apiKey,
      model: defaultModel,
      thinkingBudget: (modelCfg?.thinkingBudget as number | undefined) ?? -1,
    } as GeminiConfig;
  }
  async createOpenRouterProvider(config: OpenRouterConfig): Promise<OpenRouterProvider> {
    const providerConfig: ProviderConfig = { type: 'openrouter', config };
    const provider = await this.createProvider(providerConfig);
    return provider as unknown as OpenRouterProvider;
  }
  createDefaultOpenRouterConfig(apiKey: string, model?: string): OpenRouterConfig {
    const defaultModel = model || getDefaultModelForProvider('openrouter')!;
    return { apiKey, model: defaultModel, reasoning: { effort: 'medium' } } as OpenRouterConfig;
  }
}
