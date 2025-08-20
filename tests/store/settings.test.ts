/**
 * @file Settings Store Tests
 *
 * Comprehensive test suite for the settings store using TDD methodology.
 * Tests persistence, migrations, validation, and all store actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chromeMockUtils } from '../setup/chrome-mock';

// Import the settings store (chrome mocks are set up in setup.ts)
import { useSettingsStore } from '../../src/store/settings';

// Capture initial defaults once to reset between tests
const INITIAL_DEFAULTS = structuredClone(useSettingsStore.getState().settings);

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset chrome mocks to clean state
    chromeMockUtils.resetMocks();
    // Reset settings store state to defaults between tests to avoid leakage
    useSettingsStore.setState({
      settings: structuredClone(INITIAL_DEFAULTS),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Default Settings Initialization', () => {
    it('should initialize with correct default settings', () => {
      const state = useSettingsStore.getState();

      expect(state.settings).toEqual({
        version: 1,
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
      });
    });

    it('should have loading state as false initially', () => {
      const state = useSettingsStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useSettingsStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('Settings Persistence to Chrome Storage', () => {
    it('should save settings to global.chrome.storage.sync when updateSettings is called', async () => {
      const store = useSettingsStore.getState();
      const newTheme = 'dark';

      await store.updateTheme(newTheme);

      expect(global.global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          theme: newTheme,
        }),
      });
    });

    it('should load settings from global.chrome.storage.sync on initialization', async () => {
      const mockStoredSettings = {
        version: 1,
        theme: 'light',
        ui: {
          fontSize: 'large',
          compactMode: true,
          showTimestamps: false,
          showAvatars: false,
          animationsEnabled: false,
        },
        ai: {
          defaultProvider: 'openai',
          temperature: 0.5,
          maxTokens: 1024,
          streamResponse: false,
        },
        privacy: {
          saveConversations: false,
          shareAnalytics: true,
          clearOnClose: true,
        },
        apiKeys: {
          openai: 'encrypted-key-reference-1',
          anthropic: null,
          google: null,
        },
      };

      chromeMockUtils.setStorageData('sync', {
        settings: mockStoredSettings,
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(store.settings).toEqual(mockStoredSettings);
    });

    it('should handle global.chrome.storage.sync quota exceeded error', async () => {
      const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      global.chrome.storage.sync.set.mockRejectedValueOnce(quotaError);

      const store = useSettingsStore.getState();
      await store.updateTheme('dark');

      expect(store.error).toBeTruthy();
      expect(store.error).toContain('Storage quota exceeded');
    });

    it('should fallback to global.chrome.storage.local when sync is unavailable', async () => {
      const syncError = new Error('Sync is disabled');
      global.chrome.storage.sync.set.mockRejectedValueOnce(syncError);
      global.chrome.storage.local.set.mockResolvedValueOnce(undefined);

      const store = useSettingsStore.getState();
      await store.updateTheme('dark');

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          theme: 'dark',
        }),
      });
    });
  });

  describe('Settings Retrieval from Storage', () => {
    it('should retrieve settings from global.chrome.storage.sync', async () => {
      const mockSettings = {
        version: 1,
        theme: 'dark',
        ui: {
          fontSize: 'small',
          compactMode: true,
          showTimestamps: true,
          showAvatars: true,
          animationsEnabled: true,
        },
        ai: {
          defaultProvider: 'anthropic',
          temperature: 0.8,
          maxTokens: 4096,
          streamResponse: true,
        },
        privacy: {
          saveConversations: true,
          shareAnalytics: false,
          clearOnClose: false,
        },
        apiKeys: {
          openai: null,
          anthropic: 'encrypted-key-reference-2',
          google: null,
        },
      };

      global.chrome.storage.sync.get.mockResolvedValueOnce({
        settings: mockSettings,
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(global.chrome.storage.sync.get).toHaveBeenCalledWith(['settings']);
      expect(store.settings).toEqual(mockSettings);
      expect(store.isLoading).toBe(false);
    });

    it('should handle missing settings in storage gracefully', async () => {
      global.chrome.storage.sync.get.mockResolvedValueOnce({});

      const store = useSettingsStore.getState();
      const defaultSettings = { ...store.settings };

      await store.loadSettings();

      expect(store.settings).toEqual(defaultSettings);
    });

    it('should handle corrupted settings in storage', async () => {
      global.chrome.storage.sync.get.mockResolvedValueOnce({
        settings: 'invalid-json-data',
      });

      const store = useSettingsStore.getState();
      const defaultSettings = { ...store.settings };

      await store.loadSettings();

      expect(store.settings).toEqual(defaultSettings);
      expect(store.error).toBeTruthy();
      expect(store.error).toContain('Failed to load settings');
    });
  });

  describe('Settings Migration from Older Versions', () => {
    it('should migrate settings from version 0 to version 1', async () => {
      const v0Settings = {
        // Old version without version field
        theme: 'dark',
        fontSize: 'large',
        compactMode: true,
      };

      global.chrome.storage.sync.get.mockResolvedValueOnce({
        settings: v0Settings,
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(store.settings.version).toBe(1);
      expect(store.settings.theme).toBe('dark');
      expect(store.settings.ui.fontSize).toBe('large');
      expect(store.settings.ui.compactMode).toBe(true);

      // Should save migrated settings
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          version: 1,
        }),
      });
    });

    it('should handle migration errors gracefully', async () => {
      const corruptedSettings = {
        version: 'invalid',
        theme: null,
      };

      global.chrome.storage.sync.get.mockResolvedValueOnce({
        settings: corruptedSettings,
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      // Should fallback to defaults
      expect(store.settings.version).toBe(1);
      expect(store.settings.theme).toBe('auto');
    });

    it('should not migrate if already at current version', async () => {
      const currentSettings = {
        version: 1,
        theme: 'light',
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

      global.chrome.storage.sync.get.mockResolvedValueOnce({
        settings: currentSettings,
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(store.settings).toEqual(currentSettings);
      // Should not save if no migration occurred
      expect(global.chrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });

  describe('Individual Setting Updates', () => {
    it('should update theme setting', async () => {
      const store = useSettingsStore.getState();
      await store.updateTheme('dark');

      expect(store.settings.theme).toBe('dark');
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          theme: 'dark',
        }),
      });
    });

    it('should update UI preferences', async () => {
      const store = useSettingsStore.getState();
      const newUIPrefs = {
        fontSize: 'large' as const,
        compactMode: true,
        showTimestamps: false,
        showAvatars: false,
        animationsEnabled: false,
      };

      await store.updateUIPreferences(newUIPrefs);

      expect(store.settings.ui).toEqual(newUIPrefs);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          ui: newUIPrefs,
        }),
      });
    });

    it('should update AI model settings', async () => {
      const store = useSettingsStore.getState();
      const newAISettings = {
        defaultProvider: 'openai' as const,
        temperature: 0.9,
        maxTokens: 4096,
        streamResponse: false,
      };

      await store.updateAISettings(newAISettings);

      expect(store.settings.ai).toEqual(newAISettings);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          ai: newAISettings,
        }),
      });
    });

    it('should update privacy settings', async () => {
      const store = useSettingsStore.getState();
      const newPrivacySettings = {
        saveConversations: false,
        shareAnalytics: true,
        clearOnClose: true,
      };

      await store.updatePrivacySettings(newPrivacySettings);

      expect(store.settings.privacy).toEqual(newPrivacySettings);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          privacy: newPrivacySettings,
        }),
      });
    });

    it('should update API key references', async () => {
      const store = useSettingsStore.getState();
      const newAPIKeys = {
        openai: 'encrypted-key-ref-1',
        anthropic: 'encrypted-key-ref-2',
        google: null,
      };

      await store.updateAPIKeyReferences(newAPIKeys);

      expect(store.settings.apiKeys).toEqual(newAPIKeys);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          apiKeys: newAPIKeys,
        }),
      });
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset all settings to default values', async () => {
      const store = useSettingsStore.getState();

      // First modify some settings
      await store.updateTheme('dark');
      await store.updateUIPreferences({
        fontSize: 'large',
        compactMode: true,
        showTimestamps: false,
        showAvatars: false,
        animationsEnabled: false,
      });

      // Then reset
      await store.resetToDefaults();

      expect(store.settings.theme).toBe('auto');
      expect(store.settings.ui.fontSize).toBe('medium');
      expect(store.settings.ui.compactMode).toBe(false);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          theme: 'auto',
          ui: expect.objectContaining({
            fontSize: 'medium',
            compactMode: false,
          }),
        }),
      });
    });

    it('should clear error state when resetting', async () => {
      const store = useSettingsStore.getState();

      // Force an error
      store.setError('Test error');
      expect(store.error).toBe('Test error');

      await store.resetToDefaults();

      expect(store.error).toBeNull();
    });
  });

  describe('Settings Validation', () => {
    it('should validate theme values', async () => {
      const store = useSettingsStore.getState();

      // Valid themes should work
      await store.updateTheme('light');
      expect(store.settings.theme).toBe('light');

      await store.updateTheme('dark');
      expect(store.settings.theme).toBe('dark');

      await store.updateTheme('auto');
      expect(store.settings.theme).toBe('auto');
    });

    it('should validate UI preference values', async () => {
      const store = useSettingsStore.getState();

      // Valid font sizes
      await store.updateUIPreferences({
        fontSize: 'small',
        compactMode: true,
        showTimestamps: true,
        showAvatars: true,
        animationsEnabled: true,
      });
      expect(store.settings.ui.fontSize).toBe('small');

      await store.updateUIPreferences({
        fontSize: 'medium',
        compactMode: false,
        showTimestamps: false,
        showAvatars: false,
        animationsEnabled: false,
      });
      expect(store.settings.ui.fontSize).toBe('medium');

      await store.updateUIPreferences({
        fontSize: 'large',
        compactMode: true,
        showTimestamps: true,
        showAvatars: true,
        animationsEnabled: true,
      });
      expect(store.settings.ui.fontSize).toBe('large');
    });

    it('should validate AI settings ranges', async () => {
      const store = useSettingsStore.getState();

      // Valid temperature range (0-1)
      await store.updateAISettings({
        defaultProvider: null,
        temperature: 0.0,
        maxTokens: 1024,
        streamResponse: true,
      });
      expect(store.settings.ai.temperature).toBe(0.0);

      await store.updateAISettings({
        defaultProvider: null,
        temperature: 1.0,
        maxTokens: 1024,
        streamResponse: true,
      });
      expect(store.settings.ai.temperature).toBe(1.0);

      // Valid token range
      await store.updateAISettings({
        defaultProvider: null,
        temperature: 0.7,
        maxTokens: 1,
        streamResponse: true,
      });
      expect(store.settings.ai.maxTokens).toBe(1);

      await store.updateAISettings({
        defaultProvider: null,
        temperature: 0.7,
        maxTokens: 8192,
        streamResponse: true,
      });
      expect(store.settings.ai.maxTokens).toBe(8192);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const storageError = new Error('Storage unavailable');
      global.chrome.storage.sync.set.mockRejectedValueOnce(storageError);
      global.chrome.storage.local.set.mockRejectedValueOnce(storageError);

      const store = useSettingsStore.getState();
      await store.updateTheme('dark');

      expect(store.error).toBeTruthy();
      expect(store.error).toContain('Failed to save settings');
    });

    it('should handle loading errors gracefully', async () => {
      const loadError = new Error('Failed to load');
      global.chrome.storage.sync.get.mockRejectedValueOnce(loadError);

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(store.error).toBeTruthy();
      expect(store.error).toContain('Failed to load settings');
    });

    it('should clear errors on successful operations', async () => {
      const store = useSettingsStore.getState();

      // Set an error
      store.setError('Test error');
      expect(store.error).toBe('Test error');

      // Successful operation should clear error
      await store.updateTheme('dark');
      expect(store.error).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should set loading state during async operations', async () => {
      const store = useSettingsStore.getState();

      // Mock a delayed storage operation
      let resolvePromise: () => void;
      const delayedPromise = new Promise<void>(resolve => {
        resolvePromise = resolve;
      });

      global.chrome.storage.sync.set.mockReturnValueOnce(delayedPromise);

      // Start the operation
      const updatePromise = store.updateTheme('dark');

      // Should be loading
      expect(store.isLoading).toBe(true);

      // Resolve the storage operation
      resolvePromise!();
      await updatePromise;

      // Should no longer be loading
      expect(store.isLoading).toBe(false);
    });
  });
});
