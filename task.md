# Refactor Execution Tasks

## Project Overview

Transform the browser-sidebar extension from a monolithic structure to a modular, service-oriented architecture with clear separation of concerns. The refactor preserves all current functionality while introducing transport abstraction, services layer, and platform wrappers.

## Execution Guidelines for Sub-agents

- Each task can be executed independently unless prerequisites are specified
- 🔄 indicates parallelizable tasks - can be executed simultaneously
- ⚡ indicates sequential tasks - must be completed in order
- Always create re-export stubs when moving files to maintain backward compatibility
- Run `npm run typecheck && npm run lint` after each task completion; at synchronization points also run `npm test` and `npm run build`
- Feature flag `refactorMode` gates all new behavior
- Permissions: no new default permissions; use optional host permissions only for custom endpoints when required
- Non-goals: no UX redesigns or new flows, no new providers/models, and no storage schema changes

## Progress Tracking

- Total Tasks: 89
- Completed: 0
- In Progress: 0
- Remaining: 89

---

## Phase 0: Baseline & Feature Flag [Day 0.5]

### Core Setup

- [ ] **Task 0.1** ⚡ Create Feature Flag
  - Prerequisites: None
  - Description: Create feature flag configuration file
  - Deliverable: `src/config/featureFlags.ts`
  - Content: `export const refactorMode = false; // Will be toggled per phase`
  - Acceptance: File exists, exports boolean constant

- [ ] **Task 0.2** ⚡ Update TypeScript Config
  - Prerequisites: None
  - Description: Add new path aliases for future directories
  - Deliverable: Modified `tsconfig.json`
  - Changes: Add to `paths`:
    ```json
    "@core/*": ["src/core/*"],
    "@transport/*": ["src/transport/*"],
    "@platform/*": ["src/platform/*"]
    ```
  - Acceptance: TypeScript resolves new aliases, build passes

- [ ] **Task 0.3** 🔄 Update Vite Config
  - Prerequisites: Task 0.2
  - Description: Ensure Vite resolver mirrors TypeScript paths
  - Deliverable: Modified `vite.config.ts`
  - Changes: Add aliases for @core, @transport, @platform
  - Acceptance: Build succeeds with new aliases

- [ ] **Task 0.4** 🔄 Document Baseline Behavior
  - Prerequisites: None
  - Description: Record current extension behavior for regression testing
  - Deliverable: `docs/baseline-behavior.md`
  - Content: Screenshots, test flows for streaming, extraction, provider switching
  - Acceptance: Document covers all major user flows

- [ ] **Task 0.5** 🔄 Update Vitest Config
  - Prerequisites: Task 0.2
  - Description: Mirror TypeScript path aliases in Vitest
  - Deliverable: Modified `vitest.config.ts`
  - Changes: Ensure aliases for `@core`, `@transport`, `@platform` resolve in tests
  - Acceptance: Tests resolve new aliases without path errors

- [ ] **Task 0.6** ⚡ Validate Manifest Permissions & KeepAlive
  - Prerequisites: None
  - File: `manifest.json`
  - Checks: No new required permissions; background keepAlive strategy remains intact
  - Acceptance: Manifest unchanged for default permissions; behavior verified

- [ ] **Task 0.7** 🔄 Update README Rollout Notes
  - Prerequisites: Task 0.1
  - File: `README.md`
  - Changes: Add feature-flag rollout section and guidance on toggling `refactorMode`
  - Acceptance: README includes rollout notes without architecture rewrite (saved for Phase 9)

**Synchronization Point**: Verify typecheck, lint, test, and build all pass; extension loads and behavior unchanged

---

## Phase 1: Extract Pure Logic to Core [Days 1-2]

### Directory Structure Creation

- [ ] **Task 1.1** ⚡ Create Core Directory Structure
  - Prerequisites: Task 0.2
  - Description: Create core module directories
  - Deliverables:
    - `src/core/ai/openai/`
    - `src/core/ai/openai-compat/`
    - `src/core/ai/gemini/`
    - `src/core/ai/openrouter/`
    - `src/core/extraction/analyzers/`
  - Acceptance: Directories exist with proper structure

