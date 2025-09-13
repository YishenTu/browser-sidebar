# Types Module

Centralized, shared TypeScript definitions used across the extension.

## Files

```
types/
├─ apiKeys.ts        # API key shapes + format helpers
├─ chat.ts           # Chat message + stream chunk types
├─ conversation.ts   # Conversation/session models
├─ extraction.ts     # ExtractedContent, ExtractionMode, option defaults/guards
├─ messages.ts       # Message protocol (types, payloads, createMessage)
├─ providers.ts      # Provider/engine contracts
├─ settings.ts       # Settings state + models list shapes
├─ storage.ts        # Storage schema + serialization helpers
├─ tabs.ts           # Tab info/state
├─ manifest.ts       # Manifest types
├─ index.ts          # Barrel exports
└─ *.d.ts            # CSS/Prism/GFM module declarations
```

## Messaging (high‑level)

`messages.ts` defines the union of message types and payloads and exposes a `createMessage` factory. Selected message ids used today:

- `TOGGLE_SIDEBAR`, `CLOSE_SIDEBAR`
- `GET_TAB_ID`, `GET_TAB_INFO`, `GET_ALL_TABS`
- `EXTRACT_TAB_CONTENT` ↔ `CONTENT_EXTRACTED`
- `CLEANUP_TAB_CACHE`, `PROXY_REQUEST`, `PING`/`PONG`, `ERROR`

All messages include an id, timestamp, source, and target.

## Extraction

`extraction.ts` contains `ExtractedContent`, `ExtractionMode` (`readability | raw | defuddle | selection`), defaults, and runtime validators/normalizers for options and results.

## Providers & Engines

`providers.ts` defines the normalized provider interface (messages in, streamed deltas out) and capability flags consumed by the UI.
