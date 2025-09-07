# Configuration Module

Central configuration and constants for the AI Browser Sidebar Extension.

## Overview

The config module provides application-wide configuration, model definitions, and system prompts. It serves as the single source of truth for AI model capabilities, system behaviors, and application constants.

## Structure

```
config/
├── models.ts           # AI model definitions and capabilities
├── slashCommands.ts    # Slash command templates (+ optional per-command model)
└── systemPrompt.ts     # System prompts for AI interactions
```

## Files

### `models.ts`

Defines available AI models and their capabilities:

- **Model Definitions**: Configuration for OpenAI GPT-5 and Google Gemini 2.5 series
- **Capability Mapping**: Streaming support, thinking display, context windows
- **Cost Tiers**: Model pricing and performance characteristics
- **Default Selection**: Simplified default model selection helpers

### `systemPrompt.ts`

Contains system prompts for AI interactions:

- **Base Prompts**: Core instructions for AI behavior
- **Context Templates**: Templates for including web content
- **Role Definitions**: AI assistant personality and guidelines
- **Safety Instructions**: Content filtering and safety boundaries

### `slashCommands.ts`

Defines built-in slash commands used in the chat input. Each command includes a
name, description, prompt template, and an optional model override used for that
single turn.

- **Command Shape**:

```ts
export interface SlashCommand {
  name: string; // command id without the leading '/'
  description: string; // brief help text
  prompt: string; // prompt template inserted when used
  model?: string; // optional: override selected model for this turn
}
```

- **Examples**: `summarize`, `explain`, `analyze`, `comment`, `fact-check` (uses
  `gemini-2.5-flash` by default via the `model` field).

## Usage

```typescript
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@config/models';
import { getSystemPrompt } from '@config/systemPrompt';
import { SLASH_COMMANDS, getSlashCommandByName } from '@config/slashCommands';

// Get available models for a provider
const openaiModels = AVAILABLE_MODELS.openai;

// Get system prompt with context
const prompt = getSystemPrompt({ includeContext: true });

// Get a slash command
const summarize = getSlashCommandByName('summarize');
```

## Default Model Selection

Model defaults were simplified. Prefer the helpers instead of hardcoding IDs:

```ts
import { getDefaultModel, getDefaultModelForProvider } from '@config/models';

// Global default (first available in the list)
const modelId = getDefaultModel();

// Provider-specific default
const geminiDefault = getDefaultModelForProvider('gemini');
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

## OpenAI-Compatible Presets

Built-in presets are exposed for common OpenAI-compatible providers and helpers to
work with them:

```ts
import {
  OPENAI_COMPAT_PRESETS,
  isOpenAICompatProvider,
  getModelsByProviderId,
} from '@config/models';

const isCompat = isOpenAICompatProvider('kimi'); // true
const kimiModels = getModelsByProviderId('kimi');
```

## Adding New Models

To add a new AI model:

1. Update model definitions in `models.ts`
2. Add provider-specific configuration
3. Update capability mappings
4. Test with existing prompts

## Adding or Customizing Slash Commands

1. Edit `slashCommands.ts` and add a new item to `SLASH_COMMANDS`.
2. Optionally set `model` to force a one-off model for that command.
3. Keep commands concise; the hook expands them to full prompts at send time.

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
