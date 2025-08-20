# AI Browser Sidebar Extension - Task Execution Blueprint

## Project Overview
Building a privacy-focused browser extension that enables AI-powered chat with web content using BYOK (Bring Your Own Key) model. The project follows a UI-first approach with Test-Driven Development (TDD) methodology.

Architecture: The extension uses ONLY a custom injected React sidebar (no popup, no Chrome sidepanel) for universal browser compatibility. The sidebar is resizable (300-800px width), draggable, and injected by the content script. Communication flow: Extension Icon Click → Background Service Worker → Content Script → Sidebar React App.

## Execution Guidelines for Sub-Agents
- **Follow TDD cycle**: Write tests first (RED) → Implement code (GREEN) → Refactor (REFACTOR)
- Each task is self-contained with clear test requirements and deliverables
- Tasks marked with 🔄 can be executed in parallel
- Tasks marked with ⚡ must be executed sequentially
- Tasks marked with 🧪 require test-first development
- Check prerequisites before starting any task
- Create interface contracts for components that will integrate
- Write TypeScript with strict mode enabled
- Use functional React components with hooks
- Implement proper error boundaries and handling

## TDD Strategy
- **Unit Tests**: For all utility functions and business logic (Vitest)
- **Component Tests**: For all React components (React Testing Library)
- **Integration Tests**: For message passing and API interactions
- **E2E Tests**: For critical user journeys (Playwright)

## Progress Tracking
- [x] Stage 1: Extension Infrastructure (15/15 tasks) ✅ COMPLETED
- [ ] Stage 2: Chat Panel UI (0/24 tasks)
- [ ] Stage 3: Storage & Security (0/18 tasks)
- [ ] Stage 4: AI Provider System (0/22 tasks)
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 15/100 tasks**

---

## STAGE 1: EXTENSION INFRASTRUCTURE ✅
Deliverable highlight: Complete custom sidebar infrastructure with resizable (300-800px width) and draggable functionality. Message passing system between background service worker, content script, and React sidebar. Cross-browser compatible architecture using only custom injected UI.

### Phase 1.1: Project Initialization ✅
**Synchronization Point: All tasks must complete before Phase 1.2**

🔄 **Parallelizable Tasks:**

- [x] **Task 1.1.1a** - Initialize NPM Project 🧪
  - Prerequisites: None
  - Tests First:
    - Test that package.json exists and is valid
    - Test that all required scripts are defined
  - Description: Create initial package.json with scripts
  - Deliverables:
    - `package.json` with name, version, scripts
    - `npm run dev` script
    - `npm run build` script
    - `npm run test` script
  - Acceptance: `npm init` completes, scripts are defined

- [x] **Task 1.1.1b** - Setup Vite and CRXJS
  - Prerequisites: Task 1.1.1a
  - Tests First:
    - Test that vite.config.ts exports valid configuration
    - Test that CRXJS plugin is configured
  - Description: Configure Vite for Chrome extension development
  - Deliverables:
    - `vite.config.ts` with CRXJS plugin
    - Development server configuration
    - Build output configuration
  - Acceptance: `npm run dev` starts without errors

- [x] **Task 1.1.1c** - Create Folder Structure
  - Prerequisites: Task 1.1.1a
  - Tests First:
    - Test that all required directories exist
  - Description: Create project directory structure
  - Deliverables:
    - `src/` directory with subdirectories
    - `public/` directory
    - `tests/` directory structure
    - `.gitignore` file
  - Acceptance: All directories created

- [x] **Task 1.1.2a** - TypeScript Configuration 🧪
  - Prerequisites: Task 1.1.1a
  - Tests First:
    - Test that tsconfig.json is valid
    - Test that strict mode is enabled
    - Test path aliases work
  - Description: Configure TypeScript with strict settings
  - Deliverables:
    - `tsconfig.json` with strict mode
    - Path aliases (@components, @utils, etc.)
    - Type checking scripts
  - Acceptance: TypeScript compiles without errors

- [x] **Task 1.1.2b** - ESLint Setup 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test ESLint configuration is valid
    - Test sample files pass linting
  - Description: Configure ESLint for TypeScript
  - Deliverables:
    - `.eslintrc.json` with TypeScript rules
    - React hooks rules
    - Accessibility rules
  - Acceptance: ESLint runs without configuration errors

- [x] **Task 1.1.2c** - Prettier and Pre-commit Hooks
  - Prerequisites: Task 1.1.2b
  - Tests First:
    - Test Prettier formats correctly
    - Test pre-commit hooks trigger
  - Description: Setup code formatting and git hooks
  - Deliverables:
    - `.prettierrc` configuration
    - Husky pre-commit hooks
    - lint-staged configuration
  - Acceptance: Pre-commit hooks format and lint code

- [x] **Task 1.1.3a** - Manifest Schema and Validation 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test manifest.json against Chrome schema
    - Test all required fields present
  - Description: Create manifest with TypeScript types
  - Deliverables:
    - `src/types/manifest.ts` - Type definitions
    - Manifest validation script
  - Acceptance: Manifest passes Chrome validation

- [x] **Task 1.1.3b** - Manifest Implementation
  - Prerequisites: Task 1.1.3a
  - Description: Create actual manifest.json
  - Deliverables:
    - `public/manifest.json` with all permissions
    - Version and metadata
    - Content script registration
  - Acceptance: Extension loads in Chrome

