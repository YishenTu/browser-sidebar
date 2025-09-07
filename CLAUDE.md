# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Development
npm run dev          # Start Vite dev server with hot reload
npm run watch        # Build and watch for extension reloads

# Build
npm run build        # TypeScript check + production build to dist/
npx vite build       # Regenerate dist after changes (Chrome load)

# Testing
npm test             # Run all tests once (no watch)
npm run test:watch   # Watch mode for local development
npm run test:coverage # Run tests with coverage report
npm run test:ui      # Run tests in UI mode

# Linting and Formatting
npm run lint         # ESLint check
npm run format       # Prettier formatting
npm run format:check # Check formatting without changing files
npm run typecheck    # TypeScript noEmit verification

# Loading Extension
# After build: Chrome → chrome://extensions → Developer mode → Load unpacked → select dist/
```

## Architecture Overview

This is a privacy-focused browser extension for AI chat using BYOK (Bring Your Own Keys). The architecture follows a modular, service-oriented design with clear separation between core business logic, UI, and browser extension infrastructure.

### High-Level Data Flow

1. **API Keys**: Settings UI → Chrome Storage (encrypted) → Provider Manager → Active Provider
2. **Chat Flow**: User Input → Message Handler → Provider Request → Transport Layer → AI API → Stream Processor → UI
3. **Tab Extraction**: @ Mention → Background Service → Content Scripts → Markdown Converter → Chat Context
4. **Session Management**: Tab+URL based sessions, memory-only storage, automatic cleanup on tab close

### Key Architectural Components

#### Core Module (`src/core/`)

- **ai/**: Stateless provider protocol helpers (request builders, stream processors, error mappers)
- **engine/**: Stateful provider classes implementing common interface, using ai/ helpers
- **extraction/**: HTML to Markdown conversion and content analysis

#### Transport Layer (`src/transport/`)

- **DirectFetchTransport**: Standard fetch for CORS-enabled providers
- **BackgroundProxyTransport**: Proxy through service worker for CORS-restricted providers
- Transport policy in `@transport/policy` determines routing

#### Services Layer (`src/services/`)

- **ChatService**: Orchestrates AI conversations
- **ExtractionService**: Manages web content extraction
- **EngineManagerService**: Provider lifecycle and selection
- **KeyService**: API key storage and validation
- **SessionService**: Chat session management

#### Extension Infrastructure (`src/extension/`)

- **background/**: Service worker, message routing, keep-alive
- **messaging/**: Type-safe message passing system
- **cache/**: LRU content cache with TTL
- **queue/**: Extraction request queue management

#### UI Components (`src/sidebar/`)

- React 18 with Shadow DOM isolation
- Zustand stores for state management
- Component-based architecture with layered CSS
- Virtual scrolling for performance

### Provider Implementation

Currently supports:

- OpenAI (GPT-5 series with Response API)
- Google Gemini (2.5 models)
- OpenRouter (multi-provider gateway)
- OpenAI-Compatible (Kimi, Moonshot, custom endpoints)

Adding a new provider:

1. Add core logic in `src/core/ai/[provider]/`
2. Create engine in `src/core/engine/[provider]/`
3. Register in `EngineFactory`
4. Update transport policy if CORS-restricted
5. Add model definitions in `src/config/models.ts`

### TypeScript Path Aliases

```typescript
@/*           → src/*
@core/*       → src/core/*
@engine/*     → src/core/engine/*
@transport/*  → src/transport/*
@services/*   → src/services/*
@sidebar/*    → src/sidebar/*
@components/* → src/sidebar/components/*
@hooks/*      → src/sidebar/hooks/*
@extension/*  → src/extension/*
@data/*       → src/data/*
@store/*      → src/data/store/*
@config/*     → src/config/*
@types/*      → src/types/*
```

## Code Conventions

- **TypeScript**: Strict mode enabled with all strict checks
- **React**: Function components with hooks only
- **Formatting**: 2-space indent, single quotes, semicolons (Prettier)
- **File Naming**: PascalCase.tsx for components, camelCase.ts for modules
- **Testing**: Vitest + React Testing Library, >90% coverage target
- **Commits**: Conventional commits format: `type(scope): description`

## Security Considerations

- API keys are encrypted at rest using AES-GCM
- All keys stored locally, never transmitted to extension servers
- BYOK model: users control their API keys
- Session data is memory-only, cleared on tab close
- Shadow DOM isolation for UI components
- Minimal Chrome permissions requested

## Performance Guidelines

- Use virtual scrolling for long message lists (react-window)
- Content extraction cached with 5-minute TTL
- LRU cache with 10MB memory limit
- Debounced state updates (500ms)
- Service worker keep-alive for long operations
- Target metrics: <50ms render, <100ms interactions

## Testing Strategy

```bash
# Run specific test file
npm test -- tests/unit/core/extraction/markdownConverter.test.ts

# Test locations mirror src/ structure
tests/
├── unit/         # Unit tests
├── integration/  # Integration tests
└── e2e/          # End-to-end tests
```

## Common Development Tasks

### Working with Content Extraction

- Extraction logic in `src/core/extraction/`
- Content scripts in `src/content/`
- Use Defuddle for DOM cleaning
- Markdown conversion preserves structure

### Modifying AI Providers

- Protocol logic in `src/core/ai/[provider]/`
- Engine wrapper in `src/core/engine/[provider]/`
- Update `EngineFactory` for registration
- Add transport policy if CORS-restricted

### UI Development

- Components in `src/sidebar/components/`
- Hooks in `src/sidebar/hooks/`
- Styles in `src/sidebar/styles/` (layered CSS architecture)
- State in Zustand stores (`src/data/store/`)

### Message Passing

- Type-safe messages in `src/types/messages.ts`
- Message handler in `src/extension/background/messageHandler.ts`
- Use MessageBus for communication

## Browser Compatibility

Chromium-based browsers only (Chrome, Edge, Arc, Brave)

- Manifest V3
- Chrome 88+ required
- Service worker support required
