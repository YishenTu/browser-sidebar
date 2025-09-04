# Configuration Module

Central configuration and constants for the AI Browser Sidebar Extension.

## Overview

The config module provides application-wide configuration, model definitions, and system prompts. It serves as the single source of truth for AI model capabilities, system behaviors, and application constants.

## Structure

```
config/
├── models.ts           # AI model definitions and capabilities
└── systemPrompt.ts     # System prompts for AI interactions
```

## Files

### `models.ts`

Defines available AI models and their capabilities:

- **Model Definitions**: Configuration for OpenAI GPT-5 and Google Gemini 2.5 series
- **Capability Mapping**: Streaming support, thinking display, context windows
- **Cost Tiers**: Model pricing and performance characteristics
- **Default Selection**: Application default model preferences

### `systemPrompt.ts`

Contains system prompts for AI interactions:

- **Base Prompts**: Core instructions for AI behavior
- **Context Templates**: Templates for including web content
- **Role Definitions**: AI assistant personality and guidelines
- **Safety Instructions**: Content filtering and safety boundaries

## Usage

```typescript
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@config/models';
import { getSystemPrompt } from '@config/systemPrompt';

// Get available models for a provider
const openaiModels = AVAILABLE_MODELS.openai;

// Get system prompt with context
const prompt = getSystemPrompt({ includeContext: true });
```

## Model Configuration

### OpenAI GPT-5 Series

- `gpt-5-nano`: Fast responses, minimal reasoning
- `gpt-5-mini`: Balanced performance
- `gpt-5`: Advanced reasoning capabilities

### Google Gemini 2.5 Series

- `gemini-2.5-flash-lite`: Cost-effective, no thinking
- `gemini-2.5-flash`: Balanced with dynamic thinking
- `gemini-2.5-pro`: Advanced with automatic reasoning

## System Prompt Strategy

1. **Contextual Awareness**: Adapts based on page content
2. **Safety First**: Built-in content filtering
3. **User Focus**: Prioritizes helpful, accurate responses
4. **Web Integration**: Optimized for web content interaction

## Adding New Models

To add a new AI model:

1. Update model definitions in `models.ts`
2. Add provider-specific configuration
3. Update capability mappings
4. Test with existing prompts

## Configuration Best Practices

- Keep configuration centralized
- Use TypeScript const assertions for type safety
- Document all configuration options
- Validate model capabilities at runtime
- Maintain backwards compatibility

## Environment Variables

The module supports environment-specific configuration:

- Development: Enhanced logging, debug models
- Production: Optimized defaults, stable models
- Testing: Mock configurations

## Dependencies

- No external dependencies
- Pure TypeScript configuration
- Type-safe exports
