import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from '@/sidebar/hooks/ai/useAIChat';
import { EngineManagerService } from '@/services/engine/EngineManagerService';
import { useSettingsStore } from '@store/settings';

// Mock dependencies
vi.mock('@/services/engine/EngineManagerService');
vi.mock('@store/settings');
vi.mock('@store/chat', () => {
  const mockTabStoreState = {
    getCurrentTabId: vi.fn(),
    setCurrentTabId: vi.fn(),
    getHasAutoLoaded: vi.fn(),
    setHasAutoLoaded: vi.fn(),
    setLoadedTabs: vi.fn(),
    getLoadedTabs: vi.fn(() => ({})),
    getCurrentTabContent: vi.fn(() => null),
  };
  const useTabStoreMock = vi.fn(() => mockTabStoreState);
  (useTabStoreMock as any).getState = vi.fn(() => mockTabStoreState);

  const mockMessageStoreState = {
    hasMessages: vi.fn(() => false),
    getMessages: vi.fn(() => []),
  };
  const useMessageStoreMock = vi.fn(() => mockMessageStoreState);
  (useMessageStoreMock as any).getState = vi.fn(() => mockMessageStoreState);

  return {
    useTabStore: useTabStoreMock,
    useUIStore: vi.fn(() => ({
      setError: vi.fn(),
      clearError: vi.fn(),
      setLoading: vi.fn(),
      clearActiveMessage: vi.fn(),
    })),
    useMessageStore: useMessageStoreMock,
    useSessionStore: vi.fn(() => ({})),
  };
});

describe('useAIChat Provider Switching', () => {
  let mockEngineManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Settings Store
    (useSettingsStore as any).mockReturnValue({
      settings: {
        ai: { defaultProvider: null },
        apiKeys: {},
        selectedModel: 'gpt-4',
      },
    });
    (useSettingsStore as any).getState = vi.fn(() => ({
      settings: {
        ai: { defaultProvider: null },
        apiKeys: {},
        selectedModel: 'gpt-4',
      },
      updateAISettings: vi.fn(),
    }));

    // Mock EngineManagerService instance
    let activeProvider: any = null;

    mockEngineManager = {
      initializeFromSettings: vi.fn().mockResolvedValue(undefined),
      getActive: vi.fn().mockImplementation(() => {
        if (!activeProvider) {
          throw new Error('No active provider available. Please initialize providers first.');
        }
        return activeProvider;
      }),
      switch: vi.fn().mockImplementation(async type => {
        activeProvider = { type, name: type };
      }),
      getStats: vi.fn().mockReturnValue({ activeProvider: null, registeredProviders: [] }),
    };

    (EngineManagerService.getInstance as any).mockReturnValue(mockEngineManager);
  });

  it('should handle switchProvider when no provider is currently active', async () => {
    const { result } = renderHook(() => useAIChat({ enabled: true, autoInitialize: false }));

    // Verify getActive throws (simulating the bug condition)
    expect(() => mockEngineManager.getActive()).toThrow('No active provider available');

    // Attempt to switch provider
    // Before the fix, this would throw because serviceGetActiveProvider calls getActive() which throws
    await act(async () => {
      await result.current.switchProvider('openai');
    });

    // Verify switch was called
    expect(mockEngineManager.switch).toHaveBeenCalledWith('openai');
  });
});
