/**
 * @file Provider Manager Hook
 *
 * Manages AI provider initialization, registration, and switching.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@store/settings';
import { ProviderRegistry } from '../../../provider/ProviderRegistry';
import { ProviderFactory } from '../../../provider/ProviderFactory';
import {
  SUPPORTED_MODELS,
  DEFAULT_OPENROUTER_MODEL_ID,
  OPENAI_COMPAT_PROVIDER_IDS,
  getModelsByProviderId,
} from '../../../config/models';
import { listOpenAICompatProviders, getCompatProviderById } from '@/data/storage/keys/compat';
import type { ProviderType, AIProvider, ProviderConfig } from '../../../types/providers';
import type { UseProviderManagerReturn, AIStats } from './types';

export function useProviderManager(enabled = true): UseProviderManagerReturn {
  const settingsStore = useSettingsStore();

  // Refs for persistent instances
  const registryRef = useRef<ProviderRegistry | null>(null);
  const factoryRef = useRef<ProviderFactory | null>(null);

  // Track initialization state
  const lastInitializedKeysRef = useRef<{ openai?: string; google?: string; openrouter?: string }>(
    {}
  );
  const lastInitializedModelRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(false);

  /**
   * Initialize provider infrastructure
   */
  const initializeInfrastructure = useCallback(() => {
    if (!registryRef.current) {
      registryRef.current = new ProviderRegistry();
    }
    if (!factoryRef.current) {
      factoryRef.current = new ProviderFactory();
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (enabled) {
      initializeInfrastructure();
    }
  }, [enabled, initializeInfrastructure]);

  /**
   * Initialize providers from settings
   */
  const initializeProviders = useCallback(async () => {
    // Prevent concurrent initialization
    if (isInitializingRef.current) {
      return;
    }

    try {
      isInitializingRef.current = true;

      const { settings } = settingsStore;
      if (!settings || !settings.apiKeys) {
        return;
      }

      const { apiKeys } = settings;

      // Check if API keys or selected model have changed
      const keysChanged =
        apiKeys.openai !== lastInitializedKeysRef.current.openai ||
        apiKeys.google !== lastInitializedKeysRef.current.google ||
        apiKeys.openrouter !== lastInitializedKeysRef.current.openrouter;

      const modelChanged = settings.selectedModel !== lastInitializedModelRef.current;

      if (
        !keysChanged &&
        !modelChanged &&
        registryRef.current &&
        registryRef.current.getRegisteredProviders().length > 0
      ) {
        // No changes, skip re-initialization
        return;
      }

      // Update last initialized state
      lastInitializedKeysRef.current = {
        openai: apiKeys.openai || undefined,
        google: apiKeys.google || undefined,
        openrouter: apiKeys.openrouter || undefined,
      };
      lastInitializedModelRef.current = settings.selectedModel;

      if (!registryRef.current || !factoryRef.current) {
        return;
      }

      // Clear existing providers
      const existingProviders = registryRef.current.getRegisteredProviders();
      for (const providerType of existingProviders) {
        registryRef.current.unregister(providerType);
      }

      // Ensure available models include OpenAI-compatible entries before any selection
      try {
        await settingsStore.refreshAvailableModelsWithCompat();
      } catch {
        // Ignore errors during model refresh
      }

      // Create provider configurations
      const providerConfigs: ProviderConfig[] = [];
      const selectedModelId = settings.selectedModel;
      const selectedModel = SUPPORTED_MODELS.find(m => m.id === selectedModelId);

      // Find fallback models
      const defaultOpenAIModel = SUPPORTED_MODELS.find(m => m.provider === 'openai');
      const defaultGeminiModel = SUPPORTED_MODELS.find(m => m.provider === 'gemini');
      const defaultOpenRouterModel =
        SUPPORTED_MODELS.find(m => m.id === DEFAULT_OPENROUTER_MODEL_ID) ||
        SUPPORTED_MODELS.find(m => m.provider === 'openrouter');

      if (apiKeys.openai) {
        const openAIModel =
          selectedModel?.provider === 'openai' ? selectedModel : defaultOpenAIModel;
        if (openAIModel) {
          providerConfigs.push({
            type: 'openai',
            config: {
              apiKey: apiKeys.openai,
              model: openAIModel.id,
              reasoningEffort: openAIModel.reasoningEffort || 'low',
            },
          });
        }
      }

      if (apiKeys.google) {
        const geminiModel =
          selectedModel?.provider === 'gemini' ? selectedModel : defaultGeminiModel;
        if (geminiModel) {
          const thinkingBudget = geminiModel.thinkingBudget || '0';
          // Automatically enable showThoughts when thinking budget is non-zero
          const showThoughts = thinkingBudget !== '0';

          providerConfigs.push({
            type: 'gemini',
            config: {
              apiKey: apiKeys.google,
              model: geminiModel.id,
              thinkingBudget,
              showThoughts,
            },
          });
        }
      }

      if (apiKeys.openrouter) {
        const openrouterModel =
          selectedModel?.provider === 'openrouter' ? selectedModel : defaultOpenRouterModel;
        if (openrouterModel) {
          providerConfigs.push({
            type: 'openrouter',
            config: {
              apiKey: apiKeys.openrouter,
              model: openrouterModel.id,
            },
          });
        }
      }

      // OpenAI-compatible providers (built-in and custom) via encrypted storage
      const compatProviders = await listOpenAICompatProviders();
      let selectedCompat: { id: string; modelId: string } | null = null;

      // Determine if selected model belongs to a compat provider
      for (const pid of OPENAI_COMPAT_PROVIDER_IDS as readonly string[]) {
        const models = getModelsByProviderId(pid);
        if (models.some(m => m.id === selectedModelId)) {
          selectedCompat = { id: pid as string, modelId: selectedModelId };
          break;
        }
      }
      if (!selectedCompat) {
        for (const p of compatProviders) {
          if (p.model && p.model.id === selectedModelId) {
            selectedCompat = { id: p.id, modelId: p.model.id };
            break;
          }
        }
      }

      if (selectedCompat) {
        const full = await getCompatProviderById(selectedCompat.id);
        if (full) {
          providerConfigs.push({
            type: 'openai_compat',
            config: {
              apiKey: full.apiKey,
              model: selectedCompat.modelId,
              baseURL: full.baseURL,
              metadata: { providerId: full.id },
            } as unknown as any,
          });
        }
      }

      // Create and register providers
      for (const config of providerConfigs) {
        try {
          const provider = await factoryRef.current.createProvider(config);
          registryRef.current.register(provider);
        } catch (error) {
          // Skip invalid provider configurations
        }
      }

      // Set active provider based on selected model
      if (selectedModel && registryRef.current) {
        const providerMap: Record<string, 'openai' | 'gemini' | 'openrouter' | 'openai_compat'> = {
          openai: 'openai',
          gemini: 'gemini',
          openrouter: 'openrouter',
        };
        // If selected model is compat, force openai_compat
        let targetProvider = providerMap[selectedModel.provider] ?? 'openai';
        if (selectedCompat) {
          targetProvider = 'openai_compat';
        }
        if (registryRef.current.hasProvider(targetProvider)) {
          registryRef.current.setActiveProvider(targetProvider);
        } else if (providerConfigs.length > 0 && providerConfigs[0]) {
          registryRef.current.setActiveProvider(providerConfigs[0].type);
        }
      }
    } catch (error) {
      // Provider initialization can fail silently - UI will show appropriate error
    } finally {
      isInitializingRef.current = false;
    }
  }, [settingsStore]);

  /**
   * Get the active AI provider
   */
  const getActiveProvider = useCallback((): AIProvider | null => {
    if (!registryRef.current) return null;
    return registryRef.current.getActiveProvider();
  }, []);

  /**
   * Switch to a different provider
   */
  const switchProvider = useCallback(
    async (providerType: ProviderType) => {
      try {
        // Switch provider in registry
        if (registryRef.current) {
          if (!registryRef.current.hasProvider(providerType)) {
            return;
          }
          registryRef.current.setActiveProvider(providerType);
        }

        // Clear OpenAI response ID when switching to a different provider
        // This ensures clean state when switching between providers
        if (providerType !== 'openai') {
          const { useUIStore } = await import('@store/chat');
          useUIStore.getState().setLastResponseId(null);
        }

        // Update settings store
        await settingsStore.updateAISettings({
          ...settingsStore.settings.ai,
          defaultProvider: providerType,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to switch provider: ${errorMessage}`);
      }
    },
    [settingsStore]
  );

  /**
   * Get provider statistics
   */
  const getStats = useCallback((): AIStats => {
    return {
      activeProvider: registryRef.current?.getActiveProviderType() || null,
      registeredProviders: registryRef.current?.getRegisteredProviders() || [],
    };
  }, []);

  return {
    getActiveProvider,
    switchProvider,
    initializeProviders,
    getStats,
  };
}
