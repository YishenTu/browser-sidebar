# Platform Module

Platform-specific abstractions and implementations for browser APIs.

## Overview

The platform module provides a abstraction layer over browser-specific APIs, enabling the extension to work across different Chromium-based browsers while maintaining a consistent internal API. This module handles platform differences and provides fallbacks where necessary.

## Structure

```
platform/
└── chrome/             # Chrome/Chromium API abstractions
    ├── runtime.ts      # Runtime API wrapper
    ├── storage.ts      # Storage API wrapper
    ├── tabs.ts         # Tabs API wrapper
    ├── messaging.ts    # Messaging API wrapper
    └── index.ts        # Main exports
```

## Chrome Platform (`chrome/`)

### Purpose

Wraps Chrome Extension APIs to provide:

- Type-safe interfaces
- Error handling
- Promise-based APIs
- Cross-browser compatibility
- Mock implementations for testing

### Key Components

**Runtime API (`runtime.ts`)**:

- Extension lifecycle management
- Message passing coordination
- Installation/update handlers
- Connection management

**Storage API (`storage.ts`)**:

- Unified storage interface
- Sync/local storage abstraction
- Change listeners
- Quota management

**Tabs API (`tabs.ts`)**:

- Tab lifecycle events
- Tab query and manipulation
- Active tab detection
- URL change monitoring

**Messaging API (`messaging.ts`)**:

- Type-safe message passing
- Port-based communication
- Broadcast messaging
- Response handling

## API Abstractions

### Storage Abstraction

```typescript
interface PlatformStorage {
  get<T>(key: string): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  onChanged(callback: (changes: StorageChanges) => void): void;
}
```

### Tab Management

```typescript
interface PlatformTabs {
  query(options: TabQuery): Promise<Tab[]>;
  get(tabId: number): Promise<Tab>;
  create(options: TabCreateOptions): Promise<Tab>;
  update(tabId: number, options: TabUpdateOptions): Promise<Tab>;
  onUpdated(callback: TabUpdateCallback): void;
  onRemoved(callback: TabRemoveCallback): void;
}
```

### Message Passing

```typescript
interface PlatformMessaging {
  send<T, R>(message: T): Promise<R>;
  onMessage<T, R>(handler: MessageHandler<T, R>): void;
  connect(name: string): Port;
  onConnect(handler: PortHandler): void;
}
```

## Browser Compatibility

### Supported Browsers

- **Chrome**: Full support (v120+)
- **Edge**: Full support (Chromium-based)
- **Arc**: Full support with custom sidebar
- **Brave**: Full support
- **Opera**: Full support (Chromium-based)

### Feature Detection

```typescript
const hasNativeSidePanel = 'sidePanel' in chrome;
const hasOffscreenAPI = 'offscreen' in chrome;
const hasDeclarativeContent = 'declarativeContent' in chrome;
```

## Usage Examples

### Using Storage

```typescript
import { storage } from '@platform/chrome';

// Save data
await storage.set('settings', { theme: 'dark' });

// Retrieve data
const settings = await storage.get('settings');

// Listen for changes
storage.onChanged(changes => {
  console.log('Storage changed:', changes);
});
```

### Tab Management

```typescript
import { tabs } from '@platform/chrome';

// Get active tab
const [activeTab] = await tabs.query({
  active: true,
  currentWindow: true,
});

// Monitor tab updates
tabs.onUpdated((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Tab finished loading
  }
});
```

### Message Passing

```typescript
import { messaging } from '@platform/chrome';

// Send message
const response = await messaging.send({
  type: 'EXTRACT_CONTENT',
  tabId: 123,
});

// Listen for messages
messaging.onMessage((message, sender, sendResponse) => {
  if (message.type === 'CONTENT_READY') {
    sendResponse({ success: true });
  }
});
```

## Error Handling

The platform module provides consistent error handling:

- **API Availability**: Checks for API existence before use
- **Permission Errors**: Clear messages for missing permissions
- **Runtime Errors**: Wrapped in platform-specific error types
- **Fallbacks**: Graceful degradation for unsupported features

## Testing Support

### Mock Implementations

```typescript
import { createMockPlatform } from '@platform/chrome/mock';

const mockPlatform = createMockPlatform({
  storage: new Map(),
  tabs: [{ id: 1, url: 'https://example.com' }],
});
```

### Test Utilities

- Mock message passing
- Simulated tab events
- Storage state management
- Permission simulation

## Performance Considerations

- **Lazy Loading**: APIs loaded on first use
- **Event Debouncing**: Prevents event flooding
- **Batch Operations**: Groups storage operations
- **Memory Management**: Automatic listener cleanup

## Security

- **Permission Validation**: Checks before API usage
- **Content Security**: CSP enforcement
- **Origin Validation**: Secure message passing
- **Data Sanitization**: Input validation for all APIs

## Future Enhancements

- Firefox WebExtension support
- Safari Web Extension support
- Native messaging support
- WebExtension polyfills
- Performance monitoring APIs
