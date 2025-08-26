/* eslint-disable no-console */
// Content script - handles sidebar injection and communication with background

import { createMessage, isValidMessage, Message } from '@/types/messages';

// Early injection: Patch document.querySelector to intercept link lookups
const originalQuerySelector = document.querySelector;
document.querySelector = function (selector: string) {
  // If looking for a link with an assets path, convert to extension URL
  if (selector && selector.includes('link[href=') && selector.includes('/assets/')) {
    const match = selector.match(/link\[href="([^"]+)"\]/);
    if (match && match[1]) {
      const path = match[1];
      if (path.startsWith('/assets/')) {
        const extensionUrl = chrome.runtime.getURL(path.substring(1));
        selector = selector.replace(path, extensionUrl);
      }
    }
  }
  return originalQuerySelector.call(document, selector);
} as typeof document.querySelector;

// Override createElement to intercept dynamic link/script creation
const originalCreateElement = document.createElement;
document.createElement = function (tagName: string) {
  const element = originalCreateElement.call(document, tagName);

  // Intercept dynamic link/script elements
  if (tagName === 'link' || tagName === 'script') {
    // Override the href/src property directly
    if (tagName === 'link') {
      let hrefValue = '';
      Object.defineProperty(element, 'href', {
        set: function (value: string) {
          hrefValue = value;
          // Convert to extension URL if it's an asset path
          if (value && value.startsWith('/assets/')) {
            value = chrome.runtime.getURL(value.substring(1));
          } else if (
            value &&
            value.includes('assets/') &&
            !value.startsWith('chrome-extension://') &&
            !value.startsWith('http')
          ) {
            const assetPath = value.startsWith('/') ? value.substring(1) : value;
            value = chrome.runtime.getURL(assetPath);
          }
          (element as HTMLLinkElement).setAttribute('href', value);
        },
        get: function () {
          return hrefValue;
        },
        configurable: true,
      });
    } else if (tagName === 'script') {
      let srcValue = '';
      Object.defineProperty(element, 'src', {
        set: function (value: string) {
          srcValue = value;
          // Convert to extension URL if it's an asset path
          if (value && value.startsWith('/assets/')) {
            value = chrome.runtime.getURL(value.substring(1));
          } else if (
            value &&
            value.includes('assets/') &&
            !value.startsWith('chrome-extension://') &&
            !value.startsWith('http')
          ) {
            const assetPath = value.startsWith('/') ? value.substring(1) : value;
            value = chrome.runtime.getURL(assetPath);
          }
          (element as HTMLScriptElement).setAttribute('src', value);
        },
        get: function () {
          return srcValue;
        },
        configurable: true,
      });
    }
  }

  return element;
};

let sidebarModule: { mountSidebar: () => void; unmountSidebar: () => void } | null = null;
let sidebarOpen = false;

// MessageBus available if needed in future
// const messageBus = MessageBus.getInstance('content');

// Function to inject or show sidebar
async function injectSidebar() {
  // Load the module if not already loaded
  if (!sidebarModule) {
    // Dynamic import with proper URL resolution will be handled by Vite/CRXJS
    sidebarModule = await import('../sidebar/index');
  }

  // Mount the sidebar
  sidebarModule.mountSidebar();
  sidebarOpen = true;

  // Send confirmation back to background
  return createMessage({
    type: 'SIDEBAR_STATE',
    payload: {
      status: 'sidebar-opened',
      timestamp: Date.now(),
    },
    source: 'content',
    target: 'background',
  });
}

// Function to remove sidebar
function removeSidebar() {
  if (sidebarModule && sidebarOpen) {
    sidebarModule.unmountSidebar();
    sidebarOpen = false;

    // Send confirmation back to background
    return createMessage({
      type: 'SIDEBAR_STATE',
      payload: {
        status: 'sidebar-closed',
        timestamp: Date.now(),
      },
      source: 'content',
      target: 'background',
    });
  }

  return createMessage({
    type: 'ERROR',
    payload: {
      message: 'Sidebar not open',
      code: 'SIDEBAR_NOT_OPEN',
    },
    source: 'content',
    target: 'background',
  });
}

