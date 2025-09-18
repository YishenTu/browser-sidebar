# KeyService

`KeyService` manages Bring Your Own Key (BYOK) credentials inside the browser.
It encrypts secrets before writing them to Chrome storage, exposes masked
metadata for display, and validates keys by probing the respective provider
APIs.

## Usage

```ts
import KeyService from '@services/keys';

const keys = new KeyService();
await keys.initialize('passphrase');

await keys.set('openai', 'sk-your-key');
const masked = await keys.getMetadata('openai');
const ok = await keys.validate('openai', 'sk-your-key');
```

### Lifecycle

1. **Initialise** with `initialize(password)` so the service can derive an AES-GCM
   key (salt stored in Chrome storage).
2. Call `set(provider, key)` / `get(provider)` / `remove(provider)` to manage the
   encrypted secrets.  Stored values live under
   `chrome.storage.local/sync` (handled via `data/storage/chrome`).
3. Use `listProviders()` to enumerate which providers have stored keys and
   `getMetadata(provider)` to retrieve masked values for display.
4. Call `shutdown()` to wipe the derived key from memory when the user signs out.

### Validation

`validate(provider, key)` performs a lightweight live request:

| Provider | Endpoint | Notes |
| -------- | -------- | ----- |
| `openai` | `GET https://api.openai.com/v1/models` | Requires `Authorization: Bearer` |
| `anthropic` | `POST https://api.anthropic.com/v1/messages` | Expects a 400 due to empty body |
| `gemini` / `google` | `GET https://generativelanguage.googleapis.com/v1beta/models` | API key passed as `?key=` |
| `openrouter` | `GET https://openrouter.ai/api/v1/models` | Uses bearer token |

The service chooses between `BackgroundProxyTransport` and
`DirectFetchTransport` based on `@transport/policy.shouldProxy` so CORS
restrictions are respected.  Unknown providers return `false`; OpenAI-compatible
endpoints should be validated with `validateCompatProvider` from
`@services/engine/ValidationService`.

### Metadata

Whenever a key is stored the service keeps a small metadata object containing:

```ts
{
  provider: APIProvider;
  maskedKey: string;   // e.g. "sk-...abcd"
  createdAt: number;
  lastUpdated: number;
}
```

This metadata is retrievable via `getMetadata(provider)` without exposing the
plaintext key.

### Testing

Inject a custom transport via the constructor or `setTransport()` when you need
predictable responses:

```ts
const keys = new KeyService(new DirectFetchTransport());
await keys.initialize('test');
```

`clearAll()` removes every stored key and the derived master key—handy for
resetting between integration tests.
