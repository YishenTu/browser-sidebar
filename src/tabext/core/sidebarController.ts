/**
 * @file Sidebar Controller
 *
 * Manages the sidebar lifecycle including mounting, unmounting, and state tracking.
 */

import { createMessage, Message } from '@/types/messages';

/**
 * Controller for managing sidebar state and operations
 */
export class SidebarController {
  private sidebarModule: {
    mountSidebar: (initialData?: { selectedText?: string }) => void;
    unmountSidebar: () => void;
  } | null = null;
  private sidebarOpen = false;
  private savedSelection: Range[] | null = null;

  /**
   * Checks if sidebar is currently open
   */
  isOpen(): boolean {
    return this.sidebarOpen;
  }

  /**
   * Opens/injects the sidebar
   */
  async open(): Promise<Message> {
    // Save current selection before mounting sidebar
    this.saveSelection();

    // Get the selected text if any
    const selectedText = this.getSelectedText();

    // Load the module if not already loaded
    if (!this.sidebarModule) {
      // Dynamic import with proper URL resolution will be handled by Vite/CRXJS
      this.sidebarModule = await import('../../sidebar/index');
    }

    // Mount the sidebar with initial data
    this.sidebarModule.mountSidebar(selectedText ? { selectedText } : undefined);
    this.sidebarOpen = true;

    // Restore selection after DOM manipulation with multiple attempts
    // First attempt: immediate restoration
    this.restoreSelection();

    // Second attempt: after next frame
    requestAnimationFrame(() => {
      this.restoreSelection();

      // Third attempt: with a small delay for complex DOM changes
      setTimeout(() => {
        this.restoreSelection();
      }, 10);
    });

    // Send confirmation back to background
    return createMessage({
      type: 'SIDEBAR_STATE',
      payload: {
        status: 'sidebar-opened',
        timestamp: Date.now(),
      },
      source: 'content',
      target: 'background',
    });
  }

  /**
   * Closes/removes the sidebar
   */
  close(): Message {
    if (this.sidebarModule && this.sidebarOpen) {
      this.sidebarModule.unmountSidebar();
      this.sidebarOpen = false;

      // Send confirmation back to background
      return createMessage({
        type: 'SIDEBAR_STATE',
        payload: {
          status: 'sidebar-closed',
          timestamp: Date.now(),
        },
        source: 'content',
        target: 'background',
      });
    }

    return createMessage({
      type: 'ERROR',
      payload: {
        message: 'Sidebar not open',
        code: 'SIDEBAR_NOT_OPEN',
      },
      source: 'content',
      target: 'background',
    });
  }

  /**
   * Saves the current text selection
   */
  private saveSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.savedSelection = null;
      return;
    }

    // Save all ranges (in case of multiple selections)
    this.savedSelection = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      // Clone the range to preserve it
      this.savedSelection.push(range.cloneRange());
    }
  }

  /**
   * Restores the previously saved text selection
   */
  private restoreSelection(): void {
    if (!this.savedSelection || this.savedSelection.length === 0) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    // Clear current selection
    selection.removeAllRanges();

    // Restore saved ranges
    let restoredSuccessfully = false;
    for (const range of this.savedSelection) {
      try {
        selection.addRange(range);
        restoredSuccessfully = true;
      } catch (e) {
        // Range may no longer be valid if DOM has changed significantly
      }
    }

    // Only clear saved selection if we successfully restored at least one range
    // This allows for retry attempts
    if (restoredSuccessfully) {
      // Keep the saved selection for potential retry attempts
      // It will be cleared after the final attempt
      setTimeout(() => {
        this.savedSelection = null;
      }, 100);
    }
  }

  /**
   * Gets the currently selected text
   */
  private getSelectedText(): string {
    const selection = window.getSelection();
    if (!selection) {
      return '';
    }
    return selection.toString().trim();
  }
}
