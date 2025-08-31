# Provider Module

The provider module implements a unified interface for integrating multiple AI providers (OpenAI and Google Gemini) with streaming support, error handling, and performance optimizations.

## Directory Structure

```
provider/
├── BaseProvider.ts         # Abstract base class for all providers
├── ProviderFactory.ts      # Factory pattern for provider creation
├── ProviderRegistry.ts     # Singleton registry for provider instances
├── openai/                # OpenAI provider implementation
│   ├── OpenAIProvider.ts  # OpenAI-specific logic
│   ├── OpenAIClient.ts    # API client wrapper
│   ├── errorHandler.ts    # OpenAI error handling
│   ├── index.ts          # OpenAI exports
│   ├── requestBuilder.ts  # Request construction
│   ├── responseParser.ts  # Response parsing
│   ├── searchMetadata.ts  # Search metadata handling
│   ├── streamProcessor.ts # Stream processing
│   ├── types.ts          # OpenAI types
│   └── README.md         # OpenAI documentation
└── gemini/                # Gemini provider implementation
    ├── GeminiProvider.ts  # Gemini-specific logic
    ├── GeminiClient.ts    # API client wrapper
    ├── errorHandler.ts    # Gemini error handling
    ├── index.ts          # Gemini exports
    ├── requestBuilder.ts  # Request construction
    ├── responseParser.ts  # Response parsing
    ├── searchMetadata.ts  # Search metadata handling
    ├── streamProcessor.ts # Stream processing
    ├── types.ts          # Gemini types
    └── README.md         # Gemini documentation
```

## Architecture Overview

```
Application Layer
    ↓
Provider Factory (creates providers)
    ↓
Provider Registry (manages instances)
    ↓
Provider Interface (unified API)
    ├─ OpenAI Provider
    │   ├─ GPT-5 Models
    │   └─ Response API
    └─ Gemini Provider
        ├─ Gemini 2.5 Models
        └─ GenerateContent API
```

## Core Components

### BaseProvider

Abstract base class that defines the provider contract:

**Required Methods:**

- `chat(messages)` - Synchronous chat completion
- `streamChat(messages)` - Streaming with async generator
- `validateApiKey()` - Validate API credentials
- `cancel()` - Cancel ongoing requests
- `dispose()` - Clean up resources

**Utility Methods:**

- `estimateTokens(text)` - Token counting
- `getModel()` - Current model name
- `getProvider()` - Provider type

### ProviderFactory

Creates provider instances with validation:

**Features:**

- Type-safe provider creation
- Configuration validation
- Default value application
- Error handling

**Usage:**

```typescript
const provider = ProviderFactory.createProvider({
  type: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-5-mini',
});
```

### ProviderRegistry

Singleton for managing provider lifecycle:

**Features:**

- Instance caching
- Resource management
- Provider switching
- Lazy initialization

**Benefits:**

- Reuse existing instances
- Prevent memory leaks
- Centralized management

### API Key Validation

Live validation with caching:

**Features:**

- Real API testing
- 5-minute result caching
- Deduplication
- Error recovery

**Validation Flow:**

1. Check cache for recent validation
2. Make minimal API call
3. Cache result with timestamp
4. Return validation status

## Provider Implementations

### OpenAI Provider

Located in `openai/` subdirectory.

**Supported Models:**

- `gpt-5-nano` - Fast, low reasoning
- `gpt-5-mini` - Balanced performance
- `gpt-5` - Advanced reasoning

**Key Features:**

- Response API implementation
- Configurable reasoning effort
- Real-time streaming
- Thinking display support
- Request cancellation

**Configuration:**

```typescript
{
  apiKey: string;        // Required
  model: string;         // Model selection
  reasoningEffort?: 'low' | 'medium' | 'high';
}
```

### Gemini Provider

Located in `gemini/` subdirectory.

**Supported Models:**

- `gemini-2.5-flash-lite` - Cost-effective
- `gemini-2.5-flash` - Balanced
- `gemini-2.5-pro` - Maximum capabilities

**Key Features:**

- GenerateContent API
- Dynamic thinking budgets
- Multimodal support
- Web search grounding
- Safety settings

**Configuration:**

```typescript
{
  apiKey: string;        // Required
  model: string;         // Model selection
  thinkingBudget?: string; // '0' off, '-1' dynamic
  showThoughts?: boolean;
}
```

## Streaming Architecture

### Processing Pipeline

```
API Response
    ↓
Stream Parser (SSE/NDJSON)
    ↓
Stream Processor (provider-specific)
    ↓
Token Buffer (smooth delivery)
    ↓
UI Component
```

### Stream Parsing

**Supported Formats:**

- Server-Sent Events (SSE) - OpenAI
- Newline-Delimited JSON (NDJSON) - Gemini

