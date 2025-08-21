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
Background Service Worker (src/backend/)
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
- **Background → Content**: `chrome.tabs.sendMessage` with types (typed messages):
  - `TOGGLE_SIDEBAR`
  - `CLOSE_SIDEBAR`
- **Content → Sidebar**: Custom DOM events via `window.dispatchEvent`
- **Sidebar → Background**: `chrome.runtime.sendMessage` for state updates

### State Management

- **Tab-specific state**: Maintained in background script using `Map<tabId, boolean>`
- **Sidebar position/size**: Local React state, resets on close
- **Future persistence**: Chrome storage API (Stage 3)

## Project Structure

```
src/
├── backend/        # Service worker, routing, tab state
│   ├── index.ts              # Background script entry point
│   ├── keepAlive.ts          # Service worker keep-alive
│   ├── messageHandler.ts     # Message routing
│   └── sidebarManager.ts     # Tab state management
├── tabext/         # Content script: sidebar injection + tab content capture
│   └── index.ts              # Content script entry point
├── sidebar/        # Unified React UI with all chat components
│   ├── ChatPanel.tsx         # Main unified chat interface (combines old Sidebar + ChatPanel)
│   ├── index.tsx             # Sidebar mount/unmount functions
│   ├── components/           # All React components
│   │   ├── ChatInput.tsx         # Message input with send functionality
│   │   ├── CodeBlock.tsx         # Syntax highlighted code blocks
│   │   ├── MarkdownRenderer.tsx  # Markdown message rendering
│   │   ├── MessageBubble.tsx     # Individual message display
│   │   ├── MessageList.tsx       # Message list with virtualization
│   │   ├── ModelSelector.tsx     # AI model selection dropdown
│   │   ├── StreamingText.tsx     # Real-time text streaming
│   │   ├── ThemeToggle.tsx       # Light/dark theme switch
│   │   ├── TypingIndicator.tsx   # Typing animation
│   │   ├── index.ts              # Component exports
│   │   └── ui/                   # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── IconButton.tsx
│   │       ├── Input.tsx
│   │       ├── Spinner.tsx
│   │       ├── TextArea.tsx
│   │       └── index.ts
│   ├── contexts/           # React contexts
│   │   ├── ThemeContext.tsx      # Theme state management
│   │   └── index.ts              # Context exports
│   ├── hooks/              # Custom React hooks
│   │   └── useMockChat.ts        # Mock chat functionality
│   └── styles/             # Unified styling
│       └── sidebar.css           # Single CSS file for all sidebar styles
├── core/           # Messaging and shared infra
│   └── messaging.ts              # Chrome extension messaging types
├── store/          # Zustand state management
│   ├── chat.ts                   # Chat state (messages, loading)
│   ├── settings.ts               # App settings (theme, model selection)
│   └── index.ts                  # Store exports
├── provider/       # BYOK + provider clients (future)
├── storage/        # Persistence layer (future)
├── services/       # Backend services (future)
├── types/          # TypeScript definitions
│   ├── chat.ts                   # Chat-related types
│   ├── manifest.ts               # Extension manifest types
│   ├── messages.ts               # Message passing types
│   ├── settings.ts               # Settings types
│   └── index.ts                  # Type exports
├── utils/          # Shared utilities
│   ├── cn.ts                     # Class name utility (tailwind-merge)
│   ├── mockChat.ts               # Mock chat data generation
│   └── theme.ts                  # Theme utilities
└── styles/         # Global styles
    └── variables.css             # CSS custom properties/variables
```

## Development Stages

**Stage 1 ✅**: Extension Infrastructure - Custom sidebar, message passing, cross-browser support
**Stage 2 ✅**: Chat UI - Unified React components, markdown rendering, theme support, model selector
**Stage 3**: Storage & Security - Encrypted API key storage, conversation history
**Stage 4**: AI Providers - OpenAI, Gemini, Anthropic integrations
**Stage 5**: Content Extraction - Web page analysis, multi-tab context

## Refactoring (Task 5 - Completed)

The project underwent a major refactoring in Task 5 to consolidate the sidebar architecture:

### Component Consolidation

- **Unified ChatPanel**: Merged `Sidebar.tsx` and `ChatPanel.tsx` into a single, comprehensive component
- **Centralized Components**: All React components moved to `/src/sidebar/components/`
- **UI Library**: Reusable UI components organized in `/src/sidebar/components/ui/`
- **Model Selection**: Added `ModelSelector.tsx` component for AI model switching

