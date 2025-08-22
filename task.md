# Task Execution Blueprint: Chat UI + AI Providers Integration

## Project Overview

Connect the existing Chat UI to real AI providers (OpenAI `gpt-5-nano` and Google Gemini `gemini-2.5-flash-lite`) with BYOK (Bring Your Own Key) support. The implementation focuses on delivering a functional chatbot with streaming capabilities, provider switching, and proper error handling.

## Execution Guidelines

- Tasks marked with 🔄 can be executed in parallel
- Tasks marked with ⚡ must be executed sequentially
- Each task includes concrete deliverables and acceptance criteria
- Interface contracts are provided for parallel tasks requiring integration
- Sub-agents should focus on their specific task without modifying unrelated code

## Progress Tracking

- [x] Phase 1: Settings & Provider Initialization (5/5 tasks)
- [x] Phase 2: UI Model Restrictions (4/4 tasks)
- [x] Phase 3: Chat Hook Wiring & Streaming (5/5 tasks)
- [x] Phase 4: ChatPanel Integration (3/3 tasks)
- [ ] Phase 5: Error Handling & UX (0/3 tasks)
- [ ] Phase 6: Permissions & CSP (0/2 tasks)
- [ ] Phase 7: Testing & Verification (0/4 tasks)
- [ ] Phase 8: Documentation & Cleanup (0/2 tasks)

---

## Phase 1: Settings & Provider Initialization

### ⚡ [x] Task 1.1: Update useAIChat Settings Integration

**Prerequisites**: None
**Description**: Replace all references to `settings.activeProvider` with `settings.ai.defaultProvider` in the useAIChat hook
**Deliverables**:

- Modified `src/sidebar/hooks/useAIChat.ts`
  **Acceptance Criteria**:
- All instances of `settings.activeProvider` replaced
- Hook correctly reads from `settings.ai.defaultProvider`
- No TypeScript errors

### 🔄 [x] Task 1.2: Fix API Key Mappings

**Prerequisites**: None
**Description**: Update API key field mappings to use correct settings paths
**Deliverables**:

- Updated key mapping in `useAIChat.ts` and provider initialization code
  **Acceptance Criteria**:
- OpenAI reads from `settings.apiKeys.openai`
- Gemini reads from `settings.apiKeys.google` (not `gemini`)
- Keys correctly passed to provider constructors

### 🔄 [x] Task 1.3: Update Provider Default Configurations

**Prerequisites**: None
**Description**: Set default model configurations for the two supported models
**Deliverables**:

- Updated default configs in `useAIChat.ts`
  **Interface Contract**:

```typescript
const openAIConfig = {
  model: 'gpt-5-nano',
  temperature: 0.7,
  reasoningEffort: 'default',
  maxTokens: 4096,
};
const geminiConfig = {
  model: 'gemini-2.5-flash-lite',
  temperature: 0.7,
  thinkingMode: false,
  showThoughts: false,
  maxTokens: 8192,
};
```

**Acceptance Criteria**:

- Default configs use only the two supported models
- Configs include all required fields for each provider

### ⚡ [x] Task 1.4: Fix Provider State Updates

**Prerequisites**: Task 1.1
**Description**: Replace calls to non-existent `settingsStore.updateActiveProvider` with `updateAISettings({ defaultProvider })`
**Deliverables**:

- Updated state management calls in `useAIChat.ts`
  **Acceptance Criteria**:
- No calls to `updateActiveProvider`
- Provider switching uses `updateAISettings`
- State updates trigger re-initialization

### ⚡ [x] Task 1.5: Verify Provider Initialization

**Prerequisites**: Tasks 1.1, 1.2, 1.3, 1.4
**Description**: Ensure providers initialize correctly with autoInitialize flag
**Deliverables**:

- Working provider initialization in `useAIChat({ autoInitialize: true })`
  **Acceptance Criteria**:
- Provider registers on hook mount
- Active provider set from settings
- No initialization errors in console

---

## Phase 2: UI Model Restrictions

### 🔄 [x] Task 2.1: Update ModelSelector Component

**Prerequisites**: None
**Description**: Restrict ModelSelector to display only the two supported models
**Deliverables**:

- Modified `src/sidebar/components/ModelSelector.tsx`
  **Interface Contract**:

```typescript
const AVAILABLE_MODELS = [
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'Google' },
];
```

**Acceptance Criteria**:

- Dropdown shows exactly two models
- Model selection updates settings correctly
- UI displays friendly names

### 🔄 [x] Task 2.2: Update Settings Store Defaults

**Prerequisites**: None
**Description**: Update DEFAULT_AVAILABLE_MODELS in settings store
**Deliverables**:

- Modified `src/store/settings.ts`
  **Interface Contract**:

```typescript
export const DEFAULT_AVAILABLE_MODELS = [
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'OpenAI', available: true },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    available: true,
  },
];
```

**Acceptance Criteria**:

- Store defaults contain only two models
- Default selectedModel is 'gpt-5-nano'
- Models marked as available

### 🔄 [x] Task 2.3: Update ProviderSettings Component

