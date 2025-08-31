# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Browser Sidebar Extension - A privacy-focused browser extension with a custom injected sidebar that enables users to interact with web content through AI-powered chat using their own API keys (BYOK - Bring Your Own Key).

## Essential Commands

### Development

```bash
npm run dev          # Start Vite dev server with hot reload
npm run build        # TypeScript check + production build
npm run watch        # Build and watch for changes
```

### Testing

```bash
npm test              # Run all tests once (no watch)
npm run test:watch    # Watch mode for development
npm run test:ui       # Open Vitest UI for interactive testing
npm run test:coverage # Generate coverage report
npm test -- path/to/file.test.ts  # Run specific test file
```

### Code Quality

```bash
npm run lint         # ESLint with TypeScript rules
npm run format       # Prettier format all files
npm run typecheck    # TypeScript type checking only
```

### Extension Loading

After `npm run build`, load the `dist` folder as an unpacked extension in Chrome/Arc/Edge at `chrome://extensions/`

### Post-implementation note

After you finish an implementation or fix, run `npx vite build` to regenerate the production `dist/` output before loading or reloading the extension.

## Architecture

### Core Design: Custom Sidebar Approach

The extension uses a **custom injected sidebar** instead of Chrome's native APIs (popup/sidepanel) for universal browser compatibility. The sidebar is:

- Resizable (300-800px width, drag left edge)
- Movable (drag header)
- 85% viewport height, vertically centered
- Toggled by clicking the extension icon

### Component Communication Flow

```
Extension Icon Click
    ↓
Background Service Worker (src/extension/background/)
    ├─ Tracks sidebar state per tab
    └─ Sends message to content script
        ↓
Content Script (src/tabext/)
    ├─ Injects sidebar on first click
    └─ Dispatches custom events for toggle
        ↓
Sidebar React App (src/sidebar/)
    ├─ Mounts/unmounts based on events
    └─ Handles all UI interactions
```

### Message Passing Protocol

- **Icon → Background**: Chrome action API
- **Background → Content**: `chrome.tabs.sendMessage` with typed messages:
  - `TOGGLE_SIDEBAR`
  - `CLOSE_SIDEBAR`
  - `EXTRACT_CONTENT`
  - `CONTENT_READY`
- **Content → Sidebar**: Custom DOM events via `window.dispatchEvent`
- **Sidebar → Background**: `chrome.runtime.sendMessage` for state updates

### State Management

- **Tab-specific state**: Maintained in background script using `Map<tabId, boolean>`
- **Sidebar position/size**: Local React state, resets on close
- **Persistent storage**: Chrome storage API for settings and API keys

## Project Structure

