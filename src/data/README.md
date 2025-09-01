# Data Module

The data module provides comprehensive state management, persistence, and security for the AI Browser Sidebar Extension. It implements a layered architecture with Zustand stores, Chrome storage, and encryption.

## Directory Structure

```
data/
├── store/                    # State management layer
│   ├── stores/              # Specialized store modules
│   │   ├── sessionStore.ts  # Browser tab session management
│   │   ├── messageStore.ts  # Message CRUD operations
│   │   ├── tabStore.ts      # Multi-tab content state
│   │   └── uiStore.ts       # UI state (loading, errors)
│   ├── types/               # Type definitions
│   │   ├── message.ts       # Message-related types
│   │   ├── session.ts       # Session-related types
│   │   └── index.ts         # Type exports
│   ├── utils/               # Helper utilities
│   │   └── chatHelpers.ts   # ID generation, session creation
│   ├── chat.ts              # Main chat store exports
│   ├── settings.ts          # User preferences and API keys
│   ├── index.ts             # Store exports
│   └── README.md            # Store documentation
├── storage/                  # Persistence layer
│   ├── keys/                # API key management system
│   │   ├── cache.ts         # Key caching
│   │   ├── constants.ts     # Key constants
│   │   ├── database.ts      # Key database
│   │   ├── encryption.ts    # Key encryption
│   │   ├── health.ts        # Health checks
│   │   ├── importExport.ts  # Import/export
│   │   ├── index.ts         # Key exports
│   │   ├── operations.ts    # CRUD operations
│   │   ├── query.ts         # Query operations
│   │   ├── rotation.ts      # Key rotation
│   │   ├── types.ts         # Key types
│   │   ├── usage.ts         # Usage tracking
│   │   └── utils.ts         # Key utilities
│   ├── chrome.ts            # Chrome Storage API wrapper
│   ├── index.ts             # Storage exports
│   └── keys.ts              # Key management entry
├── security/                 # Security layer
│   ├── crypto.ts            # AES-GCM encryption
│   ├── index.ts             # Security exports
│   └── masking.ts           # Data masking
├── README.md                # This file
└── index.ts                 # Module exports
```

## Architecture Overview

```
UI Components
    ↓
Zustand Stores (reactive state)
    ↓
Storage Layer (persistence)
    ↓
Security Layer (encryption)
    ↓
Chrome Storage API
```

## Core Components

### Store Layer (`store/`)

#### Chat Store (`chat.ts`)

Refactored into modular architecture with specialized stores following a **hierarchical delegation pattern**:

```
SessionStore (Master - holds all data)
    ├── MessageStore (delegates to active session)
    ├── TabStore (delegates to active session)
    └── UIStore (delegates to active session)
```

**Store Modules:**

1. **Session Store** (`stores/sessionStore.ts`) - **Master Store**:
   - Holds all session data in memory (no persistence)
   - Tab+URL based session management
   - Session key format: `tab_${tabId}:${normalizedUrl}`
   - URL normalization: includes query params, excludes hash
   - Active session tracking and switching
   - Session lifecycle management

2. **Message Store** (`stores/messageStore.ts`) - **Delegated Store**:
   - No direct data storage - operates on active session
   - Message CRUD operations via `updateActiveSession()`
   - Streaming message updates
   - Message editing and deletion
   - Message history management

3. **Tab Store** (`stores/tabStore.ts`) - **Delegated Store**:
   - No direct data storage - operates on active session
   - Multi-tab content management
   - Tab selection ordering
   - Current tab tracking
   - Auto-load state

4. **UI Store** (`stores/uiStore.ts`) - **Delegated Store**:
   - No direct data storage - operates on active session
   - Loading states
   - Error handling
   - Active message tracking
   - Response ID management

**Session Management Strategy:**

- **Session Creation**: New session per unique tab+URL combination
- **Session Continuation**: Same tab + same normalized URL preserves session
- **Session Switching**: Navigation within same tab switches sessions (both kept in memory)
- **Session Clearing**:
  - `clearCurrentSession()`: Resets current session data but keeps key
  - `clearSession(key)`: Removes specific session entirely
  - `clearTabSessions(tabId)`: Removes all sessions for a tab (triggered on tab close)
- **No Persistence**: All sessions exist only in memory, lost on browser/extension restart

**Sidebar Mount/Unmount Behavior:**

