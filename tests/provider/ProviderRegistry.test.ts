/**
 * @file ProviderRegistry Tests
 *
 * Test suite for the Provider Registry following TDD methodology.
 * Covers provider registration, lookup, switching, error handling, and type safety.
 *
 * Test Structure:
 * - Provider Registration Tests
 * - Provider Lookup Tests  
 * - Provider Switching Tests
 * - Error Handling Tests
 * - Type Safety Tests
 * - Edge Cases and Boundary Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRegistry } from '../../src/provider/ProviderRegistry';
import { OpenAIProvider } from '../../src/provider/openai/OpenAIProvider';
import { GeminiProvider } from '../../src/provider/gemini/GeminiProvider';
import type { AIProvider, ProviderType } from '../../src/types/providers';

// Mock providers for testing
class MockOpenAIProvider extends OpenAIProvider {
  constructor() {
    super();
  }
}

class MockGeminiProvider extends GeminiProvider {
  constructor() {
    super();
  }
}

// Custom provider (openrouter) removed – scope limited to openai/gemini

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let openaiProvider: MockOpenAIProvider;
  let geminiProvider: MockGeminiProvider;
  // no custom provider

  beforeEach(() => {
    registry = new ProviderRegistry();
    openaiProvider = new MockOpenAIProvider();
    geminiProvider = new MockGeminiProvider();
    // no custom provider init
  });

  // ============================================================================
  // Constructor and Initialization Tests
  // ============================================================================

  describe('Constructor and Initialization', () => {
    it('should create an empty registry', () => {
      expect(registry.getRegisteredProviders()).toEqual([]);
      expect(registry.getActiveProvider()).toBeNull();
    });

    it('should initialize with default settings', () => {
      expect(registry.getRegisteredProviders().length).toBe(0);
      expect(() => registry.getProvider('openai')).toThrow('Provider not found: openai');
    });
  });

  // ============================================================================
  // Provider Registration Tests
  // ============================================================================

  describe('Provider Registration', () => {
    it('should register a single provider successfully', () => {
      const result = registry.register(openaiProvider);
      
      expect(result).toBe(true);
      expect(registry.getRegisteredProviders()).toContain('openai');
      expect(registry.getProvider('openai')).toBe(openaiProvider);
    });

    it('should register multiple different providers', () => {
      registry.register(openaiProvider);
      registry.register(geminiProvider);
      const registered = registry.getRegisteredProviders();
      expect(registered).toContain('openai');
      expect(registered).toContain('gemini');
      expect(registered.length).toBe(2);
    });

    it('should handle duplicate provider registration', () => {
      registry.register(openaiProvider);
      const secondProvider = new MockOpenAIProvider();
      
      // Should replace the existing provider
      const result = registry.register(secondProvider);
      expect(result).toBe(true);
      expect(registry.getProvider('openai')).toBe(secondProvider);
      expect(registry.getRegisteredProviders().length).toBe(1);
    });

    it('should emit registration events', () => {
      const onRegister = vi.fn();
      registry.on('providerRegistered', onRegister);
      
      registry.register(openaiProvider);
      
      expect(onRegister).toHaveBeenCalledWith({
        type: 'openai',
        provider: openaiProvider,
      });
    });

    it('should validate provider before registration', () => {
      const invalidProvider = {} as AIProvider;
      
      expect(() => registry.register(invalidProvider)).toThrow('Invalid provider: missing required properties');
    });

    it('should handle provider registration with same type but different instance', () => {
      registry.register(openaiProvider);
      const anotherOpenAI = new MockOpenAIProvider();
      
      const result = registry.register(anotherOpenAI);
      expect(result).toBe(true);
      expect(registry.getProvider('openai')).toBe(anotherOpenAI);
    });
  });

  // ============================================================================
  // Provider Lookup Tests
  // ============================================================================

  describe('Provider Lookup', () => {
    beforeEach(() => {
      registry.register(openaiProvider);
      registry.register(geminiProvider);
    });

    it('should find registered providers by type', () => {
      expect(registry.getProvider('openai')).toBe(openaiProvider);
      expect(registry.getProvider('gemini')).toBe(geminiProvider);
    });

    it('should return null for unregistered providers', () => {
      expect(() => registry.getProvider('nonexistent' as ProviderType)).toThrow('Provider not found: nonexistent');
    });

    it('should list all registered provider types', () => {
      const providers = registry.getRegisteredProviders();
      expect(providers).toEqual(expect.arrayContaining(['openai', 'gemini']));
      expect(providers.length).toBe(2);
    });

    it('should check if provider is registered', () => {
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.hasProvider('gemini')).toBe(true);
      expect(registry.hasProvider('nonexistent' as ProviderType)).toBe(false);
    });

    it('should get provider metadata', () => {
      const metadata = registry.getProviderMetadata('openai');
      expect(metadata).toEqual({
        type: 'openai',
        name: 'OpenAI',
        capabilities: openaiProvider.capabilities,
      });
    });

    it('should return null for metadata of unregistered provider', () => {
      expect(() => registry.getProviderMetadata('nonexistent' as ProviderType)).toThrow('Provider not found: nonexistent');
    });
  });

  // ============================================================================
  // Provider Switching Tests
  // ============================================================================

  describe('Provider Switching', () => {
    beforeEach(() => {
      registry.register(openaiProvider);
      registry.register(geminiProvider);
    });

    it('should set active provider successfully', () => {
      const result = registry.setActiveProvider('openai');
      
      expect(result).toBe(true);
      expect(registry.getActiveProvider()).toBe(openaiProvider);
      expect(registry.getActiveProviderType()).toBe('openai');
    });

    it('should switch between providers', () => {
      registry.setActiveProvider('openai');
      expect(registry.getActiveProvider()).toBe(openaiProvider);
      
      registry.setActiveProvider('gemini');
      expect(registry.getActiveProvider()).toBe(geminiProvider);
      expect(registry.getActiveProviderType()).toBe('gemini');
    });

    it('should emit provider change events', () => {
      const onChange = vi.fn();
      registry.on('activeProviderChanged', onChange);
      
      registry.setActiveProvider('openai');
      
      expect(onChange).toHaveBeenCalledWith({
        previousType: null,
        currentType: 'openai',
        provider: openaiProvider,
      });
    });

    it('should handle switching to unregistered provider', () => {
      expect(() => registry.setActiveProvider('nonexistent' as ProviderType)).toThrow('Provider not found: nonexistent');
      expect(registry.getActiveProvider()).toBeNull();
    });

    it('should clear active provider', () => {
      registry.setActiveProvider('openai');
      expect(registry.getActiveProvider()).toBe(openaiProvider);
      
      registry.clearActiveProvider();
      expect(registry.getActiveProvider()).toBeNull();
      expect(registry.getActiveProviderType()).toBeNull();
    });

    it('should emit clear active provider event', () => {
      const onChange = vi.fn();
      registry.on('activeProviderChanged', onChange);
      
      registry.setActiveProvider('openai');
      registry.clearActiveProvider();
      
      expect(onChange).toHaveBeenLastCalledWith({
        previousType: 'openai',
        currentType: null,
        provider: null,
      });
    });

    it('should handle consecutive switches to same provider', () => {
      const onChange = vi.fn();
      registry.on('activeProviderChanged', onChange);
      
      registry.setActiveProvider('openai');
      registry.setActiveProvider('openai');
      
      // Should only emit event once
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(registry.getActiveProvider()).toBe(openaiProvider);
    });
  });

  // ============================================================================
  // Provider Unregistration Tests
  // ============================================================================

  describe('Provider Unregistration', () => {
    beforeEach(() => {
      registry.register(openaiProvider);
      registry.register(geminiProvider);
      registry.setActiveProvider('openai');
    });

    it('should unregister provider successfully', () => {
      const result = registry.unregister('gemini');
      
      expect(result).toBe(true);
      expect(registry.hasProvider('gemini')).toBe(false);
      expect(registry.getRegisteredProviders()).not.toContain('gemini');
    });

    it('should clear active provider when unregistering active provider', () => {
      registry.unregister('openai');
      
      expect(registry.getActiveProvider()).toBeNull();
      expect(registry.getActiveProviderType()).toBeNull();
    });

    it('should emit unregistration events', () => {
      const onUnregister = vi.fn();
      registry.on('providerUnregistered', onUnregister);
      
      registry.unregister('gemini');
      
      expect(onUnregister).toHaveBeenCalledWith({
        type: 'gemini',
        provider: geminiProvider,
      });
    });

    it('should handle unregistering non-existent provider', () => {
      const result = registry.unregister('nonexistent' as ProviderType);
      expect(result).toBe(false);
    });

    it('should preserve other providers when unregistering one', () => {
      registry.unregister('gemini');
      
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.getProvider('openai')).toBe(openaiProvider);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw descriptive error for invalid provider registration', () => {
      const invalidProvider = { name: 'Invalid' } as AIProvider;
      
      expect(() => registry.register(invalidProvider)).toThrow('Invalid provider: missing required properties');
    });

    it('should throw error when getting non-existent provider', () => {
      expect(() => registry.getProvider('nonexistent' as ProviderType)).toThrow('Provider not found: nonexistent');
    });

    it('should throw error when setting non-existent active provider', () => {
      expect(() => registry.setActiveProvider('nonexistent' as ProviderType)).toThrow('Provider not found: nonexistent');
    });

    it('should handle provider validation errors gracefully', () => {
      const providerWithInvalidType = {
        ...openaiProvider,
        type: null,
      } as any;
      
      expect(() => registry.register(providerWithInvalidType)).toThrow('Invalid provider: missing required properties');
    });

    it('should handle null/undefined provider registration', () => {
      expect(() => registry.register(null as any)).toThrow('Invalid provider: missing required properties');
      expect(() => registry.register(undefined as any)).toThrow('Invalid provider: missing required properties');
    });

    it('should maintain registry consistency after errors', () => {
      registry.register(openaiProvider);
      
      try {
        registry.register(null as any);
      } catch (error) {
        // Error expected
      }
      
      // Registry should still be consistent
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.getRegisteredProviders().length).toBe(1);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should maintain type safety for provider types', () => {
      registry.register(openaiProvider);
      
      const provider = registry.getProvider('openai');
      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('OpenAI');
    });

    it('should handle provider type assertions correctly', () => {
      registry.register(openaiProvider);
      registry.register(geminiProvider);
      
      const openai = registry.getProvider('openai');
      const gemini = registry.getProvider('gemini');
      
      expect(openai.type).toBe('openai');
      expect(gemini.type).toBe('gemini');
    });

    it('should validate provider interface compliance', () => {
      // Test that all required methods exist
      expect(typeof openaiProvider.initialize).toBe('function');
      expect(typeof openaiProvider.validateConfig).toBe('function');
      expect(typeof openaiProvider.testConnection).toBe('function');
      expect(typeof openaiProvider.chat).toBe('function');
      expect(typeof openaiProvider.streamChat).toBe('function');
      expect(typeof openaiProvider.getModels).toBe('function');
      expect(typeof openaiProvider.getModel).toBe('function');
      expect(typeof openaiProvider.estimateTokens).toBe('function');
      expect(typeof openaiProvider.formatError).toBe('function');
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Tests
  // ============================================================================

  describe('Edge Cases and Boundary Tests', () => {
    it('should handle empty registry operations', () => {
      expect(registry.getRegisteredProviders()).toEqual([]);
      expect(registry.getActiveProvider()).toBeNull();
      expect(registry.getActiveProviderType()).toBeNull();
    });

    it('should handle rapid provider registration/unregistration', () => {
      // Register and unregister multiple times
      for (let i = 0; i < 10; i++) {
        registry.register(openaiProvider);
        registry.unregister('openai');
      }
      
      expect(registry.hasProvider('openai')).toBe(false);
      expect(registry.getRegisteredProviders().length).toBe(0);
    });

    it('should handle concurrent provider operations', async () => {
      const operations = [
        () => registry.register(openaiProvider),
        () => registry.register(geminiProvider),
        () => registry.setActiveProvider('openai'),
        () => registry.setActiveProvider('gemini'),
      ];
      
      // Run operations concurrently
      await Promise.all(operations.map(op => Promise.resolve().then(op)));
      
      expect(registry.getRegisteredProviders().length).toBe(2);
      expect(registry.getActiveProvider()).not.toBeNull();
    });

    it('should maintain consistent state after errors', () => {
      registry.register(openaiProvider);
      const initialState = {
        registered: registry.getRegisteredProviders(),
        active: registry.getActiveProvider(),
      };
      
      try {
        registry.setActiveProvider('nonexistent' as ProviderType);
      } catch (error) {
        // Expected error
      }
      
      // State should remain consistent
      expect(registry.getRegisteredProviders()).toEqual(initialState.registered);
      expect(registry.getActiveProvider()).toBe(initialState.active);
    });

    it('should handle provider with minimal capabilities', () => {
      const minimalProvider: AIProvider = {
        type: 'openrouter',
        name: 'Minimal',
        capabilities: {
          streaming: false,
          temperature: false,
          reasoning: false,
          thinking: false,
          multimodal: false,
          functionCalling: false,
          maxContextLength: 1000,
          supportedModels: [],
        },
        initialize: vi.fn().mockResolvedValue(undefined),
        validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        testConnection: vi.fn().mockResolvedValue(true),
        chat: vi.fn(),
        streamChat: vi.fn(),
        getModels: vi.fn().mockReturnValue([]),
        getModel: vi.fn().mockReturnValue(undefined),
        estimateTokens: vi.fn().mockReturnValue(0),
        formatError: vi.fn().mockReturnValue({ type: 'unknown', message: '', code: '', provider: 'openrouter' }),
      };
      
      expect(() => registry.register(minimalProvider)).not.toThrow();
      expect(registry.hasProvider('openrouter')).toBe(true);
    });
  });

  // ============================================================================
  // Event System Tests
  // ============================================================================

  describe('Event System', () => {
    it('should support event listeners registration', () => {
      const listener = vi.fn();
      registry.on('providerRegistered', listener);
      
      registry.register(openaiProvider);
      expect(listener).toHaveBeenCalled();
    });

    it('should support event listener removal', () => {
      const listener = vi.fn();
      registry.on('providerRegistered', listener);
      registry.off('providerRegistered', listener);
      
      registry.register(openaiProvider);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      registry.on('providerRegistered', listener1);
      registry.on('providerRegistered', listener2);
      
      registry.register(openaiProvider);
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should emit all expected events during provider lifecycle', () => {
      const registeredListener = vi.fn();
      const changedListener = vi.fn();
      const unregisteredListener = vi.fn();
      
      registry.on('providerRegistered', registeredListener);
      registry.on('activeProviderChanged', changedListener);
      registry.on('providerUnregistered', unregisteredListener);
      
      // Full lifecycle
      registry.register(openaiProvider);
      registry.setActiveProvider('openai');
      registry.unregister('openai');
      
      expect(registeredListener).toHaveBeenCalledTimes(1);
      expect(changedListener).toHaveBeenCalledTimes(2); // set active + clear on unregister
      expect(unregisteredListener).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe('Performance and Memory', () => {
    it('should handle large number of providers efficiently', () => {
      const startTime = performance.now();
      
      // Register many providers
      for (let i = 0; i < 100; i++) {
        const provider = new MockCustomProvider();
        // Make each provider unique
        (provider as any).name = `MockCustom-${i}`;
        registry.register(provider);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should not leak memory on provider registration/unregistration cycles', () => {
      const initialProviders = registry.getRegisteredProviders().length;
      
      // Register and unregister providers multiple times
      for (let i = 0; i < 50; i++) {
        registry.register(openaiProvider);
        registry.unregister('openai');
      }
      
      expect(registry.getRegisteredProviders().length).toBe(initialProviders);
    });

    it('should efficiently lookup providers', () => {
      // Register multiple providers
      registry.register(openaiProvider);
      registry.register(geminiProvider);
      
      const startTime = performance.now();
      
      // Perform many lookups
      for (let i = 0; i < 1000; i++) {
        registry.getProvider('openai');
        registry.getProvider('gemini');
        registry.hasProvider('gemini');
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
    });
  });
});
