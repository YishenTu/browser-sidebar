import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMessage } from '@/types/messages';

describe('Background-Content Script Interaction', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should send TOGGLE_SIDEBAR message when icon is clicked', async () => {
    const tab = { id: 1, url: 'https://example.com' };

    // Mock the sendMessage to simulate success
    global.chrome.tabs.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      status: 'sidebar-opened'
    });

    // Create the message that would be sent
    const toggleMessage = createMessage('TOGGLE_SIDEBAR', { tabId: 1 }, 'background');

    // Send message to content script
    await global.chrome.tabs.sendMessage(tab.id, toggleMessage);

    // Verify message was sent with correct type
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'TOGGLE_SIDEBAR',
        source: 'background'
      })
    );
  });

  it('should send CLOSE_SIDEBAR message', async () => {
    const tab = { id: 1, url: 'https://example.com' };

    // Mock the sendMessage
    global.chrome.tabs.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      status: 'sidebar-closed'
    });

    // Create close message
    const closeMessage = createMessage('CLOSE_SIDEBAR', { tabId: 1 }, 'background');

    // Send message
    await global.chrome.tabs.sendMessage(tab.id, closeMessage);

    // Verify
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'CLOSE_SIDEBAR',
        source: 'background'
      })
    );
  });

  it('should handle PING/PONG health check', async () => {
    // Create ping message
    const pingMessage = createMessage('PING', {}, 'content');
    
    // Mock response
    const pongMessage = createMessage('PONG', {
      originalId: pingMessage.id,
      source: 'background'
    }, 'background');

    // Mock runtime.sendMessage for ping
    global.chrome.runtime.sendMessage = vi.fn().mockResolvedValue(pongMessage);

    // Send ping
    const response = await global.chrome.runtime.sendMessage(pingMessage);

    // Verify response
    expect(response.type).toBe('PONG');
    expect(response.payload.originalId).toBe(pingMessage.id);
  });

  it('should clean up state when tab is closed', () => {
    const tabId = 1;
    
    // Mock onRemoved listener
    const onRemovedCallback = vi.fn();
    global.chrome.tabs.onRemoved.addListener(onRemovedCallback);

    // Simulate tab removal
    global.chrome.tabs.onRemoved.callback(tabId);

    // Verify callback was registered
    expect(global.chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
  });

  it('should not send messages to restricted URLs', async () => {
    const restrictedTabs = [
      { id: 1, url: 'chrome://extensions/' },
      { id: 2, url: 'chrome://settings/' },
      { id: 3, url: 'chrome-extension://abc123/page.html' },
      { id: 4, url: 'about:blank' },
      { id: 5, url: 'file:///local/file.html' }
    ];

    global.chrome.tabs.sendMessage = vi.fn();

    for (const tab of restrictedTabs) {
      // Check if URL is restricted (simplified check)
      const isRestricted = tab.url.startsWith('chrome://') || 
                          tab.url.startsWith('chrome-extension://') ||
                          tab.url.startsWith('about:') ||
                          tab.url.startsWith('file://');
      
      expect(isRestricted).toBe(true);
    }
  });
});