```
src/
├── config/         # Configuration and constants
│   ├── models.ts           # AI model definitions
│   └── systemPrompt.ts     # System prompts for AI
├── data/           # Data management layer
│   ├── security/           # AES-GCM encryption
│   ├── storage/            # Chrome storage wrapper
│   │   └── keys/           # API key management system
│   └── store/              # Zustand state stores
├── extension/      # Chrome extension infrastructure
│   ├── background/         # Service worker
│   │   ├── index.ts        # Background script entry
│   │   ├── keepAlive.ts    # Keep-alive mechanism
│   │   ├── messageHandler.ts # Message routing
│   │   ├── sidebarManager.ts # Sidebar state
│   │   ├── tabManager.ts   # Tab lifecycle
│   │   ├── cache/          # Content caching
│   │   └── queue/          # Extraction queue
│   └── messaging/          # Message utilities
├── provider/       # AI provider implementations
│   ├── BaseProvider.ts     # Abstract base class
│   ├── ProviderFactory.ts  # Factory pattern
│   ├── ProviderRegistry.ts # Singleton registry
│   ├── apiKeyValidation.ts # Key validation
│   ├── errors.ts           # Error handling
│   ├── openai/             # OpenAI GPT-5 series
│   │   ├── OpenAIProvider.ts
│   │   ├── OpenAIClient.ts
│   │   └── streamProcessor.ts
│   └── gemini/             # Google Gemini 2.5
│       ├── GeminiProvider.ts
│       ├── GeminiClient.ts
│       └── streamProcessor.ts
├── shared/         # Shared utilities
│   └── utils/              # Common utilities
├── sidebar/        # React UI with Shadow DOM
│   ├── ChatPanel.tsx       # Main chat interface
│   ├── index.tsx           # Mount/unmount logic
│   ├── components/         # React components
│   │   ├── layout/         # Header, Footer, Body, ResizeHandles
│   │   ├── ui/             # Reusable UI components
│   │   ├── ChatInput.tsx   # Enhanced input
│   │   ├── ContentPreview.tsx # Page content display
│   │   ├── MarkdownRenderer.tsx # Markdown + KaTeX
│   │   ├── MessageBubble.tsx # Message display
│   │   ├── MessageList.tsx # Virtualized list
│   │   ├── ModelSelector.tsx # Model selection
│   │   ├── Settings/       # Settings UI
│   │   ├── TabContentItem.tsx # Tab content display
│   │   ├── TabMentionDropdown.tsx # @ mention UI
│   │   └── ThinkingWrapper.tsx # Reasoning display
│   ├── contexts/           # React contexts
│   │   └── ErrorContext.tsx # Error handling
│   ├── hooks/              # Custom hooks
│   │   ├── ai/             # AI chat hooks
│   │   ├── useContentExtraction.ts
│   │   ├── useMultiTabExtraction.ts
│   │   └── useTabMention.ts
│   └── styles/             # Layered CSS architecture
│       ├── 0-foundation/   # Variables, animations, reset
│       ├── 1-base/         # Base styles, typography
│       ├── 2-layout/       # Layout and structure
│       ├── 3-components/   # Component styles
│       └── 4-features/     # Feature-specific styles
├── tabext/         # Content extraction system
│   ├── index.ts            # Content script entry
│   ├── core/               # Core functionality
│   │   ├── documentPatcher.ts # DOM patches
│   │   ├── messageHandler.ts # Message handling
│   │   └── sidebarController.ts # Sidebar control
│   ├── extraction/         # Extraction pipeline
│   │   ├── orchestrator.ts # Main coordinator
│   │   ├── analyzers/      # Content analysis
│   │   ├── converters/     # Format conversion
│   │   └── extractors/     # Extraction strategies
│   └── utils/              # DOM and text utilities
└── types/          # TypeScript definitions
```

## Development Stages

**Stage 1 ✅**: Extension Infrastructure - Custom sidebar, message passing, cross-browser support
**Stage 2 ✅**: Chat UI - Full React component suite, markdown, virtualization, thinking display
**Stage 3 ✅**: Storage & Security - Encrypted API key storage, Chrome storage integration
**Stage 4 ✅**: AI Providers - OpenAI and Gemini fully integrated with streaming
**Stage 5 ✅**: Content Extraction - Advanced tab content capture with markdown conversion, multi-tab aggregation

## Current AI Models

**OpenAI GPT-5 Series**:

- `gpt-5-nano` - Fast responses with low reasoning effort
- `gpt-5-mini` - Balanced performance
- `gpt-5` - Advanced reasoning with medium effort

**Google Gemini 2.5 Series**:

- `gemini-2.5-flash-lite` - Cost-effective, thinking disabled
- `gemini-2.5-flash` - Balanced, dynamic thinking
- `gemini-2.5-pro` - Advanced with automatic thinking

## Key Technical Decisions

### Why Custom Sidebar Instead of Chrome APIs

- **Arc browser** doesn't support Chrome's sidePanel API
- **Universal compatibility** across all Chromium browsers
- **Better UX control** with resize/move capabilities
- **Single codebase** instead of popup + sidepanel variants

### Content Script Loading

Content scripts are statically defined in manifest.json and load automatically on all pages. The content script:

- Waits for sidebar toggle messages from background
- Injects sidebar HTML/CSS on first activation
- Handles subsequent show/hide toggles efficiently

