# Zustand Stores

Zustand stores keep session/chat state in-memory and persist user settings to Chrome storage. Only the session store owns data; other stores delegate to it so we avoid duplicate state.

## Chat Stores

```
useSessionStore  # Master store (sessions map, activeSessionKey, creation/cleanup helpers)
useMessageStore  # Message list for the active session (add/update/delete/edit)
useTabStore      # Extracted tab cache (current tab + additional tabs, selection order)
useUIStore       # Loading/error flags, streaming state, activeMessageId
useSettingsStore # Persistent settings (API keys, compat providers, UI prefs, extraction defaults)
```

### Session Keys

`createSessionKey(tabId, url)` → `tab_{id}:{normalizedUrl}` using `@shared/utils/urlNormalizer` (lowercases host, removes hash, keeps query). Keeps sessions deterministic across reloads.

### Settings Store Highlights

- Persists to `chrome.storage.sync` with fallback to `local`.
- Validates API key references before saving (`openai`, `google`, `openrouter`).
- Computes available models from saved keys + compat provider registry (`@data/storage/keys/compat`).
- Stores domain extraction rules (`domainRules`) consumed by the content script.
- Tracks UI prefs (compact mode, timestamps, debug mode) and screenshot hotkey.
- Exposes helpers: `loadSettings`, `updateAPIKeyReferences`, `refreshAvailableModelsWithCompat`, `updateExtractionPreferences`, `updateSelectedModel`, etc.

### Usage Example

```ts
import { useSessionStore, useMessageStore, useTabStore, useUIStore } from '@data/store/chat';
import { useSettingsStore } from '@store/settings';

useSessionStore.getState().switchSession(tabId, url);
const msg = useMessageStore.getState().addMessage({ role: 'user', content: 'Hello!' });
useUIStore.getState().setLoading(true);
useTabStore.getState().addLoadedTab(tabId, tabContent);
await useSettingsStore
  .getState()
  .updateAPIKeyReferences({ openai: key, google: null, openrouter: null });
```

## Guidelines

- Keep store mutations synchronous and minimal; expensive work belongs in services or core utilities.
- Use selectors (`useStore(state => state.foo)`) to avoid unnecessary renders.
- When adding state, prefer updating `useSessionStore` so other stores can delegate.
