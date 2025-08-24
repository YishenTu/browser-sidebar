/* eslint-disable no-console */
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

console.log('Background service worker initialized');

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

  // Start keep-alive system to prevent service worker suspension
  const keepAliveStarted = startKeepAlive({
    interval: 20000, // 20 seconds
    verbose: false, // Set to true for debugging
  });

  if (keepAliveStarted) {
    console.log('Keep-alive system started');
  } else {
    console.warn('Keep-alive system failed to start');
  }

  console.log('Service worker initialization complete');
  console.log('Registered message types:', messageHandler.getRegisteredTypes());
}

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener(async details => {
  console.log('Extension installed/updated:', details);

  try {
    // Set default extension settings
    await chrome.storage.local.set({
      'extension-version': chrome.runtime.getManifest().version,
      'install-timestamp': Date.now(),
      'sidebar-settings': {
        defaultWidth: 400,
        defaultPosition: 'right',
        rememberState: true,
      },
    });

    console.log('Default settings initialized');

    // Show installation/update notification if needed
    if (details.reason === 'install') {
      console.log('Extension installed for the first time');
    } else if (details.reason === 'update') {
      console.log('Extension updated from version:', details.previousVersion);
    }
  } catch (error) {
    console.error('Error during installation setup:', error);
  }
});

/**
 * Handle extension icon click - toggle sidebar
 */
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) {
    console.warn('No tab ID available for action click');
    return;
  }

  console.log('Extension icon clicked for tab:', tab.id);

  try {
    // Create a toggle sidebar message
    const toggleMessage = createMessage<ToggleSidebarPayload>({
      type: 'TOGGLE_SIDEBAR',
      source: 'background',
      target: 'content',
    });

    // Handle through sidebar manager (which will handle content script injection if needed)
    await sidebarManager.handleToggleSidebar(toggleMessage, { tab });
  } catch (error) {
    console.error('Error handling extension icon click:', error);
  }
});

/**
 * Handle messages from content script and other components
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle the message through the message handler registry
  messageHandler.handleMessage(message, sender, sendResponse);

  // Return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Handle service worker startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
  initializeServiceWorker();
});

/**
 * Handle service worker suspension (for debugging)
 */
self.addEventListener('beforeunload', () => {
  console.log('Service worker being suspended');
});

// Initialize the service worker
initializeServiceWorker();

export {};
