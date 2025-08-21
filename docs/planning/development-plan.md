# AI Browser Sidebar Extension - Development Plan

## Project Overview

A privacy-focused browser extension that enables users to interact with web content through AI-powered chat using their own API keys (BYOK - Bring Your Own Key).

## Development Stages

### Stage 1: Extension Infrastructure Foundation ✅

**Goal:** Set up the basic Chrome extension architecture that can load and communicate between components.

**Tasks:**

- [x] Initialize project with Vite + CRXJS
- [x] Configure TypeScript and build pipeline
- [x] Create manifest.json with required permissions
- [x] Implement custom sidebar (resizable/movable)
- [x] Implement background service worker
- [x] Establish message passing between components
- [x] Content script injection system
- [x] Cross-browser compatibility (Chrome, Arc, Edge)

**Deliverables:**

- Extension loads successfully in all Chromium browsers
- Custom sidebar toggles with extension icon
- Sidebar is resizable and movable
- Background service worker manages state
- Messages pass between all components

**Testing:**

- Verify extension installation
- Test sidebar opening/closing
- Test sidebar toggle via extension icon
- Verify message passing works

---

### Stage 2: Chat Panel UI

**Goal:** Build a beautiful, functional chat interface that meets UX requirements before connecting to AI.

**Tasks:**

- [x] Set up React 18 + Tailwind CSS
- [x] Create chat message component
- [x] Implement message list with scrolling
- [x] Build input area with multi-line support
- [x] Add send button with Cmd/Ctrl+Enter shortcut
- [x] Implement message streaming display (mock data)
- [x] Add markdown rendering support
- [x] Implement syntax highlighting for code blocks
- [x] Add copy button for code blocks
- [x] Create theme switcher (light/dark/auto)
- [x] Add loading states and animations
- [x] Implement responsive layout (350-800px width)

**Deliverables:**

- Fully styled chat interface
- Smooth message streaming animation
- Markdown and code rendering
- Theme switching works
- Keyboard shortcuts functional

**Testing:**

- Test with mock conversations
- Verify markdown rendering
- Test theme switching
- Check responsive behavior
- Validate accessibility (keyboard navigation)

---

### Stage 3: Storage & Security Module

**Goal:** Implement secure storage for API keys and conversation history.

**Tasks:**

- [ ] Set up chrome.storage.local for settings
- [ ] Implement IndexedDB for conversation storage
- [ ] Create encryption utilities (AES-256-GCM)
- [ ] Build API key management interface
- [ ] Add key validation on save
- [ ] Implement secure key storage
- [ ] Create settings page UI
- [ ] Add conversation persistence
- [ ] Implement cache management (TTL)
- [ ] Add "Clear all data" functionality
- [ ] Create domain-specific settings storage

**Deliverables:**

- API keys stored securely (encrypted)
- Settings persist across sessions
- Conversations can be saved/loaded
- Cache expires appropriately

**Testing:**

- Test encryption/decryption
- Verify API key storage security
- Test conversation persistence
- Validate cache expiration

---

### Stage 4: AI Provider System

**Goal:** Integrate multiple AI providers with a unified interface, turning the extension into a functional AI chatbot.

**Tasks:**

- [ ] Create provider abstraction interface
- [ ] Implement OpenAI integration
  - [ ] Use Response API format
  - [ ] Handle streaming responses
  - [ ] Add GPT-5, GPT-4.1, o3 models
- [ ] Add Google Gemini integration
  - [ ] Implement Gemini API client
  - [ ] Add Gemini 2.5 Flash Lite, Pro models
- [ ] Add Anthropic via OpenRouter
  - [ ] Configure OpenRouter endpoint
  - [ ] Add Claude models
- [ ] Build provider selection UI
- [ ] Implement model dropdown (cascading)
- [ ] Add streaming response handler
- [ ] Implement error handling and retries
- [ ] Add rate limiting logic
- [ ] Create token counting/estimation
- [ ] Add cost tracking (local only)

**Deliverables:**

- **Working AI chatbot in browser extension**
- Can switch between providers/models
- Streaming responses work smoothly
- Errors handled gracefully
- API keys validated on save

**Testing:**

- Test each provider individually
- Verify streaming works
- Test provider switching mid-conversation
- Validate error handling
- Check rate limiting

---

### Stage 5: Tab Content Extraction

**Goal:** Add the ability to extract and process content from browser tabs, completing the full feature set.

**Tasks:**

