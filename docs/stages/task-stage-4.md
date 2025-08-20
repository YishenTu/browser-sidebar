# AI Browser Sidebar Extension - STAGE 4: AI PROVIDER SYSTEM

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
- [x] Stage 2: Chat Panel UI (24/24 tasks) ✅ COMPLETED
- [x] Stage 3: Storage & Security (18/18 tasks) ✅ COMPLETED
- [ ] Stage 4: AI Provider System (0/22 tasks)
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 57/100 tasks**

---

## STAGE 4: AI PROVIDER SYSTEM

Deliverable highlight: Unified AI provider system supporting OpenAI, Gemini, and Anthropic with streaming responses, rate limiting, and request queuing. Complete provider selection UI and full AI chatbot integration with the chat panel from Stage 2.

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

## Synchronization Points

### Critical Review Points:

1. **After Phase 4.1**: Base provider interface and streaming ready
2. **After Phase 4.2**: All AI providers functional
3. **After Phase 4.3**: Complete AI system integrated with UI

### Test Coverage Requirements:

- Unit Tests: > 90% coverage
- Component Tests: All provider and UI components tested
- Integration Tests: All API interactions tested
- E2E Tests: Complete chat flows tested

## Risk Mitigation

### Testing Strategy:

1. **API Tests First**: Write failing tests before provider implementation
2. **Mock External APIs**: Mock OpenAI, Gemini, Anthropic responses
3. **Stream Testing**: Test real-time streaming responses
4. **Error Testing**: Test all error conditions and rate limits
5. **UI Integration**: Test provider selection and chat integration

### Potential Blockers:

1. **API Rate Limits**: Use proper rate limiting and backoff
2. **Stream Parsing**: Handle partial and malformed responses
3. **Provider Changes**: Abstract provider-specific logic
4. **Key Validation**: Validate keys without excessive API calls
5. **Error Handling**: Provide clear user feedback for errors

## Completion Criteria

### Task Completion:

- [ ] All tests written and passing
- [ ] Provider implementation complete
- [ ] UI integration functional
- [ ] Error handling comprehensive
- [ ] No linting errors

### Stage Completion:

- [ ] All 22 tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] All providers functional
- [ ] Full AI chat working
- [ ] Performance benchmarks met
- [ ] Security audit passed

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Stage 4 Tasks: 22_  
_Test-First Tasks: 22 (100%)_  
_Parallelizable: 8 (36%)_  
_Sequential: 14 (64%)_  
_Estimated Parallel Execution Paths: 3_
