# Configuration Module

Central configuration and constants for the AI Browser Sidebar.

## Overview

This module defines the model catalog and helpers, the system prompt, and built‑in slash commands. It is the single source of truth for what models are available and how commands map to prompts.

## Structure

```
config/
├─ models.ts             # Model list + helpers (incl. OpenAI‑Compat presets)
├─ slashCommands.ts      # Built-in slash commands (optional per‑command model)
└─ systemPrompt.ts       # System prompt helpers
```

## models.ts

Key exports and helpers:

- `DEFAULT_MODELS` — Array of `ModelConfig` entries (OpenAI, Gemini, OpenRouter, compat)
- `getDefaultModel()` — First model id from the catalog
- `getDefaultModelForProvider(providerId)` — First model id for a provider
- `getModelsByProvider(providerType)` — Filter by core provider type
- `getModelsByProviderId(providerId)` — Filter by specific provider id (incl. compat)
- `getModelById(id)` / `modelExists(id)` — Lookup helpers
- `isOpenAICompatProvider(providerId)` — Test for compat providers
- `OPENAI_COMPAT_PRESETS` — Built‑in OpenAI‑Compat endpoints (deepseek, qwen, zhipu, kimi, base url for these providers are Chinese version, change to global if needed)

Models currently include the GPT‑5 and Gemini 2.5 series used by this app, plus OpenRouter entries and placeholders for common OpenAI‑compat providers.

## systemPrompt.ts

Exports helpers to assemble the system prompt used by providers. The prompt is designed for web‑context assistance and can be extended as needed.

## slashCommands.ts

Defines command objects with an optional one‑turn model override. Examples include `summarize`, `explain`, `analyze`, `comment`, `fact-check` (uses `gemini-2.5-flash`), and `rephrase`.

```ts
export interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
  model?: string; // optional one‑turn override
}
```

## Typical Usage

```ts
import {
  DEFAULT_MODELS,
  getDefaultModel,
  getDefaultModelForProvider,
  getModelsByProvider,
  getModelsByProviderId,
} from '@config/models';
import { getSlashCommandByName, SLASH_COMMANDS } from '@config/slashCommands';
import { getSystemPrompt } from '@config/systemPrompt';

const openai = getModelsByProvider('openai');
const first = getDefaultModel();
const geminiDefault = getDefaultModelForProvider('gemini');

const summarize = getSlashCommandByName('summarize');
const sysPrompt = getSystemPrompt({ includeContext: true });
```

Extraction defaults are now user-configurable in Settings
("Extraction Defaults by Domain"). The content orchestrator reads the saved
rules from chrome.storage; no additional config file is needed.

## OpenAI‑Compatible Providers

```ts
import {
  OPENAI_COMPAT_PRESETS,
  isOpenAICompatProvider,
  getModelsByProviderId,
} from '@config/models';

const isCompat = isOpenAICompatProvider('kimi'); // true
const kimiModels = getModelsByProviderId('kimi');
```

## Adding Models or Commands

1. Add a `ModelConfig` entry in `models.ts` (and optionally an OpenAI‑Compat preset).
2. Add or edit command entries in `slashCommands.ts`.

## Notes

- Model availability surfaced in the UI is gated by saved API keys and compat providers at runtime (see `data/store/settings.ts`).
- All files are pure TypeScript with no external runtime deps.
