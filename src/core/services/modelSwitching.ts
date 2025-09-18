/**
 * @file Model switching service
 * Handles the complex logic of switching between AI models and providers
 */

import { useSettingsStore } from '@store/settings';
import { useUIStore } from '@store/chat';
import type { ProviderType } from '@/types/providers';

export interface ModelSwitchResult {
  success: boolean;
  previousModel?: string;
  error?: string;
}

export interface ModelSwitchOptions {
  modelId: string;
  updateSelectedModel: (modelId: string) => Promise<void>;
  switchProvider: (providerType: ProviderType) => Promise<void>;
  getProviderTypeForModel: (modelId: string) => string | null;
  onApiKeyMissing?: () => void;
}

/**
 * Switch to a different AI model, handling provider changes and rollback
 */
export async function switchModel(options: ModelSwitchOptions): Promise<ModelSwitchResult> {
  const { modelId, updateSelectedModel, switchProvider, getProviderTypeForModel, onApiKeyMissing } =
    options;

  // Get current state
  const state = useSettingsStore.getState();
  const previousModel = state.settings.selectedModel;

  try {
    // Check if model is available (has API key)
    const isAvailable = state.settings.availableModels.some(m => m.id === modelId && m.available);

    if (!isAvailable) {
      // Trigger callback for missing API key
      onApiKeyMissing?.();
      return {
        success: false,
        previousModel,
        error: 'API key required',
      };
    }

    // Atomic operation: Try to switch both model and provider
    try {
      // First update the model in settings
      await updateSelectedModel(modelId);

      // Then switch the provider if needed
      const providerType = getProviderTypeForModel(modelId) as ProviderType | null;
      if (providerType) {
        await switchProvider(providerType);
      }

      // Handle OpenAI-specific state clearing
      const prevProvider = getProviderTypeForModel(previousModel) as ProviderType | null;
      if (prevProvider === 'openai' && providerType === 'openai' && modelId !== previousModel) {
        // Clear stored response id so the next OpenAI call sends full history
        useUIStore.getState().setLastResponseId(null);
      }

      return {
        success: true,
        previousModel,
      };
    } catch (switchError) {
      // Rollback: Restore previous model if provider switch failed
      await updateSelectedModel(previousModel);

      const errorMsg =
        switchError instanceof Error ? switchError.message : 'Failed to switch provider';

      return {
        success: false,
        previousModel,
        error: errorMsg,
      };
    }
  } catch (err) {
    return {
      success: false,
      previousModel,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