- **Mount**: Extension icon click → inject sidebar → mount React → retrieve/create session
- **Hide**: Extension icon click → CSS hide (React stays mounted, session preserved)
- **Show**: Extension icon click → CSS show (no re-mount, session continues)
- **Navigation**: Full unmount → must manually reopen → session retrieved if exists
- **Tab Close**: Full unmount → `TAB_CLOSED` event → all tab sessions cleared

**Key Actions:**

- `switchSession` - Switch to different tab session (sessionStore)
- `clearCurrentSession` - Reset current session data (sessionStore)
- `clearTabSessions` - Remove all sessions for a tab (sessionStore)
- `addMessage` - Add new message to active session (messageStore)
- `updateMessage` - Update existing message in active session (messageStore)
- `setLoadedTabs` - Update loaded tab content in active session (tabStore)
- `setLoading` - Update loading state in active session (uiStore)

#### Settings Store (`settings.ts`)

Manages user preferences and configuration:

**State Management:**

- API keys by provider
- Model preferences
- UI customization
- Privacy settings
- Feature flags

**Key Actions:**

- `setApiKey` - Save encrypted API key
- `removeApiKey` - Delete API key
- `updateTheme` - Change UI theme
- `setDefaultModel` - Set preferred model
- `exportSettings` - Export configuration

### Storage Layer (`storage/`)

#### Chrome Storage Wrapper (`chrome.ts`)

Type-safe wrapper around Chrome Storage API:

**Features:**

- Automatic serialization/deserialization
- Batch operations for performance
- Storage quota management
- Change listeners with debouncing
- Migration support

**Storage Areas:**

- `local` - Large data (10MB limit)
- `sync` - Synced settings (100KB limit)
- `session` - Temporary data

#### Key Management System (`keys/`)

Comprehensive API key management:

**Components:**

- **Cache** - In-memory key caching
- **Database** - Persistent key storage
- **Encryption** - AES-GCM protection
- **Health** - Validation and monitoring
- **Rotation** - Key rotation policies
- **Usage** - Track API usage

**Security Features:**

- Automatic encryption
- Secure key derivation
- Memory clearing
- Audit logging
- Access control

### Security Layer (`security/`)

#### Encryption (`crypto.ts`)

AES-GCM encryption implementation:

**Specifications:**

- 256-bit AES keys
- Random IV per encryption
- PBKDF2 key derivation
- 100,000 iterations
- SHA-256 hashing

**API:**

```typescript
encrypt(plaintext: string, passphrase: string): Promise<EncryptedData>
decrypt(encrypted: EncryptedData, passphrase: string): Promise<string>
```

#### Data Masking (`masking.ts`)

Sensitive data protection:

**Features:**

- API key masking for display
- PII detection and redaction
- Secure clipboard operations
- Log sanitization

## State Management

### Zustand Integration

**Modular Store Pattern:**

```typescript
// Specialized stores with focused responsibilities
interface SessionState {
  sessions: Record<string, SessionData>;
  activeSessionKey: string | null;
  switchSession: (tabId: number, url: string) => SessionData;
  clearSession: (sessionKey: string) => void;
}

interface MessageState {
  addMessage: (options: CreateMessageOptions) => ChatMessage;
  updateMessage: (id: string, updates: UpdateMessageOptions) => void;
  getMessages: () => ChatMessage[];
}

interface TabState {
  addLoadedTab: (tabId: number, content: TabContent) => void;
  getLoadedTabs: () => Record<number, TabContent>;
  getCurrentTabId: () => number | null;
}

interface UIState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getActiveMessageId: () => string | null;
}
```

**Middleware:**

- Devtools for debugging
- Persist for storage sync
- Immer for immutability

### Storage Persistence

**Auto-sync Pattern:**

```typescript
// Zustand persist middleware
persist(
  (set, get) => ({
    /* store */
  }),
  {
    name: 'chat-storage',
    storage: createChromeStorage(),
  }
);
```

## API Usage

### Chat Operations

```typescript
import { useMessageStore, useUIStore, useSessionStore, useTabStore } from '@data/store/chat';

// Session management
const sessionStore = useSessionStore();
sessionStore.switchSession(tabId, url);

// Add message
const messageStore = useMessageStore();
const message = messageStore.addMessage({
  role: 'user',
  content: 'Hello!',
});

// Update UI state
const uiStore = useUIStore();
uiStore.setLoading(true);

// Manage tabs
const tabStore = useTabStore();
tabStore.addLoadedTab(tabId, tabContent);
```

