# Source Code Structure

The AI Browser Sidebar Extension source code is organized into distinct modules, each responsible for specific functionality. This modular architecture ensures clean separation of concerns, maintainability, and scalability. The layout groups code by major functions: sidebar (frontend UI), tabext (tab content extraction), provider (AI integration), with shared infrastructure in extension and data modules.

## Project Structure

The codebase follows a modular architecture with clear separation of concerns. Each module has a specific responsibility and communicates through well-defined interfaces.

## Modules

### `/sidebar` - User Interface Layer

**Purpose:** React-based UI for the sidebar, rendered in Shadow DOM to ensure style isolation from host pages.

**Core Components:**
- `ChatPanel.tsx` – Main chat interface with resize/drag functionality, AI integration, and state management
- `index.tsx` – Shadow DOM mount/unmount logic, event handling, and lifecycle management

**Component Library (`components/`):**
- **Chat Components:**
  - `MessageList.tsx` – Virtualized message list supporting thousands of messages with minimal memory footprint
  - `MessageBubble.tsx` – Individual message display with role-based styling and thinking display support
  - `ChatInput.tsx` – Multi-line input with auto-resize, character counter, and keyboard shortcuts
- **AI Features:**
  - `ThinkingWrapper.tsx` – Real-time reasoning display with elapsed time tracking and state persistence
  - `ModelSelector.tsx` – Provider and model selection with dynamic capability indicators
- **Content Display:**
  - `MarkdownRenderer.tsx` – Full GFM markdown support, syntax highlighting, and LaTeX math rendering
  - `ContentExtractionExample.tsx` – Tab content extraction interface and controls
- **UI Library (`ui/`):**
  - Basic components: Button, Input, Select, ScrollArea, Dialog
  - Design system tokens and consistent styling
  - Accessibility-first implementation

**Custom Hooks (`hooks/`):**
- **AI Integration (`ai/`):**
  - `useAIChat.ts` – Main chat logic, message handling, and streaming coordination
  - `useStreamHandler.ts` – Token streaming, buffering, and display optimization
  - `useProviderManager.ts` – Provider switching, capability detection, and fallback handling
- **Utility Hooks:**
  - `useContentExtraction.ts` – Tab content capture and processing
  - `useResizable.ts` – Sidebar resize logic with boundary constraints
  - `useDraggable.ts` – Sidebar repositioning with viewport boundaries

**Styling (`styles/`):**
- Modular CSS with component-specific stylesheets
- CSS variables for theming and consistency
- Responsive design patterns
- Dark mode support preparation

**Context Providers (`contexts/`):**
- `ErrorContext.tsx` – Centralized error handling, reporting, and recovery

### `/tabext` - Content Extraction System

**Purpose:** Content script responsible for extracting, processing, and formatting web page content for AI context.

**Current Implementation:**
- `index.ts` – Content script entry point, message handling, and sidebar injection
- `contentExtractor.ts` – Main extraction engine with quality scoring and filtering
- `extractorLoader.ts` – Dynamic extractor selection based on page type
- `domUtils.ts` – DOM traversal and manipulation utilities

**Extractors (`extractors/`):**
- `comprehensive.ts` – Full page content extraction with structure preservation
- `defuddle.ts` – Specialized extractor for technical documentation
- Additional domain-specific extractors for optimized extraction

**Detectors (`detectors/`):**
- Page type detection (documentation, articles, code repositories)
- Content quality assessment
- Language and encoding detection
- Interactive element identification

**Filters (`filters/`):**
- Noise removal (ads, navigation, footers)
- Content deduplication
- Relevance scoring
- Privacy-sensitive content filtering

**Markdown Conversion (`markdown/`):**
- `markdownConverter.ts` – HTML to Markdown conversion with structure preservation
- Table formatting and preservation
- Code block extraction and language detection
- Link and image handling
- Math equation preservation

**Metrics (`metrics/`):**
- Extraction performance tracking
- User interaction analytics
- Error rate monitoring

**Planned Enhancements:**
- Multi-tab aggregation for context building
- Incremental extraction for dynamic pages
- Visual content extraction (charts, diagrams)
- PDF and document format support
- Selection-based extraction

### `/provider` - AI Provider Integration

