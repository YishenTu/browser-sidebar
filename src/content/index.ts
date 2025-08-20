// Content script - handles sidebar injection and communication with background

let sidebarModule: { mountSidebar: () => void; unmountSidebar: () => void } | null = null;
let sidebarOpen = false;

// Function to inject or show sidebar
async function injectSidebar() {
  // Load the module if not already loaded
  if (!sidebarModule) {
    sidebarModule = await import('../sidebar/index');
  }

  // Mount the sidebar
  sidebarModule.mountSidebar();
  sidebarOpen = true;
}

// Function to remove sidebar
function removeSidebar() {
  if (sidebarModule && sidebarOpen) {
    sidebarModule.unmountSidebar();
    sidebarOpen = false;
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.type === 'toggle-sidebar') {
    injectSidebar();
    sendResponse({ status: 'sidebar-injected' });
  } else if (message.type === 'close-sidebar') {
    removeSidebar();
    sendResponse({ status: 'sidebar-closed' });
  }

  return true;
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'content-loaded', url: window.location.href }, response => {
  console.log('Background response:', response);
});

export {};
