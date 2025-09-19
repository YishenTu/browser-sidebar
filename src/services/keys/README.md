# Key Service

`KeyService` provides a unified facade for API key validation and (legacy) encrypted storage. It is primarily used by Settings to verify keys against provider endpoints; the new key vault in `@data/storage/keys` handles long-term storage.

## When to Use

- **Validate** a candidate key before saving it (`validate('openai', key)` etc.).
- **Migrate** existing encrypted entries created by earlier versions of the extension.
- **Access** encrypted keys stored via `KeyService.set/get` (requires initialization).

## Initialization

Operations that read/write encrypted keys (`get`, `set`, `listProviders`, `getMetadata`) require calling `initialize(password)` once to derive an AES-GCM master key. Validation helpers do **not** require initialization.

```ts
import KeyService from '@services/keys/KeyService';

const ks = new KeyService();

// Validation only
const isValid = await ks.validate('openai', candidateKey); // no initialize() needed

// Legacy encrypted storage
await ks.initialize('strong-password');
await ks.set('openai', realKey);
const stored = await ks.get('openai');
```

## Validation Endpoints

Built-in support exists for:

| Provider          | Endpoint                                                  | Expected Status    |
| ----------------- | --------------------------------------------------------- | ------------------ |
| `openai`          | `https://api.openai.com/v1/models`                        | 200                |
| `anthropic`       | `https://api.anthropic.com/v1/messages`                   | 400 (missing body) |
| `google`/`gemini` | `https://generativelanguage.googleapis.com/v1beta/models` | 200                |
| `openrouter`      | `https://openrouter.ai/api/v1/models`                     | 200                |

Validation automatically selects `BackgroundProxyTransport` when `shouldProxy(url)` is true.

## Integration with the New Vault

- The modular key vault (`@data/storage/keys`) is the preferred storage layer for new features. `KeyService` remains available for validation and backwards compatibility.
- `EngineManagerService` reuses `validateOpenAIKey`, `validateGeminiKey`, `validateOpenRouterKey`, and `validateCompatProvider` helpers defined in `services/engine/ValidationService.ts` (these instantiate `KeyService` under the hood).

## Error Handling

- `get` throws `No API key found for provider` when the key is missing.
- Validation returns `false` on network/authorization failures instead of throwing.
- All other errors are wrapped with descriptive messages (encryption, storage, etc.).

## Testing

Use the provided validation helpers in tests to avoid hard-coding endpoints. When testing encrypted storage paths, mock `@data/storage/chrome` to avoid writing to real storage.
