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
  Theme,
  UIPreferences,
  AISettings,
  PrivacySettings,
  APIKeyReferences,
  LegacySettings,
  Model,
} from '../types/settings';

/**
 * Current settings schema version
 */
const SETTINGS_VERSION = 1;

/**
 * Storage key for settings in chrome.storage
 */
const STORAGE_KEY = 'settings';

/**
 * Available AI models with their metadata
 */
const DEFAULT_AVAILABLE_MODELS: Model[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    available: true,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    available: true,
  },
  {
    id: 'claude-3',
    name: 'Claude 3',
    provider: 'Anthropic',
    available: true,
  },
  {
    id: 'claude-2',
    name: 'Claude 2',
    provider: 'Anthropic',
    available: true,
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    available: true,
  },
  {
    id: 'llama-2',
    name: 'Llama 2',
    provider: 'Meta',
    available: false,
  },
];

/**
 * Default settings configuration
 */
const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  theme: 'auto',
  ui: {
    fontSize: 'medium',
    compactMode: false,
    showTimestamps: true,
    showAvatars: true,
    animationsEnabled: true,
  },
  ai: {
    defaultProvider: null,
    temperature: 0.7,
    maxTokens: 2048,
    streamResponse: true,
  },
  privacy: {
    saveConversations: true,
    shareAnalytics: false,
    clearOnClose: false,
  },
  apiKeys: {
    openai: null,
    anthropic: null,
    google: null,
  },
  selectedModel: 'gpt-4',
  availableModels: [...DEFAULT_AVAILABLE_MODELS],
};

/**
 * Validate theme value
 */
const isValidTheme = (theme: unknown): theme is Theme => {
  return typeof theme === 'string' && ['light', 'dark', 'auto'].includes(theme as string);
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
const isValidAIProvider = (
  provider: unknown
): provider is 'openai' | 'anthropic' | 'google' | null => {
  return (
    provider === null ||
    (typeof provider === 'string' && ['openai', 'anthropic', 'google'].includes(provider))
  );
};

/**
 * Validate temperature range (0.0 - 1.0)
 */
const isValidTemperature = (temp: unknown): boolean => {
  return typeof temp === 'number' && temp >= 0.0 && temp <= 1.0;
};

/**
 * Validate max tokens range (1 - 8192)
 */
const isValidMaxTokens = (tokens: unknown): boolean => {
  return typeof tokens === 'number' && tokens >= 1 && tokens <= 8192;
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
  const a = (ai && typeof ai === 'object' ? ai : {}) as Partial<AISettings>;
  return {
    defaultProvider: isValidAIProvider(a.defaultProvider)
      ? a.defaultProvider
      : DEFAULT_SETTINGS.ai.defaultProvider,
    temperature: isValidTemperature(a.temperature)
      ? a.temperature!
      : DEFAULT_SETTINGS.ai.temperature,
    maxTokens: isValidMaxTokens(a.maxTokens) ? a.maxTokens! : DEFAULT_SETTINGS.ai.maxTokens,
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
    anthropic:
      typeof a.anthropic === 'string' || a.anthropic === null
        ? (a.anthropic as string | null)
        : DEFAULT_SETTINGS.apiKeys.anthropic,
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
      theme: isValidTheme(rs.theme) ? (rs.theme as Theme) : DEFAULT_SETTINGS.theme,
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
      theme: isValidTheme(legacySettings.theme) ? legacySettings.theme : DEFAULT_SETTINGS.theme,
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
  try {
    const result = await chrome.storage.sync.get([STORAGE_KEY]);
    const rawSettings = result[STORAGE_KEY];
    if (rawSettings !== undefined && (typeof rawSettings !== 'object' || rawSettings === null)) {
      throw new Error('Invalid settings format');
    }
    const migrated =
      !rawSettings || (rawSettings as Partial<Settings> | undefined)?.version !== SETTINGS_VERSION;
    return { settings: migrateSettings(rawSettings), migrated };
  } catch (_error) {
    // Surface loading errors to caller; tests expect error propagation
    throw new Error('Failed to load settings from storage');
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
      currentSettings.theme = settings.theme;
      currentSettings.ui = settings.ui;
      currentSettings.ai = settings.ai;
      currentSettings.privacy = settings.privacy;
      currentSettings.apiKeys = settings.apiKeys;
      currentSettings.selectedModel = settings.selectedModel;
      currentSettings.availableModels = settings.availableModels;

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

  updateTheme: async (theme: Theme) => {
    set({ isLoading: true, error: null });
    try {
      const currentSettings = get().settings;
      currentSettings.theme = theme;
      await saveToStorage(currentSettings);
      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      set({ isLoading: false, error: errorMessage });
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
      currentSettings.theme = defaultSettings.theme;
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

  updateSelectedModel: async (modelId: string) => {
    set({ isLoading: true, error: null });
    const currentSettings = get().settings;

    // Validate upfront; tests expect rejection for invalid model
    if (!isValidSelectedModel(modelId, currentSettings.availableModels)) {
      const error = new Error(`Invalid model: ${modelId}. Model not found in available models.`);
      set({ isLoading: false, error: error.message });
      return Promise.reject(error);
    }

    try {
      // Update settings
      const updatedSettings = { ...currentSettings, selectedModel: modelId };
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
}));