- [x] **Task 1.1.3c** - Icon Assets
  - Prerequisites: Task 1.1.3b
  - Tests First:
    - Test all required icon sizes exist
    - Test icons are valid PNG files
  - Description: Create extension icons
  - Deliverables:
    - Icons in 16x16, 32x32, 48x48, 128x128
    - Icons referenced in manifest
  - Acceptance: Icons display in Chrome

### Phase 1.2: Test Infrastructure ✅
**Synchronization Point: Testing framework must be ready**

⚡ **Sequential Tasks:**

- [x] **Task 1.2.1** - Vitest Configuration 🧪
  - Prerequisites: Task 1.1.2a
  - Description: Setup Vitest for unit testing
  - Deliverables:
    - `vitest.config.ts` configuration
    - Test utilities in `tests/utils/`
    - Coverage configuration
  - Acceptance: `npm run test` executes successfully

- [x] **Task 1.2.2** - React Testing Library Setup 🧪
  - Prerequisites: Task 1.2.1
  - Description: Configure testing for React components
  - Deliverables:
    - Testing library setup
    - Custom render functions
    - Mock providers
  - Acceptance: Can test React components

- [x] **Task 1.2.3** - Chrome API Mocks 🧪
  - Prerequisites: Task 1.2.1
  - Description: Create mocks for Chrome extension APIs
  - Deliverables:
    - `tests/mocks/chrome.ts` - Chrome API mocks
    - Storage mocks
    - Runtime mocks
  - Acceptance: Can test extension-specific code

### Phase 1.3: Core Extension Components ✅
**Synchronization Point: Review after completion**

⚡ **Sequential Tasks:**

- [x] **Task 1.3.1** - Message Types and Protocol 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test message type definitions compile
    - Test message validation functions
  - Description: Define message passing protocol
  - Deliverables:
    - `src/types/messages.ts` - Message types
    - `src/utils/messageValidation.ts` - Validators
    - Message factory functions
  - Acceptance: Type-safe message definitions

- [x] **Task 1.3.2** - Background Service Worker 🧪
  - Prerequisites: Task 1.3.1
  - Tests First:
    - Test service worker initialization
    - Test message handler registration
    - Test sidebar state management
  - Description: Implement background service worker with tab-specific sidebar state
  - Deliverables:
    - `src/background/index.ts` - Worker entry with action listener
    - `src/background/messageHandler.ts` - Message routing
    - `src/background/sidebarManager.ts` - Tab-specific state management
    - `src/background/keepAlive.ts` - Service worker persistence
    - `tests/background/messageHandler.test.ts`
  - Acceptance: Service worker manages sidebar state per tab

- [x] **Task 1.3.3** - Sidebar Integration and Content Script 🧪
  - Prerequisites: Task 1.3.2
  - Tests First:
    - Test sidebar injection and mounting
    - Test resize and drag functionality
    - Test toggle behavior via custom events
  - Description: Implement content script that injects and manages the custom sidebar
  - Deliverables:
    - `src/content/index.ts` - Content script with sidebar injection
    - `src/sidebar/index.tsx` - React app mount/unmount logic
    - `src/sidebar/Sidebar.tsx` - Resizable, draggable sidebar container
    - `src/utils/messaging.ts` - Message utilities
    - `tests/integration/background-content.test.ts`
  - Acceptance: Custom sidebar injects, resizes, drags, and toggles correctly

---

## STAGE 2: CHAT PANEL UI
Building the React-based chat interface within the custom sidebar container. The sidebar foundation (resize, drag, toggle) is complete from Stage 1.

### Phase 2.1: UI Foundation
**Synchronization Point: Design system must be established first**

🔄 **Parallelizable Tasks:**

- [ ] **Task 2.1.1a** - Tailwind Configuration 🧪
  - Prerequisites: Task 1.1.1b
  - Tests First:
    - Test Tailwind config is valid
    - Test custom theme values work
  - Description: Setup Tailwind with custom theme
  - Deliverables:
    - `tailwind.config.js` with theme
    - Custom color palette
    - Typography scale
  - Acceptance: Tailwind classes work

- [ ] **Task 2.1.1b** - CSS Variables and Theme System 🧪
  - Prerequisites: Task 2.1.1a
  - Tests First:
    - Test CSS variables are defined
    - Test theme switching changes variables
  - Description: Create CSS variable system
  - Deliverables:
    - `src/styles/variables.css`
    - Light theme variables
    - Dark theme variables
  - Acceptance: CSS variables apply correctly

- [ ] **Task 2.1.1c** - Base Component Styles
  - Prerequisites: Task 2.1.1b
  - Description: Create base component styles
  - Deliverables:
    - `src/styles/components.css`
    - Button styles
    - Input styles
    - Card styles
  - Acceptance: Base styles render correctly

- [ ] **Task 2.1.2a** - Zustand Store Setup 🧪
  - Prerequisites: Task 1.2.2
  - Tests First:
    - Test store initialization
    - Test state updates
    - Test subscriptions work
  - Description: Configure Zustand stores
  - Deliverables:
    - `src/store/index.ts` - Store setup
    - `tests/store/index.test.ts`
  - Acceptance: Store manages state

- [ ] **Task 2.1.2b** - Chat Store Implementation 🧪
  - Prerequisites: Task 2.1.2a
  - Tests First:
    - Test message addition
    - Test message deletion
    - Test conversation clearing
  - Description: Create chat-specific store
  - Deliverables:
    - `src/store/chat.ts` - Chat state
    - `tests/store/chat.test.ts`
    - Message management actions
  - Acceptance: Chat state updates correctly

