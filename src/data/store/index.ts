import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Base application state interface
 */
export interface AppState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Application store actions interface
 */
export interface AppActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

/**
 * Combined store interface
 */
export interface AppStore extends AppState, AppActions {}

/**
 * Initial state values
 */
const initialState: AppState = {
  isLoading: false,
  error: null,
};

/**
 * Create a new app store instance
 * This factory function allows for creating isolated store instances for testing
 *
 * @returns StoreApi<AppStore> - A new Zustand store instance
 */
export const createAppStore = (): UseBoundStore<StoreApi<AppStore>> => {
  return create<AppStore>()(
    devtools(
      (set, _get) => ({
        // Initial state
        ...initialState,

        // Actions
        setLoading: (loading: boolean) => set({ isLoading: loading }, false, 'setLoading'),

        setError: (error: string | null) => set({ error }, false, 'setError'),

        clearError: () => set({ error: null }, false, 'clearError'),

        reset: () => set({ ...initialState }, false, 'reset'),
      }),
      {
        name: 'browser-sidebar-store', // DevTools name
        enabled: process.env['NODE_ENV'] === 'development',
      }
    )
  );
};

/**
 * Default app store instance
 * This is the main store used throughout the application
 */
export const appStore = createAppStore();

/**
 * React hook for accessing the app store
 * Uses the default app store instance
 * Supports both full store access and selector pattern
 *
 * @example
 * ```tsx
 * // Full store access
 * const { isLoading, setLoading } = useAppStore();
 *
 * // With selector (recommended for performance)
 * const isLoading = useAppStore((state) => state.isLoading);
 * ```
 */
export const useAppStore: UseBoundStore<StoreApi<AppStore>> = appStore;

/**
 * Store utilities for advanced usage
 */
export const storeUtils = {
  /**
   * Get the current store state without subscribing
   */
  getState: () => appStore.getState(),

  /**
   * Subscribe to store changes
   * @param listener - Callback function called on state changes
   * @returns Unsubscribe function
   */
  subscribe: (listener: (state: AppStore) => void) => appStore.subscribe(listener),

  /**
   * Destroy the store (useful for cleanup in tests)
   * Note: Zustand doesn't expose destroy method by default
   */
  destroy: () => {
    // Custom cleanup if needed in the future
    // Store destroy called - implement cleanup logic here
  },
};

/**
 * Type helpers for external usage
 */
export type { StoreApi } from 'zustand';

/**
 * Store creation options for future extensions
 */
export interface StoreOptions {
  enableDevtools?: boolean;
  enablePersistence?: boolean;
  persistenceKey?: string;
}

/**
 * Future: Create store with custom options
 * This will be extended when we add persistence and other middleware
 */
export const createAppStoreWithOptions = (options: StoreOptions = {}): StoreApi<AppStore> => {
  const {
    enableDevtools = process.env['NODE_ENV'] === 'development',
    persistenceKey = 'browser-sidebar-store',
  } = options;

  // Base store creator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeCreator = (set: any, _get: any) => ({
    ...initialState,

    setLoading: (loading: boolean) => set({ isLoading: loading }, false, 'setLoading'),

    setError: (error: string | null) => set({ error }, false, 'setError'),

    clearError: () => set({ error: null }, false, 'clearError'),

    reset: () => set({ ...initialState }, false, 'reset'),
  });

  // Apply middleware conditionally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let middlewaredStore: any = storeCreator;

  // Apply devtools middleware if enabled
  if (enableDevtools) {
    middlewaredStore = devtools(storeCreator, {
      name: persistenceKey,
      enabled: enableDevtools,
    });
  }

  // Future: Apply persistence middleware if enabled
  // if (enablePersistence) {
  //   store = persist(store, {
  //     name: persistenceKey,
  //     storage: createChromeStorageAdapter(),
  //   });
  // }

  return create<AppStore>()(middlewaredStore);
};

/**
 * Helper hooks for common store operations
 */
export const useStoreActions = () => {
  const setLoading = useAppStore(state => state.setLoading);
  const setError = useAppStore(state => state.setError);
  const clearError = useAppStore(state => state.clearError);
  const reset = useAppStore(state => state.reset);

  return {
    setLoading,
    setError,
    clearError,
    reset,
  };
};

export const useStoreState = () => {
  const isLoading = useAppStore(state => state.isLoading);
  const error = useAppStore(state => state.error);

  return {
    isLoading,
    error,
  };
};

/**
 * Export default store instance for convenience
 */
export default useAppStore;
