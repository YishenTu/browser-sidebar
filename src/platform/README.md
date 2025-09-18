# Platform wrappers

Utilities under `src/platform/` provide promise-friendly wrappers around
Chromium extension APIs.  They isolate MV3 quirks from the rest of the codebase
and make the APIs easier to mock in tests.

## Structure

```
platform/
└─ chrome/
   ├─ action.ts      # chrome.action helpers (click listener, badge, title)
   ├─ alarms.ts      # Promise-based alarm scheduling
   ├─ index.ts       # Barrel re-export for the chrome namespace
   ├─ keepAlive.ts   # Strategies for keeping the service worker alive
   ├─ messaging.ts   # Runtime messaging helpers with timeout handling
   ├─ ports.ts       # Managed Port wrapper for streaming (used by proxy)
   ├─ runtime.ts     # Installed/startup listeners, manifest helpers, sendMessage
   ├─ scripting.ts   # executeScript / insertCSS wrappers
   ├─ storage.ts     # Typed get/set/remove + change listeners for storage areas
   └─ tabs.ts        # query/get/update helpers + tab event bindings
```

Each module exports plain functions (no singletons) so the background script and
content-side services can import only what they need.  For example:

```ts
import { addMessageListener, sendMessage } from '@platform/chrome/runtime';
import { queryTabs, sendMessageToTab } from '@platform/chrome/tabs';
```

## Testing

Because the modules return Promises and expose explicit typing, they can be
mocked with simple stubs.  Vitest suites replace the exported functions with
`vi.fn()` implementations so no direct `chrome.*` references leak into tests.

## Notes

* `keepAlive.ts` complements `extension/background/keepAlive.ts`; the background
  entry point chooses whichever strategy suits the environment.
* `storage.ts` supports all three storage areas (`local`, `sync`, `session`) and
  is the foundation for the settings store and API-key vault.
