# Refactor Plan — Comprehensive Architecture Migration

Status: Ready to Execute (no code changes applied)  
Owner: You + collaborators  
Scope: Non-breaking, phased refactor that preserves behavior while modularizing the codebase

## Goals

- Thin React UI in `src/sidebar/`; move orchestration to services
- Introduce transport abstraction (direct fetch vs background proxy streaming)
- Isolate Chrome APIs behind typed platform wrappers
- Extract provider-agnostic logic into `src/core/*` with no `chrome.*` and minimal DOM dependencies
- Keep BYOK, minimal permissions, and current UX; feature-flagged rollout

## Non-Goals (for this refactor)

- UX redesigns or new flows
- New providers/models beyond what exists
- Storage schema changes for keys/settings

## Guardrails (System must keep working)

- Feature flag: `src/config/featureFlags.ts` → `refactorMode` (default false)
- Re-exports: Temporary barrels in old locations to keep imports stable during moves
- Each phase: green `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- Tests: >90% coverage on touched modules; add smoke/integration for streaming and extraction
- Permissions: no new defaults; optional host permissions for custom endpoints only

---

## Target Architecture

```
src/
  sidebar/                      # UI only (React, Shadow DOM)
  services/                     # Orchestration layer (no React)
    chat/ChatService.ts
    extraction/ExtractionService.ts
    provider/ProviderManagerService.ts
    keys/KeyService.ts
    session/SessionService.ts
  core/                         # Pure logic – no chrome.* or DOM
    ai/                         # builders, stream processors, error mapping
      openai/{requestBuilder.ts,streamProcessor.ts,responseParser.ts,errorHandler.ts,searchMetadata.ts}
      openai-compat/{requestBuilder.ts,streamProcessor.ts,errorHandler.ts}
      gemini/{requestBuilder.ts,streamProcessor.ts,responseParser.ts,errorHandler.ts,searchMetadata.ts}
      openrouter/{requestBuilder.ts,streamProcessor.ts,errorHandler.ts,types.ts}
      index.ts
    extraction/                 # cleaners, markdown conversion
      markdownConverter.ts
      analyzers/contentAnalyzer.ts
      text.ts
      index.ts
    types/
      index.ts
  transport/                    # Environment adapters
    types.ts
    DirectFetchTransport.ts
    BackgroundProxyTransport.ts
    policy.ts
    index.ts
  platform/chrome/              # Typed chrome.* wrappers
    runtime.ts
    tabs.ts
    storage.ts
    ports.ts
    messaging.ts
    keepAlive.ts
  provider/                     # Provider adapters (use core + transport)
  extension/                    # Background SW glue only
  tabext/                       # Content script glue (algorithms move to core/extraction)
