# Transport layer

Abstractions in `src/transport/` provide a uniform interface for HTTP requests
made by providers and validation services.  They encapsulate fetch/streaming
behaviour and decide when to route calls through the background proxy.

## Files

| File | Purpose |
| ---- | ------- |
| `types.ts` | `Transport` interface, request/response types, and error classes |
| `DirectFetchTransport.ts` | Straightforward `fetch` implementation that supports streaming |
| `BackgroundProxyTransport.ts` | Uses the background service worker to perform proxied requests and SSE-style streaming |
| `policy.ts` | `shouldProxy(url)` allow/deny list |
| `index.ts` | Barrel exports |

## Interface

```ts
export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
  stream(req: TransportRequest): AsyncIterable<Uint8Array>;
}
```

Both transports support `stream()`—`DirectFetchTransport` wraps `ReadableStream`
chunks, while `BackgroundProxyTransport` talks to the background worker using the
`proxy-stream` port defined in `extension/background/proxyHandler.ts`.

`types.ts` also exports `TransportNetworkError`, `TransportTimeoutError`, and
`TransportAbortError` so callers can distinguish failure modes.

## Policy

`shouldProxy(url)` centralises the list of hosts that must be called from the
background worker (e.g. `api.moonshot.cn`).  Use it before instantiating a
transport:

```ts
import { shouldProxy, BackgroundProxyTransport, DirectFetchTransport } from '@transport';

const transport = shouldProxy(url)
  ? new BackgroundProxyTransport()
  : new DirectFetchTransport();
```

## Usage tips

* Always forward the `AbortSignal` when streaming so cancellation propagates to
  the transport.
* The proxy transport rejects requests for URLs that are not allowed by the
  policy, making it safe to expose to user configuration.
* When adding a new host to the proxy policy, ensure the background handler has
  the right permissions declared in `manifest.json`.