**Prerequisites**: None
**Description**: Restrict provider settings UI to supported models only
**Deliverables**:

- Modified `src/sidebar/components/Settings/ProviderSettings.tsx` (if exists)
  **Acceptance Criteria**:
- Settings UI shows only supported models per provider
- Max token validation matches model limits
- Temperature and other settings properly bounded

### ⚡ [x] Task 2.4: Verify Model Selection Integration

**Prerequisites**: Tasks 2.1, 2.2, 2.3
**Description**: Ensure model selection properly maps to provider switching
**Deliverables**:

- Working model selection → provider mapping
  **Acceptance Criteria**:
- Selecting GPT-5 Nano activates OpenAI provider
- Selecting Gemini 2.5 Flash Lite activates Google provider
- Settings persist across reloads

---

## Phase 3: Chat Hook Wiring & Streaming

### ⚡ [x] Task 3.1: Implement Active Message State Management

**Prerequisites**: Phase 1 complete
**Description**: Add activeMessageId tracking for streaming state
**Deliverables**:

- Updated `useAIChat.ts` with active message management
  **Interface Contract**:

```typescript
// In sendMessage after creating assistant message:
chatStore.setActiveMessage(assistantMessage.id);
// On finish/cancel:
chatStore.clearActiveMessage();
```

**Acceptance Criteria**:

- `isStreaming()` returns true during active streaming
- Active message cleared on completion/cancel
- State properly synchronized with UI

### 🔄 [x] Task 3.2: Implement Cancel Functionality

**Prerequisites**: None
**Description**: Add proper abort controller handling for cancellation
**Deliverables**:

- Working cancel method in `useAIChat.ts`
  **Acceptance Criteria**:
- Cancel aborts active request
- Clears active message state
- Sets loading to false
- Preserves partial message content

### 🔄 [x] Task 3.3: OpenAI Stream Parsing

**Prerequisites**: None
**Description**: Implement correct OpenAI streaming chunk parsing
**Deliverables**:

- OpenAI stream parser in `useAIChat.ts`
  **Interface Contract**:

```typescript
// Parse OpenAI chunks:
const content = chunk.choices?.[0]?.delta?.content || '';
```

**Acceptance Criteria**:

- Correctly extracts content from OpenAI stream
- Handles missing/null chunks gracefully
- Accumulates content properly

### 🔄 [x] Task 3.4: Gemini Stream Parsing

**Prerequisites**: None
**Description**: Implement Gemini streaming chunk parsing
**Deliverables**:

- Gemini stream parser in `useAIChat.ts`
  **Interface Contract**:

```typescript
// Parse Gemini chunks (once provider implementation ready):
const content = chunk.choices?.[0]?.delta?.content || '';
```

**Acceptance Criteria**:

- Correctly extracts content from Gemini stream
- Handles provider-specific format
- Falls back gracefully if not implemented

### ⚡ [x] Task 3.5: Verify Streaming Integration

**Prerequisites**: Tasks 3.1, 3.2, 3.3, 3.4
**Description**: Test complete streaming flow for both providers
**Deliverables**:

- Working streaming for both models
  **Acceptance Criteria**:
- OpenAI streams tokens progressively
- Gemini streams tokens (or shows complete response)
- Cancel works mid-stream
- UI updates smoothly

---

## Phase 4: ChatPanel Integration

### ⚡ [x] Task 4.1: Wire useAIChat to ChatPanel

**Prerequisites**: Phase 3 complete
**Description**: Ensure ChatPanel properly initializes and uses the AI chat hook
**Deliverables**:

- Updated `src/sidebar/ChatPanel.tsx`
  **Acceptance Criteria**:
- ChatPanel calls `useAIChat({ autoInitialize: true })`
- Hook initializes after settings load
- No duplicate initializations

### ⚡ [x] Task 4.2: Connect Model Selection to Settings

**Prerequisites**: Task 4.1, Phase 2 complete
**Description**: Wire model selector in header to update settings
**Deliverables**:

- Model selection updates `settings.ai.defaultProvider`
- Model selection updates `selectedModel`
  **Acceptance Criteria**:
- Model changes persist in settings
- Provider switches correctly
- UI reflects current selection

### ⚡ [x] Task 4.3: Verify End-to-End Chat Flow

**Prerequisites**: Tasks 4.1, 4.2
**Description**: Test complete chat interaction flow
**Deliverables**:

- Working chat with both providers
  **Acceptance Criteria**:
- Send message → receive streamed response
- Cancel button appears and works during streaming
- Clear conversation resets all state
- Provider switching works seamlessly

---

## Phase 5: Error Handling & UX

### 🔄 [ ] Task 5.1: Missing API Key Handling

**Prerequisites**: Phase 1 complete
**Description**: Show clear errors when API keys are missing
**Deliverables**:

- Error handling in `useAIChat.ts`
- Error display in UI
  **Acceptance Criteria**:
- Missing key shows actionable error message
- Error guides user to settings
- Different message per provider

### 🔄 [ ] Task 5.2: Invalid API Key Handling

**Prerequisites**: Phase 1 complete
**Description**: Handle and display API key validation failures
**Deliverables**:

