# Extension Module

The extension module hosts the MV3 service worker (background script), typed messaging system, tab cache, and extraction queue. It is the glue between the sidebar UI, content scripts, and provider transports.

## Layout

```
extension/
├─ background/
│  ├─ index.ts            # Service worker entry + keep-alive bootstrap
│  ├─ messageHandler.ts   # Typed router/registry for MessageType events
│  ├─ sidebarManager.ts   # Injects/tears down sidebar per-tab
│  ├─ tabManager.ts       # Tab lookup, extraction coordination, cache integration
│  ├─ cache/TabContentCache.ts   # chrome.storage.session TTL cache (mode-aware)
│  └─ queue/ExtractionQueue.ts   # FIFO queue with 3-concurrent workers + retries
└─ messaging/
   ├─ index.ts            # Message helpers
   ├─ errors.ts           # Typed error payloads
   └─ responses.ts        # Shared response builders
```

## Message Flow

```
Sidebar ↔ Background ↔ Content Script
  |            |           |
  | TOGGLE     | injects   | mounts Shadow DOM
  | SEND_TO_AI | caches    | runs extraction
  | EXTRACT    | proxies   | replies CONTENT_EXTRACTED
```

Supported `MessageType` values include `TOGGLE_SIDEBAR`, `CLOSE_SIDEBAR`, `CONTENT_READY`, `SIDEBAR_STATE`, `GET_TAB_ID`, `GET_TAB_INFO`, `GET_ALL_TABS`, `EXTRACT_TAB_CONTENT`, `CONTENT_EXTRACTED`, `CLEANUP_TAB_CACHE`, `PROXY_REQUEST`, `SEND_TO_AI`, `AI_RESPONSE`, and heartbeat `PING`/`PONG`.

## Core Pieces

### `background/index.ts`

- Registers the message router, keep-alive heartbeat, and cleanup handlers.
- Wires Chrome events (`chrome.action.onClicked`, `runtime.onInstalled`, etc.).

### `background/messageHandler.ts`

- Central registry that validates inbound messages (`isValidMessage`).
- Dispatches to handler functions (tab extraction, cache cleanup, proxy requests).
- Normalizes errors via `createMessage<ErrorPayload>` to keep payloads typed.

### `background/tabManager.ts`

- Singleton for tab lifecycle + extraction.
- Maintains a `TabContentCache` (5 min TTL) keyed by tabId + extraction mode.
- Uses `ExtractionQueue` to cap concurrent extraction to 3 jobs and apply retries/backoff.
- Runs `ensureContentScript` to inject content scripts when needed.
- Respects restricted URLs via `shared/utils/restrictedUrls`.

### `background/sidebarManager.ts`

- Tracks injected tabs, toggles the sidebar, and cleans up on tab close/navigation.
- Handles migration between Manifest V3 keep-alive patterns (port vs alarm fallback).

### `messaging/`

- `createMessage`, response helpers, and error builders shared across background/content/sidebar.

## Extraction Queue

- FIFO with max concurrency `3` and exponential backoff.
- Cancels outstanding jobs on tab removal.
- Forces cache invalidation when mode changes or `forceRefresh` is set.

## Tab Cache

- Stored in `chrome.storage.session` to avoid persistence across browser restarts.
- Entries include extraction metadata (`extractionMethod`, `timestamp`).
- Mode mismatch triggers cache eviction before re-extracting.

## Keep-Alive Strategy

- Uses a dedicated long-lived `chrome.runtime.Port` plus alarm fallback when ports are unavailable.
- Periodic PING/PONG keeps the worker alive during long extractions or provider validation.

## Security Considerations

- All incoming messages are validated before dispatch.
- Restricted URLs are filtered before extraction requests run.
- Proxy requests are limited by the transport policy (allow/deny lists).
