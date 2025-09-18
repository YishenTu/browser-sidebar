# Configuration module

Everything under `src/config/` is pure TypeScript that describes the extension's
built-in models, slash commands, and system prompts.  The data here is consumed
by the settings store, engine manager, and chat UI so it acts as the single
source of truth for capabilities that ship with the extension.

## Files

| File | Purpose |
| ---- | ------- |
| `models.ts` | `DEFAULT_MODELS`, helpers for filtering by provider, and presets for OpenAI-compatible endpoints |
| `slashCommands.ts` | Built-in slash commands (`/summarize`, `/fact-check`, …) with optional one-turn model overrides |
| `systemPrompt.ts` | `getSystemPrompt()` builder that adjusts instructions based on provider type and whether tab content is attached |

## Models catalogue

`models.ts` exports `ModelConfig` definitions for Gemini 2.5, GPT‑5 (first-party
and OpenRouter), and the OpenAI-compatible presets (`deepseek`, `qwen`, `zhipu`,
`kimi`).  Helper utilities include:

* `getDefaultModel()` / `getDefaultModelForProvider()` – pick the default choice
  surfaced in the settings panel.
* `getModelsByProvider(providerId)` and `getModelsByProviderId(providerId)` –
  used by `EngineManagerService` and the settings store to populate drop-downs.
* `OPENAI_COMPAT_PRESETS`, `isBuiltInPreset()`, and `getPresetById()` – keep the
  compat-provider UI and storage layer in sync.

These values are filtered at runtime by `useSettingsStore` based on which API
keys are present (see `@/data/store/settings.ts`).

## Slash commands

`slashCommands.ts` defines a small, localised set of commands.  Each entry
includes `name`, `description`, a Markdown prompt template, and an optional
`model` override (e.g. `/fact-check` uses `gemini-2.5-flash`).  Helpers such as
`getSlashCommandByName()` and `searchSlashCommands()` keep lookups cheap in the
sidebar UI.

Additions here should be paired with translations/UX copy where appropriate.

## System prompt

`systemPrompt.ts` exports a single `getSystemPrompt(providerType?, hasTabContent?)`
function.  It stitches together reusable sections (role description, tab-content
format, citation guidance, web-search instructions) so providers that expose web
search or thinking budgets receive the correct hints.  The UI passes
`hasTabContent` based on whether extracted tabs are attached to the request.

Because this file is pure data + string assembly, it is safe to import from both
background and UI contexts.