- [ ] **Task 2.1.2c** - Settings Store Implementation 🧪
  - Prerequisites: Task 2.1.2a
  - Tests First:
    - Test settings persistence
    - Test default values
    - Test migrations
  - Description: Create settings store
  - Deliverables:
    - `src/store/settings.ts` - Settings state
    - `tests/store/settings.test.ts`
  - Acceptance: Settings persist correctly

### Phase 2.2: Base Components
**Synchronization Point: Base components needed for complex ones**

🔄 **Parallelizable Tasks:**

- [ ] **Task 2.2.1a** - Button Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test button renders
    - Test click handler fires
    - Test disabled state
    - Test loading state
  - Description: Create reusable button component
  - Deliverables:
    - `src/components/ui/Button.tsx`
    - `tests/components/ui/Button.test.tsx`
  - Acceptance: Button works in all states

- [ ] **Task 2.2.1b** - Input Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test input renders
    - Test value changes
    - Test validation
    - Test error states
  - Description: Create input component
  - Deliverables:
    - `src/components/ui/Input.tsx`
    - `tests/components/ui/Input.test.tsx`
  - Acceptance: Input handles all cases

- [ ] **Task 2.2.1c** - Card Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test card renders
    - Test content projection
    - Test hover states
  - Description: Create card container component
  - Deliverables:
    - `src/components/ui/Card.tsx`
    - `tests/components/ui/Card.test.tsx`
  - Acceptance: Card displays content

- [ ] **Task 2.2.1d** - IconButton Component 🧪
  - Prerequisites: Task 2.2.1a
  - Tests First:
    - Test icon renders
    - Test tooltip shows
    - Test sizes work
  - Description: Create icon button component
  - Deliverables:
    - `src/components/ui/IconButton.tsx`
    - `tests/components/ui/IconButton.test.tsx`
  - Acceptance: Icon buttons work

- [ ] **Task 2.2.1e** - Spinner Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test spinner renders
    - Test animation classes
    - Test sizes
  - Description: Create loading spinner
  - Deliverables:
    - `src/components/ui/Spinner.tsx`
    - `tests/components/ui/Spinner.test.tsx`
  - Acceptance: Spinner animates

### Phase 2.3: Chat Components
**Synchronization Point: All components integrate in Phase 2.4**

🔄 **Parallelizable Tasks:**

- [ ] **Task 2.3.1a** - Message Type Definitions 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test type definitions compile
    - Test type guards work
  - Description: Define message types
  - Deliverables:
    - `src/types/chat.ts` - Chat types
    - Type guards for messages
  - Acceptance: Types are comprehensive

- [ ] **Task 2.3.1b** - Message Bubble Component 🧪
  - Prerequisites: Task 2.3.1a, Task 2.2.1c
  - Tests First:
    - Test user message renders
    - Test AI message renders
    - Test timestamp displays
  - Description: Create message bubble
  - Deliverables:
    - `src/components/Chat/MessageBubble.tsx`
    - `tests/components/Chat/MessageBubble.test.tsx`
  - Acceptance: Messages display correctly

- [ ] **Task 2.3.1c** - Markdown Renderer 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test markdown parsing
    - Test code blocks render
    - Test links work
    - Test XSS prevention
  - Description: Integrate react-markdown
  - Deliverables:
    - `src/components/Chat/MarkdownRenderer.tsx`
    - `tests/components/Chat/MarkdownRenderer.test.tsx`
    - Custom renderers
  - Acceptance: Markdown renders safely

- [ ] **Task 2.3.1d** - Code Block Component 🧪
  - Prerequisites: Task 2.3.1c
  - Tests First:
    - Test syntax highlighting
    - Test copy button
    - Test language detection
  - Description: Create code block with highlighting
  - Deliverables:
    - `src/components/Chat/CodeBlock.tsx`
    - `tests/components/Chat/CodeBlock.test.tsx`
  - Acceptance: Code highlights correctly

- [ ] **Task 2.3.2a** - Message List Container 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test message rendering
    - Test scrolling behavior
    - Test empty state
  - Description: Create scrollable message list
  - Deliverables:
    - `src/components/Chat/MessageList.tsx`
    - `tests/components/Chat/MessageList.test.tsx`
  - Acceptance: List scrolls correctly

- [ ] **Task 2.3.2b** - Virtual Scrolling 🧪
  - Prerequisites: Task 2.3.2a
  - Tests First:
    - Test virtualization with 1000+ items
    - Test scroll position preservation
  - Description: Add virtual scrolling for performance
  - Deliverables:
    - Virtual scrolling integration
    - Performance optimizations
  - Acceptance: Handles 1000+ messages smoothly

- [ ] **Task 2.3.3a** - TextArea Component 🧪
  - Prerequisites: Task 2.2.1b
  - Tests First:
    - Test multi-line input
    - Test auto-resize
    - Test max height
  - Description: Create auto-resizing textarea
  - Deliverables:
    - `src/components/ui/TextArea.tsx`
    - `tests/components/ui/TextArea.test.tsx`
  - Acceptance: TextArea resizes properly

- [ ] **Task 2.3.3b** - Chat Input Component 🧪
  - Prerequisites: Task 2.3.3a
  - Tests First:
    - Test message submission
    - Test keyboard shortcuts
    - Test disabled during send
  - Description: Create chat input with controls
  - Deliverables:
    - `src/components/Chat/ChatInput.tsx`
    - `tests/components/Chat/ChatInput.test.tsx`
  - Acceptance: Input handles all interactions

