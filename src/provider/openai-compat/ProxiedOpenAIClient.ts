/**
 * Proxied OpenAI Client for CORS-restricted endpoints
 *
 * Routes requests through the background service worker to bypass CORS
 */

import OpenAI from 'openai';
import type { OpenAICompatibleConfig } from '@/types/providers';
import { createMessage } from '@/types/messages';

function isSSERequest(init?: RequestInit): boolean {
  const headers = (init?.headers as Record<string, string> | undefined) || {};
  const accept = headers['Accept'] || headers['accept'];
  if (typeof accept === 'string' && accept.includes('text/event-stream')) return true;
  const body = init?.body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && parsed.stream === true) return true;
    } catch {
      // ignore JSON parse errors
    }
  }
  return false;
}

function proxiedStreamFetch(urlString: string, init?: RequestInit): Promise<Response> {
  return new Promise(resolve => {
    const port = chrome.runtime.connect({ name: 'proxy-stream' });

    let headers: Record<string, string> | undefined;
    let status = 200;
    let statusText = 'OK';

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        port.onMessage.addListener((msg: unknown) => {
          if (!msg || typeof msg !== 'object') return;
          switch (msg.type) {
            case 'start':
              headers = msg.headers as Record<string, string> | undefined;
              status = msg.status || 200;
              statusText = msg.statusText || 'OK';
              break;
            case 'chunk':
              controller.enqueue(encoder.encode(msg.chunk as string));
              break;
            case 'end':
              controller.close();
              try {
                port.disconnect();
              } catch {
                /* ignore errors */
              }
              break;
            case 'error':
              controller.error(new Error(msg.message || 'Proxy stream error'));
              try {
                port.disconnect();
              } catch {
                /* ignore errors */
              }
              break;
          }
        });

        port.onDisconnect.addListener(() => {
          // If the stream hasn't closed, signal completion.
          try {
            controller.close();
          } catch {
            /* ignore errors */
          }
        });

        // Kick off request
        port.postMessage({
          url: urlString,
          method: init?.method || 'GET',
          headers: (init?.headers as Record<string, string>) || {},
          body: init?.body as string,
        });
      },
      cancel() {
        try {
          port.disconnect();
        } catch {
          /* ignore errors */
        }
      },
    });

    // Resolve once we receive initial metadata ('start') or immediately with default values.
    // We don't wait for 'start' to construct a Response since headers follow SSE data semantics.
    resolve(
      new Response(stream, {
        status,
        statusText,
        headers: new Headers({ 'content-type': 'text/event-stream', ...(headers || {}) }),
      })
    );
  });
}

/**
 * Custom fetch implementation that routes through background proxy
 */
async function proxiedFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = url.toString();

  // Check if this URL needs proxying (Kimi API)
  if (!urlString.startsWith('https://api.moonshot.cn')) {
    // Use regular fetch for non-proxied URLs
    return fetch(url, init);
  }

  // For SSE streaming, use a dedicated port-based streaming proxy
  if (isSSERequest(init)) {
    return proxiedStreamFetch(urlString, init);
  }

  // Otherwise send single-request to background service worker for proxying
  const message = createMessage({
    type: 'PROXY_REQUEST',
    source: 'sidebar',
    target: 'background',
    payload: {
      url: urlString,
      method: init?.method || 'GET',
      headers: (init?.headers as Record<string, string>) || {},
      body: init?.body as string,
    },
  });

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // Handle missing response
      if (!response) {
        reject(new Error('No response from background proxy'));
        return;
      }

      // Handle error responses
      if (!response.ok) {
        // Create OpenAI-compatible error response
        const errorBody = JSON.stringify({
          error: {
            message: response.error || response.body || 'Request failed',
            type: response.status === 401 ? 'invalid_request_error' : 'api_error',
            code: response.status === 401 ? 'invalid_api_key' : 'request_failed',
          },
        });

        const errorResponse = new Response(errorBody, {
          status: response.status || 500,
          statusText: response.statusText || 'Internal Server Error',
          headers: new Headers({
            'content-type': 'application/json',
            ...(response.headers || {}),
          }),
        });
        resolve(errorResponse);
        return;
      }

      // Create successful response
      const successResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      resolve(successResponse);
    });
  });
}

/**
 * Create an OpenAI client with proxied fetch for CORS-restricted endpoints
 */
export function createProxiedOpenAIClient(config: OpenAICompatibleConfig): OpenAI {
  // Check if this endpoint requires proxying
  const requiresProxy = config.baseURL.startsWith('https://api.moonshot.cn');

  if (!requiresProxy) {
    // Use regular OpenAI client for non-proxied endpoints
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.headers,
      dangerouslyAllowBrowser: true,
    });
  }

  // Create OpenAI client with custom fetch
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.headers,
    dangerouslyAllowBrowser: true,
    fetch: proxiedFetch as typeof fetch, // Override fetch with our proxied version
  });
}

/**
 * Test connection using proxied fetch if needed
 */
export async function testProxiedConnection(config: OpenAICompatibleConfig): Promise<boolean> {
  try {
    const requiresProxy = config.baseURL.startsWith('https://api.moonshot.cn');

    // Try to get models list first (may not be supported by all providers)
    const modelsUrl = `${config.baseURL}/models`;
    const headers = {
      Authorization: `Bearer ${config.apiKey}`,
      ...config.headers,
    };

    try {
      if (requiresProxy) {
        // Use proxied fetch
        const response = await proxiedFetch(modelsUrl, {
          method: 'GET',
          headers,
        });
        if (response.ok) {
          return true;
        }
        // If 404, the models endpoint doesn't exist, try chat completion
        if (response.status === 404) {
          // Continue to fallback
        } else if (response.status === 401 || response.status === 403) {
          // Authentication failed
          return false;
        }
      } else {
        // Use regular fetch
        const response = await fetch(modelsUrl, {
          headers,
        });
        if (response.ok) {
          return true;
        }
      }
    } catch {
      // Models endpoint failed, try chat completion
    }

    // Fallback: Try a minimal chat completion
    const client = createProxiedOpenAIClient(config);
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: 'test' }],
      stream: false,
      max_tokens: 1,
    });

    return !!response.id;
  } catch (error) {
    // Silently fail for authentication errors during validation
    // These are expected when testing API keys
    return false;
  }
}