### OpenAI Provider Migration 🔄 (Parallel Group A)

- [ ] **Task 1.2** 🔄 Move OpenAI Request Builder
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai/requestBuilder.ts`
  - Destination: `src/core/ai/openai/requestBuilder.ts`
  - Re-export stub: `export * from '@core/ai/openai/requestBuilder';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.3** 🔄 Move OpenAI Stream Processor
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai/streamProcessor.ts`
  - Destination: `src/core/ai/openai/streamProcessor.ts`
  - Re-export stub: `export * from '@core/ai/openai/streamProcessor';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.4** 🔄 Move OpenAI Response Parser
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai/responseParser.ts`
  - Destination: `src/core/ai/openai/responseParser.ts`
  - Re-export stub: `export * from '@core/ai/openai/responseParser';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.5** 🔄 Move OpenAI Error Handler
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai/errorHandler.ts`
  - Destination: `src/core/ai/openai/errorHandler.ts`
  - Re-export stub: `export * from '@core/ai/openai/errorHandler';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.6** 🔄 Move OpenAI Search Metadata
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai/searchMetadata.ts`
  - Destination: `src/core/ai/openai/searchMetadata.ts`
  - Re-export stub: `export * from '@core/ai/openai/searchMetadata';`
  - Acceptance: Imports resolve, no TypeScript errors

### OpenAI-Compat Provider Migration 🔄 (Parallel Group B)

- [ ] **Task 1.7** 🔄 Move OpenAI-Compat Request Builder
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai-compat/requestBuilder.ts`
  - Destination: `src/core/ai/openai-compat/requestBuilder.ts`
  - Re-export stub: `export * from '@core/ai/openai-compat/requestBuilder';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.8** 🔄 Move OpenAI-Compat Stream Processor
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai-compat/streamProcessor.ts`
  - Destination: `src/core/ai/openai-compat/streamProcessor.ts`
  - Re-export stub: `export * from '@core/ai/openai-compat/streamProcessor';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.9** 🔄 Move OpenAI-Compat Error Handler
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openai-compat/errorHandler.ts`
  - Destination: `src/core/ai/openai-compat/errorHandler.ts`
  - Re-export stub: `export * from '@core/ai/openai-compat/errorHandler';`
  - Acceptance: Imports resolve, no TypeScript errors

### Gemini Provider Migration 🔄 (Parallel Group C)

- [ ] **Task 1.10** 🔄 Move Gemini Request Builder
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/gemini/requestBuilder.ts`
  - Destination: `src/core/ai/gemini/requestBuilder.ts`
  - Re-export stub: `export * from '@core/ai/gemini/requestBuilder';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.11** 🔄 Move Gemini Stream Processor
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/gemini/streamProcessor.ts`
  - Destination: `src/core/ai/gemini/streamProcessor.ts`
  - Re-export stub: `export * from '@core/ai/gemini/streamProcessor';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.12** 🔄 Move Gemini Response Parser
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/gemini/responseParser.ts`
  - Destination: `src/core/ai/gemini/responseParser.ts`
  - Re-export stub: `export * from '@core/ai/gemini/responseParser';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.13** 🔄 Move Gemini Error Handler
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/gemini/errorHandler.ts`
  - Destination: `src/core/ai/gemini/errorHandler.ts`
  - Re-export stub: `export * from '@core/ai/gemini/errorHandler';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.14** 🔄 Move Gemini Search Metadata
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/gemini/searchMetadata.ts`
  - Destination: `src/core/ai/gemini/searchMetadata.ts`
  - Re-export stub: `export * from '@core/ai/gemini/searchMetadata';`
  - Acceptance: Imports resolve, no TypeScript errors

### OpenRouter Provider Migration 🔄 (Parallel Group D)

- [ ] **Task 1.15** 🔄 Move OpenRouter Request Builder
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openrouter/requestBuilder.ts`
  - Destination: `src/core/ai/openrouter/requestBuilder.ts`
  - Re-export stub: `export * from '@core/ai/openrouter/requestBuilder';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.16** 🔄 Move OpenRouter Stream Processor
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openrouter/streamProcessor.ts`
  - Destination: `src/core/ai/openrouter/streamProcessor.ts`
  - Re-export stub: `export * from '@core/ai/openrouter/streamProcessor';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.17** 🔄 Move OpenRouter Error Handler
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openrouter/errorHandler.ts`
  - Destination: `src/core/ai/openrouter/errorHandler.ts`
  - Re-export stub: `export * from '@core/ai/openrouter/errorHandler';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.18** 🔄 Move OpenRouter Types
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/provider/openrouter/types.ts`
  - Destination: `src/core/ai/openrouter/types.ts`
  - Re-export stub: `export * from '@core/ai/openrouter/types';`
  - Acceptance: Imports resolve, no TypeScript errors

