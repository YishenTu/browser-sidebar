# OpenRouter Integration Implementation Plan (Revised)

Last updated: Sep 1, 2025

## Overview

Integrate OpenRouter as a third AI provider alongside OpenAI and Gemini. OpenRouter exposes many models behind an OpenAI‑compatible API. We will use the OpenAI SDK with a custom `baseURL` for streaming chat completions, while keeping our existing OpenAI provider on the Responses API.

## Key Decisions

1. Streaming only: keep async‑iterable streaming across providers.
2. Web search on by default: append `:online` at request time (do not mutate stored model id).
3. SDK first: prefer OpenAI SDK for OpenRouter (parsed chunks, less SSE plumbing); provide a minimal fetch fallback only if needed.
4. Capability‑aware requests: branch reasoning and caching by model family (OpenAI vs Anthropic vs others).

## Provider Type & Defaults

- Add `openrouter` to `ProviderType`.
- Default model: `anthropic/claude-3.7-sonnet` (requested as `anthropic/claude-3.7-sonnet:online` at send time).

## Files & Structure

```
src/provider/openrouter/
  OpenRouterClient.ts       // SDK init (baseURL, headers)
  OpenRouterProvider.ts     // extends BaseProvider, streaming only
  requestBuilder.ts         // request shaping (reasoning, web, caching, usage)
  streamProcessor.ts        // map SDK chunks → StreamChunk
  responseParser.ts         // non‑stream parse if needed
  errorHandler.ts           // HTTP → ProviderError mapping
  types.ts                  // minimal OpenRouter types we consume
  index.ts                  // barrel export
```

## Cross‑Cutting Changes

### Types & Validation

- `src/types/providers.ts`
  - Extend `ProviderType` to `'openai' | 'gemini' | 'openrouter'`.
  - Add `OpenRouterConfig`:
    - `apiKey: string; model: string;`
    - `reasoning?: { effort?: 'low'|'medium'|'high'; maxTokens?: number; exclude?: boolean }`
    - `headers?: { referer?: string; title?: string }` (optional attribution)
  - Add `validateOpenRouterConfig()` and wire into `validateProviderConfig()` switch.
  - Ensure `AIProvider.type` union and `ResponseMetadata.provider` include `'openrouter'`.

### Models & Discovery

- `src/config/models.ts`
  - Extend `ModelConfig.provider` union to include `'openrouter'`.
  - Add curated OpenRouter models (initial set only):
    - `anthropic/claude-3.7-sonnet`
    - `openai/gpt-4o`
    - `deepseek/deepseek-r1`
    - `perplexity/sonar-pro`
  - Update helpers: `getModelsByProvider('openrouter')`, `getProviderTypeForModelId()` to return `'openrouter'`.

### Settings & UI

- `src/types/settings.ts`: add `openrouter` to `AIProvider` union; extend `APIKeyReferences` with `openrouter: string | null`.
- `src/data/store/settings.ts`:
  - Accept/persist `apiKeys.openrouter` (encrypted storage layer remains unchanged).
  - `isValidProvider()` and `getProviderTypeFromModel()` to support `'openrouter'`.
  - Don’t alter existing message/stream settings.
- `src/sidebar/components/ModelSelector.tsx`:
  - Add an “OpenRouter” group using `getModelsByProvider('openrouter')`.
  - When selected model provider is `openrouter` and no key exists, render “Add API KEY”.

### Factory & Registry

- `src/provider/ProviderFactory.ts`:
  - Add `'openrouter'` to `SUPPORTED_PROVIDERS` and switch case → `new OpenRouterProvider()`.
  - Add `createOpenRouterProvider(config: OpenRouterConfig)` helper.
- `src/provider/ProviderRegistry.ts`:
  - Add `'openrouter'` to valid types.
  - Remove `chat` from `requiredMethods` (we are streaming‑only across providers). This unblocks OpenAI/OpenRouter which intentionally do not implement a sync `chat`.

### Manifest & CSP

- `manifest.json`:
  - Add `"https://openrouter.ai/*"` to `host_permissions`.
  - Add `https://openrouter.ai` to `content_security_policy.extension_pages.connect-src`.

## OpenRouter Provider Design

### Client (`OpenRouterClient.ts`)

- Use OpenAI SDK:
  - `baseURL: 'https://openrouter.ai/api/v1'`
  - `apiKey: settings.apiKeys.openrouter`
  - `defaultHeaders`: include attribution when available:
    - `HTTP-Referer: 'chrome-extension://' + chrome.runtime.id`
    - `X-Title: 'AI Browser Sidebar'`
  - `dangerouslyAllowBrowser: true`
  - Expose `testConnection()` by calling `/models` via `fetch` or low‑cost `chat.completions.create` with a noop prompt, caught and mapped.

### Request Builder (`requestBuilder.ts`)

