# Source Code Overview

The `src/` tree contains the entire Browser Sidebar extension.  Modules are split by
responsibility so background logic, extraction, UI, and data plumbing can evolve
independently while sharing types and utilities through path aliases (see
`tsconfig.json`).

## Directory map

```
src/
├─ config/      # Model catalogue, slash commands, and system prompt helpers
├─ content/     # Content script bootstrap plus per-tab extraction pipeline
├─ core/        # Provider adapters, engine orchestration, shared extraction utils
├─ data/        # Zustand stores, Chrome storage wrappers, crypto, API-key storage
├─ extension/   # MV3 service worker, tab/sidebar lifecycle, proxy + cache layers
├─ platform/    # Typed wrappers around chrome.* APIs (runtime, storage, tabs, ...)
├─ services/    # High-level facades for chat, engines, extraction, keys, sessions
├─ shared/      # Cross-cutting helpers (restricted URL guard, URL normaliser)
├─ sidebar/     # Shadow-DOM React UI, hooks, contexts, layered styling
├─ transport/   # Fetch/stream transports and proxy policy helpers
├─ types/       # Shared TypeScript contracts (messages, tabs, providers, …)
└─ utils/       # Generic helpers that do not belong to another package yet
```

## Cross-cutting flow

```
Sidebar React UI ──▶ Services (chat / extraction / sessions / keys)
      │                                │
      │                                └─▶ Core engines + transports
      │                                        │
      ▼                                        ▼
Chrome messaging ◀──── Extension background ◀── Content script extraction
```

* The **content script** (`content/`) mounts the React app, orchestrates
  extraction (`content/extraction/**`), and exposes typed message handlers for
  the background worker.
* The **background service worker** (`extension/`) keeps the sidebar alive per
  tab, proxies CORS restricted requests, and coordinates extractions via
  `TabManager`, `ExtractionQueue`, and the `TabContentCache`.
* **Services** hide chrome/runtime specifics from the UI: `ChatService` streams
  providers, `EngineManagerService` initialises engines from `config/models.ts`,
  `ExtractionService` talks to the background worker, `KeyService` encrypts BYOK
  credentials, and `SessionService` keeps deterministic session keys.
* **Stores and storage** (`data/`) back the UI with Zustand state, Chrome
  storage accessors, and hardened API-key persistence/rotation utilities.

## Working in this tree

* Prefer the path aliases defined in `tsconfig.json`/`vite.config.ts`
  (`@content`, `@core`, `@data`, `@services`, `@sidebar`, …) to keep imports
  stable when files move.
* Unit and integration tests mirror this layout under `tests/**`; e.g. provider
  helpers live in `tests/unit/core/ai/`, extraction logic in
  `tests/unit/content/` and `tests/integration/content/`.
* New shared types should live in `types/` and be exported through the relevant
  barrel file so both the background script and UI can consume them without
  circular deps.
