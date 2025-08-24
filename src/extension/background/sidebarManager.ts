/* eslint-disable no-console */
/**
 * @file Sidebar Manager
 *
 * Manages sidebar state across different tabs and handles sidebar-related
 * message routing between background script and content scripts.
 */

import { Message, createMessage, ToggleSidebarPayload, ErrorPayload } from '@/types/messages';

/**
 * Sidebar state information for a tab
 */
export interface SidebarState {
  /** Whether the sidebar is currently open */
  isOpen: boolean;
  /** Timestamp when the sidebar was last toggled */
  lastToggled: number;
  /** Tab ID this state belongs to */
  tabId: number;
}

/**
 * Configuration options for SidebarManager
 */
export interface SidebarManagerOptions {
  /** Whether to log sidebar operations for debugging */
  verbose?: boolean;
  /** Default sidebar state for new tabs */
  defaultState?: boolean;
}

/**
 * Manages sidebar state across browser tabs
 */
export class SidebarManager {
  private sidebarStates = new Map<number, SidebarState>();
  private readonly verbose: boolean;
  private readonly defaultState: boolean;

  constructor(options: SidebarManagerOptions = {}) {
    this.verbose = options.verbose || false;
    this.defaultState = options.defaultState || false;

    // Listen for tab closure to clean up state
    this.setupTabListeners();
  }

  /**
   * Get the sidebar state for a specific tab
   *
   * @param tabId - Tab ID to get state for
   * @returns Sidebar state or null if tab not found
   */
  getState(tabId: number): SidebarState | null {
    return this.sidebarStates.get(tabId) || null;
  }

  /**
   * Check if sidebar is open for a specific tab
   *
   * @param tabId - Tab ID to check
   * @returns True if sidebar is open
   */
  isOpen(tabId: number): boolean {
    const state = this.sidebarStates.get(tabId);
    return state ? state.isOpen : this.defaultState;
  }

  /**
   * Set the sidebar state for a specific tab
   *
   * @param tabId - Tab ID to set state for
   * @param isOpen - Whether the sidebar should be open
   * @returns The updated state
   */
  setState(tabId: number, isOpen: boolean): SidebarState {
    const state: SidebarState = {
      isOpen,
      lastToggled: Date.now(),
      tabId,
    };

    this.sidebarStates.set(tabId, state);

    if (this.verbose) {
      console.log(`SidebarManager: Tab ${tabId} sidebar ${isOpen ? 'opened' : 'closed'}`);
    }

    return state;
  }

  /**
   * Toggle the sidebar state for a specific tab
   *
   * @param tabId - Tab ID to toggle
   * @returns The new state
   */
  toggle(tabId: number): SidebarState {
    const currentState = this.isOpen(tabId);
    return this.setState(tabId, !currentState);
  }

  /**
   * Close the sidebar for a specific tab
   *
   * @param tabId - Tab ID to close sidebar for
   * @returns The updated state
   */
  close(tabId: number): SidebarState {
    return this.setState(tabId, false);
  }

  /**
   * Open the sidebar for a specific tab
   *
   * @param tabId - Tab ID to open sidebar for
   * @returns The updated state
   */
  open(tabId: number): SidebarState {
    return this.setState(tabId, true);
  }

  /**
   * Get all active tab IDs with sidebar state
   *
   * @returns Array of tab IDs
   */
  getActiveTabs(): number[] {
    return Array.from(this.sidebarStates.keys());
  }

  /**
   * Get count of tabs with open sidebars
   *
   * @returns Number of tabs with open sidebars
   */
  getOpenSidebarCount(): number {
    return Array.from(this.sidebarStates.values()).filter(state => state.isOpen).length;
  }

  /**
   * Clean up state for a specific tab
   *
   * @param tabId - Tab ID to clean up
   * @returns True if state was removed
   */
  cleanupTab(tabId: number): boolean {
    const removed = this.sidebarStates.delete(tabId);

    if (removed && this.verbose) {
      console.log(`SidebarManager: Cleaned up state for tab ${tabId}`);
    }

    return removed;
  }

  /**
   * Clean up state for all tabs
   */
  cleanupAll(): void {
    const count = this.sidebarStates.size;
    this.sidebarStates.clear();

    if (this.verbose) {
      console.log(`SidebarManager: Cleaned up state for ${count} tabs`);
    }
  }