**Purpose:** Unified interface for multiple AI providers with BYOK (Bring Your Own Key) architecture.

**Core Architecture:**
- `BaseProvider.ts` – Abstract base class defining provider interface and common functionality
- `ProviderFactory.ts` – Factory pattern for dynamic provider instantiation
- `ProviderRegistry.ts` – Singleton registry for provider discovery and management
- `types.ts` – TypeScript interfaces for provider contracts

**OpenAI Provider (`openai/`):**
- `OpenAIProvider.ts` – Response API implementation with structured outputs
- `streamProcessor.ts` – SSE stream parsing and token handling
- **Supported Models:**
  - GPT-5 Nano: Fast responses, minimal reasoning
  - GPT-5 Mini: Balanced performance and cost
  - GPT-5: Advanced reasoning with configurable effort
- **Features:**
  - Reasoning effort levels (minimal/low/medium/high)
  - Streaming with real-time thinking display
  - Function calling support
  - Vision capabilities for image analysis
  - Structured output with JSON mode

**Gemini Provider (`gemini/`):**
- `GeminiProvider.ts` – Gemini API implementation with advanced features
- `streamProcessor.ts` – JSON stream parsing with chunk reassembly
- **Supported Models:**
  - Gemini 2.5 Flash Lite: Cost-effective, thinking disabled
  - Gemini 2.5 Flash: Balanced with dynamic thinking
  - Gemini 2.5 Pro: Maximum capabilities with automatic thinking
- **Features:**
  - Thinking budget modes (0=disabled, -1=dynamic, N=fixed)
  - Web search grounding for current information
  - Code execution capabilities
  - Multi-modal support (text, images, documents)
  - Safety settings and content filtering

**Common Features:**
- Unified streaming interface with backpressure handling
- Comprehensive error handling and retry logic
- API key validation and health checks
- Token counting and usage tracking
- Request/response logging for debugging
- Provider capability detection
- Graceful fallback mechanisms

### `/extension` - Browser Extension Infrastructure

**Purpose:** Core Chrome extension functionality including service worker, message passing, and browser API integration.

**Background Service Worker (`background/`):**
- `index.ts` – Service worker entry point and lifecycle management
  - Extension installation and update handling
  - Browser action (icon click) handling
  - Context menu integration
  - Alarm scheduling for periodic tasks
- `keepAlive.ts` – Service worker persistence
  - Prevents premature termination during long operations
  - Port-based keep-alive connections
  - Alarm-based backup mechanism
- `messageHandler.ts` – Centralized message routing
  - Type-safe message dispatch
  - Response coordination
  - Error boundary for message handling
  - Cross-context communication
- `sidebarManager.ts` – Sidebar lifecycle management
  - Per-tab state tracking
  - Content script injection
  - State persistence across sessions
  - Tab navigation handling

**Messaging System (`messaging/`):**
- `types.ts` – Message type definitions and contracts
- `sender.ts` – Message sending utilities with retry logic
- `listener.ts` – Message listener registration and management
- `bridge.ts` – Cross-context communication bridge

**Permissions (`permissions/`):**
- Dynamic permission requests
- Permission state monitoring
- Fallback behavior for denied permissions
- User consent management

**Features:**
- Manifest V3 compliance
- Cross-browser compatibility (Chrome, Edge, Arc, Brave)
- Efficient resource management
- Graceful degradation
- Debug logging system

### `/data` - Data Management Layer

**Purpose:** Centralized data management with state stores, persistence, and security.

**State Management (`store/`):**
- `chat.ts` – Chat conversation state
  - Message history with pagination
  - Streaming message updates
  - Conversation branching support
  - Context window management
  - Optimistic updates
- `settings.ts` – Application settings
  - User preferences
  - Model selection and configuration
  - UI customization options
  - Feature flags
  - Keyboard shortcuts
- `extraction.ts` – Content extraction state
  - Extracted content cache
  - Tab selection state
  - Extraction history

**Storage Layer (`storage/`):**
- `chrome.ts` – Chrome Storage API abstraction
  - Local and sync storage support
  - Migration utilities
  - Quota management
  - Change listeners
