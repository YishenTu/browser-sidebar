/**
 * @file Settings Store Implementation
 *
 * Zustand store for managing application settings with Chrome storage persistence,
 * validation, and migration support.
 */

import { create } from 'zustand';
import type {
  Settings,
  SettingsState,
  UIPreferences,
  AISettings,
  PrivacySettings,
  APIKeyReferences,
  Model,
  ExtractionPreferences,
} from '@/types/settings';
import {
  DEFAULT_MODELS,
  DEFAULT_MODEL_ID,
  getProviderTypeForModelId,
  getModelsByProviderId,
  OPENAI_COMPAT_PROVIDER_IDS,
} from '@/config/models';
import { listOpenAICompatProviders } from '@/data/storage/keys/compat';
import { setMultiple, getMultiple } from '@platform/chrome/storage';

/**
 * Current settings schema version
 */
const SETTINGS_VERSION = 1;

/**
 * Storage key for settings in chrome.storage
 */
const STORAGE_KEY = 'settings';

/**
 * Legacy catalog of all models. We no longer surface this list directly to the
 * UI; `availableModels` is computed from stored/valid API keys and compat
 * providers. Kept for mapping when keys are present.
 */
const DEFAULT_AVAILABLE_MODELS: Model[] = DEFAULT_MODELS.map(model => ({
  id: model.id,
  name: model.name,
  provider: model.provider,
  available: true,
}));

/**
 * Default settings configuration
 */
const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
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
  ai: {
    defaultProvider: null,
    streamResponse: true,
  },
  privacy: {
    saveConversations: true,
    shareAnalytics: false,
    clearOnClose: false,
  },
  apiKeys: {
    openai: null,
    google: null,
    openrouter: null,
  },
  extraction: {
    // Built-in defaults; user can modify in Settings UI
    domainRules: [
      { domain: 'x.com', mode: 'defuddle' },
      { domain: 'reddit.com', mode: 'defuddle' },
    ],
  },
  selectedModel: DEFAULT_MODEL_ID,
  // Empty by default; populated based on saved keys/compat providers
  availableModels: [],
};

/**
 * Validate font size value
 */
const isValidFontSize = (fontSize: unknown): fontSize is 'small' | 'medium' | 'large' => {
  return typeof fontSize === 'string' && ['small', 'medium', 'large'].includes(fontSize);
};

/**
 * Validate AI provider value
 */
const isValidProvider = (
  provider: unknown
): provider is 'openai' | 'gemini' | 'openrouter' | 'openai_compat' | null => {
  return (
    provider === null ||
    (typeof provider === 'string' &&
      ['openai', 'gemini', 'openrouter', 'openai_compat'].includes(provider))
  );
};

/**
 * Validate selected model against available models
 */
const isValidSelectedModel = (modelId: unknown, availableModels: Model[]): boolean => {
  if (typeof modelId !== 'string' || modelId.length === 0) {
    return false;
  }
  return availableModels.some(model => model.id === modelId);
};

/**
 * Map model provider display name to provider type
 */
const getProviderTypeFromModel = (
  model: Model
): 'openai' | 'gemini' | 'openrouter' | 'openai_compat' | null => {
  // Prefer centralized config mapping
  const coreType = getProviderTypeForModelId(model.id);
  if (coreType) return coreType;

  // Map well-known display names if present
  if (model.provider === 'OpenAI') return 'openai';
  if (model.provider === 'Google') return 'gemini';
  if (model.provider === 'openrouter') return 'openrouter';

  // Treat built-in and custom OpenAI-compatible providers as openai_compat
  if (OPENAI_COMPAT_PROVIDER_IDS.includes(model.provider)) return 'openai_compat';
  // For custom compat providers, provider is an arbitrary display name
  // If it's not one of the core providers, consider it compat
  if (!['openai', 'gemini', 'openrouter'].includes(model.provider)) {
    return 'openai_compat';
  }
  return null;
};

/**
 * Type guard to check if an object is a valid Model
 */
const isValidModel = (obj: unknown): obj is Model => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as Record<string, unknown>)['id'] === 'string' &&
    typeof (obj as Record<string, unknown>)['name'] === 'string' &&
    typeof (obj as Record<string, unknown>)['provider'] === 'string' &&
    typeof (obj as Record<string, unknown>)['available'] === 'boolean'
  );
};

/**
 * Validate model array structure
 */
