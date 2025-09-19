# Data Module

State management, persistence, and security utilities. Zustand stores live alongside Chrome storage abstractions and the key vault.

## Structure

```
data/
├─ store/                    # Zustand stores (sessions, messages, tabs, UI, settings)
├─ storage/
│  ├─ chrome.ts              # Promise-based Chrome storage helpers (sync/local/session)
│  ├─ keys/                  # Modular key vault (encryption, cache, compat registry)
│  └─ index.ts
├─ security/
│  ├─ crypto.ts              # AES-GCM, PBKDF2, masking helpers
│  └─ masking.ts
└─ README.md
```

## Stores (`store/`)

- `stores/` — Specialized Zustand stores (`sessionStore`, `messageStore`, `tabStore`, `uiStore`). Only the session store owns data; others delegate to the active session.
- `chat.ts` — Barrel export combining chat-related stores.
- `settings.ts` — Persistent settings store with Chrome storage persistence, migrations, domain extraction rules, compat provider sync, screenshot hotkey.
- `types/`, `utils/chatHelpers.ts` — Shared store types + helpers to build session keys.

Settings Store features:

- Persists to `chrome.storage.sync` with automatic fallback to `local` on quota errors.
- Validates API key references (`openai`, `google/gemini`, `openrouter`).
- Computes available models based on saved keys + compat providers.
- Stores domain-specific extraction defaults and UI preferences (debug mode, screenshot hotkey).

## Storage (`storage/`)

### `chrome.ts`

Promise-based wrappers around Chrome storage APIs with namespace selection (`sync`, `local`, `session`), listeners, migrations, and helpful errors.

### `keys/`

Modular key vault that encrypts API keys before persistence:

- `index.ts` — Service entry (initialization, add/get/update/delete keys, metrics, cache cleanup).
- `operations.ts` / `query.ts` / `rotation.ts` / `usage.ts` — CRUD, listing, rotation, and usage tracking.
- `cache.ts` — In-memory cache for hot keys with integrity validation.
- `encryption.ts` — Singleton AES-GCM service built on `data/security/crypto`.
- `compat.ts` — Lightweight storage for OpenAI-compatible providers (IDs, base URLs, optional default models) stored in plain text without secrets.
- `utils.ts`, `constants.ts`, `database.ts`, `importExport.ts`, `health.ts` — Hashing, IndexedDB metadata cache, import/export helpers, health checks.

Initialize the vault via `initializeStorage(password)` before performing mutations; compat provider helpers do not require initialization.

## Security

- Secrets are encrypted with AES-GCM using a PBKDF2-derived key + per-entry salt/nonce.
- API key hashes are stored separately for duplicate detection (`STORAGE_KEYS.API_KEY_HASH_PREFIX`).
- Compat provider catalog is stored without secrets and is safe to sync.

## Notes

- Chat/session stores intentionally avoid persistence; only settings and the key vault write to Chrome storage.
- Prefer store selector hooks in React components to minimize re-renders.
- Use the vault APIs instead of writing keys directly to storage.
