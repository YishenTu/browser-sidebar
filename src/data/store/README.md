# Zustand stores

Chat/session state is handled by a collection of focused Zustand stores.  The
structure mirrors the sidebar UI: a master session map plus stores that expose
a per-session view for messages, tab content, and UI flags.  Persistent settings
are handled separately so transient chat state never hits disk.

## Directory

```
store/
├─ chat.ts          # Barrel that re-exports all chat-related stores + helpers
├─ index.ts         # Generic app store factory used by tests
├─ settings.ts      # Persistent settings store with Chrome storage sync
├─ stores/          # Concrete Zustand stores (session, message, tab, ui)
├─ types/           # Shared TypeScript interfaces for the stores
└─ utils/chatHelpers.ts # Session-key helpers + initialisers
```

### Session hierarchy

```
useSessionStore ─┬─ useMessageStore  (CRUD on active session messages)
                 ├─ useTabStore      (per-session extracted tab cache)
                 └─ useUIStore       (streaming flags, active message ids, errors)
```

* `useSessionStore` tracks the `sessions` map and `activeSessionKey`.  The
  helper `switchSession(tabId, url)` derives deterministic keys via
  `@shared/utils/urlNormalizer`.
* The other stores delegate to whatever session key `useSessionStore` marks as
  active, keeping their own selectors shallow so React components can subscribe
  efficiently.
* `useSettingsStore` in `settings.ts` persists the settings schema to Chrome
  storage (`sync` with fallback to `local`).  It also computes the
  `availableModels` list by combining `config/DEFAULT_MODELS` with the API-key
  metadata stored in `data/storage/keys` and any OpenAI-compatible providers
  saved through `data/storage/keys/compat`.

### Utilities

`utils/chatHelpers.ts` exposes helpers for building session keys, seeding
sessions from extracted tab data, and wiping state when tabs close.  Prefer
those helpers to keep behaviour consistent between tests, the sidebar, and the
service worker.

## Usage

```ts
import { useSessionStore, useMessageStore, useTabStore, useUIStore } from '@data/store/chat';

const { switchSession } = useSessionStore.getState();
switchSession(tabId, url);

const { addMessage } = useMessageStore.getState();
addMessage({ role: 'user', content: 'Hello world' });

const { setLoading } = useUIStore.getState();
setLoading(true);
```

Always mutate through the exported actions—directly touching the underlying
state objects may bypass derived-state updates.