### Build Configuration

- **Vite + CRXJS**: Modern build with HMR support
- **TypeScript strict mode**: All strict checks enabled
- **Path aliases**: Complete alias system for clean imports:
  - `@/*` → `src/*` (root)
  - `@sidebar/*` → `src/sidebar/*`
  - `@components/*` → `src/sidebar/components/*`
  - `@ui/*` → `src/sidebar/components/ui/*`
  - `@hooks/*` → `src/sidebar/hooks/*`
  - `@contexts/*` → `src/sidebar/contexts/*`
  - `@extension/*` → `src/extension/*`
  - `@tabext/*` → `src/tabext/*`
  - `@provider/*` → `src/provider/*`
  - `@data/*` → `src/data/*`
  - `@store/*` → `src/data/store/*`
  - `@storage/*` → `src/data/storage/*`
  - `@security/*` → `src/data/security/*`
  - `@types/*` → `src/types/*`
  - `@config/*` → `src/config/*`
  - `@shared/*` → `src/shared/*`
- **Manifest V3**: Latest extension standards

## Testing Strategy

### Test File Locations

- **E2E tests**: `tests/e2e/` - Full sidebar lifecycle
- **Integration tests**: `tests/integration/` - Component interaction
- **Component tests**: `tests/sidebar/components/` - Individual components
- **Performance tests**: `tests/sidebar/performance-*.test.tsx`
- **Accessibility tests**: `tests/sidebar/accessibility-*.test.tsx`
- **Store tests**: `tests/store/` - State management

### Test Coverage Requirements

- **Minimum Coverage**: >90% line and branch coverage
- **Performance Benchmarks**:
  - Initial render: <50ms
  - User interactions: <100ms
  - Re-renders: <20ms
  - Memory growth: <1MB over 10 cycles

### Running Tests

```bash
# Run all tests
npm test                    # All tests once
npm run test:watch          # Watch mode
npm run test:ui             # Vitest UI
npm run test:coverage       # Coverage report

# Run specific test suites
npm test -- tests/e2e/ --run
npm test -- tests/integration/ --run
npm test -- tests/sidebar/components/ --run
```

## Common Pitfalls & Solutions

### Content Script Not Loading

- Check if page URL is restricted (chrome://, file://)
- Verify manifest permissions include the domain
- Content script auto-injects on first sidebar toggle

### Sidebar Not Appearing

- Check browser console for errors
- Verify extension has activeTab permission
- Reload the page if installed while page was open

### Build Failures

- Run `npm run typecheck` first to isolate TypeScript issues
- Check that all imports use correct path aliases
- Ensure CSS imports exist in sidebar components

## Browser-Specific Notes

### Arc Browser

- No native sidebar support, custom sidebar works perfectly
- Extension icon in toolbar toggles sidebar
- All resize/move features functional

### Chrome/Edge

- Native sidePanel API available but not used
- Consistent experience with Arc
- DevTools: Inspect service worker for background debugging

## Linting & Formatting

Pre-commit hooks via Husky run lint-staged:

1. ESLint with TypeScript rules
2. Prettier formatting

Manual fixes:

```bash
npm run lint -- --fix   # Auto-fix ESLint issues
npm run format          # Format all files
```

## Performance Considerations

- Sidebar lazy-loads only when triggered
- Message list virtualization for large conversations
- React components use callbacks and refs to prevent re-renders
- Background script maintains minimal state
- Content script optimized with modular loading
- Streaming responses with smooth token buffering
- Content extraction caching (5 min TTL)
- Debounced re-extraction for dynamic content (300-500ms)
- Progressive content loading for large pages

## CSS Development Guidelines

**IMPORTANT**: When creating or modifying CSS files, ALWAYS consult `/src/sidebar/styles/README.md` for:

- CSS architecture and layer system
- Component naming conventions
- Variable namespaces
- Guidelines to avoid `!important`
- File organization structure
- Refactoring best practices

The project uses a layered CSS architecture with minimal `!important` usage. All new CSS should follow these established patterns.

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