### Extraction Logic Migration 🔄 (Parallel Group E)

- [ ] **Task 1.19** 🔄 Move Markdown Converter
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/tabext/extraction/converters/markdownConverter.ts`
  - Destination: `src/core/extraction/markdownConverter.ts`
  - Re-export stub: `export * from '@core/extraction/markdownConverter';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.20** 🔄 Move Content Analyzer
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/tabext/extraction/analyzers/contentAnalyzer.ts`
  - Destination: `src/core/extraction/analyzers/contentAnalyzer.ts`
  - Re-export stub: `export * from '@core/extraction/analyzers/contentAnalyzer';`
  - Acceptance: Imports resolve, no TypeScript errors

- [ ] **Task 1.21** 🔄 Move Text Utils
  - Prerequisites: Task 1.1
  - Description: Move and create re-export stub
  - Source: `src/tabext/utils/textUtils.ts`
  - Destination: `src/core/extraction/text.ts`
  - Re-export stub: `export * from '@core/extraction/text';`
  - Acceptance: Imports resolve, no TypeScript errors

### Barrel Exports Creation ⚡ (Sequential - After all moves)

- [ ] **Task 1.22** ⚡ Create Core AI Barrel Export
  - Prerequisites: Tasks 1.2-1.18
  - Description: Create barrel export for AI modules
  - Deliverable: `src/core/ai/index.ts`
  - Content: Export all provider sub-modules
  - Acceptance: Can import from '@core/ai'

- [ ] **Task 1.23** ⚡ Create Core Extraction Barrel Export
  - Prerequisites: Tasks 1.19-1.21
  - Description: Create barrel export for extraction modules
  - Deliverable: `src/core/extraction/index.ts`
  - Content: Export markdownConverter, contentAnalyzer, text
  - Acceptance: Can import from '@core/extraction'

### Testing for Phase 1

- [ ] **Task 1.24** 🔄 Create OpenAI Core Tests
  - Prerequisites: Task 1.22
  - Description: Unit tests for moved OpenAI logic
  - Deliverable: `tests/unit/core/ai/openai/streamProcessor.test.ts`
  - Acceptance: Tests pass, >90% coverage

- [ ] **Task 1.25** 🔄 Create Extraction Core Tests
  - Prerequisites: Task 1.23
  - Description: Unit tests for extraction logic
  - Deliverables:
    - `tests/unit/core/extraction/markdownConverter.test.ts`
    - `tests/unit/core/extraction/contentAnalyzer.test.ts`
    - `tests/unit/core/extraction/text.test.ts`
  - Acceptance: Tests pass, >90% coverage

**Synchronization Point**: All imports resolve, build passes, no chrome._ or DOM in core/_

---

## Phase 2: Transport Abstraction [Days 2-3]

### Transport Foundation

- [ ] **Task 2.1** ⚡ Create Transport Types
  - Prerequisites: Phase 1 complete
  - Description: Define transport interfaces and types
  - Deliverable: `src/transport/types.ts`
  - Interface contracts:
    ```typescript
    interface TransportRequest {
      url;
      method;
      headers;
      body?;
      stream?;
      signal?;
    }
    interface TransportResponse {
      status;
      statusText;
      headers;
      body?;
    }
    type TransportStream = ReadableStream<Uint8Array> | AsyncIterable<string | Uint8Array>;
    interface Transport {
      request();
      stream();
    }
    ```
  - Acceptance: Types compile, no errors

- [ ] **Task 2.2** 🔄 Create Direct Fetch Transport
  - Prerequisites: Task 2.1
  - Description: Implement direct fetch transport
  - Deliverable: `src/transport/DirectFetchTransport.ts`
  - Implements: Transport interface
  - Features: Standard fetch wrapper with streaming support
  - Acceptance: Can make HTTP requests and stream responses

- [ ] **Task 2.3** 🔄 Create Background Proxy Transport
  - Prerequisites: Task 2.1
  - Description: Implement proxy transport for CORS
  - Deliverable: `src/transport/BackgroundProxyTransport.ts`
  - Implements: Transport interface
  - Features: Port-based SSE streaming via background worker
  - Acceptance: Can proxy requests through background worker

- [ ] **Task 2.4** 🔄 Create Transport Policy
  - Prerequisites: Task 2.1
  - Description: Define proxy routing policy
  - Deliverable: `src/transport/policy.ts`
  - Functions: `shouldProxy(url: string): boolean`
  - Default allowlist: `['https://api.moonshot.cn']`
  - Acceptance: Correctly identifies URLs needing proxy

- [ ] **Task 2.5** ⚡ Create Transport Barrel Export
  - Prerequisites: Tasks 2.2-2.4
  - Description: Create barrel export for transport
  - Deliverable: `src/transport/index.ts`
  - Exports: All transport classes and types
  - Acceptance: Can import from '@transport'

### Integration with Existing Code

- [ ] **Task 2.6** ⚡ Update Proxy Handler
  - Prerequisites: Task 2.4
  - Description: Update background proxy to use policy
  - File: `src/extension/background/proxyHandler.ts`
  - Changes: Import and use `shouldProxy` from `@transport/policy`
  - Acceptance: Proxy handler uses centralized policy

- [ ] **Task 2.7** ⚡ Refactor ProxiedOpenAIClient
  - Prerequisites: Task 2.3, Task 2.6
  - Description: Update to use BackgroundProxyTransport
  - File: `src/provider/openai-compat/ProxiedOpenAIClient.ts`
  - Changes: Delegate to BackgroundProxyTransport for streaming
  - Feature flag: Gate behind refactorMode
  - Acceptance: Kimi streaming works via new transport

- [ ] **Task 2.8** ⚡ Update OpenAICompatibleProvider
  - Prerequisites: Task 2.7
  - Description: Add transport support to provider
  - File: `src/provider/openai-compat/OpenAICompatibleProvider.ts`
  - Changes: Use Transport when refactorMode=true
  - Acceptance: Provider works with both old and new paths

### Testing for Phase 2

- [ ] **Task 2.9** 🔄 Create Transport Policy Tests
  - Prerequisites: Task 2.4
  - Deliverable: `tests/unit/transport/policy.test.ts`
  - Coverage: shouldProxy logic, allowlist behavior
  - Acceptance: Tests pass, >90% coverage

- [ ] **Task 2.10** 🔄 Create Direct Transport Tests
  - Prerequisites: Task 2.2
  - Deliverable: `tests/unit/transport/directFetchTransport.test.ts`
  - Coverage: Request/response, streaming, error handling
  - Acceptance: Tests pass with mocked fetch

- [ ] **Task 2.11** 🔄 Create Proxy Transport Tests
  - Prerequisites: Task 2.3
  - Deliverable: `tests/unit/transport/backgroundProxyTransport.test.ts`
  - Coverage: Port messaging, streaming, error handling
  - Mocks: chrome.runtime.connect, Port interface
  - Acceptance: Tests pass with mocked chrome APIs

**Synchronization Point**: Both transports work, Kimi streams via proxy with feature flag

---

## Phase 3: Providers on Transport [Days 2-3]

### Provider Adaptation

- [ ] **Task 3.1** ⚡ Update BaseProvider
  - Prerequisites: Phase 2 complete
  - Description: Add transport support to base class
  - File: `src/provider/BaseProvider.ts`
  - Changes: Accept optional transport in constructor
  - Acceptance: Base class supports transport injection

- [ ] **Task 3.2** 🔄 Update OpenAI Provider
  - Prerequisites: Task 3.1
  - File: `src/provider/openai/OpenAIProvider.ts`
  - Changes: Use Transport for API calls when refactorMode=true
  - Fallback: Keep SDK path for refactorMode=false
  - Acceptance: OpenAI works with transport

- [ ] **Task 3.3** 🔄 Update Gemini Provider
  - Prerequisites: Task 3.1
  - File: `src/provider/gemini/GeminiProvider.ts`
  - Changes: Use Transport for streaming when refactorMode=true
  - Fallback: Keep SDK path for refactorMode=false
  - Acceptance: Gemini works with transport

- [ ] **Task 3.4** 🔄 Update OpenRouter Provider
  - Prerequisites: Task 3.1
  - File: `src/provider/openrouter/OpenRouterProvider.ts`
  - Changes: Use Transport when refactorMode=true
  - Acceptance: OpenRouter works with transport

- [ ] **Task 3.5** ⚡ Update Provider Factory
  - Prerequisites: Tasks 3.2-3.4
  - File: `src/provider/ProviderFactory.ts`
  - Changes: Inject DirectFetchTransport by default when refactorMode=true
  - Acceptance: Factory creates providers with transport

### Testing for Phase 3

- [ ] **Task 3.6** 🔄 Create OpenAI Transport Tests
  - Prerequisites: Task 3.2
  - Deliverable: `tests/unit/provider/openai/adapter.transport.test.ts`
  - Coverage: Streaming with mocked transport
  - Acceptance: Tests verify chunk contract

- [ ] **Task 3.7** 🔄 Create Gemini Transport Tests
  - Prerequisites: Task 3.3
  - Deliverable: `tests/unit/provider/gemini/adapter.transport.test.ts`
  - Coverage: Streaming with mocked transport
  - Acceptance: Tests verify chunk contract

- [ ] **Task 3.8** 🔄 Create OpenRouter Transport Tests
  - Prerequisites: Task 3.4
  - Deliverable: `tests/unit/provider/openrouter/adapter.transport.test.ts`
  - Coverage: Streaming with mocked transport
  - Acceptance: Tests verify chunk contract

**Synchronization Point**: All providers work with transport, feature flag toggles behavior

---

## Phase 4: Services Layer [Days 3-4]

### Service Creation 🔄 (All can be parallel)

- [ ] **Task 4.1** 🔄 Create Chat Service
  - Prerequisites: Phase 3 complete
  - Deliverable: `src/services/chat/ChatService.ts`
  - API:
    - `stream(messages, options): AsyncIterable<StreamChunk>`
    - `cancel(): void`
  - Dependencies: Provider, Transport
  - Acceptance: Service compiles, exports correct API

- [ ] **Task 4.2** 🔄 Create Extraction Service
  - Prerequisites: Phase 1 complete
  - Deliverable: `src/services/extraction/ExtractionService.ts`
  - API:
    - `extractCurrentTab(options): Promise<TabContent>`
    - `extractTabs(tabIds, options): Promise<TabContent[]>`
  - Features: Background messaging, retries
  - Acceptance: Service compiles, exports correct API

- [ ] **Task 4.3** 🔄 Create Provider Manager Service
  - Prerequisites: Phase 3 complete
  - Deliverable: `src/services/provider/ProviderManagerService.ts`
  - API:
    - `getActive(): Provider`
    - `switch(providerId): void`
    - `getStats(): ProviderStats`
  - Dependencies: ProviderRegistry
  - Acceptance: Service compiles, manages providers

- [ ] **Task 4.4** 🔄 Create Key Service
  - Prerequisites: Phase 2 complete
  - Deliverable: `src/services/keys/KeyService.ts`
  - API:
    - `get(provider): string`
    - `set(provider, key): void`
    - `validate(provider, key): Promise<boolean>`
  - Dependencies: Storage, Transport (for CORS validation)
  - Acceptance: Service compiles, manages keys

- [ ] **Task 4.5** 🔄 Create Session Service
  - Prerequisites: None
  - Deliverable: `src/services/session/SessionService.ts`
  - API:
    - `getSessionKey(tabId, url): string`
    - `clearSession(sessionKey): void`
  - Features: Tab+URL mapping
  - Acceptance: Service compiles, manages sessions

### Testing for Phase 4

- [ ] **Task 4.6** 🔄 Create Chat Service Tests
  - Prerequisites: Task 4.1
  - Deliverable: `tests/unit/services/chatService.test.ts`
  - Coverage: Streaming, cancellation, error handling
  - Acceptance: Tests pass with mocks

- [ ] **Task 4.7** 🔄 Create Extraction Service Tests
  - Prerequisites: Task 4.2
  - Deliverable: `tests/unit/services/extractionService.test.ts`
  - Coverage: Single/multi tab extraction
  - Acceptance: Tests pass with mocks

- [ ] **Task 4.8** 🔄 Create Provider Manager Tests
  - Prerequisites: Task 4.3
  - Deliverable: `tests/unit/services/providerManagerService.test.ts`
  - Coverage: Provider switching, stats
  - Acceptance: Tests pass with mocks

- [ ] **Task 4.9** 🔄 Create Key Service Tests
  - Prerequisites: Task 4.4
  - Deliverable: `tests/unit/services/keyService.test.ts`
  - Coverage: Key CRUD, validation
  - Acceptance: Tests pass with mocks

- [ ] **Task 4.10** 🔄 Create Session Service Tests
  - Prerequisites: Task 4.5
  - Deliverable: `tests/unit/services/sessionService.test.ts`
  - Coverage: Session management
  - Acceptance: Tests pass with mocks

**Synchronization Point**: All services created and tested, ready for integration

- Acceptance: Services compile and are callable from hooks; no UI changes yet

---

## Phase 5: Platform Wrappers [Days 1-2]

### Platform Wrapper Creation 🔄 (All can be parallel)

- [ ] **Task 5.1** 🔄 Create Runtime Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/runtime.ts`
  - Features: Typed sendMessage, event helpers, error normalization
  - Acceptance: Wrapper exports typed chrome.runtime functions