- [ ] **Task 2.3.4a** - Streaming Text Component 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test token-by-token rendering
    - Test cursor animation
    - Test completion detection
  - Description: Create streaming text display
  - Deliverables:
    - `src/components/Chat/StreamingText.tsx`
    - `tests/components/Chat/StreamingText.test.tsx`
  - Acceptance: Smooth streaming display

- [ ] **Task 2.3.4b** - Typing Indicator 🧪
  - Prerequisites: Task 2.2.1e
  - Tests First:
    - Test animation
    - Test show/hide logic
  - Description: Create typing indicator
  - Deliverables:
    - `src/components/Chat/TypingIndicator.tsx`
    - `tests/components/Chat/TypingIndicator.test.tsx`
  - Acceptance: Indicator animates

### Phase 2.4: UI Integration
**Synchronization Point: Complete UI ready for testing**

⚡ **Sequential Tasks:**

- [ ] **Task 2.4.1** - Chat Panel Layout 🧪
  - Prerequisites: All Phase 2.3 tasks
  - Tests First:
    - Test layout structure
    - Test responsive behavior
    - Test component integration
  - Description: Assemble chat components
  - Deliverables:
    - `src/components/Chat/ChatPanel.tsx`
    - `tests/components/Chat/ChatPanel.test.tsx`
    - Header, body, footer sections
  - Acceptance: Complete chat UI works

- [ ] **Task 2.4.2** - Theme Provider 🧪
  - Prerequisites: Task 2.4.1
  - Tests First:
    - Test theme switching
    - Test persistence
    - Test system detection
  - Description: Implement theme context
  - Deliverables:
    - `src/contexts/ThemeContext.tsx`
    - `tests/contexts/ThemeContext.test.tsx`
    - Theme toggle component
  - Acceptance: Themes switch correctly

- [ ] **Task 2.4.3** - Mock Chat System 🧪
  - Prerequisites: Task 2.4.1
  - Tests First:
    - Test mock message generation
    - Test streaming simulation
  - Description: Create mock chat for testing
  - Deliverables:
    - `src/utils/mockChat.ts`
    - `tests/utils/mockChat.test.ts`
    - Mock conversations
  - Acceptance: Can demo full chat flow

---

## STAGE 3: STORAGE & SECURITY

### Phase 3.1: Storage Foundation
**Synchronization Point: Storage layer must be ready before encryption**

🔄 **Parallelizable Tasks:**

- [ ] **Task 3.1.1a** - Storage Types 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test type definitions compile
    - Test serialization works
  - Description: Define storage types
  - Deliverables:
    - `src/types/storage.ts`
    - Serialization utilities
  - Acceptance: Types cover all storage needs

- [ ] **Task 3.1.1b** - Chrome Storage Wrapper 🧪
  - Prerequisites: Task 3.1.1a, Task 1.2.3
  - Tests First:
    - Test get/set operations
    - Test error handling
    - Test migrations
  - Description: Wrap chrome.storage.local
  - Deliverables:
    - `src/storage/chromeStorage.ts`
    - `tests/storage/chromeStorage.test.ts`
  - Acceptance: Storage operations work

- [ ] **Task 3.1.1c** - Storage Migrations 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test migration detection
    - Test migration execution
    - Test rollback
  - Description: Create migration system
  - Deliverables:
    - `src/storage/migrations.ts`
    - `tests/storage/migrations.test.ts`
  - Acceptance: Migrations run correctly

- [ ] **Task 3.1.2a** - IndexedDB Schema 🧪
  - Prerequisites: Task 3.1.1a
  - Tests First:
    - Test database creation
    - Test schema validation
  - Description: Define IndexedDB schema
  - Deliverables:
    - `src/storage/schema.ts`
    - Database version management
  - Acceptance: Schema is comprehensive

- [ ] **Task 3.1.2b** - IndexedDB Wrapper 🧪
  - Prerequisites: Task 3.1.2a
  - Tests First:
    - Test CRUD operations
    - Test transactions
    - Test error recovery
  - Description: Create IndexedDB utilities
  - Deliverables:
    - `src/storage/indexedDB.ts`
    - `tests/storage/indexedDB.test.ts`
  - Acceptance: Database operations work

- [ ] **Task 3.1.2c** - Database Indexes 🧪
  - Prerequisites: Task 3.1.2b
  - Tests First:
    - Test index creation
    - Test query performance
  - Description: Optimize database queries
  - Deliverables:
    - Index definitions
    - Query optimizations
  - Acceptance: Queries are fast

### Phase 3.2: Security Implementation
**Synchronization Point: Encryption must work before key storage**

⚡ **Sequential Tasks:**

- [ ] **Task 3.2.1a** - Crypto Utilities 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test key generation
    - Test encryption/decryption
    - Test different data types
  - Description: Implement Web Crypto API wrapper
  - Deliverables:
    - `src/security/crypto.ts`
    - `tests/security/crypto.test.ts`
  - Acceptance: Encryption works correctly

- [ ] **Task 3.2.1b** - Key Derivation 🧪
  - Prerequisites: Task 3.2.1a
  - Tests First:
    - Test PBKDF2 derivation
    - Test salt generation
    - Test consistent keys
  - Description: Implement key derivation
  - Deliverables:
    - `src/security/keyDerivation.ts`
    - `tests/security/keyDerivation.test.ts`
  - Acceptance: Keys derive consistently

- [ ] **Task 3.2.1c** - Encryption Service 🧪
  - Prerequisites: Task 3.2.1b
  - Tests First:
    - Test service initialization
    - Test bulk operations
    - Test error handling
  - Description: Create encryption service
  - Deliverables:
    - `src/security/encryptionService.ts`
    - `tests/security/encryptionService.test.ts`
  - Acceptance: Service encrypts data

