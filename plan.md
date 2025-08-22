# Wiring Plan: Stage 2 (Chat UI) + Stage 4 (AI Providers)

Goal: deliver a functional chatbot by connecting the existing Chat UI to real AI providers, restricted to two models only:

- OpenAI: `gpt-5-nano`
- Google Gemini: `gemini-2.5-flash-lite`

This plan aligns settings, providers, UI, and streaming to produce end-to-end chat responses with BYOK.

## Summary of Current Gaps

- Provider selection: `useAIChat` reads `settings.activeProvider` (missing) and should use `settings.ai.defaultProvider`.
- API keys: Gemini key should come from `settings.apiKeys.google` (not `gemini`).
- Models in UI: various legacy models appear (GPT-4, Claude, etc.). Must restrict to the 2 supported models.
- Streaming state: `useAIChat.isStreaming()` relies on `activeMessageId` but the hook never sets it.
- Default provider configs: `useAIChat` uses outdated defaults (`gpt-4o`, `gemini-2.0-...`). Must switch to our two models.

## Deliverables

- Functional chat end-to-end with streaming and cancel.
- Model selection limited to `gpt-5-nano` and `gemini-2.5-flash-lite` across UI and settings.
- Provider switching works; proper error surfacing on misconfiguration or missing keys.
- Documentation updated to reflect the two-model scope.

## Phase 1 — Align Settings + Provider Initialization

- Replace `settings.activeProvider` usage with `settings.ai.defaultProvider` in `useAIChat`.
- Map API key fields:
  - OpenAI → `settings.apiKeys.openai`
  - Gemini → `settings.apiKeys.google`
- Initialize providers using the two models only:
  - OpenAI config: `{ model: 'gpt-5-nano', temperature, reasoningEffort, ... }`
  - Gemini config: `{ model: 'gemini-2.5-flash-lite', temperature, thinkingMode, showThoughts, ... }`
- Remove calls to non-existent `settingsStore.updateActiveProvider`; instead call `updateAISettings({ defaultProvider })`.
- Acceptance: `useAIChat({ autoInitialize: true })` registers the available provider(s) and sets the active provider from `settings.ai.defaultProvider`.

## Phase 2 — Restrict Models in UI

- Update `ModelSelector` defaults to only display: `['GPT-5 Nano', 'Gemini 2.5 Flash Lite']`.
- Update `ProviderSettings` to expose only these two models per provider, validating max tokens accordingly.
- Update `settings` defaults:
  - `DEFAULT_AVAILABLE_MODELS` contains only:
    - `{ id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', available: true }`
    - `{ id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google', available: true }`
  - `selectedModel` default to `'gpt-5-nano'` (or sync with `ai.defaultProvider`).
- Acceptance: Model dropdowns show exactly two options; switching selections maps to the correct provider + model IDs.

## Phase 3 — Chat Hook Wiring + Streaming

- In `useAIChat.sendMessage`:
  - When streaming, after creating the assistant message, set `chatStore.setActiveMessage(assistantMessage.id)` and clear it on finish/cancel.
  - On cancel: abort controller + `clearActiveMessage()` + `setLoading(false)`.
- Parse stream chunks consistently:
  - OpenAI streaming: keep reading `choices[0].delta.content`.
  - Gemini streaming: use provider implementation once `GeminiProvider.streamChat` yields chunks with `choices[0].delta.content`.
- Acceptance: While streaming, `isStreaming()` returns true and the UI enables Cancel.

## Phase 4 — ChatPanel Integration

- Ensure `ChatPanel` uses `useAIChat({ autoInitialize: true })` once settings are loaded.
- Wire Model selection in header to:
  - Update display value via `ModelSelector`.
  - Map friendly names to provider type + model ID, update `settings.ai.defaultProvider` and (optionally) `selectedModel` via store.
- Acceptance: Sending a prompt yields streaming assistant output; Cancel works; Clear conversation resets state.

## Phase 5 — Error Handling + UX

- Missing key: show clear error from `useAIChat` when provider missing or uninitialized.
- Rate limit/network errors: surface provider-formatted errors in the chat store `error`, render inline in UI.
- Acceptance: With no key, the user sees actionable error guidance; with bad key, see validation failure.

## Phase 6 — Permissions + CSP Validation

- Confirm `manifest.json` contains required host permissions:
  - `https://api.openai.com/*`
  - `https://generativelanguage.googleapis.com/*`
- Ensure CSP `connect-src` includes both endpoints (already present).
- Acceptance: Network calls succeed in Chrome with keys configured.

## Phase 7 — Tests + Verification

- Unit: `useAIChat` provider selection and streaming state transitions.
- Integration: Simulate sending a message and receiving stream chunks; verify MessageList updates.
- E2E (manual):
  - Set OpenAI key → select GPT-5 Nano → send → stream appears.
  - Switch to Gemini 2.5 Flash Lite with key → send → stream appears.
  - Cancel mid-stream works.

## Phase 8 — Docs + Cleanup

- Update docs to reflect:
  - Supported providers: OpenAI + Gemini
  - Supported models: `gpt-5-nano`, `gemini-2.5-flash-lite`
  - Settings: `ai.defaultProvider`; API keys under `openai` and `google`.
- Remove/disable legacy model references in docs and UI examples.

## Acceptance Criteria (Go/No-Go)

- Only two models are selectable anywhere in the UI.
- Chatting with either model streams tokens and completes.
- Cancel and Clear conversation work reliably.
- Errors (missing key, invalid key, rate limits) are clearly surfaced in the UI.
- **A FUNCTIONAL CHATBOT!**

## Implementation Notes

- Keep changes minimal and focused; do not add providers beyond the two models.
- If needed, temporarily stub Gemini streaming until `GeminiProvider.streamChat` emits chunks in the required shape.
- Preference: fix root-cause (settings/provider mapping) rather than patching around missing fields.