  /**
   * Handle TOGGLE_SIDEBAR message
   *
   * @param message - Toggle sidebar message
   * @param sender - Message sender
   * @returns Response message or error
   */
  async handleToggleSidebar(
    message: Message<ToggleSidebarPayload>,
    sender: chrome.runtime.MessageSender
  ): Promise<Message<void> | Message<ErrorPayload>> {
    const tabId = sender.tab?.id;

    if (!tabId) {
      console.error('SidebarManager: No tab ID in toggle message sender');
      return createMessage<ErrorPayload>({
        type: 'ERROR',
        payload: {
          message: 'No tab ID available',
          code: 'NO_TAB_ID',
        },
        source: 'background',
        target: message.source,
      });
    }

    try {
      // Check if this is a restricted page
      if (this.isRestrictedUrl(sender.tab?.url)) {
        return createMessage<ErrorPayload>({
          type: 'ERROR',
          payload: {
            message: 'Cannot inject sidebar on browser pages',
            code: 'RESTRICTED_PAGE',
            details: { url: sender.tab?.url },
          },
          source: 'background',
          target: message.source,
        });
      }

      // Determine the desired state
      const show = message.payload?.show;
      let newState: SidebarState;

      if (show !== undefined) {
        // Explicit show/hide
        newState = this.setState(tabId, show);
      } else {
        // Toggle current state
        newState = this.toggle(tabId);
      }

      // Send message to content script
      await this.sendToContentScript(tabId, newState.isOpen);

      return createMessage<void>({
        type: 'TOGGLE_SIDEBAR',
        source: 'background',
        target: message.source,
      });
    } catch (error) {
      console.error('SidebarManager: Error handling toggle:', error);
      return createMessage<ErrorPayload>({
        type: 'ERROR',
        payload: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'TOGGLE_ERROR',
          details: { tabId, error: String(error) },
        },
        source: 'background',
        target: message.source,
      });
    }
  }

  /**
   * Handle CLOSE_SIDEBAR message
   *
   * @param message - Close sidebar message
   * @param sender - Message sender
   * @returns Response message or error
   */
  async handleCloseSidebar(
    message: Message<void>,
    sender: chrome.runtime.MessageSender
  ): Promise<Message<void> | Message<ErrorPayload>> {
    const tabId = sender.tab?.id;

    if (!tabId) {
      console.error('SidebarManager: No tab ID in close message sender');
      return createMessage<ErrorPayload>({
        type: 'ERROR',
        payload: {
          message: 'No tab ID available',
          code: 'NO_TAB_ID',
        },
        source: 'background',
        target: message.source,
      });
    }

    try {
      // Close the sidebar
      this.close(tabId);

      // Send message to content script
      await this.sendToContentScript(tabId, false);

      return createMessage<void>({
        type: 'CLOSE_SIDEBAR',
        source: 'background',
        target: message.source,
      });
    } catch (error) {
      console.error('SidebarManager: Error handling close:', error);
      return createMessage<ErrorPayload>({
        type: 'ERROR',
        payload: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'CLOSE_ERROR',
          details: { tabId, error: String(error) },
        },
        source: 'background',
        target: message.source,
      });
    }
  }

  /**
   * Send message to content script for a specific tab
   *
   * @param tabId - Tab ID to send to
   * @param show - Whether to show or hide sidebar
   */
  private async sendToContentScript(tabId: number, show: boolean): Promise<void> {
    try {
      // Always send TOGGLE_SIDEBAR with explicit show/hide payload
      // This prevents confusion between toggle and explicit state setting
      await chrome.tabs.sendMessage(
        tabId,
        createMessage<ToggleSidebarPayload>({
          type: 'TOGGLE_SIDEBAR',
          payload: { show },
          source: 'background',
          target: 'content',
        })
      );

      if (this.verbose) {
        console.log(`SidebarManager: Sent TOGGLE_SIDEBAR (show=${show}) to tab ${tabId}`);
      }
    } catch (error) {
      // If content script is not loaded, try to inject it
      if (error instanceof Error && error.message.includes('Could not establish connection')) {
        await this.injectContentScript(tabId, show);
      } else {
        throw error;
      }
    }
  }

  /**
   * Inject content script if not already loaded
   *
   * @param tabId - Tab ID to inject into
   * @param show - Whether to show sidebar after injection
   */
  private async injectContentScript(tabId: number, show: boolean): Promise<void> {
    if (this.verbose) {
      console.log(`SidebarManager: Injecting content script for tab ${tabId}`);
    }

    try {
      // The content script should already be injected via manifest.json
      // But if we need to manually inject, we should use chrome.scripting.registerContentScripts
      // or rely on the manifest declaration. For now, just retry sending the message.

      // Check if tab is ready
      const tab = await chrome.tabs.get(tabId);
      if (tab.status !== 'complete') {
        // Wait for tab to be ready
        await new Promise<void>(resolve => {
          const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);

          // Timeout after 5 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 5000);
        });
      }

      // The content script should be auto-injected by manifest.json
      // Just wait a bit and retry the message
      await new Promise(resolve => setTimeout(resolve, 150));

      // Send the message directly (don't call sendToContentScript to avoid recursion)
      await chrome.tabs.sendMessage(
        tabId,
        createMessage<ToggleSidebarPayload>({
          type: 'TOGGLE_SIDEBAR',
          payload: { show },
          source: 'background',
          target: 'content',
        })
      );
    } catch (injectionError) {
      console.error('SidebarManager: Failed to inject content script:', injectionError);
      throw new Error(`Content script injection failed: ${injectionError}`);
    }
  }

  /**
   * Check if a URL is restricted for content script injection
   *
   * @param url - URL to check
   * @returns True if URL is restricted
   */
  private isRestrictedUrl(url?: string): boolean {
    if (!url) return true;

    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('file://') ||
      url.startsWith('moz-extension://') ||
      url === 'about:blank'
    );
  }

  /**
   * Set up tab event listeners for state cleanup
   */
  private setupTabListeners(): void {
    // Clean up state when tab is closed
    chrome.tabs.onRemoved.addListener(tabId => {
      this.cleanupTab(tabId);
    });

    // Optional: Clean up state when tab URL changes significantly
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.url && this.isRestrictedUrl(changeInfo.url)) {
        this.cleanupTab(tabId);
      }
    });
  }
}

/**
 * Global sidebar manager instance
 */
let globalSidebarManager: SidebarManager | null = null;

/**
 * Get or create the global sidebar manager instance
 *
 * @param options - Configuration options
 * @returns The global SidebarManager instance
 */
export function getSidebarManager(options?: SidebarManagerOptions): SidebarManager {
  if (!globalSidebarManager) {
    globalSidebarManager = new SidebarManager(options);
  }
  return globalSidebarManager;
}
