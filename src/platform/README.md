# Platform Module

Typed wrappers for Chrome/Chromium extension APIs used across the app.

## Structure

```
platform/
└─ chrome/
   ├─ runtime.ts    # install/update/startup, message listeners, sendMessage
   ├─ storage.ts    # get/set/remove/batch, listeners, quota info
   ├─ tabs.ts       # query/get/update, events
   ├─ messaging.ts  # helper send/broadcast with types
   ├─ ports.ts      # managed Port with streaming helpers
   ├─ keepAlive.ts  # keepAlive (timer/port/hybrid) utilities
   ├─ alarms.ts     # alarms wrapper
   ├─ action.ts     # browser action helpers
   ├─ scripting.ts  # programmatic injection helpers
   └─ index.ts      # barrel exports
```

## Purpose

- Promise‑based, typed surface over `chrome.*`
- Centralized error handling and safe fallbacks
- Reusable building blocks for background, content and UI code

## Notes

- `keepAlive.ts` complements `extension/background/keepAlive.ts` with higher‑level strategies (timer/port/hybrid) built on the same primitives.
- Storage helpers support single and batch ops across `local`, `sync`, and `session` with simple migration hooks.

## Compatibility

Chromium‑based browsers (Chrome, Edge, Arc, Brave, Opera). Feature detection is used where APIs differ; no Firefox/Safari shims are included yet.
