# Source Code Structure

The AI Browser Sidebar Extension source code is organized into distinct modules, each responsible for specific functionality. This modular architecture ensures clean separation of concerns, maintainability, and scalability.

## Project Structure

```
src/
├── config/                 # Configuration and constants
│   ├── models.ts          # AI model definitions
│   └── systemPrompt.ts    # System prompts for AI
├── data/                  # Data management layer
│   ├── security/          # Encryption and security
│   ├── storage/           # Chrome storage abstraction
│   └── store/             # Zustand state management
├── extension/             # Browser extension infrastructure
│   ├── background/        # Service worker components
│   └── messaging/         # Message passing system
├── provider/              # AI provider integrations
│   ├── gemini/            # Google Gemini implementation
│   └── openai/            # OpenAI GPT implementation
├── shared/                # Shared utilities
│   └── utils/             # Common utility functions
├── sidebar/               # React sidebar UI
│   ├── components/        # React components library
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom React hooks
│   └── styles/            # CSS architecture
├── tabext/                # Content extraction system
│   ├── core/              # Core functionality
│   ├── extraction/        # Content extraction logic
│   └── utils/             # Extraction utilities
└── types/                 # TypeScript definitions
```

## Module Overview

### `/sidebar` - User Interface Layer

React-based UI rendered in Shadow DOM for style isolation.

**Key Files:**

- `ChatPanel.tsx` - Main chat interface
- `index.tsx` - Shadow DOM mount/unmount logic

**Components (`components/`):**

- Chat components (MessageList, MessageBubble, ChatInput)
- AI features (ThinkingWrapper, ModelSelector)
- Content display (MarkdownRenderer, ContentPreview, TabContentItem)
- Layout components (Header, Footer, Body, ResizeHandles)
- UI library (Alert, Collapsible, CopyButton, Dropdown, Icons, Spinner)

**Hooks (`hooks/`):**

- AI integration (`ai/` - useAIChat, useStreamHandler, useProviderManager)
- Utility hooks (useContentExtraction, useDragPosition, useResize, useTabMention)

**Styles (`styles/`):**

- Layered CSS architecture (foundation → base → layout → components → features)
- Component-specific stylesheets
- CSS variables for theming

### `/tabext` - Content Extraction System

Content script for extracting and processing web page content.

**Structure:**

- `index.ts` - Content script entry point
- `core/` - Core functionality (documentPatcher, messageHandler, sidebarController)
- `extraction/` - Extraction logic (analyzers, converters, extractors, orchestrator)
- `utils/` - DOM and text utilities

**Extractors:**

- `raw.ts` - Basic HTML extraction
- `defuddle.ts` - Specialized extraction for technical docs

### `/provider` - AI Provider Integration

Unified interface for multiple AI providers with BYOK architecture.

**Core:**

- `BaseProvider.ts` - Abstract base class
- `ProviderFactory.ts` - Factory pattern implementation
- `ProviderRegistry.ts` - Singleton registry

**OpenAI (`openai/`):**

- GPT-5 series support (nano, mini, standard)
- Streaming with thinking display
- Response API implementation

**Gemini (`gemini/`):**

- Gemini 2.5 series (flash-lite, flash, pro)
- Dynamic thinking budgets
- Web search grounding support

### `/extension` - Browser Extension Infrastructure

Core Chrome extension functionality.

**Background (`background/`):**

- `index.ts` - Service worker entry
- `keepAlive.ts` - Service worker persistence
- `messageHandler.ts` - Message routing
- `sidebarManager.ts` - Sidebar lifecycle
- `tabManager.ts` - Tab state management
- `cache/` - Tab content caching
- `queue/` - Extraction queue management

**Messaging (`messaging/`):**

- Type-safe message passing
- Cross-context communication

### `/data` - Data Management Layer

Centralized data management with state, persistence, and security.

**Store (`store/`):**

