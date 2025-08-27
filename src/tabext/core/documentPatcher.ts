/**
 * @file Document Patcher
 *
 * Patches document methods to intercept and convert asset paths to extension URLs.
 * This ensures that dynamically created links and scripts use proper extension URLs.
 */

/**
 * Patches document.querySelector to intercept link lookups with asset paths
 */
function patchQuerySelector(): void {
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
}

/**
 * Patches document.createElement to intercept dynamic link/script creation
 */
function patchCreateElement(): void {
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
}

/**
 * Initializes all document patches
 * Should be called early in the content script lifecycle
 */
export function initializeDocumentPatches(): void {
  patchQuerySelector();
  patchCreateElement();
}
