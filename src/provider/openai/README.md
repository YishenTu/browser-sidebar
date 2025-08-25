# OpenAI Provider - Response API Implementation

## Overview

This implementation provides comprehensive OpenAI Response API support with reasoning summaries (thinking display), supporting GPT-5 series models with proper streaming and parameter handling. The provider follows a modular architecture for better maintainability and testability.

## Currently Supported Models

Based on the active configuration in `/src/config/models.ts`:

| Model ID     | Display Name | Reasoning Effort | Reasoning Behavior            |
| ------------ | ------------ | ---------------- | ----------------------------- |
| `gpt-5-nano` | GPT 5 Nano   | `minimal`        | Light reasoning by default    |
| `gpt-5-mini` | GPT 5 Mini   | `low`            | Moderate reasoning by default |
| `gpt-5`      | GPT 5        | `medium`         | Balanced reasoning by default |

### Reasoning Effort Levels

- **`minimal`**: Quick, lightweight reasoning for simple queries
- **`low`**: Basic reasoning with some depth
- **`medium`**: Balanced reasoning for most use cases
- **`high`**: Deep, thorough reasoning for complex problems

Both models support the OpenAI Response API with automatic reasoning summary generation when a reasoning effort is configured.

## Response API Features

### Reasoning Summaries

The Response API provides reasoning summaries that show the model's thinking process. These are displayed in a collapsible "thinking wrapper" UI component before the actual response.

### API Response Format

#### Non-Streaming Response

```json
{
  "output": [
    {
      "type": "reasoning",
      "summary": [
        {
          "type": "summary_text",
          "text": "**Thinking process title**\n\nDetailed reasoning explanation..."
        }
      ]
    },
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "The actual response to the user"
        }
      ]
    }
  ]
}
```

#### Streaming Events

The Response API sends events in this specific order:

1. `response.reasoning_summary_text.delta` - Reasoning text chunks
2. `response.reasoning_summary_text.done` - Reasoning complete
3. `response.output_text.delta` - Response text chunks
4. `response.output_text.done` - Response complete
5. `response.completed` - Full response finished

### Parameter Support

| Parameter         | GPT-5 Series | Notes                           |
| ----------------- | ------------ | ------------------------------- |
| Reasoning Effort  | ✓            | Values: minimal/low/medium/high |
| Reasoning Summary | ✓            | Auto-included with effort param |
| Streaming         | ✓            | Full streaming support          |
| Temperature       | ✗            | Not supported in Response API   |

## Implementation Details

### Streaming Handler

The provider correctly handles OpenAI's Response API streaming format:

- Accumulates reasoning summary deltas until complete
- Emits thinking content before message content
- Handles event-based streaming protocol
- Preserves metadata during updates

### Thinking Display Integration

- Reasoning summaries are passed via `delta.thinking` field
- ThinkingWrapper component displays summaries with timer
- Auto-collapses after streaming completes
- Works consistently with Gemini's thinking implementation

## Architecture

### Modular Structure

The OpenAI provider is organized into focused modules:

```
src/provider/openai/
├── OpenAIProvider.ts      # Main provider class (~270 lines)
├── OpenAIClient.ts        # OpenAI SDK client wrapper
├── types.ts               # TypeScript type definitions
├── requestBuilder.ts      # Request construction logic
├── responseParser.ts      # Response parsing and conversion
├── streamProcessor.ts     # Stateful stream processing
├── errorHandler.ts        # Error formatting and handling
├── searchMetadata.ts      # Web search metadata processing
├── index.ts              # Module exports
└── README.md             # This file
```

### Module Responsibilities

#### `OpenAIProvider.ts`

- Main provider class extending BaseProvider
- Orchestrates other modules
- Implements provider interface methods

#### `OpenAIClient.ts`

- Manages OpenAI SDK client instance
- Handles API key configuration
- Provides connection testing

#### `types.ts`

- OpenAI-specific TypeScript types
- Request/response interfaces
- Event type definitions

#### `requestBuilder.ts`

- Builds OpenAI Responses API requests
- Converts messages to input format
- Configures reasoning parameters

#### `responseParser.ts`

- Parses API responses
- Extracts content and metadata
- Normalizes finish reasons
- Converts usage statistics

#### `streamProcessor.ts`

- Stateful stream event processing
- Handles delta accumulation
- Manages search metadata
- Tracks reasoning emission

#### `errorHandler.ts`

- Formats OpenAI errors to provider format
- Categorizes error types
- Extracts retry information
- Provides error wrapping utilities

#### `searchMetadata.ts`

- Formats web search results
- Creates fallback metadata
- Merges multiple search sources

## Usage

```typescript
import { OpenAIProvider } from './openai';

const provider = new OpenAIProvider();

// Initialize with Response API configuration
await provider.initialize({
  type: 'openai',
  name: 'OpenAI',
  enabled: true,
  config: {
    apiKey: 'sk-...',
    model: 'gpt-5-nano',
    reasoningEffort: 'medium', // Enables reasoning summaries
  },
});

// Stream chat with reasoning display
const messages = [
  {
    role: 'user',
    content: 'Explain quantum computing step by step',
  },
];

for await (const chunk of provider.streamChat(messages)) {
  if (chunk.choices[0].delta.thinking) {
    // Display in ThinkingWrapper component
    console.log('Reasoning:', chunk.choices[0].delta.thinking);
  }
  if (chunk.choices[0].delta.content) {
    // Display actual response
    console.log('Response:', chunk.choices[0].delta.content);
  }
}
```

## Technical Notes

### Event Processing

The OpenAI Response API uses a specific event streaming protocol:

- Events have a `type` field indicating the event type
- Reasoning summaries come in delta chunks that must be accumulated
- The complete reasoning is emitted once before message content starts
- Message content also streams as deltas after reasoning is complete

### Integration with UI

The thinking content integrates seamlessly with the ThinkingWrapper component:

1. Reasoning chunks are accumulated during streaming
2. Complete reasoning is emitted via `delta.thinking` field
3. ThinkingWrapper displays with a timer showing thinking duration
4. Wrapper auto-collapses 500ms after streaming ends
5. Users can expand/collapse to review reasoning

### Web Search Integration

The provider includes automatic web search functionality:

- Web search is always enabled via `tools: [{ type: 'web_search_preview' }]`
- Search results are extracted from API annotations
- Fallback metadata is created when citations aren't provided
- Search metadata is included in both streaming and non-streaming responses

### Compatibility

This implementation maintains compatibility with:

- Gemini's thinking budget feature
- Standard OpenAI Chat Completions API (for older models)
- The unified provider interface for all AI providers

## Development

### Adding New Features

1. Identify the appropriate module for the feature
2. Add types to `types.ts` if needed
3. Implement logic in the relevant module
4. Update `OpenAIProvider.ts` to use the new functionality
5. Add tests for the new feature

### Testing

The modular structure enables easy unit testing:

```typescript
// Test individual modules
import { buildRequest } from './requestBuilder';
import { parseResponse } from './responseParser';
import { OpenAIStreamProcessor } from './streamProcessor';

// Test request building
const request = buildRequest(messages, config);

// Test response parsing
const response = parseResponse(apiResponse, 'gpt-5');

// Test stream processing
const processor = new OpenAIStreamProcessor('gpt-5', true);
const chunk = processor.processEvent(streamEvent);
```

### Error Handling

All errors are processed through the error handler module:

```typescript
import { formatError, withErrorHandling } from './errorHandler';

// Wrap async operations
const result = await withErrorHandling(async () => {
  return await apiCall();
});

// Format caught errors
const providerError = formatError(error);
```
