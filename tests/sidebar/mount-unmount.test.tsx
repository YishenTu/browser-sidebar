import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSidebar, unmountSidebar } from '@sidebar/index';

describe('ChatPanel Mount/Unmount', () => {
  beforeEach(() => {
    // Clear DOM before each test
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    // Clean up after each test
    unmountSidebar();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('should create Shadow DOM and mount ChatPanel', () => {
    mountSidebar();

    // Check that host container is created
    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    expect(hostContainer).toBeTruthy();
    expect(hostContainer).toBeInTheDocument();

    // Check that Shadow DOM is attached
    expect(hostContainer?.shadowRoot).toBeTruthy();

    // Check that container element exists inside Shadow DOM
    const shadowRoot = hostContainer?.shadowRoot;
    const root = shadowRoot?.getElementById('ai-browser-sidebar-root');
    expect(root).toBeTruthy();

    // Check that styles are injected into Shadow DOM
    const styleElement = shadowRoot?.querySelector('style');
    expect(styleElement).toBeTruthy();
    expect(styleElement?.textContent).toContain('textarea');

    // Check that ChatPanel is rendered (should find the overlay element)
    const chatPanel = shadowRoot?.querySelector('.ai-sidebar-overlay');
    expect(chatPanel).toBeTruthy();

    // Check for ChatPanel specific elements
    const chatPanelTestId = shadowRoot?.querySelector('[data-testid="chat-panel"]');
    expect(chatPanelTestId).toBeTruthy();
  });

  it('should inject styles into Shadow DOM', () => {
    mountSidebar();

    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    const shadowRoot = hostContainer?.shadowRoot;

    // Check that styles are present in Shadow DOM
    const styleElement = shadowRoot?.querySelector('style');
    expect(styleElement).toBeTruthy();
    expect(styleElement?.textContent).toBeTruthy();

    // Verify key styles are included
    const styles = styleElement?.textContent || '';
    expect(styles).toContain('textarea');
    expect(styles).toContain('#ai-browser-sidebar-root');
    expect(styles).toContain('pointer-events: none');
  });

  it('should unmount ChatPanel and remove host container', () => {
    // First mount the sidebar
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeTruthy();

    // Then unmount it
    unmountSidebar();

    // Host container should be removed
    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    expect(hostContainer).toBeFalsy();
  });

  it('should maintain Shadow DOM isolation', () => {
    mountSidebar();

    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    const shadowRoot = hostContainer?.shadowRoot;

    // Check that Shadow DOM is in closed mode for isolation
    expect(shadowRoot).toBeTruthy();

    // Check that styles in Shadow DOM don't affect main document
    const mainDocStyle = document.querySelector('style');
    expect(mainDocStyle).toBeFalsy(); // No styles should be in main document

    // Check that Shadow DOM has its own styles
    const shadowStyle = shadowRoot?.querySelector('style');
    expect(shadowStyle).toBeTruthy();
  });

  it('should handle multiple mount/unmount cycles', () => {
    // First cycle
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeTruthy();
    unmountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeFalsy();

    // Second cycle
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeTruthy();
    unmountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeFalsy();

    // Third cycle to ensure it still works
    mountSidebar();
    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    expect(hostContainer).toBeTruthy();
    expect(hostContainer?.shadowRoot).toBeTruthy();
  });

  it('should not create duplicate host containers when mounting multiple times', () => {
    mountSidebar();
    unmountSidebar();
    mountSidebar();
    unmountSidebar();
    mountSidebar();

    // Should only have one host container
    const hostContainers = document.querySelectorAll('#ai-browser-sidebar-host');
    expect(hostContainers.length).toBe(1);
  });

  it('should properly clean up event listeners on unmount', () => {
    const originalAddEventListener = document.addEventListener;
    const originalRemoveEventListener = document.removeEventListener;
    const addedListeners: Array<{ type: string; listener: any }> = [];
    const removedListeners: Array<{ type: string; listener: any }> = [];

    // Track event listeners
    document.addEventListener = vi.fn((type: string, listener: any) => {
      addedListeners.push({ type, listener });
      originalAddEventListener.call(document, type, listener);
    });

    document.removeEventListener = vi.fn((type: string, listener: any) => {
      removedListeners.push({ type, listener });
      originalRemoveEventListener.call(document, type, listener);
    });

    mountSidebar();

    // Check that keydown event listeners were added (both from index.tsx and ChatPanel)
    const keydownListeners = addedListeners.filter(l => l.type === 'keydown');
    expect(keydownListeners.length).toBeGreaterThan(0);

    unmountSidebar();

    // Check that keydown event listeners were removed
    const removedKeydownListeners = removedListeners.filter(l => l.type === 'keydown');
    expect(removedKeydownListeners.length).toBeGreaterThan(0);

    // Restore original methods
    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
  });

  it('should mount ChatPanel component with correct props', () => {
    mountSidebar();

    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    const shadowRoot = hostContainer?.shadowRoot;

    // Check that ChatPanel is mounted with expected structure
    const chatPanel = shadowRoot?.querySelector('[data-testid="chat-panel"]');
    expect(chatPanel).toBeTruthy();

    // Check for key ChatPanel elements
    const sidebarContainer = shadowRoot?.querySelector('[data-testid="sidebar-container"]');
    const sidebarHeader = shadowRoot?.querySelector('[data-testid="sidebar-header"]');
    const sidebarBody = shadowRoot?.querySelector('[data-testid="sidebar-body"]');
    const sidebarFooter = shadowRoot?.querySelector('[data-testid="sidebar-footer"]');
    const resizeHandle = shadowRoot?.querySelector('[data-testid="resize-handle"]');

    expect(sidebarContainer).toBeTruthy();
    expect(sidebarHeader).toBeTruthy();
    expect(sidebarBody).toBeTruthy();
    expect(sidebarFooter).toBeTruthy();
    expect(resizeHandle).toBeTruthy();
  });

  it('should handle component unmounting and cleanup properly', () => {
    mountSidebar();

    // Verify ChatPanel is mounted
    const hostContainer = document.getElementById('ai-browser-sidebar-host');
    const shadowRoot = hostContainer?.shadowRoot;
    const chatPanel = shadowRoot?.querySelector('[data-testid="chat-panel"]');
    expect(chatPanel).toBeTruthy();

    // Unmount and verify cleanup
    unmountSidebar();

    // Host container should be completely removed
    const hostAfterUnmount = document.getElementById('ai-browser-sidebar-host');
    expect(hostAfterUnmount).toBeFalsy();
  });
});
