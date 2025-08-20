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
Background Service Worker (src/background/)
    ├─ Tracks sidebar state per tab
    └─ Sends message to content script
        ↓
Content Script (src/content/)
    ├─ Injects sidebar on first click
    └─ Dispatches custom events for toggle
        ↓
Sidebar React App (src/sidebar/)
    ├─ Mounts/unmounts based on events
    └─ Handles all UI interactions
```

### Message Passing Protocol

- **Icon → Background**: Chrome action API
- **Background → Content**: `chrome.tabs.sendMessage` with types:
  - `toggle-sidebar`: Open sidebar
  - `close-sidebar`: Close sidebar
- **Content → Sidebar**: Custom DOM events via `window.dispatchEvent`
- **Sidebar → Background**: `chrome.runtime.sendMessage` for state updates

### State Management

- **Tab-specific state**: Maintained in background script using `Map<tabId, boolean>`
- **Sidebar position/size**: Local React state, resets on close
- **Future persistence**: Chrome storage API (Stage 3)

## Project Structure

```
src/
├── background/     # Service worker, tab state management
├── content/        # Lightweight injection bridge
├── sidebar/        # Main React application
│   ├── Sidebar.tsx # Container with resize/drag logic
│   ├── index.tsx   # Mount/unmount handling
│   ├── components/ # UI components (Stage 2)
│   ├── hooks/      # Custom React hooks
│   └── styles/     # CSS modules
├── providers/      # AI integrations (Stage 4)
├── storage/        # Persistence layer (Stage 3)
├── services/       # Business logic (Stage 5)
├── types/          # TypeScript definitions
└── utils/          # Shared utilities
```

## Development Stages

**Stage 1 ✅**: Extension Infrastructure - Custom sidebar, message passing, cross-browser support
**Stage 2**: Chat UI - React components, markdown rendering, theme support
**Stage 3**: Storage & Security - Encrypted API key storage, conversation history
**Stage 4**: AI Providers - OpenAI, Gemini, Anthropic integrations
**Stage 5**: Content Extraction - Web page analysis, multi-tab context

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
- **Path aliases**: `@sidebar/`, `@components/`, etc. for clean imports
- **Manifest V3**: Latest extension standards

## Testing Strategy

### Test File Locations

- Unit tests: Alongside source files or in `tests/unit/`
- Component tests: In `tests/components/`
- Integration tests: In `tests/integration/`

### Chrome API Mocking

The test setup (`tests/setup/setup.ts`) provides Chrome API mocks. When testing components that use Chrome APIs, these are automatically available.

### Running Specific Tests

```bash
npm test src/sidebar/Sidebar.test.tsx      # Single file
npm test -- --grep "resize"               # By test name pattern
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

Pre-commit hooks via Husky run:

1. ESLint with TypeScript rules
2. Prettier formatting
3. Tests for changed files

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