### Settings Management

```typescript
import { useSettingsStore } from '@data/store';

// Save API key
const setApiKey = useSettingsStore(state => state.setApiKey);
await setApiKey('openai', 'sk-...');

// Get current model
const model = useSettingsStore(state => state.providers.openai?.model);
```

### Direct Storage Access

```typescript
import { ChromeStorage } from '@data/storage';

// Save data
await ChromeStorage.set('key', { data: 'value' });

// Load data
const data = await ChromeStorage.get('key');

// Listen for changes
ChromeStorage.onChange('key', (newValue, oldValue) => {
  console.log('Changed:', newValue);
});
```

### Encryption

```typescript
import { encrypt, decrypt } from '@data/security';

// Encrypt sensitive data
const encrypted = await encrypt('secret', 'passphrase');

// Decrypt data
const plaintext = await decrypt(encrypted, 'passphrase');
```

## Security

### API Key Protection

**Encryption Flow:**

1. User provides API key
2. Generate random salt and IV
3. Derive encryption key via PBKDF2
4. Encrypt with AES-GCM
5. Store encrypted data + metadata
6. Clear plaintext from memory

### Best Practices

**Do:**

- Always encrypt sensitive data
- Use secure key derivation
- Clear memory after use
- Implement access logging
- Validate all inputs

**Don't:**

- Store plaintext keys
- Log sensitive data
- Trust user input
- Skip validation
- Ignore errors

## Performance

### Optimization Strategies

#### Caching

- In-memory cache for frequent access
- TTL-based expiration
- LRU eviction policy

#### Batching

- Debounced storage writes
- Batch multiple updates
- Reduce API calls

#### Memory Management

- Pagination for large datasets
- Virtual scrolling for lists
- Periodic cleanup routines

### Performance Metrics

- Storage write: <5ms (debounced)
- Encryption: <10ms for typical data
- Cache hit rate: >90%
- Memory usage: <50MB typical

## Error Handling

### Error Types

| Type                | Description           | Recovery            |
| ------------------- | --------------------- | ------------------- |
| `QUOTA_EXCEEDED`    | Storage limit reached | Clean old data      |
| `ENCRYPTION_FAILED` | Encryption error      | Retry with new key  |
| `NETWORK_ERROR`     | Sync failed           | Retry with backoff  |
| `CORRUPTION`        | Data corrupted        | Restore from backup |
| `PERMISSION_DENIED` | No storage access     | Request permission  |

### Recovery Strategies

1. **Automatic Retry** - Transient failures
2. **Fallback Storage** - Use session storage
3. **Data Recovery** - Restore from backup
4. **Graceful Degradation** - Reduced functionality
5. **User Notification** - Clear error messages

## Migration

### Schema Migrations

**Migration System:**

```typescript
const migrations = {
  '1.0.0': migrateToV1,
  '2.0.0': migrateToV2,
  '3.0.0': migrateToV3,
};
```

**Breaking Changes:**

- v2.0: Conversation-based messages
- v2.1: Encrypted API keys
- v3.0: Zustand migration
- v4.0: Modular store architecture with specialized stores

## Testing

### Test Coverage

```bash
# Run data module tests
npm test -- src/data

# Specific test suites
npm test -- src/data/store
npm test -- src/data/storage
npm test -- src/data/security
```

### Test Types

- Unit tests for stores
- Integration tests for storage
- Security tests for encryption
- Performance benchmarks

## Debugging

### Chrome DevTools

```javascript
// View all storage
chrome.storage.local.get(null, console.log);

// Monitor changes
chrome.storage.onChanged.addListener((changes, area) => {
  console.log('Storage changed:', changes, area);
});

// Check quota
chrome.storage.local.getBytesInUse(null, bytes => {
  console.log('Used:', bytes, 'bytes');
});
```

### Zustand DevTools

Enable Redux DevTools extension to inspect:

- State changes
- Action history
- Time travel debugging
- State diff

## Common Issues

### Storage Quota Exceeded

**Solution:**

```typescript
// Clean old conversations
const cleanOldData = async () => {
  const conversations = await getConversations();
  const sorted = conversations.sort((a, b) => b.lastAccessed - a.lastAccessed);
  const keep = sorted.slice(0, 50);
  await saveConversations(keep);
};
```

### Slow Operations

**Solution:**

- Use batch operations
- Implement caching
- Debounce updates
- Use web workers for encryption