- [ ] **Task 3.2.2a** - API Key Types 🧪
  - Prerequisites: Task 3.2.1c
  - Tests First:
    - Test type definitions
    - Test validation rules
  - Description: Define API key types
  - Deliverables:
    - `src/types/apiKeys.ts`
    - Validation schemas
  - Acceptance: Types are complete

- [ ] **Task 3.2.2b** - API Key Storage 🧪
  - Prerequisites: Task 3.2.2a
  - Tests First:
    - Test encrypted storage
    - Test key retrieval
    - Test key deletion
  - Description: Implement secure key storage
  - Deliverables:
    - `src/storage/apiKeys.ts`
    - `tests/storage/apiKeys.test.ts`
  - Acceptance: Keys stored securely

- [ ] **Task 3.2.2c** - API Key Validation 🧪
  - Prerequisites: Task 3.2.2b
  - Tests First:
    - Test format validation
    - Test provider validation
  - Description: Validate API keys
  - Deliverables:
    - `src/utils/apiKeyValidation.ts`
    - `tests/utils/apiKeyValidation.test.ts`
  - Acceptance: Invalid keys rejected

### Phase 3.3: Data Management
**Synchronization Point: Complete storage system ready**

🔄 **Parallelizable Tasks:**

- [ ] **Task 3.3.1a** - Conversation Types 🧪
  - Prerequisites: Task 3.1.2b
  - Tests First:
    - Test type definitions
    - Test serialization
  - Description: Define conversation types
  - Deliverables:
    - `src/types/conversation.ts`
  - Acceptance: Types are comprehensive

- [ ] **Task 3.3.1b** - Conversation Storage 🧪
  - Prerequisites: Task 3.3.1a
  - Tests First:
    - Test save/load operations
    - Test search functionality
    - Test pagination
  - Description: Implement conversation persistence
  - Deliverables:
    - `src/storage/conversations.ts`
    - `tests/storage/conversations.test.ts`
  - Acceptance: Conversations persist

- [ ] **Task 3.3.2** - Cache Implementation 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test TTL expiration
    - Test size limits
    - Test invalidation
  - Description: Create caching system
  - Deliverables:
    - `src/storage/cache.ts`
    - `tests/storage/cache.test.ts`
  - Acceptance: Cache expires correctly

- [ ] **Task 3.3.3** - Data Cleanup 🧪
  - Prerequisites: Task 3.3.1b, Task 3.3.2
  - Tests First:
    - Test complete cleanup
    - Test selective cleanup
  - Description: Implement data cleanup
  - Deliverables:
    - `src/storage/cleanup.ts`
    - `tests/storage/cleanup.test.ts`
  - Acceptance: Data clears completely

- [ ] **Task 3.3.4a** - Sensitive Pattern Detection 🧪
  - Prerequisites: Task 3.2.1c
  - Tests First:
    - Test SSN detection
    - Test credit card detection
    - Test email detection
  - Description: Create pattern matchers
  - Deliverables:
    - `src/security/patterns.ts`
    - `tests/security/patterns.test.ts`
  - Acceptance: Patterns detected

- [ ] **Task 3.3.4b** - Data Masking 🧪
  - Prerequisites: Task 3.3.4a
  - Tests First:
    - Test masking functions
    - Test unmask with permission
  - Description: Implement data masking
  - Deliverables:
    - `src/security/masking.ts`
    - `tests/security/masking.test.ts`
  - Acceptance: Data masked correctly

---

## STAGE 4: AI PROVIDER SYSTEM

### Phase 4.1: Provider Foundation
**Synchronization Point: Base interface required for all providers**

⚡ **Sequential Tasks:**

- [ ] **Task 4.1.1a** - Provider Types 🧪
  - Prerequisites: Task 3.2.2b
  - Tests First:
    - Test type definitions compile
    - Test type guards work
  - Description: Define provider interfaces
  - Deliverables:
    - `src/types/providers.ts`
    - Response types
    - Error types
  - Acceptance: Types are comprehensive

- [ ] **Task 4.1.1b** - Base Provider Class 🧪
  - Prerequisites: Task 4.1.1a
  - Tests First:
    - Test abstract methods
    - Test shared functionality
  - Description: Create base provider class
  - Deliverables:
    - `src/providers/BaseProvider.ts`
    - `tests/providers/BaseProvider.test.ts`
  - Acceptance: Base class works

- [ ] **Task 4.1.2a** - Stream Parser 🧪
  - Prerequisites: Task 4.1.1a
  - Tests First:
    - Test SSE parsing
    - Test chunk handling
    - Test error detection
  - Description: Create SSE stream parser
  - Deliverables:
    - `src/providers/streamParser.ts`
    - `tests/providers/streamParser.test.ts`
  - Acceptance: Parses SSE correctly

- [ ] **Task 4.1.2b** - Token Buffer 🧪
  - Prerequisites: Task 4.1.2a
  - Tests First:
    - Test buffering logic
    - Test flush behavior
  - Description: Implement token buffering
  - Deliverables:
    - `src/providers/tokenBuffer.ts`
    - `tests/providers/tokenBuffer.test.ts`
  - Acceptance: Buffers tokens correctly

### Phase 4.2: Provider Implementations
**Synchronization Point: All providers ready for integration**

🔄 **Parallelizable Tasks:**

- [ ] **Task 4.2.1a** - OpenAI Client Setup 🧪
  - Prerequisites: Task 4.1.1b
  - Tests First:
    - Test client initialization
    - Test configuration
  - Description: Setup OpenAI SDK
  - Deliverables:
    - OpenAI client configuration
    - Authentication setup
  - Acceptance: Client initializes

