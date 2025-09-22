/**
 * @file Engine Manager Service
 *
 * Central service for managing AI engine lifecycle, state, and statistics.
 * Provides a singleton service that manages engine registration, switching,
 * and usage tracking across the application.
 *
 * Features:
 * - Active engine management with persistence
 * - Engine switching with state validation
 * - Usage statistics tracking (tokens, requests, errors)
 * - Integration with EngineRegistry and settings store
 * - Support for all engine types (OpenAI, Gemini, OpenRouter, OpenAI-Compatible)
 * - Event-driven architecture for engine lifecycle
 * - Automatic engine initialization from settings
 * - Error handling and retry logic
 */

import { EngineRegistry } from '@core/engine/EngineRegistry';
import { EngineFactory } from '@core/engine/EngineFactory';
import { useSettingsStore } from '@store/settings';
import {
  getDefaultModelForProvider,
  OPENAI_COMPAT_PROVIDER_IDS,
  getModelsByProviderId,
  getModelById,
} from '@config/models';
import { listOpenAICompatProviders, getCompatProviderById } from '@/data/storage/keys/compat';
import type {
  AIProvider,
  ProviderType,
  ProviderConfig,
  ProviderError,
} from '../../types/providers';

// ============================================================================
// Types
// ============================================================================

/**
 * Engine usage statistics
 */
export interface EngineStats {
  /** Total tokens used across all providers */
  totalTokens: number;
  /** Total requests made across all providers */
  totalRequests: number;
  /** Total errors encountered across all providers */
  totalErrors: number;
  /** Per-provider statistics */
  providers: Record<
    ProviderType,
    {
      tokensUsed: number;
      requestCount: number;
      errorCount: number;
      lastUsed: Date | null;
      averageResponseTime: number;
    }
  >;
  /** Currently active provider */
  activeProvider: ProviderType | null;
  /** List of registered providers */
  registeredProviders: ProviderType[];
}

/**
 * Service configuration options
 */
export interface EngineManagerConfig {
  /** Enable automatic provider initialization from settings */
  autoInitialize?: boolean;
  /** Enable statistics tracking */
  enableStats?: boolean;
  /** Maximum number of retry attempts for failed operations */
  maxRetryAttempts?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Engine state management
 */
interface EngineState {
  isInitialized: boolean;
  isInitializing: boolean;
  lastError: ProviderError | null;
  initializationCount: number;
  lastInitializedAt: Date | null;
}

/**
 * Internal engine statistics
 */
interface InternalEngineStats {
  tokensUsed: number;
  requestCount: number;
  errorCount: number;
  lastUsed: Date | null;
  responseTimes: number[]; // For calculating average
}

// ============================================================================
// Engine Manager Service Class
// ============================================================================

/**
 * Central service for managing AI engines
 */
type EMEventListener = (event: unknown) => void;

export class EngineManagerService {
  private static instance: EngineManagerService | null = null;

  private registry: EngineRegistry;
  private factory: EngineFactory;
  private config: Required<EngineManagerConfig>;
  private state: EngineState;
  private stats: Map<ProviderType, InternalEngineStats>;
  private eventListeners: Map<string, Set<EMEventListener>>;

  // Track initialization state to prevent concurrent operations
  private lastInitializedKeys: Record<string, string | undefined> = {};
  private lastInitializedModel: string | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: EngineManagerConfig = {}) {
    this.registry = new EngineRegistry();
    this.factory = new EngineFactory();
    this.config = {
      autoInitialize: config.autoInitialize ?? true,
      enableStats: config.enableStats ?? true,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };

    this.state = {
      isInitialized: false,
      isInitializing: false,
      lastError: null,
      initializationCount: 0,
      lastInitializedAt: null,
    };

    this.stats = new Map();
    this.eventListeners = new Map();

    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: EngineManagerConfig): EngineManagerService {
    if (!EngineManagerService.instance) {
      EngineManagerService.instance = new EngineManagerService(config);
    } else if (config && config.enableStats === false) {
      // Allow turning stats off on subsequent calls without recreating instance
      EngineManagerService.instance.config.enableStats = false;
    }
    return EngineManagerService.instance;
  }