- [ ] Create content script architecture
- [ ] Integrate Mozilla Readability
- [ ] Implement single tab extraction
  - [ ] Extract main article content
  - [ ] Preserve code blocks
  - [ ] Handle tables
  - [ ] Extract images (URLs/alt text)
- [ ] Add selection handling
  - [ ] Detect selected text
  - [ ] Add context markers
  - [ ] Preserve selection in extraction
- [ ] Implement multi-tab extraction
  - [ ] Build @-mention UI
  - [ ] Add tab search/filter
  - [ ] Parallel extraction
  - [ ] Progress indicators
- [ ] Add dynamic content monitoring
  - [ ] MutationObserver for SPAs
  - [ ] Debounced re-extraction
  - [ ] Handle infinite scroll
- [ ] Build markdown conversion pipeline
- [ ] Add content caching (5 min TTL)
- [ ] Implement domain blocklist
- [ ] Add sensitive data detection

**Deliverables:**

- **Complete context-aware AI assistant**
- Can extract from any tab
- Multi-tab context aggregation works
- @-mention tab selection functional
- Selected text preserved in context

**Testing:**

- Test on various website types
- Verify SPA content extraction
- Test multi-tab extraction (10+ tabs)
- Validate markdown conversion
- Check sensitive data detection

---

## Project Structure

```
browser-sidebar/
├── src/
│   ├── backend/        # Service worker (index, keepAlive, messageHandler, sidebarManager)
│   ├── tabext/         # Content script entry
│   ├── sidebar/        # Injected UI (ChatPanel, components, hooks, styles, contexts, index)
│   ├── core/           # Messaging helpers
│   ├── store/          # Zustand stores (chat, settings)
│   ├── types/          # Shared types (messages, manifest, settings, chat)
│   └── utils/          # Utilities (theme, mockChat, cn)
├── public/
│   └── icons/          # Extension icons
├── tests/
│   ├── e2e/
│   ├── integration/
│   ├── sidebar/        # components/, performance*, accessibility*
│   └── store/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Technology Stack

### Core

- **Framework:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Build Tool:** Vite + CRXJS

### Libraries

- **Markdown:** react-markdown, remark-gfm, rehype-highlight
- **Syntax Highlighting:** highlight.js, prismjs
- **(Planned) Content Extraction:** @mozilla/readability
- **(Planned) AI SDKs:** openai, @anthropic-ai/sdk, @google/generative-ai
- **(Planned) Encryption:** WebCrypto (AES‑GCM)

### Development

- **Testing:** Vitest, @testing-library/react
- **Linting:** ESLint, Prettier
- **Type Checking:** TypeScript strict mode

## Success Metrics

### Performance

- Extension load time: < 100ms
- Content extraction: < 500ms per tab
- First AI token: < 2s latency
- Memory usage: < 50MB baseline

### Quality

- TypeScript coverage: 100%
- Test coverage: > 80%
- Accessibility: WCAG 2.1 AA
- Browser support: Chrome 120+, Edge 120+, Brave, Opera, Arc, Brave, Opera, Arc

### User Experience

- Activation rate: 50% complete first query
- Retention: 30% WAU/MAU ratio
- Engagement: 5 queries per session average
- Error rate: < 1% of interactions

## Risk Mitigation

### Technical Risks

- **Cross-origin content:** Use fallback extraction methods
- **API rate limits:** Implement exponential backoff
- **Large content:** Truncation with user notification
- **Memory leaks:** Regular profiling and cleanup

### Security Risks

- **API key exposure:** AES-256 encryption at rest
- **Sensitive data:** Pattern detection and blocking
- **XSS attacks:** Content sanitization
- **CORS issues:** Proper permission configuration

## Milestones & Checkpoints

### Checkpoint 1 (After Stage 2)

- [ ] Chat UI complete and polished
- [ ] Mock conversations working
- [ ] Theme switching functional
- [ ] Ready for UX validation

### Checkpoint 2 (After Stage 4)

- [ ] **Functional AI chatbot**
- [ ] All providers integrated
- [ ] Streaming responses smooth
- [ ] API key management secure

### Checkpoint 3 (After Stage 5)

- [ ] **Full product complete**
- [ ] Tab extraction working
- [ ] Multi-tab context functional
- [ ] Ready for beta testing

## Next Steps

1. Set up development environment
2. Initialize Git repository
3. Create project structure
4. Begin Stage 1 implementation
5. Set up CI/CD pipeline
6. Prepare for Chrome Web Store submission

---

_Document Version: 1.0_  
_Last Updated: 2025-08-19_  
_Status: Ready for Development_
