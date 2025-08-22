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
- **E2E-style UI Flows**: For critical user journeys (Vitest + RTL)

## Progress Tracking

- [x] Stage 1: Extension Infrastructure (15/15 tasks) ✅ COMPLETED
- [x] Stage 2: Chat Panel UI (24/24 tasks) ✅ COMPLETED
- [x] Stage 3: Storage & Security (18/18 tasks) ✅ COMPLETED
- [ ] Stage 4: AI Provider System (10/23 tasks)
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 67/101 tasks**

---

## STAGE 4: AI PROVIDER SYSTEM

Deliverable highlight: Unified AI provider system supporting OpenAI, Gemini with streaming responses, rate limiting, and request queuing. Complete provider selection UI and full AI chatbot integration with the chat panel from Stage 2.

### Phase 4.1: Provider Foundation

**Synchronization Point: Base interface required for all providers**

⚡ **Sequential Tasks:**

- [x] **Task 4.1.1a** - Provider Types 🧪
  - Prerequisites: Task 3.2.2b
  - Tests First:
    - Test type definitions compile
    - Test type guards work
    - Test configuration types (temperature, reasoning_effort, thinking_mode)
  - Description: Define provider interfaces with configuration options
  - Deliverables:
    - `src/types/providers.ts`
    - Response types
    - Error types
    - Configuration types (temperature, reasoning_effort for OpenAI, thinking_mode for Gemini)
  - Acceptance: Types are comprehensive with full config support

- [x] **Task 4.1.1b** - Base Provider Class 🧪
  - Prerequisites: Task 4.1.1a
  - Tests First:
    - Test abstract methods
    - Test shared functionality
  - Description: Create base provider class
  - Deliverables:
    - `src/provider/BaseProvider.ts`
    - `tests/provider/BaseProvider.test.ts`
  - Acceptance: Base class works

- [x] **Task 4.1.2a** - Stream Parser 🧪
  - Prerequisites: Task 4.1.1a
  - Tests First:
    - Test SSE parsing
    - Test chunk handling
    - Test error detection
  - Description: Create SSE stream parser
  - Deliverables:
    - `src/provider/streamParser.ts`
    - `tests/provider/streamParser.test.ts`
  - Acceptance: Parses SSE correctly

- [x] **Task 4.1.2b** - Token Buffer 🧪
  - Prerequisites: Task 4.1.2a
  - Tests First:
    - Test buffering logic
    - Test flush behavior
  - Description: Implement token buffering
  - Deliverables:
    - `src/provider/tokenBuffer.ts`
    - `tests/provider/tokenBuffer.test.ts`
  - Acceptance: Buffers tokens correctly

### Phase 4.2: Provider Implementations

**Synchronization Point: All providers ready for integration**

🔄 **Parallelizable Tasks:**

- [x] **Task 4.2.1a** - OpenAI Client Setup 🧪
  - Prerequisites: Task 4.1.1b
  - Tests First:
    - Test client initialization
    - Test configuration
  - Description: Setup OpenAI SDK
  - Deliverables:
    - OpenAI client configuration
    - Authentication setup
  - Acceptance: Client initializes

- [x] **Task 4.2.1b** - OpenAI Response API Implementation 🧪
  - Prerequisites: Task 4.2.1a, Task 4.1.2b
  - Tests First:
    - Test response API (not chat completion)
    - Test streaming responses
    - Test temperature parameter (0.0-2.0)
    - Test reasoning_effort parameter (low/medium/high)
    - Test error handling
  - Description: Implement OpenAI using Response API with temperature
  - Deliverables:
    - `src/provider/openai/OpenAIProvider.ts`
    - `tests/provider/openai/OpenAIProvider.test.ts`
  - Acceptance: OpenAI Response API works with temperature and reasoning support

- [x] **Task 4.2.1c** - OpenAI Models Configuration 🧪
  - Prerequisites: Task 4.2.1b
  - Tests First:
    - Test model listing (gpt-5-nano)
    - Test model selection
    - Test temperature support for GPT models
    - Test reasoning_effort configuration per model
    - Test parameter validation per model type
  - Description: Configure OpenAI models with proper parameters
  - Deliverables:
    - Model configurations with parameter constraints
    - Model capabilities and limitations
    - Temperature and reasoning effort support matrix
  - Acceptance: Models configured with correct parameter support

- [x] **Task 4.2.2a** - Gemini Client Setup 🧪
  - Prerequisites: Task 4.1.1b
  - Tests First:
    - Test client initialization
    - Test authentication
  - Description: Setup Gemini SDK
  - Deliverables:
    - Gemini client configuration
  - Acceptance: Client initializes

