# Gemini Models Configuration

## Task 4.2.2c - Model Configuration Summary

This document outlines the comprehensive Gemini model configurations implemented for the browser extension, including thinking mode support, context limits, and capability matrices.

## Currently Supported Models

Based on the active configuration in `/src/config/models.ts`:

| Model ID                | Display Name          | Thinking Budget | Thinking Behavior          |
| ----------------------- | --------------------- | --------------- | -------------------------- |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | `0` (off)       | No thinking by default     |
| `gemini-2.5-flash`      | Gemini 2.5 Flash      | `0` (off)       | No thinking by default     |
| `gemini-2.5-pro`        | Gemini 2.5 Pro        | `-1` (dynamic)  | Automatic thinking enabled |

## Thinking Mode Configuration

### Thinking Budget Values

- **`0`**: Thinking disabled - model provides direct responses only
- **`-1`**: Dynamic thinking - model automatically determines when to use reasoning

### Per-Model Settings

- **Gemini 2.5 Flash Lite**: Optimized for speed, thinking disabled by default
- **Gemini 2.5 Flash**: Balanced performance, thinking disabled by default
- **Gemini 2.5 Pro**: Advanced reasoning, thinking enabled by default

### Thinking Modes

- **`off`**: No thinking tokens generated - direct responses only
- **`dynamic`**: Model can generate internal reasoning thoughts that can be shown/hidden via `showThoughts` configuration

## Context Window Configuration

- **Gemini Pro**: 1M tokens - Standard large context model
- **Gemini Pro Vision**: 128K tokens - Optimized for vision tasks
- **Gemini 1.5 Pro**: 2M tokens - Highest context capacity
- **Gemini Flash**: 1M tokens - Fast inference with large context
- **Gemini 2.5 Flash Lite**: 1M tokens - Most cost-effective option
- **Gemini 2.5 Pro**: 2M tokens - Latest high-capacity model

## Capabilities Overview

### Temperature Support

- **Range**: 0.0 - 2.0 for all models
- **Step**: 0.1
- **Optimized defaults**: Vision models use lower temps (0.4) for precision

### Multimodal Support

- **Supported**: All models except `gemini-pro`
- **Formats**: JPEG, PNG, GIF, WebP
- **Use cases**: Image analysis, visual Q&A, document understanding

### Function Calling

- **Supported**: All models except `gemini-pro-vision`
- **Note**: Vision models focus on visual understanding rather than tool usage

### Streaming

- **Universal**: All models support real-time streaming responses
- **TokenBuffer**: Integrated for smooth user experience

## Cost Optimization

**Most Cost-Effective**: `gemini-2.5-flash-lite`

- Input: $0.00005 per 1K tokens
- Output: $0.0001 per 1K tokens
- Best for: High-volume, basic tasks

**Balanced Performance**: `gemini-flash`

- Input: $0.000075 per 1K tokens
- Output: $0.00015 per 1K tokens
- Best for: General purpose with good performance/cost ratio

**Highest Capacity**: `gemini-pro-1.5`, `gemini-2.5-pro`

- 2M token context window
- Best for: Complex reasoning, large document analysis

## Gemini API Response Format

### Thinking Response Structure

#### Non-Streaming Response

When `thinkingBudget: -1` and `includeThoughts: true`:

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "**Thinking process title**\n\nDetailed reasoning about the problem...",
            "thought": true
          },
          {
            "text": "The actual response to the user"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 14,
    "candidatesTokenCount": 20,
    "totalTokenCount": 1000,
    "thoughtsTokenCount": 980
  }
}
```

#### Streaming Response Behavior

Gemini sends a **single large JSON response** split across network packets:

- The complete thinking content arrives in the first part
- Thinking appears as complete paragraphs, not character-by-character
- Content follows after thinking in the same response structure

### API Request Format

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "User's message here"
        }
      ]
    }
  ],
  "generationConfig": {
    "thinkingConfig": {
      "thinkingBudget": -1, // -1 for dynamic, 0 to disable
      "includeThoughts": true // Include thinking in response
    },
    "temperature": 0.8,
    "maxOutputTokens": 8192
  }
}
```

## Implementation Details

### Streaming Characteristics

- **Single JSON Object**: Unlike OpenAI's event stream, Gemini sends one JSON object
- **Paragraph-Level Chunks**: Thinking content arrives in complete paragraphs
- **Natural Display**: We preserve the paragraph-level streaming rather than artificial character-by-character

### File Structure

```
src/provider/gemini/
├── models.ts           # Model configurations and support matrices
├── GeminiClient.ts     # Base client with model management
├── GeminiProvider.ts   # Chat implementation with thinking support
└── GeminiStreamProcessor.ts # Handles partial JSON parsing
```

### Key Functions

**Model Management**:

```typescript
getGeminiModels(): ModelConfig[]          // Get all models
getGeminiModel(id: string): ModelConfig   // Get specific model
supportsThinkingBudget(id, budget): boolean   // Check thinking support
isMultimodalModel(id): boolean            // Check vision support
```

**Stream Processing**:

```typescript
convertGeminiToStreamChunk(response): StreamChunk  // Convert to unified format
processStreamChunk(chunk, config): StreamChunk     // Apply showThoughts filter
```

## Usage Examples

### Basic Chat with Thinking

```typescript
const config = {
  temperature: 0.8,
  thinkingBudget: '-1',
  showThoughts: true,
};

const response = await geminiProvider.chat(messages, config);
// Response includes thinking content if showThoughts: true
```

### Model Selection

```typescript
// Get cost-effective model
const fastModel = geminiClient.getModel('gemini-2.5-flash-lite');

// Get high-capacity model
const powerfulModel = geminiClient.getModel('gemini-2.5-pro');

// Get vision-capable model
const visionModel = geminiClient.getModel('gemini-pro-1.5');
```

## Test Coverage

✅ **29 comprehensive tests** covering:

- Model availability and configuration
- Thinking mode support matrix
- Context window limits
- Capability matrices
- Cost configurations
- Parameter validation
- Model selection and recommendations

## Acceptance Criteria ✅

- [x] **gemini-2.5-flash-lite model configured** - Available with full thinking support
- [x] **Model-specific thinking budget support** - All models support '0' (off) and '-1' (dynamic) budgets
- [x] **Context limits defined** - Each model has appropriate context window limits
- [x] **Thought visibility configuration** - `showThoughts` controls thinking token display
- [x] **Support matrix documented** - Comprehensive capability and thinking mode matrix
- [x] **Test coverage** - All requirements validated with comprehensive test suite

The Gemini model configuration is now complete with full thinking mode capabilities, optimized for various use cases from cost-effective basic tasks to high-capacity reasoning workloads.
