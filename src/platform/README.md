# Platform Module

Typed wrappers for Chrome/Chromium extension APIs. These wrappers hide callback-style APIs behind Promises, normalize error handling, and provide feature detection so higher layers stay portable.

## Structure

```
platform/
└─ chrome/
   ├─ runtime.ts    # install/update/startup hooks, message helpers, getManifest
   ├─ storage.ts    # get/set/remove/clear, batch helpers (sync/local/session)
   ├─ tabs.ts       # query/get/update, sendMessageToTab
   ├─ messaging.ts  # request/response helpers, error normalization
   ├─ ports.ts      # Managed Port wrapper (heartbeat, teardown)
   ├─ keepAlive.ts  # Timer/port/alarm strategies for MV3 keep-alive
   ├─ alarms.ts     # Alarm helpers with Promise interface
   ├─ action.ts     # Browser action utilities
   ├─ scripting.ts  # Programmatic injection (executeScript/insertCSS)
   └─ index.ts      # Barrel exports
```

## Highlights

- `storage.ts` exposes `getMultiple`/`setMultiple` with namespace selection (`sync`, `local`, `session`) and automatic fallback when `sync` quota is hit.
- `tabs.ts` filters out restricted URLs alongside shared utilities.
- `ports.ts` wraps `chrome.runtime.connect` with lifecycle events and heartbeat helpers used by the keep-alive system.
- Everything returns Promises, enabling async/await throughout services and hooks.

Use these wrappers rather than reaching for `chrome.*` directly so logic stays testable and consistent.