### Style Unification

- **Single CSS File**: Consolidated multiple CSS files into `/src/sidebar/styles/sidebar.css`
- **CSS Variables**: Consistent theming using CSS custom properties from `/src/styles/variables.css`
- **Component Styles**: Individual components include CSS-in-JS with CSS variable integration

### TDD Development Approach

The refactoring followed Test-Driven Development (TDD) methodology:

1. **Red**: Write comprehensive tests first (61 tests across E2E, integration, performance, accessibility)
2. **Green**: Implement minimal code to pass tests
3. **Refactor**: Optimize and clean up while maintaining test coverage >90%

### Path Alias System

Implemented comprehensive path aliases for cleaner, more maintainable imports:

- Shorter import paths (`@components/Button` vs `../../../sidebar/components/Button`)
- Clear module boundaries and organization
- Better IDE support and refactoring capabilities

### Model Selector Feature

Added a new `ModelSelector` component with:

- **Dropdown Interface**: Clean dropdown for selecting AI models (GPT-4, Claude 3, Gemini Pro, etc.)
- **Full Keyboard Navigation**: Arrow keys, Enter, Escape, Tab support
- **Accessibility Compliant**: ARIA attributes, screen reader support
- **Performance Optimized**: <50ms render time, smooth interactions
- **Integration Ready**: Prepared for future AI provider integrations

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
  - `@sidebar/*` → `src/sidebar/*` (sidebar components)
  - `@components/*` → `src/sidebar/components/*` (React components)
  - `@ui/*` → `src/sidebar/components/ui/*` (UI components)
  - `@hooks/*` → `src/sidebar/hooks/*` (custom hooks)
  - `@contexts/*` → `src/sidebar/contexts/*` (React contexts)
  - `@backend/*` → `src/backend/*` (service worker)
  - `@tabext/*` → `src/tabext/*` (content script)
  - `@core/*` → `src/core/*` (messaging)
  - `@store/*` → `src/store/*` (state management)
  - `@types/*` → `src/types/*` (TypeScript definitions)
  - `@utils/*` → `src/utils/*` (utilities)
  - `@provider/*`, `@storage/*`, `@services/*` (future modules)
- **Manifest V3**: Latest extension standards

## Testing Strategy

### Test File Locations

After the Task 5 refactoring, tests are organized by type and complexity:

- **E2E tests**: `tests/e2e/` - Full sidebar lifecycle and user workflows
- **Integration tests**: `tests/integration/` - Component interaction and state management
- **Component tests**: `tests/sidebar/components/` - Individual component testing
- **Performance tests**: `tests/sidebar/performance-*.test.tsx` - Performance benchmarks
- **Accessibility tests**: `tests/sidebar/accessibility-*.test.tsx` - WCAG compliance
- **Store tests**: `tests/store/` - Zustand state management testing

### Test Coverage Requirements

- **Minimum Coverage**: >90% line and branch coverage
- **E2E Coverage**: Complete user workflows from mount to unmount
- **Performance Benchmarks**:
  - Initial render: <50ms
  - User interactions: <100ms
  - Re-renders: <20ms
  - Memory growth: <1MB over 10 cycles
- **Accessibility**: WCAG 2.1 AA compliance verification

### Chrome API Mocking

The test setup (`tests/setup/setup.ts`) provides Chrome API mocks. When testing components that use Chrome APIs, these are automatically available.

### Running Specific Tests

```bash
# Run all tests
npm test                                    # All tests once
npm run test:watch                         # Watch mode
npm run test:ui                            # Vitest UI
npm run test:coverage                      # Coverage report

# Run specific test suites
npm test -- tests/e2e/ --run               # E2E tests
npm test -- tests/integration/ --run       # Integration tests
npm test -- tests/sidebar/performance-*.test.tsx --run # Performance tests
npm test -- tests/sidebar/accessibility-*.test.tsx --run # Accessibility tests

# Run specific test files
npm test -- tests/sidebar/ChatPanel.test.tsx --run
npm test -- tests/sidebar/components/ModelSelector.test.tsx --run
npm test -- --grep "resize" --run          # By test name pattern
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
- React components use callbacks to prevent re-renders
- Background script maintains minimal state
- Content script stays lightweight (~2KB)