// Listen for messages from background using typed protocol
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  // Removed console.log for cleaner output

  // Validate message structure
  if (!isValidMessage(message)) {
    console.error('Invalid message received:', message);
    sendResponse(
      createMessage({
        type: 'ERROR',
        payload: { message: 'Invalid message format', code: 'INVALID_MESSAGE' },
        source: 'content',
        target: 'background',
      })
    );
    return true;
  }

  // Handle typed messages
  switch (message.type) {
    case 'TOGGLE_SIDEBAR': {
      // Check if we have an explicit show/hide directive
      const explicitShow = (message.payload as { show?: boolean })?.show;

      if (explicitShow !== undefined) {
        // Explicit show/hide command
        if (explicitShow && !sidebarOpen) {
          // Show sidebar
          injectSidebar()
            .then(response => {
              sendResponse(response);
            })
            .catch((error: unknown) => {
              sendResponse(
                createMessage({
                  type: 'ERROR',
                  payload: {
                    message: error instanceof Error ? error.message : String(error),
                    code: 'INJECTION_FAILED',
                  },
                  source: 'content',
                  target: 'background',
                })
              );
            });
        } else if (!explicitShow && sidebarOpen) {
          // Hide sidebar
          const response = removeSidebar();
          sendResponse(response);
        } else {
          // Already in the desired state
          sendResponse(
            createMessage({
              type: 'SIDEBAR_STATE',
              payload: {
                status: sidebarOpen ? 'sidebar-already-open' : 'sidebar-already-closed',
                timestamp: Date.now(),
              },
              source: 'content',
              target: 'background',
            })
          );
        }
      } else {
        // Toggle behavior (no explicit show/hide)
        if (sidebarOpen) {
          const response = removeSidebar();
          sendResponse(response);
        } else {
          injectSidebar()
            .then(response => {
              sendResponse(response);
            })
            .catch((error: unknown) => {
              sendResponse(
                createMessage({
                  type: 'ERROR',
                  payload: {
                    message: error instanceof Error ? error.message : String(error),
                    code: 'INJECTION_FAILED',
                  },
                  source: 'content',
                  target: 'background',
                })
              );
            });
        }
      }
      break;
    }

    case 'CLOSE_SIDEBAR': {
      const closeResponse = removeSidebar();
      sendResponse(closeResponse);
      break;
    }

    case 'EXTRACT_CONTENT': {
      // Handle content extraction request with enhanced error handling
      (async () => {
        try {
          // Import extraction modules with better error handling
          const { extractContent } = await import('./contentExtractor');
          const { isExtractionOptions, validateExtractionOptions } = await import(
            '../types/extraction'
          );

          // Validate and normalize extraction options
          let extractionOptions = undefined;
          if (message.payload && typeof message.payload === 'object') {
            if (isExtractionOptions(message.payload)) {
              extractionOptions = validateExtractionOptions(message.payload);
            } else {
              console.warn('Invalid extraction options provided, using defaults:', message.payload);
            }
          }

          // Perform extraction with validated options
          const extractedContent = await extractContent(extractionOptions);

          // Map ExtractedContent to ContentExtractedPayload format for compatibility
          const responsePayload = {
            text: extractedContent.content, // Map content to text for backward compatibility
            title: extractedContent.title,
            url: extractedContent.url,
            metadata: {
              domain: extractedContent.domain,
              author: extractedContent.author,
              publishedDate: extractedContent.publishedDate,
              extractedAt: extractedContent.extractedAt,
              extractionMethod: extractedContent.extractionMethod,
              textContent: extractedContent.textContent,
              excerpt: extractedContent.excerpt,
              ...extractedContent.metadata,
              // Include backward compatibility fields
              wordCount: extractedContent.metadata?.wordCount || extractedContent.wordCount,
              hasCodeBlocks: extractedContent.metadata?.hasCodeBlocks || extractedContent.hasCode,
              hasTables: extractedContent.metadata?.hasTables || extractedContent.hasTables,
              truncated: extractedContent.metadata?.truncated || extractedContent.isTruncated,
            },
          };

          sendResponse(
            createMessage({
              type: 'CONTENT_EXTRACTED',
              payload: responsePayload,
              source: 'content',
              target: message.source,
            })
          );
        } catch (error) {
          // Enhanced error classification and reporting
          let errorCode = 'EXTRACTION_FAILED';
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Classify specific error types for better handling
          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('timeout')) {
              errorCode = 'EXTRACTION_TIMEOUT';
            } else if (msg.includes('network') || msg.includes('loading')) {
              errorCode = 'EXTRACTION_NETWORK_ERROR';
            } else if (msg.includes('dom') || msg.includes('document')) {
              errorCode = 'EXTRACTION_DOM_ERROR';
            } else if (msg.includes('memory')) {
              errorCode = 'EXTRACTION_MEMORY_ERROR';
            } else if (msg.includes('parsing')) {
              errorCode = 'EXTRACTION_PARSING_ERROR';
            }
          }

          console.error(`Content extraction failed [${errorCode}]:`, error);

          sendResponse(
            createMessage({
              type: 'ERROR',
              payload: {
                message: errorMessage,
                code: errorCode,
                details: {
                  timestamp: Date.now(),
                  url: typeof window !== 'undefined' ? window.location?.href : undefined,
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                },
              },
              source: 'content',
              target: message.source,
            })
          );
        }
      })();
      break;
    }

    case 'PING':
      sendResponse(
        createMessage({
          type: 'PONG',
          payload: { originalId: message.id, source: 'content' },
          source: 'content',
          target: 'background',
        })
      );
      break;

    default:
      sendResponse(
        createMessage({
          type: 'ERROR',
          payload: {
            message: `Unknown message type: ${message.type}`,
            code: 'UNKNOWN_MESSAGE_TYPE',
          },
          source: 'content',
          target: 'background',
        })
      );
  }

  return true; // Keep channel open for async response
});

// MessageBus instance available for future use if needed

// Notify background that content script is ready using typed message
const readyMessage = createMessage({
  type: 'CONTENT_READY',
  payload: {
    status: 'content-script-ready',
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
  },
  source: 'content',
  target: 'background',
});

chrome.runtime.sendMessage(readyMessage, response => {
  if (response && isValidMessage(response)) {
    // Background acknowledged - no need to log
  }
});

export {};
