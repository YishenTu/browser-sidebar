# Key Service

The Key Service provides a unified API for managing API keys across different AI providers in the browser sidebar extension. It handles encryption, storage, validation, and CORS-compliant API key testing.

## Features

- **Encrypted Storage**: Keys are encrypted using AES-256-GCM before storage
- **Provider Validation**: Live API testing for different providers (no format checks)
- **CORS Handling**: Automatic transport selection for API validation requests
- **Chrome Storage**: Integration with Chrome's storage API for persistence
- **Type Safety**: Full TypeScript support with proper typing

## Usage

### Basic Setup

```typescript
import { KeyService } from '@services/keys';

// Initialize the service
const keyService = new KeyService();
await keyService.initialize('your-master-password');
```

### Storing API Keys

```typescript
// Set an API key for OpenAI
await keyService.set('openai', 'sk-your-openai-key-here');

// Set an API key for Anthropic
await keyService.set('anthropic', 'sk-ant-your-anthropic-key-here');

// Set an API key for Google/Gemini
await keyService.set('gemini', 'AIza-your-google-key-here');
```

### Retrieving API Keys

```typescript
// Get an API key
const openaiKey = await keyService.get('openai');

// Check if a key exists
const hasAnthropicKey = await keyService.has('anthropic');

// Get metadata (without exposing the actual key)
const metadata = await keyService.getMetadata('openai');
console.log(metadata.maskedKey); // "sk-...here"
```

### Validation

```typescript
// Validate by making a real API call
const isValid = await keyService.validate('openai', 'sk-test-key');
```

### Management Operations

```typescript
// List all providers with stored keys
const providers = await keyService.listProviders();
console.log(providers); // ['openai', 'anthropic', 'gemini']

// Remove a specific key
await keyService.remove('openai');

// Clear all keys (useful for reset/logout)
await keyService.clearAll();

// Shutdown the service (clears memory)
keyService.shutdown();
```

## Supported Providers

| Provider                    | Format                 | Validation Endpoint         |
| --------------------------- | ---------------------- | --------------------------- |
| `openai`                    | `sk-[48 chars]`        | `/v1/models`                |
| `anthropic`                 | `sk-ant-[40-52 chars]` | `/v1/messages`              |
| `google`                    | `AIza[35 chars]`       | `/v1beta/models`            |
| `gemini`                    | `AIza[35 chars]`       | `/v1beta/models`            |
| `openrouter`                | Various formats        | `/api/v1/models`            |
| `openai`-compatible presets | Any format             | `/models` on custom baseURL |

For OpenAI-compatible providers (e.g., DeepSeek, Qwen, Zhipu, Kimi), use the compat validator:

```ts
import { validateCompatProvider } from '@services/engine';
const ok = await validateCompatProvider('https://your-base-url', 'your-api-key');
```

## Security Features

- **Master Password**: All keys are encrypted with a password-derived key
- **AES-256-GCM**: Industry-standard encryption for stored keys
- **No Plain Text**: Keys are never stored in plain text
- **Memory Safety**: Sensitive data is cleared on shutdown
- **Secure Validation**: API tests use proper authentication headers

## Transport Layer

The service automatically selects the appropriate transport layer:

- **BackgroundProxyTransport**: For CORS-restricted endpoints (used by default)
- **DirectFetchTransport**: For direct requests when CORS proxy isn't needed
- **Custom Transport**: Can be injected for testing or special requirements

```typescript
// Using custom transport
import { DirectFetchTransport } from '@transport/DirectFetchTransport';
const keyService = new KeyService(new DirectFetchTransport());
```

## Error Handling

The service provides detailed error messages for common scenarios:

```typescript
try {
  await keyService.get('nonexistent');
} catch (error) {
  // "No API key found for provider: nonexistent"
}

try {
  await keyService.validate('openai', 'sk-invalid-key');
} catch (error) {
  // Returns false instead of throwing
}
```

## Integration with Existing Systems

The KeyService integrates seamlessly with:

- **Chrome Storage API**: Via `@storage/chrome` module
- **Security Module**: Via `@security/crypto` for encryption
- **Transport Layer**: Via `@transport/*` modules for API validation
- **Provider Types**: Via `@/types/apiKeys` for type safety

## Development Notes

- Service must be initialized with `initialize()` before use
- All operations are async and return Promises
- Keys are validated by real API connectivity only (no format checks)
- Memory is automatically cleaned up on `shutdown()`
- TypeScript strict mode compatible
