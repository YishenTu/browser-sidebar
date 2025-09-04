# Baseline Extension Behavior

This document records the current behavior of the AI Browser Sidebar extension as of the refactor starting point. This serves as a regression testing reference to ensure all functionality is preserved during the modular architecture refactor.

## Extension Loading and Activation

### Initial Extension Installation

**Expected Behavior:**

1. Extension installs with manifest version 3
2. Default settings are stored in Chrome storage:
   - `extension-version`: Current version from manifest
   - `install-timestamp`: Installation time
   - `sidebar-settings`: Default width 400px, position right, remember state enabled
3. Extension icon appears in browser toolbar
4. No sidebar is visible until first activation

**Permissions:**

- Required: `storage`, `tabs`, `activeTab`, `scripting`
- Host permissions: `<all_urls>`, OpenAI, Google Gemini, OpenRouter APIs
- Content scripts auto-inject on all pages

### Extension Icon Click Behavior

**First Click (Fresh Tab):**

1. Extension icon clicked → Background service worker receives action
2. Background creates `TOGGLE_SIDEBAR` message
3. Content script receives message and injects sidebar HTML/CSS
4. Sidebar appears on right side, 85% viewport height, vertically centered
5. Default width: 400px (300-800px range)
6. Sidebar state tracked per tab in background script

**Subsequent Clicks:**

1. Sidebar toggles visibility (show/hide)
2. Position and size are remembered within the session
3. Each tab maintains independent sidebar state
4. No re-injection of HTML/CSS - just show/hide existing sidebar

## Chat Streaming Behavior

### Message Flow Architecture

**UI → Services → Provider → API:**

1. User types message in ChatInput component
2. `useAIChat` hook orchestrates the request
3. `useMessageHandler` manages streaming via active provider
4. Provider (OpenAI/Gemini/OpenRouter) handles API communication
5. Streaming chunks processed and displayed in real-time

### OpenAI Streaming (GPT-5 series)

**Request Pattern:**

- Uses OpenAI Response API with `reasoning_effort` parameter
- Models: `gpt-5-nano`, `gpt-5-mini`, `gpt-5` with different effort levels
- Streaming enabled with token buffering for smooth display

**Stream Processing:**

1. `OpenAIStreamProcessor` handles SSE stream chunks
2. Chunks parsed for content deltas and reasoning tokens
3. Thinking/reasoning content displayed in `ThinkingWrapper`
4. Regular content streamed to `MessageBubble`
5. Stream completion triggers final processing

### Gemini Streaming (2.5 series)

**Request Pattern:**

- Uses Gemini generative language API
- Models: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
- Dynamic thinking behavior based on model capabilities

**Stream Processing:**

1. `GeminiStreamProcessor` handles response chunks
2. Thinking behavior varies by model (disabled/dynamic/automatic)
3. Content processed through similar chunk display pipeline

### OpenRouter Streaming

**Request Pattern:**

- Uses OpenRouter API as proxy to various models
- Unified request format through OpenRouter endpoints
- Stream processing through OpenRouter-specific handlers

### Cancellation Behavior

**User Cancels Stream:**

1. Cancel button click triggers `cancelMessage()` from `useMessageHandler`
2. `AbortController` signal propagates to fetch request
3. Stream processing stops immediately
4. UI updates to show cancelled state
5. Provider connection cleanly terminated

## Tab Content Extraction

### Auto-extraction (Current Tab)

**On Sidebar First Activation:**

1. `useTabExtraction` hook automatically extracts current tab content
2. Background script receives `EXTRACT_TAB_CONTENT` message
3. Content script uses orchestrated extraction pipeline:
   - DOM analyzers identify content regions
   - Content extractors pull text, headers, metadata
   - Markdown converter creates structured output
4. Extracted content cached (5min TTL) in background
5. Current tab content displays in `ContentPreview` component
6. Auto-extraction occurs only ONCE per session

**Extraction Modes:**

- `DEFUDDLE` (default): Cleaned, structured content
- `RAW`: Full page HTML with minimal processing

### Multi-tab Extraction (@-mentions)

**@ Mention Workflow:**

1. User types `@` in chat input
2. `TabMentionDropdown` shows available tabs
3. Available tabs = all open tabs MINUS current tab and already loaded tabs
4. User selects tab from dropdown
5. Manual extraction triggered via `extractTabById()`
6. Background handles extraction with same pipeline
7. Tab content added to loaded tabs collection
8. Tab appears as `TabContentItem` in chat interface