const validateAvailableModels = (models: unknown): Model[] => {
  if (!Array.isArray(models)) {
    return [...DEFAULT_AVAILABLE_MODELS];
  }

  try {
    const validatedModels = models.filter(isValidModel);

    // If no valid models, return default
    return validatedModels.length > 0 ? validatedModels : [...DEFAULT_AVAILABLE_MODELS];
  } catch {
    return [...DEFAULT_AVAILABLE_MODELS];
  }
};

/**
 * Validate UI preferences
 */
const validateUIPreferences = (ui: unknown): UIPreferences => {
  const u = (ui && typeof ui === 'object' ? ui : {}) as Partial<UIPreferences>;

  // Validate screenshot hotkey
  let screenshotHotkey = DEFAULT_SETTINGS.ui.screenshotHotkey;
  if (u.screenshotHotkey && typeof u.screenshotHotkey === 'object') {
    const sh = u.screenshotHotkey as Record<string, unknown>;
    screenshotHotkey = {
      enabled:
        typeof sh['enabled'] === 'boolean'
          ? sh['enabled']
          : DEFAULT_SETTINGS.ui.screenshotHotkey.enabled,
      modifiers: Array.isArray(sh['modifiers'])
        ? (sh['modifiers'] as string[])
        : DEFAULT_SETTINGS.ui.screenshotHotkey.modifiers,
      key:
        typeof sh['key'] === 'string'
          ? (sh['key'] as string)
          : DEFAULT_SETTINGS.ui.screenshotHotkey.key,
    };
  }

  return {
    fontSize: isValidFontSize(u.fontSize) ? u.fontSize! : DEFAULT_SETTINGS.ui.fontSize,
    compactMode:
      typeof u.compactMode === 'boolean' ? u.compactMode : DEFAULT_SETTINGS.ui.compactMode,
    showTimestamps:
      typeof u.showTimestamps === 'boolean' ? u.showTimestamps : DEFAULT_SETTINGS.ui.showTimestamps,
    showAvatars:
      typeof u.showAvatars === 'boolean' ? u.showAvatars : DEFAULT_SETTINGS.ui.showAvatars,
    animationsEnabled:
      typeof u.animationsEnabled === 'boolean'
        ? u.animationsEnabled
        : DEFAULT_SETTINGS.ui.animationsEnabled,
    debugMode: typeof u.debugMode === 'boolean' ? u.debugMode : DEFAULT_SETTINGS.ui.debugMode,
    autoScrollEnabled:
      typeof u.autoScrollEnabled === 'boolean'
        ? u.autoScrollEnabled
        : DEFAULT_SETTINGS.ui.autoScrollEnabled,
    screenshotHotkey,
  };
};

/**
 * Validate AI settings
 */
const validateAISettings = (ai: unknown): AISettings => {
  const a = (ai && typeof ai === 'object' ? ai : {}) as Partial<
    AISettings & { temperature?: number; maxTokens?: number }
  >;

  return {
    defaultProvider: isValidProvider(a.defaultProvider)
      ? a.defaultProvider
      : DEFAULT_SETTINGS.ai.defaultProvider,
    streamResponse:
      typeof a.streamResponse === 'boolean' ? a.streamResponse : DEFAULT_SETTINGS.ai.streamResponse,
  };
};

/**
 * Validate privacy settings
 */
const validatePrivacySettings = (privacy: unknown): PrivacySettings => {
  const p = (privacy && typeof privacy === 'object' ? privacy : {}) as Partial<PrivacySettings>;
  return {
    saveConversations:
      typeof p.saveConversations === 'boolean'
        ? p.saveConversations
        : DEFAULT_SETTINGS.privacy.saveConversations,
    shareAnalytics:
      typeof p.shareAnalytics === 'boolean'
        ? p.shareAnalytics
        : DEFAULT_SETTINGS.privacy.shareAnalytics,
    clearOnClose:
      typeof p.clearOnClose === 'boolean' ? p.clearOnClose : DEFAULT_SETTINGS.privacy.clearOnClose,
  };
};

/**
 * Validate API key references
 */
const validateAPIKeyReferences = (apiKeys: unknown): APIKeyReferences => {
  const a = (apiKeys && typeof apiKeys === 'object' ? apiKeys : {}) as Partial<APIKeyReferences> &
    Record<string, unknown>;

  return {
    openai:
      typeof a.openai === 'string' || a.openai === null
        ? (a.openai as string | null)
        : DEFAULT_SETTINGS.apiKeys.openai,
    google:
      typeof a.google === 'string' || a.google === null
        ? (a.google as string | null)
        : DEFAULT_SETTINGS.apiKeys.google,
    openrouter:
      typeof a.openrouter === 'string' || a.openrouter === null
        ? (a.openrouter as string | null)
        : DEFAULT_SETTINGS.apiKeys.openrouter,
  };
};

