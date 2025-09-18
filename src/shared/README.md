# Shared helpers

`src/shared/` contains cross-cutting utilities that do not warrant a full
service.  They are side-effect free and reused by both the background worker and
the UI.

## Utilities

| File | Description |
| ---- | ----------- |
| `utils/restrictedUrls.ts` | Guards for URLs that the extension should not inject into (`chrome://`, `chrome-extension://`, Web Store, file scheme, …) |
| `utils/urlNormalizer.ts` | `normalizeUrl`, `createSessionKey`, and `parseSessionKey` helpers used by stores and services |

The functions export plain booleans/strings so they can be used anywhere without
bringing in browser-specific dependencies.
