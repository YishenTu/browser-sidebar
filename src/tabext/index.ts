/* eslint-disable no-console */
// Content script - handles sidebar injection and communication with background

import { createMessage, isValidMessage, Message } from '@/types/messages';
import { MessageBus } from '@core/messaging';

// Patch Vite's dynamic import helper to use chrome.runtime.getURL
// This fixes the issue where dynamic imports try to load from the current page's domain
declare global {
  var __vite__mapDeps: any;
}

if (typeof (globalThis as any).__vite__mapDeps === 'function') {
  const originalMapDeps = (globalThis as any).__vite__mapDeps;
  (globalThis as any).__vite__mapDeps = function(indexes: number[], mapDepsParam?: any, filePaths?: any) {
    // Override the path resolution function
    if (mapDepsParam && mapDepsParam.f && Array.isArray(mapDepsParam.f)) {
      mapDepsParam.f = mapDepsParam.f.map((path: string) => {
        // Convert relative paths to extension URLs
        if (path.startsWith('assets/')) {
          return chrome.runtime.getURL(path);
        }
        return path;
      });
    }
    return originalMapDeps.call(this, indexes, mapDepsParam, filePaths);
  };
}

let sidebarModule: { mountSidebar: () => void; unmountSidebar: () => void } | null = null;
let sidebarOpen = false;

// Initialize message bus for content script explicitly
const messageBus = MessageBus.getInstance('content');

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
  console.log('Content script received message:', message);

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
    case 'TOGGLE_SIDEBAR':
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
      break;

    case 'CLOSE_SIDEBAR': {
      const closeResponse = removeSidebar();
      sendResponse(closeResponse);
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

// Subscribe to specific message types using MessageBus
messageBus.subscribe('EXTRACT_CONTENT', async (): Promise<void> => {
  // Future: Implement content extraction logic
  // For now, just log the event
  console.log('Content extraction requested');
});

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
    console.log('Background acknowledged:', response);
  }
});

export {};
