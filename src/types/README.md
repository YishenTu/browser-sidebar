# Shared types

This directory collects TypeScript definitions consumed by both the background
worker and the React UI.  Keeping them central avoids circular dependencies and
ensures all modules speak the same protocol.

## Contents

| File | Description |
| ---- | ----------- |
| `apiKeys.ts` | API key metadata, masking helpers, and provider enums |
| `chat.ts` | Chat message shapes and streaming delta types |
| `conversation.ts` | Conversation/session models persisted in stores |
| `extraction.ts` | `ExtractionMode`, `ExtractionOptions`, and `ExtractedContent` contracts |
| `manifest.ts` | Subset of MV3 manifest typings used at runtime |
| `messages.ts` | Typed message envelopes, payload unions, and helpers (`createMessage`, `isValidMessage`) |
| `providers.ts` | Provider interfaces (`AIProvider`, `StreamChunk`, capability flags) |
| `settings.ts` | Settings store schema and helpers |
| `storage.ts` | Chrome storage schema definitions |
| `tabs.ts` | Tab metadata used across services/background |
| `index.ts` | Barrel export |
| `css.d.ts`, `prism-components.d.ts`, `turndown-plugin-gfm.d.ts`, `node-shim.d.ts`, `openai-shim.d.ts` | Module shims for third-party packages |

## Messaging helpers

`messages.ts` defines the canonical message envelope:

```ts
interface Message<T = unknown> {
  id: string;
  type: MessageType;
  source: MessageSource;
  target: MessageTarget;
  payload?: T;
  timestamp: number;
}
```

The file exports guards (`isValidMessage`) and factories (`createMessage`) used by
all messaging layers (`content`, `extension`, `services`).  Payload unions cover
requests such as `TOGGLE_SIDEBAR`, `GET_ALL_TABS`, `EXTRACT_TAB_CONTENT`,
`PROXY_REQUEST`, and the associated responses.

## Extraction types

`extraction.ts` enumerates the supported modes (`READABILITY`, `RAW`, `DEFUDDLE`,
`SELECTION`), validates options, and exposes helper guards so the orchestrator
and background worker can share the same runtime checks.

## Provider contracts

`providers.ts` normalises provider behaviour by defining `AIProvider`,
`ProviderChatMessage`, `StreamChunk`, and `ProviderCapabilities`.  Engines extend
these interfaces, while the sidebar consumes them through `ChatService`.

## Adding new types

1. Create the definition in this directory.
2. Export it from `index.ts` so path aliases (`@/types/...`) can pick it up.
3. Update any relevant tests under `tests/unit` to cover the new contract.
