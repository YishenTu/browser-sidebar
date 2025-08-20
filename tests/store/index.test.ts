import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { StoreApi } from 'zustand';

// Import the store and types (will be created in implementation)
import { createAppStore, useAppStore, useStoreActions, useStoreState } from '@/store';
import type { AppStore } from '@/store';

describe('Store - Zustand Store Setup', () => {
  let store: StoreApi<AppStore>;

  beforeEach(() => {
    // Create a fresh store for each test
    store = createAppStore();
  });

  describe('Store Initialization', () => {
    it('should initialize with default values', () => {
      const state = store.getState();

      expect(state).toEqual({
        // Core state properties
        isLoading: false,
        error: null,

        // Actions should be functions
        setLoading: expect.any(Function),
        setError: expect.any(Function),
        clearError: expect.any(Function),
        reset: expect.any(Function),
      });
    });

    it('should have proper TypeScript types', () => {
      const state = store.getState();

      // Type assertions to ensure proper typing
      expect(typeof state.isLoading).toBe('boolean');
      expect(state.error).toBeNull();
      expect(typeof state.setLoading).toBe('function');
      expect(typeof state.setError).toBe('function');
      expect(typeof state.clearError).toBe('function');
      expect(typeof state.reset).toBe('function');
    });
  });

  describe('State Updates', () => {
    it('should update loading state', () => {
      act(() => {
        store.getState().setLoading(true);
      });

      expect(store.getState().isLoading).toBe(true);

      act(() => {
        store.getState().setLoading(false);
      });

      expect(store.getState().isLoading).toBe(false);
    });

    it('should set and clear error', () => {
      const errorMessage = 'Test error message';

      act(() => {
        store.getState().setError(errorMessage);
      });

      expect(store.getState().error).toBe(errorMessage);

      act(() => {
        store.getState().clearError();
      });

      expect(store.getState().error).toBeNull();
    });

    it('should reset store to initial state', () => {
      // Change state
      act(() => {
        store.getState().setLoading(true);
        store.getState().setError('Test error');
      });

      // Verify state changed
      expect(store.getState().isLoading).toBe(true);
      expect(store.getState().error).toBe('Test error');

      // Reset
      act(() => {
        store.getState().reset();
      });

      // Verify reset to initial state
      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().error).toBeNull();
    });
  });

  describe('Store Subscriptions', () => {
    it('should notify subscribers when state changes', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = store.subscribe(mockSubscriber);

      // Change state
      act(() => {
        store.getState().setLoading(true);
      });

      expect(mockSubscriber).toHaveBeenCalled();

      // Cleanup
      unsubscribe();
    });

    it('should not notify unsubscribed listeners', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = store.subscribe(mockSubscriber);

      // Unsubscribe immediately
      unsubscribe();

      // Change state
      act(() => {
        store.getState().setLoading(true);
      });

      expect(mockSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('React Hook Integration', () => {
    it('should work with useAppStore hook', () => {
      // Reset main store before test
      act(() => {
        useAppStore.getState().reset();
      });

      const { result } = renderHook(() => useAppStore());

      // Check initial state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Test state update
      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should work with selector using shared store', () => {
      // Reset store before test for shared store testing
      act(() => {
        useAppStore.getState().reset();
      });

      const { result } = renderHook(() => useAppStore(state => state.isLoading));

      expect(result.current).toBe(false);

      // Update state through the hook
      act(() => {
        useAppStore.getState().setLoading(true);
      });

      expect(result.current).toBe(true);

      // Reset for cleanup
      act(() => {
        useAppStore.getState().reset();
      });
    });

    it('should re-render components when selected state changes', () => {
      // Reset store before test
      act(() => {
        useAppStore.getState().reset();
      });

      const { result } = renderHook(() => useAppStore(state => state.isLoading));

      expect(result.current).toBe(false);

      // Update loading state
      act(() => {
        useAppStore.getState().setLoading(true);
      });

      expect(result.current).toBe(true);

      // Update back to false
      act(() => {
        useAppStore.getState().setLoading(false);
      });

      expect(result.current).toBe(false);
    });
  });

  describe('Chrome Extension Context', () => {
    it('should work without chrome.storage in test environment', () => {
      // This test ensures our store doesn't break in test environment
      // where chrome APIs might not be fully mocked
      expect(() => {
        const testStore = createAppStore();
        testStore.getState().setLoading(true);
      }).not.toThrow();
    });

    it('should handle chrome storage errors gracefully', () => {
      // Mock chrome.storage to throw an error
      const originalChrome = global.chrome;

      global.chrome = {
        ...originalChrome,
        storage: {
          ...originalChrome.storage,
          sync: {
            ...originalChrome.storage.sync,
            get: vi.fn().mockRejectedValue(new Error('Storage error')),
          },
        },
      };

      // Store should still work even if chrome storage fails
      expect(() => {
        const testStore = createAppStore();
        testStore.getState().setError('test');
      }).not.toThrow();

      // Restore original chrome mock
      global.chrome = originalChrome;
    });
  });

  describe('Middleware Integration', () => {
    it('should support devtools in development', () => {
      // Test that devtools middleware is properly configured
      // In real implementation, this would be conditional based on NODE_ENV
      const testStore = createAppStore();

      // Store should have devtools name property if configured
      expect(testStore).toBeDefined();
      expect(typeof testStore.getState).toBe('function');
      expect(typeof testStore.subscribe).toBe('function');
    });

    it('should initialize persistence middleware if configured', () => {
      // Test that persistence works (will be implemented later)
      // For now, just ensure store creation doesn't fail
      expect(() => createAppStore()).not.toThrow();
    });
  });

  describe('Helper Hooks', () => {
    it('should provide separated action hooks', () => {
      // Reset store before test
      act(() => {
        useAppStore.getState().reset();
      });

      const { result } = renderHook(() => useStoreActions());

      expect(typeof result.current.setLoading).toBe('function');
      expect(typeof result.current.setError).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.reset).toBe('function');

      // Test that actions work
      act(() => {
        result.current.setLoading(true);
      });

      expect(useAppStore.getState().isLoading).toBe(true);
    });

    it('should provide separated state hooks', () => {
      // Reset store before test
      act(() => {
        useAppStore.getState().reset();
      });

      const { result } = renderHook(() => useStoreState());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Update state and check if hook reflects changes
      act(() => {
        useAppStore.getState().setLoading(true);
        useAppStore.getState().setError('Test error');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe('Test error');
    });

    it('should allow separation of concerns with helper hooks', () => {
      // Reset store before test
      act(() => {
        useAppStore.getState().reset();
      });

      const { result: actionsResult } = renderHook(() => useStoreActions());
      const { result: stateResult } = renderHook(() => useStoreState());

      // Test initial state
      expect(stateResult.current.isLoading).toBe(false);
      expect(stateResult.current.error).toBeNull();

      // Use actions to update state
      act(() => {
        actionsResult.current.setLoading(true);
        actionsResult.current.setError('Helper test');
      });

      // State should reflect the changes
      expect(stateResult.current.isLoading).toBe(true);
      expect(stateResult.current.error).toBe('Helper test');

      // Clear error using actions
      act(() => {
        actionsResult.current.clearError();
      });

      expect(stateResult.current.error).toBeNull();
    });
  });
});
