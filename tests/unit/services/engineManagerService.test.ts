/**
 * @file Engine Manager Service Unit Tests
 *
 * Focused unit tests for the Engine Manager Service that test the core
 * functionality without complex mocking of internal dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Setup - Minimal mocking approach
// ============================================================================

// No feature flags in new architecture

// Mock settings store
vi.mock('@store/settings', () => ({
  useSettingsStore: {
    getState: vi.fn().mockReturnValue({
      settings: {
        apiKeys: {
          openai: 'sk-test123',
          google: 'test-google-key',
          openrouter: 'test-openrouter-key',
        },
        selectedModel: 'gpt-5-nano',
        ai: {
          defaultProvider: 'openai',
        },
      },
    }),
    updateAISettings: vi.fn().mockResolvedValue(undefined),
  },
}));

// Create a complete mock registry instance
const createMockRegistry = () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  getProvider: vi.fn(),
  hasProvider: vi.fn(),
  getActiveProvider: vi.fn(),
  getActiveProviderType: vi.fn(),
  setActiveProvider: vi.fn(),
  getRegisteredProviders: vi.fn().mockReturnValue([]),
  clear: vi.fn(),
  size: vi.fn().mockReturnValue(0),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
});

// Mock EngineRegistry
vi.mock('@core/engine/EngineRegistry', () => ({
  EngineRegistry: vi.fn().mockImplementation(() => createMockRegistry()),
}));

// Mock EngineFactory
vi.mock('@core/engine/EngineFactory', () => ({
  EngineFactory: vi.fn().mockImplementation(() => ({
    createProvider: vi.fn(),
  })),
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('EngineManagerService', () => {
  // Dynamically import to avoid hoisting issues
  let EngineManagerService: any;
  let ProviderStats: any;
  let ProviderManagerConfig: any;

  beforeEach(async () => {
    // Clear module cache to ensure fresh imports
    vi.resetModules();

    // Import the service dynamically to avoid hoisting issues
    const module = await import('@services/engine/EngineManagerService');
    EngineManagerService = module.EngineManagerService;

    // Reset singleton
    EngineManagerService.resetInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (EngineManagerService) {
      EngineManagerService.resetInstance();
    }
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Singleton Pattern Tests
  // ============================================================================

  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = EngineManagerService.getInstance();
      const instance2 = EngineManagerService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
    });

    it('should reset singleton instance for testing', () => {
      const instance1 = EngineManagerService.getInstance();
      EngineManagerService.resetInstance();
      const instance2 = EngineManagerService.getInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance2).toBeDefined();
    });

    it('should maintain singleton consistency under concurrent access', () => {
      const instances = Array.from({ length: 10 }, () => EngineManagerService.getInstance());
      const firstInstance = instances[0];

      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration Management', () => {
    it('should apply default configuration', () => {
      const service = EngineManagerService.getInstance();
      const config = (service as any).config;

      expect(config.autoInitialize).toBe(true);
      expect(config.enableStats).toBe(true);
      expect(config.maxRetryAttempts).toBe(3);
      expect(config.retryDelayMs).toBe(1000);
    });

    it('should apply custom configuration on first call', () => {
      EngineManagerService.resetInstance();

      const customConfig = {
        autoInitialize: false,
        enableStats: false,
        maxRetryAttempts: 5,
        retryDelayMs: 2000,
      };

      const service = EngineManagerService.getInstance(customConfig);
      const config = (service as any).config;

      expect(config.autoInitialize).toBe(false);
      expect(config.enableStats).toBe(false);
      expect(config.maxRetryAttempts).toBe(5);
      expect(config.retryDelayMs).toBe(2000);
    });

    it('should ignore config on subsequent calls', () => {
      const service1 = EngineManagerService.getInstance({ enableStats: false });
      const service2 = EngineManagerService.getInstance({ enableStats: true });

      expect(service1).toBe(service2);
      expect((service1 as any).config.enableStats).toBe(false);
    });

    it('should merge partial configuration with defaults', () => {
      EngineManagerService.resetInstance();

      const partialConfig = {
        enableStats: false,
        maxRetryAttempts: 10,
      };

      const service = EngineManagerService.getInstance(partialConfig);
      const config = (service as any).config;

      expect(config.autoInitialize).toBe(true); // Default
      expect(config.enableStats).toBe(false); // Custom
      expect(config.maxRetryAttempts).toBe(10); // Custom
      expect(config.retryDelayMs).toBe(1000); // Default
    });
  });

  // ============================================================================
  // Statistics Management Tests
  // ============================================================================

  describe('Statistics Management', () => {
    let service: any;

    beforeEach(() => {
      service = EngineManagerService.getInstance({ enableStats: true });
    });

    it('should return initial empty stats', () => {
      const stats = service.getStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.providers.openai.tokensUsed).toBe(0);
      expect(stats.providers.openai.requestCount).toBe(0);
      expect(stats.providers.openai.errorCount).toBe(0);
      expect(stats.providers.openai.lastUsed).toBeNull();
      expect(stats.providers.openai.averageResponseTime).toBe(0);
    });

    it('should track token usage correctly', () => {
      service.trackTokenUsage('openai', 100);
      service.trackTokenUsage('openai', 200);
      service.trackTokenUsage('gemini', 150);

      const stats = service.getStats();

      expect(stats.totalTokens).toBe(450);
      expect(stats.providers.openai.tokensUsed).toBe(300);
      expect(stats.providers.gemini.tokensUsed).toBe(150);
    });

    it('should track request counts correctly', () => {
      service.trackRequest('openai');
      service.trackRequest('openai');
      service.trackRequest('gemini');

      const stats = service.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.providers.openai.requestCount).toBe(2);
      expect(stats.providers.gemini.requestCount).toBe(1);
    });

    it('should track error counts correctly', () => {
      service.trackError('openai');
      service.trackError('gemini');
      service.trackError('gemini');

      const stats = service.getStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.providers.openai.errorCount).toBe(1);
      expect(stats.providers.gemini.errorCount).toBe(2);
    });

    it('should calculate average response times correctly', () => {
      service.trackResponseTime('openai', 100);
      service.trackResponseTime('openai', 200);
      service.trackResponseTime('openai', 300);

      const stats = service.getStats();

      expect(stats.providers.openai.averageResponseTime).toBe(200);
    });

    it('should update lastUsed timestamp on request tracking', () => {
      const beforeTime = new Date();
      service.trackRequest('openai');
      const afterTime = new Date();

      const stats = service.getStats();
      const lastUsed = stats.providers.openai.lastUsed;

      expect(lastUsed).toBeInstanceOf(Date);
      expect(lastUsed.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(lastUsed.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should limit response times to last 100 entries', () => {
      // Add 150 response times
      for (let i = 1; i <= 150; i++) {
        service.trackResponseTime('openai', i);
      }

      const stats = service.getStats();
      const internalStats = (service as any).stats.get('openai');

      expect(internalStats.responseTimes).toHaveLength(100);
      expect(internalStats.responseTimes[0]).toBe(51); // First 50 should be removed
      expect(internalStats.responseTimes[99]).toBe(150); // Last entry
      expect(stats.providers.openai.averageResponseTime).toBe(100.5); // Average of 51-150
    });

    it('should not track stats when disabled', () => {
      const serviceWithDisabledStats = EngineManagerService.getInstance({ enableStats: false });

      serviceWithDisabledStats.trackTokenUsage('openai', 100);
      serviceWithDisabledStats.trackRequest('openai');
      serviceWithDisabledStats.trackError('openai');

      const stats = serviceWithDisabledStats.getStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalErrors).toBe(0);
    });
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('State Management', () => {
    let service: any;

    beforeEach(() => {
      service = EngineManagerService.getInstance();
    });

    it('should return service state information', () => {
      const state = service.getServiceState();

      expect(state).toHaveProperty('isInitialized');
      expect(state).toHaveProperty('isInitializing');
      expect(state).toHaveProperty('lastError');
      expect(state).toHaveProperty('initializationCount');
      expect(state).toHaveProperty('lastInitializedAt');
      expect(state).toHaveProperty('registeredProviders');
      expect(state).toHaveProperty('activeProvider');

      expect(state.isInitialized).toBe(false);
      expect(state.isInitializing).toBe(false);
      expect(state.lastError).toBeNull();
      expect(state.initializationCount).toBe(0);
      expect(state.lastInitializedAt).toBeNull();
    });

    it('should indicate not ready initially', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should reset service state', () => {
      // Modify some state
      (service as any).state.isInitialized = true;
      (service as any).state.initializationCount = 5;
      service.trackTokenUsage('openai', 100);

      service.reset();

      const state = service.getServiceState();
      expect(state.isInitialized).toBe(false);
      expect(state.initializationCount).toBe(0);

      const stats = service.getStats();
      expect(stats.totalTokens).toBe(0);
    });

    it('should provide access to registry and factory', () => {
      expect(service.getRegistry()).toBeDefined();
      expect(service.getFactory()).toBeDefined();
    });
  });

  // ============================================================================
  // Event Management Tests
  // ============================================================================

  describe('Event Management', () => {
    let service: any;

    beforeEach(() => {
      service = EngineManagerService.getInstance();
    });

    it('should register and trigger event listeners', () => {
      const listener = vi.fn();
      service.on('test-event', listener);

      // Call the private emit method
      (service as any).emit('test-event', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      service.on('test-event', listener);
      service.off('test-event', listener);

      (service as any).emit('test-event', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      service.on('test-event', listener1);
      service.on('test-event', listener2);

      (service as any).emit('test-event', { data: 'test' });

      expect(listener1).toHaveBeenCalledWith({ data: 'test' });
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const workingListener = vi.fn();

      service.on('test-event', faultyListener);
      service.on('test-event', workingListener);

      expect(() => {
        (service as any).emit('test-event', { data: 'test' });
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
      expect(workingListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Concurrent Operations Tests
  // ============================================================================

  describe('Concurrent Operations', () => {
    let service: any;

    beforeEach(() => {
      service = EngineManagerService.getInstance();
    });

    it('should handle concurrent statistics updates safely', () => {
      // Simulate concurrent stats updates
      const updates = Array.from({ length: 100 }, (_, i) => {
        const providers = ['openai', 'gemini', 'openrouter'];
        const provider = providers[i % 3];
        return () => {
          service.trackTokenUsage(provider, 10);
          service.trackRequest(provider);
          service.trackResponseTime(provider, 100 + i);
        };
      });

      // Run all updates
      updates.forEach(update => update());

      const stats = service.getStats();

      // Should have accumulated all stats correctly
      expect(stats.totalTokens).toBe(1000); // 100 * 10
      expect(stats.totalRequests).toBeGreaterThanOrEqual(90);

      // Verify per-provider stats
      expect(stats.providers.openai.tokensUsed).toBeGreaterThan(0);
      expect(stats.providers.gemini.tokensUsed).toBeGreaterThan(0);
      expect(stats.providers.openrouter.tokensUsed).toBeGreaterThan(0);
    });

    it('should maintain singleton consistency under concurrent access', () => {
      const instances = Array.from({ length: 20 }, () => EngineManagerService.getInstance());

      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });

      // All instances should share the same statistics
      firstInstance.trackTokenUsage('openai', 100);
      instances.forEach(instance => {
        const stats = instance.getStats();
        expect(stats.providers.openai.tokensUsed).toBe(100);
      });
    });
  });

  // ============================================================================
  // Integration-style Tests
  // ============================================================================

  describe('Service Integration', () => {
    let service: any;

    beforeEach(() => {
      service = EngineManagerService.getInstance({ enableStats: true });
    });

    it('should track comprehensive statistics across multiple operations', () => {
      // Simulate a series of AI operations
      service.trackRequest('openai');
      service.trackTokenUsage('openai', 150);
      service.trackResponseTime('openai', 250);

      service.trackRequest('gemini');
      service.trackTokenUsage('gemini', 200);
      service.trackResponseTime('gemini', 300);
      service.trackError('gemini');

      service.trackRequest('openrouter');
      service.trackTokenUsage('openrouter', 100);
      service.trackResponseTime('openrouter', 400);

      const stats = service.getStats();

      // Verify totals
      expect(stats.totalTokens).toBe(450);
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalErrors).toBe(1);

      // Verify per-provider breakdown
      expect(stats.providers.openai.tokensUsed).toBe(150);
      expect(stats.providers.openai.requestCount).toBe(1);
      expect(stats.providers.openai.errorCount).toBe(0);
      expect(stats.providers.openai.averageResponseTime).toBe(250);

      expect(stats.providers.gemini.tokensUsed).toBe(200);
      expect(stats.providers.gemini.requestCount).toBe(1);
      expect(stats.providers.gemini.errorCount).toBe(1);
      expect(stats.providers.gemini.averageResponseTime).toBe(300);

      expect(stats.providers.openrouter.tokensUsed).toBe(100);
      expect(stats.providers.openrouter.requestCount).toBe(1);
      expect(stats.providers.openrouter.errorCount).toBe(0);
      expect(stats.providers.openrouter.averageResponseTime).toBe(400);

      // All providers should have lastUsed timestamps
      expect(stats.providers.openai.lastUsed).toBeInstanceOf(Date);
      expect(stats.providers.gemini.lastUsed).toBeInstanceOf(Date);
      expect(stats.providers.openrouter.lastUsed).toBeInstanceOf(Date);
    });

    it('should maintain data integrity under mixed operations', () => {
      const operations = [];

      // Create a mix of operations
      for (let i = 0; i < 50; i++) {
        operations.push(() => service.trackTokenUsage('openai', 10));
        operations.push(() => service.trackRequest('openai'));
        operations.push(() => service.trackResponseTime('openai', 100 + i));

        if (i % 10 === 0) {
          operations.push(() => service.trackError('openai'));
        }
      }

      // Execute all operations
      operations.forEach(op => op());

      const stats = service.getStats();

      // Verify data integrity
      expect(stats.providers.openai.tokensUsed).toBe(500); // 50 * 10
      expect(stats.providers.openai.requestCount).toBe(50);
      expect(stats.providers.openai.errorCount).toBe(5); // Every 10th operation
      expect(stats.providers.openai.averageResponseTime).toBeCloseTo(124.5, 1); // Average of 100-149
    });
  });
});
