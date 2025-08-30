import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ChatPanel } from './ChatPanel';
import { ErrorProvider } from '@contexts/ErrorContext';
import unifiedStyles from './styles/index.css?inline';
// Theme is applied inside Sidebar.tsx via settings store effect

let root: ReactDOM.Root | null = null;
let shadowRoot: ShadowRoot | null = null;

export function mountSidebar(initialData?: { selectedText?: string }) {
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
  style.textContent = unifiedStyles;
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
      <ErrorProvider>
        <ChatPanel onClose={() => {}} initialSelectedText={initialData?.selectedText} />
      </ErrorProvider>
    );
  });
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
}
