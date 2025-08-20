import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Sidebar } from './Sidebar';
import globalStyles from '../styles/globals.css?inline';
// Theme is applied inside Sidebar.tsx via settings store effect

let root: ReactDOM.Root | null = null;
let keydownListener: ((e: KeyboardEvent) => void) | null = null;

export function mountSidebar() {
  // Remove any existing sidebar
  unmountSidebar();

  // Inject styles if not already present
  if (!document.getElementById('ai-browser-sidebar-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-browser-sidebar-styles';
    style.textContent = globalStyles;
    document.head.appendChild(style);
  }

  // Create container element
  const container = document.createElement('div');
  container.id = 'ai-browser-sidebar-root';
  document.body.appendChild(container);

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
  const container = document.getElementById('ai-browser-sidebar-root');
  if (container) {
    if (root) {
      root.unmount();
      root = null;
    }
    container.remove();
  }

  // Don't remove styles - keep them for reuse
  // const styles = document.getElementById('ai-browser-sidebar-styles');
  // if (styles) {
  //   styles.remove();
  // }

  // Remove global keydown listener if present
  if (keydownListener) {
    document.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
}
