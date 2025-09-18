# Services

`src/services/` exposes high-level facades that the React sidebar and tests use
to talk to the underlying engines, storage, and Chrome APIs.  They hide
transport details and coordinate state with the Zustand stores from `@data`.

## Directory

```
services/
├─ chat/        # ChatService + factories for streaming provider responses
├─ engine/      # EngineManager singleton and validation helpers
├─ extraction/  # ExtractionService and convenience helpers for tab scraping
├─ keys/        # KeyService (BYOK encryption/validation)
└─ session/     # SessionService for deterministic tab session management
```

### Chat (`chat/`)

* `ChatService` wraps an `AIProvider` and exposes a streaming API with built-in
  cancellation and error normalisation.
* Factories `createChatService()` and `createChatServiceWithProvider()` simplify
  bootstrapping in hooks/tests.
* When a `Transport` is provided, the service ensures engines derived from
  `BaseEngine` receive it via `setTransport`.

### Engine (`engine/`)

* `EngineManagerService` is a singleton that initialises providers from
  `config/models.ts`, keeps track of the active engine, and records usage stats.
* The service understands OpenAI-compatible providers via
  `data/storage/keys/compat` and can switch models on demand.
* `ValidationService.ts` exports helpers (`validateOpenAIKey`,
  `validateGeminiKey`, `validateCompatProvider`, …) that probe provider APIs via
  the correct transport (direct or background proxy).

### Extraction (`extraction/`)

* `ExtractionService` talks to the background worker using typed messages,
  applies retry logic, and exposes helpers like `extractCurrentTab()` and
  `extractTabs()`.
* Convenience exports `extractCurrentTab` / `extractTabs` share a default
  instance so UI code can use simple functions when dependency injection is not
  needed.

### Keys (`keys/`)

* `KeyService` encrypts API keys with AES-GCM, stores them via
  `data/storage/chrome`, and validates them against provider endpoints (honouring
  the proxy policy).
* Methods cover the full lifecycle: `initialize`, `set/get/remove`,
  `listProviders`, `getMetadata`, `validate`, `clearAll`, and `shutdown`.
* The default export is an alias of the class to ease migration from older code.

### Session (`session/`)

* `SessionService` generates deterministic session keys (`tab_<id>:<url>`),
  surfaces helpers (`getSessionInfo`, `clearSession`, `cleanupInactiveSessions`),
  and proxies to `useSessionStore` for actual data mutation.
* The module exports a default `sessionService` instance plus
  `createSessionService(config)` for scenarios that need custom URL normalisation.

## Usage

All service modules re-export their public surface from `services/index.ts`:

```ts
import { ChatService, EngineManagerService, extractCurrentTab, KeyService, sessionService } from '@services';
```

This keeps imports ergonomic and makes it easy to stub services in tests.