- Validation error handling
- Clear error messages in UI
  **Acceptance Criteria**:
- Invalid key shows specific error
- Error doesn't crash the app
- User can retry after fixing key

### 🔄 [ ] Task 5.3: Network & Rate Limit Errors

**Prerequisites**: Phase 1 complete
**Description**: Surface provider errors appropriately
**Deliverables**:

- Network error handling
- Rate limit error display
  **Acceptance Criteria**:
- Network errors show retry option
- Rate limits show wait time if available
- Errors appear inline in chat

---

## Phase 6: Permissions & CSP Validation

### 🔄 [ ] Task 6.1: Verify Manifest Permissions

**Prerequisites**: None
**Description**: Confirm manifest.json has required host permissions
**Deliverables**:

- Updated `manifest.json` if needed
  **Required Permissions**:

```json
"host_permissions": [
  "https://api.openai.com/*",
  "https://generativelanguage.googleapis.com/*"
]
```

**Acceptance Criteria**:

- Both API endpoints included
- Permissions properly formatted
- No excessive permissions

### 🔄 [ ] Task 6.2: Validate CSP Configuration

**Prerequisites**: None
**Description**: Ensure Content Security Policy allows API connections
**Deliverables**:

- CSP validation report
  **Acceptance Criteria**:
- CSP connect-src includes both endpoints
- No CSP violations in console
- APIs callable from extension context

---

## Phase 7: Testing & Verification

### ⚡ [ ] Task 7.1: Unit Tests for useAIChat

**Prerequisites**: Phases 1-3 complete
**Description**: Write unit tests for chat hook functionality
**Deliverables**:

- Test file `tests/sidebar/hooks/useAIChat.test.ts`
  **Acceptance Criteria**:
- Tests provider selection logic
- Tests streaming state transitions
- Tests error handling
- > 90% coverage of hook code

### ⚡ [ ] Task 7.2: Integration Tests

**Prerequisites**: Phase 4 complete
**Description**: Test component integration and state management
**Deliverables**:

- Integration test suite
  **Acceptance Criteria**:
- Tests message send/receive flow
- Tests provider switching
- Tests cancel functionality
- Verifies MessageList updates

### 🔄 [ ] Task 7.3: OpenAI E2E Manual Test

**Prerequisites**: All phases complete
**Description**: Manual end-to-end test with OpenAI
**Test Steps**:

1. Set OpenAI API key
2. Select GPT-5 Nano model
3. Send test message
4. Verify streaming response
5. Test cancel mid-stream
   **Acceptance Criteria**:

- All steps complete successfully
- No console errors
- Smooth UX

### 🔄 [ ] Task 7.4: Gemini E2E Manual Test

**Prerequisites**: All phases complete
**Description**: Manual end-to-end test with Gemini
**Test Steps**:

1. Set Google API key
2. Select Gemini 2.5 Flash Lite
3. Send test message
4. Verify response (streaming or complete)
5. Test cancel functionality
   **Acceptance Criteria**:

- All steps complete successfully
- No console errors
- Provider switching works

---

## Phase 8: Documentation & Cleanup

### 🔄 [ ] Task 8.1: Update Documentation

**Prerequisites**: All implementation complete
**Description**: Update docs to reflect supported models and configuration
**Deliverables**:

- Updated README.md
- Updated CLAUDE.md if needed
  **Documentation Updates**:
- Supported providers: OpenAI, Google Gemini
- Supported models: gpt-5-nano, gemini-2.5-flash-lite
- Settings structure: ai.defaultProvider, apiKeys.openai/google
  **Acceptance Criteria**:
- Docs accurate and complete
- Setup instructions clear
- API key configuration documented

### 🔄 [ ] Task 8.2: Remove Legacy Code

**Prerequisites**: All implementation complete
**Description**: Clean up legacy model references and unused code
**Deliverables**:

- Cleaned codebase
  **Acceptance Criteria**:
- No references to unsupported models (GPT-4, Claude, etc.)
- No dead code paths
- No commented-out legacy code

---

## Risk Mitigation Notes

1. **Gemini Streaming**: If `GeminiProvider.streamChat` not ready, implement fallback to complete response
2. **API Key Security**: Never log or expose API keys in console/errors
3. **Rate Limiting**: Implement exponential backoff for retries
4. **Memory Leaks**: Ensure proper cleanup of event listeners and abort controllers
5. **TypeScript Strictness**: Fix all type errors before marking tasks complete

## Synchronization Points

- **After Phase 1**: Verify provider initialization before proceeding
- **After Phase 3**: Test streaming with mock data if providers not ready
- **After Phase 4**: Full integration test before error handling
- **Before Phase 8**: Complete functional testing before cleanup

## Interface Contracts Summary

All parallel tasks must respect these shared interfaces:

- Model IDs: `gpt-5-nano`, `gemini-2.5-flash-lite`
- Settings paths: `settings.ai.defaultProvider`, `settings.apiKeys.{openai,google}`
- Chat store methods: `setActiveMessage()`, `clearActiveMessage()`
- Error format: `{ type: 'api_error' | 'network_error' | 'validation_error', message: string }`
