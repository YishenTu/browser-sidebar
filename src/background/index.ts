console.log('Background service worker initialized');

// Track sidebar state per tab
const sidebarStates = new Map<number, boolean>();

chrome.runtime.onInstalled.addListener(details => {
  console.log('Extension installed:', details);
});

// Handle extension icon click
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;

  // Check if this is a restricted page
  if (
    tab.url?.startsWith('chrome://') ||
    tab.url?.startsWith('chrome-extension://') ||
    tab.url?.startsWith('edge://') ||
    tab.url?.startsWith('about:') ||
    tab.url?.startsWith('file://')
  ) {
    console.log('Cannot inject sidebar on browser pages');
    return;
  }

  // Get current state for this tab
  const isOpen = sidebarStates.get(tab.id) || false;

  try {
    // Try to send message to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: isOpen ? 'close-sidebar' : 'toggle-sidebar',
    });

    // Update state
    sidebarStates.set(tab.id, !isOpen);
  } catch (error) {
    // Content script not loaded - this happens when the page was loaded before the extension
    console.log(
      'Content script not loaded. This page needs to be refreshed for the sidebar to work.'
    );

    // Note: Dynamic injection of content scripts is complex with Vite/CRXJS
    // The manifest handles injection for new pages
    // For existing pages, a refresh is required
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message, 'from:', sender);

  if (message.type === 'sidebar-closed' && sender.tab?.id) {
    // Update state when sidebar is closed via X button
    sidebarStates.set(sender.tab.id, false);
  }

  sendResponse({ status: 'received' });
  return true;
});

// Clean up state when tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
  sidebarStates.delete(tabId);
});

export {};
