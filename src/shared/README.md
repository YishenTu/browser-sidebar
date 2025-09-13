# Shared Module

Cross‑cutting utilities shared across modules.

## Structure

```
shared/
└─ utils/
   ├─ restrictedUrls.ts  # Centralized check for restricted pages (chrome://, etc.)
   └─ urlNormalizer.ts   # Normalizes URLs for session keys
```

## Utilities

### `restrictedUrls.ts`

- `isRestrictedUrl(url)` — true for chrome://, file:// (unless permitted), web stores, etc.
- `isValidTabUrl(url)` — helper guard used by background and UI filters

### `urlNormalizer.ts`

- `normalizeUrl(url)` — removes trailing slash, keeps query, drops hash
- `createSessionKey(tabId, url)` / `parseSessionKey(key)` — deterministic session keys

All functions are pure and side‑effect free.
