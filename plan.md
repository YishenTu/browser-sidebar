**OpenAI‑Compatible Providers: End‑to‑End Plan**

- Goal: Add first‑class “OpenAI‑compatible” backend support with secure, persistent key + base URL management, quick‑add presets (DeepSeek, Qwen, Zhipu, Kimi), and UI that only shows models for providers that have stored keys. Keep the provider subsystem consistent with existing OpenAI/Gemini/OpenRouter patterns.

---

**Acceptance Criteria**

- Backend
  - New provider type handles OpenAI‑compatible Chat Completions streaming via custom `baseURL` and API key.
  - Works with at least one configured preset (e.g., DeepSeek) and one user‑defined custom provider.
  - Error mapping and cancellation behave like existing providers.
- Storage & Settings
  - Users can add: display name, base URL, API key. For non‑built‑ins, also model ID and display name.
  - Persist using current API‑key strategy (leveraging the existing encrypted key storage service in `src/data/storage/keys/*`).
  - Built‑in presets are selectable without retyping URLs.
- Models & UI
  - Built‑in provider model lists live in `src/config/models.ts` (you’ll add them in a separate PR per item 3).
  - ModelSelector only displays providers with stored keys; when none exist, it shows “Add API key”.
  - When multiple openai‑compatible providers exist, they appear as separate groups with their own models.
- Tests
  - Unit tests for provider request/stream parsing, settings save/validation, and ModelSelector filtering.

---

**High‑Level Design**

- Provider: Add `OpenAICompatibleProvider` using the OpenAI SDK’s `chat.completions` with a configurable `baseURL`. Reuse OpenRouter’s stream processing where possible.
- Storage: Use the existing encrypted key storage service to store key + endpoint + friendly name (+ optional default model for non‑built‑ins). Tag entries as `openai_compat` to distinguish from generic `custom`.
- Settings UI: New “OpenAI‑Compatible” section in Settings to add presets and custom providers. Verifies connectivity with a minimal `/models` or `/chat/completions` call against the specified `baseURL`.
- Model gating: A small selector utility determines which provider groups to show based on stored keys and presets.
- Provider activation: Extend ProviderFactory/Manager to initialize `openai_compat` when the selected model belongs to a compatible provider.

---

**Planned Changes By Layer**

- Types & Config
  - `src/types/providers.ts`
    - Extend `ProviderType` to include `'openai_compat'`.
    - Add `OpenAICompatibleConfig`:
      - `apiKey: string` (no `'sk-'` prefix requirement).
      - `model: string` (required; can be user‑defined for non‑built‑ins).
      - `baseURL: string` (required).
      - Optional `headers?: Record<string,string>`.
    - Add `validateOpenAICompatibleConfig(config)` akin to existing validators.
  - `src/types/apiKeys.ts`
    - Extend `APIKeyConfiguration` with:
      - `defaultModel?: { id: string; name: string }` (used for non‑built‑in entries).
      - Keep `endpoint.baseUrl` as the source of truth for `baseURL`.
    - No breaking changes to stored shape; this is additive.
  - `src/config/models.ts`
    - You will add built‑ins’ model entries (DeepSeek, Qwen, Zhipu, Kimi). Set `provider` to a stable ID per provider (e.g., `'deepseek'`, `'qwen'`, `'zhipu'`, `'kimi'`).
    - Add helper exports:
      - `isOpenAICompatProvider(providerId: string): boolean` (checks against above IDs + `'openai_compat'`).
      - `getModelsByProviderId(providerId: string)` (works for dynamic/custom provider IDs).

- Provider Backend
  - New folder: `src/provider/openai-compat/`
    - `OpenAICompatClient.ts`: small wrapper around `new OpenAI({ apiKey, baseURL, defaultHeaders, dangerouslyAllowBrowser: true })`.
    - `requestBuilder.ts`: maps `ProviderChatMessage[]` → `chat.completions.create` payload; include `systemPrompt` if present.
    - `streamProcessor.ts`: reuse OpenRouter’s `processStreamChunk` for delta mapping; provide SSE fallback `processSSELine` for raw fetch.
    - `errorHandler.ts`: mirror OpenRouter mapping but change `provider: 'openai_compat'` and messages.
    - `OpenAICompatibleProvider.ts`: extends `BaseProvider`.
      - Capabilities: `streaming: true`, `reasoning: true` (pass through if model supports), `multimodal: false` (unless we later add vision), etc.
      - `initialize(config)`: validate, create client with `baseURL`, store config.
      - `streamChat(...)`: call SDK `chat.completions.create({ stream: true })`; yield mapped chunks.
      - `formatError`, `getModels()` (filtered by the provider id set at init), `getDefaultModelId()`.
  - Integration
    - `src/provider/ProviderFactory.ts`: add `'openai_compat'` support in `SUPPORTED_PROVIDERS` and switch statement; add `createOpenAICompatibleProvider` helper.
    - `src/provider/ProviderRegistry.ts`: no structural change (still one active provider at a time).