- [ ] **Task 5.2** 🔄 Create Tabs Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/tabs.ts`
  - Features: getActiveTabId, sendMessageToTab, query utilities
  - Acceptance: Wrapper exports typed chrome.tabs functions

- [ ] **Task 5.3** 🔄 Create Storage Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/storage.ts`
  - Features: Strongly typed get/set operations
  - Acceptance: Wrapper exports typed chrome.storage functions

- [ ] **Task 5.4** 🔄 Create Ports Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/ports.ts`
  - Features: Open/close/reconnect patterns for long-lived ports
  - Acceptance: Wrapper manages port lifecycle

- [ ] **Task 5.5** 🔄 Create Messaging Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/messaging.ts`
  - Features: MessageBus with unified types
  - Acceptance: Wrapper handles messaging patterns

- [ ] **Task 5.6** 🔄 Create KeepAlive Wrapper
  - Prerequisites: None
  - Deliverable: `src/platform/chrome/keepAlive.ts`
  - Features: Wrapper around background keepAlive logic
  - Acceptance: Wrapper manages service worker lifecycle

### Testing for Phase 5

- [ ] **Task 5.7** 🔄 Create Platform Tests
  - Prerequisites: Tasks 5.1-5.6
  - Deliverables:
    - `tests/unit/platform/runtime.test.ts`
    - `tests/unit/platform/tabs.test.ts`
    - `tests/unit/platform/storage.test.ts`
    - `tests/unit/platform/ports.test.ts`
  - Mocks: vi.fn() for chrome APIs
  - Acceptance: Tests pass in Node environment

