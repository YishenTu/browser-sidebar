console.log('Content script loaded on:', window.location.href);

chrome.runtime.sendMessage({ type: 'content-loaded', url: window.location.href }, response => {
  console.log('Background response:', response);
});

export {};
