/**
 * @file Background Service Worker
 *
 * Main entry point for the extension's background service worker.
 * Initializes all subsystems and handles core extension functionality.
 */

import { createDefaultMessageHandler } from './messageHandler';
import { startKeepAlive } from './keepAlive';
import { getSidebarManager } from './sidebarManager';
import { createMessage, Message, ToggleSidebarPayload } from '@/types/messages';
import { handleProxyRequest, ProxyRequest, handleProxyStreamPort } from './proxyHandler';
import {
  addInstalledListener,
  addMessageListener,
  addConnectListener,
  addStartupListener,
  getManifest,
} from '@platform/chrome/runtime';
import { setMultiple } from '@platform/chrome/storage';
import { addClickedListener } from '@platform/chrome/action';

// Initialize subsystems
const messageHandler = createDefaultMessageHandler();
const sidebarManager = getSidebarManager({ verbose: true });

/**
 * Initialize the service worker and set up all handlers
 */
function initializeServiceWorker(): void {
  // Register sidebar-related message handlers
  messageHandler.registerHandler(
    'TOGGLE_SIDEBAR',
    (message, sender) =>
      sidebarManager.handleToggleSidebar(message as Message<ToggleSidebarPayload>, sender),
    'Toggle sidebar visibility'
  );

  messageHandler.registerHandler(
    'CLOSE_SIDEBAR',
    (message, sender) => sidebarManager.handleCloseSidebar(message as Message<void>, sender),
    'Close sidebar'
  );

  // Register proxy handlers for CORS-restricted APIs
  messageHandler.registerHandler(
    'PROXY_REQUEST',
    async (message, sender) => handleProxyRequest(message.payload as ProxyRequest, sender),
    'Proxy API request through background'
  );

  // Start keep-alive system to prevent service worker suspension
  startKeepAlive({
    interval: 20000, // 20 seconds
    verbose: false, // Set to true for debugging
  });
}

/**
 * Handle extension installation and updates
 */
addInstalledListener(async _details => {
  try {
    // Set default extension settings
    await setMultiple({
      'extension-version': getManifest().version,
      'install-timestamp': Date.now(),
      'sidebar-settings': {
        defaultWidth: 400,
        defaultPosition: 'right',
        rememberState: true,
      },
    });
  } catch (error) {
    // Error during installation setup
  }
});

/**
 * Handle extension icon click - toggle sidebar
 */
addClickedListener(async tab => {
  if (!tab.id) return;
  const toggleMessage = createMessage<ToggleSidebarPayload>({
    type: 'TOGGLE_SIDEBAR',
    source: 'background',
    target: 'content',
  });
  await sidebarManager.handleToggleSidebar(toggleMessage, { tab });
});

/**
 * Handle messages from content script and other components
 */
addMessageListener((message, sender, sendResponse) => {
  // Handle the message through the message handler registry
  messageHandler.handleMessage(message, sender, sendResponse);

  // Return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Handle long-lived proxy streaming connections
 */
addConnectListener(port => {
  if (port.name === 'proxy-stream') {
    handleProxyStreamPort(port);
  }
});

/**
 * Handle service worker startup
 */
addStartupListener(() => {
  initializeServiceWorker();
});

/**
 * Handle service worker suspension (for debugging)
 */

// Initialize the service worker
initializeServiceWorker();

export {};
