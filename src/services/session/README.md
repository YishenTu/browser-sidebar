# Session Service

`SessionService` centralizes session key generation and lifecycle helpers. Sessions are keyed by `tabId + normalizedUrl`, ensuring each tab/url combo gets its own chat history and tab cache.

## Features

- **Deterministic session keys** using `tab_{id}:{normalizedUrl}`.
- **URL normalization** (strip hash, keep query, lowercase host, trim trailing slash).
- **Session isolation** — Separate conversations per tab/url.
- **Lifecycle helpers** — Clear individual sessions, all sessions for a tab, or idle sessions.
- **Customization** — Opt-in to include/exclude query/hash or supply a custom normalization fn.

## Basic Usage

```ts
import { sessionService } from '@services/session';

const key = sessionService.getSessionKey(123, 'https://example.com/page');
const info = sessionService.getSessionInfo(123, 'https://example.com/page');
const exists = sessionService.hasSession(123, 'https://example.com/page');

sessionService.clearSession(key);
sessionService.clearTabSessions(123);
```

## Advanced Configuration

```ts
import { SessionService, createSessionService } from '@services/session';

const custom = createSessionService({ includeQuery: false, includeHash: true });

const normalized = custom.normalizeUrl('https://Example.com/page/?a=1#section');
const same = sessionService.isSameSession('https://example.com/x', 'https://example.com/x#foo');

const cleaned = sessionService.cleanupInactiveSessions({ maxAge: 60 * 60 * 1000, maxSessions: 50 });
```

## Integration

- Used by `useSessionStore` to manage session maps and `tabSelectionOrder`.
- `useSessionManager` (sidebar) leverages it to keep the active session in sync with the current tab.
- Background cleanup utilities can purge inactive sessions based on age/count limits.

Keep custom normalization logic here so stores and services share the same definition.
