# Types Module

Centralized TypeScript type definitions and interfaces for the entire application.

## Overview

The types module contains all shared TypeScript type definitions, interfaces, enums, and type utilities. It serves as the single source of truth for type definitions across the application, ensuring type safety and consistency.

## Structure

```
types/
├── apiKeys.ts          # API key related types
├── chat.ts             # Chat domain types
├── conversation.ts     # Conversation models
├── extraction.ts       # Content extraction types
├── messages.ts         # Extension message contracts
├── providers.ts        # AI provider contracts
├── settings.ts         # Configuration interfaces
├── storage.ts          # Storage types
├── tabs.ts             # Tab-related types
├── manifest.ts         # Manifest types
├── ui.ts               # UI component types
├── errors.ts           # Error types
├── utils.ts            # Utility types
└── index.ts            # Main exports
```

## Type Categories

### API Keys (`apiKeys.ts`)

```typescript
interface ApiKey {
  id: string;
  provider: Provider;
  key: string;
  encrypted: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

type Provider = 'openai' | 'gemini' | 'anthropic';

interface KeyValidation {
  isValid: boolean;
  error?: string;
  quota?: ApiQuota;
}
```

### Chat Types (`chat.ts`)

```typescript
interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

type Role = 'user' | 'assistant' | 'system';

interface ChatSession {
  id: string;
  messages: Message[];
  context: ChatContext;
  startedAt: number;
  lastActivity: number;
}

interface StreamToken {
  content: string;
  isThinking?: boolean;
  finished?: boolean;
}
```

### Conversation Types (`conversation.ts`)

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: ConversationMetadata;
}

interface ConversationContext {
  tabId: number;
  url: string;
  pageTitle?: string;
  extractedContent?: ExtractedContent;
}
```

### Extraction Types (`extraction.ts`)

```typescript
interface ExtractedContent {
  text: string;
  markdown: string;
  images: ImageData[];
  links: LinkData[];
  metadata: PageMetadata;
}

type ExtractionStrategy = 'raw' | 'semantic' | 'visual';

interface ExtractionOptions {
  strategy: ExtractionStrategy;
  includeImages: boolean;
  maxLength?: number;
  selector?: string;
}

interface PageMetadata {
  title: string;
  description?: string;
  author?: string;
  publishedDate?: Date;
  modifiedDate?: Date;
}
```

### Message Types (`messages.ts`)

```typescript
interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  sender?: chrome.runtime.MessageSender;
  id?: string;
}

enum MessageType {
  TOGGLE_SIDEBAR,
  EXTRACT_CONTENT,
  CONTENT_READY,
  SEND_MESSAGE,
  UPDATE_STATE,
}

interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Provider Types (`providers.ts`)

```typescript
interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  options?: ProviderOptions;
}

interface ProviderCapabilities {
  streaming: boolean;
  thinking: boolean;
  maxTokens: number;
  vision: boolean;
  functionCalling: boolean;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}
```

### Settings Types (`settings.ts`)

```typescript
interface Settings {
  theme: Theme;
  defaultModel: ModelConfig;
  shortcuts: KeyboardShortcuts;
  privacy: PrivacySettings;
  experimental: ExperimentalFeatures;
}

type Theme = 'light' | 'dark' | 'system';

interface ModelConfig {
  provider: Provider;
  model: string;
  temperature: number;
}

interface PrivacySettings {
  telemetry: boolean;
  analytics: boolean;
  crashReports: boolean;
}
```

### Storage Types (`storage.ts`)

```typescript
interface StorageSchema {
  settings: Settings;
  apiKeys: Record<Provider, EncryptedData>;
  sessions: Record<string, ChatSession>;
  cache: CacheData;
}

interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
}

type StorageArea = 'local' | 'sync' | 'session';
```

### Tab Types (`tabs.ts`)

