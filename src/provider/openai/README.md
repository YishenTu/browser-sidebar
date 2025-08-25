# OpenAI Provider - Response API Implementation

## Overview

This implementation provides comprehensive OpenAI Response API support with reasoning summaries (thinking display), supporting GPT-5 series models with proper streaming and parameter handling.

## Model Support

### GPT-5 Series (Response API)

- `gpt-5` - Latest generation model with reasoning summaries
- `gpt-5-nano` - Efficiency model with reasoning summaries

Both models support the Response API with reasoning effort parameters and automatic reasoning summary generation.

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

## Usage

```typescript
import { OpenAIProvider } from './OpenAIProvider';

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

### Compatibility

This implementation maintains compatibility with:

- Gemini's thinking budget feature
- Standard OpenAI Chat Completions API (for older models)
- The unified provider interface for all AI providers
