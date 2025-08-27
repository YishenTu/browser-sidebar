/**
 * @file Provider Registry
 *
 * Central registry for managing AI providers in the browser sidebar extension.
 * Supports registration, lookup, switching between providers, and event-driven
 * provider lifecycle management.
 *
 * Features:
 * - Provider registration and unregistration
 * - Provider lookup by type
 * - Active provider management and switching
 * - Event-driven architecture with lifecycle events
 * - Type-safe provider management
 * - Error handling for invalid operations
 * - Memory-efficient provider storage
 *
 * Events:
 * - providerRegistered: Emitted when a provider is registered
 * - providerUnregistered: Emitted when a provider is unregistered
 * - activeProviderChanged: Emitted when active provider changes
 */

import type { AIProvider, ProviderType, ProviderCapabilities } from '../types/providers';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Provider registration event data
 */
export interface ProviderRegisteredEvent {
  type: ProviderType;
  provider: AIProvider;
}

/**
 * Provider unregistration event data
 */
export interface ProviderUnregisteredEvent {
  type: ProviderType;
  provider: AIProvider;
}

/**
 * Active provider change event data
 */
export interface ActiveProviderChangedEvent {
  previousType: ProviderType | null;
  currentType: ProviderType | null;
  provider: AIProvider | null;
}

/**
 * Registry event types
 */
export type RegistryEventType =
  | 'providerRegistered'
  | 'providerUnregistered'
  | 'activeProviderChanged';

/**
 * Registry event data map
 */
export interface RegistryEventMap {
  providerRegistered: ProviderRegisteredEvent;
  providerUnregistered: ProviderUnregisteredEvent;
  activeProviderChanged: ActiveProviderChangedEvent;
}

/**
 * Event listener function type
 */
export type EventListener<T extends RegistryEventType> = (event: RegistryEventMap[T]) => void;

// ============================================================================
// Provider Metadata
// ============================================================================

/**
 * Provider metadata for registry operations
 */
export interface ProviderMetadata {
  type: ProviderType;
  name: string;
  capabilities: ProviderCapabilities;
}

// ============================================================================
// Provider Registry Class
// ============================================================================

/**
 * Central registry for managing AI providers
 */
export class ProviderRegistry {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private activeProviderType: ProviderType | null = null;
  private eventListeners: Map<RegistryEventType, Set<EventListener<unknown>>> = new Map();

  constructor() {
    // Initialize event listener maps
    this.eventListeners.set('providerRegistered', new Set());
    this.eventListeners.set('providerUnregistered', new Set());
    this.eventListeners.set('activeProviderChanged', new Set());
  }

  // ============================================================================
  // Provider Registration
  // ============================================================================

  /**
   * Register a provider in the registry
   * @param provider The provider to register
   * @returns True if registration was successful
   * @throws Error if provider is invalid
   */
  register(provider: AIProvider): boolean {
    // Validate provider
    this.validateProvider(provider);

    // Store the provider
    this.providers.set(provider.type, provider);

    // Emit registration event
    this.emit('providerRegistered', {
      type: provider.type,
      provider,
    });

    return true;
  }

  /**
   * Unregister a provider from the registry
   * @param type The provider type to unregister
   * @returns True if unregistration was successful, false if provider was not found
   */
  unregister(type: ProviderType): boolean {
    const provider = this.providers.get(type);
    if (!provider) {
      return false;
    }

    // Clear active provider if it's being unregistered
    if (this.activeProviderType === type) {
      this.clearActiveProvider();
    }

    // Remove from registry
    this.providers.delete(type);

    // Emit unregistration event
    this.emit('providerUnregistered', {
      type,
      provider,
    });

    return true;
  }

  // ============================================================================
  // Provider Lookup
  // ============================================================================

