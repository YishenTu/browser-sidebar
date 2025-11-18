# Source Code Overview

The `src/` tree is organized into small, focused modules with clear boundaries and path aliases. Everything coordinates through typed messaging and service facades so UI code stays declarative and side-effect light.

## Directory Map

```
src/
├─ config/       # Model catalog, compat presets, slash commands, prompts
├─ content/      # Content script bootstrap, extraction orchestrator, DOM glue
├─ core/         # Provider helpers, engines, extraction utils, shared services
├─ data/         # Zustand stores, Chrome storage abstractions, key vault
├─ extension/    # MV3 service worker, keep-alive, messaging, tab/cache lifecycle
├─ platform/     # Typed wrappers over chrome.* (runtime, tabs, storage, ...)
├─ services/     # Facades (chat, engine manager, extraction, keys, session)
├─ shared/       # Cross-cutting utilities (restricted URLs, URL normalization)
├─ sidebar/      # Shadow-DOM React app: components, hooks, contexts, styles
├─ transport/    # Direct/background transports + proxy policy
└─ types/        # Shared TypeScript types (messages, extraction, providers, settings)
```

## Module Notes

### config/

- `models.ts` — Model catalog with capability flags (`supportsReasoning`, `supportsThinking`), compat presets, helpers (`getDefaultModelForProvider`, `getPresetById`).
- `slashCommands.ts` — Built-in slash commands (summarize, explain, analyze, comment, fact-check → Gemini, rephrase) with optional per-command model overrides.
- `systemPrompt.ts` — Structured system prompts tailored for web-context Q&A.

### content/

- `core/` — Document patcher, message handler, Shadow-DOM controller bootstrap.
- `extraction/` — Orchestrator + modes (Readability default, Raw, Defuddle, Selection) with domain-aware defaults (`resolveDefaultExtractionModeFromSettings`).
- `extraction/extractors/` — Dynamic imports for readability/raw/defuddle implementations.
- `extraction/analyzers/` — Feature detectors (tables, code, metadata) shared with core converters.
- `extraction/sites/` — Site plugins registry (runs before extractor selection).
- `utils/` — DOM + tab helpers kept free of UI deps.

### core/

- `ai/<provider>/` — Stateless request builders (Gemini, Grok, OpenAI, OpenRouter), SSE parsers, error normalization per provider.
- `engine/` — Stateful providers built on `BaseEngine`, registry/factory to instantiate OpenAI, Gemini, Grok, OpenRouter, OpenAI-compatible stacks.
- `extraction/` — Markdown converter + analyzers consumed by content pipeline.
- `services/` — Pure domain services: message editing, image upload/sync, model switching, message queueing, tab content helpers.
- `utils/` — Pure helpers (error classification, favicon resolution, geometry/layout, dropdown positioning, text processing, hotkey parsing, screenshot math).

### data/

- `store/` — Zustand stores: session/message/tab/ui aggregates plus persistent `settings` (Chrome storage with migrations, domain extraction rules, screenshot hotkey, API key references).
- `storage/` — Chrome storage wrapper (`getMultiple`, `setMultiple`, listeners) and the modular key vault under `storage/keys` (AES-GCM encryption, IndexedDB metadata cache, hash-based duplicate detection, compat provider registry).
- `security/` — Crypto helpers layered under the key vault (PBKDF2, AES-GCM, masking).

### extension/

- `background/index.ts` — Service worker entry; wires keep-alive and handler registry.
- `background/messageHandler.ts` — Typed router for sidebar/content requests (`PING/PONG`, `GET_TAB_ID/INFO`, `GET_ALL_TABS`, `EXTRACT_TAB_CONTENT`, `CONTENT_READY`, `CLEANUP_TAB_CACHE`, `PROXY_REQUEST`, error replies).
- `background/tabManager.ts` — Tab lookup, extraction queue (3 concurrent slots), cache coordination, content-script readiness.
- `background/cache/TabContentCache.ts` — 5-minute TTL cache in `chrome.storage.session` with mode-aware invalidation.
- `background/queue/ExtractionQueue.ts` — FIFO queue with backoff/retry helpers.
- `messaging/` — Message factories + shared response/error shapes.

