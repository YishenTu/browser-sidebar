# Core Module

Pure business logic for the AI Browser Sidebar: provider adapters, engine wrappers, extraction helpers, and reusable services that remain UI-agnostic. The goal is that everything here can run in isolation (Vitest, node, or background contexts) without touching the DOM.

## Layout

```
core/
├── ai/                 # Vendor-specific request builders, stream decoders, error mappers
├── engine/             # Stateful provider classes + registry/factory helpers
├── extraction/         # Markdown converter, analyzers, shared extraction utils
├── services/           # Cross-cutting services (message editing, screenshots, model switching, ...)
└── utils/              # Pure utilities (geometry, text processing, hotkeys, screenshots, ...)
```

## ai/

Each provider folder (openai, gemini, openrouter, openai-compat) contains stateless helpers:

- `requestBuilder.ts` / `payload.ts` — Shape provider-friendly payloads.
- `streamProcessor.ts` — Parse SSE/token streams into normalized `StreamChunk`s.
- `errorHandler.ts` — Map provider errors to `ProviderError`.

No transports or state live here; everything is deterministic and testable.

## engine/

- `BaseEngine.ts` — Shared lifecycle, input validation, streaming helpers, capability flags.
- `EngineFactory.ts` — Creates engines with injected transports and provider config.
- `EngineRegistry.ts` — Tracks registered providers, active provider switching.
- Provider folders (`openai`, `gemini`, `openrouter`, `openai-compat`) extend `BaseEngine` and use the `ai/` helpers.

Engines expose async iterators for chat streaming, metadata accessors (rate limits, reasoning support), and integrate with the transport policy.

## extraction/

- `markdownConverter.ts` — HTML → GitHub Flavored Markdown (tables, code fences, math, link options).
- `analyzers/` — Content/metadata analyzers (table detection, summaries, metadata extraction).
- `text.ts` — Utility helpers shared between extractors and analyzers.

## services/

Reusable, UI-free helpers that orchestrate core features:

- `messageProcessing.ts` — Convert chat history into provider-ready payloads.
- `messageEditing.ts` — Apply edits/undo, build metadata, split assistant thoughts vs final replies.
- `messageQueueService.ts` — FIFO queue with concurrency guards for chat jobs.
- `modelSwitching.ts` — Validate model switches against provider capabilities.
- `fileUpload.ts` / `imageUploadService.ts` / `imageSyncService.ts` — Shared upload/sync orchestration (screenshots, future file attachments).
- `tabContent.ts` — Utilities for merging/sorting multi-tab extraction results.

Keep orchestration logic here when it is independent of React/DOM.

## utils/

Pure helpers with no side effects:

- `errorUtils.ts` — Network/auth classification, retry hints.
- `favicon.ts` — Resolve favicons safely (Google S2 + fallbacks).
- `geometry.ts` — Bounds/size constraints for draggable/resizable UI.
- `layoutCalculations.ts` — Initial sidebar layout math.
- `positionCalculation.ts` — Dropdown positioning relative to caret/viewport.
- `textProcessing.ts` — Slash command & @mention detection + insertion.
- `hotkeys.ts` — Parse and compare keyboard shortcuts (screenshot capture).
- `screenshot.ts` — Aspect ratio + downscaling helpers shared between capture and upload.

Everything here should be deterministic (same input → same output) to keep tests straightforward.

## Usage Patterns

```ts
import { EngineFactory } from '@core/engine/EngineFactory';
import { EngineRegistry } from '@core/engine/EngineRegistry';
import { detectSlashCommandInternal } from '@core/utils/textProcessing';
import { constrainPosition } from '@core/utils/geometry';
import { prepareMessageContent } from '@core/services/messageEditing';

const factory = new EngineFactory();
const registry = new EngineRegistry();
await factory.createAndRegister({ type: 'openai', config: {...} }, registry);

const slash = detectSlashCommandInternal('/summarize this', 10, { enabled: true, isComposing: false });
const bounds = constrainPosition({ x: 120, y: 240 }, { minX: 0, maxX: 600, minY: 0, maxY: 500 });
const contentPayload = prepareMessageContent(history, editorState);
```

## Design Principles

1. **Pure-by-default** — Utilities and services avoid DOM/browser APIs so they can run in Vitest or the background service worker.
2. **Separation of concerns** — Engines own provider state; `ai/` handles protocol details; `services/` orchestrate ongoing workflows.
3. **Strong typing** — All inputs/outputs align with `@/types` contracts.
4. **Testability** — New logic should land alongside targeted unit tests under `tests/unit/core/**`.

## When to Add Code Here

- Computation or orchestration that the UI or extension layer will call into repeatedly.
- Logic that could be reused by different front ends (sidebar, popup, background).
- Any functionality that must be tested without the DOM.

Keep UI bindings, side effects, and Chrome APIs in `sidebar/`, `content/`, `extension/`, or `platform/`.