- **API Key Management (`keys/`):**
  - `manager.ts` – Comprehensive key lifecycle management
  - `validator.ts` – API key validation and health checks
  - `rotator.ts` – Automatic key rotation policies
  - `usage.ts` – Usage tracking and quotas
  - `import-export.ts` – Secure key backup and restore
  - Features:
    - Multi-provider key support
    - Encrypted storage with user passphrase
    - Key expiration monitoring
    - Usage analytics and limits
    - Bulk operations

**Security (`security/`):**
- `crypto.ts` – Encryption utilities
  - AES-GCM for symmetric encryption
  - PBKDF2 for key derivation
  - Secure random generation
  - Constant-time comparisons
- `masking.ts` – Sensitive data protection
  - API key masking for display
  - PII detection and redaction
  - Secure clipboard operations
- `validation.ts` – Input sanitization
  - XSS prevention
  - SQL injection protection
  - Path traversal prevention

### `/types` - Type Definitions

**Purpose:** Centralized TypeScript type definitions ensuring type safety across the application.

**Core Types:**
- `messages.ts` – Extension message contracts
  - Message payloads and responses
  - Event types and handlers
  - Error structures
- `settings.ts` – Configuration interfaces
  - User preferences
  - Model configurations
  - Feature flags
- `providers.ts` – AI provider contracts
  - Provider capabilities
  - Request/response formats
  - Streaming interfaces
- `chat.ts` – Chat domain types
  - Message structures
  - Conversation models
  - Role definitions
- `extraction.ts` – Content extraction types
  - Extracted content formats
  - Filter configurations
- `apiKeys.ts` – Key management types
  - Key metadata
  - Usage statistics
  - Validation results

**Utility Types:**
- Common generic types
- Helper type utilities
- Type guards and predicates
- Branded types for type safety

## Module Dependencies

**Architecture Flow:**

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

**Key Relationships:**
- **Extension → TabExt → Sidebar:** Message flow for content extraction and UI updates
- **Sidebar → Provider:** Direct AI provider calls with streaming responses
- **Data Layer:** Shared by all modules for state, storage, and security
- **Types:** Enforces contracts between all module boundaries

## Development Guidelines

### Architecture Principles

1. **Module Separation**: 
   - UI logic stays in `/sidebar`
   - Content extraction isolated in `/tabext`
   - Extension infrastructure in `/extension`
   - No cross-module imports except through defined interfaces

2. **Type Safety**:
   - Strict TypeScript mode enabled
   - All APIs have explicit type contracts
   - Runtime validation for external data
   - Type guards for message passing

3. **Testing Strategy**:
   - Unit tests for individual functions
   - Integration tests for module interactions
   - E2E tests for critical user flows
   - Performance benchmarks for streaming and extraction
   - Minimum 80% code coverage

4. **Message Passing**:
   - All cross-context communication via typed messages
   - Centralized message definitions in `extension/messaging`
   - Request-response patterns with timeouts
   - Error propagation across boundaries

5. **State Management**:
   - Zustand for React component state
   - Chrome storage for persistent data
   - Optimistic updates for better UX
   - State synchronization across tabs

6. **Security Best Practices**:
   - API keys encrypted at rest
   - No secrets in code or logs
   - Input sanitization at boundaries
   - CSP enforcement in manifest
   - Regular security audits

### Code Style

- **Naming Conventions:**
  - Components: PascalCase
  - Hooks: camelCase with 'use' prefix
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case for utilities, PascalCase for components

- **File Organization:**
  - One component per file
  - Collocate tests with source
  - Group related functionality
  - Clear export patterns

- **Performance:**
  - Lazy load heavy components
  - Memoize expensive computations
  - Virtual scrolling for lists
  - Debounce user inputs
  - Profile and optimize hot paths

## Import Aliases

**Path Resolution Configuration:**

Configured in `vite.config.ts` and `tsconfig.json` for consistent imports:

**Core Modules:**
- `@/` – Root source directory (`src/`)
- `@extension` – Extension infrastructure (`src/extension`)
- `@tabext` – Content extraction (`src/tabext`)
- `@provider` – AI providers (`src/provider`)
- `@types` – Type definitions (`src/types`)

