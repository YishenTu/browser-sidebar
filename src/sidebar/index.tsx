import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar } from './Sidebar';
// CSS will be injected inline to avoid loading issues

let root: ReactDOM.Root | null = null;

export function mountSidebar() {
  // Remove any existing sidebar
  unmountSidebar();

  // Inject styles if not already present
  if (!document.getElementById('ai-browser-sidebar-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-browser-sidebar-styles';
    style.textContent = getSidebarStyles();
    document.head.appendChild(style);
  }

  // Create container element
  const container = document.createElement('div');
  container.id = 'ai-browser-sidebar-root';
  document.body.appendChild(container);

  // Create React root and render
  root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <Sidebar />
    </React.StrictMode>
  );
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
}

// Inline styles to avoid CSS loading issues in content script context
function getSidebarStyles(): string {
  return `
    /* Sidebar overlay styles - using unique class names to avoid conflicts */
    .ai-sidebar-overlay {
      position: fixed !important;
      z-index: 2147483647 !important; /* Maximum z-index */
      pointer-events: auto !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    }

    /* Resize handle on the left edge */
    .ai-sidebar-resize-handle {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 4px !important;
      height: 100% !important;
      cursor: ew-resize !important;
      background: transparent !important;
      transition: background 0.2s !important;
    }

    .ai-sidebar-resize-handle:hover {
      background: #2196f3 !important;
    }

    .ai-sidebar-container {
      width: 100% !important;
      height: 100% !important;
      background: white !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      border-radius: 8px !important;
      overflow: hidden !important;
    }

    .ai-sidebar-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 16px 20px !important;
      border-bottom: 1px solid #e0e0e0 !important;
      background: #f5f5f5 !important;
      user-select: none !important;
    }

    .ai-sidebar-header h2 {
      margin: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      color: #333 !important;
      user-select: none !important;
    }

    .ai-sidebar-close {
      background: none !important;
      border: none !important;
      font-size: 28px !important;
      cursor: pointer !important;
      color: #666 !important;
      padding: 0 !important;
      width: 32px !important;
      height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 4px !important;
      transition: background 0.2s !important;
    }

    .ai-sidebar-close:hover {
      background: rgba(0, 0, 0, 0.1) !important;
    }

    .ai-sidebar-content {
      flex: 1 !important;
      padding: 20px !important;
      overflow-y: auto !important;
      background: white !important;
    }

    .ai-sidebar-info {
      margin-top: 20px !important;
      padding: 10px !important;
      background: #f0f0f0 !important;
      border-radius: 4px !important;
      text-align: center !important;
    }

    .ai-sidebar-info small {
      color: #666 !important;
      font-size: 12px !important;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .ai-sidebar-container {
        background: #1e1e1e !important;
        color: #e0e0e0 !important;
      }

      .ai-sidebar-header {
        background: #2d2d2d !important;
        border-bottom-color: #444 !important;
      }

      .ai-sidebar-header h2 {
        color: #e0e0e0 !important;
      }

      .ai-sidebar-close {
        color: #aaa !important;
      }

      .ai-sidebar-close:hover {
        background: rgba(255, 255, 255, 0.1) !important;
      }

      .ai-sidebar-content {
        background: #1e1e1e !important;
      }

      .ai-sidebar-info {
        background: #2d2d2d !important;
      }

      .ai-sidebar-info small {
        color: #999 !important;
      }
    }
  `;
}