Hierarchical delegation pattern with specialized stores:

```
SessionStore (Master - holds all session data in memory)
    ├── MessageStore (delegates to active session)
    ├── TabStore (delegates to active session)
    └── UIStore (delegates to active session)
```

- `chat.ts` - Exports for all chat-related stores
- `stores/sessionStore.ts` - Master store for session management
- `stores/messageStore.ts` - Message CRUD operations (delegated)
- `stores/tabStore.ts` - Tab content state (delegated)
- `stores/uiStore.ts` - UI state management (delegated)
- `settings.ts` - Application settings with persistence
- `utils/chatHelpers.ts` - Session key generation and helpers

**Session Management:**

- **Session Keys**: `tab_${tabId}:${normalizedUrl}` format
- **URL Normalization**: Includes query params, excludes hash fragments
- **Memory-only**: No persistence, sessions lost on restart
- **Clearing Strategies**:
  - `clearCurrentSession()` - Resets data but keeps session key
  - `clearSession(key)` - Removes specific session entirely
  - `clearTabSessions(tabId)` - Removes all tab sessions (on tab close)

**Storage (`storage/`):**

- `chrome.ts` - Chrome Storage API wrapper
- `keys.ts` - API key management entry
- `keys/` - Comprehensive key management system

**Security (`security/`):**

- `crypto.ts` - AES-GCM encryption
- `masking.ts` - Sensitive data protection
- `index.ts` - Security exports

### `/config` - Configuration

Application-wide configuration and constants.

- `models.ts` - AI model definitions and capabilities
- `systemPrompt.ts` - System prompts for AI interactions

### `/shared` - Shared Utilities

Common utilities used across modules.

- `utils/restrictedUrls.ts` - URL restriction checks

### `/types` - Type Definitions

Centralized TypeScript type definitions.

- `apiKeys.ts` - API key types
- `chat.ts` - Chat domain types
- `conversation.ts` - Conversation models
- `extraction.ts` - Content extraction types
- `messages.ts` - Extension message contracts
- `providers.ts` - AI provider contracts
- `settings.ts` - Configuration interfaces
- `storage.ts` - Storage types
- `tabs.ts` - Tab-related types
- `manifest.ts` - Manifest types

## Architecture Flow

```
User Interaction
       ↓
Extension Icon Click
       ↓
Background Service Worker (extension/background)
       ↓
Content Script (tabext) ←→ Sidebar UI (sidebar)
       ↓                        ↓
Tab Content Extraction    AI Chat Interface
       ↓                        ↓
Markdown Conversion       Provider Integration
                               ↓
                        AI Response Stream
```

## Development Guidelines

### Module Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Type Safety**: Strict TypeScript with explicit contracts
3. **Testing**: Minimum 80% coverage with unit, integration, and E2E tests
4. **Performance**: Lazy loading, memoization, virtual scrolling
5. **Security**: Encrypted storage, input sanitization, CSP enforcement

### Import Aliases

Configured in `vite.config.ts` and `tsconfig.json`:

- `@/*` → `src/*`
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

## Current Status

### ✅ Completed

- Extension infrastructure with custom sidebar
- Full React component suite with Shadow DOM
- OpenAI and Gemini provider integration
- Encrypted API key storage
- Basic content extraction with markdown conversion
- Streaming chat with thinking display
- Multi-tab content aggregation

### 🚧 In Progress

- Enhanced content extraction algorithms
- Provider capability expansion
- Performance optimizations
- Dark mode theme

### 📅 Roadmap

- Q1 2025: Complete extraction system, advanced search
- Q2 2025: Plugin system, collaboration features

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ui       # Interactive UI
```

## Performance Metrics

- Initial Load: <100ms
- Sidebar Toggle: <50ms
- Message Rendering: <20ms per message
- Content Extraction: <500ms average
- Memory Usage: <50MB baseline

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a focused pull request

## License

MIT License - See LICENSE file for details
