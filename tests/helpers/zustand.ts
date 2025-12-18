/**
 * @file Zustand Store Helpers
 *
 * Utilities for testing Zustand stores:
 * - resetSessionStore() - Reset session store to initial state
 * - resetSettingsStore() - Reset settings store to initial state
 * - resetAllStores() - Reset all stores
 * - Store state inspection helpers
 */

import { act } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';

// =============================================================================
// Types
// =============================================================================

/**
 * Generic store with getState and setState methods.
 */
type ZustandStore<T> = UseBoundStore<StoreApi<T>> | StoreApi<T>;

/**
 * Initial state snapshot for restoration.
 */
interface StoreSnapshot<T> {
  store: ZustandStore<T>;
  initialState: T;
}

// =============================================================================
// Store Registry
// =============================================================================

const storeSnapshots = new Map<string, StoreSnapshot<unknown>>();

/**
 * Register a store for automatic reset between tests.
 *
 * @param name - Unique name for the store
 * @param store - Zustand store
 * @param initialState - Initial state to restore to
 *
 * @example
 * ```ts
 * import { useSessionStore } from '@/data/store/stores/sessionStore';
 *
 * registerStore('session', useSessionStore, {
 *   sessions: {},
 *   activeSessionKey: null,
 * });
 * ```
 */
export function registerStore<T extends object>(
  name: string,
  store: ZustandStore<T>,
  initialState: T
): void {
  storeSnapshots.set(name, {
    store: store as ZustandStore<unknown>,
    initialState: { ...initialState },
  });
}

/**
 * Unregister a store.
 *
 * @param name - Name of the store to unregister
 */
export function unregisterStore(name: string): void {
  storeSnapshots.delete(name);
}

/**
 * Get the initial state for a registered store.
 *
 * @param name - Name of the store
 */
export function getInitialState<T>(name: string): T | undefined {
  const snapshot = storeSnapshots.get(name);
  return snapshot?.initialState as T | undefined;
}

// =============================================================================
// Session Store Helpers
// =============================================================================

/**
 * Session store initial state.
 */
const sessionStoreInitialState = {
  sessions: {},
  activeSessionKey: null,
};

/**
 * Reset the session store to its initial state.
 * Use this in beforeEach or afterEach to ensure test isolation.
 *
 * @example
 * ```ts
 * import { resetSessionStore } from '@tests/helpers/zustand';
 *
 * beforeEach(() => {
 *   resetSessionStore();
 * });
 * ```
 */
export async function resetSessionStore(): Promise<void> {
  // Dynamically import to avoid circular dependencies and allow test isolation
  const { useSessionStore } = await import('@/data/store/stores/sessionStore');

  await act(async () => {
    useSessionStore.setState({
      ...sessionStoreInitialState,
      // Restore the action functions by spreading from current state
      ...Object.fromEntries(
        Object.entries(useSessionStore.getState()).filter(
          ([, value]) => typeof value === 'function'
        )
      ),
    });
  });
}

/**
 * Get a fresh session store state (without actions).
 */
export async function getSessionStoreState(): Promise<Record<string, unknown>> {
  const { useSessionStore } = await import('@/data/store/stores/sessionStore');
  const state = useSessionStore.getState();

  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => typeof value !== 'function')
  );
}

/**
 * Set session store state for testing.
 *
 * @param state - Partial state to merge
 */
export async function setSessionStoreState(state: Record<string, unknown>): Promise<void> {
  const { useSessionStore } = await import('@/data/store/stores/sessionStore');

  await act(async () => {
    useSessionStore.setState(state);
  });
}

// =============================================================================
// Settings Store Helpers
// =============================================================================

/**
 * Reset the settings store to its initial state.
 *
 * @example
 * ```ts
 * import { resetSettingsStore } from '@tests/helpers/zustand';
 *
 * beforeEach(() => {
 *   resetSettingsStore();
 * });
 * ```
 */
export async function resetSettingsStore(): Promise<void> {
  const { useSettingsStore } = await import('@/data/store/settings');

  await act(async () => {
    // Get all function properties (actions)
    const actions = Object.fromEntries(
      Object.entries(useSettingsStore.getState()).filter(([, value]) => typeof value === 'function')
    );

    // Reset to initial state while preserving actions
    useSettingsStore.setState({
      settings: {
        version: 1,
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
          grok: null,
        },
        extraction: {
          domainRules: [
            { domain: 'x.com', mode: 'defuddle' },
            { domain: 'reddit.com', mode: 'defuddle' },
          ],
        },
        selectedModel: 'gpt-4o',
        availableModels: [],
      },
      isLoading: false,
      error: null,
      ...actions,
    });
  });
}