**Synchronization Point**: Platform wrappers ready for use in services

---

## Phase 6: Thin UI Hooks [Days 2-3]

### Hook Refactoring ⚡ (Sequential - depends on services)

- [ ] **Task 6.1** ⚡ Refactor useAIChat Hook
  - Prerequisites: Phase 4 complete
  - File: `src/sidebar/hooks/ai/useAIChat.ts`
  - Changes: Replace direct provider calls with ChatService
  - Dependencies: ChatService, ProviderManagerService
  - Acceptance: Hook uses services, no direct chrome.\* or fetch

- [ ] **Task 6.2** ⚡ Refactor useProviderManager Hook
  - Prerequisites: Task 6.1
  - File: `src/sidebar/hooks/ai/useProviderManager.ts`
  - Changes: Delegate to ProviderManagerService
  - Acceptance: Hook uses service for provider management

- [ ] **Task 6.3** ⚡ Refactor useMessageHandler Hook
  - Prerequisites: Task 6.1
  - File: `src/sidebar/hooks/ai/useMessageHandler.ts`
  - Changes: Use ChatService.handleStreamingResponse
  - Acceptance: Hook uses service for streaming

- [ ] **Task 6.4** ⚡ Refactor useTabExtraction Hook
  - Prerequisites: Phase 4 complete
  - File: `src/sidebar/hooks/useTabExtraction.ts`
  - Changes: Call ExtractionService for content extraction
  - Acceptance: Hook uses service for extraction