**Multi-tab State Management:**

- Loaded tabs stored in Zustand `tabStore`
- Each tab has extraction status: `extracting`, `completed`, `failed`
- Failed extractions show error state with retry option
- Tabs can be removed individually from loaded collection
- "Clear All" removes all loaded tabs and resets state

### Content Caching and Freshness

**Cache Behavior:**

- Extracted content cached in background for 5 minutes
- `forceRefresh: true` bypasses cache for manual extractions
- Stale content marked with `isStale: true` flag
- Cache key based on tab URL and extraction mode

## Provider Switching

### Provider Management Architecture

**Available Providers:**

1. **OpenAI** - GPT-5 series with reasoning effort
2. **Gemini** - 2.5 series with thinking capabilities
3. **OpenRouter** - Proxy access to various models
4. **OpenAI-Compatible** - Custom endpoints with presets

### Switching Flow

**UI Provider Selection:**

1. `ModelSelector` component shows current model
2. Dropdown lists all available models grouped by provider
3. User selects different model/provider
4. `useProviderManager` handles switch via `ProviderRegistry`
5. `ProviderFactory` creates new provider instance if needed
6. Next chat request uses new provider

**Provider Validation:**

- API keys validated on first use
- Connection testing via provider's `testConnection()` method
- Invalid providers show error state in UI
- Validation results cached to avoid repeated tests

### Provider Configuration

**API Key Storage:**

- Keys stored encrypted in Chrome storage
- AES-GCM encryption with browser-generated keys
- Separate keys for each provider type
- Keys validated before storage

**Model Selection:**

- Available models loaded from `src/config/models.ts`
- Provider capabilities determine available options
- Model selection persisted across sessions
- Default provider preference stored in settings

## Settings Management

### Settings UI Flow

**Settings Panel Access:**

1. Click settings icon in sidebar header
2. Settings panel slides in from right
3. Tabbed interface for different categories
4. Changes saved immediately to Chrome storage

### API Key Management

**Key Entry Process:**

1. User enters API key in masked input field
2. Toggle visibility with eye icon
3. "Verify & Save" button triggers validation
4. Key tested against provider's API
5. Success: Key encrypted and stored
6. Failure: Error message shown, key not saved

**Provider-Specific Validation:**

- **OpenAI**: GET `/v1/models` to verify key
- **Gemini**: Test request to generative language API
- **OpenRouter**: Validate against OpenRouter endpoints
- **Compatible**: Custom endpoint testing based on configuration

### OpenAI-Compatible Provider Management

**Custom Provider Setup:**

1. Select from preset list (Kimi, DeepSeek, etc.)
2. OR manually enter custom endpoint details
3. API key validation specific to endpoint
4. Saved providers appear in main provider list
5. "Clear All" removes all custom providers

**CORS Proxy Behavior:**

- Custom endpoints use background proxy for CORS
- Policy determines which URLs need proxying
- Default allowlist includes `https://api.moonshot.cn`
- Streaming handled through long-lived ports

## Sidebar Interactions

### Positioning and Resizing

**Initial Position:**

- Appears on right side of viewport
- 85% viewport height, vertically centered
- Default width: 400px
- Z-index ensures overlay above page content

**Resize Behavior:**

1. Left edge drag handle allows horizontal resizing
2. Width constrained to 300-800px range
3. Real-time resize with smooth CSS transitions
4. Size remembered within session (resets on close)

**Move Behavior:**

1. Header drag handle allows repositioning
2. Sidebar can be moved anywhere in viewport
3. Position clamped to stay within visible area
4. Position remembered within session

### Shadow DOM Isolation

**Styling Isolation:**

- Sidebar rendered in Shadow DOM
- Page styles cannot affect sidebar appearance
- Sidebar styles cannot leak to page
- Complete CSS isolation ensures consistent appearance

**Event Handling:**

- Click events properly handled within shadow boundary
- Focus management contained within sidebar
- Keyboard navigation works correctly in isolation

### Session Persistence

**Per-Tab State:**

- Each tab has independent sidebar state
- Position, size, and visibility tracked separately
- Tab content extraction state maintained per tab
- Chat history separated by tab (if implemented)

**Cross-Session Behavior:**

