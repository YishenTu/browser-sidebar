/**
 * @file Provider Factory
 *
 * Factory class for creating and configuring AI provider instances.
 * Supports OpenAI and Gemini providers with their specific
 * configuration parameters including reasoning_effort and thinking_budget.
 *
 * Features:
 * - Type-safe provider creation based on provider type
 * - Configuration validation before provider instantiation
 * - Support for all provider-specific parameters
 * - Integration with ProviderRegistry for automatic registration
 * - Error handling for invalid configurations and unsupported types
 * - Utility methods for checking supported provider types
 */

import { OpenAIProvider } from './openai/OpenAIProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import { OpenRouterProvider } from './openrouter/OpenRouterProvider';
import { ProviderRegistry } from './ProviderRegistry';
import { getModelById } from '../config/models';
import type {
  ProviderType,
  ProviderConfig,
  AIProvider,
  OpenAIConfig,
  GeminiConfig,
  OpenRouterConfig,
  ProviderValidationResult,
} from '../types/providers';
import {
  validateOpenAIConfig,
  validateGeminiConfig,
  validateOpenRouterConfig,
  isProviderType,
} from '../types/providers';

// ============================================================================
// Provider Factory Class
// ============================================================================

/**
 * Factory for creating and configuring AI provider instances
 */
export class ProviderFactory {
  private static readonly SUPPORTED_PROVIDERS: ProviderType[] = ['openai', 'gemini', 'openrouter'];

  // ============================================================================
  // Provider Creation
  // ============================================================================

  /**
   * Create a provider instance based on configuration
   * @param config Provider configuration including type and settings
   * @returns Configured provider instance
   * @throws Error if provider type is unsupported or configuration is invalid
   */
  async createProvider(config: ProviderConfig): Promise<AIProvider> {
    // Validate provider type
    if (!this.isProviderSupported(config.type)) {
      throw new Error(`Unsupported provider type: ${config.type}`);
    }

    // Validate configuration structure
    if (!config.config || typeof config.config !== 'object') {
      throw new Error('Invalid provider configuration: config object is required');
    }

    // Create provider instance based on type
    let provider: AIProvider;

    switch (config.type) {
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'gemini':
        provider = new GeminiProvider();
        break;
      case 'openrouter':
        provider = new OpenRouterProvider();
        break;
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }

    try {
      // Initialize provider with configuration
      await provider.initialize(config);
      return provider;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error during provider initialization';
      throw new Error(`Failed to initialize ${config.type} provider: ${message}`);
    }
  }