**UI Layer:**
- `@sidebar` – Sidebar root (`src/sidebar`)
- `@components` – React components (`src/sidebar/components`)
- `@ui` – UI library (`src/sidebar/components/ui`)
- `@hooks` – Custom hooks (`src/sidebar/hooks`)
- `@contexts` – React contexts (`src/sidebar/contexts`)

**Data Layer:**
- `@data` – Data management (`src/data`)
- `@store` – State stores (`src/data/store`)
- `@storage` – Persistence (`src/data/storage`)
- `@security` – Security utilities (`src/data/security`)

**Benefits:**
- Shorter, cleaner imports
- Easy refactoring
- Clear module boundaries
- Better IDE support

## Current Implementation Status

### ✅ Completed Features

#### Stage 1: Extension Infrastructure
- Custom sidebar with resize/drag functionality
- Shadow DOM isolation for style encapsulation
- Cross-browser support (Chrome, Edge, Arc, Brave)
- Efficient message passing system
- Service worker with keep-alive mechanism

#### Stage 2: Chat Interface
- Full React component suite
- Markdown rendering with syntax highlighting
- LaTeX math support via KaTeX
- Message virtualization for performance
- Real-time streaming display
- Character counter and input validation

#### Stage 3: AI Provider Integration
- **OpenAI GPT-5 Series:**
  - Response API with reasoning levels
  - Streaming with token buffering
  - Thinking display integration
- **Gemini 2.5 Series:**
  - Dynamic thinking budgets
  - Web search grounding
  - Safety settings

#### Stage 4: Data Management
- Encrypted API key storage (AES-GCM)
- Chrome storage API integration
- Zustand state management
- Settings persistence
- Usage tracking

#### Stage 5: Content Extraction (Partial)
- Basic DOM extraction
- Markdown conversion
- Quality scoring
- Noise filtering

### 🚧 In Progress

#### High Priority
- **Enhanced Content Extraction:**
  - Readability algorithm integration
  - Code block detection
  - Table preservation
  - Image extraction
- **Multi-Tab Context:**
  - Tab selection UI
  - Parallel extraction
  - Content aggregation
  - Deduplication

#### Medium Priority
- **Provider Enhancements:**
  - Function calling support
  - Vision capabilities
  - File upload handling
  - Custom instructions
- **UI Improvements:**
  - Dark mode theme
  - Custom shortcuts
  - Export functionality
  - Search in conversations

### 📅 Roadmap

#### Q1 2025
- Complete content extraction system
- Multi-tab context support
- Enhanced provider capabilities
- Performance optimizations

#### Q2 2025
- Conversation branching
- Plugin system
- Advanced search
- Collaboration features

### Recent Updates (Last 30 Days)

- **2024-12-27:** ThinkingWrapper with persistent timer state
- **2024-12-26:** Provider configuration simplification
- **2024-12-25:** Message component layout improvements
- **2024-12-24:** Removed cn.ts utility for cleaner code
- **2024-12-23:** Unified error handling context
- **2024-12-22:** Content extraction architecture design
- **2024-12-21:** Streaming optimization for large responses

## Testing

### Test Coverage

- **Unit Tests:** 85% coverage
- **Integration Tests:** Key workflows covered
- **E2E Tests:** Critical user paths
- **Performance Tests:** Streaming, extraction, rendering

### Running Tests

```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run test:e2e           # E2E tests only
```

## Performance Metrics

### Current Benchmarks

- **Initial Load:** <100ms
- **Sidebar Toggle:** <50ms
- **Message Rendering:** <20ms per message
- **Streaming Display:** 60fps smooth scrolling
- **Content Extraction:** <500ms for average page
- **Memory Usage:** <50MB baseline

### Optimization Targets

- Reduce initial bundle size by 20%
- Improve extraction speed by 40%
- Lower memory footprint for long conversations
- Enhance streaming performance for slow connections

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Ensure all tests pass
6. Submit a pull request

### Development Workflow

1. **Setup:** `npm install`
2. **Development:** `npm run dev`
3. **Testing:** `npm test`
4. **Building:** `npm run build`
5. **Linting:** `npm run lint`

### Contribution Guidelines

- Follow existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation
- Keep PRs focused and small

## License

MIT License - See LICENSE file for details
