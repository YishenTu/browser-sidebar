# Source Code Structure

This layout groups code by major functions: sidebar (frontend UI), tabext (tab content extraction), provider (AI integration), with shared infrastructure in extension and data modules.

## Modules

### `/sidebar`

React UI for the sidebar (Shadow DOM overlay).

- `ChatPanel.tsx` – Unified chat panel (overlay, resize/drag)
- `components/` – Reusable UI components (MessageList, Markdown, ModelSelector, UI)
- `components/ui/` – Button, Input, Card, IconButton, Spinner, TextArea
- `hooks/` – Sidebar-specific hooks
- `styles/` – Unified sidebar stylesheet + theme variables
- `contexts/` – UI contexts (e.g., theme)
- `lib/` – UI utilities (cn.ts for className merging)
- `index.tsx` – Shadow DOM mount/unmount logic

### `/tabext`

Content extraction system for capturing web page content. This module owns the Tab Content Capture System — collecting content from the current tab (and later multiple tabs) and sending it into the chat context so users can ask AI questions about it.

- `index.ts` – Content script injection and message handling
- Future (planned):
  - `services/extraction/` – Readability-based main content, code blocks, tables, selection markers, images
  - `services/aggregation/` – Multi-tab selection, parallel extraction, deduplication, relevance ranking
  - `format/` – Markdown/structured output with links and image handling
  - `bridge/` – Packaging content into typed messages for provider

### `/provider`

AI provider configuration and clients (BYOK - Bring Your Own Key).

- Provider abstraction, per-provider clients (OpenAI/Gemini/Anthropic)
- API key validation utilities
- Provider-specific settings and configuration

### `/extension`

Chrome extension infrastructure components.

- `background/` – Service worker (background script)
  - `index.ts` – Service worker entry point
  - `keepAlive.ts` – Service worker keep-alive mechanism
  - `messageHandler.ts` – Message routing and handling
  - `sidebarManager.ts` – Sidebar state management
- `messaging/` – Chrome extension message passing utilities
  - `index.ts` – High-level message bus and helpers

### `/data`

Unified data management layer.

- `store/` – Zustand stores for application state
  - `index.ts` – Base store setup
  - `chat.ts` – Chat conversation state
  - `settings.ts` – User settings and preferences
- `storage/` – Persistence layer (simplified)
  - `chrome.ts` – Chrome storage API wrapper
  - `keys.ts` – API key storage management
- `security/` – Essential security utilities
  - `crypto.ts` – Encryption/decryption
  - `masking.ts` – Data masking for sensitive info

### `/types`

TypeScript type definitions shared across modules.

- `messages.ts` – Extension message types
- `settings.ts` – Settings and configuration types
- `providers.ts` – AI provider types
- `chat.ts` – Chat-related types
- `apiKeys.ts` – API key management types

## Module Dependencies

```
extension/background (service worker)
    ↑                ↑
    │                │
tabext (content extraction) ←→ sidebar (UI)
    │          │            └── components / hooks / styles / contexts
    │          └── uses extension/messaging / types
    └── sends structured content → provider

sidebar → provider (BYOK)
data/store ← sidebar (state management)
data/storage ← provider (API keys)
data/security ← storage (encryption)
```

## Development Guidelines

1. **Module Separation**: Keep UI (sidebar), content extraction (tabext), and extension infrastructure separate
2. **Type Safety**: Strict TypeScript with shared types in `/types`
3. **Testing**: Tests live under `/tests` mirroring module structure
4. **Message Passing**: Communicate via typed messages in `extension/messaging`
5. **State Management**: Use Zustand stores in `data/store` for UI state
6. **Security**: Always encrypt sensitive data using `data/security`

## Import Aliases

Configured in `vite.config.ts` and `tsconfig.json`:

- `@/` – `src/`
- `@sidebar` – `src/sidebar`
- `@components` – `src/sidebar/components`
- `@ui` – `src/sidebar/components/ui`
- `@hooks` – `src/sidebar/hooks`
- `@contexts` – `src/sidebar/contexts`
- `@tabext` – `src/tabext`
- `@provider` – `src/provider`
- `@extension` – `src/extension`
- `@data` – `src/data`
- `@store` – `src/data/store`
- `@storage` – `src/data/storage`
- `@security` – `src/data/security`
- `@types` – `src/types`

## Architecture Decisions

### Why This Structure?

1. **Feature-Based Organization**: Major features (sidebar, tabext, provider) get top-level directories
2. **Infrastructure Grouping**: Extension-specific code grouped under `/extension`
3. **Data Layer Consolidation**: All data management (state, storage, security) under `/data`
4. **Simplified Storage**: Removed complex IndexedDB/migration system in favor of Chrome storage API
5. **Security Focus**: Essential encryption utilities without over-engineering

### Future Scalability

- `tabext/` will expand with extraction services as the feature develops
- `provider/` will add more AI providers and streaming capabilities
- `data/storage/` can add IndexedDB later if needed
- Extension messaging remains centralized for easy debugging
