# AI Provider Layer Architecture

The provider layer implements a robust, extensible architecture for integrating multiple AI providers (OpenAI and Google Gemini) into the Browser Sidebar extension. It provides unified interfaces, streaming support, error handling, and performance optimizations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Provider Implementations](#provider-implementations)
- [Streaming Architecture](#streaming-architecture)
- [Configuration Management](#configuration-management)
- [API Reference](#api-reference)
- [Usage Guidelines](#usage-guidelines)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Testing Strategy](#testing-strategy)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

## Architecture Overview

The provider layer follows a modular architecture with clear separation of concerns:

- **Unified Interface**: All providers implement a common interface for consistency
- **Factory Pattern**: Provider creation is handled through a centralized factory
- **Singleton Registry**: Provider instances are managed through a registry pattern
- **Stream Processing**: Built-in support for streaming responses with buffering
- **Error Resilience**: Comprehensive error handling and recovery mechanisms

### Design Principles

1. **Provider Agnostic**: Unified interface for all AI providers
2. **Streaming First**: Built-in streaming support with buffering
3. **Type Safety**: Full TypeScript coverage with strict typing
4. **Error Resilience**: Comprehensive error handling and recovery
5. **Performance Optimized**: Token buffering, caching, and lazy loading
6. **Security Focused**: API key encryption and validation
7. **Extensible**: Easy to add new providers

## Directory Structure

```
provider/
├── BaseProvider.ts         # Abstract base class defining provider interface
├── ProviderFactory.ts      # Factory pattern for creating providers
├── ProviderRegistry.ts     # Singleton registry managing provider instances
├── validation.ts           # API key validation with live testing
├── errors.ts              # Standardized error types and utilities
├── streamParser.ts        # Stream parsing for SSE and NDJSON
├── tokenBuffer.ts         # Token buffering for smooth streaming
├── types.ts               # TypeScript type definitions
├── openai/                # OpenAI provider implementation
│   ├── OpenAIProvider.ts  # OpenAI-specific provider logic
│   ├── OpenAIClient.ts    # OpenAI API client wrapper
│   ├── streamProcessor.ts # OpenAI stream processing
│   ├── types.ts          # OpenAI-specific types
│   └── README.md         # OpenAI provider documentation
├── gemini/                # Gemini provider implementation
│   ├── GeminiProvider.ts  # Gemini-specific provider logic
│   ├── GeminiClient.ts    # Gemini API client wrapper
│   ├── streamProcessor.ts # Gemini stream processing
│   ├── types.ts          # Gemini-specific types
│   └── README.md         # Gemini provider documentation
└── README.md             # This file
```

## Core Components

### BaseProvider

Abstract base class that all AI providers must extend. Provides the foundation for provider implementations with:

- **Abstract Methods**: Define contract for all providers
- **Token Estimation**: Built-in token counting utilities
- **Error Handling**: Standardized error transformation
- **Request Cancellation**: AbortController management
- **Resource Cleanup**: Proper disposal of resources

### ProviderFactory

Factory pattern implementation for creating provider instances with validation and configuration:

- **Provider Creation**: Instantiate correct provider class
- **Configuration Validation**: Ensure required fields present
- **Default Configuration**: Provide sensible defaults
- **Type Safety**: Enforce type constraints

### ProviderRegistry

Singleton registry for managing provider lifecycle and caching instances:

- **Singleton Pattern**: Single instance across application
- **Provider Caching**: Reuse provider instances
- **Lifecycle Management**: Proper disposal of resources
- **Lazy Initialization**: Create providers on demand

### Validation Service

Live API validation with caching for performance:

- **Live Testing**: Actual API calls for validation
- **Result Caching**: Cache valid results for 5 minutes
- **Deduplication**: Prevent duplicate validation requests
- **Error Recovery**: Graceful handling of network errors

### Error Handler

Comprehensive error handling with standardized types:

- **Error Types**: Authentication, rate limit, network, validation, etc.
- **Error Transformation**: Provider-specific error mapping
- **Retry Logic**: Helper functions for retry strategies
- **Error Recovery**: Graceful degradation strategies

### Stream Parser

Handles different streaming formats (SSE, NDJSON):

- **Server-Sent Events**: Parse SSE format streams
- **Newline-Delimited JSON**: Parse NDJSON streams
- **Chunk Reassembly**: Handle partial chunks
- **Error Recovery**: Continue on parse errors

### Token Buffer

Smooth token delivery with configurable strategies:

- **Flush Strategies**: Size-based, time-based, word boundary, hybrid
- **Configurable Buffering**: Adjustable buffer sizes and intervals
- **Sentence Detection**: Flush at natural boundaries
- **Memory Management**: Proper cleanup on disposal

## Provider Implementations

### OpenAI Provider

Located in `openai/` subdirectory. Implements OpenAI's Responses API with advanced features:

- **GPT-5 Series Support**: nano, mini, and full models
- **Reasoning Effort**: Configurable computation levels (low/medium/high)
- **Streaming**: Real-time response streaming with buffering
- **Thinking Display**: Shows model reasoning process
- **Cancellation**: Request cancellation via AbortController

### Gemini Provider

Located in `gemini/` subdirectory. Implements Google's Gemini API with multimodal support:

- **Gemini 2.5 Series**: Flash-lite, Flash, and Pro models
- **Thinking Budget**: Control reasoning computation ('0' off, '-1' dynamic)
- **Multimodal**: Support for text and images
- **Dynamic Thinking**: Auto-adjust based on complexity
- **Thought Display**: Optional reasoning visibility

## Streaming Architecture

### Stream Processing Pipeline

The streaming architecture implements a multi-stage pipeline:

1. **API Response**: Raw stream from provider API
2. **Stream Parser**: Parse format (SSE or NDJSON)
3. **Stream Processor**: Process chunks and detect thinking
4. **Token Buffer**: Buffer tokens for smooth delivery
5. **UI Component**: Display streamed content

### Buffering Strategies

- **Size-Based**: Flush when buffer reaches specific size
- **Time-Based**: Flush at regular intervals
- **Word Boundary**: Flush at natural word breaks
- **Hybrid**: Combination of strategies for optimal performance

## Configuration Management

### Model Configuration

All model configurations are centralized in `src/config/models.ts` with:

- Available models per provider
- Context lengths and token limits
- Feature support (reasoning, thinking)
- Default settings per model

### Provider Configuration

Minimal configuration required per provider:

**OpenAI:**

- `apiKey`: Required API key
- `model`: Model selection (gpt-5-nano, gpt-5-mini, gpt-5)
- `reasoningEffort`: Optional reasoning level

**Gemini:**

- `apiKey`: Required API key
- `model`: Model selection (gemini-2.5-flash-lite, gemini-2.5-flash, gemini-2.5-pro)
- `thinkingBudget`: Optional thinking computation control
- `showThoughts`: Optional thought visibility

### Removed Legacy Parameters

The following parameters have been removed in recent refactoring:

- `temperature`: Not used by current models
- `topP`, `topK`: Sampling parameters not needed
- `maxTokens`: Uses model defaults from config
- `frequencyPenalty`, `presencePenalty`: Not supported
- `systemPrompt`: Handled at application level

## API Reference

### Provider Interface

Core methods that all providers must implement:

- `chat(messages)`: Synchronous chat completion
- `streamChat(messages)`: Streaming chat with async generator
- `validateApiKey()`: Validate API key with provider
- `cancel()`: Cancel ongoing request
- `dispose()`: Clean up resources
- `estimateTokens(text)`: Estimate token count
- `getModel()`: Get current model name
- `getProvider()`: Get provider type

### Message Types

- **ChatMessage**: User/assistant messages with role and content
- **ChatResponse**: Response with content, usage, and metadata
- **StreamChunk**: Streaming chunk with content and thinking state

### Factory Options

- **CreateProviderOptions**: Type and configuration for provider creation
- **ProviderConfig**: Union type of provider-specific configurations

## Usage Guidelines

### Basic Chat Completion

Create a provider using the factory and send messages for completion. The provider handles formatting and API communication.

### Streaming Response

Use async generators to stream responses in real-time. Handle chunks as they arrive with proper error handling.

### Provider Registry

Use the registry to manage provider instances, cache providers for reuse, and handle provider switching.

### API Key Validation

Validate API keys before use with live testing. Results are cached to reduce API calls.

### Error Handling

Implement retry logic for transient errors, handle rate limits with exponential backoff, and provide user feedback for authentication errors.

### Request Cancellation

Support user-initiated cancellation of long-running requests using AbortController.

## Error Handling

### Error Types and Recovery

| Error Type         | Description         | Recovery Strategy     |
| ------------------ | ------------------- | --------------------- |
| `authentication`   | Invalid API key     | Prompt for new key    |
| `rate_limit`       | Rate limit exceeded | Retry with backoff    |
| `network`          | Network error       | Retry with backoff    |
| `context_exceeded` | Context too long    | Reduce message size   |
| `model_not_found`  | Model doesn't exist | Switch to valid model |
| `validation`       | Invalid input       | Fix input and retry   |
| `unknown`          | Unexpected error    | Log and notify user   |

### Error Handling Best Practices

- Implement retry logic with exponential backoff
- Check if errors are retryable before attempting
- Calculate appropriate delay between retries
- Provide clear error messages to users
- Log errors for debugging

## Performance Optimization

### Token Buffering Strategy

- Adaptive buffering based on network speed
- Detect connection quality and adjust strategy
- Use size-based buffering for slow connections
- Use hybrid strategy for fast connections

### Caching Strategy

- Cache responses for identical requests
- Use SHA-256 hashing for cache keys
- Implement LRU eviction for cache management
- Set appropriate TTL for cached responses

### Connection Pooling

- Reuse connections for multiple requests
- Implement health checks for connections
- Evict least recently used connections
- Maintain connection pool size limits

### Memory Management

- Limit buffer sizes to prevent memory growth
- Clear references after processing
- Implement periodic cleanup routines
- Monitor memory usage during streaming

## Security Considerations

### API Key Security

- Never store plaintext API keys
- Use AES-GCM encryption for storage
- Implement secure key derivation
- Clear keys from memory after use
- Support key rotation

### Request Sanitization

- Remove control characters from input
- Limit message length to prevent abuse
- Filter potential prompt injections
- Validate all user inputs
- Implement rate limiting

### Rate Limiting

- Track requests per minute (RPM)
- Monitor tokens per minute (TPM)
- Implement per-model rate limits
- Clean up old tracking entries
- Provide feedback when limited

## Testing Strategy

### Unit Tests

- Test provider factory creation
- Validate configuration handling
- Test token buffer strategies
- Verify error transformation
- Test stream parsing logic

### Integration Tests

- Test end-to-end chat completion
- Verify streaming functionality
- Test request cancellation
- Validate error handling
- Test provider switching

### Performance Tests

- Measure throughput under load
- Monitor memory usage during streaming
- Test buffering strategies
- Verify cache effectiveness
- Measure response times

## Migration Guide

### From v1 to v2 (Latest)

#### Breaking Changes

1. **Removed Parameters**: Temperature, topP, topK, maxTokens no longer supported
2. **Model Configuration**: Now centralized in `src/config/models.ts`
3. **Debug Logging**: Removed verbose console.debug statements

#### Migration Steps

1. Remove deprecated parameters from configuration
2. Add new provider-specific parameters if needed
3. Update provider creation calls
4. Migrate stored settings using migration utilities

#### Settings Migration

- Automatic migration removes deprecated fields
- Default values added for new fields
- Backward compatibility maintained through silent parameter ignoring

## Troubleshooting

### Common Issues

#### API Key Validation Fails

**Symptoms**: Validation returns false, 401/403 errors

**Solutions**:

- Verify API key format
- Check key permissions
- Test with curl commands
- Ensure network connectivity

#### Streaming Stops Unexpectedly

**Symptoms**: Stream ends without completion, partial responses

**Solutions**:

- Implement retry logic
- Resume from last position
- Check network stability
- Monitor timeout settings

#### High Memory Usage

**Symptoms**: Memory grows during streaming, browser slowdown

**Solutions**:

- Limit buffer sizes
- Clear references periodically
- Process chunks in batches
- Implement memory monitoring

### Debugging Tips

- Enable debug logging for development
- Use network inspection tools
- Monitor API calls and responses
- Check error logs for patterns
- Use performance profiling tools

## Future Enhancements

### Planned Features

1. **Additional Providers**
   - Claude API integration
   - Local model support (Ollama)
   - Custom provider interface

2. **Advanced Streaming**
   - WebSocket connections
   - Server-sent events optimization
   - Binary protocol support

3. **Performance Features**
   - Request batching
   - Response caching layer
   - Predictive prefetching

4. **Security Enhancements**
   - Hardware key support
   - OAuth integration
   - Request signing

5. **Developer Tools**
   - Provider playground
   - Request/response inspector
   - Performance profiler

### Experimental Features

Enable experimental features through feature flags:

- WebSocket streaming
- Response caching
- Predictive prefetching
- Performance metrics
- Custom provider plugins

### Provider Plugin System

Future support for third-party provider plugins with:

- Lifecycle hooks (install, uninstall, update)
- Configuration management
- Custom UI components
- Validation and security checks

## Contributing

### Development Setup

1. Install dependencies with `npm install`
2. Build provider layer with build scripts
3. Run tests to ensure functionality
4. Use watch mode for development

### Adding a New Provider

1. Create provider directory in `src/provider/`
2. Extend BaseProvider class
3. Implement required methods
4. Add to ProviderFactory
5. Write comprehensive tests
6. Update documentation

### Code Standards

- TypeScript strict mode enabled
- 100% type coverage required
- Comprehensive error handling
- Unit tests for all public APIs
- Documentation for public interfaces

## License

This module is part of the AI Browser Sidebar Extension and follows the project's MIT license.
