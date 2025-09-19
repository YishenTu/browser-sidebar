# Services Module

Services are thin facades that orchestrate core logic, storage, and Chrome APIs. They keep React components and background code free from low-level details.

## Layout

```
services/
├─ chat/        # Provider-agnostic streaming orchestrator
├─ engine/      # Engine manager + validation helpers
├─ extraction/  # Background-mediated extraction service
├─ keys/        # BYOK helpers (live validation, migration bridge)
└─ session/     # Session key helpers + lifecycle management
```

## Chat Service (`chat/ChatService.ts`)

- Streams responses from the active engine (async generator).
- Handles cancel (AbortController), retry, and error normalization.
- Converts chunks into UI-friendly `StreamChunk` objects.

## Engine Manager (`engine/EngineManagerService.ts`)

- Singleton that creates + registers providers via `EngineFactory`.
- Auto-initializes providers from saved settings + compat provider registry.
- Tracks usage statistics (requests, tokens, errors, response times) per provider.
- Emits events on provider lifecycle changes and exposes health snapshots.
- Includes helpers (`switch`, `initializeFromSettings`, `registerListener`) for UI hooks.
- Validation helpers (`validateOpenAIKey`, `validateGeminiKey`, `validateOpenRouterKey`, `validateCompatProvider`) use `KeyService` and transport policy.

## Extraction Service (`extraction/ExtractionService.ts`)

- Sidebar-facing wrapper around background extraction.
- Supports current-tab auto extraction, manual multi-tab extraction, and batch operations.
- Adds retry/backoff, error classification (`ExtractionErrorType.*`), and TabContent formatting.
- Exposes convenience functions `extractCurrentTab`, `extractTabs`, plus instance methods.

## Key Service (`keys/KeyService.ts`)

- Provides live API key validation and metadata helpers.
- Encrypts/decrypts using `data/security/crypto` when storing keys (bridge for legacy flows).
- Modern storage should use `@data/storage/keys`; `KeyService` remains useful for validation in Settings and migration scripts.

## Session Service (`session/SessionService.ts`)

- Generates deterministic session keys (`tab_{id}:{normalizedUrl}`).
- Offers comparison, cleanup, and custom normalization options.
- Used by the session store and background tab cleanup.

## Patterns

- Services return plain objects/promises so they can run in background, content, or UI contexts.
- Avoid React or DOM dependencies; combine services in hooks/components as needed.
- Add Vitest coverage under `tests/unit/services/**` when introducing new behavior.
