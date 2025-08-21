# Source Code Structure

This layout groups code by the three major functions: sidebar (frontend UI), provider (AI provider config), and tabext (tab extraction). Shared infra lives in core; backend logic runs in the service worker.

## Modules

### `/sidebar`
React UI for the sidebar.
- `components/` – Reusable UI components
- `hooks/` – Sidebar-specific hooks
- `styles/` – Sidebar CSS and theme variables
- `contexts/` – UI contexts (e.g., theme)
- `index.tsx` – Mount/unmount logic for the sidebar

### `/tabext`
Content script injected into pages. This module owns the Tab Content Capture System described in the PRD — collecting content from the current tab (and later multiple tabs) and sending it into the chat context so the user can ask AI questions about it.
- `index.ts` – Sidebar injection and message handling
- Future (planned):
  - `services/extraction/` – Readability-based main content, code blocks, tables, selection markers, images
  - `services/aggregation/` – Multi-tab selection, parallel extraction, deduplication, relevance ranking
  - `format/` – Markdown/structured output with links and image handling
  - `bridge/` – Packaging content into typed messages for backend/provider

### `/provider`
AI provider configuration and clients (BYOK).
- Provider abstraction, per-provider clients (OpenAI/Gemini/Anthropic), settings schema (future)

### `/backend`
Background/service worker and backend services.
- `index.ts` – Service worker entry
- `keepAlive.ts`, `messageHandler.ts`, `sidebarManager.ts`
- Storage and backend services (future: `storage/`, `services/`)

### `/core`
Shared protocol/infra used across modules.
- `messaging.ts` – High-level message bus and helpers
- `types/` (in `src/types`) – Message and configuration types used by all modules
- Shared constants/utilities (future)

### Other
- `/types` – TypeScript definitions (messages, settings, manifest, etc.)
- `/utils` – Cross-cutting utilities (e.g., theme utils)
- `/styles` – Global theme tokens (CSS variables) consumed by sidebar
- `/store` – Zustand stores for UI state (sidebar-only):
  - `index.ts` app store (loading/error)
  - `chat.ts` conversation state (messages, statuses)
  - `settings.ts` UI/AI settings with chrome.storage persistence

## Module Dependencies

```
backend (service worker)
    ↑                ↑
    │                │
tabext (content capture) ←→ sidebar (UI)
    │          │            └── components / hooks / styles / contexts
    │          └── uses core messaging / types
    └── sends structured tab content → backend/provider

sidebar → provider (BYOK)
backend → storage/services (future)
```

## Development Guidelines

1. Single responsibility per module; keep UI and backend separate
2. Strict TypeScript; shared types under `types/`
3. Tests live under `/tests` mirroring module structure
4. Communicate via typed messages in `core`/`types`

## Import Aliases

Configured in `vite.config.ts` and `tsconfig.json`:
- `@/` – `src/`
- `@sidebar` – `src/sidebar`
- `@components` – `src/sidebar/components`
- `@hooks` – `src/sidebar/hooks`
- `@provider` – `src/provider`
- `@backend` – `src/backend`
- `@tabext` – `src/tabext`
- `@core` – `src/core`
- `@storage` – `src/storage`
- `@services` – `src/services`
- `@types` – `src/types`
- `@utils` – `src/utils`
