/**
 * @file Chrome Runtime Wrapper
 *
 * Provides strongly typed wrappers around chrome.runtime APIs with:
 * - Type-safe message passing
 * - Error normalization
 * - Event helper utilities
 * - Async/await support where applicable
 */

import type { TypedMessage } from '@/types/messages';

/**
 * Normalized Chrome runtime error
 */
export class ChromeRuntimeError extends Error {
  public readonly code: string;
  public readonly originalError?: chrome.runtime.LastError;

  constructor(
    message: string,
    code: string = 'RUNTIME_ERROR',
    originalError?: chrome.runtime.LastError
  ) {
    super(message);
    this.name = 'ChromeRuntimeError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Response wrapper for sendMessage operations
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ChromeRuntimeError;
}

/**
 * Options for sendMessage operations
 */
export interface SendMessageOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Tab ID for tab-specific messages */
  tabId?: number;
}

/**
 * Event listener options
 */
export interface EventListenerOptions {
  /** Whether to handle errors automatically */
  handleErrors?: boolean;
  /** Error handler function */
  onError?: (error: ChromeRuntimeError) => void;
}

/**
 * Type-safe event listener function
 */
export type MessageListener<T extends TypedMessage = TypedMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void | Promise<unknown>;

/**
 * Get the current extension ID in a safe way
 */
export function getExtensionId(): string {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Normalized Chrome runtime error from chrome.runtime.lastError
 */
export function normalizeRuntimeError(
  fallbackMessage: string = 'Unknown runtime error',
  code: string = 'RUNTIME_ERROR'
): ChromeRuntimeError {
  const chromeError = chrome.runtime.lastError;
  if (chromeError) {
    return new ChromeRuntimeError(chromeError.message || fallbackMessage, code, chromeError);
  }
  return new ChromeRuntimeError(fallbackMessage, code);
}

/**
 * Check if runtime error occurred and throw normalized error
 */
export function checkRuntimeError(context: string = 'Runtime operation'): void {
  if (chrome.runtime.lastError) {
    throw normalizeRuntimeError(`${context} failed: ${chrome.runtime.lastError.message}`);
  }
}

/**
 * Type-safe wrapper for chrome.runtime.sendMessage with timeout and error handling
 */
export function sendMessage<TMessage extends TypedMessage, TResponse = unknown>(
  message: TMessage,
  options: SendMessageOptions = {}
): Promise<MessageResponse<TResponse>> {
  const { timeout = 10000, tabId } = options;

  return new Promise(resolve => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: new ChromeRuntimeError('Message timeout', 'TIMEOUT'),
      });
    }, timeout);

    const callback = (response: TResponse) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: normalizeRuntimeError(
            `Failed to send message: ${chrome.runtime.lastError.message}`
          ),
        });
        return;
      }

      resolve({
        success: true,
        data: response,
      });
    };

    try {
      if (tabId !== undefined) {
        chrome.tabs.sendMessage(tabId, message, callback);
      } else {
        chrome.runtime.sendMessage(message, callback);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: new ChromeRuntimeError(
          `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
          'SEND_ERROR'
        ),
      });
    }
  });
}

/**
 * Async wrapper for chrome.runtime.sendMessage that throws on error
 */
export async function sendMessageAsync<TMessage extends TypedMessage, TResponse = unknown>(
  message: TMessage,
  options: SendMessageOptions = {}
): Promise<TResponse> {
  const result = await sendMessage<TMessage, TResponse>(message, options);

  if (!result.success || result.error) {
    throw result.error || new ChromeRuntimeError('Message failed without specific error');
  }

  return result.data as TResponse;
}

/**
 * Type-safe wrapper for chrome.runtime.onMessage.addListener
 */
export function addMessageListener<T extends TypedMessage = TypedMessage>(
  listener: MessageListener<T>,
  options: EventListenerOptions = {}
): () => void {
  const { handleErrors = true, onError } = options;

  const wrappedListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    try {
      const result = listener(message as T, sender, sendResponse);

      // Handle async listeners
      if (result instanceof Promise) {
        result.catch(error => {
          if (handleErrors) {
            const runtimeError =
              error instanceof ChromeRuntimeError
                ? error
                : new ChromeRuntimeError(
                    `Message handler error: ${error.message || String(error)}`,
                    'HANDLER_ERROR'
                  );

            if (onError) {
              onError(runtimeError);
            }
          }
        });
        return true; // Keep message channel open for async response
      }

      return result;
    } catch (error) {
      if (handleErrors) {
        const runtimeError =
          error instanceof ChromeRuntimeError
            ? error
            : new ChromeRuntimeError(
                `Message handler error: ${error instanceof Error ? error.message : String(error)}`,
                'HANDLER_ERROR'
              );

        if (onError) {
          onError(runtimeError);
        }
      }
      return false;
    }
  };

  chrome.runtime.onMessage.addListener(wrappedListener);

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(wrappedListener);
  };
}

/**
 * Type-safe wrapper for chrome.runtime.onInstalled event
 */
export function addInstalledListener(
  listener: (details: chrome.runtime.InstalledDetails) => void | Promise<void>,
  options: EventListenerOptions = {}
): () => void {
  const { handleErrors = true, onError } = options;

  const wrappedListener = async (details: chrome.runtime.InstalledDetails) => {
    try {
      await listener(details);
    } catch (error) {
      if (handleErrors) {
        const runtimeError =
          error instanceof ChromeRuntimeError
            ? error
            : new ChromeRuntimeError(
                `Installed handler error: ${error instanceof Error ? error.message : String(error)}`,
                'INSTALLED_HANDLER_ERROR'
              );

        if (onError) {
          onError(runtimeError);
        }
      }
    }
  };

  chrome.runtime.onInstalled.addListener(wrappedListener);

  return () => {
    chrome.runtime.onInstalled.removeListener(wrappedListener);
  };
}

/**
 * Type-safe wrapper for chrome.runtime.onStartup event
 */
export function addStartupListener(
  listener: () => void | Promise<void>,
  options: EventListenerOptions = {}
): () => void {
  const { handleErrors = true, onError } = options;

  const wrappedListener = async () => {
    try {
      await listener();
    } catch (error) {
      if (handleErrors) {
        const runtimeError =
          error instanceof ChromeRuntimeError
            ? error
            : new ChromeRuntimeError(
                `Startup handler error: ${error instanceof Error ? error.message : String(error)}`,
                'STARTUP_HANDLER_ERROR'
              );

        if (onError) {
          onError(runtimeError);
        }
      }
    }
  };

  chrome.runtime.onStartup.addListener(wrappedListener);

  return () => {
    chrome.runtime.onStartup.removeListener(wrappedListener);
  };
}

/**
 * Type-safe wrapper for chrome.runtime.onConnect event
 */
export function addConnectListener(
  listener: (port: chrome.runtime.Port) => void,
  options: EventListenerOptions = {}
): () => void {
  const { handleErrors = true, onError } = options;

  const wrappedListener = (port: chrome.runtime.Port) => {
    try {
      listener(port);
    } catch (error) {
      if (handleErrors) {
        const runtimeError =
          error instanceof ChromeRuntimeError
            ? error
            : new ChromeRuntimeError(
                `Connect handler error: ${error instanceof Error ? error.message : String(error)}`,
                'CONNECT_HANDLER_ERROR'
              );

        if (onError) {
          onError(runtimeError);
        }
      }
    }
  };

  chrome.runtime.onConnect.addListener(wrappedListener);

  return () => {
    chrome.runtime.onConnect.removeListener(wrappedListener);
  };
}

/**
 * Safe wrapper for chrome.runtime.connect with error handling
 */
export function connect(connectInfo?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
  try {
    const port = chrome.runtime.connect(connectInfo);

    // Add error handling to port
    port.onDisconnect.addListener(() => {
      checkRuntimeError('Port connection');
    });

    return port;
  } catch (error) {
    throw new ChromeRuntimeError(
      `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      'CONNECT_ERROR'
    );
  }
}

