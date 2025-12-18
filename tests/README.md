# Test Suite

This document describes the testing strategy, structure, and guidelines for the browser-sidebar project.

## Goals & Scope

- Focus on deterministic core logic (no E2E tests)
- Prioritize unit tests; use minimal integration/contract tests for cross-module behavior
- Primary coverage modules:
  - `src/core/**` (ai, engine, extraction, services, utils)
  - `src/transport/**`
  - `src/data/security/**` (crypto / masking)
  - `src/data/storage/**` (chrome wrapper + key vault)
  - `src/shared/**`
  - `src/types/**` (pure validators/serializers)
  - `src/services/**` (service orchestration, avoiding UI)
  - `src/extension/messaging/**` (MessageBus retry/timeout logic)

### Out of Scope

- Browser E2E (real Chrome, real tabs, real content scripts)
- Real network calls (providers, key validation endpoints)
- UI snapshot tests (React components)

## Hard Constraints

- **No real network by default** - All tests run with network disabled
- **Deterministic time/randomness** - Tests involving time/random must be controllable and reproducible
- **Test isolation** - Tests must be isolated (stores/singletons/caches)
- **Zustand reset convention** - Any test file touching zustand stores must call `resetAllStores()` from `@tests/helpers/zustand` in `beforeEach`
- **Minimal mocking** - Only mock external boundaries (fetch/transport/chrome/storage); keep core logic real

## Test Layers

### Unit Tests

- Pure functions, parsers, request builders, policy/rules, state machines
- Dependencies mocked only at boundaries

### Integration Tests (Non-E2E)

- Multiple real modules connected, but boundaries still stubbed:
  - providers + transport stub
  - services + chrome/runtime stub
  - storage wrappers + platform storage stub

### Contract Tests (Shape Lock)

- "input shape → output shape" tests to prevent subtle regressions:
  - streaming event formats
  - request payload formats (sections/media)
  - error normalization semantics

**Contract gates** (must pass when modifying related code):

- `tests/integration/providers/*.stream.test.ts` - provider streaming output shape
- `tests/unit/core/ai/*/streamProcessor.test.ts` - chunk assembly/flush semantics
- `tests/unit/core/ai/*/requestBuilder.test.ts` - request payload shape
- `tests/unit/transport/*.test.ts` - timeout/abort/error mapping
- `tests/unit/types/storage.test.ts` - serialization + migrations shape

## Directory Structure

```
tests/
  setup/
    setup.ts              # Global test setup (network blocking, polyfills, cleanup)
  helpers/
    chrome.ts             # Chrome API stubs
    streams.ts            # Async iterable helpers, SSE/NDJSON builders
    time.ts               # Time freezing, Math.random mocking, promise flushing
    transport.ts          # Transport stubs with call capture
    zustand.ts            # Store reset helpers
  fixtures/
    messages.ts           # ProviderChatMessage, sections, attachments
    openai.ts             # OpenAI Responses API streaming events, SSE chunks
    gemini.ts             # Gemini array mode + SSE/NDJSON mixed chunks
    html.ts               # HTML samples for markdown conversion
    storage.ts            # Serialize/deserialize samples
  unit/
    core/...
    transport/...
    data/...
    shared/...
    types/...
    services/...
    extension/...
  integration/
    providers/...
    services/...
```

## Setup & Helpers

### Global Setup (`tests/setup/setup.ts`)

- **Network blocking**: Stubs `globalThis.fetch` to throw unless explicitly overridden
- **Polyfills** (when missing):
  - `globalThis.crypto` (Node webcrypto)
  - `TextEncoder` / `TextDecoder`
  - `Blob` (File provided by jsdom)
- **Chrome stub**: Minimal `globalThis.chrome` stub (runtime/tabs/storage)
- **IndexedDB**: `fake-indexeddb/auto` loaded for indexedDB access
- **Cleanup**: `afterEach` restores mocks and timers

### Helper Modules

| Helper         | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `time.ts`      | `freezeTime()`, `unfreezeTime()`, `mockMathRandom()`, `flushPromises()` |
| `streams.ts`   | `stringChunksToAsyncIterable()`, SSE/NDJSON chunk builders              |
| `transport.ts` | `createTransportStub({ request, stream })` with call capture            |
| `chrome.ts`    | `createChromeStub()`, `createPortStub()` for MV3 port streaming         |
| `zustand.ts`   | `resetSessionStore()`, `resetSettingsStore()`, etc.                     |

## Running Tests

```bash
# Recommended order
npm run typecheck     # Type checking first
npm run lint          # Linting
npm test              # Run all tests
npm run test:coverage # Coverage report

# Development
npm run test:watch    # Watch mode
npm run test:ui       # Interactive Vitest UI

# Run specific tests
npm test -- tests/unit/core/extraction/markdownConverter.test.ts
```

## Test Coverage by Priority

### P0 - Infrastructure & Highest Risk

Core infrastructure and highest-value/risk tests:

