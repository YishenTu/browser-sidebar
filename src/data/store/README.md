# Zustand Store Setup

This module provides the main application state management using Zustand.

## Usage

### Basic Usage with Full Store Access

```tsx
import { useAppStore } from '@/store';

function MyComponent() {
  const { isLoading, error, setLoading, setError } = useAppStore();

  const handleAction = async () => {
    setLoading(true);
    try {
      // Some async operation
      await doSomething();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleAction}>Do Something</button>
    </div>
  );
}
```

### Using Selectors for Performance

```tsx
import { useAppStore } from '@/store';

function MyComponent() {
  // Only re-renders when isLoading changes
  const isLoading = useAppStore(state => state.isLoading);

  // Only re-renders when error changes
  const error = useAppStore(state => state.error);

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### Using Helper Hooks

```tsx
import { useStoreActions, useStoreState } from '@/store';

function MyComponent() {
  const { isLoading, error } = useStoreState();
  const { setLoading, setError, clearError } = useStoreActions();

  const handleAction = async () => {
    setLoading(true);
    clearError();

    try {
      await doSomething();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleAction}>Do Something</button>
    </div>
  );
}
```

### Creating Isolated Stores for Testing

```tsx
import { createAppStore } from '@/store';
import { renderHook, act } from '@testing-library/react';

test('store test with isolated instance', () => {
  const store = createAppStore();

  const { result } = renderHook(() => store());

  act(() => {
    result.current.setLoading(true);
  });

  expect(result.current.isLoading).toBe(true);
});
```

## API Reference

### State Interface

```typescript
interface AppState {
  isLoading: boolean;
  error: string | null;
}
```

### Actions Interface

```typescript
interface AppActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}
```

### Exports

- `useAppStore`: Main hook for accessing the store
- `useStoreActions`: Hook for accessing only actions
- `useStoreState`: Hook for accessing only state
- `createAppStore`: Factory function for creating new store instances
- `appStore`: Default store instance
- `storeUtils`: Utility functions for direct store access

### Settings Store

```ts
// src/data/store/settings.ts
interface SettingsState {
  selectedModel: string;
  updateSelectedModel: (modelId: string) => void;
  apiKeys: Record<string, string>;
  updateApiKey: (provider: string, key: string) => void;
}
```

Used by `@components/ModelSelector` in the ChatPanel header. Manages:

- Model selection across providers
- API key storage (encrypted via storage layer)
- Provider-specific settings

### Chat Store - Modular Architecture

The chat functionality has been refactored into a **hierarchical delegation pattern** with specialized stores:

```
SessionStore (Master - holds all session data)
    ├── MessageStore (delegates operations to active session)
    ├── TabStore (delegates operations to active session)
    └── UIStore (delegates operations to active session)
```

#### Session Store (`stores/sessionStore.ts`)

**Master store** that holds all session data in memory:

```ts
interface SessionState {
  sessions: Record<string, SessionData>;
  activeSessionKey: string | null;

  // Session management
  createSessionKey: (tabId: number, url: string) => string;
  getOrCreateSession: (tabId: number, url: string) => SessionData;
  switchSession: (tabId: number, url: string) => SessionData;
  updateActiveSession: (updates: Partial<SessionData>) => void;

  // Clearing strategies
  clearSession: (sessionKey: string) => void; // Remove specific session
  clearTabSessions: (tabId: number) => void; // Remove all sessions for tab
  clearCurrentSession: () => void; // Reset current session data
}
```

**Session Key Format**: `tab_${tabId}:${normalizedUrl}`

- URL normalization includes query params, excludes hash fragments
- Example: `tab_123:https://example.com/page?id=456`

#### Message Store (`stores/messageStore.ts`)

**Delegated store** that operates on the active session:

```ts
interface MessageState {
  // All operations delegate to SessionStore's active session
  addMessage: (options: CreateMessageOptions) => ChatMessage;
  updateMessage: (id: string, updates: UpdateMessageOptions) => void;
  appendToMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  editMessage: (id: string) => ChatMessage | undefined;

  // Selectors retrieve from active session
  getMessages: () => ChatMessage[];
  getUserMessages: () => ChatMessage[];
  getAssistantMessages: () => ChatMessage[];
}
```

#### Tab Store (`stores/tabStore.ts`)

**Delegated store** for tab content management:

```ts
interface TabState {
  // All operations delegate to SessionStore's active session
  setLoadedTabs: (tabs: Record<number, TabContent>) => void;
  addLoadedTab: (tabId: number, tabContent: TabContent) => void;
  updateTabContent: (tabId: number, editedContent: string) => void;
  removeLoadedTab: (tabId: number) => void;

  // Selectors retrieve from active session
  getLoadedTabs: () => Record<number, TabContent>;
  getTabContent: (tabId: number) => TabContent | undefined;
  getCurrentTabContent: () => TabContent | undefined;
}
```

#### UI Store (`stores/uiStore.ts`)

**Delegated store** for UI state:

```ts
interface UIState {
  // All operations delegate to SessionStore's active session
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveMessageId: (id: string | null) => void;
  setLastResponseId: (id: string | null) => void;

  // Selectors retrieve from active session
  isLoading: () => boolean;
  getError: () => string | null;
  getActiveMessageId: () => string | null;
}
```

### Session Lifecycle

**When Sessions Continue:**

- Same tab + same normalized URL (page refresh, hash changes)
- Sidebar hidden/shown (React stays mounted)
- Return to previously visited URL in same tab

**When Sessions are Created:**

- New tab opened
- Navigate to different URL (different query params = new session)
- First visit to a URL in a tab

**When Sessions are Cleared:**

- Tab closed → all sessions for that tab removed
- User clicks "Clear conversation" → current session reset
- Browser/extension restart → all sessions lost (memory-only)

**Sidebar Mount/Unmount:**

- **Mount**: Icon click → inject → mount React → retrieve/create session
- **Hide**: Icon click → CSS hide (React mounted, session preserved)
- **Show**: Icon click → CSS show (no re-mount, session continues)
- **Navigate**: Full unmount → must reopen → session retrieved if exists
- **Tab close**: Full unmount → `TAB_CLOSED` → sessions cleared

## Chrome Extension Integration

The store works seamlessly within the Chrome extension environment. Future versions will include:

- Chrome storage persistence
- Cross-tab state synchronization
- Extension-specific error handling

## Development Features

- Redux DevTools integration (development only)
- TypeScript strict mode support
- Comprehensive test coverage
- Performance optimizations with selectors
