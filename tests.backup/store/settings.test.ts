/**
 * @file Settings Store Tests - Model Selection Feature
 *
 * Test-driven development for model selection functionality in the settings store.
 * These tests are written FIRST to drive implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Set up Chrome API mocks BEFORE importing the store
const mockChromeStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
};

// Override the global chrome mock before store import
// @ts-expect-error: set global chrome in test environment
global.chrome = {
  storage: mockChromeStorage,
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    id: 'test-extension-id',
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// NOW import the store after mocking Chrome APIs
import { useSettingsStore } from '../../src/store/settings';
import type { Model } from '../../src/types/settings';

// Define the mock models that should match the store implementation
const MOCK_AVAILABLE_MODELS: Model[] = [
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

describe('Settings Store - Model Selection', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Mock successful storage operations by default (must be done after clearAllMocks)
    mockChromeStorage.sync.get.mockResolvedValue({});
    mockChromeStorage.sync.set.mockResolvedValue(undefined);
    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeStorage.local.set.mockResolvedValue(undefined);

    // Ensure our mock is the one being used by overriding again
    // @ts-expect-error: override chrome storage in test environment
    global.chrome.storage = mockChromeStorage;

    // Reset store state
    useSettingsStore.setState({
      settings: {
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
        // These should be added by implementation
        selectedModel: 'gpt-4',
        availableModels: [...MOCK_AVAILABLE_MODELS],
      },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Store Initialization', () => {
    it('should initialize with default model selection', () => {
      const { settings } = useSettingsStore.getState();

      // Should have a default selected model
      expect(settings.selectedModel).toBe('gpt-4');
      expect(typeof settings.selectedModel).toBe('string');
      expect(settings.selectedModel).toHaveLength > 0;
    });

    it('should initialize with available models list', () => {
      const { settings } = useSettingsStore.getState();

      // Should have an array of available models
      expect(Array.isArray(settings.availableModels)).toBe(true);
      expect(settings.availableModels.length).toBeGreaterThan(0);

      // Should include mock models as specified in requirements
      const modelIds = settings.availableModels.map((model: Model) => model.id);
      expect(modelIds).toContain('gpt-4');
      expect(modelIds).toContain('gpt-3.5-turbo');
      expect(modelIds).toContain('claude-3');
      expect(modelIds).toContain('claude-2');
      expect(modelIds).toContain('gemini-pro');
      expect(modelIds).toContain('llama-2');
    });

    it('should have properly structured Model objects', () => {
      const { settings } = useSettingsStore.getState();

      settings.availableModels.forEach((model: Model) => {
        // Each model should have required properties
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('available');

        // Type checks
        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.provider).toBe('string');
        expect(typeof model.available).toBe('boolean');

        // Content validation
        expect(model.id.length).toBeGreaterThan(0);
        expect(model.name.length).toBeGreaterThan(0);
        expect(model.provider.length).toBeGreaterThan(0);
      });
    });

    it('should have selected model available in models list', () => {
      const { settings } = useSettingsStore.getState();

      const selectedModelExists = settings.availableModels.some(
        (model: Model) => model.id === settings.selectedModel
      );

      expect(selectedModelExists).toBe(true);
    });
  });

  describe('Model Selection Actions', () => {
    it('should provide updateSelectedModel action', () => {
      const store = useSettingsStore.getState();

      // Should have the action method
      expect(typeof store.updateSelectedModel).toBe('function');
    });

    it('should update selected model successfully', async () => {
      const store = useSettingsStore.getState();

      // Select a different model
      await store.updateSelectedModel('claude-3');

      const updatedSettings = useSettingsStore.getState().settings;
      expect(updatedSettings.selectedModel).toBe('claude-3');
    });

    it('should validate model selection against available models', async () => {
      const store = useSettingsStore.getState();

      // Try to select invalid model
      await expect(store.updateSelectedModel('invalid-model')).rejects.toThrow();

      // Selected model should remain unchanged
      const settings = useSettingsStore.getState().settings;
      expect(settings.selectedModel).toBe('gpt-4'); // Should remain default
    });

    it('should handle loading state during model update', async () => {
      const store = useSettingsStore.getState();

      // Mock delayed storage operation
      let resolveStorage: () => void;
      const storagePromise = new Promise<void>(resolve => {
        resolveStorage = resolve;
      });
      mockChromeStorage.sync.set.mockReturnValue(storagePromise);

      // Start model update
      const updatePromise = store.updateSelectedModel('gemini-pro');

      // Should show loading state
      expect(useSettingsStore.getState().isLoading).toBe(true);

      // Complete the operation
      resolveStorage!();
      await updatePromise;

      // Should clear loading state
      expect(useSettingsStore.getState().isLoading).toBe(false);
    });

    it('should handle errors during model update', async () => {
      const store = useSettingsStore.getState();

      // Mock storage failure
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Storage failed'));
      mockChromeStorage.local.set.mockRejectedValue(new Error('Storage failed'));

      // This should catch the error but still set error state
      try {
        await store.updateSelectedModel('claude-2');
      } catch (error) {
        // Expected to throw
      }

      // Should set error state
      const errorState = useSettingsStore.getState().error;
      expect(errorState).not.toBeNull();
      expect(errorState).toContain('Failed to save settings');
      expect(useSettingsStore.getState().isLoading).toBe(false);
    });
  });

  describe('Model Persistence', () => {
    it('should persist selected model to storage', async () => {
      const store = useSettingsStore.getState();

      await store.updateSelectedModel('claude-3'); // Use available model

      // Check if the store state was updated
      const updatedSettings = useSettingsStore.getState().settings;
      expect(updatedSettings.selectedModel).toBe('claude-3');

      // Should have called chrome storage
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(1);

      const savedData = mockChromeStorage.sync.set.mock.calls[0][0];
      expect(savedData.settings.selectedModel).toBe('claude-3');
    });

    it('should load selected model from storage', async () => {
      // Mock stored settings with selected model (must match STORAGE_KEY from store)
      mockChromeStorage.sync.get.mockResolvedValue({
        settings: {
          // This key matches STORAGE_KEY in the store
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
          selectedModel: 'claude-3',
          availableModels: [...MOCK_AVAILABLE_MODELS],
        },
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      const settings = useSettingsStore.getState().settings;
      expect(settings.selectedModel).toBe('claude-3');
    });

    it('should fall back to default model if stored model is invalid', async () => {
      // Mock stored settings with invalid model
      mockChromeStorage.sync.get.mockResolvedValue({
        settings: {
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
          selectedModel: 'non-existent-model',
          availableModels: [...MOCK_AVAILABLE_MODELS],
        },
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      const settings = useSettingsStore.getState().settings;
      expect(settings.selectedModel).toBe('gpt-4'); // Should fall back to default
    });
  });

  describe('Available Models Management', () => {
    it('should provide getAvailableModels method', () => {
      const store = useSettingsStore.getState();

      expect(typeof store.getAvailableModels).toBe('function');
    });

    it('should return only available models when requested', () => {
      const store = useSettingsStore.getState();

      const availableModels = store.getAvailableModels();

      // All returned models should be marked as available
      availableModels.forEach((model: Model) => {
        expect(model.available).toBe(true);
      });
    });

    it('should return all models including unavailable ones', () => {
      const store = useSettingsStore.getState();

      const allModels = store.getAvailableModels(false); // false = include unavailable

      expect(allModels.length).toBeGreaterThanOrEqual(6); // At least the 6 required models
    });
  });

  describe('Integration with Existing Store', () => {
    it('should maintain compatibility with existing settings structure', () => {
      const { settings } = useSettingsStore.getState();

      // Should have all existing settings properties
      expect(settings).toHaveProperty('version');
      expect(settings).toHaveProperty('theme');
      expect(settings).toHaveProperty('ui');
      expect(settings).toHaveProperty('ai');
      expect(settings).toHaveProperty('privacy');
      expect(settings).toHaveProperty('apiKeys');

      // Should have new model-related properties
      expect(settings).toHaveProperty('selectedModel');
      expect(settings).toHaveProperty('availableModels');
    });

    it('should work with existing resetToDefaults action', async () => {
      const store = useSettingsStore.getState();

      // Change selected model
      await store.updateSelectedModel('claude-3');
      expect(useSettingsStore.getState().settings.selectedModel).toBe('claude-3');

      // Reset to defaults
      await store.resetToDefaults();

      // Should reset to default model
      expect(useSettingsStore.getState().settings.selectedModel).toBe('gpt-4');
    });

    it('should validate selectedModel during settings validation', () => {
      // This tests the validation functions that should be added
      // The actual validation logic will be implemented in the store

      const store = useSettingsStore.getState();
      expect(() => {
        // This should not throw for valid model
        store.updateSelectedModel('gpt-4');
      }).not.toThrow();
    });
  });
});
