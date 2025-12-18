/**
 * @file EngineRegistry Tests
 *
 * Tests for the engine registry that manages AI provider registration,
 * active provider switching, and event emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngineRegistry } from '@core/engine/EngineRegistry';
import type { AIProvider, ProviderType, ProviderCapabilities } from '@/types/providers';

// Create default capabilities
const defaultCapabilities: ProviderCapabilities = {
  streaming: true,
  multimodal: true,
  reasoning: false,
  temperature: true,
  thinking: false,
  functionCalling: false,
  maxContextLength: 128000,
  supportedModels: ['test-model'],
};

// Create a mock provider factory
function createMockProvider(type: ProviderType, overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    type,
    name: `${type} Provider`,
    capabilities: { ...defaultCapabilities },
    initialize: vi.fn().mockResolvedValue(undefined),
    validateConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    hasRequiredConfig: vi.fn().mockReturnValue(true),
    streamChat: vi.fn(),
    getModels: vi.fn().mockReturnValue([]),
    getModel: vi.fn().mockReturnValue(null),
    formatError: vi.fn().mockReturnValue('Error'),
    ...overrides,
  };
}

describe('EngineRegistry', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
  });

  describe('register', () => {
    it('should register a valid provider', () => {
      const provider = createMockProvider('openai');

      const result = registry.register(provider);

      expect(result).toBe(true);
      expect(registry.hasProvider('openai')).toBe(true);
    });

    it('should emit providerRegistered event', () => {
      const provider = createMockProvider('gemini');
      const listener = vi.fn();

      registry.on('providerRegistered', listener);
      registry.register(provider);

      expect(listener).toHaveBeenCalledWith({
        type: 'gemini',
        provider,
      });
    });

    it('should throw error for invalid provider (missing properties)', () => {
      const invalidProvider = {
        type: 'openai',
        name: 'Test',
        // Missing required properties
      } as AIProvider;

      expect(() => registry.register(invalidProvider)).toThrow(
        'Invalid provider: missing required properties'
      );
    });

    it('should throw error for null provider', () => {
      expect(() => registry.register(null as unknown as AIProvider)).toThrow('Invalid provider');
    });

    it('should overwrite existing provider of same type', () => {
      const provider1 = createMockProvider('openai', { name: 'First' });
      const provider2 = createMockProvider('openai', { name: 'Second' });

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.getProvider('openai').name).toBe('Second');
    });
  });

  describe('unregister', () => {
    it('should unregister an existing provider', () => {
      const provider = createMockProvider('openai');
      registry.register(provider);

      const result = registry.unregister('openai');

      expect(result).toBe(true);
      expect(registry.hasProvider('openai')).toBe(false);
    });

    it('should return false for non-existent provider', () => {
      const result = registry.unregister('openai');

      expect(result).toBe(false);
    });

    it('should emit providerUnregistered event', () => {
      const provider = createMockProvider('gemini');
      const listener = vi.fn();

      registry.register(provider);
      registry.on('providerUnregistered', listener);
      registry.unregister('gemini');

      expect(listener).toHaveBeenCalledWith({
        type: 'gemini',
        provider,
      });
    });

    it('should clear active provider if unregistered', () => {
      const provider = createMockProvider('openai');
      registry.register(provider);
      registry.setActiveProvider('openai');

      registry.unregister('openai');

      expect(registry.getActiveProviderType()).toBeNull();
    });
  });

  describe('getProvider', () => {
    it('should return registered provider', () => {
      const provider = createMockProvider('openai');
      registry.register(provider);

      const result = registry.getProvider('openai');

      expect(result).toBe(provider);
    });

    it('should throw error for non-existent provider', () => {
      expect(() => registry.getProvider('openai')).toThrow('Provider not found');
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      registry.register(createMockProvider('gemini'));

      expect(registry.hasProvider('gemini')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(registry.hasProvider('openai')).toBe(false);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return all registered provider types', () => {
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('gemini'));

      const providers = registry.getRegisteredProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
      expect(providers).toHaveLength(2);
    });

    it('should return empty array when no providers registered', () => {
      expect(registry.getRegisteredProviders()).toEqual([]);
    });
  });

  describe('getProviderMetadata', () => {
    it('should return provider metadata', () => {
      const capabilities: ProviderCapabilities = {
        ...defaultCapabilities,
        reasoning: true,
      };
      const provider = createMockProvider('openai', { capabilities });
      registry.register(provider);

      const metadata = registry.getProviderMetadata('openai');

      expect(metadata.type).toBe('openai');
      expect(metadata.name).toBe('openai Provider');
      expect(metadata.capabilities).toEqual(capabilities);
    });

    it('should throw error for non-existent provider', () => {
      expect(() => registry.getProviderMetadata('openai')).toThrow();
    });
  });

  describe('setActiveProvider', () => {
    it('should set active provider', () => {
      registry.register(createMockProvider('openai'));

      const result = registry.setActiveProvider('openai');

      expect(result).toBe(true);
      expect(registry.getActiveProviderType()).toBe('openai');
    });

    it('should emit activeProviderChanged event', () => {
      const provider = createMockProvider('gemini');
      const listener = vi.fn();

      registry.register(provider);
      registry.on('activeProviderChanged', listener);
      registry.setActiveProvider('gemini');

      expect(listener).toHaveBeenCalledWith({
        previousType: null,
        currentType: 'gemini',
        provider,
      });
    });

    it('should throw error for non-existent provider', () => {
      expect(() => registry.setActiveProvider('openai')).toThrow('Provider not found');
    });

    it('should return true when setting same provider', () => {
      registry.register(createMockProvider('openai'));
      registry.setActiveProvider('openai');

      const result = registry.setActiveProvider('openai');

      expect(result).toBe(true);
    });

    it('should not emit event when setting same provider', () => {
      const listener = vi.fn();
      registry.register(createMockProvider('openai'));
      registry.setActiveProvider('openai');

      registry.on('activeProviderChanged', listener);
      registry.setActiveProvider('openai');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should emit correct previous type when switching', () => {
      const listener = vi.fn();
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('gemini'));
      registry.setActiveProvider('openai');

      registry.on('activeProviderChanged', listener);
      registry.setActiveProvider('gemini');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousType: 'openai',
          currentType: 'gemini',
        })
      );
    });
  });

  describe('getActiveProvider', () => {
    it('should return active provider', () => {
      const provider = createMockProvider('openai');
      registry.register(provider);
      registry.setActiveProvider('openai');

      const active = registry.getActiveProvider();

      expect(active).toBe(provider);
    });

    it('should return null when no active provider', () => {
      expect(registry.getActiveProvider()).toBeNull();
    });
  });

  describe('getActiveProviderType', () => {
    it('should return active provider type', () => {
      registry.register(createMockProvider('gemini'));
      registry.setActiveProvider('gemini');

      expect(registry.getActiveProviderType()).toBe('gemini');
    });

    it('should return null when no active provider', () => {
      expect(registry.getActiveProviderType()).toBeNull();
    });
  });

  describe('clearActiveProvider', () => {
    it('should clear active provider', () => {
      registry.register(createMockProvider('openai'));
      registry.setActiveProvider('openai');

      registry.clearActiveProvider();

      expect(registry.getActiveProviderType()).toBeNull();
    });

    it('should emit activeProviderChanged event', () => {
      const listener = vi.fn();
      registry.register(createMockProvider('openai'));
      registry.setActiveProvider('openai');

      registry.on('activeProviderChanged', listener);
      registry.clearActiveProvider();

      expect(listener).toHaveBeenCalledWith({
        previousType: 'openai',
        currentType: null,
        provider: null,
      });
    });

    it('should not emit event when already null', () => {
      const listener = vi.fn();

      registry.on('activeProviderChanged', listener);
      registry.clearActiveProvider();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    it('should add event listener with on()', () => {
      const listener = vi.fn();

      registry.on('providerRegistered', listener);
      registry.register(createMockProvider('openai'));

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listener with off()', () => {
      const listener = vi.fn();

      registry.on('providerRegistered', listener);
      registry.off('providerRegistered', listener);
      registry.register(createMockProvider('openai'));

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not break on listener exception', () => {
      const throwingListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      registry.on('providerRegistered', throwingListener);
      registry.on('providerRegistered', normalListener);

      // Should not throw
      registry.register(createMockProvider('openai'));

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('gemini'));
      registry.setActiveProvider('openai');

      const stats = registry.getStats();

      expect(stats.totalProviders).toBe(2);
      expect(stats.activeProvider).toBe('openai');
      expect(stats.registeredTypes).toContain('openai');
      expect(stats.registeredTypes).toContain('gemini');
    });

    it('should return null active provider when none set', () => {
      const stats = registry.getStats();

      expect(stats.activeProvider).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all providers', () => {
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('gemini'));

      registry.clear();

      expect(registry.isEmpty()).toBe(true);
    });

    it('should clear active provider', () => {
      registry.register(createMockProvider('openai'));
      registry.setActiveProvider('openai');

      registry.clear();

      expect(registry.getActiveProviderType()).toBeNull();
    });
  });

  describe('isEmpty', () => {
    it('should return true when no providers', () => {
      expect(registry.isEmpty()).toBe(true);
    });

    it('should return false when providers exist', () => {
      registry.register(createMockProvider('openai'));

      expect(registry.isEmpty()).toBe(false);
    });
  });

  describe('size', () => {
    it('should return number of registered providers', () => {
      expect(registry.size()).toBe(0);

      registry.register(createMockProvider('openai'));
      expect(registry.size()).toBe(1);

      registry.register(createMockProvider('gemini'));
      expect(registry.size()).toBe(2);
    });
  });

  describe('validateProvider', () => {
    it('should require all essential properties', () => {
      const requiredProps = [
        'type',
        'name',
        'capabilities',
        'initialize',
        'validateConfig',
        'hasRequiredConfig',
        'streamChat',
        'getModels',
        'getModel',
        'formatError',
      ];

      for (const prop of requiredProps) {
        const provider = createMockProvider('openai');
        // @ts-expect-error - intentionally removing required property
        delete provider[prop];

        expect(() => registry.register(provider)).toThrow(
          'Invalid provider: missing required properties'
        );
      }
    });
  });
});
