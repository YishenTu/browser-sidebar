/**
 * Engine Compatibility: EngineRegistry (copied)
 */
import type { AIProvider, ProviderType, ProviderCapabilities } from '@/types/providers';

export interface ProviderRegisteredEvent {
  type: ProviderType;
  provider: AIProvider;
}
export interface ProviderUnregisteredEvent {
  type: ProviderType;
  provider: AIProvider;
}
export interface ActiveProviderChangedEvent {
  previousType: ProviderType | null;
  currentType: ProviderType | null;
  provider: AIProvider | null;
}
export type RegistryEventType =
  | 'providerRegistered'
  | 'providerUnregistered'
  | 'activeProviderChanged';
export interface RegistryEventMap {
  providerRegistered: ProviderRegisteredEvent;
  providerUnregistered: ProviderUnregisteredEvent;
  activeProviderChanged: ActiveProviderChangedEvent;
}
export type EventListener<T extends RegistryEventType> = (event: RegistryEventMap[T]) => void;
export interface ProviderMetadata {
  type: ProviderType;
  name: string;
  capabilities: ProviderCapabilities;
}

export class EngineRegistry {
  private providers: Map<ProviderType, AIProvider> = new Map();
  private activeProviderType: ProviderType | null = null;
  private eventListeners: Map<RegistryEventType, Set<EventListener<RegistryEventType>>> = new Map();
  constructor() {
    this.eventListeners.set('providerRegistered', new Set());
    this.eventListeners.set('providerUnregistered', new Set());
    this.eventListeners.set('activeProviderChanged', new Set());
  }
  register(provider: AIProvider): boolean {
    this.validateProvider(provider);
    this.providers.set(provider.type, provider);
    this.emit('providerRegistered', { type: provider.type, provider });
    return true;
  }
  unregister(type: ProviderType): boolean {
    const provider = this.providers.get(type);
    if (!provider) return false;
    if (this.activeProviderType === type) this.clearActiveProvider();
    this.providers.delete(type);
    this.emit('providerUnregistered', { type, provider });
    return true;
  }
  getProvider(type: ProviderType): AIProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Provider not found: ${type}`);
    return provider;
  }
  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }
  getRegisteredProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
  getProviderMetadata(type: ProviderType): ProviderMetadata {
    const provider = this.getProvider(type);
    return { type: provider.type, name: provider.name, capabilities: provider.capabilities };
  }
  setActiveProvider(type: ProviderType): boolean {
    if (!this.hasProvider(type)) throw new Error(`Provider not found: ${type}`);
    if (this.activeProviderType === type) return true;
    const previousType = this.activeProviderType;
    this.activeProviderType = type;
    const provider = this.getProvider(type);
    this.emit('activeProviderChanged', { previousType, currentType: type, provider });
    return true;
  }
  getActiveProvider(): AIProvider | null {
    return this.activeProviderType ? this.providers.get(this.activeProviderType) || null : null;
  }
  getActiveProviderType(): ProviderType | null {
    return this.activeProviderType;
  }
  clearActiveProvider(): void {
    if (this.activeProviderType) {
      const previousType = this.activeProviderType;
      this.activeProviderType = null;
      this.emit('activeProviderChanged', { previousType, currentType: null, provider: null });
    }
  }
  on<T extends RegistryEventType>(eventType: T, listener: EventListener<T>): void {
    const set = this.eventListeners.get(eventType) as Set<EventListener<T>> | undefined;
    set?.add(listener);
  }
  off<T extends RegistryEventType>(eventType: T, listener: EventListener<T>): void {
    const set = this.eventListeners.get(eventType) as Set<EventListener<T>> | undefined;
    set?.delete(listener);
  }
  private emit<T extends RegistryEventType>(eventType: T, eventData: RegistryEventMap[T]): void {
    const set = this.eventListeners.get(eventType) as Set<EventListener<T>> | undefined;
    set?.forEach(l => {
      try {
        l(eventData);
      } catch {
        // Ignore listener errors
      }
    });
  }
  private validateProvider(provider: unknown): asserts provider is AIProvider {
    if (!provider) throw new Error('Invalid provider: missing required properties');
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
    const rec = provider as Record<string, unknown>;
    const missing = requiredProps.filter(p => rec[p] === undefined || rec[p] === null);
    if (missing.length > 0) throw new Error('Invalid provider: missing required properties');
  }
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
  clear(): void {
    this.clearActiveProvider();
    Array.from(this.providers.keys()).forEach(t => this.unregister(t));
  }
  isEmpty(): boolean {
    return this.providers.size === 0;
  }
  size(): number {
    return this.providers.size;
  }
}
