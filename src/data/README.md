# Data Module

State, persistence, and security for the AI Browser Sidebar.

## Structure

```
data/
├─ store/                    # Zustand stores
│  ├─ stores/
│  │  ├─ sessionStore.ts    # Session master store (per tab+URL)
│  │  ├─ messageStore.ts    # Delegates to active session
│  │  ├─ tabStore.ts        # Delegates to active session
│  │  └─ uiStore.ts         # Delegates to active session
│  ├─ types/                # Store types
│  ├─ utils/chatHelpers.ts  # Session key helpers and creation
│  ├─ chat.ts               # Barrel for chat‑related stores
│  ├─ settings.ts           # Persistent settings store (Chrome storage)
│  └─ index.ts              # Exports
├─ storage/
│  ├─ chrome.ts             # Typed Chrome storage wrapper (local/sync/session)
│  ├─ keys/                 # Key storage subsystem (helpers + metadata)
│  └─ index.ts              # Exports
├─ security/
│  ├─ crypto.ts             # AES‑GCM encrypt/decrypt + key derivation
│  └─ masking.ts            # Display masking utilities
└─ README.md
```

## Stores

### Chat/session stores (in‑memory)

Specialized stores follow a hierarchical delegation pattern. Only the session store owns data; others operate on the active session.

```
SessionStore (master)
  ├─ MessageStore (delegates to active session)
  ├─ TabStore (delegates to active session)
  └─ UIStore (delegates to active session)
```

- Deterministic session keys: `tab_{id}:{normalizedUrl}` (see `@shared/utils/urlNormalizer`)
- No persistence; session data resets with extension/browser restarts
- `useSessionManager` hook in the UI selects/switches sessions based on current tab

### Settings store (persistent)

`useSettingsStore` is persisted to Chrome storage with a light migration layer:

- Loads from `sync` with a timeout; falls back to `local`
- Writes to `sync`; falls back to `local` on quota/unavailable
- Gates the list of available models based on saved API keys and OpenAI‑Compat providers

Key actions: `loadSettings`, `updateSelectedModel`, `refreshAvailableModelsWithCompat`, plus simple setters/getters for UI and privacy preferences.

## Storage wrapper

`data/storage/chrome.ts` exposes small typed helpers over `@platform/chrome/storage`:

- `get/set/remove/clear` and batch variants
- `onChanged` with automatic de‑serialization
- `migrate` with versioned schema support (used by settings)
- `getStorageInfo` for quota stats

## Security

`data/security/crypto.ts` provides AES‑GCM encryption/decryption and PBKDF2 key derivation. The KeyService composes these utilities to encrypt BYOK secrets stored via the storage wrapper.

## Notes

- Chat/session stores are memory‑only by design; only settings and API‑key metadata are persisted.
- Avoid storing large blobs; prefer the background cache for extracted content (`extension/background/cache/TabContentCache.ts`).