```

### Key Abstractions

- **Transport**: `request(req)` / `stream(req)` with common request/response types
- **Services**: ChatService, ExtractionService, ProviderManagerService, KeyService, SessionService
- **Core**: Builders, stream processors, prompt/context assembly, markdown utilities
- **Platform**: Single place for chrome.\* quirks, timeouts, error normalization

### Path Aliases (tsconfig)

- Add: `@core/* → src/core/*`, `@transport/* → src/transport/*`, `@platform/* → src/platform/*`
- Keep existing aliases

---

## Phase Plan (Incremental, Non-Breaking)

Each phase lists: **Adds**, **Moves** (src → dst), **Changes** (edits), **Tests**, **Acceptance**.

### Phase 0 — Baseline + Feature Flag (0.5 day)

**Adds:**

- `src/config/featureFlags.ts`: `export const refactorMode = false;`
- Update `README.md` rollout notes (section only)

**Changes:**

- `tsconfig.json`: add path aliases `@core/*`, `@transport/*`, `@platform/*`
- `vitest.config.ts`: ensure `alias` mirrors tsconfig (if not already via TS paths plugin)
- `manifest.json`: no permission changes; confirm background keepAlive remains

**Tests:**

- None new; record pre-refactor screenshots/logs for streaming/extraction smoke

**Acceptance:**

- Build, typecheck, lint pass; extension loads and functions unchanged

---

### Phase 1 — Extract Pure Logic into core/\* (1–2 days)

**Adds:**

- `src/core/ai/index.ts` (barrel)
- `src/core/extraction/index.ts` (barrel)
- `src/core/extraction/text.ts` (from `tabext/utils/textUtils.ts`)

**Moves** (copy first; keep re-export stubs in old locations):

Provider low-level logic (pure):

- `src/provider/openai/requestBuilder.ts → src/core/ai/openai/requestBuilder.ts`
- `src/provider/openai/streamProcessor.ts → src/core/ai/openai/streamProcessor.ts`
- `src/provider/openai/responseParser.ts → src/core/ai/openai/responseParser.ts`
- `src/provider/openai/errorHandler.ts → src/core/ai/openai/errorHandler.ts`
- `src/provider/openai/searchMetadata.ts → src/core/ai/openai/searchMetadata.ts`
- `src/provider/openai-compat/requestBuilder.ts → src/core/ai/openai-compat/requestBuilder.ts`
- `src/provider/openai-compat/streamProcessor.ts → src/core/ai/openai-compat/streamProcessor.ts`
- `src/provider/openai-compat/errorHandler.ts → src/core/ai/openai-compat/errorHandler.ts`
- `src/provider/gemini/requestBuilder.ts → src/core/ai/gemini/requestBuilder.ts`
- `src/provider/gemini/streamProcessor.ts → src/core/ai/gemini/streamProcessor.ts`
- `src/provider/gemini/responseParser.ts → src/core/ai/gemini/responseParser.ts`
- `src/provider/gemini/errorHandler.ts → src/core/ai/gemini/errorHandler.ts`
- `src/provider/gemini/searchMetadata.ts → src/core/ai/gemini/searchMetadata.ts`
- `src/provider/openrouter/requestBuilder.ts → src/core/ai/openrouter/requestBuilder.ts`
- `src/provider/openrouter/streamProcessor.ts → src/core/ai/openrouter/streamProcessor.ts`
- `src/provider/openrouter/errorHandler.ts → src/core/ai/openrouter/errorHandler.ts`
- `src/provider/openrouter/types.ts → src/core/ai/openrouter/types.ts`

Extraction pure logic:

- `src/tabext/extraction/converters/markdownConverter.ts → src/core/extraction/markdownConverter.ts`
- `src/tabext/extraction/analyzers/contentAnalyzer.ts → src/core/extraction/analyzers/contentAnalyzer.ts`
- `src/tabext/utils/textUtils.ts → src/core/extraction/text.ts`

**Keep in place** (DOM-dependent; remain under tabext):

- `src/tabext/extraction/extractors/*`
- `src/tabext/extraction/orchestrator.ts`
- `src/tabext/extraction/analyzers/metadataExtractor.ts`
- `src/tabext/utils/domUtils.ts`

**Changes:**

- Create re-export stubs in original locations, e.g.:
  - `src/provider/openai/requestBuilder.ts`: `export * from '@core/ai/openai/requestBuilder';`
  - Same pattern for every moved file above
- `src/tabext/extraction/converters/markdownConverter.ts` becomes a re-export shim
- `src/tabext/extraction/analyzers/contentAnalyzer.ts` becomes a re-export shim
- `src/core/ai/index.ts`: export provider sub-barrels
- `src/core/extraction/index.ts`: export `markdownConverter`, `contentAnalyzer`, `text`

**Tests:**

- `tests/unit/core/ai/openai/streamProcessor.test.ts`
- `tests/unit/core/extraction/markdownConverter.test.ts`
- `tests/unit/core/extraction/contentAnalyzer.test.ts`
- `tests/unit/core/extraction/text.test.ts`

**Acceptance:**

- All existing imports still resolve via stubs; app behavior unchanged
- Unit tests for moved functions pass (Node env)
- Ensure no chrome/DOM imports in `core/*`

---

### Phase 2 — Transport Abstraction (2–3 days)

**Adds:**

- `src/transport/types.ts`:
  - `TransportRequest { url, method, headers, body?, stream?, signal? }`
  - `TransportResponse { status, statusText, headers, body? }`
  - `TransportStream = ReadableStream<Uint8Array> | AsyncIterable<string|Uint8Array>`
  - `Transport` interface with `request()` and `stream()`
- `src/transport/DirectFetchTransport.ts`
- `src/transport/BackgroundProxyTransport.ts` (Port-based SSE streaming)
- `src/transport/policy.ts` with `shouldProxy(url)`; default allowlist: `https://api.moonshot.cn` (Kimi)
- `src/transport/index.ts`

**Changes:**

- `src/extension/background/proxyHandler.ts`: import and use `shouldProxy` from `@transport/policy`
- `src/provider/openai-compat/ProxiedOpenAIClient.ts`: refactor to delegate to `BackgroundProxyTransport`
- `src/provider/openai-compat/OpenAICompatibleProvider.ts`: behind `refactorMode`, use `Transport`
- `tsconfig.json`: ensure `dom.iterable` lib present (needed for `ReadableStream` types)

**Tests:**

- `tests/unit/transport/policy.test.ts`
- `tests/unit/transport/directFetchTransport.test.ts`
- `tests/unit/transport/backgroundProxyTransport.test.ts` (mock `chrome.runtime.connect` and Port)

**Acceptance:**

- With flag off: unchanged behavior
- With flag on: Kimi streams via BackgroundProxyTransport with parity
- Unit tests for transport; mocked fetch/ports; abort propagation; error mapping

---

### Phase 3 — Providers on Transport (2–3 days)

**Changes:**

- `src/provider/openai/OpenAIProvider.ts`: behind flag, use `Transport` for API calls
- `src/provider/gemini/GeminiProvider.ts`: behind flag, use `Transport` for streaming
- `src/provider/openrouter/OpenRouterProvider.ts`: behind flag, use `Transport`
- `src/provider/ProviderFactory.ts`: inject `Transport` (default: DirectFetchTransport) under refactor mode
- `src/provider/BaseProvider.ts`: accept optional `transport` in constructor

**Deprecations:**

- Gate SDK path under old mode; use `fetch + Transport` under refactor mode

**Tests:**

- `tests/unit/provider/*/adapter.transport.test.ts` (mock transport; assert streaming chunk contract)

**Acceptance:**

- Providers still stream with parity; switching flag toggles old/new path
- Provider smoke tests with mocked Transport pass

---

### Phase 4 — Services Layer (3–4 days)

**Adds:**

- `src/services/chat/ChatService.ts`:
  - API: `stream(messages, options): AsyncIterable<StreamChunk>`
  - `cancel()`; inject active provider and `Transport`
- `src/services/extraction/ExtractionService.ts`:
  - API: `extractCurrentTab(options)`, `extractTabs(tabIds, options)`
  - Messaging to background for multi-tab; retries
- `src/services/provider/ProviderManagerService.ts`:
  - Wraps `ProviderRegistry` lifecycle
  - Initialize from settings; expose `getActive`, `switch`, `getStats`
- `src/services/keys/KeyService.ts`:
  - Reads/writes via `@data/storage`
  - Validates via `Transport` for CORS endpoints (e.g., Kimi)
- `src/services/session/SessionService.ts`:
  - Session keys and tab+URL mapping for stores

**Changes:**

- `src/provider/ProviderRegistry.ts` stays; used by manager service

**Tests:**

- `tests/unit/services/chatService.test.ts`
- `tests/unit/services/providerManagerService.test.ts`
- `tests/unit/services/extractionService.test.ts`
- `tests/unit/services/keyService.test.ts`
- `tests/unit/services/sessionService.test.ts`

**Acceptance:**

- Services compile and are callable from hooks; no UI changes yet
- Unit tests for each service with mocks (transport, platform, storage)

---

### Phase 5 — Platform Wrappers (1–2 days)

**Adds:**

- `src/platform/chrome/runtime.ts`: typed `sendMessage`, event helpers, error normalization
- `src/platform/chrome/tabs.ts`: `getActiveTabId`, `sendMessageToTab`, query utilities
- `src/platform/chrome/storage.ts`: strongly typed wrapper
- `src/platform/chrome/ports.ts`: open/close/reconnect patterns for long-lived ports
- `src/platform/chrome/messaging.ts`: `MessageBus` re-wrapped with unified types
- `src/platform/chrome/keepAlive.ts`: wrapper around `extension/background/keepAlive` logic

**Changes:**

- No mass replace yet; new code uses wrappers; existing code remains until Phase 10

**Tests:**

- Node shims with `vi.fn()` mocks for chrome APIs
- `tests/unit/platform/*.test.ts`

**Acceptance:**

- New wrappers integrate without behavior change
- Unit tests for wrappers pass (shim in Node)

---

### Phase 6 — Thin UI Hooks (2–3 days)

**Changes:**

- `src/sidebar/hooks/ai/useAIChat.ts`: replace direct provider orchestration with `ChatService`
- `src/sidebar/hooks/ai/useProviderManager.ts`: delegate to `ProviderManagerService`
- `src/sidebar/hooks/ai/useMessageHandler.ts`: use `ChatService.handleStreamingResponse`
- `src/sidebar/hooks/useTabExtraction.ts`: call `ExtractionService`
- Ensure components only talk to stores + services; no direct `chrome.*` or `fetch`

**Tests:**

- Interaction tests with `@testing-library/react` + mocked services
- `tests/integration/sidebar/hooks/*.test.tsx`

**Acceptance:**

- UI renders and streams; manual smoke: send, cancel, switch provider, tab extraction
- UI still compiles and streams; e2e smoke across providers; no visual regressions

---

### Phase 7 — Config & Models Consolidation (0.5–1 day)

**Changes:**

- `src/config/models.ts`: confirm OpenAI-Compat provider IDs remain single source of truth
- `src/provider/openai-compat/presets.ts`: ensure it derives from `config/models.ts`

**Tests:**

- Unit assertions to detect preset drift

**Acceptance:**

- One truth for built-ins; compat providers still load from storage

---

### Phase 8 — Testing & QA (2–3 days)

**Adds:**

- Integration tests for transport selection (proxy vs direct) and cancel/abort propagation
- Contract tests for streaming chunk format across providers
- Smoke e2e (optional) with stub servers
- `tests/integration/transport-selection.test.ts`
- `tests/integration/streaming-cancel.test.ts`

**Acceptance:**

- > 90% coverage on touched files; performance within budgets; no regressions
- Manual: provider switching, Kimi streaming via proxy, extraction and @-mention
- Performance: measure overhead of proxy streaming vs direct

---

### Phase 9 — Documentation (0.5–1 day)

**Adds:**

- `docs/architecture.md` (diagrams: UI → services → provider/transport → platform)
- Update root `README.md` with transport/services overview and feature flag

**Acceptance:**

- Documentation accurately reflects new architecture

---

### Phase 10 — Rollout & Cleanup (0.5–1 day)

**Changes:**

- Enable `refactorMode` for a beta build
- Replace re-export stubs with direct imports; delete deprecated files:
  - Remove stubbed copies under `src/provider/*/*` that only re-export core
  - Remove stubbed copies under `src/tabext/extraction/*` that re-export core
- Migrate any remaining direct `chrome.*` usage to `@platform/chrome/*`
- Optionally remove SDK dependencies if fully on `fetch + Transport`

**Acceptance:**

- Default build uses new stack; permissions unchanged; all tests pass

---

## Concrete File Movement Matrix

### Moves to `src/core/ai/openai/`

- `src/provider/openai/requestBuilder.ts`
- `src/provider/openai/streamProcessor.ts`
- `src/provider/openai/responseParser.ts`
- `src/provider/openai/errorHandler.ts`
- `src/provider/openai/searchMetadata.ts`

### Moves to `src/core/ai/openai-compat/`

- `src/provider/openai-compat/requestBuilder.ts`
- `src/provider/openai-compat/streamProcessor.ts`
- `src/provider/openai-compat/errorHandler.ts`

### Moves to `src/core/ai/gemini/`

- `src/provider/gemini/requestBuilder.ts`
- `src/provider/gemini/streamProcessor.ts`
- `src/provider/gemini/responseParser.ts`
- `src/provider/gemini/errorHandler.ts`
- `src/provider/gemini/searchMetadata.ts`

### Moves to `src/core/ai/openrouter/`

- `src/provider/openrouter/requestBuilder.ts`
- `src/provider/openrouter/streamProcessor.ts`
- `src/provider/openrouter/errorHandler.ts`
- `src/provider/openrouter/types.ts`

### Moves to `src/core/extraction/`

- `src/tabext/extraction/converters/markdownConverter.ts → markdownConverter.ts`
- `src/tabext/extraction/analyzers/contentAnalyzer.ts → analyzers/contentAnalyzer.ts`
- `src/tabext/utils/textUtils.ts → text.ts`

### Stays (tab/content specific)

- `src/tabext/extraction/extractors/*`
- `src/tabext/extraction/orchestrator.ts`
- `src/tabext/extraction/analyzers/metadataExtractor.ts`
- `src/tabext/utils/domUtils.ts`

### Transport (new)

- `src/transport/{types.ts,DirectFetchTransport.ts,BackgroundProxyTransport.ts,policy.ts,index.ts}`

### Platform (new wrappers)

- `src/platform/chrome/{runtime.ts,tabs.ts,storage.ts,ports.ts,messaging.ts,keepAlive.ts}`

### Services (new)

- `src/services/chat/ChatService.ts`
- `src/services/extraction/ExtractionService.ts`
- `src/services/provider/ProviderManagerService.ts`
- `src/services/keys/KeyService.ts`
- `src/services/session/SessionService.ts`

### Hooks to refactor (no moves)

- `src/sidebar/hooks/ai/useAIChat.ts`
- `src/sidebar/hooks/ai/useProviderManager.ts`
- `src/sidebar/hooks/ai/useMessageHandler.ts`
- `src/sidebar/hooks/useTabExtraction.ts`

---

## Build/Config Touch Points

- `tsconfig.json`: add `@core/*`, `@transport/*`, `@platform/*` paths
- `vitest.config.ts`: ensure aliases if needed
- `manifest.json`: confirm no new permissions

---

## Testing Strategy

### Unit Tests

- Core: `tests/unit/core/**`
- Transport: `tests/unit/transport/**`
- Platform: `tests/unit/platform/**`
- Services: `tests/unit/services/**`
- Providers: `tests/unit/provider/**`

### Integration Tests

- `tests/integration/transport-selection.test.ts`
- `tests/integration/streaming-cancel.test.ts`
- `tests/integration/sidebar/hooks/*.test.tsx`

### E2E Tests (optional)

- Extension harness with stub servers for provider APIs

### Performance Tests

- End-to-end latency and chunk rate measurements
- Memory growth monitoring

---

## Acceptance Checklist (per PR)

- [ ] No behavior regressions (manual smoke across providers + extraction)
- [ ] Tests, lint, typecheck, build pass
- [ ] Permissions unchanged
- [ ] Docs updated if imports or public APIs moved
- [ ] Rollback path documented in PR description
- [ ] Feature flag honored

---

## Risks & Mitigations

| Risk                  | Mitigation                                                                         |
| --------------------- | ---------------------------------------------------------------------------------- |
| Wide diffs/merge pain | Use re-export shims, land in phases, keep imports stable until Phase 10            |
| SW/Port flakiness     | `@platform/chrome/ports.ts` centralizes reconnect/backoff; clear error surfaces    |
| SDK stream handling   | Prefer `fetch + Transport` with SSE parsing; keep SDK path under flag until parity |
| Permission bloat      | Proxy only allowlisted domains; optional permissions for custom                    |

---

## Rollback Plan

- Toggle `refactorMode` off to stay on legacy path
- Revert last phase PR only; earlier phases remain isolated via shims
- Feature flag off → old paths remain intact via re-exports

---

## Timeline (Conservative)

- **Weeks 1–2**: Phases 0–3 (baseline, core, transport, providers)
- **Week 3**: Phases 4–5 (services, platform)
- **Week 4**: Phases 6–7 (UI thin hooks, config consolidation)
- **Week 5**: Phases 8–10 (tests, docs, rollout)

---

## Definition of Done

- All providers work (OpenAI, Gemini, OpenRouter, OpenAI-Compat), including true SSE streaming for Kimi
- UI compiles with thin hooks; no direct `chrome.*`/`fetch` in components
- Providers compile in isolation with mocked Transport (unit tests pass)
- No new default host permissions; only allowlisted proxy domains
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` are green
- Manual smoke passes: key save/verify, model switch, send message, tab extraction, streaming

---

## Legend

- **Add**: new file or directory
- **Move**: relocate file; keep a stub re-export in original location until cleanup
- **Change**: edit file in place

> **Principle**: System works today; it must work after each phase. No big-bang merges.
