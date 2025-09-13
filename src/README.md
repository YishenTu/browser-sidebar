# Source Code Overview

This folder contains the AI Browser Sidebar extension code. It is organized into small, focused modules with clear boundaries and path aliases for easy navigation.

## Directory Map

```
src/
├─ config/       # Central config: models, prompts, slash commands
├─ content/      # Content script: extraction pipeline + sidebar injection glue
├─ core/         # Provider protocol helpers (ai/) + engines + extraction utils
├─ data/         # Zustand stores, Chrome storage wrapper, crypto/masking
├─ extension/    # MV3 service worker, cache, messaging, tab + sidebar managers
├─ platform/     # Typed wrappers over Chrome APIs (runtime, tabs, storage, …)
├─ services/     # High‑level facades (chat, extraction, keys, engine manager)
├─ shared/       # Cross‑cutting utilities (URL checks/normalization)
├─ sidebar/      # React Shadow‑DOM UI (components, hooks, styles)
├─ transport/    # HTTP transports (direct and background‑proxied streaming)
└─ types/        # Shared TS types (messages, tabs, extraction, providers)
```

## What Lives Where

### config/

- `models.ts` — Model catalog and helpers (OpenAI, Gemini, OpenRouter, OpenAI‑Compat presets)
- `systemPrompt.ts` — System prompt text helpers
- `slashCommands.ts` — Built‑in commands (e.g., summarize, explain, fact‑check, rephrase)

### content/

- `core/` — Document patcher, message handler, sidebar controller
- `extraction/` — Orchestrator with modes: Readability (default), Raw, Defuddle, Selection
- `extraction/extractors/` — `readability.ts`, `raw.ts`, `defuddle.ts`
- `extraction/analyzers/` — Content + metadata analyzers
- `utils/` — DOM and tab helpers

Key updates (Sep 2025):

- Readability extractor added and set as the default mode
- Runtime toggle for default extraction mode (see `setDefaultExtractionMode`)

### core/

- `ai/<provider>/` — Stateless request builders, stream processors, error mappers
- `engine/` — Stateful providers: OpenAI, Gemini, OpenRouter, OpenAI‑Compat
- `extraction/` — Markdown converter and analyzers used by content pipeline

### data/

- `store/` — In‑memory chat/session stores (no persistence) and a persistent settings store
- `storage/` — Typed Chrome storage wrapper (+ keys subsystem)
- `security/` — AES‑GCM utilities and masking helpers

### extension/

- `background/index.ts` — Service worker entry
- `background/messageHandler.ts` — Typed message registry (PING/PONG, GET_TAB_ID/INFO, GET_ALL_TABS, EXTRACT_TAB_CONTENT, CLEANUP_TAB_CACHE, etc.)
- `background/sidebarManager.ts` — Per‑tab sidebar lifecycle
- `background/tabManager.ts` — Tab querying, extraction orchestration + cache
- `background/cache/TabContentCache.ts` — Session storage TTL cache (5 minutes)
- `background/queue/ExtractionQueue.ts` — Concurrency‑limited extraction queue
- `messaging/` — Message helpers, error/response shapes

### platform/

- Chrome API wrappers: `runtime.ts`, `tabs.ts`, `storage.ts`, `messaging.ts`, `ports.ts`, `keepAlive.ts`, `alarms.ts`, `action.ts`, `scripting.ts`

### services/

- `chat/ChatService.ts` — Provider‑agnostic streaming with cancel support
- `engine/EngineManagerService.ts` — Creates/initializes providers, switches models
- `extraction/ExtractionService.ts` — Background‑mediated extraction with retries
- `keys/KeyService.ts` — Encrypted BYOK storage + live validation
- `session/SessionService.ts` — Session keying and URL normalization helpers

### shared/

- `utils/restrictedUrls.ts` and `utils/urlNormalizer.ts`

### sidebar/

- `ChatPanel.tsx`, `index.tsx`, components/, hooks/, contexts/, styles/

### transport/

- `types.ts`, `DirectFetchTransport.ts`, `BackgroundProxyTransport.ts`, `policy.ts`

### types/

- Message protocol, tabs, extraction, providers, settings, storage, etc.

## Message & Data Flow (High Level)

```
User → Sidebar (React) → Services (chat/extraction/keys)
   ↘                                  ↙
    Background (service worker) ←→ Content script (page)
                ↘
               Transports → AI providers
```

## Path Aliases (vite.config.ts)

- `@` → `src/*`, plus focused aliases like `@sidebar`, `@components`, `@hooks`,
  `@extension`, `@content`, `@core`, `@data`, `@store`, `@storage`, `@security`,
  `@platform`, `@services`, `@transport`, `@types`, `@config`, `@shared`.

## Current Highlights (Sep 2025)

- Readability is the default extraction mode; Raw/Defuddle/Selection available
- Slash commands now include `rephrase` and allow per‑command model override
- Available models in the UI are gated by saved API keys and compat providers
- Stream cancel support wired through ChatService and the ChatInput cancel button

## Testing

```bash
npm test              # All tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
```

## Security & Privacy

- BYOK only; keys encrypted at rest with AES‑GCM (see `data/security` and `services/keys`)
- Minimal Chrome permissions; sidebar UI runs in Shadow DOM
