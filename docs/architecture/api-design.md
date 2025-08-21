# API Design Documentation

## Message Passing API

### Core Message Interface

```typescript
interface Message<T = any> {
  id: string; // Unique message ID (UUID)
  type: MessageType; // Message type enum
  payload: T; // Type-safe payload
  timestamp: number; // Unix timestamp
  source: ComponentType; // Origin component
  target?: ComponentType; // Target component (optional)
  error?: ErrorInfo; // Error information (if applicable)
}

type ComponentType = 'popup' | 'content' | 'background' | 'sidepanel';

interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
}
```

## Message Types

### Content Extraction Messages

#### EXTRACT_CONTENT

Request content extraction from current tab.

```typescript
// Request
{
  type: 'EXTRACT_CONTENT',
  payload: {
    options?: {
      includeImages?: boolean;
      includeLinks?: boolean;
      includeCode?: boolean;
      maxLength?: number;
    }
  }
}

// Response
{
  type: 'CONTENT_EXTRACTED',
  payload: {
    url: string;
    title: string;
    content: string;        // Markdown formatted
    metadata: {
      author?: string;
      publishedDate?: string;
      wordCount: number;
      language: string;
    };
    selection?: {
      text: string;
      context: string;
      markers: SelectionMarker[];
    };
    extractedAt: number;
  }
}
```

#### GET_SELECTION

Get currently selected text with context.

```typescript
// Request
{
  type: 'GET_SELECTION',
  payload: {}
}

// Response
{
  type: 'SELECTION_DATA',
  payload: {
    hasSelection: boolean;
    selection?: {
      text: string;
      context: string;      // Surrounding text
      range: DOMRange;
    }
  }
}
```

### AI Provider Messages

#### SEND_TO_AI

Send message to AI provider.

```typescript
// Request
{
  type: 'SEND_TO_AI',
  payload: {
    messages: ChatMessage[];
    model: string;
    provider: 'openai' | 'gemini' | 'anthropic';
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    };
    context?: {
      tabContent?: string[];
      conversationId?: string;
    }
  }
}

// Response (Streaming)
{
  type: 'AI_STREAM_CHUNK',
  payload: {
    chunk: string;
    finished: boolean;
    usage?: {
      promptTokens: number;
      completionTokens: number;
    }
  }
}

// Response (Complete)
{
  type: 'AI_RESPONSE',
  payload: {
    content: string;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    latency: number;
  }
}
```

### Storage Messages

#### SAVE_CONVERSATION

Save conversation to storage.

```typescript
{
  type: 'SAVE_CONVERSATION',
  payload: {
    id?: string;            // Optional for new conversations
    title: string;
    messages: ChatMessage[];
    metadata: {
      model: string;
      provider: string;
      tabContext?: string[];
    }
  }
}
```

#### LOAD_CONVERSATION

Load conversation from storage.

```typescript
// Request
{
  type: 'LOAD_CONVERSATION',
  payload: {
    id: string;
  }
}

// Response
{
  type: 'CONVERSATION_LOADED',
  payload: {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
  }
}
```

### Tab Management Messages

#### GET_TABS

Get list of open tabs.

```typescript
// Request
{
  type: 'GET_TABS',
  payload: {
    filter?: {
      active?: boolean;
      currentWindow?: boolean;
      url?: string;       // Pattern matching
    }
  }
}

// Response
{
  type: 'TABS_LIST',
  payload: {
    tabs: Array<{
      id: number;
      title: string;
      url: string;
      favicon?: string;
      active: boolean;
      windowId: number;
    }>
  }
}
```

#### EXTRACT_MULTI_TAB

Extract content from multiple tabs.

```typescript
// Request
{
  type: 'EXTRACT_MULTI_TAB',
  payload: {
    tabIds: number[];
    options?: ExtractOptions;
  }
}

// Response
{
  type: 'MULTI_TAB_EXTRACTED',
  payload: {
    results: Array<{
      tabId: number;
      success: boolean;
      content?: string;
      error?: string;
    }>;
    aggregated: string;     // Combined markdown
  }
}
```

## Provider API Interfaces

### Base Provider Interface

```typescript
interface Provider {
  id: string;
  name: string;

  // Configuration
  configure(config: ProviderConfig): Promise<void>;
  validateConfig(): Promise<boolean>;
  getModels(): ModelInfo[];

  // Chat Operations
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest, callback: StreamCallback): Promise<void>;

  // Utilities
  countTokens(text: string, model?: string): number;
  getUsage(): Promise<UsageInfo>;
}
```

### Provider Configurations

#### OpenAI Configuration

```typescript
interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  defaultModel: 'gpt-4' | 'gpt-3.5-turbo' | 'gpt-4-turbo';
  responseFormat?: 'text' | 'json';
}
```

#### Gemini Configuration

```typescript
interface GeminiConfig {
  apiKey: string;
  defaultModel: 'gemini-pro' | 'gemini-pro-vision';
  safetySettings?: SafetySettings;
}
```

#### Anthropic Configuration

```typescript
interface AnthropicConfig {
  apiKey: string;
  baseURL?: string; // For OpenRouter
  defaultModel: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku';
  maxTokens?: number;
}
```

## Storage API

### Chrome Storage API Wrapper

```typescript
interface StorageAPI {
  // Basic Operations
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;

  // Batch Operations
  getMultiple(keys: string[]): Promise<Record<string, any>>;
  setMultiple(items: Record<string, any>): Promise<void>;

  // Utilities
  getUsage(): Promise<StorageUsage>;
  onChange(callback: (changes: StorageChanges) => void): () => void;
}
```

### IndexedDB API

```typescript
interface DatabaseAPI {
  // Connection
  open(): Promise<void>;
  close(): Promise<void>;

  // CRUD Operations
  add<T>(storeName: string, item: T): Promise<void>;
  get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined>;
  update<T>(storeName: string, item: T): Promise<void>;
  delete(storeName: string, key: IDBValidKey): Promise<void>;

  // Queries
  getAll<T>(storeName: string): Promise<T[]>;
  getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]>;

  // Transactions
  transaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: TransactionCallback<T>
  ): Promise<T>;
}
```

## Error Codes

```typescript
enum ErrorCode {
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // API Errors
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Provider Errors
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // Storage Errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',

  // Extension Errors
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONTENT_SCRIPT_FAILED = 'CONTENT_SCRIPT_FAILED',
}
```

## Rate Limiting

```typescript
interface RateLimiter {
  // Check if request can proceed
  canProceed(): boolean;

  // Wait until request can proceed
  wait(): Promise<void>;

  // Record a request
  recordRequest(): void;

  // Get current status
  getStatus(): {
    remaining: number;
    resetAt: number;
    limit: number;
  };
}
```

## WebSocket/SSE Streaming

```typescript
interface StreamManager {
  // Open stream connection
  connect(url: string, options?: StreamOptions): Promise<void>;

  // Send message
  send(data: any): void;

  // Event handlers
  onMessage(callback: (data: any) => void): void;
  onError(callback: (error: Error) => void): void;
  onClose(callback: () => void): void;

  // Close connection
  close(): void;
}
```

---

_API Design Version: 1.0_  
_Last Updated: 2025-08-19_
