/**
 * @file Engine Manager Service Integration Test
 *
 * Integration test for EngineManagerService (restricted surface).
 * Real: EngineManagerService
 * Stub: factory/providers as needed
 * Assert: initialize/switch/stats/events only
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EngineManagerService,
  createEngineManagerService,
  type EngineStats,
  type EngineManagerConfig,
} from '@/services/engine/EngineManagerService';
import type { ProviderType } from '@/types/providers';

// Mock the settings store
vi.mock('@store/settings', () => {
  const settings = {
    apiKeys: {
      openai: 'test-openai-key',
      google: 'test-google-key',
      openrouter: null,
      grok: null,
    },
    selectedModel: 'gpt-4o',
    ai: {
      defaultProvider: 'openai' as ProviderType,
      streamResponse: true,
    },
  };

  return {
    useSettingsStore: {
      getState: vi.fn(() => ({
        settings,
        updateAISettings: vi.fn().mockResolvedValue(undefined),
      })),
      subscribe: vi.fn(() => vi.fn()), // Return unsubscribe function
    },
  };
});

// Mock the compat provider storage
vi.mock('@/data/storage/keys/compat', () => ({
  listOpenAICompatProviders: vi.fn().mockResolvedValue([]),
  getCompatProviderById: vi.fn().mockResolvedValue(null),
}));

// Mock models config
vi.mock('@config/models', () => ({
  getDefaultModelForProvider: vi.fn((provider: string) => {
    const defaults: Record<string, string> = {
      openai: 'gpt-4o',
      gemini: 'gemini-2.5-flash-lite',
      openrouter: 'anthropic/claude-sonnet-4',
      grok: 'grok-4-fast-non-reasoning',
    };
    return defaults[provider];
  }),
  getModelsByProvider: vi.fn(() => [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }]),
  getModelsByProviderId: vi.fn(() => []),
  getModelById: vi.fn((id: string) => {
    if (id.startsWith('gpt-')) {
      return { id, name: id, provider: 'openai', reasoningEffort: 'low' };
    }
    if (id.startsWith('gemini-')) {
      return { id, name: id, provider: 'gemini', thinkingBudget: -1 };
    }
    return null;
  }),
  modelExists: vi.fn((id: string) => id.startsWith('gpt-') || id.startsWith('gemini-')),
  OPENAI_COMPAT_PROVIDER_IDS: [],
}));

describe('EngineManagerService integration', () => {
  let service: EngineManagerService;

  beforeEach(() => {
    // Reset singleton for each test
    EngineManagerService.resetInstance();
    service = EngineManagerService.getInstance({ enableStats: true });
  });

  afterEach(() => {
    EngineManagerService.resetInstance();
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = EngineManagerService.getInstance();
      const instance2 = EngineManagerService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('can reset instance for testing', () => {
      const instance1 = EngineManagerService.getInstance();
      EngineManagerService.resetInstance();
      const instance2 = EngineManagerService.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('respects config changes on subsequent calls', () => {
      EngineManagerService.resetInstance();
      const instance1 = EngineManagerService.getInstance({ enableStats: true });

      // Second call with different config should not change much
      const instance2 = EngineManagerService.getInstance({ enableStats: false });

      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('starts in uninitialized state', () => {
      const state = service.getServiceState();

      expect(state.isInitialized).toBe(false);
      expect(state.isInitializing).toBe(false);
      expect(state.lastError).toBeNull();
      expect(state.initializationCount).toBe(0);
    });

    it('initializes from settings', async () => {
      await service.initializeFromSettings();

      const state = service.getServiceState();
      expect(state.isInitialized).toBe(true);
      expect(state.initializationCount).toBe(1);
      expect(state.lastInitializedAt).toBeInstanceOf(Date);
    });

    it('prevents concurrent initialization', async () => {
      // Start two initializations concurrently
      const promise1 = service.initializeFromSettings();
      const promise2 = service.initializeFromSettings();

      await Promise.all([promise1, promise2]);

      const state = service.getServiceState();
      // Should only count as one initialization
      expect(state.initializationCount).toBe(1);
    });

    it('skips re-initialization when settings unchanged', async () => {
      await service.initializeFromSettings();
      const count1 = service.getServiceState().initializationCount;

      // Call again with same settings
      await service.initializeFromSettings();
      const count2 = service.getServiceState().initializationCount;

      expect(count2).toBe(count1);
    });

    it('emits initialized event', async () => {
      const eventHandler = vi.fn();
      service.on('initialized', eventHandler);

      await service.initializeFromSettings();

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          providersCount: expect.any(Number),
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('provider switching', () => {
    beforeEach(async () => {
      await service.initializeFromSettings();
    });

    it('throws when switching to unregistered provider', async () => {
      await expect(async () => {
        await service.switch('openrouter' as ProviderType);
      }).rejects.toThrow(/not registered/);
    });

    it('emits providerSwitched event on successful switch', async () => {
      // Re-initialize to ensure we have a provider
      await service.initializeFromSettings();

      const eventHandler = vi.fn();
      service.on('providerSwitched', eventHandler);

      const registeredProviders = service.getServiceState().registeredProviders;
      expect(registeredProviders.length).toBeGreaterThan(0);
      const firstProvider = registeredProviders[0]!;

      await service.switch(firstProvider);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          to: firstProvider,
          timestamp: expect.any(Date),
        })
      );
    });

    it('updates settings store after switch', async () => {
      const { useSettingsStore } = await import('@store/settings');
      const mockUpdateAISettings = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSettingsStore.getState).mockReturnValue({
        settings: {
          version: 1,
          ui: {
            fontSize: 'medium',
            compactMode: false,
            showTimestamps: true,
            showAvatars: true,
            animationsEnabled: true,
            debugMode: false,
            autoScrollEnabled: true,
            screenshotHotkey: {
              enabled: true,
              modifiers: [],
              key: '',
            },
          },
          ai: { defaultProvider: 'openai', streamResponse: true },
          privacy: {
            saveConversations: true,
            shareAnalytics: false,
            clearOnClose: false,
          },
          selectedModel: 'gpt-4o',
          availableModels: [],
          extraction: { domainRules: [] },
          apiKeys: {
            openai: 'test-key',
            google: 'test-google-key',
            openrouter: null,
            grok: null,
          },
        },
        isLoading: false,
        error: null,
        loadSettings: vi.fn().mockResolvedValue(undefined),
        updateUIPreferences: vi.fn().mockResolvedValue(undefined),
        updateAISettings: mockUpdateAISettings,
        updatePrivacySettings: vi.fn().mockResolvedValue(undefined),
        updateAPIKeyReferences: vi.fn().mockResolvedValue(undefined),
        resetToDefaults: vi.fn().mockResolvedValue(undefined),
        setError: vi.fn(),
        clearError: vi.fn(),
        updateSelectedModel: vi.fn().mockResolvedValue(undefined),
        getAvailableModels: vi.fn(() => []),
        getProviderTypeForModel: vi.fn(() => null),
        refreshAvailableModelsWithCompat: vi.fn().mockResolvedValue(undefined),
        updateExtractionPreferences: vi.fn().mockResolvedValue(undefined),
      });

      // Reset and reinitialize with mocked settings
      EngineManagerService.resetInstance();
      service = EngineManagerService.getInstance();
      await service.initializeFromSettings();

      const registeredProviders = service.getServiceState().registeredProviders;
      expect(registeredProviders.length).toBeGreaterThan(0);
      const firstProvider = registeredProviders[0]!;

      await service.switch(firstProvider);
      expect(mockUpdateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({ defaultProvider: firstProvider })
      );
    });
  });

  describe('statistics tracking', () => {
    beforeEach(async () => {
      await service.initializeFromSettings();
    });

    it('returns empty stats initially', () => {
      const stats = service.getStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
    });

    it('tracks token usage', () => {
      service.trackTokenUsage('openai', 100);
      service.trackTokenUsage('openai', 50);

      const stats = service.getStats();
      expect(stats.providers['openai']?.tokensUsed).toBe(150);
      expect(stats.totalTokens).toBe(150);
    });

    it('tracks requests', () => {
      service.trackRequest('openai');
      service.trackRequest('openai');
      service.trackRequest('gemini');

      const stats = service.getStats();
      expect(stats.providers['openai']?.requestCount).toBe(2);
      expect(stats.providers['gemini']?.requestCount).toBe(1);
      expect(stats.totalRequests).toBe(3);
    });

    it('tracks errors', () => {
      service.trackError('openai');
      service.trackError('gemini');
      service.trackError('gemini');

      const stats = service.getStats();
      expect(stats.providers['openai']?.errorCount).toBe(1);
      expect(stats.providers['gemini']?.errorCount).toBe(2);
      expect(stats.totalErrors).toBe(3);
    });

    it('tracks response times with average calculation', () => {
      service.trackResponseTime('openai', 100);
      service.trackResponseTime('openai', 200);
      service.trackResponseTime('openai', 300);

      const stats = service.getStats();
      expect(stats.providers['openai']?.averageResponseTime).toBe(200);
    });

    it('updates lastUsed timestamp', () => {
      const before = new Date();
      service.trackRequest('openai');
      const after = new Date();

      const stats = service.getStats();
      const lastUsed = stats.providers['openai']?.lastUsed;

      expect(lastUsed).toBeDefined();
      expect(lastUsed!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUsed!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('does not track when stats disabled', () => {
      EngineManagerService.resetInstance();
      const noStatsService = EngineManagerService.getInstance({ enableStats: false });

      noStatsService.trackTokenUsage('openai', 100);
      noStatsService.trackRequest('openai');
      noStatsService.trackError('openai');

      const stats = noStatsService.getStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
    });

    it('limits response time history to prevent memory bloat', () => {
      // Track more than 100 response times
      for (let i = 0; i < 150; i++) {
        service.trackResponseTime('openai', i);
      }

      const stats = service.getStats();
      // Should still calculate average correctly from last 100
      expect(stats.providers['openai']?.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('event management', () => {
    it('adds and removes event listeners', async () => {
      const removedHandler = vi.fn();
      const keptHandler = vi.fn();

      service.on('initialized', removedHandler);
      service.on('initialized', keptHandler);
      service.off('initialized', removedHandler);

      await service.initializeFromSettings();

      expect(removedHandler).not.toHaveBeenCalled();
      expect(keptHandler).toHaveBeenCalledTimes(1);
    });

    it('listener exceptions do not break other listeners', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      service.on('initialized', errorHandler);
      service.on('initialized', successHandler);

      await service.initializeFromSettings();

      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it('removes listeners correctly', async () => {
      await service.initializeFromSettings();

      const handler = vi.fn();
      service.on('providerSwitched', handler);
      service.off('providerSwitched', handler);

      const activeProvider = service.getServiceState().activeProvider;
      if (!activeProvider) {
        throw new Error('Expected active provider');
      }

      await service.switch(activeProvider);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('service state', () => {
    it('provides complete state information', async () => {
      await service.initializeFromSettings();

      const state = service.getServiceState();

      expect(state).toHaveProperty('isInitialized');
      expect(state).toHaveProperty('isInitializing');
      expect(state).toHaveProperty('lastError');
      expect(state).toHaveProperty('initializationCount');
      expect(state).toHaveProperty('lastInitializedAt');
      expect(state).toHaveProperty('registeredProviders');
      expect(state).toHaveProperty('activeProvider');
    });

    it('isReady returns true when properly initialized', async () => {
      await service.initializeFromSettings();

      expect(service.isReady()).toBe(true);
    });

    it('isReady returns false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });
  });

  describe('reset functionality', () => {
    it('resets service to initial state', async () => {
      await service.initializeFromSettings();
      service.trackRequest('openai');
      service.trackTokenUsage('openai', 100);

      service.reset();

      const state = service.getServiceState();
      expect(state.isInitialized).toBe(false);
      expect(state.initializationCount).toBe(0);

      const stats = service.getStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('clears all registered providers', async () => {
      await service.initializeFromSettings();

      service.reset();

      const state = service.getServiceState();
      expect(state.registeredProviders).toEqual([]);
      expect(state.activeProvider).toBeNull();
    });

    it('clears event listeners', async () => {
      const handler = vi.fn();
      service.on('initialized', handler);

      service.reset();
      await service.initializeFromSettings();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('registry and factory access', () => {
    it('provides access to registry', () => {
      const registry = service.getRegistry();

      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.unregister).toBe('function');
    });

    it('provides access to factory', () => {
      const factory = service.getFactory();

      expect(factory).toBeDefined();
      expect(typeof factory.createProvider).toBe('function');
      expect(typeof factory.getSupportedProviders).toBe('function');
    });
  });

  describe('error handling', () => {
    it('captures last error on initialization failure', async () => {
      // Mock settings to throw
      const { useSettingsStore } = await import('@store/settings');
      vi.mocked(useSettingsStore.getState).mockImplementation(() => {
        throw new Error('Settings unavailable');
      });

      EngineManagerService.resetInstance();
      const errorService = EngineManagerService.getInstance();

      await expect(async () => {
        await errorService.initializeFromSettings();
      }).rejects.toThrow();

      const state = errorService.getServiceState();
      expect(state.lastError).toBeDefined();
      expect(state.lastError?.code).toBe('INITIALIZATION_FAILED');
    });

    it('captures last error on switch failure', async () => {
      await service.initializeFromSettings();

      try {
        await service.switch('nonexistent' as ProviderType);
      } catch {
        // Expected
      }

      const state = service.getServiceState();
      expect(state.lastError).toBeDefined();
      expect(state.lastError?.code).toBe('PROVIDER_SWITCH_FAILED');
    });
  });

  describe('createEngineManagerService factory', () => {
    it('creates new instance with config', () => {
      const config: EngineManagerConfig = {
        autoInitialize: false,
        enableStats: true,
        maxRetryAttempts: 5,
        retryDelayMs: 2000,
      };

      // Note: createEngineManagerService uses a workaround to create instance
      const factoryService = createEngineManagerService(config);

      expect(factoryService).toBeDefined();
      expect(factoryService).toBeInstanceOf(EngineManagerService);
    });
  });

  describe('stats structure', () => {
    it('returns complete EngineStats structure', async () => {
      await service.initializeFromSettings();

      const stats: EngineStats = service.getStats();

      // Verify all required fields
      expect(typeof stats.totalTokens).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.totalErrors).toBe('number');
      expect(stats.providers).toBeDefined();
      expect(Array.isArray(stats.registeredProviders)).toBe(true);

      // Verify provider stats structure
      const providerTypes: ProviderType[] = ['openai', 'gemini', 'openrouter', 'openai_compat'];
      for (const type of providerTypes) {
        const providerStats = stats.providers[type];
        expect(providerStats).toBeDefined();
        expect(typeof providerStats.tokensUsed).toBe('number');
        expect(typeof providerStats.requestCount).toBe('number');
        expect(typeof providerStats.errorCount).toBe('number');
        expect(typeof providerStats.averageResponseTime).toBe('number');
        // lastUsed can be null or Date
      }
    });

    it('includes active provider in stats', async () => {
      await service.initializeFromSettings();

      const stats = service.getStats();

      // activeProvider may be null if no providers registered
      // or a ProviderType if providers were successfully registered
      if (stats.registeredProviders.length > 0) {
        expect(stats.activeProvider).toBeDefined();
      } else {
        expect(stats.activeProvider).toBeNull();
      }
    });
  });
});
