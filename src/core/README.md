# Core Module

Central business logic for the AI Browser Sidebar: provider adapters, engine wrappers, and extraction helpers.

## Overview

The core module separates provider protocol glue from runtime orchestration:

- `ai/` contains stateless, provider‑specific helpers (build requests, parse streams, map errors).
- `engine/` contains stateful provider classes that implement a common interface, hold config, and wire transports. Engines call into `ai/` to talk to each vendor.
- `extraction/` contains HTML → Markdown conversion and lightweight analyzers used by content extraction.

This split lets us keep protocol details testable and isolated while giving the app a uniform, class‑based provider surface.

## Structure

```
core/
├── ai/                      # Provider protocol helpers (stateless)
│   ├── openai/              # Request builders, stream processors, error mappers
│   ├── gemini/
│   ├── openrouter/
│   └── openai-compat/
├── engine/                  # Stateful providers + orchestration
│   ├── BaseEngine.ts        # Shared lifecycle, validation, streaming wrapper
│   ├── EngineFactory.ts     # Creates providers, injects transport
│   ├── EngineRegistry.ts    # Register/set active provider
│   ├── openai/              # OpenAIProvider.ts (uses ai/openai/*)
│   ├── gemini/              # GeminiProvider.ts (uses ai/gemini/*)
│   ├── openrouter/          # OpenRouterProvider.ts (uses ai/openrouter/*)
│   └── openai-compat/       # OpenAICompatibleProvider.ts
└── extraction/              # HTML→Markdown + analyzers
    ├── analyzers/
    ├── markdownConverter.ts
    └── text.ts
```

Note: Earlier docs referenced a `ChatEngine.ts` and additional extraction orchestration files—those no longer exist. The current entry points are the provider classes under `engine/` and the helpers under `extraction/`.

## ai vs engine

- ai (stateless)
  - Build HTTP payloads for each vendor (e.g., `ai/openai/requestBuilder.ts`).
  - Parse vendor streaming events into a normalized delta (`ai/*/streamProcessor.ts`).
  - Map vendor errors to `ProviderError` (`ai/*/errorHandler.ts`).
  - No transport, no app state; pure, easily unit‑tested logic.

- engine (stateful)
  - Provider classes extend `BaseEngine` (config, capability flags, validation, rate limiting hooks).
  - Inject a `Transport` (default: `DirectFetchTransport`) and call `ai/` helpers to perform requests.
  - Yield normalized `StreamChunk` objects consumed by the UI.
  - Factory/Registry manage creation and selection: `EngineFactory.ts`, `EngineRegistry.ts`.

Data flow

```
ProviderChatMessage[]
  → engine/<Provider>.streamChat(...)
    → ai/<provider>/requestBuilder → Transport.stream(fetch ...)
      → ai/<provider>/streamProcessor → StreamChunk → UI
```

## Usage

Create and register a provider

```ts
import { EngineFactory } from '@core/engine/EngineFactory';
import { EngineRegistry } from '@core/engine/EngineRegistry';
import type { ProviderChatMessage } from '@/types/providers';

const factory = new EngineFactory();
const registry = new EngineRegistry();

// Example: OpenAI
await factory.createAndRegister(
  { type: 'openai', config: { apiKey: 'sk-...', model: 'gpt-5-nano' } },
  registry
);

registry.setActiveProvider('openai');
const provider = registry.getActiveProvider();

const messages: ProviderChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Hello!', timestamp: new Date() },
];

for await (const chunk of provider!.streamChat(messages, { systemPrompt: 'Be concise.' })) {
  // chunk.choices[0].delta.content / delta.thinking, etc.
}
```

Direct creation helpers also exist in the factory, e.g. `createOpenAIProvider`, `createGeminiProvider`.

## When to add code

- Add to `core/ai/<provider>/` when:
  - The vendor’s payload shape, SSE event format, or error mapping changes.
  - You need request/response utilities that are provider‑specific and stateless.

- Add to `core/engine/<provider>/` when:
  - Introducing a new provider class or wiring config/transport/capabilities.
  - You need to expose a consistent `streamChat` that uses `ai/` helpers.

- Add/adjust models in `src/config/models.ts` when introducing model IDs, defaults, or capability flags.

## Transports

- `DirectFetchTransport` (default) performs fetch with streaming.
- `BackgroundProxyTransport` can proxy via the extension background if needed.
  Engines receive a transport (factory injects `DirectFetchTransport` by default).

## Testing

- Unit tests for protocol helpers live under `tests/unit/core/ai/**` (request builders, stream processors, mappers).
- Run with `npm test` or `npm run test:watch`.

## Notes and tips

- OpenAI Responses API: we send `tools: [{ type: 'web_search' }]` by default and stream reasoning/thinking when supported. Search metadata is surfaced via chunk metadata (see `ai/openai/responseParser.ts`).
- Keep `ai/` functions pure and side‑effect free; engines own state and validation.
- Use path aliases (`@core`, `@config`, `@transport`, etc.).
