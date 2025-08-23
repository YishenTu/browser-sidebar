# Provider Layer Refactor Plan

## Current State Analysis

### Identified Issues

1. **Triple Model Configuration**: Models defined in 3 places:
   - `src/config/models.ts` (intended single source of truth - 2 models)
   - `src/provider/models.ts` (references openai/gemini model files)
   - `src/provider/{openai,gemini}/models.ts` (detailed model configs with capabilities)

2. **Unused Parameters Still Being Sent**:
   - OpenAI: Still validates and sends `temperature` (line 209 of OpenAIProvider.ts)
   - Gemini: Still sends `temperature`, `topP`, `topK` (lines 483-486 of GeminiProvider.ts)
   - ProviderFactory: Sets defaults for all these unused params (lines 298-304, 317-323)

3. **Settings Store Exposure**:
   - `src/types/settings.ts` still exposes `temperature` and `maxTokens` in AISettings
   - `src/store/settings.ts` validates and stores these unused parameters

4. **Validation Overhead**:
   - Complex parameter validation for fields we don't use (OpenAIProvider lines 111-156)
   - Model capability matrices tracking unused features

## Goals

- Remove ALL references to unused parameters (temperature, topP/topK, penalties)
- Single source of truth: `src/config/models.ts` only
- Minimal provider configs: apiKey, model, and provider-specific features only
- Clean up settings store to remove unused AI parameters
- Keep only OpenAI and Gemini providers (remove OpenRouter references)

## Non-Goals

- No behavior change in UI streaming and message flow
- No breaking changes to Chrome storage (migrate gracefully)
- Keep existing chat/streamChat interfaces intact

## Guardrails

- Backward compatible: Accept but ignore legacy fields from stored settings
- All tests must pass; maintain >90% coverage
- Streaming must remain real-time with AbortSignal support
- No performance regression

## Phases

### Phase 1 — Remove Model Duplication

**Priority: HIGH** - This is the root cause of confusion

- Delete `src/provider/openai/models.ts` and `src/provider/gemini/models.ts`
- Delete or simplify `src/provider/models.ts` to just re-export from `src/config/models.ts`
- Update all imports to use `src/config/models.ts` directly
- Add helper functions to `src/config/models.ts`:
  - `supportsReasoning(modelId)` - returns true for gpt-5-nano
  - `supportsThinking(modelId)` - returns true for gemini models
  - `getModelsByProvider(provider)` - filter models by provider

### Phase 2 — Clean Provider Request Building

**Priority: HIGH** - Stop sending unused parameters

#### OpenAI Provider:
- Remove temperature validation and sending (lines 111-123, 208-210)
- Remove topP, frequencyPenalty, presencePenalty validation (lines 140-156)
- Send ONLY: `model`, `input`, `reasoning: { effort }` (if model supports)
- Clean up config interface to only include: `apiKey`, `model`, `reasoningEffort?`

#### Gemini Provider:
- Remove temperature, topP, topK from request building (lines 483-486)
- Send ONLY required Gemini fields based on their API docs
- Keep thinkingMode if actually used by Gemini 2.5 Flash Lite
- Clean up config to only: `apiKey`, `model`, `thinkingMode?`

### Phase 3 — Settings Store Cleanup

**Priority: MEDIUM** - User-facing cleanup

- Remove from `src/types/settings.ts`:
  - `temperature` from AISettings
  - `maxTokens` from AISettings (use model's built-in max)
- Update `src/store/settings.ts`:
  - Remove temperature validation (lines 102-106, 204-206)
  - Remove maxTokens validation
  - Add migration to clean existing stored settings
- Keep only: `defaultProvider`, `streamResponse` in AISettings

### Phase 4 — Factory & Registry Simplification

**Priority: MEDIUM** - Internal cleanup

- `ProviderFactory.ts`:
  - Remove temperature, topP, topK, penalties from defaults (lines 298-304, 321-323)
  - Remove OpenRouter support completely
  - Simplify to only create OpenAI and Gemini providers
- `ProviderRegistry.ts`:
  - Remove OpenRouter from supported types
  - Simplify provider type checking

### Phase 5 — BaseProvider & Validation

**Priority: LOW** - Framework cleanup

- BaseProvider: Remove capability flags for unused features
- `validation.ts`: Simplify to only validate apiKey format
- Remove complex parameter validation logic
- Add debug logging for ignored legacy fields

### Phase 6 — Test Updates

**Priority: CRITICAL** - Must maintain coverage

- Update all provider tests to stop checking for removed parameters
- Add migration tests for settings compatibility
- Ensure streaming tests still pass
- Verify model selection still works with centralized config

## Implementation Checklist

### Files to Modify:
- [ ] `src/config/models.ts` - Add helper functions
- [ ] `src/provider/openai/OpenAIProvider.ts` - Remove unused param handling
- [ ] `src/provider/gemini/GeminiProvider.ts` - Remove unused param handling  
- [ ] `src/provider/ProviderFactory.ts` - Remove default values for unused params
- [ ] `src/provider/validation.ts` - Simplify to apiKey validation only
- [ ] `src/types/settings.ts` - Remove temperature, maxTokens from AISettings
- [ ] `src/store/settings.ts` - Remove validation, add migration

### Files to Delete:
- [ ] `src/provider/openai/models.ts`
- [ ] `src/provider/gemini/models.ts`
- [ ] `src/provider/models.ts` (or convert to simple re-export)

### Tests to Update:
- [ ] Provider tests - Remove assertions for unused parameters
- [ ] Settings tests - Update for new AISettings structure
- [ ] Migration tests - Add tests for legacy field handling

## Migration Strategy

```typescript
// In settings.ts migration
const migrateSettings = (stored: any): Settings => {
  // Remove deprecated fields
  if (stored.ai) {
    delete stored.ai.temperature;
    delete stored.ai.maxTokens;
    delete stored.ai.topP;
    delete stored.ai.topK;
  }
  return stored;
};
```

## Acceptance Criteria

- ✅ Single model configuration source (`src/config/models.ts`)
- ✅ No temperature/topP/topK/penalties sent in API requests
- ✅ Settings UI no longer shows temperature slider
- ✅ Legacy settings gracefully migrated
- ✅ Only OpenAI and Gemini providers available
- ✅ All tests passing with >90% coverage
- ✅ Streaming performance unchanged

## Risk Mitigation

1. **Settings Migration**: Test with various legacy setting combinations
2. **API Compatibility**: Verify providers work with minimal parameters
3. **UI Impact**: Ensure ModelSelector still functions correctly
4. **Test Coverage**: Run full test suite after each phase

## Success Metrics

- Code reduction: ~30% fewer lines in provider layer
- Complexity reduction: Remove 3 duplicate model configs
- Performance: No regression in streaming latency
- Reliability: No new errors in production