- Storage & Key Management
  - Conventions (no schema break):
    - Store openai‑compatible entries via `addAPIKey({ provider, key, name, configuration })`:
      - Use `provider: 'custom'` to avoid conflating with real OpenAI keys.
      - Add `configuration.endpoint.baseUrl = <user or preset URL>`.
      - Add `configuration.defaultModel = { id, name }` for non‑built‑ins or user‑defined.
      - Add `metadata.tags` containing `['openai_compat', <providerId>]` where `providerId` is `'deepseek' | 'qwen' | 'zhipu' | 'kimi' | 'custom'`.
    - Use `listAPIKeys({})` and filter by tag to discover available compat providers.
  - Utilities
    - New utility `src/data/storage/keys/compat.ts`:
      - `listOpenAICompatProviders(): Promise<Array<{ id: string; name: string; baseURL: string; model?: { id: string; name: string } }>>`.
      - `getCompatProviderById(id)` and `hasCompatProviders()`.

- Settings UI
  - `src/sidebar/components/Settings/Settings.tsx`
    - Add a new section “OpenAI‑Compatible Providers”.
    - Presets: DeepSeek, Qwen, Zhipu, Kimi.
      - Each preset shows: `API Key` input and a `Model` dropdown populated from `src/config/models.ts` for that provider (you’ll add the lists).
      - Pre‑fill `baseURL` constant; allow override.
      - “Verify & Save” → calls key storage `addAPIKey()` using the above conventions, then shows saved status.
    - Custom provider
      - Inputs: `Display Name`, `Base URL`, `API Key`, `Model ID`, `Model Name`.
      - “Verify & Save” → same storage flow, with `tags: ['openai_compat','custom']`.
    - Connectivity check
      - Attempt `GET <baseURL>/models` with `Authorization: Bearer <key>`; fallback to a tiny `POST <baseURL>/chat/completions` with `stream: false, messages:[{role:'user',content:'ping'}]`.
    - Do not change the existing OpenAI/Gemini/OpenRouter key sections.

- ModelSelector Refactor
  - `src/sidebar/components/ModelSelector.tsx`
    - Replace static grouping with dynamic groups:
      - Core providers: show groups only if a key reference exists (`settings.apiKeys.openai/google/openrouter`).
      - OpenAI‑compatible: for each compat provider found via `listOpenAICompatProviders()`, add a group labeled by the provider’s display name.
        - Options list is `getModelsByProviderId(providerId)` for built‑ins; for custom entries, use the saved `defaultModel` as a single‑option list.
    - Trigger behavior remains: when no keys exist at all (core or compat), show “Add API key”. Clicking will open Settings.
    - When selected model belongs to a provider without a stored key, show “Add API key” and open Settings on click.

- Provider Manager
  - `src/sidebar/hooks/ai/useProviderManager.ts`
    - Extend initialization to detect when the selected model’s provider is an openai‑compatible provider (`isOpenAICompatProvider(...)`).
    - Resolve the corresponding stored entry (by tag/providerId) and build a `ProviderConfig`:
      - `{ type: 'openai_compat', config: { apiKey, model, baseURL } }`.
    - Register and set active provider accordingly. Keep current behavior for OpenAI/Gemini/OpenRouter unchanged.

---

**Presets & Constants**

- New file `src/provider/openai-compat/presets.ts` with entries for DeepSeek, Qwen, Zhipu, Kimi:
  - `{ id, name, baseURL, headerHints }`.
  - Used by Settings for quick‑add. Allow user override of `baseURL`.

---

**Validation & Error Handling**

