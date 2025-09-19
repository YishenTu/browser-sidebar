# Transport Module

Abstractions over HTTP requests to AI providers. Engines use these transports so they do not care whether a call happens directly from the sidebar or proxied through the background service worker.

## Structure

```
transport/
├── types.ts                    # TransportRequest/Response interfaces
├── DirectFetchTransport.ts     # Native fetch wrapper with streaming helpers
├── BackgroundProxyTransport.ts # MV3-port proxy for CORS-restricted endpoints
├── policy.ts                   # shouldProxy(url) + allow/deny heuristics
└── index.ts                    # Barrel exports
```

## Interfaces

```ts
export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
  stream(req: TransportRequest): AsyncIterable<Uint8Array>;
}
```

- `request` handles one-shot calls (model metadata, key validation).
- `stream` yields raw byte chunks; engines convert them to tokens/JSON deltas.

## Usage

```ts
import { shouldProxy } from '@transport/policy';
import { DirectFetchTransport, BackgroundProxyTransport } from '@transport';

const req = { url, method: 'POST', headers, body, stream: true } as const;
const transport = shouldProxy(req.url)
  ? new BackgroundProxyTransport()
  : new DirectFetchTransport();

const response = await transport.request({ ...req, stream: false });

for await (const chunk of transport.stream(req)) {
  // Convert Uint8Array -> text -> provider-specific parser
}
```

## Background Proxy

`BackgroundProxyTransport` uses a long-lived `chrome.runtime.Port` to stream responses through the service worker. It is automatically selected when:

- The URL matches known CORS-hostile domains (e.g., Moonshot, domestic OpenAI-compatible providers).
- The protocol/classification in `policy.ts` flags the host as requiring proxying.

## Policy

`shouldProxy(url)` inspects hostname rules, allowlists, and explicit overrides in `policy.ts`. Update that file when onboarding new compat providers that need background proxying.

## Error Handling

Transports throw typed errors (network, timeout, abort). Engines map those into `ProviderError` so the sidebar can present user-friendly messages.

## Testing

- `DirectFetchTransport` is covered by unit tests with mocked fetch.
- `BackgroundProxyTransport` includes integration tests with port stubs to ensure streaming order is preserved.