| Test File                                        | Focus Areas                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `unit/core/services/messageQueueService.test.ts` | Message lifecycle, blocking rules, attachment merge, waitUntilIdle, upload timeout, queue limits |
| `unit/core/ai/gemini/streamProcessor.test.ts`    | Mode detection, cross-chunk JSON assembly, escaping, malformed input handling                    |
| `unit/core/ai/openai/streamProcessor.test.ts`    | Reasoning delta streaming, web search events, content delta extraction, completion metadata      |
| `unit/core/ai/openai/responseParser.test.ts`     | Content extraction, reasoning summary, usage conversion, finish reason mapping                   |
| `unit/core/ai/gemini/requestBuilder.test.ts`     | Generation config, thinkingLevel vs thinkingConfig, API URL building, message conversion         |
| `unit/core/ai/openai/requestBuilder.test.ts`     | System prompt priority, previous_response_id branching, sections mapping, reasoning params       |
| `unit/transport/policy.test.ts`                  | shouldProxy rules, domain validation, allowlist/denylist precedence                              |
| `unit/data/security/crypto.test.ts`              | Key generation, encrypt/decrypt roundtrip, error paths, validation                               |
| `unit/types/storage.test.ts`                     | Serialize/deserialize roundtrip, migrations, cache helpers                                       |
| `unit/shared/urlNormalizer.test.ts`              | URL normalization, session key parsing                                                           |
| `unit/shared/restrictedUrls.test.ts`             | Restricted schemes/domains, parse failure handling                                               |
| `unit/core/utils/textProcessing.test.ts`         | Slash/mention detection, search limits, insertion helpers                                        |
| `unit/core/engine/EngineRegistry.test.ts`        | Register/unregister, event emission, provider validation                                         |
| `unit/core/services/responseIdManager.test.ts`   | Provider switch cleanup, supported providers, no-op safety                                       |
| `unit/data/storage/chrome.test.ts`               | Retry behavior, serialization, onChanged listener                                                |
| `unit/data/storage/keys/operations.test.ts`      | CRUD semantics, integrity validation, cache behavior                                             |

### P1 - Broader Core Coverage

| Test File                                                | Focus Areas                                          |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `unit/core/extraction/markdownConverter.test.ts`         | Code fences, link handling, footnotes, fallback path |
| `unit/core/extraction/analyzers/contentAnalyzer.test.ts` | Code/table detection, excerpt normalization          |
| `unit/core/extraction/text.test.ts`                      | clampText boundaries and errors                      |
| `unit/core/services/messageEditing.test.ts`              | Edit priority rules, metadata builders               |
| `unit/core/services/messageProcessing.test.ts`           | Message filtering, first-message branching           |
| `unit/core/services/modelSwitching.test.ts`              | Availability gate, rollback, onApiKeyMissing         |
| `unit/core/services/tabContent.test.ts`                  | Tab info derivation, multi-tab helpers               |
| `unit/core/utils/geometry.test.ts`                       | Bounds clamping, resize handle math                  |
| `unit/core/utils/positionCalculation.test.ts`            | Flip logic, padding, caret mode, scroll              |
| `unit/core/utils/layoutCalculations.test.ts`             | Rounding and layout invariants                       |
| `unit/core/utils/hotkeys.test.ts`                        | Modifier matching, digit/F-keys                      |
| `unit/core/utils/favicon.test.ts`                        | Domain extraction, fallback ordering                 |
| `unit/core/utils/errorUtils.test.ts`                     | Classification precedence, keywords                  |
| `unit/types/apiKeys.test.ts`                             | Masking, ID generation, type guards                  |
| `unit/types/providers.validation.test.ts`                | Config validation, error aggregation                 |
| `unit/services/chat/ChatService.test.ts`                 | Validation, cancel, error formatting                 |
| `unit/services/session/SessionService.test.ts`           | Config validation, cleanup, error wrapping           |

### P2 - Extended Coverage

| Test File                                           | Focus Areas                                               |
| --------------------------------------------------- | --------------------------------------------------------- |
| `unit/transport/DirectFetchTransport.test.ts`       | Timeout/abort/network error mapping, stream errors        |
| `unit/transport/BackgroundProxyTransport.test.ts`   | Error paths, streaming order, abort cleanup               |
| `unit/core/services/fileUpload.test.ts`             | Provider branching, argument mapping                      |
| `unit/core/services/imageUploadService.test.ts`     | Cache, dataUrl→File, queue interaction                    |
| `unit/core/services/imageSyncService.test.ts`       | needsSync detection, map keying, merge semantics          |
| `unit/core/ai/openrouter/requestBuilder.test.ts`    | Reasoning payload, cache_control insertion                |
| `unit/core/ai/openai-compat/requestBuilder.test.ts` | Sections mapping, system prompt, stream default           |
| `unit/core/ai/grok/requestBuilder.test.ts`          | previous_response_id branching, system override           |
| `unit/extension/messaging/MessageBus.test.ts`       | Retry/backoff, fake timer shortcuts, error classification |
| `unit/core/utils/screenshot.test.ts`                | Retry loop, clipboard API errors                          |
| `unit/data/security/masking.smoke.test.ts`          | Smoke tests for main public APIs                          |

### Integration Tests

| Test File                                             | Real Modules                                      | Stubbed                  | Assertions                                 |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------ | ------------------------------------------ |
| `integration/providers/OpenAIProvider.stream.test.ts` | OpenAIProvider, StreamProcessor                   | transport.stream()       | StreamChunk sequence, final metadata       |
| `integration/providers/GeminiProvider.stream.test.ts` | GeminiProvider, StreamProcessor, response parsing | transport.stream()       | Finish chunk, no delta loss                |
| `integration/services/ExtractionService.test.ts`      | ExtractionService                                 | chrome.runtime messaging | Error types, service creation, batch edges |
| `integration/services/EngineManagerService.test.ts`   | EngineManagerService                              | factory/providers        | Initialize/switch/stats/events             |

## Writing New Tests

1. Place tests in the appropriate directory based on the module location
2. Follow the naming convention: `<module>.test.ts`
3. Use helpers from `tests/helpers/` for common operations
4. Use fixtures from `tests/fixtures/` for test data
5. Reset stores in `beforeEach` when testing stateful code
6. Mock only at boundaries - keep core logic real
7. Use fake timers for time-dependent tests
