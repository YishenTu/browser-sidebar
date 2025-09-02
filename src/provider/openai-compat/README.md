# OpenAI-Compatible Provider Module

This module provides support for OpenAI-compatible API endpoints, allowing the browser extension to work with various AI providers that implement the OpenAI API specification.

## Overview

The OpenAI-compatible provider enables integration with any API service that follows the OpenAI Chat Completions API format. This includes both built-in preset providers and custom endpoints configured by users. The module handles authentication, request/response formatting, streaming, error handling, and CORS proxy support for restricted APIs.

## Module Structure

```
openai-compat/
├── OpenAICompatibleProvider.ts  # Main provider class extending BaseProvider
├── OpenAICompatClient.ts        # Client wrapper around OpenAI SDK
├── ProxiedOpenAIClient.ts       # CORS proxy support for restricted APIs
├── requestBuilder.ts            # Converts messages to OpenAI format
├── streamProcessor.ts           # Processes streaming SSE responses
├── errorHandler.ts              # Maps API errors to standard format
├── presets.ts                   # Built-in provider configurations
└── README.md                    # This file
```

## Key Features

- **OpenAI API Compatibility**: Works with any service implementing OpenAI's chat completions API
- **Streaming Support**: Real-time token streaming for endpoints that allow direct fetch in the page context
- **CORS Proxy**: Automatic routing through background worker for CORS‑restricted APIs (non‑streaming fallback)
- **Error Handling**: Comprehensive error mapping for consistent user experience
- **Dynamic Model Discovery**: Automatically detects available models from providers
- **Secure Storage**: Keys are stored in extension storage (BYOK). See project README for storage details

## Supported Providers

### Built-in Presets

- **DeepSeek** - `https://api.deepseek.com/v1`
- **Qwen (Alibaba Cloud)** - `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Zhipu AI** - `https://open.bigmodel.cn/api/paas/v4`
- **Kimi (Moonshot AI)** - `https://api.moonshot.cn/v1` (CORS-restricted, uses proxy)

## CORS Proxy Support

Some API providers (like Kimi/Moonshot AI) don't include proper CORS headers, preventing direct browser JavaScript access. For these providers, we route requests through the background service worker which isn't subject to CORS restrictions.

### Adding New CORS-Restricted Providers

If you need to add support for a new provider that has CORS issues:

1. **Add the API base URL to the proxy whitelist** in `/src/extension/background/proxyHandler.ts`:

```typescript
// In proxyHandler.ts
const CORS_RESTRICTED_APIS = [
  'https://api.moonshot.cn', // Kimi API
  'https://your-new-api.com', // Add your new API here
];
```

2. **Update the proxy detection logic** in `/src/provider/openai-compat/ProxiedOpenAIClient.ts`:

```typescript
// In ProxiedOpenAIClient.ts - proxiedFetch function
if (
  !urlString.startsWith('https://api.moonshot.cn') &&
  !urlString.startsWith('https://your-new-api.com')
) {
  // Use regular fetch for non-proxied URLs
  return fetch(url, init);
}

// In createProxiedOpenAIClient function
const requiresProxy =
  config.baseURL.startsWith('https://api.moonshot.cn') ||
  config.baseURL.startsWith('https://your-new-api.com');

// In testProxiedConnection function
const requiresProxy =
  config.baseURL.startsWith('https://api.moonshot.cn') ||
  config.baseURL.startsWith('https://your-new-api.com');
```

3. **Add the provider preset** (optional) in `/src/provider/openai-compat/presets.ts`:

```typescript
export const OPENAI_COMPAT_PRESETS: OpenAICompatPreset[] = [
  // ... existing presets
  {
    id: 'your-provider',
    name: 'Your Provider Name',
    baseURL: 'https://your-new-api.com/v1',
  },
];
```

### How the Proxy Works

1. **Detection**: Client checks if the URL matches a CORS‑restricted API (e.g., `https://api.moonshot.cn`).
2. **Routing (non‑streaming)**: One‑shot requests go over `chrome.runtime.sendMessage` with type `PROXY_REQUEST` and the background fetches and returns the full body.
3. **Routing (streaming/SSE)**: Streaming requests open a long‑lived `chrome.runtime.connect` Port named `proxy-stream`. The background performs the fetch and relays chunks over the port while the foreground exposes a `ReadableStream` to the OpenAI SDK.
4. **Execution**: Background worker performs the HTTP request (not subject to CORS) and forwards status/headers/chunks.
5. **Response**: Foreground constructs a `Response` backed by a `ReadableStream` for true SSE.

### Testing CORS Issues

To check if an API has CORS issues:

```bash
# Check if API responds to preflight requests
curl -I -X OPTIONS https://api.example.com/v1/models \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

Look for `Access-Control-Allow-Origin` in the response headers. If it's missing or doesn't include `*` or your origin, the API needs proxying.

## Usage

### Adding a New Built-in Provider

1. Add the provider configuration to `presets.ts`:

```typescript
{
  id: 'provider-id',
  name: 'Provider Name',
  baseURL: 'https://api.provider.com/v1',
}
```

2. Add model configurations in `/src/config/models.ts`:

```typescript
{
  id: 'model-id',
  name: 'Model Name',
  provider: 'provider-id',
}
```

3. Update the provider ID list in `/src/config/models.ts`:

```typescript
export const OPENAI_COMPAT_PROVIDER_IDS = [
  'deepseek',
  'qwen',
  'zhipu',
  'kimi',
  'provider-id',
] as const;
```

### Custom Provider Support

Users can add custom OpenAI-compatible endpoints through the Settings UI without code changes. The system will:

- Validate the endpoint URL and API key
- Test connectivity with a simple completion request
- Store credentials securely with encryption
- Make the provider available in the model selector

## API Integration

### Request Format

The module converts internal message format to OpenAI's expected structure:

```typescript
{
  model: "model-id",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ],
  stream: true,
  temperature: 0.7
}
```

### Response Handling

Streaming responses are processed as Server-Sent Events (SSE):

- Chunks are parsed for content deltas
- Special tokens (thinking, reasoning) are filtered
- Errors are caught and mapped to standard format
- Stream ends with `[DONE]` marker

## File Descriptions

- **OpenAICompatibleProvider.ts** - Main provider class that extends BaseProvider, handles initialization, configuration validation, and streaming
- **OpenAICompatClient.ts** - Thin wrapper around OpenAI SDK, manages client instance and connection testing
- **ProxiedOpenAIClient.ts** - Implements custom fetch for CORS-restricted APIs, routes through background worker
- **requestBuilder.ts** - Transforms internal message format to OpenAI API format, handles system prompts
- **streamProcessor.ts** - Parses SSE chunks from streaming responses (reuses OpenRouter's implementation)
- **errorHandler.ts** - Maps various API error responses to standardized ProviderError format
- **presets.ts** - Defines built-in provider configurations and helper functions

## Security Considerations

- The proxy only allows whitelisted API endpoints to prevent abuse
- API keys are never exposed to web pages, only used in extension context
- All API keys are encrypted using AES-GCM before storage
- Requests are validated before proxying to ensure they're legitimate API calls
