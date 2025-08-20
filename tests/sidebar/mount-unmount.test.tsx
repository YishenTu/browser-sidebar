import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSidebar, unmountSidebar } from '@sidebar/index';

describe('Sidebar Mount/Unmount', () => {
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

  it('should mount sidebar and create necessary DOM elements', () => {
    mountSidebar();

    // Check that root element is created
    const root = document.getElementById('ai-browser-sidebar-root');
    expect(root).toBeTruthy();
    expect(root).toBeInTheDocument();

    // Check that styles are injected
    const styles = document.getElementById('ai-browser-sidebar-styles');
    expect(styles).toBeTruthy();
    expect(styles).toBeInTheDocument();
    expect(styles?.tagName).toBe('STYLE');

    // Check that sidebar content is rendered
    const sidebar = document.querySelector('.ai-sidebar-overlay');
    expect(sidebar).toBeTruthy();
  });

  it('should unmount sidebar and remove root element', () => {
    // First mount the sidebar
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-root')).toBeTruthy();

    // Then unmount it
    unmountSidebar();

    // Root should be removed
    const root = document.getElementById('ai-browser-sidebar-root');
    expect(root).toBeFalsy();

    // Styles should remain for reuse
    const styles = document.getElementById('ai-browser-sidebar-styles');
    expect(styles).toBeTruthy();
  });

  it('should keep styles when unmounting for reuse', () => {
    mountSidebar();
    const stylesBefore = document.getElementById('ai-browser-sidebar-styles');
    expect(stylesBefore).toBeTruthy();

    unmountSidebar();

    // Styles should still be present after unmount
    const stylesAfter = document.getElementById('ai-browser-sidebar-styles');
    expect(stylesAfter).toBeTruthy();
    expect(stylesAfter).toBe(stylesBefore);
  });

  it('should handle multiple mount/unmount cycles', () => {
    // First cycle
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-root')).toBeTruthy();
    unmountSidebar();
    expect(document.getElementById('ai-browser-sidebar-root')).toBeFalsy();

    // Second cycle
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-root')).toBeTruthy();
    unmountSidebar();
    expect(document.getElementById('ai-browser-sidebar-root')).toBeFalsy();

    // Styles should only be injected once
    const styles = document.querySelectorAll('#ai-browser-sidebar-styles');
    expect(styles.length).toBe(1);
  });

  it('should not create duplicate styles when mounting multiple times', () => {
    mountSidebar();
    unmountSidebar();
    mountSidebar();
    unmountSidebar();
    mountSidebar();

    // Should only have one style element
    const styles = document.querySelectorAll('#ai-browser-sidebar-styles');
    expect(styles.length).toBe(1);
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

    // Check that event listeners were added
    const keydownListeners = addedListeners.filter(l => l.type === 'keydown');
    expect(keydownListeners.length).toBeGreaterThan(0);

    unmountSidebar();

    // Check that event listeners were removed
    const removedKeydownListeners = removedListeners.filter(l => l.type === 'keydown');
    expect(removedKeydownListeners.length).toBeGreaterThan(0);

    // Restore original methods
    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
  });
});
