/**
 * @file Model Switching Service Tests
 *
 * Tests for the model switching service including availability gate,
 * provider switch rollback, and onApiKeyMissing callback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { switchModel, type ModelSwitchOptions } from '@core/services/modelSwitching';
import { useSettingsStore } from '@store/settings';
import type { ProviderType } from '@/types/providers';

// Mock the settings store
vi.mock('@store/settings', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

describe('switchModel', () => {
  const mockUpdateSelectedModel = vi.fn<[string], Promise<void>>();
  const mockSwitchProvider = vi.fn<[ProviderType], Promise<void>>();
  const mockGetProviderTypeForModel = vi.fn<[string], string | null>();
  const mockOnApiKeyMissing = vi.fn();

  const createOptions = (overrides: Partial<ModelSwitchOptions> = {}): ModelSwitchOptions => ({
    modelId: 'gpt-4',
    updateSelectedModel: mockUpdateSelectedModel,
    switchProvider: mockSwitchProvider,
    getProviderTypeForModel: mockGetProviderTypeForModel,
    onApiKeyMissing: mockOnApiKeyMissing,
    ...overrides,
  });

  beforeEach(() => {
    mockUpdateSelectedModel.mockReset().mockResolvedValue(undefined);
    mockSwitchProvider.mockReset().mockResolvedValue(undefined);
    mockGetProviderTypeForModel.mockReset().mockReturnValue('openai');
    mockOnApiKeyMissing.mockReset();

    // Default settings store state
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        selectedModel: 'gpt-3.5-turbo',
        availableModels: [
          { id: 'gpt-4', available: true },
          { id: 'gpt-3.5-turbo', available: true },
          { id: 'gemini-pro', available: false },
        ],
      },
    } as ReturnType<typeof useSettingsStore.getState>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('availability gate', () => {
    it('should return success when model is available', async () => {
      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(true);
      expect(result.previousModel).toBe('gpt-3.5-turbo');
    });

    it('should return failure when model is not available', async () => {
      const result = await switchModel(createOptions({ modelId: 'gemini-pro' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });

    it('should return failure when model does not exist in available list', async () => {
      const result = await switchModel(createOptions({ modelId: 'non-existent-model' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });
  });

  describe('onApiKeyMissing callback', () => {
    it('should call onApiKeyMissing when model is not available', async () => {
      await switchModel(createOptions({ modelId: 'gemini-pro' }));

      expect(mockOnApiKeyMissing).toHaveBeenCalledTimes(1);
    });

    it('should not call onApiKeyMissing when model is available', async () => {
      await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(mockOnApiKeyMissing).not.toHaveBeenCalled();
    });

    it('should work without onApiKeyMissing callback', async () => {
      const result = await switchModel(
        createOptions({
          modelId: 'gemini-pro',
          onApiKeyMissing: undefined,
        })
      );

      expect(result.success).toBe(false);
    });
  });

  describe('provider switch', () => {
    it('should call updateSelectedModel with new model ID', async () => {
      await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(mockUpdateSelectedModel).toHaveBeenCalledWith('gpt-4');
    });

    it('should call switchProvider when provider type is found', async () => {
      mockGetProviderTypeForModel.mockReturnValue('openai');

      await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(mockSwitchProvider).toHaveBeenCalledWith('openai');
    });

    it('should not call switchProvider when provider type is null', async () => {
      mockGetProviderTypeForModel.mockReturnValue(null);

      await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(mockSwitchProvider).not.toHaveBeenCalled();
    });
  });

  describe('rollback on failure', () => {
    it('should rollback to previous model when updateSelectedModel fails', async () => {
      mockUpdateSelectedModel.mockRejectedValueOnce(new Error('Update failed'));

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
      expect(mockUpdateSelectedModel).toHaveBeenCalledWith('gpt-3.5-turbo');
    });

    it('should rollback to previous model when switchProvider fails', async () => {
      mockSwitchProvider.mockRejectedValueOnce(new Error('Provider switch failed'));

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider switch failed');
      expect(mockUpdateSelectedModel).toHaveBeenCalledWith('gpt-3.5-turbo');
    });

    it('should include previousModel in result on failure', async () => {
      mockSwitchProvider.mockRejectedValueOnce(new Error('Failed'));

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.previousModel).toBe('gpt-3.5-turbo');
    });

    it('should handle non-Error rejection', async () => {
      mockSwitchProvider.mockRejectedValueOnce('string error');

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to switch provider');
    });
  });

  describe('error handling', () => {
    it('should handle provider switch errors gracefully', async () => {
      // When switchProvider throws after updateSelectedModel succeeds,
      // the function catches and wraps the error, then rolls back
      mockSwitchProvider.mockRejectedValueOnce(new Error('Provider init failed'));

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider init failed');
      // Verify rollback occurred
      expect(mockUpdateSelectedModel).toHaveBeenLastCalledWith('gpt-3.5-turbo');
    });

    it('should handle non-Error exceptions from provider switch', async () => {
      mockSwitchProvider.mockRejectedValueOnce('string exception');

      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to switch provider');
    });
  });

  describe('result structure', () => {
    it('should return correct success result', async () => {
      const result = await switchModel(createOptions({ modelId: 'gpt-4' }));

      expect(result).toEqual({
        success: true,
        previousModel: 'gpt-3.5-turbo',
      });
    });

    it('should return correct failure result for unavailable model', async () => {
      const result = await switchModel(createOptions({ modelId: 'gemini-pro' }));

      expect(result).toEqual({
        success: false,
        previousModel: 'gpt-3.5-turbo',
        error: 'API key required',
      });
    });
  });
});