  /**
   * Reset singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    EngineManagerService.instance = null;
  }

  // ============================================================================
  // Core Engine Management
  // ============================================================================

  /**
   * Get the currently active provider
   */
  public getActive(): AIProvider {
    const activeProvider = this.registry.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active provider available. Please initialize providers first.');
    }
    return activeProvider;
  }

  /**
   * Switch to a different provider
   */
  public async switch(providerId: ProviderType): Promise<void> {
    try {
      // Special handling for OpenAI-compat providers
      if (providerId === 'openai_compat') {
        // Re-initialize to ensure the provider is configured for the current model
        const settingsStore = useSettingsStore.getState();
        const selectedModel = settingsStore.settings.selectedModel;

        // Unregister existing openai_compat provider if it exists
        if (this.registry.hasProvider('openai_compat')) {
          this.registry.unregister('openai_compat');
        }

        // Re-initialize with the current selected model
        await this.initializeOpenAICompatProvider(selectedModel);

        // After re-initialization, check if it was registered
        if (!this.registry.hasProvider('openai_compat')) {
          throw new Error(
            `Failed to initialize OpenAI-Compatible provider for model '${selectedModel}'`
          );
        }
      }

      // Validate provider is registered
      if (!this.registry.hasProvider(providerId)) {
        throw new Error(
          `Provider '${providerId}' is not registered. Available providers: ${this.registry.getRegisteredProviders().join(', ')}`
        );
      }

      // Get current active provider for comparison
      const currentProvider = this.registry.getActiveProviderType();

      // Switch in registry
      this.registry.setActiveProvider(providerId);

      // Update settings store with the selected provider
      const settingsStore = useSettingsStore.getState();
      await settingsStore.updateAISettings({
        ...settingsStore.settings.ai,
        defaultProvider: providerId,
      });

      // Emit provider switch event
      this.emit('providerSwitched', {
        from: currentProvider,
        to: providerId,
        timestamp: new Date(),
      });

      // Track switching in stats
      if (this.config.enableStats) {
        this.updateProviderStats(providerId, 'switch');
      }
    } catch (error) {
      const providerError: ProviderError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'PROVIDER_SWITCH_FAILED',
        provider: providerId,
        details: {
          timestamp: new Date(),
        },
      };

      this.state.lastError = providerError;

      if (this.config.enableStats) {
        this.updateProviderStats(providerId, 'error');
      }

      throw error;
    }
  }

  /**
   * Get engine usage statistics
   */
  public getStats(): EngineStats {
    const providerStats: Record<
      ProviderType,
      {
        tokensUsed: number;
        requestCount: number;
        errorCount: number;
        lastUsed: Date | null;
        averageResponseTime: number;
      }
    > = {} as Record<
      ProviderType,
      {
        tokensUsed: number;
        requestCount: number;
        errorCount: number;
        lastUsed: Date | null;
        averageResponseTime: number;
      }
    >;
    let totalTokens = 0;
    let totalRequests = 0;
    let totalErrors = 0;

    // Calculate stats for each provider type
    (['openai', 'gemini', 'openrouter', 'openai_compat'] as ProviderType[]).forEach(
      providerType => {
        const stats = this.stats.get(providerType) || this.getEmptyStats();
        const averageResponseTime =
          stats.responseTimes.length > 0
            ? stats.responseTimes.reduce((sum: number, time: number) => sum + time, 0) /
              stats.responseTimes.length
            : 0;

        providerStats[providerType] = {
          tokensUsed: stats.tokensUsed,
          requestCount: stats.requestCount,
          errorCount: stats.errorCount,
          lastUsed: stats.lastUsed,
          averageResponseTime,
        };

        totalTokens += stats.tokensUsed;
        totalRequests += stats.requestCount;
        totalErrors += stats.errorCount;
      }
    );

    const activeProvider =
      typeof (
        this.registry as EngineRegistry & { getActiveProviderType?: () => ProviderType | null }
      )?.getActiveProviderType === 'function'
        ? (
            this.registry as EngineRegistry & { getActiveProviderType: () => ProviderType | null }
          ).getActiveProviderType()
        : null;
    const registeredProviders =
      typeof (this.registry as EngineRegistry & { getRegisteredProviders?: () => ProviderType[] })
        ?.getRegisteredProviders === 'function'
        ? (
            this.registry as EngineRegistry & { getRegisteredProviders: () => ProviderType[] }
          ).getRegisteredProviders()
        : [];

    return {
      totalTokens,
      totalRequests,
      totalErrors,
      providers: providerStats,
      activeProvider,
      registeredProviders,
    };
  }

  // ============================================================================
  // Provider Initialization
  // ============================================================================

  /**
   * Initialize providers from settings store
   */
  public async initializeFromSettings(): Promise<void> {
    if (this.state.isInitializing) {
      return; // Prevent concurrent initialization
    }

    try {
      this.state.isInitializing = true;
      this.state.lastError = null;

      const settingsStore = useSettingsStore.getState();
      const { settings } = settingsStore;

      if (!settings || !settings.apiKeys) {
        throw new Error('Settings or API keys not available');
      }

      // Check if settings have changed to avoid unnecessary re-initialization
      const { apiKeys } = settings;
      const keysChanged =
        apiKeys['openai'] !== this.lastInitializedKeys['openai'] ||
        apiKeys['google'] !== this.lastInitializedKeys['google'] ||
        apiKeys['openrouter'] !== this.lastInitializedKeys['openrouter'];

      const modelChanged = settings.selectedModel !== this.lastInitializedModel;

      if (!keysChanged && !modelChanged && this.state.isInitialized && this.registry.size() > 0) {
        return; // No changes, skip re-initialization
      }

      // Update tracking state
      this.lastInitializedKeys = {
        openai: apiKeys['openai'] || undefined,
        google: apiKeys['google'] || undefined,
        openrouter: apiKeys['openrouter'] || undefined,
      };
      this.lastInitializedModel = settings.selectedModel;

      // Clear existing providers
      this.registry.clear();

      // Initialize new providers based on available API keys
      const initPromises: Promise<void>[] = [];

      if (apiKeys['openai']) {
        initPromises.push(this.initializeOpenAIProvider(apiKeys['openai'], settings.selectedModel));
      }

      if (apiKeys['google']) {
        initPromises.push(this.initializeGeminiProvider(apiKeys['google'], settings.selectedModel));
      }

      if (apiKeys['openrouter']) {
        initPromises.push(
          this.initializeOpenRouterProvider(apiKeys['openrouter'], settings.selectedModel)
        );
      }

      // Initialize OpenAI-Compatible provider if the selected model belongs to a
      // compat provider saved in storage. This registers a single logical
      // 'openai_compat' provider configured for that provider/model.
      initPromises.push(this.initializeOpenAICompatProvider(settings.selectedModel));

      // Wait for all provider initializations
      await Promise.allSettled(initPromises);

      // Set active provider based on settings
      const registeredProviders = this.registry.getRegisteredProviders();
      if (registeredProviders.length > 0) {
        const targetProvider = settings.ai.defaultProvider;
        if (targetProvider && registeredProviders.includes(targetProvider)) {
          this.registry.setActiveProvider(targetProvider);
        } else {
          // Fallback to first registered provider
          const firstProvider = registeredProviders[0];
          if (firstProvider) {
            this.registry.setActiveProvider(firstProvider);
          }
        }
      }

      this.state.isInitialized = true;
      this.state.initializationCount++;
      this.state.lastInitializedAt = new Date();

      // Emit initialization complete event
      this.emit('initialized', {
        providersCount: registeredProviders.length,
        activeProvider: this.registry.getActiveProviderType(),
        timestamp: new Date(),
      });
    } catch (error) {
      const providerError: ProviderError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Initialization failed',
        code: 'INITIALIZATION_FAILED',
        provider: 'openai', // Default fallback
        details: {
          timestamp: new Date(),
          initializationCount: this.state.initializationCount,
        },
      };

      this.state.lastError = providerError;
      throw error;
    } finally {
      this.state.isInitializing = false;
    }
  }

  // ============================================================================
  // Private Provider Initialization Methods
  // ============================================================================

  private async initializeOpenAIProvider(apiKey: string, selectedModel: string): Promise<void> {
    try {
      const config: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey,
          model: selectedModel.startsWith('gpt-')
            ? selectedModel
            : getDefaultModelForProvider('openai') || 'gpt-5-nano',
          reasoningEffort: 'low',
        },
      };

      const provider = await this.factory.createProvider(config);
      this.registry.register(provider);
      this.initializeProviderStats('openai');
    } catch (error) {
      // Log error but don't throw to allow other providers to initialize
      // Failed to initialize OpenAI provider
    }
  }

  private async initializeGeminiProvider(apiKey: string, selectedModel: string): Promise<void> {
    try {
      const config: ProviderConfig = {
        type: 'gemini',
        config: {
          apiKey,
          model: selectedModel.startsWith('gemini-')
            ? selectedModel
            : getDefaultModelForProvider('gemini') || 'gemini-2.5-flash-lite',
          // Use model preset's default thinking budget when available
          thinkingBudget:
            (getModelById(
              selectedModel.startsWith('gemini-')
                ? selectedModel
                : getDefaultModelForProvider('gemini') || 'gemini-2.5-flash-lite'
            )?.thinkingBudget as number | undefined) ?? -1,
        },
      };

      const provider = await this.factory.createProvider(config);
      this.registry.register(provider);
      this.initializeProviderStats('gemini');
    } catch (error) {
      // Failed to initialize Gemini provider
    }
  }

  private async initializeOpenRouterProvider(apiKey: string, selectedModel: string): Promise<void> {
    try {
      const config: ProviderConfig = {
        type: 'openrouter',
        config: {
          apiKey,
          model: selectedModel.includes('anthropic/')
            ? selectedModel
            : getDefaultModelForProvider('openrouter') || 'anthropic/claude-sonnet-4',
        },
      };

      const provider = await this.factory.createProvider(config);
      this.registry.register(provider);
      this.initializeProviderStats('openrouter');
    } catch (error) {
      // Failed to initialize OpenRouter provider
    }
  }

  /**
   * Initialize OpenAI-Compatible provider for selected compat model
   */
  private async initializeOpenAICompatProvider(selectedModel: string): Promise<void> {
    try {
      // First, check if the selected model is an OpenAI-compat model
      let matchedProviderId: string | null = null;
      for (const pid of OPENAI_COMPAT_PROVIDER_IDS) {
        const models = getModelsByProviderId(pid);
        if (models.some(m => m.id === selectedModel)) {
          matchedProviderId = pid;
          break;
        }
      }

      // If not a built-in preset, check custom providers stored in settings
      if (!matchedProviderId) {
        const compatProviders = await listOpenAICompatProviders();
        for (const p of compatProviders) {
          if (p.model && p.model.id === selectedModel) {
            matchedProviderId = p.id;
            break;
          }
        }
      }

      // If selected model is not compat, do not register a placeholder compat provider.
      if (!matchedProviderId) {
        return; // No compat provider for selected model — skip registration
      }

      const details = await getCompatProviderById(matchedProviderId);
      if (!details) {
        // Compat provider details not found
        return;
      }

      // Use the provider's default model if the selected model isn't compatible
      const modelToUse =
        selectedModel.includes(matchedProviderId) ||
        (details.model && selectedModel === details.model.id)
          ? selectedModel
          : details.model?.id || selectedModel;

      const provider = await this.factory.createProvider({
        type: 'openai_compat',
        config: {
          apiKey: details.apiKey,
          model: modelToUse,
          baseURL: details.baseURL,
          metadata: { providerId: details.id, modelName: details.model?.name },
        },
      });
      this.registry.register(provider);
      this.initializeProviderStats('openai_compat');
    } catch (error) {
      // Failed to initialize OpenAI-Compatible provider
    }
  }

  // ============================================================================
  // Statistics Management
  // ============================================================================

  private initializeProviderStats(providerType: ProviderType): void {
    if (!this.stats.has(providerType)) {
      this.stats.set(providerType, this.getEmptyStats());
    }
  }

  private getEmptyStats(): InternalEngineStats {
    return {
      tokensUsed: 0,
      requestCount: 0,
      errorCount: 0,
      lastUsed: null,
      responseTimes: [],
    };
  }

  private updateProviderStats(
    providerType: ProviderType,
    event: 'request' | 'tokens' | 'error' | 'switch' | 'response_time',
    value?: number
  ): void {
    if (!this.config.enableStats) return;

    const stats = this.stats.get(providerType) || this.getEmptyStats();

    switch (event) {
      case 'request':
        stats.requestCount++;
        stats.lastUsed = new Date();
        break;
      case 'tokens':
        if (typeof value === 'number') {
          stats.tokensUsed += value;
        }
        break;
      case 'error':
        stats.errorCount++;
        break;
      case 'switch':
        stats.lastUsed = new Date();
        break;
      case 'response_time':
        if (typeof value === 'number') {
          stats.responseTimes.push(value);
          // Keep only last 100 response times to prevent memory bloat
          if (stats.responseTimes.length > 100) {
            stats.responseTimes = stats.responseTimes.slice(-100);
          }
        }
        break;
    }

    this.stats.set(providerType, stats);
  }

  /**
   * Track token usage for a provider
   */
  public trackTokenUsage(providerType: ProviderType, tokens: number): void {
    this.updateProviderStats(providerType, 'tokens', tokens);
  }

  /**
   * Track request for a provider
   */
  public trackRequest(providerType: ProviderType): void {
    this.updateProviderStats(providerType, 'request');
  }

  /**
   * Track error for a provider
   */
  public trackError(providerType: ProviderType): void {
    this.updateProviderStats(providerType, 'error');
  }

  /**
   * Track response time for a provider
   */
  public trackResponseTime(providerType: ProviderType, responseTime: number): void {
    this.updateProviderStats(providerType, 'response_time', responseTime);
  }

  // ============================================================================
  // Event Management
  // ============================================================================

  private setupEventListeners(): void {
    // Listen to registry events if registry supports event APIs (mock-friendly)
    const registryWithEvents = this.registry as EngineRegistry & {
      on?: (event: string, listener: (data: unknown) => void) => void;
    };
    const hasOn = typeof registryWithEvents.on === 'function';
    if (!hasOn) {
      return;
    }

    registryWithEvents.on('activeProviderChanged', (event: unknown) => {
      this.emit('activeProviderChanged', event);
    });

    registryWithEvents.on('providerRegistered', (event: unknown) => {
      const eventWithType = event as { type?: ProviderType };
      if (eventWithType.type) {
        this.initializeProviderStats(eventWithType.type);
      }
      this.emit('providerRegistered', event);
    });

    registryWithEvents.on('providerUnregistered', (event: unknown) => {
      this.emit('providerUnregistered', event);
    });
  }

  /**
   * Add event listener
   */
  public on(eventType: string, listener: EMEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public off(eventType: string, listener: EMEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(eventType: string, eventData: unknown): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(eventData);
        } catch (error) {
          // Ignore listener errors
          // Event listener error
        }
      });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get service state information
   */
  public getServiceState(): {
    isInitialized: boolean;
    isInitializing: boolean;
    lastError: ProviderError | null;
    initializationCount: number;
    lastInitializedAt: Date | null;
    registeredProviders: ProviderType[];
    activeProvider: ProviderType | null;
  } {
    const registeredProviders =
      typeof (this.registry as EngineRegistry & { getRegisteredProviders?: () => ProviderType[] })
        ?.getRegisteredProviders === 'function'
        ? (
            this.registry as EngineRegistry & { getRegisteredProviders: () => ProviderType[] }
          ).getRegisteredProviders()
        : [];
    const activeProvider =
      typeof (
        this.registry as EngineRegistry & { getActiveProviderType?: () => ProviderType | null }
      )?.getActiveProviderType === 'function'
        ? (
            this.registry as EngineRegistry & { getActiveProviderType: () => ProviderType | null }
          ).getActiveProviderType()
        : null;

    return {
      ...this.state,
      registeredProviders,
      activeProvider,
    };
  }

  /**
   * Check if service is ready for use
   */
  public isReady(): boolean {
    return (
      this.state.isInitialized &&
      !this.state.isInitializing &&
      this.registry.size() > 0 &&
      this.registry.getActiveProvider() !== null
    );
  }

  /**
   * Reset service state (primarily for testing)
   */
  public reset(): void {
    const registryWithClear = this.registry as EngineRegistry & { clear?: () => void };
    if (typeof registryWithClear.clear === 'function') {
      registryWithClear.clear();
    }
    this.stats.clear();
    this.eventListeners.clear();
    this.state = {
      isInitialized: false,
      isInitializing: false,
      lastError: null,
      initializationCount: 0,
      lastInitializedAt: null,
    };
    this.lastInitializedKeys = {};
    this.lastInitializedModel = null;
    this.setupEventListeners();
  }

  /**
   * Get registry instance (for advanced usage)
   */
  public getRegistry(): EngineRegistry {
    return this.registry;
  }

  /**
   * Get factory instance (for advanced usage)
   */
  public getFactory(): EngineFactory {
    return this.factory;
  }
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default singleton instance
 */
export const engineManager = EngineManagerService.getInstance();

/**
 * Factory function for creating new instances (primarily for testing)
 */
export function createEngineManagerService(config?: EngineManagerConfig): EngineManagerService {
  // Create a new instance via private constructor access for testing
  const EngineManagerConstructor = EngineManagerService as unknown as new (
    config?: EngineManagerConfig
  ) => EngineManagerService;
  return new EngineManagerConstructor(config);
}
