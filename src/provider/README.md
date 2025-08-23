# Provider Layer Documentation

This directory contains the AI provider integration layer for the Browser Sidebar extension. It provides a clean abstraction for interacting with OpenAI and Gemini APIs.

## Architecture Overview

The provider layer follows a modular architecture with clear separation of concerns:

```
provider/
├── BaseProvider.ts         # Abstract base class for all providers
├── ProviderFactory.ts      # Factory for creating provider instances
├── ProviderRegistry.ts     # Registry for managing provider instances
├── validation.ts           # API key validation service
├── errors.ts              # Provider error types and utilities
├── streamParser.ts        # Stream parsing utilities
├── tokenBuffer.ts         # Token buffering for smooth streaming
├── openai/                # OpenAI-specific implementation
│   ├── OpenAIProvider.ts  # OpenAI provider implementation
│   ├── OpenAIClient.ts    # OpenAI API client
│   └── README.md         # OpenAI provider documentation
└── gemini/                # Gemini-specific implementation
    ├── GeminiProvider.ts  # Gemini provider implementation
    ├── GeminiClient.ts    # Gemini API client
    └── README.md         # Gemini provider documentation
```

## Core Components

### BaseProvider.ts
Abstract base class that all AI providers extend. Provides:
- Common interface for chat and streaming operations
- Token estimation and usage tracking
- Error handling and formatting
- Request lifecycle management
- Model configuration access

### ProviderFactory.ts
Factory pattern implementation for creating provider instances:
- Type-safe provider creation
- Default configuration generation
- Validation before instantiation
- Support for OpenAI and Gemini providers

### ProviderRegistry.ts
Singleton registry for managing provider instances:
- Provider instance caching
- Lifecycle management
- Type-safe provider retrieval
- Resource cleanup on disposal

### validation.ts
API key validation service with:
- Live API validation through test calls
- Result caching for performance
- Batch validation support
- Comprehensive error reporting
- Support for OpenAI and Gemini

### errors.ts
Provider error handling utilities:
- Standardized error types
- Error formatting and wrapping
- Provider-specific error mapping
- Retry logic helpers

### streamParser.ts
Stream parsing for different response formats:
- Server-Sent Events (SSE) parsing
- Newline-delimited JSON parsing
- Chunk reassembly
- Error recovery

### tokenBuffer.ts
Token buffering for smooth streaming:
- Multiple flush strategies (SIZE_BASED, TIME_BASED, HYBRID)
- Configurable buffer sizes
- Smooth token delivery
- Backpressure handling

## Provider Implementations

### OpenAI Provider
Located in `openai/` subdirectory:
- **OpenAIProvider.ts**: Implements OpenAI's Responses API
- **OpenAIClient.ts**: Handles API communication and initialization
- Supports reasoning effort parameter (low/medium/high)
- Streaming with token buffering
- Request cancellation via AbortController

### Gemini Provider
Located in `gemini/` subdirectory:
- **GeminiProvider.ts**: Implements Gemini's generateContent API
- **GeminiClient.ts**: Handles API communication and initialization
- Supports thinking budgets ('0'=off, '-1'=dynamic)
- Multimodal capabilities (text, images)
- Streaming with chunk processing

## Configuration

### Minimal Configuration
After the refactor, providers only require essential configuration:

**OpenAI:**
```typescript
{
  apiKey: string;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}
```

**Gemini:**
```typescript
{
  apiKey: string;
  model: string;
  thinkingBudget?: '0' | '-1';
  showThoughts?: boolean;
}
```

### Removed Parameters
The following parameters have been removed as they're no longer used:
- `temperature` - Model-specific behavior is predetermined
- `topP`, `topK` - Sampling parameters not needed
- `maxTokens` - Uses model defaults from centralized config
- `frequencyPenalty`, `presencePenalty` - Not used in current implementation

## Usage Example

```typescript
import { ProviderFactory } from './provider/ProviderFactory';
import { ProviderRegistry } from './provider/ProviderRegistry';

// Create and register a provider
const factory = new ProviderFactory();
const registry = ProviderRegistry.getInstance();

// Create OpenAI provider
const openaiConfig = {
  apiKey: 'sk-...',
  model: 'gpt-5-nano',
  reasoningEffort: 'medium'
};
const openaiProvider = await factory.createProvider({
  type: 'openai',
  config: openaiConfig
});
registry.registerProvider('openai', openaiProvider);

// Use the provider
const response = await openaiProvider.chat([
  { role: 'user', content: 'Hello!' }
]);

// Stream responses
for await (const chunk of openaiProvider.streamChat(messages)) {
  console.log(chunk.choices[0]?.delta?.content);
}
```

## Model Configuration

All model configurations are centralized in `src/config/models.ts`. The provider layer references this single source of truth for:
- Available models per provider
- Model capabilities (context length, max tokens)
- Feature support (reasoning, thinking budgets)

## Error Handling

Providers use a standardized error format:
```typescript
{
  type: 'authentication' | 'rate_limit' | 'network' | 'validation' | 'unknown';
  message: string;
  code: string;
  provider: string;
  details?: any;
  retryAfter?: number;
}
```

## Testing

Each provider includes comprehensive tests covering:
- API key validation
- Chat completion
- Streaming responses
- Error scenarios
- Request cancellation

## Migration Notes

### Recent Changes (Provider Refactor Completed)
- Model configurations centralized in `src/config/models.ts` (single source of truth)
- RateLimiter and RequestQueue removed (not needed for BYOK model)
- OpenRouter provider removed (focus on OpenAI and Gemini only)
- Temperature, topP, topK parameters removed (not used by current models)
- Simplified validation - format validation removed, live API testing only
- Removed duplicate model definitions in provider-specific files

### Backward Compatibility
- Legacy parameters in stored settings are ignored with debug logging
- Settings migration automatically removes deprecated fields
- API remains compatible for existing integrations