- Sidebar state resets on page reload
- API keys and settings persist across sessions
- Provider selection remembered globally
- Tab content cache expires after 5 minutes

## Error Handling and Recovery

### Network Error Scenarios

**API Request Failures:**

1. Network timeout → "Request timed out" error
2. Invalid API key → "Authentication failed" error
3. Rate limiting → "Rate limit exceeded" error
4. Provider downtime → "Service temporarily unavailable"

**Recovery Mechanisms:**

- Automatic retry for transient network errors
- Manual retry options for failed operations
- Graceful degradation with error messages
- Fallback to cached content when available

### Content Extraction Failures

**Common Failure Modes:**

1. CORS restrictions on certain sites
2. JavaScript-heavy sites with delayed content
3. Very large pages exceeding memory limits
4. Protected content that cannot be accessed

**Error Display:**

- Failed extractions show error state in UI
- Specific error messages guide user action
- Retry buttons for recoverable failures
- Alternative extraction modes (RAW vs DEFUDDLE)

### Provider Error Handling

**Initialization Failures:**

- Missing API keys → Settings prompt
- Invalid configuration → Configuration error display
- Network connectivity → Retry mechanisms
- Service downtime → Provider status indication

**Runtime Error Recovery:**

- Stream interruption → Clean termination and retry option
- Model switching failures → Revert to previous working model
- Quota exhaustion → Clear usage indicators and guidance

## Performance Characteristics

### Rendering Performance

**Initial Sidebar Load:**

- Sidebar injection: <100ms on typical pages
- First render: <200ms after injection
- React component hydration: <100ms
- Total time to interactive: <400ms

**Streaming Performance:**

- Token display latency: <50ms per chunk
- Smooth scrolling maintained during streaming
- Memory usage stable over long conversations
- No visual stuttering during rapid token arrival

### Memory Usage Patterns

**Baseline Memory:**

- Sidebar DOM: ~2MB baseline
- React components: ~1MB runtime
- Chat history: ~100KB per conversation
- Content cache: Variable based on extracted content

**Memory Growth:**

- Long conversations: ~50KB per message pair
- Large tab extractions: ~200KB per tab
- Normal growth rate: <5MB per hour of usage
- Garbage collection occurs on tab navigation

### Network Usage

**API Request Patterns:**

- Chat streaming: Variable based on response length
- Content extraction: One-time per tab extraction
- Settings sync: Minimal, settings-dependent
- Keep-alive: 20-second intervals, minimal data

## Security and Privacy

### Data Storage Security

**Local Storage:**

- API keys encrypted with AES-GCM
- Encryption keys generated per browser session
- No sensitive data stored in plain text
- Settings data serialized securely

**Network Security:**

- All API communication over HTTPS
- Certificate validation enforced
- No data transmitted to third parties except chosen AI providers
- CORS proxy limited to allowlisted domains

### Privacy Characteristics

**Data Handling:**

- Page content only extracted when explicitly requested
- No automatic data collection or telemetry
- Chat history stored locally only
- API keys never transmitted except to intended providers

**User Control:**

- Complete control over data sharing with AI providers
- Clear indication of what content is being extracted
- Manual extraction workflow ensures user consent
- Easy clearing of stored data and conversation history

---

## Test Flows for Regression Testing

### Critical Path Tests

1. **Extension Load**: Install → Icon appears → First click → Sidebar appears
2. **Chat Flow**: Send message → Provider processes → Stream displays → Complete
3. **Provider Switch**: Change model → Next message uses new provider → Verify response
4. **Tab Extraction**: @ mention → Select tab → Content loads → Display in chat
5. **Settings**: Enter API key → Validate → Save → Use in chat
6. **Resize/Move**: Drag edges → Size changes → Drag header → Position changes

### Regression Test Scenarios

1. **Multiple Tab Behavior**: Open multiple tabs → Toggle sidebar in each → Verify independent state
2. **Long Conversation**: Send many messages → Verify performance remains stable
3. **Network Interruption**: Start request → Disconnect → Reconnect → Verify recovery
4. **Provider Errors**: Invalid key → Verify error handling → Fix key → Verify recovery
5. **Large Content**: Extract from content-heavy page → Verify performance and correctness
6. **Edge Cases**: Very narrow sidebar → Very wide sidebar → Off-screen positioning

This baseline behavior documentation ensures all current functionality is preserved during the refactor to the new modular architecture.