### platform/

Typed wrappers for `chrome.*`: runtime (install/update events), tabs, storage (sync/local/session, batch helpers), messaging, ports (long-lived channels), keepAlive strategies, alarms, action button, scripting injection.

### services/

- `chat/ChatService.ts` — Provider-agnostic streaming with cancel support and stream chunk normalization.
- `engine/EngineManagerService.ts` — Singleton orchestrator for provider lifecycle, statistics, auto-bootstrap from saved keys/compat providers, and model switching.
- `extraction/ExtractionService.ts` — Sidebar-facing wrapper around background extraction with retries, batch helpers, and rich error typing.
- `keys/KeyService.ts` — Lightweight BYOK helper now focused on live validation/metadata (full storage handled by `data/storage/keys`).
- `session/SessionService.ts` — Deterministic session keys (`tab_{id}:{normalizedUrl}`), lifecycle cleanup, custom normalization hooks.

### shared/

Currently `restrictedUrls.ts` (centralized allow/deny) and `urlNormalizer.ts` (used by session keys, stores, services).

### sidebar/

- `ChatPanel.tsx` — Unified shell integrating layout, settings, screenshot capture, extraction preview.
- `components/` — Layout primitives, chat widgets, `ScreenshotPreview`, settings panel.
- `hooks/` — React hooks for AI orchestration (`useAIChat`, `useStreamHandler`), tab extraction, slash commands, mentions, screenshot capture, sidebar positioning, message editing.
- `contexts/` — Error boundary context, etc.
- `styles/` — Layered CSS (`@layer` foundation→features) under Shadow DOM isolation.

### transport/

- `DirectFetchTransport` — Native fetch wrapper with streaming.
- `BackgroundProxyTransport` — Service-worker proxy for CORS-bound endpoints (used automatically via `policy.ts`).
- `policy.ts` — Allow/deny heuristics plus helper to decide when to proxy.

### types/

Shared contracts: messages (`MessageType`, payloads), extraction (`ExtractionMode`, options/results), providers (engine config + capabilities), chat/session models, storage schemas, settings (UI, domain rules, screenshot hotkey), API key vault types.

## Message & Data Flow (High Level)

```
User → Sidebar (React) → Services (chat / extraction / engine)
   ↘                                   ↙
    Background (service worker) ←→ Content script
              ↘
           Transports → Provider APIs
```

## Path Aliases (vite.config.ts)

`@` → `src/*`, plus focused aliases like `@sidebar`, `@components`, `@hooks`, `@extension`, `@content`, `@core`, `@data`, `@store`, `@services`, `@transport`, `@platform`, `@config`, `@shared`, `@types`, `@config/models`, etc.

## Current Highlights (November 2025)

- **Gemini 3 & Grok Support**: Added native support for Gemini 3 Pro (with thinking levels) and xAI Grok models.
- Domain-based extraction defaults (Readability/Raw/Defuddle/Selection) resolved in the content script.
- Engine Manager tracks health/stats and lazily boots providers using saved keys + compat provider registry.
- Screenshot capture pipeline (hotkey + preview + upload helper) wired through sidebar hooks and core services.
- Slash commands support per-command model overrides; UI exposes reasoning/thinking badges based on model metadata.
- Multi-tab extraction via @-mentions reuses background cache and maintains per-session tab ordering.

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
npm run test:ui    # Vitest UI runner
```

## Security & Privacy

- BYOK only; secrets pass through the AES-GCM key vault (`data/storage/keys`) before hitting Chrome storage.
- Compat provider catalog stored separately without secrets; Shadow DOM keeps UI isolated.
- Minimal extension permissions (`activeTab`, `storage`) and strict message validation in the background service worker.