  /**
   * Create a provider and register it with the given registry
   * @param config Provider configuration
   * @param registry Registry to register the provider with
   * @returns The created and registered provider
   * @throws Error if creation or registration fails
   */
  async createAndRegister(config: ProviderConfig, registry: ProviderRegistry): Promise<AIProvider> {
    try {
      // Create the provider
      const provider = await this.createProvider(config);

      // Register with the registry
      const success = registry.register(provider);
      if (!success) {
        throw new Error(`Failed to register provider in registry`);
      }

      return provider;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during provider creation and registration';
      throw new Error(`Failed to create and register ${config.type} provider: ${message}`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get list of supported provider types
   * @returns Array of supported provider type strings
   */
  getSupportedProviders(): ProviderType[] {
    return [...ProviderFactory.SUPPORTED_PROVIDERS];
  }

  /**
   * Check if a provider type is supported
   * @param type Provider type to check
   * @returns True if the provider type is supported
   */
  isProviderSupported(type: unknown): type is ProviderType {
    if (!type || typeof type !== 'string') {
      return false;
    }
    return isProviderType(type) && ProviderFactory.SUPPORTED_PROVIDERS.includes(type);
  }

  // ============================================================================
  // Configuration Validation
  // ============================================================================

  /**
   * Validate a provider configuration without creating the provider
   * @param config Provider configuration to validate
   * @returns Validation result with success status and error details
   */
  validateConfiguration(config: ProviderConfig): ProviderValidationResult {
    // Validate provider type
    if (!this.isProviderSupported(config.type)) {
      return {
        isValid: false,
        errors: [`Unsupported provider type: ${config.type}`],
      };
    }

    // Validate configuration structure
    if (!config.config || typeof config.config !== 'object') {
      return {
        isValid: false,
        errors: ['Invalid provider configuration: config object is required'],
      };
    }

    // Validate type-specific configuration
    switch (config.type) {
      case 'openai':
        return validateOpenAIConfig(config.config);
      case 'gemini':
        return validateGeminiConfig(config.config);
      case 'openrouter':
        return validateOpenRouterConfig(config.config);
      default:
        return {
          isValid: false,
          errors: [`Unsupported provider type: ${config.type}`],
        };
    }
  }

  // ============================================================================
  // Provider-Specific Factory Methods
  // ============================================================================

  /**
   * Create an OpenAI provider with specific configuration
   * @param config OpenAI-specific configuration
   * @returns Configured OpenAI provider
   */
  async createOpenAIProvider(config: OpenAIConfig): Promise<OpenAIProvider> {
    const providerConfig: ProviderConfig = {
      type: 'openai',
      config,
    };
    const provider = await this.createProvider(providerConfig);
    // We know this is an OpenAIProvider because we passed type: 'openai'
    return provider as unknown as OpenAIProvider;
  }

  /**
   * Create a Gemini provider with specific configuration
   * @param config Gemini-specific configuration
   * @returns Configured Gemini provider
   */
  async createGeminiProvider(config: GeminiConfig): Promise<GeminiProvider> {
    const providerConfig: ProviderConfig = {
      type: 'gemini',
      config,
    };
    const provider = await this.createProvider(providerConfig);
    // We know this is a GeminiProvider because we passed type: 'gemini'
    return provider as unknown as GeminiProvider;
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Create multiple providers from an array of configurations
   * @param configs Array of provider configurations
   * @returns Array of created providers
   * @throws Error if any provider creation fails
   */
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

    if (errors.length > 0) {
      throw new Error(`Failed to create some providers:\n${errors.join('\n')}`);
    }

    return providers;
  }

  /**
   * Create and register multiple providers
   * @param configs Array of provider configurations
   * @param registry Registry to register providers with
   * @returns Array of created and registered providers
   * @throws Error if any provider creation or registration fails
   */
  async createAndRegisterProviders(
    configs: ProviderConfig[],
    registry: ProviderRegistry
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

    if (errors.length > 0) {
      throw new Error(`Failed to create and register some providers:\n${errors.join('\n')}`);
    }

    return providers;
  }

  // ============================================================================
  // Default Configuration Generators
  // ============================================================================

  /**
   * Generate default OpenAI configuration
   * @param apiKey API key for OpenAI
   * @param model Model to use (defaults to gpt-4o)
   * @returns Default OpenAI configuration
   */
  createDefaultOpenAIConfig(apiKey: string, model: string = 'gpt-5-nano'): OpenAIConfig {
    // Get reasoning effort from model config
    const modelConfig = getModelById(model);
    return {
      apiKey,
      model,
      reasoningEffort: modelConfig?.reasoningEffort || 'low',
    };
  }

  /**
   * Generate default Gemini configuration
   * @param apiKey API key for Gemini
   * @param model Model to use (defaults to gemini-2.0-flash-thinking-exp)
   * @returns Default Gemini configuration
   */
  createDefaultGeminiConfig(apiKey: string, model: string = 'gemini-2.5-flash-lite'): GeminiConfig {
    return {
      apiKey,
      model,
      thinkingBudget: '0',
      showThoughts: false,
    };
  }

  /**
   * Create an OpenRouter provider with specific configuration
   * @param config OpenRouter-specific configuration
   * @returns Configured OpenRouter provider
   */
  async createOpenRouterProvider(config: OpenRouterConfig): Promise<OpenRouterProvider> {
    const providerConfig: ProviderConfig = {
      type: 'openrouter',
      config,
    };
    const provider = await this.createProvider(providerConfig);
    // We know this is an OpenRouterProvider because we passed type: 'openrouter'
    return provider as unknown as OpenRouterProvider;
  }

  /**
   * Generate default OpenRouter configuration
   * @param apiKey API key for OpenRouter
   * @param model Model to use (defaults to anthropic/claude-sonnet-4)
   * @returns Default OpenRouter configuration
   */
  createDefaultOpenRouterConfig(
    apiKey: string,
    model: string = 'anthropic/claude-sonnet-4'
  ): OpenRouterConfig {
    return {
      apiKey,
      model,
      reasoning: {
        effort: 'medium',
      },
    };
  }
}
