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
  LegacySettings,
  Model,
} from '@/types/settings';
import { SUPPORTED_MODELS, DEFAULT_MODEL_ID, getProviderTypeForModelId } from '@/config/models';

/**
 * Current settings schema version
 */
const SETTINGS_VERSION = 1;

/**
 * Storage key for settings in chrome.storage
 */
const STORAGE_KEY = 'settings';

/**
 * Available AI models with their metadata - from centralized config
 */
const DEFAULT_AVAILABLE_MODELS: Model[] = SUPPORTED_MODELS.map(model => ({
  id: model.id,
  name: model.name,
  provider: model.provider,
  available: true, // All models are available by default
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
  },
  selectedModel: DEFAULT_MODEL_ID,
  availableModels: [...DEFAULT_AVAILABLE_MODELS],
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
const isValidProvider = (provider: unknown): provider is 'openai' | 'gemini' | null => {
  return (
    provider === null || (typeof provider === 'string' && ['openai', 'gemini'].includes(provider))
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
const getProviderTypeFromModel = (model: Model): 'openai' | 'gemini' | null => {
  // Try centralized config first
  const providerType = getProviderTypeForModelId(model.id);
  if (providerType) return providerType;

  // Fallback for any models not in centralized config
  const providerMapping: Record<string, 'openai' | 'gemini' | null> = {
    OpenAI: 'openai',
    Google: 'gemini',
  };

  return providerMapping[model.provider] || null;
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
  };
};

/**
 * Validate AI settings
 */
const validateAISettings = (ai: unknown): AISettings => {
  const a = (ai && typeof ai === 'object' ? ai : {}) as Partial<
    AISettings & { temperature?: number; maxTokens?: number }
  >;

  // Log if legacy parameters are being migrated
  if ('temperature' in a || 'maxTokens' in a) {
    console.debug('Migrating legacy AI settings, removing:', {
      temperature: a.temperature,
      maxTokens: a.maxTokens,
    });
  }

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
  const a = (apiKeys && typeof apiKeys === 'object' ? apiKeys : {}) as Partial<
    APIKeyReferences & { openrouter?: string }
  > &
    Record<string, unknown>;

  // Log if legacy openrouter key is being removed
  if ('openrouter' in a) {
    console.debug('Migrating API keys, removing openrouter');
  }

  return {
    openai:
      typeof a.openai === 'string' || a.openai === null
        ? (a.openai as string | null)
        : DEFAULT_SETTINGS.apiKeys.openai,
    google:
      typeof a.google === 'string' || a.google === null
        ? (a.google as string | null)
        : DEFAULT_SETTINGS.apiKeys.google,
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
    const availableModels = validateAvailableModels(rs.availableModels);
    const selectedModel = isValidSelectedModel(rs.selectedModel, availableModels)
      ? (rs.selectedModel as string)
      : DEFAULT_SETTINGS.selectedModel;

    return {
      version: SETTINGS_VERSION,
      ui: validateUIPreferences(rs.ui),
      ai: validateAISettings(rs.ai),
      privacy: validatePrivacySettings(rs.privacy),
      apiKeys: validateAPIKeyReferences(rs.apiKeys),
      selectedModel,
      availableModels,
    };
  }

  // Migration from v0 (no version field)
  if (!rs.version) {
    const legacySettings = rawSettings as LegacySettings;
    return {
      version: SETTINGS_VERSION,
      ui: {
        fontSize: isValidFontSize(legacySettings.fontSize)
          ? legacySettings.fontSize
          : DEFAULT_SETTINGS.ui.fontSize,
        compactMode:
          typeof legacySettings.compactMode === 'boolean'
            ? legacySettings.compactMode
            : DEFAULT_SETTINGS.ui.compactMode,
        showTimestamps: DEFAULT_SETTINGS.ui.showTimestamps,
        showAvatars: DEFAULT_SETTINGS.ui.showAvatars,
        animationsEnabled: DEFAULT_SETTINGS.ui.animationsEnabled,
      },
      ai: { ...DEFAULT_SETTINGS.ai },
      privacy: { ...DEFAULT_SETTINGS.privacy },
      apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
      selectedModel: DEFAULT_SETTINGS.selectedModel,
      availableModels: [...DEFAULT_SETTINGS.availableModels],
    };
  }

  // Fallback to defaults for unknown versions
  return { ...DEFAULT_SETTINGS };
};

/**
 * Save settings to Chrome storage with fallback
 */
const saveToStorage = async (settings: Settings): Promise<void> => {
  const data = { [STORAGE_KEY]: settings };

  try {
    // Try chrome.storage.sync first for cross-device sync
    await chrome.storage.sync.set(data);
  } catch (error) {
    // Check if it's a quota error
    if (error instanceof Error && error.message.includes('QUOTA_BYTES_PER_ITEM')) {
      throw new Error('Storage quota exceeded. Please reduce the amount of stored data.');
    }

    // Fallback to local storage if sync is unavailable
    try {
      await chrome.storage.local.set(data);
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
    console.warn('Chrome storage API not available, using defaults');
    return { settings: { ...DEFAULT_SETTINGS }, migrated: false };
  }

  try {
    // Try sync storage first with a timeout
    const result = (await Promise.race([
      chrome.storage.sync.get([STORAGE_KEY]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 2000)),
    ])) as { [key: string]: any };

    const rawSettings = result[STORAGE_KEY];
    if (rawSettings !== undefined && (typeof rawSettings !== 'object' || rawSettings === null)) {
      throw new Error('Invalid settings format');
    }
    const migrated =
      !rawSettings || (rawSettings as Partial<Settings> | undefined)?.version !== SETTINGS_VERSION;
    return { settings: migrateSettings(rawSettings), migrated };
  } catch (error) {
    console.warn('Failed to load from sync storage, trying local storage:', error);

    // Fallback to local storage
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const rawSettings = result[STORAGE_KEY];
      const migrated =
        !rawSettings ||
        (rawSettings as Partial<Settings> | undefined)?.version !== SETTINGS_VERSION;
      return { settings: migrateSettings(rawSettings), migrated };
    } catch (localError) {
      console.warn('Failed to load from local storage, using defaults:', localError);
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
      // Mutate in place so existing references (in tests) observe updated values
      currentSettings.ui = settings.ui;
      currentSettings.ai = settings.ai;
      currentSettings.privacy = settings.privacy;
      currentSettings.apiKeys = settings.apiKeys;

      // Always use the current supported models from config as source of truth
      currentSettings.availableModels = [...DEFAULT_AVAILABLE_MODELS];

      // Validate and fix selected model
      if (DEFAULT_AVAILABLE_MODELS.some(m => m.id === settings.selectedModel)) {
        currentSettings.selectedModel = settings.selectedModel;
      } else {
        currentSettings.selectedModel = DEFAULT_MODEL_ID;
      }

      // Check if migration occurred (different from defaults)
      const needsMigration = migrated;

      set({ isLoading: false });

      // Save migrated settings back to storage if they were migrated
      if (needsMigration) {
        await saveToStorage(settings);
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
      currentSettings.ai = validatedAI;
      await saveToStorage(currentSettings);
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
      set({ settings: currentSettings, isLoading: false });
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

  updateSelectedModel: async (modelId: string) => {
    set({ isLoading: true, error: null });
    const currentSettings = get().settings;

    // Always use the current supported models from config as source of truth
    const availableModels = [...DEFAULT_AVAILABLE_MODELS];

    // Update the settings with the correct available models
    currentSettings.availableModels = availableModels;

    // Validate upfront; tests expect rejection for invalid model
    if (!isValidSelectedModel(modelId, availableModels)) {
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
}));
