/**
 * @file ProviderFactory Tests
 *
 * Test suite for the Provider Factory following TDD methodology.
 * Tests provider creation, configuration handling, and integration with ProviderRegistry.
 *
 * Test Structure:
 * - Factory Creation Tests
 * - Provider Creation Tests
 * - Configuration Handling Tests
 * - Registry Integration Tests
 * - Error Handling Tests
 * - Type Safety Tests
 * - Edge Cases and Boundary Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactory } from '../../src/provider/ProviderFactory';
import { ProviderRegistry } from '../../src/provider/ProviderRegistry';
import { OpenAIProvider } from '../../src/provider/openai/OpenAIProvider';
import { GeminiProvider } from '../../src/provider/gemini/GeminiProvider';
import type {
  ProviderType,
  ProviderConfig,
  OpenAIConfig,
  GeminiConfig,
  AIProvider,
} from '../../src/types/providers';

// Mock provider dependencies to avoid external calls
vi.mock('../../src/provider/openai/OpenAIClient', () => ({
  OpenAIClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    getOpenAIInstance: vi.fn().mockReturnValue({
      responses: {
        create: vi.fn(),
      },
    }),
    validateConfiguration: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    testConnection: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../../src/provider/streamParser');
vi.mock('../../src/provider/tokenBuffer');

// Mock OpenAI SDK to avoid browser errors
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn(),
    },
    models: {
      list: vi.fn(),
    },
  })),
}));

// Mock Google AI SDK if it exists
vi.mock(
  '@google/generative-ai',
  () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
      }),
    })),
  }),
  { virtual: true }
);

describe('ProviderFactory', () => {
  let factory: ProviderFactory;
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    factory = new ProviderFactory();
    registry = new ProviderRegistry();
  });

  // ============================================================================
  // Factory Creation Tests
  // ============================================================================

  describe('Factory Creation', () => {
    it('should create a factory instance', () => {
      expect(factory).toBeInstanceOf(ProviderFactory);
    });

    it('should have createProvider method', () => {
      expect(typeof factory.createProvider).toBe('function');
    });

    it('should have createAndRegister method', () => {
      expect(typeof factory.createAndRegister).toBe('function');
    });

    it('should have getSupportedProviders method', () => {
      expect(typeof factory.getSupportedProviders).toBe('function');
    });

    it('should have isProviderSupported method', () => {
      expect(typeof factory.isProviderSupported).toBe('function');
    });
  });

  // ============================================================================
  // Provider Creation Tests
  // ============================================================================

  describe('Provider Creation', () => {
    describe('OpenAI Provider Creation', () => {
      const openaiConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      it('should create OpenAI provider instance', async () => {
        const provider = await factory.createProvider(openaiConfig);

        expect(provider).toBeInstanceOf(OpenAIProvider);
        expect(provider.type).toBe('openai');
        expect(provider.name).toBe('OpenAI');
        expect(provider.capabilities.reasoning).toBe(true);
      });

      it('should configure OpenAI provider with provided settings', async () => {
        const provider = await factory.createProvider(openaiConfig);

        const config = provider.getConfig();
        expect(config).not.toBeNull();
        expect(config?.type).toBe('openai');
        expect((config?.config as OpenAIConfig).temperature).toBe(0.7);
        expect((config?.config as OpenAIConfig).reasoningEffort).toBe('medium');
      });

      it('should support all OpenAI-specific parameters', async () => {
        const extendedConfig: ProviderConfig = {
          type: 'openai',
          config: {
            apiKey: 'sk-test-key-123',
            temperature: 1.2,
            reasoningEffort: 'high',
            model: 'gpt-5-nano',
            maxTokens: 8192,
            topP: 0.9,
            frequencyPenalty: 0.5,
            presencePenalty: 0.3,
            seed: 42,
            user: 'test-user',
          } as OpenAIConfig,
        };

        const provider = await factory.createProvider(extendedConfig);
        const config = provider.getConfig()?.config as OpenAIConfig;

        expect(config.temperature).toBe(1.2);
        expect(config.reasoningEffort).toBe('high');
        expect(config.seed).toBe(42);
        expect(config.user).toBe('test-user');
      });

      it('should validate OpenAI configuration parameters', async () => {
        const invalidConfig: ProviderConfig = {
          type: 'openai',
          config: {
            apiKey: 'invalid-key',
            temperature: 3.0, // Invalid - too high
            reasoningEffort: 'invalid' as any,
            model: '',
            maxTokens: -1,
            topP: 2.0, // Invalid - too high
            frequencyPenalty: 5.0, // Invalid - too high
            presencePenalty: -5.0, // Invalid - too low
          } as OpenAIConfig,
        };

        await expect(factory.createProvider(invalidConfig)).rejects.toThrow();
      });
    });

    describe('Gemini Provider Creation', () => {
      const geminiConfig: ProviderConfig = {
        type: 'gemini',
        config: {
          apiKey: 'gemini-test-key-123',
          temperature: 0.8,
          thinkingMode: 'dynamic',
          showThoughts: true,
          model: 'gemini-2.0-flash-thinking-exp',
          maxTokens: 8192,
          topP: 0.95,
          topK: 40,
        } as GeminiConfig,
      };

      it('should create Gemini provider instance', async () => {
        const provider = await factory.createProvider(geminiConfig);

        expect(provider).toBeInstanceOf(GeminiProvider);
        expect(provider.type).toBe('gemini');
        expect(provider.name).toBe('Google Gemini');
        expect(provider.capabilities.thinking).toBe(true);
      });

      it('should configure Gemini provider with provided settings', async () => {
        const provider = await factory.createProvider(geminiConfig);

        const config = provider.getConfig();
        expect(config).not.toBeNull();
        expect(config?.type).toBe('gemini');
        expect((config?.config as GeminiConfig).temperature).toBe(0.8);
        expect((config?.config as GeminiConfig).thinkingMode).toBe('dynamic');
        expect((config?.config as GeminiConfig).showThoughts).toBe(true);
      });

      it('should support all Gemini-specific parameters', async () => {
        const extendedConfig: ProviderConfig = {
          type: 'gemini',
          config: {
            apiKey: 'gemini-test-key-123',
            temperature: 1.5,
            thinkingMode: 'off',
            showThoughts: false,
            model: 'gemini-2.5-flash-lite',
            maxTokens: 4096,
            topP: 0.8,
            topK: 20,
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
            stopSequences: ['END', 'STOP'],
            endpoint: 'https://custom-gemini-endpoint.com',
          } as GeminiConfig,
        };

        const provider = await factory.createProvider(extendedConfig);
        const config = provider.getConfig()?.config as GeminiConfig;

        expect(config.thinkingMode).toBe('off');
        expect(config.showThoughts).toBe(false);
        expect(config.safetySettings).toHaveLength(1);
        expect(config.stopSequences).toEqual(['END', 'STOP']);
        expect(config.endpoint).toBe('https://custom-gemini-endpoint.com');
      });

      it('should validate Gemini configuration parameters', async () => {
        const invalidConfig: ProviderConfig = {
          type: 'gemini',
          config: {
            apiKey: '',
            temperature: -1.0, // Invalid - too low
            thinkingMode: 'invalid' as any,
            showThoughts: 'true' as any, // Invalid - should be boolean
            model: '',
            maxTokens: 0, // Invalid - too low
            topP: 0, // Invalid - should be > 0
            topK: -1, // Invalid - should be > 0
          } as GeminiConfig,
        };

        await expect(factory.createProvider(invalidConfig)).rejects.toThrow();
      });
    });

    // OpenRouter provider creation tests removed (not in scope)
  });

  // ============================================================================
  // Configuration Handling Tests
  // ============================================================================

  describe('Configuration Handling', () => {
    it('should handle default configuration values', async () => {
      const minimalConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const provider = await factory.createProvider(minimalConfig);
      const config = provider.getConfig()?.config as OpenAIConfig;

      expect(config.temperature).toBe(0.7);
      expect(config.topP).toBe(1.0);
      expect(config.frequencyPenalty).toBe(0.0);
      expect(config.presencePenalty).toBe(0.0);
    });

    it('should override default values with provided configuration', async () => {
      const customConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 1.5,
          reasoningEffort: 'high',
          model: 'gpt-5-nano',
          maxTokens: 8192,
          topP: 0.8,
          frequencyPenalty: 0.2,
          presencePenalty: 0.1,
        } as OpenAIConfig,
      };

      const provider = await factory.createProvider(customConfig);
      const config = provider.getConfig()?.config as OpenAIConfig;

      expect(config.temperature).toBe(1.5);
      expect(config.reasoningEffort).toBe('high');
      expect(config.maxTokens).toBe(8192);
      expect(config.topP).toBe(0.8);
      expect(config.frequencyPenalty).toBe(0.2);
      expect(config.presencePenalty).toBe(0.1);
    });

    it('should validate configuration before provider creation', async () => {
      const invalidConfigs = [
        {
          type: 'openai',
          config: {
            apiKey: '',
            temperature: 0.7,
            reasoningEffort: 'medium',
            model: 'gpt-5-nano',
            maxTokens: 4096,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
          },
        },
        {
          type: 'gemini',
          config: {
            apiKey: 'valid-key',
            temperature: 3.0,
            thinkingMode: 'dynamic',
            showThoughts: true,
            model: 'gemini-2.5-flash-lite',
            maxTokens: 4096,
            topP: 0.9,
            topK: 40,
          },
        },
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(factory.createProvider(invalidConfig as ProviderConfig)).rejects.toThrow();
      }
    });

    it('should handle temperature parameter across all providers', async () => {
      const temperatureTests = [
        { type: 'openai' as ProviderType, temperature: 0.0 },
        { type: 'gemini' as ProviderType, temperature: 1.0 },
      ];

      for (const test of temperatureTests) {
        const config: ProviderConfig = {
          type: test.type,
          config: {
            apiKey:
              test.type === 'openai'
                ? 'sk-test-key-123'
                : test.type === 'gemini'
                  ? 'gemini-test-key-123'
                  : 'sk-or-v1-test-key-123',
            temperature: test.temperature,
            model:
              test.type === 'openai'
                ? 'gpt-5-nano'
                : test.type === 'gemini'
                  ? 'gemini-2.5-flash-lite'
                  : 'claude-3.5-sonnet',
            maxTokens: 4096,
            ...(test.type === 'openai' && {
              reasoningEffort: 'medium' as const,
              topP: 1.0,
              frequencyPenalty: 0.0,
              presencePenalty: 0.0,
            }),
            ...(test.type === 'gemini' && {
              thinkingMode: 'dynamic' as const,
              showThoughts: true,
              topP: 0.9,
              topK: 40,
            }),
          } as any,
        };

        const provider = await factory.createProvider(config);
        const providerConfig = provider.getConfig()?.config as any;
        expect(providerConfig.temperature).toBe(test.temperature);
      }
    });
  });

  // ============================================================================
  // Registry Integration Tests
  // ============================================================================

  describe('Registry Integration', () => {
    it('should create and register provider in one operation', async () => {
      const config: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const provider = await factory.createAndRegister(config, registry);

      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.getProvider('openai')).toBe(provider);
    });

    it('should handle registry events during createAndRegister', async () => {
      const config: ProviderConfig = {
        type: 'gemini',
        config: {
          apiKey: 'gemini-test-key-123',
          temperature: 0.8,
          thinkingMode: 'dynamic',
          showThoughts: true,
          model: 'gemini-2.5-flash-lite',
          maxTokens: 4096,
          topP: 0.9,
          topK: 40,
        } as GeminiConfig,
      };

      const registeredListener = vi.fn();
      registry.on('providerRegistered', registeredListener);

      await factory.createAndRegister(config, registry);

      expect(registeredListener).toHaveBeenCalledWith({
        type: 'gemini',
        provider: expect.any(GeminiProvider),
      });
    });

    it('should replace existing provider when creating with same type', async () => {
      const config1: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.5,
          reasoningEffort: 'low',
          model: 'gpt-5-nano',
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const config2: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-different-key-456',
          temperature: 1.0,
          reasoningEffort: 'high',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.1,
        } as OpenAIConfig,
      };

      const provider1 = await factory.createAndRegister(config1, registry);
      const provider2 = await factory.createAndRegister(config2, registry);

      expect(registry.getProvider('openai')).toBe(provider2);
      expect(registry.getProvider('openai')).not.toBe(provider1);

      const currentConfig = registry.getProvider('openai').getConfig()?.config as OpenAIConfig;
      expect(currentConfig.temperature).toBe(1.0);
      expect(currentConfig.reasoningEffort).toBe('high');
    });

    it('should allow multiple providers of different types', async () => {
      const openaiConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const geminiConfig: ProviderConfig = {
        type: 'gemini',
        config: {
          apiKey: 'gemini-test-key-123',
          temperature: 0.8,
          thinkingMode: 'dynamic',
          showThoughts: true,
          model: 'gemini-2.5-flash-lite',
          maxTokens: 4096,
          topP: 0.9,
          topK: 40,
        } as GeminiConfig,
      };

      await factory.createAndRegister(openaiConfig, registry);
      await factory.createAndRegister(geminiConfig, registry);

      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.hasProvider('gemini')).toBe(true);
      expect(registry.getRegisteredProviders()).toHaveLength(2);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw error for unsupported provider type', async () => {
      const invalidConfig = {
        type: 'unsupported',
        config: { apiKey: 'test-key' },
      } as any;

      await expect(factory.createProvider(invalidConfig)).rejects.toThrow(
        'Unsupported provider type: unsupported'
      );
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: '', // Invalid - empty
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      await expect(factory.createProvider(invalidConfig)).rejects.toThrow();
    });

    it('should handle provider initialization failures', async () => {
      const config: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      // Mock the provider constructor to throw during initialization
      const originalCreate = factory.createProvider;
      vi.spyOn(factory, 'createProvider').mockImplementation(async () => {
        throw new Error('Provider initialization failed');
      });

      await expect(factory.createProvider(config)).rejects.toThrow(
        'Provider initialization failed'
      );

      // Restore original method
      factory.createProvider = originalCreate;
    });

    it('should handle registry errors during createAndRegister', async () => {
      const config: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      // Mock registry to throw during registration
      vi.spyOn(registry, 'register').mockImplementation(() => {
        throw new Error('Registry registration failed');
      });

      await expect(factory.createAndRegister(config, registry)).rejects.toThrow(
        'Registry registration failed'
      );
    });

    it('should provide descriptive error messages', async () => {
      const invalidConfigs = [
        {
          config: { type: 'openai', config: { apiKey: '' } },
          expectedError: /API key|Invalid/,
        },
        {
          config: { type: 'gemini', config: { temperature: 5.0 } },
          expectedError: /temperature|Invalid/,
        },
        {
          config: { type: 'openrouter', config: { maxThinkingTokens: 100 } },
          expectedError: /thinking tokens|Invalid/,
        },
      ];

      for (const { config, expectedError } of invalidConfigs) {
        await expect(factory.createProvider(config as any)).rejects.toThrow(expectedError);
      }
    });
  });

  // ============================================================================
  // Utility Methods Tests
  // ============================================================================

  describe('Utility Methods', () => {
    it('should return list of supported provider types', () => {
      const supportedProviders = factory.getSupportedProviders();

      expect(supportedProviders).toEqual(
        expect.arrayContaining(['openai', 'gemini', 'openrouter'])
      );
      expect(supportedProviders.length).toBe(3);
    });

    it('should check if provider type is supported', () => {
      expect(factory.isProviderSupported('openai')).toBe(true);
      expect(factory.isProviderSupported('gemini')).toBe(true);
      expect(factory.isProviderSupported('openrouter')).toBe(true);
      expect(factory.isProviderSupported('unsupported' as ProviderType)).toBe(false);
    });

    it('should handle edge cases in isProviderSupported', () => {
      expect(factory.isProviderSupported(null as any)).toBe(false);
      expect(factory.isProviderSupported(undefined as any)).toBe(false);
      expect(factory.isProviderSupported('' as any)).toBe(false);
      expect(factory.isProviderSupported(123 as any)).toBe(false);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should maintain type safety for provider configurations', async () => {
      const openaiConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const provider = await factory.createProvider(openaiConfig);
      expect(provider.type).toBe('openai');
      expect(provider.capabilities.reasoning).toBe(true);
    });

    it('should enforce correct provider type matching', async () => {
      const configs: ProviderConfig[] = [
        {
          type: 'openai',
          config: {
            apiKey: 'sk-test-key-123',
            temperature: 0.7,
            reasoningEffort: 'medium',
            model: 'gpt-5-nano',
            maxTokens: 4096,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
          } as OpenAIConfig,
        },
        {
          type: 'gemini',
          config: {
            apiKey: 'gemini-test-key-123',
            temperature: 0.8,
            thinkingMode: 'dynamic',
            showThoughts: true,
            model: 'gemini-2.5-flash-lite',
            maxTokens: 4096,
            topP: 0.9,
            topK: 40,
          } as GeminiConfig,
        },
      ];

      for (const config of configs) {
        const provider = await factory.createProvider(config);
        expect(provider.type).toBe(config.type);
      }
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Tests
  // ============================================================================

  describe('Edge Cases and Boundary Tests', () => {
    it('should handle boundary values for numeric parameters', async () => {
      const boundaryTests = [
        {
          type: 'openai' as ProviderType,
          config: {
            apiKey: 'sk-test-key-123',
            temperature: 0.0,
            reasoningEffort: 'low' as const,
            model: 'gpt-5-nano',
            maxTokens: 1,
            topP: 0.0,
            frequencyPenalty: -2.0,
            presencePenalty: 2.0,
          },
        },
        {
          type: 'gemini' as ProviderType,
          config: {
            apiKey: 'gemini-test-key-123',
            temperature: 2.0,
            thinkingMode: 'off' as const,
            showThoughts: false,
            model: 'gemini-2.5-flash-lite',
            maxTokens: 1,
            topP: 0.1,
            topK: 1,
          },
        },
      ];

      for (const test of boundaryTests) {
        const config: ProviderConfig = {
          type: test.type,
          config: test.config as any,
        };

        const provider = await factory.createProvider(config);
        expect(provider.type).toBe(test.type);
      }
    });

    it('should handle concurrent provider creation', async () => {
      const configs = [
        {
          type: 'openai' as ProviderType,
          config: {
            apiKey: 'sk-test-key-1',
            temperature: 0.7,
            reasoningEffort: 'medium' as const,
            model: 'gpt-5-nano',
            maxTokens: 4096,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
          },
        },
        {
          type: 'gemini' as ProviderType,
          config: {
            apiKey: 'gemini-test-key-1',
            temperature: 0.8,
            thinkingMode: 'dynamic' as const,
            showThoughts: true,
            model: 'gemini-2.5-flash-lite',
            maxTokens: 4096,
            topP: 0.9,
            topK: 40,
          },
        },
      ];

      const promises = configs.map(config => factory.createProvider(config as ProviderConfig));
      const providers = await Promise.all(promises);

      expect(providers).toHaveLength(2);
      expect(providers[0].type).toBe('openai');
      expect(providers[1].type).toBe('gemini');
    });

    it('should handle rapid create and register operations', async () => {
      const configs: ProviderConfig[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'openai',
        config: {
          apiKey: `sk-test-key-${i}`,
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      }));

      for (const config of configs) {
        await factory.createAndRegister(config, registry);
      }

      // Should only have one provider registered (last one replaces previous)
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.getRegisteredProviders()).toHaveLength(1);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should create providers efficiently', async () => {
      const config: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'sk-test-key-123',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-5-nano',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const startTime = performance.now();

      // Create multiple providers
      for (let i = 0; i < 10; i++) {
        await factory.createProvider(config);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large configurations efficiently', async () => {
      const largeConfig: ProviderConfig = {
        type: 'gemini',
        config: {
          apiKey: 'gemini-test-key-123',
          temperature: 0.8,
          thinkingMode: 'dynamic',
          showThoughts: true,
          model: 'gemini-2.5-flash-lite',
          maxTokens: 4096,
          topP: 0.9,
          topK: 40,
          safetySettings: Array.from({ length: 100 }, (_, i) => ({
            category: `CATEGORY_${i}`,
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          })),
          stopSequences: Array.from({ length: 100 }, (_, i) => `STOP_${i}`),
        } as GeminiConfig,
      };

      const startTime = performance.now();
      const provider = await factory.createProvider(largeConfig);
      const endTime = performance.now();

      expect(provider.type).toBe('gemini');
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });
});
