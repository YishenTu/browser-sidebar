# Source Code Structure

This layout groups code by major functions: sidebar (frontend UI), tabext (tab content extraction), provider (AI integration), with shared infrastructure in extension and data modules.

## Modules

### `/sidebar`

React UI for the sidebar (Shadow DOM overlay).

- `ChatPanel.tsx` – Unified chat panel (overlay, resize/drag) with AI chat integration
- `components/` – Reusable UI components with recent updates:
  - `MessageList.tsx` – Virtualized message list for performance
  - `MessageBubble.tsx` – Message display with thinking wrapper support
  - `MarkdownRenderer.tsx` – Full markdown support with code highlighting
  - `ThinkingWrapper.tsx` – Real-time thinking display with timer
  - `ModelSelector.tsx` – AI model selection dropdown
  - `ChatInput.tsx` – Enhanced input with character counter and auto-resize
- `components/ui/` – Core UI components (simplified without cn.ts dependency)
- `hooks/` – AI chat hooks (`useAIChat`, `useStreamHandler`, `useProviderManager`)
- `styles/` – CSS modules for component styling
- `contexts/` – Error context for unified error handling
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

AI provider configuration and clients (BYOK - Bring Your Own Key). Fully implemented with streaming support.

- `BaseProvider.ts` – Abstract base class for all providers
- `ProviderFactory.ts` – Factory for creating provider instances
- `ProviderRegistry.ts` – Singleton registry for provider management
- `openai/` – OpenAI Response API implementation
  - Supports GPT-5 series models (nano, mini, standard)
  - Reasoning effort levels (minimal/low/medium/high)
  - Thinking display integration
- `gemini/` – Gemini API implementation
  - Supports Gemini 2.5 series (Flash Lite, Flash, Pro)
  - Thinking budget modes (0=off, -1=dynamic)
  - Web search grounding
- Common features: streaming, error handling, API validation

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
  - `chat.ts` – Chat conversation state with streaming support
  - `settings.ts` – User settings, model selection, API keys
- `storage/` – Persistence layer
  - `chrome.ts` – Chrome storage API wrapper
  - `keys/` – Comprehensive API key management
    - Secure storage with encryption
    - Import/export functionality
    - Health checks and rotation
    - Usage tracking
- `security/` – Security utilities
  - `crypto.ts` – AES-GCM encryption/decryption
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

## Current Implementation Status

### ✅ Completed Features

1. **Extension Infrastructure** - Custom sidebar with resize/move, message passing, cross-browser support
2. **Chat UI** - Full React component suite with markdown, code highlighting, virtualization
3. **AI Providers** - OpenAI and Gemini fully integrated with streaming and thinking display
4. **Storage & Security** - Encrypted API key storage, Chrome storage integration
5. **State Management** - Zustand stores with TypeScript support

### 🚧 In Progress

- Tab content extraction system (planned architecture in place)
- Multi-tab context aggregation
- Advanced provider features (function calling, vision)

### Recent Updates

- **ThinkingWrapper** - Real-time timer display with improved state persistence
- **Message Components** - Enhanced layout with copy buttons and timestamps
- **Provider Refactor** - Simplified configuration, removed unused parameters
- **UI Simplification** - Removed cn.ts dependency for cleaner code
- **Error Handling** - Unified error context across components