**Features:**

- Chunk reassembly
- Error recovery
- Format detection
- Partial data handling

### Token Buffering

**Strategies:**

- Size-based (flush at N tokens)
- Time-based (flush every T ms)
- Word boundary (natural breaks)
- Hybrid (optimal performance)

## Error Handling

### Error Types

| Type               | Description         | Recovery              |
| ------------------ | ------------------- | --------------------- |
| `authentication`   | Invalid API key     | Prompt for new key    |
| `rate_limit`       | Rate limit exceeded | Retry with backoff    |
| `network`          | Network error       | Retry with backoff    |
| `context_exceeded` | Context too long    | Reduce message size   |
| `model_not_found`  | Invalid model       | Switch to valid model |
| `validation`       | Invalid input       | Fix and retry         |
| `unknown`          | Unexpected error    | Log and notify        |

### Error Recovery

**Retry Logic:**

```typescript
// Exponential backoff with jitter
const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, maxDelay);
```

**Best Practices:**

1. Check if error is retryable
2. Calculate appropriate delay
3. Limit retry attempts
4. Provide user feedback
5. Log for debugging

## Performance Optimization

### Caching Strategy

**Implementation:**

- Response caching for identical requests
- SHA-256 hashing for cache keys
- LRU eviction policy
- Configurable TTL

### Connection Pooling

**Features:**

- Connection reuse
- Health checks
- Pool size limits
- Automatic cleanup

### Memory Management

**Strategies:**

- Buffer size limits
- Reference clearing
- Periodic cleanup
- Memory monitoring

## Security

### API Key Security

**Protection Measures:**

- AES-GCM encryption at rest
- PBKDF2 key derivation
- Memory clearing after use
- Rotation support
- Audit logging

### Request Sanitization

**Validation:**

- Control character removal
- Length limits
- Injection prevention
- Input validation
- Rate limiting

## Configuration

### Model Configuration

Centralized in `src/config/models.ts`:

**Defines:**

- Available models per provider
- Context lengths
- Token limits
- Feature support
- Default settings

### Provider Settings

**Minimal Configuration:**

- API key (required)
- Model selection
- Provider-specific options

**Removed Parameters:**

- temperature
- topP, topK
- maxTokens
- frequencyPenalty
- presencePenalty

## API Usage

### Basic Chat

```typescript
import { ProviderFactory } from '@provider/ProviderFactory';

const provider = ProviderFactory.createProvider({
  type: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-5-mini',
});

const response = await provider.chat([{ role: 'user', content: 'Hello!' }]);
```

### Streaming

```typescript
const stream = provider.streamChat([{ role: 'user', content: 'Tell me a story' }]);

for await (const chunk of stream) {
  if (chunk.thinking) {
    // Display thinking
  } else {
    // Display content
  }
}
```

### Provider Switching

```typescript
const registry = ProviderRegistry.getInstance();

// Get or create provider
const provider = await registry.getProvider('openai', config);

// Switch providers
const newProvider = await registry.getProvider('gemini', newConfig);
```

## Testing

### Test Coverage

```bash
# Run provider tests
npm test -- src/provider

# Specific provider tests
npm test -- src/provider/openai
npm test -- src/provider/gemini
```

### Test Types

- Unit tests for components
- Integration tests for API calls
- Performance benchmarks
- Error handling verification

## Debugging

### Enable Debug Logging

```typescript
// Development only
const DEBUG = process.env.NODE_ENV === 'development';
if (DEBUG) console.log('Provider:', data);
```

### Common Issues

#### API Key Invalid

- Verify key format
- Check permissions
- Test with curl
- Ensure connectivity

#### Streaming Stops

- Implement retry logic
- Check network stability
- Monitor timeouts
- Resume from position

## Future Enhancements

### Planned Features

1. **Additional Providers**
   - Claude API
   - Local models (Ollama)
   - Custom providers

2. **Advanced Streaming**
   - WebSocket support
   - Binary protocols
   - Compression

3. **Performance**
   - Request batching
   - Predictive prefetching
   - Advanced caching

4. **Developer Tools**
   - Provider playground
   - Request inspector
   - Performance profiler

### Experimental Features

Enable via feature flags:

- WebSocket streaming
- Response caching
- Custom plugins
- Metrics collection

## Contributing

### Adding a Provider

1. Create directory in `provider/`
2. Extend BaseProvider
3. Implement required methods
4. Add to ProviderFactory
5. Write tests
6. Update documentation

### Code Standards

- TypeScript strict mode
- 100% type coverage
- Comprehensive error handling
- Unit test coverage >80%
- Documentation for public APIs

## License

MIT License - Part of the AI Browser Sidebar Extension project
