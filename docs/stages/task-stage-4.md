# Stage 4: AI Provider System

## Overview
**Goal:** Unified AI provider system with OpenAI, Gemini, and Anthropic support

**Duration:** 2 weeks | **Tasks:** 22 | **Prerequisites:** Stages 1-3

## Deliverables
- Unified provider interface with streaming and rate limiting
- OpenAI, Gemini, and Anthropic integrations
- Provider selection UI
- Fully functional AI chatbot

---

## Phase 4.1: Provider Foundation (4 tasks)

### Task 4.1.1a - Provider Types 🧪
**Dependencies:** Stage 3 API storage

**Key Types:**
- `ProviderConfig` - Provider configuration interface
- `ChatRequest/Response` - Chat message types  
- `StreamChunk` - Streaming data format
- `ProviderError` - Error handling classes
- `Provider` - Unified provider interface

**Files:**
- `src/types/providers.ts` - Core type definitions
- `tests/types/providers.test.ts` - Type validation tests

**Acceptance:**
- [ ] Complete type system for all providers
- [ ] Validation functions for configs and requests
- [ ] Error types with proper codes
- [ ] Tests pass

---

### Task 4.1.1b - Base Provider Class 🧪
**Dependencies:** Task 4.1.1a

**Key Features:**
- Abstract base class implementing `Provider` interface
- Rate limiting (60 requests/minute)
- Retry logic with exponential backoff
- Stream handling with unified parsing
- Error handling and classification

**Files:**
- `src/providers/BaseProvider.ts` - Abstract base implementation
- `tests/providers/BaseProvider.test.ts` - Base functionality tests

**Acceptance:**
- [ ] Common functionality abstracted
- [ ] Rate limiting functional
- [ ] Retry logic with proper backoff
- [ ] Stream handling works
- [ ] Tests pass

---

### Task 4.1.2a - Stream Parser 🧪
**Dependencies:** Task 4.1.1a

**Key Components:**
- `SSEParser` - Server-Sent Events parsing
- `JSONLParser` - JSON Lines parsing  
- Provider-specific parsers (OpenAI, Gemini, Anthropic)
- `UnifiedStreamParser` - Handles all provider formats

**Files:**
- `src/providers/streamParser.ts` - Stream parsing utilities
- `tests/providers/streamParser.test.ts` - Parser tests

**Acceptance:**
- [ ] SSE and JSONL parsing working
- [ ] Handles partial chunks correctly
- [ ] All provider formats supported
- [ ] Unified parser interface
- [ ] Tests pass

---

---

## Phase 4.2: Provider Implementations (9 tasks)

### Task 4.2.1 - OpenAI Provider 🧪
**Dependencies:** Phase 4.1

**Key Features:**
- GPT-4, GPT-3.5-turbo support
- Function calling capabilities
- Token counting with tiktoken
- Usage tracking via API

**Files:**
- `src/providers/OpenAIProvider.ts`
- `tests/providers/OpenAI.test.ts`

### Task 4.2.2 - Gemini Provider 🧪
**Dependencies:** Phase 4.1

**Key Features:**
- Gemini Pro and Flash models
- Safety settings configuration
- Structured output support
- Google AI Studio integration

**Files:**
- `src/providers/GeminiProvider.ts`
- `tests/providers/Gemini.test.ts`

### Task 4.2.3 - Anthropic Provider 🧪
**Dependencies:** Phase 4.1

**Key Features:**
- Claude 3.5 Sonnet, Haiku support
- System message handling
- OpenRouter integration
- Tool calling support

**Files:**
- `src/providers/AnthropicProvider.ts`
- `tests/providers/Anthropic.test.ts`

---

## Phase 4.3: Provider Management (9 tasks)

### Task 4.3.1 - Provider Registry 🧪
**Dependencies:** Phase 4.2

**Key Features:**
- Dynamic provider registration
- Configuration validation
- Provider factory pattern
- Health checking

**Files:**
- `src/providers/ProviderRegistry.ts`
- `tests/providers/Registry.test.ts`

### Task 4.3.2 - Provider Selection UI 🧪
**Dependencies:** Phase 4.2, Stage 2 UI

**Key Features:**
- Provider dropdown with models
- API key configuration modal
- Model selection with limits
- Cost estimation display

**Files:**
- `src/sidebar/components/ProviderSelector.tsx`
- `src/sidebar/components/ApiKeyModal.tsx`
- `tests/sidebar/ProviderSelector.test.tsx`

### Task 4.3.3 - Chat Integration 🧪
**Dependencies:** All previous tasks

**Key Features:**
- Connect providers to chat UI
- Streaming message display
- Error handling in chat
- Provider switching mid-conversation

**Files:**
- `src/sidebar/hooks/useChat.ts`
- `src/sidebar/components/ChatInterface.tsx`
- Integration with existing UI components

---

## Completion Checklist

### Core Requirements
- [ ] All 3 providers functional
- [ ] Streaming working
- [ ] Rate limiting active
- [ ] Provider UI complete
- [ ] Chat integration working
- [ ] Tests passing (>90% coverage)

### Quality Gates
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] API key validation working
- [ ] Error handling robust
- [ ] Code reviewed

**Next:** Stage 5 (Content Extraction)

---

*Stage 4: AI Provider System | 22 tasks | 2 weeks*