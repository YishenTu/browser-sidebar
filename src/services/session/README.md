# SessionService

`SessionService` centralises how the sidebar generates and manages per-tab
sessions.  It wraps the Zustand `useSessionStore` so callers do not manipulate
store internals directly and provides helpers for deterministic session keys.

## Basics

```ts
import { sessionService } from '@services/session';

const key = sessionService.getSessionKey(tabId, url);
const info = sessionService.getSessionInfo(tabId, url);
const hasSession = sessionService.hasSession(tabId, url);
```

* Session keys follow the format `tab_<tabId>:<normalisedUrl>`.
* URL normalisation keeps query parameters by default, strips hashes, and leaves
  non-HTTP(S) schemes untouched.
* `getSessionInfo()` returns the key plus the original and normalised URLs.

## Store interaction

The service proxies to `useSessionStore` and related helpers:

* `clearSession(sessionKey)` and `clearTabSessions(tabId)` delegate to the store’s
  cleanup actions.
* `getAllSessionKeys()` / `getTabSessions(tabId)` expose read-only snapshots for
  diagnostics.
* `cleanupInactiveSessions({ maxAge, maxSessions })` prunes old sessions using the
  timestamps maintained by the store (`lastAccessedAt`).

All methods catch store errors and rethrow descriptive exceptions so UI code can
surface meaningful messages.

## Configuration

Constructing a service manually allows for alternative normalisation rules:

```ts
import { SessionService } from '@services/session';

const service = new SessionService({ includeHash: true });
```

Options:

| Option | Default | Description |
| ------ | ------- | ----------- |
| `includeQuery` | `true` | Keep `?query` when building session keys |
| `includeHash` | `false` | Include `#hash` fragments |
| `normalizeUrlFn` | internal helper | Custom URL normaliser |

## Parsing helpers

`parseSessionKey(key)` returns `{ tabId, url }` or `null` if the key is malformed
(using the shared helper from `@shared/utils/urlNormalizer`).

## Testing

The module exports `createSessionService(config?)` so tests can obtain isolated
instances with mocked stores or alternate normalisation strategies.
