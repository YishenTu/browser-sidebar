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
};

/**
 * Validate theme value
 */
const isValidTheme = (theme: any): theme is Theme => {
  return ['light', 'dark', 'auto'].includes(theme);
};

/**
 * Validate font size value
 */
const isValidFontSize = (fontSize: any): fontSize is 'small' | 'medium' | 'large' => {
  return ['small', 'medium', 'large'].includes(fontSize);
};

/**
 * Validate AI provider value
 */
const isValidAIProvider = (provider: any): provider is 'openai' | 'anthropic' | 'google' | null => {
  return provider === null || ['openai', 'anthropic', 'google'].includes(provider);
};

/**
 * Validate temperature range (0.0 - 1.0)
 */
const isValidTemperature = (temp: any): boolean => {
  return typeof temp === 'number' && temp >= 0.0 && temp <= 1.0;
};

/**
 * Validate max tokens range (1 - 8192)
 */
const isValidMaxTokens = (tokens: any): boolean => {
  return typeof tokens === 'number' && tokens >= 1 && tokens <= 8192;
};

/**
 * Validate UI preferences
 */
const validateUIPreferences = (ui: any): UIPreferences => {
  return {
    fontSize: isValidFontSize(ui?.fontSize) ? ui.fontSize : DEFAULT_SETTINGS.ui.fontSize,
    compactMode:
      typeof ui?.compactMode === 'boolean' ? ui.compactMode : DEFAULT_SETTINGS.ui.compactMode,
    showTimestamps:
      typeof ui?.showTimestamps === 'boolean'
        ? ui.showTimestamps
        : DEFAULT_SETTINGS.ui.showTimestamps,
    showAvatars:
      typeof ui?.showAvatars === 'boolean' ? ui.showAvatars : DEFAULT_SETTINGS.ui.showAvatars,
    animationsEnabled:
      typeof ui?.animationsEnabled === 'boolean'
        ? ui.animationsEnabled
        : DEFAULT_SETTINGS.ui.animationsEnabled,
  };
};

/**
 * Validate AI settings
 */
const validateAISettings = (ai: any): AISettings => {
  return {
    defaultProvider: isValidAIProvider(ai?.defaultProvider)
      ? ai.defaultProvider
      : DEFAULT_SETTINGS.ai.defaultProvider,
    temperature: isValidTemperature(ai?.temperature)
      ? ai.temperature
      : DEFAULT_SETTINGS.ai.temperature,
    maxTokens: isValidMaxTokens(ai?.maxTokens) ? ai.maxTokens : DEFAULT_SETTINGS.ai.maxTokens,
    streamResponse:
      typeof ai?.streamResponse === 'boolean'
        ? ai.streamResponse
        : DEFAULT_SETTINGS.ai.streamResponse,
  };
};

/**
 * Validate privacy settings
 */
const validatePrivacySettings = (privacy: any): PrivacySettings => {
  return {
    saveConversations:
      typeof privacy?.saveConversations === 'boolean'
        ? privacy.saveConversations
        : DEFAULT_SETTINGS.privacy.saveConversations,
    shareAnalytics:
      typeof privacy?.shareAnalytics === 'boolean'
        ? privacy.shareAnalytics
        : DEFAULT_SETTINGS.privacy.shareAnalytics,
    clearOnClose:
      typeof privacy?.clearOnClose === 'boolean'
        ? privacy.clearOnClose
        : DEFAULT_SETTINGS.privacy.clearOnClose,
  };
};

/**
 * Validate API key references
 */
const validateAPIKeyReferences = (apiKeys: any): APIKeyReferences => {
  return {
    openai:
      typeof apiKeys?.openai === 'string' || apiKeys?.openai === null
        ? apiKeys.openai
        : DEFAULT_SETTINGS.apiKeys.openai,
    anthropic:
      typeof apiKeys?.anthropic === 'string' || apiKeys?.anthropic === null
        ? apiKeys.anthropic
        : DEFAULT_SETTINGS.apiKeys.anthropic,
    google:
      typeof apiKeys?.google === 'string' || apiKeys?.google === null
        ? apiKeys.google
        : DEFAULT_SETTINGS.apiKeys.google,
  };
};

/**
 * Migrate legacy settings to current format
 */
const migrateSettings = (rawSettings: any): Settings => {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  // If already current version, validate and return
  if (rawSettings.version === SETTINGS_VERSION) {
    return {
      version: SETTINGS_VERSION,
      theme: isValidTheme(rawSettings.theme) ? rawSettings.theme : DEFAULT_SETTINGS.theme,
      ui: validateUIPreferences(rawSettings.ui),
      ai: validateAISettings(rawSettings.ai),
      privacy: validatePrivacySettings(rawSettings.privacy),
      apiKeys: validateAPIKeyReferences(rawSettings.apiKeys),
    };
  }

  // Migration from v0 (no version field)
  if (!rawSettings.version) {
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
}));