/**
 * Migrate legacy settings to current format
 */
const migrateSettings = (rawSettings: unknown): Settings => {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  // If already current version, validate and return
  const rs = rawSettings as Partial<Settings> & Record<string, unknown>;
  if (rs.version === SETTINGS_VERSION) {
    // Keep selectedModel as-is; availableModels will be recomputed from keys
    // after load via refreshAvailableModelsWithCompat(). Validate structure only.
    return {
      version: SETTINGS_VERSION,
      ui: validateUIPreferences(rs.ui),
      ai: validateAISettings(rs.ai),
      privacy: validatePrivacySettings(rs.privacy),
      apiKeys: validateAPIKeyReferences(rs.apiKeys),
      extraction: validateExtractionPreferences(rs.extraction),
      selectedModel:
        typeof rs.selectedModel === 'string' && rs.selectedModel
          ? (rs.selectedModel as string)
          : DEFAULT_SETTINGS.selectedModel,
      availableModels: validateAvailableModels(rs.availableModels),
    };
  }

  // Fallback to defaults for unknown versions
  return { ...DEFAULT_SETTINGS };
};

/**
 * Validate extraction preferences (domain rules)
 */
const validateExtractionPreferences = (prefs: unknown): ExtractionPreferences => {
  const p = (prefs && typeof prefs === 'object' ? prefs : {}) as Partial<ExtractionPreferences> &
    Record<string, unknown>;

  const rawRules = Array.isArray(p.domainRules) ? p.domainRules : [];
  const validModes = new Set(['defuddle', 'readability', 'raw', 'selection']);

  const domainRules = rawRules
    .map(r => {
      const rr = r as unknown as Record<string, unknown>;
      const domain = typeof rr['domain'] === 'string' ? rr['domain'].trim().toLowerCase() : '';
      const mode = typeof rr['mode'] === 'string' ? (rr['mode'] as string) : '';
      if (!domain || !validModes.has(mode)) return null;
      return { domain, mode: mode as ExtractionPreferences['domainRules'][number]['mode'] };
    })
    .filter(Boolean) as ExtractionPreferences['domainRules'];

  return {
    domainRules:
      domainRules.length > 0 ? domainRules : [...DEFAULT_SETTINGS.extraction.domainRules],
  };
};

/**
 * Save settings to Chrome storage with fallback
 */
const saveToStorage = async (settings: Settings): Promise<void> => {
  const data = { [STORAGE_KEY]: settings };

  try {
    // Try chrome.storage.sync first for cross-device sync
    await setMultiple(data, 'sync');
  } catch (error) {
    // Check if it's a quota error
    if (error instanceof Error && error.message.includes('QUOTA_BYTES_PER_ITEM')) {
      throw new Error('Storage quota exceeded. Please reduce the amount of stored data.');
    }

    // Fallback to local storage if sync is unavailable
    try {
      await setMultiple(data, 'local');
    } catch (localError) {
      throw new Error('Failed to save settings: Storage unavailable');
    }
  }
};

/**
 * Load settings from Chrome storage
 */
const loadFromStorage = async (): Promise<{ settings: Settings; migrated: boolean }> => {
  // Check if chrome.storage is available
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return { settings: { ...DEFAULT_SETTINGS }, migrated: false };
  }

  try {
    // Try sync storage first with a timeout
    const result = (await Promise.race([
      getMultiple([STORAGE_KEY], 'sync'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 2000)),
    ])) as { [key: string]: unknown };

    const rawSettings = result[STORAGE_KEY];
    if (rawSettings !== undefined && (typeof rawSettings !== 'object' || rawSettings === null)) {
      throw new Error('Invalid settings format');
    }
    const migrated =
      !rawSettings || (rawSettings as Partial<Settings> | undefined)?.version !== SETTINGS_VERSION;
    return { settings: migrateSettings(rawSettings), migrated };
  } catch (error) {
    // Fallback to local storage
    try {
      const result = await getMultiple([STORAGE_KEY], 'local');
      const rawSettings = result[STORAGE_KEY];
      const migrated =
        !rawSettings ||
        (rawSettings as Partial<Settings> | undefined)?.version !== SETTINGS_VERSION;
      return { settings: migrateSettings(rawSettings), migrated };
    } catch (localError) {
      // Return defaults if all storage options fail
      return { settings: { ...DEFAULT_SETTINGS }, migrated: false };
    }
  }
};

