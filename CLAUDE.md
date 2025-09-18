# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered browser extension (Chrome) that creates a sidebar for interacting with web pages using various AI providers (OpenAI GPT, Google Gemini, OpenRouter). Users bring their own API keys (BYOK) for privacy.

## Common Development Commands

### Build & Development

```bash
npm run dev         # Start Vite dev server with hot reload (port 5173)
npm run build       # TypeScript check + production build to dist/
npm run watch       # Build and watch for extension reloads
```

### Testing

```bash
npm test                # Run all tests once
npm run test:watch      # Watch mode for test development
npm run test:coverage   # Generate coverage report
npm run test:ui         # Interactive Vitest UI

# Run specific test files:
npm test -- tests/unit/core/extraction/markdownConverter.test.ts
```

### Code Quality

```bash
npm run lint          # ESLint check
npm run format        # Prettier format all files
npm run typecheck     # TypeScript type checking (no emit)
```

### Extension Development

1. Build: `npm run build`
2. Open Chrome: `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked" → select `dist/` folder
5. Click extension icon to toggle sidebar on any webpage

## High-Level Architecture

### Core Message Flow

```
User clicks extension icon → Background Service Worker → Content Script → Sidebar UI
                                        ↓
                            Transport Layer (message passing)
                                        ↓
                        Chat Service → AI Engine → Provider (OpenAI/Gemini/etc)
```

### Module Responsibilities

**Extension Infrastructure (`src/extension/`)**

- Service worker manages sidebar lifecycle, tab states, and message routing
- Keeps extension alive with periodic heartbeats
- Manages extraction queue and content caching

**Content Extraction (`src/content/` + `src/core/extraction/`)**

- Content scripts inject into web pages for extraction
- Core extraction logic converts HTML to Markdown (non-RAW modes)
- Supports Defuddle, Readability, and RAW extraction methods
- Orchestrator coordinates extraction pipelines

**Sidebar UI (`src/sidebar/`)**

- React app rendered in Shadow DOM for style isolation
- Main entry: `ChatPanel.tsx` manages chat interface
- Components use layered CSS architecture (0-foundation → 4-features)
- Hooks handle AI integration, content extraction, UI behaviors

**AI Integration (`src/core/ai/` + `src/core/engine/`)**

- Provider abstractions for OpenAI, Gemini, OpenRouter
- Streaming support with "thinking" display for compatible models
- Engine manages sessions, message handling, and streaming

**Data Management (`src/data/`)**

- Zustand stores follow hierarchical delegation pattern
- SessionStore holds all session data in memory (no persistence)
- API keys encrypted with AES-GCM before Chrome storage
- Settings persisted to Chrome storage

**Transport Layer (`src/transport/`)**

- Abstracts Chrome messaging APIs for type-safe communication
- Channels handle different communication contexts
- Policy system determines transport selection (direct vs proxy)

## Key Technical Decisions

### Import Aliases

All modules use path aliases configured in `vite.config.ts` and `tsconfig.json`:

- `@core/*`, `@sidebar/*`, `@content/*`, `@data/*`, `@services/*`, etc.

### Extraction Methods

- **Defuddle** (default): Advanced extraction with cleaned Markdown
- **Readability**: Mozilla's article extraction
- **RAW**: Direct HTML without processing

### State Management

- Zustand stores with delegation pattern
- No persistence for chat sessions (memory only)
- Settings and API keys persisted to Chrome storage

### Security

- BYOK model - users provide their own API keys
- Keys encrypted at rest with AES-GCM
- Shadow DOM isolates sidebar styles from host page
- Minimal extension permissions

## Testing Strategy

- Unit tests for core logic (extraction, AI providers, services)
- Integration tests for transport and streaming
- Mock Chrome APIs and external providers
- Coverage target: >90% for modified code

## Performance Targets

- Initial sidebar load: <100ms
- Toggle animation: <50ms
- Message rendering: <20ms per message
- Content extraction: <500ms average
- Memory baseline: <50MB
- run `npx vite build` every time files were edited.
