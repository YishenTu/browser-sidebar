# Services Module

High-level application services providing business operations and orchestration.

## Overview

The services module contains the application's service layer, providing high-level abstractions over core functionality. These services act as facades, simplifying complex operations and coordinating between multiple modules while maintaining clean interfaces for the UI layer.

## Structure

```
services/
├── chat/               # Chat service implementation
│   ├── ChatService.ts  # Main chat service
│   ├── messageQueue.ts # Message queueing
│   └── context.ts      # Context management
├── engine/             # Engine service wrapper
│   ├── EngineService.ts # Engine facade
│   └── streamHandler.ts # Stream processing
├── extraction/         # Content extraction service
│   ├── ExtractionService.ts # Main extraction service
│   ├── batchProcessor.ts # Batch extraction
│   └── README.md       # Extraction documentation
├── keys/               # API key management
│   ├── KeyService.ts   # Key management service
│   ├── validation.ts   # Key validation
│   └── README.md       # Key service documentation
└── session/            # Session management
    ├── SessionService.ts # Session service
    ├── lifecycle.ts    # Session lifecycle
    └── README.md       # Session documentation
```

## Service Modules

### Chat Service (`chat/`)

**Purpose**: High-level chat operations and message management.

**Responsibilities**:

- Message sending and receiving
- Conversation history management
- Context preparation
- Response formatting
- Error recovery

**Key Features**:

- Message queueing with priority
- Automatic retry on failure
- Context window optimization
- Response caching
- Multi-turn conversation support

### Engine Service (`engine/`)

**Purpose**: Wrapper around the core chat engine with additional features.

**Responsibilities**:

- Engine lifecycle management
- Provider selection and switching
- Stream coordination
- Performance monitoring
- Resource management

**Key Features**:

- Automatic provider failover
- Stream buffering and smoothing
- Token usage tracking
- Latency monitoring
- Memory optimization

### Extraction Service (`extraction/`)

**Purpose**: Manages content extraction from web pages.

**Responsibilities**:

- Single and batch extraction
- Cache management
- Extraction strategy selection
- Format conversion
- Error handling

**Key Features**:

- Multi-tab extraction
- Incremental extraction for large pages
- Smart caching with TTL
- Format detection and conversion
- Performance optimization

### Key Service (`keys/`)

**Purpose**: Secure API key management and validation.

**Responsibilities**:

- Key storage and retrieval
- Encryption/decryption
- Key validation
- Provider association
- Access control

**Key Features**:

- AES-GCM encryption
- Secure key storage
- Provider-specific validation
- Key rotation support
- Audit logging

### Session Service (`session/`)

**Purpose**: Manages user sessions and conversation contexts.

**Responsibilities**:

- Session creation and termination
- State persistence
- Context switching
- Session recovery
- Memory management

**Key Features**:

- Tab-specific sessions
- URL-based context
- Session restoration
- Automatic cleanup
- State synchronization

## Service Patterns

### Service Interface Pattern

```typescript
interface Service<T> {
  initialize(): Promise<void>;
  execute(params: T): Promise<Result>;
  cleanup(): Promise<void>;
}
```

### Facade Pattern

```typescript
class ChatService {
  constructor(
    private engine: ChatEngine,
    private extraction: ExtractionService,
    private session: SessionService
  ) {}

  async sendMessage(content: string): Promise<Response> {
    // Coordinates between multiple services
    const context = await this.extraction.getCurrentContext();
    const session = await this.session.getActive();
    return this.engine.chat(content, { context, session });
  }
}
```

### Queue Pattern

```typescript
class MessageQueue {
  private queue: PriorityQueue<Message>;

  async enqueue(message: Message, priority: Priority): Promise<void>;
  async process(): Promise<void>;
  async retry(message: Message): Promise<void>;
}
```

## Usage Examples

### Chat Service

```typescript
import { chatService } from '@services/chat';

// Send a message
const response = await chatService.sendMessage('Hello', {
  includeContext: true,
  stream: true,
});

// Get conversation history
const history = await chatService.getHistory(sessionId);
```

### Extraction Service

```typescript
import { extractionService } from '@services/extraction';

// Extract single tab
const content = await extractionService.extractTab(tabId);

// Batch extraction
const contents = await extractionService.extractMultiple(tabIds);
```

### Key Service

```typescript
import { keyService } from '@services/keys';

// Save API key
await keyService.saveKey('openai', apiKey);

// Validate key
const isValid = await keyService.validateKey('openai', apiKey);

// Get decrypted key
const key = await keyService.getKey('openai');
```

### Session Service

```typescript
import { sessionService } from '@services/session';

// Start new session
const session = await sessionService.startSession({
  tabId,
  url,
  context,
});

// Switch sessions
await sessionService.switchTo(sessionId);

// Clean up old sessions
await sessionService.cleanup({
  olderThan: '24h',
});
```

## Service Coordination

Services often work together:

```
User Input → Chat Service
                ↓
         Session Service (get context)
                ↓
         Extraction Service (get page content)
                ↓
         Engine Service (process with AI)
                ↓
         Response to User
```

## Error Handling

### Service-Level Errors

- **Initialization Errors**: Service not ready
- **Validation Errors**: Invalid input parameters
- **Resource Errors**: Quota exceeded, rate limits
- **Network Errors**: Connection failures
- **State Errors**: Invalid state transitions

### Error Recovery

```typescript
class ServiceWithRetry {
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
}
```

## Performance Optimization

- **Lazy Initialization**: Services initialize on first use
- **Connection Pooling**: Reuse connections
- **Request Batching**: Combine multiple requests
- **Caching**: Smart caching strategies
- **Resource Limits**: Memory and CPU constraints

## Testing

### Unit Testing

```typescript
describe('ChatService', () => {
  it('should send message with context', async () => {
    const mockEngine = createMockEngine();
    const service = new ChatService(mockEngine);

    const response = await service.sendMessage('test');
    expect(response).toBeDefined();
  });
});
```

### Integration Testing

- Service interaction tests
- End-to-end workflows
- Performance benchmarks
- Load testing

## Best Practices

1. **Single Responsibility**: Each service has one clear purpose
2. **Dependency Injection**: Services receive dependencies
3. **Interface Segregation**: Small, focused interfaces
4. **Error Boundaries**: Contain errors within services
5. **Observability**: Logging and monitoring built-in

## Future Enhancements

- Service discovery mechanism
- Circuit breaker pattern
- Service mesh for inter-service communication
- Distributed tracing
- Service versioning
