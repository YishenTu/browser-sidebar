# Shared Module

Cross-cutting utilities shared across modules. Keep this folder tiny—only add items that truly belong everywhere.

## Structure

```
shared/
└─ utils/
   ├─ restrictedUrls.ts  # Central allow/deny list for chrome://, chrome web store, file://, etc.
   └─ urlNormalizer.ts   # Deterministic URL normalization for session keys + caches
```

## Utilities

### `restrictedUrls.ts`

- `isRestrictedUrl(url)` — `true` for URLs the extension must avoid (chrome://, file:// unless allowed, extension stores, etc.).
- `isValidTabUrl(url)` — Helper guard used by the background `TabManager` and sidebar tab picker.

### `urlNormalizer.ts`

- `normalizeUrl(url)` — Lowercases host, strips trailing slash, preserves query, drops hash.
- `createSessionKey(tabId, url)` / `parseSessionKey(key)` — Shared with session store + services.

Both modules expose pure functions shared by background, stores, and services.
