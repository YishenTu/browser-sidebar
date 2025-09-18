# Data layer

State, persistence, and security primitives for the sidebar live under
`src/data/`.  React components interact with these modules through the higher
level services, but the actual storage logic—Zustand stores, Chrome storage
wrappers, encryption, and API-key management—resides here.

## Layout

```
data/
├─ store/        # Zustand stores and helpers
├─ storage/      # Chrome storage adapters + modular API-key vault
├─ security/     # AES-GCM encryption + masking utilities
└─ README.md
```

### `store/`

`store/chat.ts`, `store/settings.ts`, and the `stores/` subdirectory define the
per-session chat/message/tab/UI stores used by the sidebar.  They follow a
hierarchical pattern: `useSessionStore` owns the authoritative data while the
other stores delegate to the currently active session key.  Types for each
store live under `store/types/`.

`store/index.ts` also exports a generic `createAppStore` factory leveraged by
tests and future shared state needs.

### `storage/`

* `storage/chrome.ts` wraps the Chrome Storage APIs with typed helpers,
  batch operations, quota inspection, and migration utilities.  It supports
  `local`, `sync`, and `session` areas.
* `storage/keys/` is a modular API-key vault.  It exposes functions for creating
  encrypted keys, listing metadata, rotating or importing/exporting keys, and
  tracking usage statistics.  The module maintains its own in-memory cache plus
  a background cleanup loop.  It also includes a simple store for
  OpenAI-compatible provider definitions (`compat.ts`) that do not require
  encryption.

### `security/`

* `crypto.ts` wraps AES-GCM encryption/decryption and PBKDF2 key derivation.
* `masking.ts` exposes helpers (e.g. `maskValue`, `maskAPIKey`) so secrets can be
  displayed without leaking full values.

These primitives are composed by `KeyService` and by the key-storage module
above.

## Usage tips

* Always derive deterministic session keys with `@shared/utils/urlNormalizer` and
  persist them through `useSessionStore`—never write directly to Chrome storage
  from the UI.
* When adding new persisted settings, define the schema shape in
  `store/settings.ts` and let the storage wrapper handle migrations.
* API-key operations should go through `@/services/keys` unless you are writing
  integration tests for the storage module itself.