  /**
   * Get a provider by type
   * @param type The provider type
   * @returns The provider instance
   * @throws Error if provider is not found
   */
  getProvider(type: ProviderType): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider not found: ${type}`);
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   * @param type The provider type
   * @returns True if provider is registered
   */
  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get all registered provider types
   * @returns Array of registered provider types
   */
  getRegisteredProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider metadata
   * @param type The provider type
   * @returns Provider metadata
   * @throws Error if provider is not found
   */
  getProviderMetadata(type: ProviderType): ProviderMetadata {
    const provider = this.getProvider(type);
    return {
      type: provider.type,
      name: provider.name,
      capabilities: provider.capabilities,
    };
  }

  // ============================================================================
  // Active Provider Management
  // ============================================================================

  /**
   * Set the active provider
   * @param type The provider type to set as active
   * @returns True if setting was successful
   * @throws Error if provider is not found
   */
  setActiveProvider(type: ProviderType): boolean {
    // Ensure provider is registered
    if (!this.hasProvider(type)) {
      throw new Error(`Provider not found: ${type}`);
    }

    // Skip if already active
    if (this.activeProviderType === type) {
      return true;
    }

    const previousType = this.activeProviderType;
    this.activeProviderType = type;
    const provider = this.getProvider(type);

    // Emit change event
    this.emit('activeProviderChanged', {
      previousType,
      currentType: type,
      provider,
    });

    return true;
  }

  /**
   * Get the currently active provider
   * @returns The active provider or null if none is set
   */
  getActiveProvider(): AIProvider | null {
    if (!this.activeProviderType) {
      return null;
    }
    return this.providers.get(this.activeProviderType) || null;
  }

  /**
   * Get the currently active provider type
   * @returns The active provider type or null if none is set
   */
  getActiveProviderType(): ProviderType | null {
    return this.activeProviderType;
  }

  /**
   * Clear the active provider
   */
  clearActiveProvider(): void {
    if (this.activeProviderType) {
      const previousType = this.activeProviderType;
      this.activeProviderType = null;

      // Emit change event
      this.emit('activeProviderChanged', {
        previousType,
        currentType: null,
        provider: null,
      });
    }
  }

  // ============================================================================
  // Event Management
  // ============================================================================

  /**
   * Add an event listener
   * @param eventType The event type to listen for
   * @param listener The listener function
   */
  on<T extends RegistryEventType>(eventType: T, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove an event listener
   * @param eventType The event type to stop listening for
   * @param listener The listener function to remove
   */
  off<T extends RegistryEventType>(eventType: T, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event to all listeners
   * @param eventType The event type to emit
   * @param eventData The event data
   */
  private emit<T extends RegistryEventType>(eventType: T, eventData: RegistryEventMap[T]): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(eventData);
        } catch (error) {
          console.error(`Error in registry event listener for ${eventType}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate a provider before registration
   * @param provider The provider to validate
   * @throws Error if provider is invalid
   */
  private validateProvider(provider: unknown): asserts provider is AIProvider {
    if (!provider) {
      throw new Error('Invalid provider: missing required properties');
    }

    // Define validation schema
    const validationSchema = {
      requiredProperties: [
        'type',
        'name',
        'capabilities',
        'initialize',
        'validateConfig',
        'testConnection',
        'chat',
        'streamChat',
        'getModels',
        'getModel',
        'formatError',
      ],
      requiredMethods: [
        'initialize',
        'validateConfig',
        'testConnection',
        'chat',
        'streamChat',
        'getModels',
        'getModel',
        'formatError',
      ],
      validTypes: ['openai', 'gemini'] as const,
      requiredCapabilities: [
        'streaming',
        'temperature',
        'reasoning',
        'thinking',
        'multimodal',
        'functionCalling',
        'maxContextLength',
        'supportedModels',
      ],
    };

    // Check required properties exist
    const missingProperties = validationSchema.requiredProperties.filter(prop => {
      const value = provider[prop];
      return value === undefined || value === null;
    });

    if (missingProperties.length > 0) {
      throw new Error(`Invalid provider: missing required properties`);
    }

    // Validate required methods are functions
    const invalidMethods = validationSchema.requiredMethods.filter(
      method => typeof provider[method] !== 'function'
    );

    if (invalidMethods.length > 0) {
      throw new Error(`Invalid provider: missing required properties`);
    }

    // Validate provider type
    if (!validationSchema.validTypes.includes((provider as AIProvider).type as ProviderType)) {
      throw new Error(`Invalid provider: missing required properties`);
    }

    // Validate capabilities object
    if (!provider.capabilities || typeof provider.capabilities !== 'object') {
      throw new Error(`Invalid provider: missing required properties`);
    }

    const missingCapabilities = validationSchema.requiredCapabilities.filter(
      cap => provider.capabilities[cap] === undefined || provider.capabilities[cap] === null
    );

    if (missingCapabilities.length > 0) {
      throw new Error(`Invalid provider: missing required properties`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get registry statistics
   * @returns Registry statistics including total providers, active provider, and registered types
   */
  getStats(): {
    totalProviders: number;
    activeProvider: ProviderType | null;
    registeredTypes: ProviderType[];
  } {
    return {
      totalProviders: this.providers.size,
      activeProvider: this.activeProviderType,
      registeredTypes: this.getRegisteredProviders(),
    };
  }

  /**
   * Clear all providers from the registry
   * This will unregister all providers and clear the active provider
   */
  clear(): void {
    // Clear active provider first to emit appropriate events
    this.clearActiveProvider();

    // Unregister all providers (creates a copy to avoid mutation during iteration)
    const providersToRemove = Array.from(this.providers.keys());
    providersToRemove.forEach(type => {
      this.unregister(type);
    });
  }

  /**
   * Check if registry is empty
   * @returns True if registry has no registered providers
   */
  isEmpty(): boolean {
    return this.providers.size === 0;
  }

  /**
   * Get the number of registered providers
   * @returns The count of registered providers
   */
  size(): number {
    return this.providers.size;
  }
}
