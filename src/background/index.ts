console.log('Background service worker initialized');

chrome.runtime.onInstalled.addListener(details => {
  console.log('Extension installed:', details);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message, 'from:', sender);
  sendResponse({ status: 'received' });
  return true;
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error('Failed to set panel behavior:', error));

export {};
