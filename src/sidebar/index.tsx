import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Sidebar } from './Sidebar';
import globalStyles from '../styles/globals.css?inline';
import sidebarStyles from './styles/sidebar.css?inline';
// Theme is applied inside Sidebar.tsx via settings store effect

let root: ReactDOM.Root | null = null;
let keydownListener: ((e: KeyboardEvent) => void) | null = null;
let shadowRoot: ShadowRoot | null = null;

export function mountSidebar() {
  // Remove any existing sidebar
  unmountSidebar();

  // Create host container element
  const hostContainer = document.createElement('div');
  hostContainer.id = 'ai-browser-sidebar-host';
  // Host container is fixed positioned to overlay without affecting page layout
  hostContainer.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
    z-index: 2147483646 !important;
  `;
  document.body.appendChild(hostContainer);

  // Create Shadow DOM for complete isolation
  shadowRoot = hostContainer.attachShadow({ mode: 'open' });

  // Inject styles into Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    ${globalStyles}
    ${sidebarStyles}
    /* Ensure the React root container doesn't interfere */
    #ai-browser-sidebar-root {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;
  shadowRoot.appendChild(style);

  // Create container element inside Shadow DOM
  const container = document.createElement('div');
  container.id = 'ai-browser-sidebar-root';
  shadowRoot.appendChild(container);

  // Theme is applied by the Sidebar component effect

  // Create React root and render synchronously for deterministic tests
  root = ReactDOM.createRoot(container);
  flushSync(() => {
    root!.render(
      <React.StrictMode>
        <Sidebar />
      </React.StrictMode>
    );
  });

  // Attach a global Escape key handler to support tests that assert listener wiring
  if (!keydownListener) {
    keydownListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        unmountSidebar();
        try {
          // Best-effort notify background (content script may also send)
          chrome.runtime?.sendMessage?.({ type: 'sidebar-closed' });
        } catch (_) {
          // ignore in tests
        }
      }
    };
    document.addEventListener('keydown', keydownListener);
  }
}

export function unmountSidebar() {
  // Unmount React root
  if (root) {
    root.unmount();
    root = null;
  }

  // Clear shadow root reference
  shadowRoot = null;

  // Remove the host container (which includes the shadow DOM)
  const hostContainer = document.getElementById('ai-browser-sidebar-host');
  if (hostContainer) {
    hostContainer.remove();
  }

  // Remove global keydown listener if present
  if (keydownListener) {
    document.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
}