- [x] **Task 4.2.2b** - Gemini Chat Implementation 🧪
  - Prerequisites: Task 4.2.2a, Task 4.1.2b
  - Tests First:
    - Test chat generation
    - Test streaming
    - Test temperature parameter (0.0-2.0)
    - Test thinking mode (THINKING_MODE_OFF, THINKING_MODE_DYNAMIC)
    - Test thought visibility toggle
    - Test multimodal support
  - Description: Implement Gemini chat with temperature and thinking mode
  - Deliverables:
    - `src/provider/gemini/GeminiProvider.ts`
    - `tests/provider/gemini/GeminiProvider.test.ts`
  - Acceptance: Gemini chat works with temperature and thinking modes

- [x] **Task 4.2.2c** - Gemini Models Configuration 🧪
  - Prerequisites: Task 4.2.2b
  - Tests First:
    - Test model configuration (gemini-2.5-flash-lite)
    - Test thinking mode support per model
    - Test context limits
  - Description: Configure Gemini models with thinking capabilities
  - Deliverables:
    - Model configurations with thinking mode support matrix
    - Thought visibility configuration
  - Acceptance: Models configured with thinking mode support

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
    - `src/provider/ProviderRegistry.ts`
    - `tests/provider/ProviderRegistry.test.ts`
  - Acceptance: Registry manages providers

- [ ] **Task 4.3.1b** - Provider Factory 🧪
  - Prerequisites: Task 4.3.1a
  - Tests First:
    - Test provider creation
    - Test configuration
  - Description: Create provider factory
  - Deliverables:
    - `src/provider/ProviderFactory.ts`
    - `tests/provider/ProviderFactory.test.ts`
  - Acceptance: Factory creates providers

- [ ] **Task 4.3.2** - API Key Validation Service 🧪
  - Prerequisites: Task 4.3.1b
  - Tests First:
    - Test validation for each provider
    - Test error messages
  - Description: Validate keys with providers
  - Deliverables:
    - `src/provider/validation.ts`
    - `tests/provider/validation.test.ts`
  - Acceptance: Keys validated

- [ ] **Task 4.3.3a** - Rate Limiter 🧪
  - Prerequisites: Task 4.3.1a
  - Tests First:
    - Test rate limiting
    - Test backoff
    - Test reset
  - Description: Implement rate limiting
  - Deliverables:
    - `src/provider/RateLimiter.ts`
    - `tests/provider/RateLimiter.test.ts`
  - Acceptance: Rate limits enforced

- [ ] **Task 4.3.3b** - Request Queue 🧪
  - Prerequisites: Task 4.3.3a
  - Tests First:
    - Test queueing
    - Test priority
    - Test cancellation
  - Description: Create request queue
  - Deliverables:
    - `src/provider/RequestQueue.ts`
    - `tests/provider/RequestQueue.test.ts`
  - Acceptance: Queue manages requests

- [ ] **Task 4.3.4a** - Provider Settings UI 🧪
  - Prerequisites: Task 4.3.1b, Task 2.4.1
  - Tests First:
    - Test provider selection
    - Test model selection
    - Test temperature slider (0-2.0)
    - Test reasoning_effort dropdown for OpenAI (low/medium/high)
    - Test thinking mode toggle for Gemini (off/dynamic)
    - Test thought visibility checkbox for Gemini
    - Test parameter validation per model
    - Test configuration save
  - Description: Create provider UI with parameter controls
  - Deliverables:
    - `src/components/Settings/ProviderSettings.tsx`
    - `tests/sidebar/components/Settings/ProviderSettings.test.tsx`
  - Acceptance: UI configures providers with all parameters

- [ ] **Task 4.3.4b** - API Key Input UI 🧪
  - Prerequisites: Task 4.3.4a
  - Tests First:
    - Test key input
    - Test validation display
    - Test secure storage
  - Description: Create key input component
  - Deliverables:
    - `src/components/Settings/ApiKeyInput.tsx`
    - `tests/sidebar/components/Settings/ApiKeyInput.test.tsx`
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
2. **Mock External APIs**: Mock OpenAI, Gemini responses
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

- [ ] All 21 tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] All providers functional
- [ ] Full AI chat working
- [ ] Performance benchmarks met
- [ ] Security audit passed

---

_Task Blueprint Version: 2.1 (TDD Edition with API Updates)_  
_Stage 4 Tasks: 21_  
_Test-First Tasks: 21 (100%)_  
_Parallelizable: 7 (33%)_  
_Sequential: 14 (67%)_  
_Estimated Parallel Execution Paths: 3_
