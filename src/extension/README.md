# Extension Module

The extension module provides the core Chrome Extension infrastructure including the service worker, message passing system, and tab state management.

## Directory Structure

```
extension/
├─ background/              # Service worker components
│  ├─ index.ts             # Entry point
│  ├─ keepAlive.ts         # Keep‑alive mechanism
│  ├─ messageHandler.ts    # Typed message registry/dispatch
│  ├─ sidebarManager.ts    # Per‑tab sidebar lifecycle
│  ├─ tabManager.ts        # Tab lifecycle + extraction orchestration
│  ├─ cache/TabContentCache.ts # Session‑storage TTL cache (5 minutes)
│  └─ queue/ExtractionQueue.ts # Concurrency‑limited extraction queue
└─ messaging/               # Message helpers
   ├─ index.ts
   ├─ errors.ts
   └─ responses.ts
```

## Architecture Overview

```
User Click → Extension Icon
    ↓
Background Service Worker
    ├─ Tab State Management
    ├─ Message Routing
    ├─ Keep-Alive System
    └─ Content Caching
        ↓
Content Script (content)
    ↓
Sidebar UI (React)
```

## Core Components

### Background Service Worker

#### `index.ts` - Entry Point

The main service worker that:

- Handles extension installation and updates
- Listens for icon clicks to toggle sidebar
- Routes messages between components
- Manages service worker lifecycle

#### `keepAlive.ts` - Persistence

Prevents service worker termination during:

- Long-running operations
- API key validation
- Content extraction
- WebSocket connections

**Implementation:**

- Creates persistent Chrome runtime port
- Sends periodic pings (25-second intervals)
- Graceful disconnection when complete

#### `messageHandler.ts` - Message Router

Central hub for all extension communication:

**Selected Message Types:**

- `TOGGLE_SIDEBAR`, `CLOSE_SIDEBAR`
- `GET_TAB_ID`, `GET_TAB_INFO`, `GET_ALL_TABS`
- `EXTRACT_TAB_CONTENT` (response: `CONTENT_EXTRACTED`)
- `CLEANUP_TAB_CACHE`
- `PROXY_REQUEST`
- `PING`/`PONG`, `ERROR`

**Features:**

- Type-safe message contracts
- Async message processing
- Centralized error handling
- Structured responses

#### `sidebarManager.ts` - Sidebar State

Manages per-tab sidebar state:

- Tracks open/closed status
- Handles content script injection
- Persists state across sessions
- Cleans up on tab close/navigation

#### `tabManager.ts` - Tab Lifecycle

Handles tab-specific operations:

- Tab creation and updates
- Navigation detection
- Tab removal cleanup
- State synchronization

### Content Caching (`cache/`)

#### `TabContentCache.ts`

Stores extracted content in `chrome.storage.session` with a 5‑minute TTL. Expired entries are cleared on access and via periodic cleanup. Session storage limits apply.

### Extraction Queue (`queue/`)

#### `ExtractionQueue.ts`

Manages content extraction requests:

**Features:**

- FIFO queue processing
- Concurrent extraction limits
- Retry logic with exponential backoff
- Priority queue support
- Error recovery

**Queue States:**

- `pending` - Waiting to process
- `processing` - Currently extracting
- `completed` - Successfully extracted
- `failed` - Extraction failed

## Message Flow

### Sidebar Toggle Flow

```
1. User clicks extension icon
2. Background receives chrome.action.onClicked
3. Background checks tab state
4. Background sends TOGGLE_SIDEBAR to content script
5. Content script dispatches DOM event
6. Sidebar React app mounts/unmounts
7. State saved to Chrome storage
```

### Content Extraction Flow

```
1. Sidebar requests content extraction
2. Message sent to background
3. Background checks cache
4. If not cached:
   - Adds to extraction queue
   - Content script extracts content
   - Result cached with TTL
5. Content returned to sidebar
```

## State Management

### Tab State Interface

```typescript
interface TabState {
  id: number;
  url: string;
  title: string;
  sidebar: {
    isOpen: boolean;
    isInjected: boolean;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  };
  extraction?: {
    lastExtracted: number;
    contentHash: string;
  };
}
```

### Storage Strategy

- **Primary**: `chrome.storage.local` for persistence
- **Fallback**: `chrome.storage.session` for temporary data
- **Debouncing**: 500ms delay to prevent excessive writes
- **Migration**: Automatic version migration on updates

## API Reference

### Background API

#### Sidebar Operations