- [ ] **Task 4.2.1b** - OpenAI Chat Implementation 🧪
  - Prerequisites: Task 4.2.1a, Task 4.1.2b
  - Tests First:
    - Test chat completion
    - Test streaming
    - Test error handling
  - Description: Implement OpenAI chat
  - Deliverables:
    - `src/providers/openai/OpenAIProvider.ts`
    - `tests/providers/openai/OpenAIProvider.test.ts`
  - Acceptance: OpenAI chat works

- [ ] **Task 4.2.1c** - OpenAI Models Configuration 🧪
  - Prerequisites: Task 4.2.1b
  - Tests First:
    - Test model listing
    - Test model selection
  - Description: Configure OpenAI models
  - Deliverables:
    - Model configurations
    - Model capabilities
  - Acceptance: Models configured

- [ ] **Task 4.2.2a** - Gemini Client Setup 🧪
  - Prerequisites: Task 4.1.1b
  - Tests First:
    - Test client initialization
    - Test authentication
  - Description: Setup Gemini SDK
  - Deliverables:
    - Gemini client configuration
  - Acceptance: Client initializes

- [ ] **Task 4.2.2b** - Gemini Chat Implementation 🧪
  - Prerequisites: Task 4.2.2a, Task 4.1.2b
  - Tests First:
    - Test chat generation
    - Test streaming
    - Test multimodal
  - Description: Implement Gemini chat
  - Deliverables:
    - `src/providers/gemini/GeminiProvider.ts`
    - `tests/providers/gemini/GeminiProvider.test.ts`
  - Acceptance: Gemini chat works

- [ ] **Task 4.2.2c** - Gemini Models Configuration 🧪
  - Prerequisites: Task 4.2.2b
  - Tests First:
    - Test model configuration
    - Test context limits
  - Description: Configure Gemini models
  - Deliverables:
    - Model configurations
  - Acceptance: Models configured

- [ ] **Task 4.2.3a** - OpenRouter Setup 🧪
  - Prerequisites: Task 4.1.1b
  - Tests First:
    - Test endpoint configuration
    - Test authentication
  - Description: Setup OpenRouter client
  - Deliverables:
    - OpenRouter configuration
  - Acceptance: Client connects

- [ ] **Task 4.2.3b** - Anthropic Implementation 🧪
  - Prerequisites: Task 4.2.3a, Task 4.1.2b
  - Tests First:
    - Test Claude chat
    - Test streaming
  - Description: Implement Anthropic via OpenRouter
  - Deliverables:
    - `src/providers/anthropic/AnthropicProvider.ts`
    - `tests/providers/anthropic/AnthropicProvider.test.ts`
  - Acceptance: Claude chat works

### Phase 4.3: Provider Management
**Synchronization Point: Complete AI system ready**

⚡ **Sequential Tasks:**

- [ ] **Task 4.3.1a** - Provider Registry 🧪
  - Prerequisites: All Phase 4.2 tasks
  - Tests First:
    - Test registration
    - Test provider lookup
    - Test switching
  - Description: Create provider registry
  - Deliverables:
    - `src/providers/ProviderRegistry.ts`
    - `tests/providers/ProviderRegistry.test.ts`
  - Acceptance: Registry manages providers

- [ ] **Task 4.3.1b** - Provider Factory 🧪
  - Prerequisites: Task 4.3.1a
  - Tests First:
    - Test provider creation
    - Test configuration
  - Description: Create provider factory
  - Deliverables:
    - `src/providers/ProviderFactory.ts`
    - `tests/providers/ProviderFactory.test.ts`
  - Acceptance: Factory creates providers

- [ ] **Task 4.3.2** - API Key Validation Service 🧪
  - Prerequisites: Task 4.3.1b
  - Tests First:
    - Test validation for each provider
    - Test error messages
  - Description: Validate keys with providers
  - Deliverables:
    - `src/providers/validation.ts`
    - `tests/providers/validation.test.ts`
  - Acceptance: Keys validated

- [ ] **Task 4.3.3a** - Rate Limiter 🧪
  - Prerequisites: Task 4.3.1a
  - Tests First:
    - Test rate limiting
    - Test backoff
    - Test reset
  - Description: Implement rate limiting
  - Deliverables:
    - `src/providers/RateLimiter.ts`
    - `tests/providers/RateLimiter.test.ts`
  - Acceptance: Rate limits enforced

- [ ] **Task 4.3.3b** - Request Queue 🧪
  - Prerequisites: Task 4.3.3a
  - Tests First:
    - Test queueing
    - Test priority
    - Test cancellation
  - Description: Create request queue
  - Deliverables:
    - `src/providers/RequestQueue.ts`
    - `tests/providers/RequestQueue.test.ts`
  - Acceptance: Queue manages requests

- [ ] **Task 4.3.4a** - Provider Settings UI 🧪
  - Prerequisites: Task 4.3.1b, Task 2.4.1
  - Tests First:
    - Test provider selection
    - Test model selection
    - Test configuration save
  - Description: Create provider UI
  - Deliverables:
    - `src/components/Settings/ProviderSettings.tsx`
    - `tests/components/Settings/ProviderSettings.test.tsx`
  - Acceptance: UI configures providers