- Permit any non‑empty API key string for compat providers (no `'sk-'` assumption).
- Validate `baseURL` as a proper URL.
- Standardize errors via `formatError()` mapping (network, auth, rate_limit, validation).
- Respect `AbortSignal` for cancel.

---

**Testing Plan**

- Unit
  - Provider request builder → builds correct Chat Completions payload.
  - Stream processor → maps `choices[].delta` to `StreamChunk` with reasoning fields.
  - Settings “Verify & Save” → saves to key storage with correct tags/config; mock fetch.
  - ModelSelector → hides providers with no keys; shows compat groups only when keys exist.
- Integration
  - ProviderManager initializes `openai_compat` when selected model is compat and a matching key exists.
  - End‑to‑end stream happy‑path with mocked SDK/Fetch.
- Locations
  - `tests/unit/provider/openai-compat/*`
  - `tests/unit/sidebar/ModelSelector.openaiCompat.test.tsx`
  - `tests/integration/providerManager.openaiCompat.test.ts`

---

**Migration & Backward Compatibility**

- No breaking changes to existing OpenAI/Gemini/OpenRouter keys or flows.
- Compatibility mode can ship without adding built‑in models; ModelSelector will still show custom provider entries that include `defaultModel`.
- If any compat key was previously saved in `settings.apiKeys` (unlikely), add a one‑time migration to move it into the encrypted key storage with `tags: ['openai_compat']`.

---

**Security Notes**

- Use the existing encrypted key storage service (`src/data/storage/keys/*`), which currently includes an encryption stub—no UX impact. Do not store raw keys in `settings`.
- Never allow overriding `Authorization` header in custom headers from the UI.

---

**Implementation Steps (PR‑sized)**

1. Types & Factory

- Add `'openai_compat'` to `ProviderType`, new config + validator, ProviderFactory case.

2. Provider Backend

- Implement `src/provider/openai-compat/*` using OpenAI SDK + stream mapping reuse.

3. Storage Utilities

- Add `keys/compat.ts` helpers and tags convention; wire verification helpers.

4. Settings UI

- Add “OpenAI‑Compatible” section with presets and custom form; persist to storage.

5. ModelSelector Refactor

- Dynamic provider groups based on saved keys; gate by `hasCompatProviders()`.

6. Provider Manager

- Initialize `openai_compat` for selected compat models; set active provider.

7. Tests

- Unit + integration suites; update any affected mocks.

8. Docs

- Update `README.md` (BYOK & compat), add `docs/guides/openai-compat.md`.

---

**File Map (new/changed)**

- New
  - `src/provider/openai-compat/OpenAICompatibleProvider.ts`
  - `src/provider/openai-compat/OpenAICompatClient.ts`
  - `src/provider/openai-compat/requestBuilder.ts`
  - `src/provider/openai-compat/streamProcessor.ts` (or re‑export OpenRouter’s)
  - `src/provider/openai-compat/errorHandler.ts`
  - `src/provider/openai-compat/presets.ts`
  - `src/data/storage/keys/compat.ts`
  - `docs/guides/openai-compat.md`
- Changed
  - `src/types/providers.ts` (ProviderType, new config, validator)
  - `src/types/apiKeys.ts` (add `defaultModel` to `APIKeyConfiguration`)
  - `src/provider/ProviderFactory.ts` (support `'openai_compat'`)
  - `src/sidebar/components/Settings/Settings.tsx` (new section)
  - `src/sidebar/components/ModelSelector.tsx` (filter + dynamic groups)
  - `src/sidebar/hooks/ai/useProviderManager.ts` (init logic)
  - `src/config/models.ts` (you’ll add built‑ins model lists; add helpers)

---

**Risks & Mitigations**

- Many “OpenAI‑compatible” APIs vary slightly from OpenAI.
  - Mitigate with a thin compatibility layer; prefer `chat.completions` over `responses`.
- Multiple compat providers at once.
  - ProviderManager picks the one matching the selected model; ModelSelector shows them as separate groups.
- Key detection vs. tags.
  - Use explicit `tags: ['openai_compat', providerId]` to avoid ambiguity with OpenAI keys.

---

**Next Actions**

- Confirm preset base URLs and initial model lists for DeepSeek, Qwen, Zhipu, Kimi.
- I can start with Steps 1–3 and wire a vertical slice (one preset + custom) for review.