```typescript
toggleSidebar(tabId: number): Promise<void>
openSidebar(tabId: number): Promise<void>
closeSidebar(tabId: number): Promise<void>
isSidebarOpen(tabId: number): Promise<boolean>
```

#### State Management

```typescript
saveTabState(tabId: number, state: Partial<TabState>): Promise<void>
getTabState(tabId: number): Promise<TabState | null>
clearTabState(tabId: number): Promise<void>
getAllTabStates(): Promise<Map<number, TabState>>
```

#### Message Handling

```typescript
sendMessage(tabId: number, message: Message): Promise<any>
broadcast(message: Message): Promise<void>
onMessage(handler: MessageHandler): void
```

### Content Script Communication

#### Sending Messages

```typescript
// Content → Background
chrome.runtime.sendMessage(message);

// Background → Content
chrome.tabs.sendMessage(tabId, message);
```

#### Receiving Messages

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  sendResponse({ success: true, data: result });
  return true; // Keep channel open for async response
});
```

## Security

### Permissions

**Required:**

- `storage` - Save user settings
- `activeTab` - Access current tab

**Optional:**

- `clipboardWrite` - Copy functionality
- `downloads` - Export conversations
- `notifications` - User notifications

### Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  }
}
```

### Best Practices

1. Validate all message sources
2. Sanitize external inputs
3. Use minimal permissions
4. No eval() or Function()
5. HTTPS-only connections
6. Validate message structure

## Performance

### Optimization Strategies

#### Lazy Loading

- Dynamic imports for heavy modules
- On-demand content script injection
- Deferred initialization

#### Memory Management

- LRU cache with size limits
- Automatic garbage collection
- Memory usage monitoring
- Resource cleanup on tab close

#### Message Optimization

- Batch message sending
- Debounced state updates
- Compressed payloads for large data

### Performance Metrics

- Service worker startup: <50ms
- Message round-trip: <10ms
- State save: <5ms (debounced)
- Cache lookup: <1ms

## Debugging

### Chrome DevTools

1. Navigate to `chrome://extensions`
2. Enable Developer mode
3. Click "Inspect views: service worker"
4. Use Console, Network, Sources tabs

### Debug Commands

```javascript
// Check all tabs
chrome.tabs.query({}, tabs => console.log(tabs));

// View storage
chrome.storage.local.get(null, data => console.log(data));

// Monitor messages
chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log('Message:', msg, 'From:', sender);
});

// Check permissions
chrome.permissions.getAll(perms => console.log(perms));
```

### Common Issues

#### Service Worker Stops

**Solution:** Implement keep-alive with alarms

```typescript
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
  // Lightweight operation to keep worker alive
});
```

#### Content Script Not Injecting

**Solution:** Check URL restrictions and permissions

```typescript
const isRestrictedUrl = (url: string) => {
  return url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:');
};
```

#### Message Not Received

**Solution:** Ensure async response handling

```typescript
// Always return true for async responses
return true;
```

## Testing

### Unit Tests

```typescript
// Test message handler
describe('MessageHandler', () => {
  it('routes messages correctly', () => {
    const handler = new MessageHandler();
    const spy = jest.fn();
    handler.on('TOGGLE_SIDEBAR', spy);
    handler.handle({ type: 'TOGGLE_SIDEBAR' });
    expect(spy).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Test complete flow
it('toggles sidebar on icon click', async () => {
  await chrome.action.onClicked.dispatch({ id: 1 });
  const state = await getTabState(1);
  expect(state.sidebar.isOpen).toBe(true);
});
```

## Browser Compatibility

Chromium‑based browsers (Chrome, Edge, Arc, Brave, Opera). Some system pages are restricted by design.

## Future Enhancements

### Planned Features

1. WebSocket support for real-time updates
2. Offline mode with sync capabilities
3. Cross-device state synchronization
4. Custom keyboard shortcuts
5. Performance monitoring dashboard
6. Extension API for third-party integrations

### Experimental Features

Enable via feature flags:

- Advanced caching strategies
- Predictive content pre-extraction
- Machine learning for tab prioritization

## Contributing

### Development Setup

```bash
# Clone and install
git clone <repository>
npm install

# Development build with watch
npm run watch

# Run tests
npm test

# Production build
npm run build
```

### Code Standards

- TypeScript strict mode
- ESLint + Prettier
- 80% minimum test coverage
- Comprehensive error handling

## License

MIT License - Part of the AI Browser Sidebar Extension project
