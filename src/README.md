# Source Code Structure

The AI Browser Sidebar Extension source code is organized into distinct modules, each responsible for specific functionality. This modular architecture ensures clean separation of concerns, maintainability, and scalability.

## Project Structure

```
src/
├── config/                 # Configuration and constants
│   ├── models.ts          # AI model definitions
│   ├── slashCommands.ts   # Slash command templates (+ optional model override)
│   └── systemPrompt.ts    # System prompts for AI
├── content/               # Content extraction system
│   ├── core/              # Core functionality
│   ├── extraction/        # Content extraction logic
│   ├── types/             # Content-specific types
│   └── utils/             # DOM and text utilities
├── core/                  # Core business logic
│   ├── ai/                # AI provider integrations
│   ├── engine/            # Chat engine implementation
│   └── extraction/        # Extraction orchestration
├── data/                  # Data management layer
│   ├── security/          # Encryption and security
│   ├── storage/           # Chrome storage abstraction
│   └── store/             # Zustand state management
├── extension/             # Browser extension infrastructure
│   ├── background/        # Service worker components
│   └── messaging/         # Message passing system
├── platform/              # Platform-specific implementations
│   └── chrome/            # Chrome API abstractions
├── services/              # Application services
│   ├── chat/              # Chat service implementation
│   ├── engine/            # Engine service wrapper
│   ├── extraction/        # Extraction service
│   ├── keys/              # API key management service
│   └── session/           # Session management service
├── shared/                # Shared utilities
│   └── utils/             # Common utility functions
├── sidebar/               # React sidebar UI
│   ├── components/        # React components library
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── styles/            # CSS architecture
│   └── utils/             # UI-specific utilities
├── transport/             # Communication layer
│   ├── channels/          # Communication channels
│   ├── handlers/          # Message handlers
│   ├── messages/          # Message definitions
│   └── types.ts           # Transport types
└── types/                 # TypeScript definitions
```

## Module Overview

### `/config` - Configuration

Application-wide configuration and constants.

- `models.ts` - AI model definitions and capabilities
- `systemPrompt.ts` - System prompts for AI interactions

### `/content` - Content Extraction System

Content script for extracting and processing web page content.

**Structure:**

- `core/` - Core functionality (documentPatcher, messageHandler, sidebarController)
- `extraction/` - Extraction logic (analyzers, extractors, orchestrator)
- `types/` - Content-specific type definitions
- `utils/` - DOM and text utilities

**Key Components:**

- Page analysis and content extraction
- HTML to Markdown conversion (via `@core/extraction/markdownConverter` in non-RAW modes)
- Multi-tab content aggregation
- Dynamic content handling

### `/core` - Core Business Logic

Central business logic and domain services.

**AI (`ai/`):**

- Provider abstractions and interfaces
- OpenAI GPT-5 series implementation
- Google Gemini 2.5 implementation
- Streaming and thinking display support

**Engine (`engine/`):**

- Chat engine core implementation
- Message handling and streaming
- Session management logic

**Extraction (`extraction/`):**

- High-level extraction orchestration
- Content processing pipelines
- Cache management

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

- Session management with tab-specific contexts
- Memory-only storage (no persistence)
- Settings with Chrome storage persistence

**Storage (`storage/`):**

- Chrome Storage API wrapper
- Key-value storage abstraction
- Settings persistence

**Security (`security/`):**

- AES-GCM encryption for API keys
- Data masking for sensitive information
- Security utilities

### `/extension` - Browser Extension Infrastructure

Core Chrome extension functionality.

**Background (`background/`):**

- Service worker entry point
- Keep-alive mechanism
- Message routing and handling
- Sidebar lifecycle management
- Tab state management
- Content caching system
- Extraction queue management

**Messaging (`messaging/`):**

- Type-safe message passing
- Cross-context communication

### `/platform` - Platform Abstractions

Platform-specific implementations and abstractions.

**Chrome (`chrome/`):**

- Chrome API wrappers
- Browser-specific functionality
- Extension API abstractions

### `/services` - Application Services

High-level service layer providing business operations.

**Chat (`chat/`):**

- Chat service facade
- Message processing
- AI provider integration

**Engine (`engine/`):**

- Engine service wrapper
- Session management
- Stream handling

**Extraction (`extraction/`):**

- Content extraction service
- Batch extraction coordination
- Cache management

**Keys (`keys/`):**

- API key management service
- Secure storage operations
- Key validation

**Session (`session/`):**

- Session lifecycle management
- State persistence
- Context switching

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
- Settings management

**Hooks (`hooks/`):**

- AI integration hooks
- Content extraction hooks
- UI behavior hooks (drag, resize, etc.)
- Tab mention and autocomplete

**Styles (`styles/`):**

- Layered CSS architecture (0-foundation → 1-base → 2-layout → 3-components → 4-features)
- Component-specific stylesheets
- CSS variables for theming
- Minimal use of !important

**Utils (`utils/`):**

- UI helper functions
- DOM utilities
- Style utilities

### `/shared` - Shared Utilities

Common utilities used across modules.

- `utils/restrictedUrls.ts` - URL restriction checks
- Common helper functions

### `/transport` - Communication Layer

Abstracted communication layer for inter-module messaging.

**Structure:**

- `channels/` - Communication channel implementations
- `handlers/` - Message handler implementations
- `messages/` - Message type definitions
- `types.ts` - Transport layer types

**Purpose:**

- Decouples modules from direct Chrome API usage
- Provides type-safe messaging
- Enables testing and mocking

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
- Additional domain-specific types

## Architecture Flow

```
User Interaction
       ↓
Extension Icon Click
       ↓
Background Service Worker (extension/background)
       ↓
Transport Layer (transport/)
       ↓
Content Script (content/) ←→ Sidebar UI (sidebar/)
       ↓                        ↓
Tab Content Extraction    Chat Service (services/chat)
       ↓                        ↓
Core Extraction Logic     Core AI Engine (core/engine)
       ↓                        ↓
Markdown Conversion       AI Providers (core/ai)
                               ↓
                        Response Stream
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
- `@content/*` → `src/content/*`
- `@core/*` → `src/core/*`
- `@data/*` → `src/data/*`
- `@store/*` → `src/data/store/*`
- `@storage/*` → `src/data/storage/*`
- `@security/*` → `src/data/security/*`
- `@platform/*` → `src/platform/*`
- `@services/*` → `src/services/*`
- `@transport/*` → `src/transport/*`
- `@types/*` → `src/types/*`
- `@config/*` → `src/config/*`
- `@shared/*` → `src/shared/*`

## Current Status

### ✅ Completed

- Extension infrastructure with custom sidebar
- Full React component suite with Shadow DOM
- OpenAI and Gemini provider integration
- Encrypted API key storage
- Advanced content extraction with markdown conversion
- Streaming chat with thinking display
- Multi-tab content aggregation
- Modular architecture refactor
- Service layer implementation
- Transport abstraction layer

### 🚧 In Progress

- Performance optimizations
- Dark mode theme
- Enhanced extraction algorithms
- Additional AI provider integrations

### 📅 Roadmap

- Q1 2025: Plugin system, advanced search capabilities
- Q2 2025: Collaboration features, team sharing

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