### Testing for Phase 6

- [ ] **Task 6.5** 🔄 Create Hook Integration Tests
  - Prerequisites: Tasks 6.1-6.4
  - Deliverables:
    - `tests/integration/sidebar/hooks/useAIChat.test.tsx`
    - `tests/integration/sidebar/hooks/useTabExtraction.test.tsx`
  - Tools: @testing-library/react, mocked services
  - Acceptance: Hooks work with mocked services

**Synchronization Point**: UI layer thin, all orchestration in services

- Acceptance: UI renders and streams; manual smoke (send, cancel, switch provider, tab extraction); no visual regressions

---

## Phase 7: Config & Models Consolidation [Day 0.5]

- [ ] **Task 7.1** ⚡ Verify Models Configuration
  - Prerequisites: None
  - File: `src/config/models.ts`
  - Task: Confirm OpenAI-Compat provider IDs are single source of truth
  - Acceptance: No duplicate model definitions

- [ ] **Task 7.2** ⚡ Update Presets
  - Prerequisites: Task 7.1
  - File: `src/provider/openai-compat/presets.ts`
  - Changes: Ensure derives from config/models.ts
  - Acceptance: No preset drift from config

- [ ] **Task 7.3** 🔄 Create Drift Detection Test
  - Prerequisites: Task 7.2
  - Deliverable: `tests/unit/config/modelDrift.test.ts`
  - Coverage: Detect if presets diverge from config
  - Acceptance: Test fails if drift detected

