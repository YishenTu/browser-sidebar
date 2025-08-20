// Content script - handles sidebar injection and communication with background

import { createMessage, isValidMessage, Message } from '@/types/messages';
import { MessageBus } from '@/utils/messaging';

let sidebarModule: { mountSidebar: () => void; unmountSidebar: () => void } | null = null;
let sidebarOpen = false;

// Initialize message bus for content script
const messageBus = new MessageBus('content');

// Function to inject or show sidebar
async function injectSidebar() {
  // Load the module if not already loaded
  if (!sidebarModule) {
    sidebarModule = await import('../sidebar/index');
  }

  // Mount the sidebar
  sidebarModule.mountSidebar();
  sidebarOpen = true;
  
  // Send confirmation back to background
  const response = createMessage('CONTENT_EXTRACTED', {
    status: 'sidebar-opened',
    timestamp: Date.now(),
  }, 'content');
  
  return response;
}

// Function to remove sidebar
function removeSidebar() {
  if (sidebarModule && sidebarOpen) {
    sidebarModule.unmountSidebar();
    sidebarOpen = false;
    
    // Send confirmation back to background
    const response = createMessage('CONTENT_EXTRACTED', {
      status: 'sidebar-closed',
      timestamp: Date.now(),
    }, 'content');
    
    return response;
  }
  
  return createMessage('ERROR', {
    error: 'Sidebar not open',
    code: 'SIDEBAR_NOT_OPEN',
  }, 'content');
}

// Listen for messages from background using typed protocol
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('Content script received message:', message);

  // Validate message structure
  if (!isValidMessage(message)) {
    console.error('Invalid message received:', message);
    sendResponse(createMessage('ERROR', {
      error: 'Invalid message format',
      code: 'INVALID_MESSAGE',
    }, 'content'));
    return true;
  }

  // Handle typed messages
  switch (message.type) {
    case 'TOGGLE_SIDEBAR':
      if (sidebarOpen) {
        const response = removeSidebar();
        sendResponse(response);
      } else {
        injectSidebar().then(response => {
          sendResponse(response);
        }).catch(error => {
          sendResponse(createMessage('ERROR', {
            error: error.message,
            code: 'INJECTION_FAILED',
          }, 'content'));
        });
      }
      break;
      
    case 'CLOSE_SIDEBAR':
      const closeResponse = removeSidebar();
      sendResponse(closeResponse);
      break;
      
    case 'PING':
      sendResponse(createMessage('PONG', {
        originalId: message.id,
        source: 'content',
      }, 'content'));
      break;
      
    default:
      sendResponse(createMessage('ERROR', {
        error: `Unknown message type: ${message.type}`,
        code: 'UNKNOWN_MESSAGE_TYPE',
      }, 'content'));
  }

  return true; // Keep channel open for async response
});

// Subscribe to specific message types using MessageBus
messageBus.subscribe(['EXTRACT_CONTENT'], async (message) => {
  // Future: Implement content extraction logic
  console.log('Content extraction requested:', message);
  
  return createMessage('CONTENT_EXTRACTED', {
    content: document.body.innerText.substring(0, 1000), // Sample extraction
    url: window.location.href,
    title: document.title,
  }, 'content');
});

// Notify background that content script is ready using typed message
const readyMessage = createMessage('CONTENT_EXTRACTED', {
  status: 'content-script-ready',
  url: window.location.href,
  title: document.title,
}, 'content');

chrome.runtime.sendMessage(readyMessage, response => {
  if (response && isValidMessage(response)) {
    console.log('Background acknowledged:', response);
  }
});

export {};