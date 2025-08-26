# Repository Guidelines

## Project Overview

AI Browser Sidebar Extension - A privacy-focused browser extension with full AI chat capabilities using your own API keys (BYOK). Features a custom Shadow DOM sidebar with streaming responses, thinking display, and multi-provider support.

## Project Structure & Module Organization

```
src/
├── extension/          # Chrome extension infrastructure
│   ├── background/     # Service worker (message handling, tab state)
│   └── messaging/      # Type-safe message passing
├── tabext/            # Content script for sidebar injection
├── sidebar/           # React UI with Shadow DOM
│   ├── ChatPanel.tsx  # Main chat interface with AI integration
│   ├── components/    # UI components (MessageBubble, ThinkingWrapper, etc.)
│   ├── hooks/ai/      # AI chat hooks (useAIChat, useStreamHandler)
│   └── styles/        # Component-specific CSS modules
├── provider/          # AI provider implementations ✅ COMPLETE
│   ├── openai/        # OpenAI GPT-5 series with Response API
│   └── gemini/        # Google Gemini 2.5 with thinking modes
├── data/              # Data management layer
│   ├── store/         # Zustand state (chat, settings)
│   ├── storage/       # Chrome storage + API key management
│   └── security/      # AES-GCM encryption
├── config/            # Centralized configuration
│   └── models.ts      # AI model definitions (single source of truth)
└── types/             # TypeScript definitions
```

## Current Implementation Status

### ✅ Completed Features

- **Extension Infrastructure**: Custom sidebar, message passing, cross-browser support
- **Chat UI**: Full React suite with markdown, virtualization, thinking display
- **Storage & Security**: Encrypted API key storage, Chrome storage integration
- **AI Providers**: OpenAI GPT-5 and Google Gemini 2.5 fully integrated

### 🚧 In Progress

- **Content Extraction**: Tab content capture and multi-tab aggregation (Stage 5)

## AI Provider Details

### OpenAI GPT-5 Series

- **Models**: `gpt-5-nano`, `gpt-5-mini`, `gpt-5`
- **Features**: Response API, reasoning effort levels (minimal/low/medium/high)
- **Streaming**: Full support with thinking display
- **Web Search**: Automatic integration

### Google Gemini 2.5 Series

- **Models**: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
- **Features**: Thinking budget modes (0=off, -1=dynamic)
- **Streaming**: JSON stream parsing with paragraph-level chunks
- **Web Search**: Google Search grounding

## Build, Test, and Development Commands

```bash
# Development
npm run dev          # Start Vite dev server with hot reload
npm run build        # TypeScript check + production build
npm run watch        # Build and watch for changes
npx vite build      # Quick rebuild for extension reload

# Testing
npm test            # Run all tests once
npm run test:watch  # Watch mode for development
npm run test:ui     # Vitest UI for interactive testing
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint        # ESLint with TypeScript rules
npm run format      # Prettier format all files
npm run typecheck   # TypeScript type checking only
```

## Loading the Extension

1. Run `npm run build` to generate the `dist/` folder
2. Open Chrome/Arc/Edge and navigate to `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the `dist/` folder
5. Click the extension icon to toggle the sidebar

## Coding Style & Naming Conventions

- **TypeScript**: Strict mode enabled, comprehensive type definitions
- **React**: Function components with hooks, no class components
- **Formatting**: 2-space indentation, single quotes, semicolons (Prettier enforced)
- **File Names**:
  - `PascalCase.tsx` for React components
  - `camelCase.ts` for utilities, hooks, and modules
- **Path Aliases**: Use configured aliases (@components, @hooks, @provider, etc.)
- **CSS**: Module-based styling with CSS variables for theming

## Testing Guidelines

- **Frameworks**: Vitest + React Testing Library
- **Coverage**: Maintain >90% line and branch coverage
- **Performance**: Tests include benchmarks (<50ms render, <100ms interactions)
- **Accessibility**: WCAG 2.1 AA compliance verification
- **Chrome APIs**: Mocked in `tests/setup/setup.ts`

## Key Technical Decisions

### Custom Sidebar vs Chrome APIs

- Universal compatibility across all Chromium browsers
- Arc browser doesn't support Chrome's sidePanel API
- Better UX control with resize/move capabilities
- Single codebase instead of popup + sidepanel variants

### Recent Architecture Changes

- **Provider Refactor**: Centralized model configs, removed unused parameters
- **UI Simplification**: Removed cn.ts utility, direct string concatenation
- **ThinkingWrapper**: Enhanced state persistence across re-renders
- **Error Handling**: Unified error context with source tracking

## Performance Optimizations

- Sidebar lazy-loads only when triggered
- Message list virtualization for large conversations
- React components use callbacks and refs to prevent re-renders
- Streaming responses with smooth token buffering
- Background script maintains minimal state
- Content script stays lightweight (~2KB)

## Security Considerations

- **API Keys**: Encrypted with AES-GCM before storage
- **Permissions**: Minimal manifest permissions (activeTab, storage)
- **Content Security**: Shadow DOM isolation for sidebar
- **No Cloud Storage**: All data stays local to the browser
- **BYOK Model**: Users control their own API keys

## Commit & Pull Request Guidelines

- **Conventional Commits**: Use format `type(scope): description`
  - Example: `feat(provider): add Gemini thinking display`
  - Types: feat, fix, docs, style, refactor, test, chore
- **PR Requirements**:
  - Clear description with context
  - Tests pass with >90% coverage
  - TypeScript and ESLint checks pass
  - Documentation updated if needed
- **Keep PRs Focused**: Small, single-purpose changes preferred

## Development Workflow

1. **Before Starting**: Review relevant docs in `docs/stages/` and `src/README.md`
2. **Development**: Use `npm run dev` for hot reload development
3. **Testing**: Write tests first (TDD), ensure coverage >90%
4. **Building**: Run `npx vite build` after changes
5. **Loading**: Reload extension in browser to test changes
6. **Committing**: Ensure all checks pass before committing

## Common Issues & Solutions

### Content Script Not Loading

- Check if page URL is restricted (chrome://, file://)
- Verify manifest permissions include the domain
- Content script auto-injects on first sidebar toggle

### AI Provider Errors

- Verify API key is correctly set in settings
- Check provider-specific error messages in console
- Ensure model is available for your API key tier

### Build or Type Errors

- Run `npm run typecheck` to isolate TypeScript issues
- Check that all imports use correct path aliases
- Ensure all dependencies are installed with `npm install`

## Future Roadmap

### Phase 5: Content Extraction (In Progress)

- Tab content capture with Readability
- Multi-tab context aggregation
- Smart content formatting for AI context

### Planned Enhancements

- Include thinking/reasoning in chat history for context
- Advanced prompt templates
- Export conversation history
- Custom model fine-tuning support

---

_Last Updated: 2025-08-26_
_Version: 0.4.0-dev_