/**
 * Get settings store state for testing.
 */
export async function getSettingsStoreState(): Promise<Record<string, unknown>> {
  const { useSettingsStore } = await import('@/data/store/settings');
  const state = useSettingsStore.getState();

  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => typeof value !== 'function')
  );
}

/**
 * Set settings store state for testing.
 *
 * @param state - Partial state to merge
 */
export async function setSettingsStoreState(state: Record<string, unknown>): Promise<void> {
  const { useSettingsStore } = await import('@/data/store/settings');

  await act(async () => {
    useSettingsStore.setState(state);
  });
}

// =============================================================================
// UI Store Helpers
// =============================================================================

/**
 * Reset the UI store.
 * Since UIStore delegates to SessionStore, this resets the session store.
 */
export async function resetUIStore(): Promise<void> {
  await resetSessionStore();
}

// =============================================================================
// App Store Helpers
// =============================================================================

/**
 * Reset the app store to its initial state.
 */
export async function resetAppStore(): Promise<void> {
  const { useAppStore } = await import('@/data/store/index');

  await act(async () => {
    useAppStore.getState().reset();
  });
}

/**
 * Get app store state for testing.
 */
export async function getAppStoreState(): Promise<Record<string, unknown>> {
  const { useAppStore } = await import('@/data/store/index');
  const state = useAppStore.getState();

  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => typeof value !== 'function')
  );
}

// =============================================================================
// Combined Reset Helpers
// =============================================================================

/**
 * Reset all stores to their initial state.
 * Use this in beforeEach to ensure complete test isolation.
 *
 * @example
 * ```ts
 * import { resetAllStores } from '@tests/helpers/zustand';
 *
 * beforeEach(async () => {
 *   await resetAllStores();
 * });
 * ```
 */
export async function resetAllStores(): Promise<void> {
  await Promise.all([resetSessionStore(), resetSettingsStore(), resetAppStore()]);
}

// =============================================================================
// Store Testing Utilities
// =============================================================================

/**
 * Simple mock store interface for testing.
 */
export interface MockStore<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  getInitialState: () => T;
  destroy: () => void;
}

/**
 * Create a minimal mock of a Zustand store.
 * Useful for unit testing components that use stores.
 *
 * @param initialState - Initial state for the mock store
 * @returns Mock store with getState and setState
 *
 * @example
 * ```ts
 * const mockStore = createMockStore({
 *   items: [],
 *   addItem: vi.fn(),
 * });
 *
 * mockStore.setState({ items: ['test'] });
 * expect(mockStore.getState().items).toEqual(['test']);
 * ```
 */
export function createMockStore<T extends object>(initialState: T): MockStore<T> {
  let state = { ...initialState };
  const listeners = new Set<(state: T, prevState: T) => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => {
      const prevState = state;
      const nextState = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...nextState };
      listeners.forEach(listener => listener(state, prevState));
    },
    subscribe: (listener: (state: T, prevState: T) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getInitialState: () => initialState,
    destroy: () => listeners.clear(),
  };
}

/**
 * Wait for a store state condition to be met.
 *
 * @param store - Zustand store or object with getState method
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in ms
 *
 * @example
 * ```ts
 * await waitForStoreState(
 *   useSessionStore,
 *   (state) => state.sessions['key'] !== undefined,
 *   1000
 * );
 * ```
 */
export async function waitForStoreState<T>(
  store: { getState: () => T },
  condition: (state: T) => boolean,
  timeout: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition(store.getState())) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`waitForStoreState timed out after ${timeout}ms`);
}

/**
 * Subscribe to store changes and collect them.
 * Useful for verifying state transitions.
 *
 * @param store - Zustand store
 * @returns Object with collected states and unsubscribe function
 *
 * @example
 * ```ts
 * const collector = collectStoreChanges(useSessionStore);
 *
 * // Perform actions...
 * useSessionStore.getState().createSession(1, 'https://example.com');
 *
 * collector.unsubscribe();
 * expect(collector.states).toHaveLength(2);
 * ```
 */
export function collectStoreChanges<T>(store: ZustandStore<T>): {
  states: T[];
  unsubscribe: () => void;
} {
  const states: T[] = [];

  const subscribe = 'subscribe' in store ? store.subscribe : (store as StoreApi<T>).subscribe;

  const unsubscribe = subscribe((state: T) => {
    states.push(state);
  });

  return { states, unsubscribe };
}

/**
 * Extract only data properties from store state (exclude functions).
 *
 * @param state - Store state object
 * @returns State with only data properties
 */
export function extractStoreData<T extends object>(state: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => typeof value !== 'function')
  ) as Partial<T>;
}
