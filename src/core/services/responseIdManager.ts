/**
 * @file Response ID Manager
 *
 * Centralized manager for handling provider response IDs.
 * Tracks the last response ID issued by OpenAI or Grok along with the
 * provider that generated it so we can reuse the ID on follow-up messages
 * and clear it automatically when the provider changes.
 */

import type { ProviderType } from '@/types/providers';
import { useSessionStore } from '@store/stores/sessionStore';

type SupportedProvider = Extract<ProviderType, 'openai' | 'grok'>;

class ResponseIdManager {
  private activeProvider: SupportedProvider | null = null;

  /** Check if a provider supports response IDs */
  private isSupported(providerType?: ProviderType | null): providerType is SupportedProvider {
    return providerType === 'openai' || providerType === 'grok';
  }

  /** Get the active session */
  private getSession() {
    return useSessionStore.getState().getActiveSession();
  }

  /** Get the provider stored in session (if any) */
  private getStoredProvider(): SupportedProvider | null {
    const provider = this.getSession()?.lastResponseProvider;
    return this.isSupported(provider) ? provider : null;
  }

  /** Determine if a response ID is currently stored */
  private hasStoredResponseId(): boolean {
    return Boolean(this.getSession()?.lastResponseId);
  }

  /**
   * Track which provider is about to be used. When a new provider is detected
   * we clear any previously stored response ID so conversations don't leak
   * between providers.
   */
  setActiveProvider(providerType: ProviderType | null): void {
    const currentProvider = this.activeProvider ?? this.getStoredProvider();

    if (!providerType || !this.isSupported(providerType)) {
      if (currentProvider || this.hasStoredResponseId()) {
        this.clearResponseId();
      }
      this.activeProvider = null;
      return;
    }

    if (currentProvider && currentProvider !== providerType) {
      this.clearResponseId();
    }

    this.activeProvider = providerType;
  }

  /** Retrieve the last stored response ID for the active provider */
  getResponseId(providerType?: ProviderType | null): string | null {
    const session = this.getSession();
    if (!session?.lastResponseId) {
      return null;
    }

    const targetProvider = providerType ?? this.activeProvider ?? this.getStoredProvider();
    if (!targetProvider || !this.isSupported(targetProvider)) {
      return null;
    }

    const storedProvider = this.getStoredProvider();
    if (storedProvider && storedProvider !== targetProvider) {
      return null;
    }

    return session.lastResponseId;
  }

  /** Store the latest response ID for the current provider */
  storeResponseId(providerType: ProviderType, responseId: string): void {
    if (!responseId || !this.isSupported(providerType)) {
      return;
    }

    const sessionStore = useSessionStore.getState();
    if (!sessionStore.getActiveSession()) {
      return;
    }

    sessionStore.updateActiveSession({
      lastResponseId: responseId,
      lastResponseProvider: providerType,
    });

    this.activeProvider = providerType;
  }

  /** Clear any stored response ID */
  clearResponseId(): void {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session && (session.lastResponseId || session.lastResponseProvider)) {
      sessionStore.updateActiveSession({
        lastResponseId: null,
        lastResponseProvider: null,
      });
    }

    this.activeProvider = null;
  }

  /** Utility for other modules to check if a provider participates in response IDs */
  supportsProvider(providerType?: ProviderType | null): providerType is SupportedProvider {
    return this.isSupported(providerType);
  }
}

export const responseIdManager = new ResponseIdManager();
