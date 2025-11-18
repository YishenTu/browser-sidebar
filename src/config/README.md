# Configuration Module

Centralized configuration for models, prompts, and slash commands. It is the single source of truth for what providers/models appear in the UI.

## Files

```
config/
├─ models.ts        # Model catalog, compat presets, helpers
├─ slashCommands.ts # Built-in slash commands (+ per-command model overrides)
└─ systemPrompt.ts  # System prompt builders
```

## models.ts

Exports:

- `DEFAULT_MODELS` — Canonical model list (OpenAI, Gemini, Grok, OpenRouter, compat placeholders) with provider metadata and capability flags (`supportsReasoning`, `supportsThinking`, `supportsVision`).
- `OPENAI_COMPAT_PRESETS` / `OPENAI_COMPAT_PROVIDER_IDS` — Built-in compat endpoints (deepseek, qwen, zhipu, kimi, etc.).
- `getDefaultModel()` / `getDefaultModelForProvider(providerId)` — Default model selectors.
- `getModelsByProvider(providerType)` / `getModelsByProviderId(providerId)` — Filter helpers consumed by Engine Manager + settings store.
- `getModelById(id)` / `modelExists(id)` — Lookup & validation.
- `getPresetById(id)` / `isBuiltInPreset(id)` — Resolve compat preset metadata.
- `getProviderTypeForModelId(id)` — Maps model → provider type (`openai`, `gemini`, `grok`, `openrouter`, `openai_compat`).
- `supportsReasoning(modelId)` / `supportsThinking(modelId)` — Capability helpers used for UI badges.

## slashCommands.ts

Defines the available slash commands and optional per-command model overrides. Current commands: `summarize`, `explain`, `analyze`, `comment`, `fact-check` (Gemini override), `rephrase`.

```ts
export interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
  model?: string; // optional one-turn override
}
```

Helper exports: `SLASH_COMMANDS`, `getSlashCommandByName`, `searchSlashCommands`.

## systemPrompt.ts

Utility to assemble the system prompt shared by all providers. Accepts flags (`includeContext`, etc.) so services can tailor the prompt per call.

## Notes

- Engine Manager relies on `getModelsByProviderId` and compat presets to bootstrap providers from saved keys.
- Slash commands + prompts are pure TypeScript modules; no runtime dependencies.
- Keep model additions here so the UI and background stay in sync.
