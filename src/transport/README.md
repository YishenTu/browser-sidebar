# Transport Module

HTTP transport abstraction for provider API calls. Provides a unified, typed interface for direct fetch and background‑proxied streaming with CORS handling.

## Structure

```
transport/
├── types.ts                    # TransportRequest/Response, Transport interface
├── DirectFetchTransport.ts     # Direct fetch implementation
├── BackgroundProxyTransport.ts # Background Port-based SSE proxy
├── policy.ts                   # shouldProxy(url) allowlist/denylist
└── index.ts                    # Barrel exports
```

## Interfaces

```ts
export interface TransportRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers: Record<string, string>;
  body?: string | ArrayBuffer | FormData;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body?: ReadableStream<Uint8Array> | ArrayBuffer | string;
}

export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
  stream(req: TransportRequest): AsyncIterable<Uint8Array>;
}
```

## Usage

```ts
import { shouldProxy } from '@transport/policy';
import { DirectFetchTransport, BackgroundProxyTransport } from '@transport';

const req = { url, method: 'POST', headers, body, stream: true } as const;
const transport = shouldProxy(req.url)
  ? new BackgroundProxyTransport()
  : new DirectFetchTransport();

// Non-streaming
const res = await transport.request({ ...req, stream: false });

// Streaming
for await (const chunk of transport.stream(req)) {
  // process SSE/text chunks
}
```

## Policy

`shouldProxy(url)` consults a small allowlist/denylist and returns true for CORS‑restricted endpoints (e.g., `api.moonshot.cn`). Update `policy.ts` to adjust routing.

## Error Handling

Typed error classes are provided for network/timeout/abort cases. Providers/engines map these to user‑facing errors.