**Synchronization Point**: Single source of truth for built-in models

- Acceptance: One truth for built-ins; compat providers still load from storage

---

## Phase 8: Testing & QA [Days 2-3]

### Integration Testing 🔄 (Can be parallel)

- [ ] **Task 8.1** 🔄 Create Transport Selection Tests
  - Prerequisites: Phase 2 complete
  - Deliverable: `tests/integration/transport-selection.test.ts`
  - Coverage: Proxy vs direct routing logic
  - Acceptance: Tests verify correct transport selection

- [ ] **Task 8.2** 🔄 Create Streaming Cancel Tests
  - Prerequisites: Phase 4 complete
  - Deliverable: `tests/integration/streaming-cancel.test.ts`
  - Coverage: Abort propagation through layers
  - Acceptance: Tests verify cancellation works

- [ ] **Task 8.3** 🔄 Create Provider Contract Tests
  - Prerequisites: Phase 3 complete
  - Description: Verify streaming chunk format consistency
  - Coverage: All providers return same chunk structure
  - Acceptance: Contract tests pass for all providers

### Manual Testing ⚡ (Sequential validation)

- [ ] **Task 8.4** ⚡ Manual Smoke Test Suite
  - Prerequisites: Phase 6 complete
  - Test flows:
    - Provider switching
    - Kimi streaming via proxy
    - Tab extraction with @-mention
    - Message cancellation
  - Documentation: Record results in test log
  - Acceptance: All flows work as expected

