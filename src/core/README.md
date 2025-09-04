# Core Module

Central business logic and domain services for the AI Browser Sidebar Extension.

## Overview

The core module contains the essential business logic, AI provider implementations, chat engine, and extraction orchestration. It serves as the brain of the application, coordinating between different layers while maintaining clean architecture principles.

## Structure

```
core/
├── ai/                 # AI provider integrations
│   ├── providers/      # Provider implementations
│   ├── interfaces/     # Provider contracts
│   └── factory/        # Provider factory pattern
├── engine/             # Chat engine implementation
│   ├── ChatEngine.ts   # Main engine class
│   ├── streaming/      # Stream processing
│   └── session/        # Session management
└── extraction/         # Content extraction orchestration
    ├── orchestrator/   # Extraction coordination
    ├── pipeline/       # Processing pipeline
    └── cache/          # Content caching
```

## Submodules

### AI Module (`ai/`)

**Purpose**: Unified interface for multiple AI providers with streaming support.

**Key Components**:

- **Provider Interface**: Abstract base for all AI providers
- **OpenAI Implementation**: GPT-5 series with thinking display
- **Gemini Implementation**: Gemini 2.5 with dynamic reasoning
- **Stream Processing**: Token buffering and smooth display
- **Error Handling**: Provider-specific error recovery

**Features**:

- Streaming responses with backpressure handling
- Thinking/reasoning display support
- Token counting and rate limiting
- Automatic retry with exponential backoff
- Provider health monitoring

### Engine Module (`engine/`)

**Purpose**: Core chat engine managing conversations and AI interactions.

**Key Components**:

- **ChatEngine**: Main orchestrator for chat operations
- **Message Handler**: Process and route messages
- **Stream Manager**: Handle streaming responses
- **Session Context**: Maintain conversation state
- **Response Builder**: Format AI responses

**Responsibilities**:

- Session lifecycle management
- Message queueing and processing
- Stream coordination with UI
- Context window management
- Error recovery and fallbacks

### Extraction Module (`extraction/`)

**Purpose**: High-level orchestration of content extraction from web pages.

**Key Components**:

- **Orchestrator**: Coordinates extraction pipeline
- **Pipeline Stages**: Sequential processing steps
- **Cache Manager**: Content caching with TTL
- **Format Converters**: HTML to Markdown conversion
- **Content Analyzers**: Determine optimal extraction strategy

**Features**:

- Multi-strategy extraction (raw, semantic, visual)
- Incremental extraction for large pages
- Dynamic content detection
- Cache invalidation strategies
- Batch extraction support

## Architecture Patterns

### Provider Pattern

```typescript
interface AIProvider {
  initialize(config: ProviderConfig): Promise<void>;
  chat(messages: Message[], options: ChatOptions): AsyncGenerator<Token>;
  validateKey(key: string): Promise<boolean>;
  getCapabilities(): ProviderCapabilities;
}
```

### Engine Pattern

```typescript
class ChatEngine {
  constructor(provider: AIProvider);
  startSession(context: SessionContext): void;
  sendMessage(content: string): Promise<StreamHandle>;
  endSession(): void;
}
```

### Extraction Pipeline

```
Input URL → Analyzer → Extractor → Converter → Cache → Output
              ↓           ↓           ↓         ↓
          Strategy    Content    Markdown    Store
```

## Usage Examples

### AI Provider Usage

```typescript
import { createProvider } from '@core/ai';

const provider = createProvider('openai', {
  apiKey: 'key',
  model: 'gpt-5',
});

const stream = provider.chat(messages, {
  temperature: 0.7,
  stream: true,
});
```

### Engine Usage

```typescript
import { ChatEngine } from '@core/engine';

const engine = new ChatEngine(provider);
engine.startSession({ tabId, url });

const response = await engine.sendMessage('Hello');
for await (const token of response) {
  // Process streaming tokens
}
```

### Extraction Usage

```typescript
import { ExtractionOrchestrator } from '@core/extraction';

const orchestrator = new ExtractionOrchestrator();
const content = await orchestrator.extract(url, {
  strategy: 'semantic',
  includeImages: true,
});
```

## Performance Considerations

- **Lazy Loading**: Providers loaded on demand
- **Stream Buffering**: Smooth token display
- **Cache Strategy**: 5-minute TTL for extracted content
- **Memory Management**: Automatic cleanup of old sessions
- **Concurrency**: Limited parallel extractions

## Error Handling

- **Provider Errors**: Automatic fallback to alternative models
- **Network Errors**: Exponential backoff with retry
- **Extraction Errors**: Graceful degradation to simpler strategies
- **Stream Errors**: Recovery with partial content preservation

## Testing

- Unit tests for each provider implementation
- Integration tests for engine operations
- Mock providers for testing
- Performance benchmarks for streaming

## Future Enhancements

- Additional AI provider integrations (Anthropic, Cohere)
- Advanced caching strategies
- Federated learning capabilities
- Plugin system for custom providers
- WebAssembly extraction optimizations