- Input: `ProviderChatMessage[]`, `OpenRouterConfig`, optional chat config (`signal`, `systemPrompt`).
- Build Chat Completions request:
  - `model`: append `:online` unless already present.
  - `messages`: convert to OpenAI Chat format; put system prompt into a leading `system` message if provided.
  - `stream: true` always.
  - (Removed) usage inclusion: do not set `usage: { include: true }` in requests.
  - Reasoning:
    - If model slug starts with `anthropic/`: `reasoning: { max_tokens: config.reasoning?.maxTokens ?? 8000 }` (ensure budget leaves output tokens).
    - If starts with `openai/` (or other models that support effort): `reasoning: { effort: config.reasoning?.effort ?? 'medium', ...(config.reasoning?.exclude ? { exclude: true } : {}) }`.
  - Prompt caching (Anthropic/Gemini via OpenRouter): insert `cache_control: { type: 'ephemeral' }` only for large text parts (system/user) using a simple threshold (e.g., > 2k chars).

### Stream Processing (`streamProcessor.ts`)

- Consume SDK async iterable of `ChatCompletionChunk` (no manual SSE parsing in the common path).
- Map to our `StreamChunk`:
  - Content: `chunk.choices[0]?.delta?.content` → `choices[0].delta.content`.
  - Thinking: `chunk.choices[0]?.delta?.reasoning` → `choices[0].delta.thinking`.
  - Finish: `choices[0].finish_reason` → normalized `finishReason`.
  - Usage tail: when `chunk.usage` present, convert to `Usage` and attach.
  - Web search: when `chunk.choices[0].delta?.annotations` present, extract `type: 'url_citation'` items to `metadata.searchResults` with `{ title, url, snippet? }`.
- Fallback fetch path (rare): parse SSE lines, ignore comment frames (`: OPENROUTER PROCESSING`), stop on `[DONE]`.

### Response Parser (`responseParser.ts`)

- Non‑stream convenience only (not used by default). Keep parity with streaming mapping.

### Error Handling (`errorHandler.ts`)

- Map HTTP codes to `ProviderError`:
  - 401/403 → `authentication` (bad key or missing headers)
  - 402/429 → `rate_limit` (credits/plan); honor `Retry-After`
  - 404 → `validation` (bad model slug, including `:online`)
  - 5xx/Network/Abort → `network`
- Include `details.statusCode`, and original headers if available.

## Web Search Behavior

- Always request `:online` at send time; don’t persist the suffix in settings.
- Parse OpenRouter’s `message.annotations[].type === 'url_citation'` to populate `metadata.searchResults` (domain/title/url/snippet).

## Prompt Caching

- Anthropic/Gemini via OpenRouter: support `cache_control` breakpoints on large parts only.
- Do not include `usage` in requests. If providers emit usage/cache tokens implicitly, surface `cache_discount` in `ProviderResponse.metadata.cacheDiscount` when present.

## Performance Notes

- SDK streaming avoids manual SSE parsing and reduces GC pressure.
- Don’t buffer entire stream chunks; forward deltas as they arrive.
- Abort promptly on cancel; treat partials as “interrupted” (current UI already supports this).

## Implementation Order

1. Phase 0 — Permissions & Types
   - `manifest.json` connect/host permissions for OpenRouter.
   - `src/types/providers.ts`: ProviderType, OpenRouterConfig, validation.
   - `src/config/models.ts`: provider union, curated models, helpers.
   - `src/types/settings.ts` and `src/data/store/settings.ts`: add `openrouter` key and provider mapping.
2. Phase 1 — UI & Storage
   - `ModelSelector` third group; show “Add API KEY” for OpenRouter.
   - Settings panel field for OpenRouter key (BYOK), persisted encrypted.
3. Phase 2 — Provider
   - `OpenRouterClient`, `OpenRouterProvider`, `requestBuilder`, `streamProcessor`, `errorHandler`.
4. Phase 3 — Factory & Registry
   - `ProviderFactory` support; `ProviderRegistry` valid types and required methods fix (remove `chat`).
5. Phase 4 — Tests & QA
   - Unit + integration; manual smoke with Sonnet and GPT‑4o via OpenRouter.

## Testing Strategy

### Unit

- Request builder: `:online` suffixing, reasoning branching (effort vs max_tokens), `usage.include`, selective `cache_control` insertion.
- Stream processor: content/think deltas, finish reasons, annotations→metadata, tail usage.
- Error handler: 401/402/403/404/429/5xx mapping; `Retry-After` honored.

### Integration (jsdom)

- Mock SDK async iterable with: thinking→content→finish; include annotations on message; include tail usage.
- Verify `useStreamHandler` updates: thinking foldout, content accumulation, `metadata.searchResults`, and partial handling on abort.
- Provider switching: OpenAI (Responses API) preserves `previousResponseId`; OpenRouter ignores it gracefully.

### Manual

- Smoke with `anthropic/claude-3.7-sonnet:online` and `openai/gpt-4o:online`.
- Validate CSP/permissions; cancel mid‑stream; error messages on invalid key or slug.

## Risk Mitigation

- API compatibility gaps: SDK first; fetch fallback guarded by robust SSE parser.
- Model variance: capability flags derived from slug prefix; conservative defaults.
- Rate limits/credits: show actionable messages and retry hints.

## Success Criteria

- [ ] OpenRouter appears in provider list and model selector.
- [ ] OpenRouter API key can be saved, validated, and used.
- [ ] Streaming works with both Anthropic and OpenAI models via OpenRouter.
- [ ] Web citations appear automatically in message metadata and UI.
- [ ] Reasoning tokens stream into the “thinking” UI for supported models.
- [ ] Cache discounts/usage surface in metadata when available.
- [ ] Clear, actionable error messages (auth, rate limit, bad model, network).