- [ ] **Task 8.5** ⚡ Performance Benchmarking
  - Prerequisites: Task 8.4
  - Metrics:
    - Proxy vs direct latency
    - Streaming chunk rate
    - Memory usage
  - Acceptance: Performance within 10% of baseline

**Synchronization Point**: Test completeness and quality gates

- Acceptance: >90% coverage on touched files; performance within budgets; no regressions across providers

---

## Phase 9: Documentation [Day 0.5]

- [ ] **Task 9.1** 🔄 Create Architecture Documentation
  - Prerequisites: Phase 6 complete
  - Deliverable: `docs/architecture.md`
  - Content: Diagrams showing UI → services → provider/transport → platform
  - Acceptance: Accurately reflects new architecture

- [ ] **Task 9.2** 🔄 Update README
  - Prerequisites: Phase 6 complete
  - File: `README.md`
  - Changes: Add transport/services overview, feature flag docs
  - Acceptance: README reflects current architecture

---

## Phase 10: Rollout & Cleanup [Day 0.5]

### Beta Testing ⚡

- [ ] **Task 10.1** ⚡ Enable Feature Flag for Beta
  - Prerequisites: Phase 8 complete
  - File: `src/config/featureFlags.ts`
  - Change: Set refactorMode = true
  - Acceptance: Beta build uses new architecture

- [ ] **Task 10.2** ⚡ Beta Validation
  - Prerequisites: Task 10.1
  - Duration: Run for specified period
  - Monitoring: Track errors, performance
  - Acceptance: No critical issues found

### Cleanup ⚡ (Sequential - after validation)

- [ ] **Task 10.3** ⚡ Remove Re-export Stubs
  - Prerequisites: Task 10.2
  - Files: All stub files in src/provider/_/_ and src/tabext/extraction/\*
  - Changes: Update imports to use @core directly
  - Acceptance: No re-export stubs remain

- [ ] **Task 10.4** ⚡ Migrate Remaining Chrome APIs
  - Prerequisites: Phase 5 complete
  - Task: Find and replace remaining direct chrome.\* usage
  - Target: Use @platform/chrome/\* everywhere
  - Acceptance: No direct chrome.\* usage outside platform/

- [ ] **Task 10.5** ⚡ Final Build Validation
  - Prerequisites: Tasks 10.3-10.4
  - Commands: npm run typecheck && npm run lint && npm test && npm run build
  - Acceptance: All commands pass, extension works

- [ ] **Task 10.6** 🔄 Remove SDK Dependencies (Optional)
  - Prerequisites: Tasks 3.2-3.4
  - Description: If all providers use Transport successfully, remove SDK libraries and update imports
  - Acceptance: Build and tests pass without SDK dependencies; providers use Transport exclusively

---

## Critical Path Analysis

**Minimum Sequential Path**:

1. Phase 0 (Setup) → 0.5 days
2. Phase 1 (Core extraction) → Can parallelize most tasks
3. Phase 2 (Transport) → Some sequential dependencies
4. Phase 3 (Providers) → Depends on Phase 2
5. Phase 4 (Services) → Can parallelize, depends on Phase 3
6. Phase 6 (UI Hooks) → Depends on Phase 4
7. Phase 10 (Cleanup) → Final sequential phase

**Maximum Parallelization Opportunities**:

- Phase 1: 5 parallel groups (OpenAI, OpenAI-Compat, Gemini, OpenRouter, Extraction)
- Phase 4: 5 services can be created in parallel
- Phase 5: 6 platform wrappers can be created in parallel
- Phase 8: 3 integration test suites can run in parallel

## Risk Mitigation Notes

1. **Import Resolution Issues**: Always create re-export stub before moving file
2. **Type Mismatches**: Run typecheck after each task
3. **Runtime Errors**: Feature flag ensures fallback to working code
4. **Test Failures**: Each phase has isolated test suite
5. **Merge Conflicts**: Small, atomic tasks reduce conflict surface

## Success Metrics

- Zero behavior regressions
- All tests pass (>90% coverage on touched files)
- Performance within 10% of baseline
- No new required permissions
- Clean architecture with clear separation of concerns