/**
 * Create the settings store
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { settings, migrated } = await loadFromStorage();
      const currentSettings = get().settings;
      // Mutate in place so existing references observe updated values
      currentSettings.ui = settings.ui;
      currentSettings.ai = settings.ai;
      currentSettings.privacy = settings.privacy;
      currentSettings.apiKeys = settings.apiKeys;

      // Initially empty; will be computed from keys+compat below
      currentSettings.availableModels = [];
      currentSettings.selectedModel = settings.selectedModel;
      currentSettings.extraction = validateExtractionPreferences(settings.extraction);

      const needsMigration = migrated;

      // Compute available models from saved keys and compat providers
      await get().refreshAvailableModelsWithCompat();

      // Ensure selectedModel is part of availableModels if any are present
      const updated = get().settings;
      const selectedModelObj = updated.availableModels.find(m => m.id === updated.selectedModel);
      const isSelectedAvailable = !!selectedModelObj;

      let needsSave = false;

      if (!isSelectedAvailable) {
        if (updated.availableModels.length > 0) {
          // Pick the first available model to keep app usable
          const firstModel = updated.availableModels[0]!;
          updated.selectedModel = firstModel.id;
          // Update defaultProvider to match the new model
          updated.ai.defaultProvider = getProviderTypeFromModel(firstModel);
          needsSave = true;
        } else {
          // No available models; keep default selection (may not be usable until a key is added)
          updated.selectedModel = DEFAULT_MODEL_ID;
          updated.ai.defaultProvider = null;
          needsSave = true;
        }
      } else {
        // Model is available, but validate that defaultProvider matches the model
        const correctProvider = getProviderTypeFromModel(selectedModelObj);
        if (updated.ai.defaultProvider !== correctProvider) {
          updated.ai.defaultProvider = correctProvider;
          needsSave = true;
        }
      }

      if (needsSave) {
        await saveToStorage(updated);
      }

      set({ isLoading: false });

      if (needsMigration) {
        await saveToStorage(get().settings);
      }
    } catch (_error) {
      const errorMessage = 'Failed to load settings';
      set({ isLoading: false, error: errorMessage, settings: { ...DEFAULT_SETTINGS } });
    }
  },

  updateUIPreferences: async (ui: UIPreferences) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const validatedUI = validateUIPreferences(ui);
      currentSettings.ui = validatedUI;
      await saveToStorage(currentSettings);
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  updateAISettings: async (ai: AISettings) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const validatedAI = validateAISettings(ai);

      // Normalize provider to match currently selected model when we can infer it
      const selectedModel = currentSettings.availableModels.find(
        model => model.id === currentSettings.selectedModel
      );
      const inferredProvider = selectedModel ? getProviderTypeFromModel(selectedModel) : null;
      const normalizedAI =
        inferredProvider && validatedAI.defaultProvider !== inferredProvider
          ? { ...validatedAI, defaultProvider: inferredProvider }
          : validatedAI;

      const aiChanged =
        normalizedAI.defaultProvider !== currentSettings.ai.defaultProvider ||
        normalizedAI.streamResponse !== currentSettings.ai.streamResponse;

      if (!aiChanged) {
        set({ isLoading: false });
        return;
      }

      const updatedSettings = { ...currentSettings, ai: normalizedAI };
      set({ settings: updatedSettings });
      await saveToStorage(updatedSettings);
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  updatePrivacySettings: async (privacy: PrivacySettings) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const validatedPrivacy = validatePrivacySettings(privacy);
      currentSettings.privacy = validatedPrivacy;
      await saveToStorage(currentSettings);
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  updateAPIKeyReferences: async (apiKeys: APIKeyReferences) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const validatedAPIKeys = validateAPIKeyReferences(apiKeys);
      currentSettings.apiKeys = validatedAPIKeys;
      await saveToStorage(currentSettings);
      // Recompute available models after key changes
      await get().refreshAvailableModelsWithCompat();
      set({ settings: get().settings, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  resetToDefaults: async () => {
    set({ isLoading: true, error: null });

    try {
      const defaultSettings = { ...DEFAULT_SETTINGS };
      const currentSettings = get().settings;
      currentSettings.ui = defaultSettings.ui;
      currentSettings.ai = defaultSettings.ai;
      currentSettings.privacy = defaultSettings.privacy;
      currentSettings.apiKeys = defaultSettings.apiKeys;
      currentSettings.selectedModel = defaultSettings.selectedModel;
      currentSettings.availableModels = [...defaultSettings.availableModels];
      await saveToStorage(currentSettings);
      set({ isLoading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  updateExtractionPreferences: async (prefs: ExtractionPreferences) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      const validated = validateExtractionPreferences(prefs);
      const updated = { ...currentSettings, extraction: validated };
      set({ settings: updated });
      await saveToStorage(updated);
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
    }
  },

  updateSelectedModel: async (modelId: string) => {
    set({ isLoading: true, error: null });
    const currentSettings = get().settings;

    // Validate against currently available models (gated by keys)
    const availableModelsNow = currentSettings.availableModels;
    if (!isValidSelectedModel(modelId, availableModelsNow)) {
      const error = new Error(`Invalid model: ${modelId}. Model not found in available models.`);
      set({ isLoading: false, error: error.message });
      return Promise.reject(error);
    }

    try {
      // Find the provider for this model
      const selectedModel = currentSettings.availableModels.find(m => m.id === modelId);
      const newProvider = selectedModel ? getProviderTypeFromModel(selectedModel) : null;

      // Update settings with new model and provider
      const updatedSettings = {
        ...currentSettings,
        selectedModel: modelId,
        ai: {
          ...currentSettings.ai,
          defaultProvider: newProvider,
        },
      };

      set({ settings: updatedSettings });

      // Save to storage
      await saveToStorage(updatedSettings);

      // Clear loading state after successful save
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
      // Do not rethrow on persistence errors
    }
  },

  getAvailableModels: (availableOnly = true) => {
    const { availableModels } = get().settings;

    if (availableOnly) {
      return availableModels.filter(model => model.available);
    }

    return [...availableModels];
  },

  /**
   * Get provider type for a given model
   */
  getProviderTypeForModel: (modelId: string) => {
    const { availableModels } = get().settings;
    const model = availableModels.find(m => m.id === modelId);
    return model ? getProviderTypeFromModel(model) : null;
  },

  /**
   * Refresh available models based on stored API keys and OpenAI‑compatible providers.
   */
  refreshAvailableModelsWithCompat: async () => {
    try {
      const currentSettings = get().settings;
      const next: Model[] = [];

      // Gate core providers by stored keys
      if (currentSettings.apiKeys.openai) {
        for (const m of getModelsByProviderId('openai')) {
          next.push({ id: m.id, name: m.name, provider: m.provider, available: true });
        }
      }
      if (currentSettings.apiKeys.google) {
        for (const m of getModelsByProviderId('gemini')) {
          next.push({ id: m.id, name: m.name, provider: m.provider, available: true });
        }
      }
      if (currentSettings.apiKeys.openrouter) {
        for (const m of getModelsByProviderId('openrouter')) {
          next.push({ id: m.id, name: m.name, provider: m.provider, available: true });
        }
      }

      // Include OpenAI‑compatible providers saved in storage
      const compatProviders = await listOpenAICompatProviders();
      for (const provider of compatProviders) {
        const builtIn = getModelsByProviderId(provider.id);
        if (builtIn.length > 0) {
          for (const m of builtIn) {
            if (!next.some(x => x.id === m.id)) {
              next.push({ id: m.id, name: m.name, provider: m.provider, available: true });
            }
          }
        } else if (provider.model) {
          // Custom provider with a single stored model
          if (!next.some(x => x.id === provider.model!.id)) {
            next.push({
              id: provider.model.id,
              name: provider.model.name,
              provider: provider.name,
              available: true,
            });
          }
        }
      }

      // Write new list
      const previous = currentSettings.availableModels;
      const listsMatch =
        previous.length === next.length &&
        previous.every((model, index) => {
          const candidate = next[index];
          return (
            !!candidate &&
            candidate.id === model.id &&
            candidate.name === model.name &&
            candidate.provider === model.provider &&
            candidate.available === model.available
          );
        });

      if (listsMatch) {
        return;
      }

      const updatedSettings = { ...currentSettings, availableModels: next };
      set({ settings: updatedSettings });
      await saveToStorage(updatedSettings);
    } catch {
      // Failed to refresh models - continue with existing list
    }
  },
}));
