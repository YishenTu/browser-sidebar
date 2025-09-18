# Core module

Provider integrations, engine orchestration, and shared extraction utilities
live under `src/core/`.  The goal is to keep vendor-specific glue pure and
stateless while the rest of the extension talks to consistent interfaces.

## Structure

```
core/
├─ ai/                # Request builders, stream parsers, and error mappers per provider
├─ engine/            # Stateful engine classes built on top of the AI helpers
├─ extraction/        # Markdown conversion + analyzers reused by content + sidebar
├─ services/          # Provider-agnostic helpers (file uploads, model switching, tab sync)
└─ utils/             # Small shared helpers (token accounting, retry helpers, …)
```

### `ai/`

Each provider (OpenAI, Gemini, OpenRouter, OpenAI-compatible) gets its own
subfolder.  Modules here build HTTP payloads, parse streaming deltas into the
normalised `StreamChunk` shape, and translate vendor-specific errors into
`ProviderError` objects.  Everything is pure functions so unit tests can load
fixtures without mocking transports.

### `engine/`

Engines wrap the `ai/` helpers with lifecycle state:

* `BaseEngine` provides transport wiring, capability flags, and cancellation
  hooks.
* `EngineFactory` instantiates providers on demand (injecting
  `DirectFetchTransport` by default) and exposes convenience creators such as
  `createOpenAIProvider()`.
* `EngineRegistry` tracks registered providers and the active engine.  It is the
  backing store for `EngineManagerService`.

Provider-specific folders (e.g. `engine/openai/`) extend `BaseEngine` and expose
`streamChat()` implementations that yield normalised chunks consumed by the UI
and services.

### `extraction/`

Shared helpers used both by the content script and by any server-side tests:

* `markdownConverter.ts` turns DOM fragments into GitHub-flavoured Markdown with
  KaTeX/code block support.
* `analyzers/` (and `text.ts`) compute word counts, table/code detection, and
  summarised excerpts that feed the UI badges.

### `services/`

Lightweight utilities that sit underneath the higher-level `src/services/`
facades:

* `fileUpload.ts` normalises multi-part uploads before they reach a provider.
* `messageEditing.ts` prepares edit/regenerate payloads.
* `modelSwitching.ts` centralises logic for validating requested model changes.
* `tabContent.ts` stitches extracted tab payloads together before they are sent
  to providers that support multi-tab context.

### `utils/`

Contains small shared helpers (e.g. retry utilities) that do not warrant their
own package yet.  Keep them pure so they can be reused in both background and UI
contexts.

## Working with providers

When adding a new model/vendor:

1. Implement the request builder + stream parser under `ai/<provider>/`.
2. Create an engine in `engine/<provider>/` that extends `BaseEngine` and wires
   transports/capabilities.
3. Register the model in `config/models.ts` and expose any required defaults in
   `EngineFactory`.
4. Surface provider availability through `EngineManagerService` so the UI can
   toggle it at runtime.
