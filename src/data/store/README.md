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

### Settings Store (Model Selector)

```ts
// src/store/settings.ts
interface Model {
  id: string;
  name: string;
  provider: string;
  available: boolean;
}

interface SettingsState {
  selectedModel: string;
  availableModels: Model[];
  setModel: (id: string) => void;
}
```

Used by `@components/ModelSelector` in the ChatPanel header. Persists via `chrome.storage` where available.

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
