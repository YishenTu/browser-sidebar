/**
 * Proxy handler for CORS-restricted API endpoints
 *
 * Routes API requests through the background service worker to bypass CORS restrictions
 */

// No typed message imports required here

export interface ProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  error?: string;
}

/**
 * List of API endpoints that require proxying due to CORS restrictions
 */
const CORS_RESTRICTED_APIS = [
  'https://api.moonshot.cn', // Kimi API
];

/**
 * Check if a URL requires proxying
 */
export function requiresProxy(url: string): boolean {
  return CORS_RESTRICTED_APIS.some(api => url.startsWith(api));
}

/**
 * Handle proxy request from content script
 */
export async function handleProxyRequest(
  request: ProxyRequest,
  _sender: chrome.runtime.MessageSender
): Promise<ProxyResponse> {
  try {
    // Validate that the URL is allowed for proxying
    if (!requiresProxy(request.url)) {
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        error: 'URL not allowed for proxying',
      };
    }

    // Make the actual request from background service worker
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: request.headers,
    };

    // Only add body for non-GET requests
    if (request.method !== 'GET' && request.body) {
      fetchOptions.body = request.body;
    }

    const response = await fetch(request.url, fetchOptions);

    // Read response body
    const responseBody = await response.text();

    // Extract headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      headers: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle streaming proxy via chrome.runtime Port.
 *
 * The sidebar/content side opens a port named 'proxy-stream' and sends a
 * single ProxyRequest. We perform the fetch here and stream response body
 * chunks back over the same port.
 */
export function handleProxyStreamPort(port: chrome.runtime.Port): void {
  const disconnectWithError = (message: string, extra?: Record<string, unknown>) => {
    try {
      port.postMessage({ type: 'error', message, ...(extra || {}) });
    } finally {
      try {
        port.disconnect();
      } catch {
        /* ignore errors */
      }
    }
  };

  port.onMessage.addListener(async (request: ProxyRequest) => {
    try {
      if (!request || !requiresProxy(request.url)) {
        disconnectWithError('URL not allowed for proxying');
        return;
      }

      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? request.body : undefined,
      };

      const response = await fetch(request.url, fetchOptions);

      // Send initial metadata
      const metaHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => (metaHeaders[key] = value));

      if (!response.ok) {
        disconnectWithError('Upstream error', {
          status: response.status,
          statusText: response.statusText,
          headers: metaHeaders,
        });
        return;
      }

      port.postMessage({
        type: 'start',
        status: response.status,
        statusText: response.statusText,
        headers: metaHeaders,
      });

      const reader = response.body?.getReader();
      if (!reader) {
        disconnectWithError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let streaming = true;
      while (streaming) {
        const { done, value } = await reader.read();
        if (done) {
          streaming = false;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        port.postMessage({ type: 'chunk', chunk });
      }

      port.postMessage({ type: 'end' });
      try {
        port.disconnect();
      } catch {
        /* ignore errors */
      }
    } catch (err) {
      disconnectWithError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