- [ ] **Task 4.3.4b** - API Key Input UI 🧪
  - Prerequisites: Task 4.3.4a
  - Tests First:
    - Test key input
    - Test validation display
    - Test secure storage
  - Description: Create key input component
  - Deliverables:
    - `src/components/Settings/ApiKeyInput.tsx`
    - `tests/components/Settings/ApiKeyInput.test.tsx`
  - Acceptance: Keys entered securely

- [ ] **Task 4.3.5** - Chat-Provider Integration 🧪
  - Prerequisites: Task 4.3.4b, Task 2.4.3
  - Tests First:
    - Test message sending
    - Test response streaming
    - Test error display
  - Description: Connect chat to providers
  - Deliverables:
    - `src/hooks/useAIChat.ts`
    - `tests/hooks/useAIChat.test.ts`
    - Integration code
  - Acceptance: Full AI chat works

---

## STAGE 5: TAB CONTENT EXTRACTION

### Phase 5.1: Content Script Foundation
**Synchronization Point: Content script infrastructure required first**

⚡ **Sequential Tasks:**

- [ ] **Task 5.1.1a** - Content Script Entry 🧪
  - Prerequisites: Task 1.3.3
  - Tests First:
    - Test script injection
    - Test message handling
  - Description: Create content script entry
  - Deliverables:
    - `src/content/index.ts`
    - `tests/content/index.test.ts`
  - Acceptance: Script loads on pages

- [ ] **Task 5.1.1b** - DOM Access Utilities 🧪
  - Prerequisites: Task 5.1.1a
  - Tests First:
    - Test element selection
    - Test traversal
    - Test safety checks
  - Description: Create DOM utilities
  - Deliverables:
    - `src/content/domUtils.ts`
    - `tests/content/domUtils.test.ts`
  - Acceptance: DOM access works

- [ ] **Task 5.1.1c** - Content Script Messaging 🧪
  - Prerequisites: Task 5.1.1a
  - Tests First:
    - Test message sending
    - Test response handling
  - Description: Setup content script messaging
  - Deliverables:
    - `src/content/messaging.ts`
    - `tests/content/messaging.test.ts`
  - Acceptance: Messages pass correctly

- [ ] **Task 5.1.2a** - Readability Setup 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test Readability import
    - Test configuration
  - Description: Setup Mozilla Readability
  - Deliverables:
    - Readability integration
    - Configuration
  - Acceptance: Readability loads

- [ ] **Task 5.1.2b** - Article Extraction 🧪
  - Prerequisites: Task 5.1.2a
  - Tests First:
    - Test article extraction
    - Test metadata extraction
    - Test fallback
  - Description: Implement article extraction
  - Deliverables:
    - `src/extraction/articleExtractor.ts`
    - `tests/extraction/articleExtractor.test.ts`
  - Acceptance: Articles extracted

- [ ] **Task 5.1.2c** - Extraction Fallbacks 🧪
  - Prerequisites: Task 5.1.2b
  - Tests First:
    - Test fallback strategies
    - Test custom extractors
  - Description: Create extraction fallbacks
  - Deliverables:
    - `src/extraction/fallbacks.ts`
    - `tests/extraction/fallbacks.test.ts`
  - Acceptance: Fallbacks work

### Phase 5.2: Extraction Features
**Synchronization Point: All extraction features ready**

🔄 **Parallelizable Tasks:**

- [ ] **Task 5.2.1a** - Selection Detection 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test selection detection
    - Test range calculation
  - Description: Detect text selection
  - Deliverables:
    - `src/content/selectionDetector.ts`
    - `tests/content/selectionDetector.test.ts`
  - Acceptance: Selection detected

- [ ] **Task 5.2.1b** - Context Markers 🧪
  - Prerequisites: Task 5.2.1a
  - Tests First:
    - Test marker insertion
    - Test marker removal
    - Test preservation
  - Description: Add context markers
  - Deliverables:
    - `src/content/contextMarkers.ts`
    - `tests/content/contextMarkers.test.ts`
  - Acceptance: Markers work correctly

- [ ] **Task 5.2.2a** - Mutation Observer 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test observer setup
    - Test change detection
    - Test debouncing
  - Description: Setup MutationObserver
  - Deliverables:
    - `src/content/mutationObserver.ts`
    - `tests/content/mutationObserver.test.ts`
  - Acceptance: Changes detected

- [ ] **Task 5.2.2b** - Dynamic Content Handler 🧪
  - Prerequisites: Task 5.2.2a
  - Tests First:
    - Test SPA handling
    - Test infinite scroll
    - Test lazy loading
  - Description: Handle dynamic content
  - Deliverables:
    - `src/content/dynamicContent.ts`
    - `tests/content/dynamicContent.test.ts`
  - Acceptance: Dynamic content handled

- [ ] **Task 5.2.3a** - HTML to Markdown 🧪
  - Prerequisites: Task 5.1.2b
  - Tests First:
    - Test conversion
    - Test structure preservation
    - Test special elements
  - Description: Convert HTML to markdown
  - Deliverables:
    - `src/extraction/htmlToMarkdown.ts`
    - `tests/extraction/htmlToMarkdown.test.ts`
  - Acceptance: Clean markdown output

- [ ] **Task 5.2.3b** - Code Block Extraction 🧪
  - Prerequisites: Task 5.2.3a
  - Tests First:
    - Test code detection
    - Test language detection
    - Test formatting
  - Description: Extract code blocks
  - Deliverables:
    - `src/extraction/codeExtractor.ts`
    - `tests/extraction/codeExtractor.test.ts`
  - Acceptance: Code extracted correctly

