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
  private sidebarModule: { mountSidebar: () => void; unmountSidebar: () => void } | null = null;
  private sidebarOpen = false;

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
    // Load the module if not already loaded
    if (!this.sidebarModule) {
      // Dynamic import with proper URL resolution will be handled by Vite/CRXJS
      this.sidebarModule = await import('../../sidebar/index');
    }

    // Mount the sidebar
    this.sidebarModule.mountSidebar();
    this.sidebarOpen = true;

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
}
