# Session Service

The SessionService provides centralized management for browser tab sessions with unique session identification, isolation, and lifecycle management.

## Features

- **Deterministic session keys**: Generate consistent session keys from tabId + URL
- **URL normalization**: Handle URL variations for consistent session identification
- **Session isolation**: Keep different tabs/URLs completely separate
- **Lifecycle management**: Clean up sessions when tabs close or become inactive
- **Integration ready**: Works with existing conversation state management

## Basic Usage

```typescript
import { sessionService } from '@services/session';

// Generate a session key
const sessionKey = sessionService.getSessionKey(123, 'https://example.com/page');
console.log(sessionKey); // "tab_123:https://example.com/page"

// Get full session info
const sessionInfo = sessionService.getSessionInfo(123, 'https://example.com/page');
console.log(sessionInfo);
// {
//   sessionKey: "tab_123:https://example.com/page",
//   tabId: 123,
//   url: "https://example.com/page",
//   normalizedUrl: "https://example.com/page"
// }

// Check if session exists
const exists = sessionService.hasSession(123, 'https://example.com/page');

// Clear a specific session
sessionService.clearSession(sessionKey);

// Clear all sessions for a tab
sessionService.clearTabSessions(123);
```

## Advanced Usage

```typescript
import { SessionService, createSessionService } from '@services/session';

// Create custom service with configuration
const customService = createSessionService({
  includeQuery: false, // Ignore query parameters
  includeHash: true, // Include hash fragments
});

// Custom URL normalization
const advancedService = new SessionService({
  normalizeUrlFn: url => {
    // Custom logic for your use case
    return url.toLowerCase().replace(/\/+$/, '');
  },
});

// Session comparison
const isSame = sessionService.isSameSession(
  'https://example.com/page',
  'https://example.com/page#section'
); // true (hash ignored by default)

// Cleanup inactive sessions
const cleaned = sessionService.cleanupInactiveSessions({
  maxAge: 60 * 60 * 1000, // 1 hour
  maxSessions: 50, // Keep max 50 sessions
});
console.log(`Cleaned up ${cleaned} sessions`);
```

## Session Key Format

Session keys follow the format: `tab_{tabId}:{normalizedUrl}`

Examples:

- `tab_123:https://example.com/page`
- `tab_456:https://docs.google.com/document/d/abc123`
- `tab_789:https://github.com/user/repo/issues?state=open`

## URL Normalization Rules

By default, URLs are normalized as follows:

1. **Trailing slashes removed**: `https://example.com/page/` → `https://example.com/page`
2. **Query parameters preserved**: `https://example.com/page?id=123` → `https://example.com/page?id=123`
3. **Hash fragments ignored**: `https://example.com/page#section` → `https://example.com/page`

This ensures that:

- Same logical pages share sessions
- Different content (query params) gets separate sessions
- Navigation within a page (hash changes) maintains the same session

## Integration with Existing Hooks

The SessionService integrates seamlessly with existing session management:

```typescript
// In your components
import { sessionService } from '@services/session';
import { useSessionManager } from '@hooks/useSessionManager';

function MyComponent() {
  const { currentSession } = useSessionManager();

  if (currentSession) {
    const sessionKey = sessionService.getSessionKey(currentSession.tabId, currentSession.url);

    // Use sessionKey for your logic
  }
}
```

## Configuration Options

```typescript
interface SessionServiceConfig {
  /** Include query parameters in session key (default: true) */
  includeQuery?: boolean;

  /** Include hash fragments in session key (default: false) */
  includeHash?: boolean;

  /** Custom URL normalization function */
  normalizeUrlFn?: (url: string) => string;
}
```

## Best Practices

1. **Use the default service** for most cases: `sessionService`
2. **Create custom services** only when you need different normalization rules
3. **Clean up sessions periodically** to prevent memory leaks
4. **Handle edge cases** like invalid URLs or tab closure events
5. **Test session isolation** to ensure data doesn't leak between sessions