```typescript
interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
  index: number;
}

interface TabState {
  sidebarOpen: boolean;
  extractedContent?: ExtractedContent;
  session?: ChatSession;
}

interface TabUpdate {
  url?: string;
  title?: string;
  status?: 'loading' | 'complete';
}
```

### UI Types (`ui.ts`)

```typescript
interface ComponentProps<T = {}> {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & T;

interface SidebarState {
  isOpen: boolean;
  position: Position;
  size: Size;
  isPinned: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}
```

### Error Types (`errors.ts`)

```typescript
class ExtensionError extends Error {
  code: ErrorCode;
  context?: unknown;
}

enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

interface ErrorContext {
  timestamp: number;
  source: string;
  details?: Record<string, unknown>;
}
```

### Utility Types (`utils.ts`)

```typescript
// Make all properties optional recursively
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Make all properties required recursively
type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

// Extract promise type
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Omit multiple properties
type OmitMultiple<T, K extends keyof T> = Omit<T, K>;

// Union to intersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;
```

## Type Guards

```typescript
// Type guard for message validation
export function isValidMessage(msg: unknown): msg is Message {
  return (
    typeof msg === 'object' && msg !== null && 'id' in msg && 'role' in msg && 'content' in msg
  );
}

// Type guard for provider
export function isProvider(value: string): value is Provider {
  return ['openai', 'gemini', 'anthropic'].includes(value);
}
```

## Generic Types

```typescript
// Result type for operations
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Async result
type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Event handler
type Handler<T> = (event: T) => void | Promise<void>;

// Cleanup function
type Cleanup = () => void;
```

## Branded Types

```typescript
// Branded types for type safety
type UserId = string & { __brand: 'UserId' };
type SessionId = string & { __brand: 'SessionId' };
type TabId = number & { __brand: 'TabId' };

// Helper to create branded types
function createUserId(id: string): UserId {
  return id as UserId;
}
```

## Discriminated Unions

```typescript
type Action =
  | { type: 'SEND_MESSAGE'; payload: { content: string } }
  | { type: 'CLEAR_CHAT' }
  | { type: 'LOAD_SESSION'; payload: { sessionId: string } };

// Type-safe action handling
function handleAction(action: Action) {
  switch (action.type) {
    case 'SEND_MESSAGE':
      // action.payload is typed as { content: string }
      break;
    case 'CLEAR_CHAT':
      // No payload
      break;
    case 'LOAD_SESSION':
      // action.payload is typed as { sessionId: string }
      break;
  }
}
```

## Best Practices

### Naming Conventions

- **Interfaces**: PascalCase, descriptive names
- **Type Aliases**: PascalCase for objects, camelCase for primitives
- **Enums**: PascalCase with UPPER_SNAKE_CASE values
- **Generics**: Single letter (T, U, V) or descriptive (TData, TError)

### Organization

1. Group related types in the same file
2. Export all public types from index.ts
3. Use namespaces for large type groups
4. Document complex types with JSDoc

### Type Safety

```typescript
// Prefer unknown over any
function processData(data: unknown): void {
  // Type narrowing required
  if (typeof data === 'string') {
    // data is string here
  }
}

// Use const assertions
const config = {
  provider: 'openai',
  model: 'gpt-5',
} as const;
```

## Import/Export

```typescript
// Import specific types
import { Message, ChatSession } from '@types';

// Import namespace
import * as Types from '@types';

// Re-export pattern
export type { Message } from './chat';
export { MessageType } from './messages';
```

## Testing Types

```typescript
// Test type utilities
type AssertEqual<T, U> = T extends U ? (U extends T ? true : false) : false;

// Usage in tests
type Test1 = AssertEqual<string, string>; // true
type Test2 = AssertEqual<string, number>; // false
```

## Future Enhancements

- Runtime type validation with io-ts or zod
- Auto-generation from OpenAPI specs
- Type documentation generation
- Type coverage metrics
- Breaking change detection