- [ ] **Task 5.2.3c** - Table Extraction 🧪
  - Prerequisites: Task 5.2.3a
  - Tests First:
    - Test table detection
    - Test markdown tables
  - Description: Extract tables
  - Deliverables:
    - `src/extraction/tableExtractor.ts`
    - `tests/extraction/tableExtractor.test.ts`
  - Acceptance: Tables extracted

- [ ] **Task 5.2.4a** - Tab Manager 🧪
  - Prerequisites: Task 5.1.1c
  - Tests First:
    - Test tab enumeration
    - Test tab filtering
  - Description: Create tab manager
  - Deliverables:
    - `src/extraction/tabManager.ts`
    - `tests/extraction/tabManager.test.ts`
  - Acceptance: Tabs managed

- [ ] **Task 5.2.4b** - Parallel Extraction 🧪
  - Prerequisites: Task 5.2.4a
  - Tests First:
    - Test parallel execution
    - Test progress tracking
    - Test error handling
  - Description: Implement parallel extraction
  - Deliverables:
    - `src/extraction/parallelExtractor.ts`
    - `tests/extraction/parallelExtractor.test.ts`
  - Acceptance: Parallel extraction works

### Phase 5.3: UI Integration
**Synchronization Point: Complete extraction system**

⚡ **Sequential Tasks:**

- [ ] **Task 5.3.1a** - Tab Search Component 🧪
  - Prerequisites: Task 5.2.4a, Task 2.4.1
  - Tests First:
    - Test search functionality
    - Test filtering
    - Test keyboard navigation
  - Description: Create tab search UI
  - Deliverables:
    - `src/components/Chat/TabSearch.tsx`
    - `tests/components/Chat/TabSearch.test.tsx`
  - Acceptance: Tab search works

- [ ] **Task 5.3.1b** - @Mention Handler 🧪
  - Prerequisites: Task 5.3.1a
  - Tests First:
    - Test @ trigger
    - Test selection
    - Test insertion
  - Description: Implement @mention
  - Deliverables:
    - `src/components/Chat/MentionHandler.tsx`
    - `tests/components/Chat/MentionHandler.test.tsx`
  - Acceptance: @mentions work

- [ ] **Task 5.3.2** - Content Preview 🧪
  - Prerequisites: Task 5.3.1b
  - Tests First:
    - Test content display
    - Test truncation
    - Test source attribution
  - Description: Display extracted content
  - Deliverables:
    - `src/components/Chat/ContentPreview.tsx`
    - `tests/components/Chat/ContentPreview.test.tsx`
  - Acceptance: Content displays clearly

- [ ] **Task 5.3.3a** - Context Aggregator 🧪
  - Prerequisites: Task 5.3.2
  - Tests First:
    - Test aggregation
    - Test deduplication
    - Test ordering
  - Description: Aggregate tab content
  - Deliverables:
    - `src/extraction/contextAggregator.ts`
    - `tests/extraction/contextAggregator.test.ts`
  - Acceptance: Context aggregated

- [ ] **Task 5.3.3b** - Token Counter 🧪
  - Prerequisites: Task 5.3.3a
  - Tests First:
    - Test token counting
    - Test truncation
  - Description: Count and manage tokens
  - Deliverables:
    - `src/utils/tokenCounter.ts`
    - `tests/utils/tokenCounter.test.ts`
  - Acceptance: Tokens counted correctly

- [ ] **Task 5.3.4** - Final Integration 🧪
  - Prerequisites: Task 5.3.3b, Task 4.3.5
  - Tests First:
    - Test end-to-end flow
    - Test error handling
    - Test performance
  - Description: Complete integration
  - Deliverables:
    - Final integration code
    - E2E tests
    - Performance optimizations
  - Acceptance: Complete product works

---

## Synchronization Points

### Critical Review Points:
1. **After Stage 1**: Extension loads and all tests pass
2. **After Stage 2**: UI complete with full test coverage
3. **After Stage 3**: Storage layer secure and tested
4. **After Stage 4**: AI providers integrated and tested
5. **After Stage 5**: Complete product with E2E tests passing

### Test Coverage Requirements:
- Unit Tests: > 90% coverage
- Component Tests: All components tested
- Integration Tests: All API boundaries tested
- E2E Tests: Critical user journeys tested

## Risk Mitigation

### Testing Strategy:
1. **Unit Tests First**: Write failing tests before implementation
2. **Mock External Dependencies**: Mock Chrome APIs, AI providers
3. **Component Isolation**: Test components in isolation
4. **Integration Testing**: Test component interactions
5. **E2E Testing**: Test complete user flows

### Potential Blockers:
1. **Chrome API Mocking**: Use chrome-mock library
2. **Async Testing**: Use proper async/await in tests
3. **React Testing**: Use React Testing Library best practices
4. **Provider Testing**: Mock API responses
5. **Content Script Testing**: Use jsdom for DOM testing

## Completion Criteria

### Task Completion:
- [ ] All tests written and passing
- [ ] Code implementation complete
- [ ] Code review passed
- [ ] Documentation updated
- [ ] No linting errors

### Stage Completion:
- [ ] All tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] Performance benchmarks met
- [ ] Accessibility tests pass

### Project Completion:
- [ ] All 100 tasks complete
- [ ] E2E test suite passes
- [ ] Security audit complete
- [ ] Performance metrics met
- [ ] Chrome Web Store ready

---

*Task Blueprint Version: 2.0 (TDD Edition)*  
*Total Tasks: 100*  
*Test-First Tasks: 85 (85%)*  
*Parallelizable: 45 (45%)*  
*Sequential: 55 (55%)*  
*Estimated Parallel Execution Paths: 12*