/**
 * Safe wrapper for chrome.runtime.getManifest
 */
export function getManifest(): chrome.runtime.Manifest {
  try {
    return chrome.runtime.getManifest();
  } catch (error) {
    throw new ChromeRuntimeError(
      `Failed to get manifest: ${error instanceof Error ? error.message : String(error)}`,
      'MANIFEST_ERROR'
    );
  }
}

/**
 * Safe wrapper for chrome.runtime.getURL
 */
export function getURL(path: string): string {
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    throw new ChromeRuntimeError(
      `Failed to get URL for path "${path}": ${error instanceof Error ? error.message : String(error)}`,
      'URL_ERROR'
    );
  }
}

/**
 * Safe wrapper for chrome.runtime.getPlatformInfo
 */
export async function getPlatformInfo(): Promise<chrome.runtime.PlatformInfo> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.getPlatformInfo(info => {
        if (chrome.runtime.lastError) {
          reject(normalizeRuntimeError('Failed to get platform info'));
          return;
        }
        resolve(info);
      });
    } catch (error) {
      reject(
        new ChromeRuntimeError(
          `Failed to get platform info: ${error instanceof Error ? error.message : String(error)}`,
          'PLATFORM_INFO_ERROR'
        )
      );
    }
  });
}

/**
 * Utility to create a message-specific sender function
 */
export function createMessageSender<TMessage extends TypedMessage, TResponse = unknown>(
  messageDefaults: Partial<TMessage> = {},
  defaultOptions: SendMessageOptions = {}
) {
  return (
    message: Omit<TMessage, keyof typeof messageDefaults>,
    options: SendMessageOptions = {}
  ) => {
    const fullMessage = { ...messageDefaults, ...message } as TMessage;
    const fullOptions = { ...defaultOptions, ...options };
    return sendMessage<TMessage, TResponse>(fullMessage, fullOptions);
  };
}

/**
 * Utility to wait for extension context to be ready
 */
export async function waitForExtensionContext(maxWaitTime: number = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      if (chrome?.runtime?.id) {
        // Test with a simple runtime call
        await getPlatformInfo();
        return true;
      }
    } catch (error) {
      // Extension context not ready, continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Check if we're running in an extension context
 */
export function isExtensionContext(): boolean {
  try {
    return !!chrome?.runtime?.id;
  } catch {
    return false;
  }
}

// Re-export commonly used types for convenience
export type { TypedMessage } from '@/types/messages';
