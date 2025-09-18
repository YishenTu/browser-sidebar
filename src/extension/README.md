# Extension (MV3 service worker)

`src/extension/` hosts the Manifest V3 background script and its messaging
infrastructure.  The service worker keeps the sidebar injected, coordinates tab
extraction, and proxies network calls that cannot run from the content script.

## Directory

```
extension/
├─ background/
│  ├─ index.ts          # Entry point: registers handlers and keep-alive
│  ├─ keepAlive.ts      # Periodic ping to avoid premature worker suspension
│  ├─ messageHandler.ts # Registry of typed message handlers
│  ├─ proxyHandler.ts   # Fetch/stream proxy for CORS-restricted endpoints
│  ├─ sidebarManager.ts # Tracks which tabs have the sidebar open
│  ├─ tabManager.ts     # Tab lookup + extraction + content-script injection
│  ├─ cache/            # TabContentCache (chrome.storage.session with TTLs)
│  └─ queue/            # FIFO ExtractionQueue with concurrency limits
└─ messaging/
   ├─ index.ts          # Helpers for sending typed responses
   ├─ errors.ts         # Standardised error codes for messaging failures
   └─ responses.ts      # Utility builders for success/error payloads
```

## Background workflow

1. **Initialisation** (`background/index.ts`)
   * Creates a `MessageHandlerRegistry` populated by `createDefaultMessageHandler()`.
   * Registers listeners for installation, startup, runtime messages, long-lived
     ports (proxy streaming), and the extension action click.
   * Bootstraps the keep-alive loop to keep the worker alive while the sidebar is
     open or extraction is running.

2. **Sidebar lifecycle** (`sidebarManager.ts`)
   * Maintains a per-tab map of open/closed state and cleans up when tabs close
     or navigate.
   * Responds to `TOGGLE_SIDEBAR` / `CLOSE_SIDEBAR` by injecting the content
     script if necessary and relaying the toggle message back to the tab.

3. **Extraction** (`tabManager.ts`)
   * Provides `getAllTabs()`, `getTab()`, and `extractTabContent()` helpers.
   * Uses `ExtractionQueue` to cap concurrent extractions and `TabContentCache`
     to memoise results in `chrome.storage.session`.
   * Ensures the content script is present (`ensureContentScript`) and retries
     injection by reading the manifest’s declared content scripts.

4. **Proxying** (`proxyHandler.ts`)
   * Implements a request/response proxy and a streaming variant (`proxy-stream`
     port) for endpoints flagged by `@transport/policy.shouldProxy`.

## Adding a new message

1. Define the payload type in `@/types/messages.ts`.
2. Register a handler inside `createDefaultMessageHandler()` (or directly via the
   registry in `background/index.ts`).
3. Use `createMessage()` from `messaging/index.ts` when sending responses so the
   message structure stays consistent with the rest of the extension.

## Testing hooks

* The cache exposes `getStats()`/`cleanupExpired()` so unit tests can inspect
  eviction behaviour.
* `ExtractionQueue` is exported as a class and singleton (`extractionQueue`)
  making it simple to assert queue state or inject a smaller concurrency limit
  during tests.
