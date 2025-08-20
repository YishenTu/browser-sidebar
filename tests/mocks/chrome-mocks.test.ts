import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMockUtils } from '../setup/chrome-mock';

describe('Chrome API Mocks', () => {
  describe('Runtime API', () => {
    it('should provide sendMessage mock', async () => {
      const message = { type: 'test', data: 'hello' };
      
      // Test callback-based API
      const callbackResult = await new Promise(resolve => {
        global.chrome.runtime.sendMessage(message, resolve);
      });
      
      expect(callbackResult).toEqual({ success: true });
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));

      // Test promise-based API
      const promiseResult = await global.chrome.runtime.sendMessage(message);
      expect(promiseResult).toEqual({ success: true });
    });

    it('should provide onMessage event listeners', () => {
      const listener = vi.fn();
      
      global.chrome.runtime.onMessage.addListener(listener);
      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(listener);
      
      global.chrome.runtime.onMessage.removeListener(listener);
      expect(global.chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(listener);
    });

    it('should provide extension ID', () => {
      expect(global.chrome.runtime.id).toBe('test-extension-id');
    });

    it('should provide manifest', () => {
      const manifest = global.chrome.runtime.getManifest();
      expect(manifest).toEqual({
        name: 'Test Extension',
        version: '1.0.0',
        manifest_version: 3,
      });
    });

    it('should provide getURL', () => {
      const url = global.chrome.runtime.getURL('popup.html');
      expect(url).toBe('chrome-extension://test-extension-id/popup.html');
    });
  });

  describe('Storage API', () => {
    it('should provide local storage mock with callback API', async () => {
      const testData = { key1: 'value1', key2: 'value2' };
      
      // Test set with callback
      await new Promise<void>(resolve => {
        global.chrome.storage.local.set(testData, resolve);
      });
      
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(testData, expect.any(Function));
    });

    it('should provide local storage mock with promise API', async () => {
      const testData = { key1: 'value1', key2: 'value2' };
      
      // Test set with promise
      await global.chrome.storage.local.set(testData);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(testData);
      
      // Test get with promise
      const result = await global.chrome.storage.local.get(['key1']);
      expect(result).toEqual({});
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['key1']);
    });

    it('should provide sync storage mock', async () => {
      const testData = { syncKey: 'syncValue' };
      
      await global.chrome.storage.sync.set(testData);
      expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(testData);
      
      const result = await global.chrome.storage.sync.get('syncKey');
      expect(result).toEqual({});
    });

    it('should provide storage event listeners', () => {
      const listener = vi.fn();
      
      global.chrome.storage.local.onChanged.addListener(listener);
      expect(global.chrome.storage.local.onChanged.addListener).toHaveBeenCalledWith(listener);
    });
  });

  describe('Tabs API', () => {
    it('should provide query mock', async () => {
      const queryInfo = { active: true };
      
      // Test callback API
      const callbackResult = await new Promise(resolve => {
        global.chrome.tabs.query(queryInfo, resolve);
      });
      
      expect(callbackResult).toEqual([{
        id: 1,
        url: 'https://example.com',
        title: 'Example Site',
        active: true,
        windowId: 1,
      }]);

      // Test promise API
      const promiseResult = await global.chrome.tabs.query(queryInfo);
      expect(promiseResult).toEqual([{
        id: 1,
        url: 'https://example.com',
        title: 'Example Site',
        active: true,
        windowId: 1,
      }]);
    });

    it('should provide sendMessage mock', async () => {
      const message = { type: 'content-message' };
      
      await global.chrome.tabs.sendMessage(1, message);
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, message);
    });

    it('should provide create mock', async () => {
      const createProps = { url: 'https://example.com', active: true };
      
      const newTab = await global.chrome.tabs.create(createProps);
      expect(newTab).toMatchObject({
        url: 'https://example.com',
        active: true,
        windowId: 1,
      });
      expect(newTab.id).toBeGreaterThan(1);
    });

    it('should provide event listeners with callback storage', () => {
      const listener = vi.fn();
      
      // Test that addListener stores the callback for test access
      global.chrome.tabs.onRemoved.addListener(listener);
      expect(global.chrome.tabs.onRemoved.addListener).toHaveBeenCalledWith(listener);
      expect(global.chrome.tabs.onRemoved.callback).toBe(listener);
    });
  });

  describe('Action API', () => {
    it('should provide onClicked event listener with callback storage', () => {
      const listener = vi.fn();
      
      global.chrome.action.onClicked.addListener(listener);
      expect(global.chrome.action.onClicked.addListener).toHaveBeenCalledWith(listener);
      expect(global.chrome.action.onClicked.callback).toBe(listener);
    });

    it('should provide badge and icon methods', async () => {
      await global.chrome.action.setBadgeText({ text: '5' });
      expect(global.chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '5' });
      
      await global.chrome.action.setIcon({ path: 'icon.png' });
      expect(global.chrome.action.setIcon).toHaveBeenCalledWith({ path: 'icon.png' });
    });
  });

  describe('Scripting API', () => {
    it('should provide executeScript mock', async () => {
      const injection = {
        target: { tabId: 1 },
        files: ['content.js']
      };
      
      const result = await global.chrome.scripting.executeScript(injection);
      expect(result).toEqual([{ result: null }]);
      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(injection);
    });

    it('should provide CSS injection methods', async () => {
      const injection = {
        target: { tabId: 1 },
        css: 'body { background: red; }'
      };
      
      await global.chrome.scripting.insertCSS(injection);
      expect(global.chrome.scripting.insertCSS).toHaveBeenCalledWith(injection);
      
      await global.chrome.scripting.removeCSS(injection);
      expect(global.chrome.scripting.removeCSS).toHaveBeenCalledWith(injection);
    });
  });

  describe('Windows API', () => {
    it('should provide window management mocks', async () => {
      const currentWindow = await global.chrome.windows.getCurrent();
      expect(currentWindow).toMatchObject({
        id: 1,
        focused: true,
        type: 'normal'
      });
      
      const allWindows = await global.chrome.windows.getAll();
      expect(allWindows).toEqual([{
        id: 1,
        focused: true,
        type: 'normal'
      }]);
    });
  });

  describe('Mock Utilities', () => {
    it('should provide utility to simulate runtime errors', () => {
      chromeMockUtils.simulateRuntimeError('Test error');
      
      expect(global.chrome.runtime.lastError).toEqual({ message: 'Test error' });
      expect(() => global.chrome.runtime.sendMessage({})).toThrow('Test error');
    });

    it('should provide utility to set mock tabs', () => {
      const customTabs = [
        { id: 5, url: 'https://custom.com', title: 'Custom', active: false }
      ];
      
      chromeMockUtils.setMockTabs(customTabs);
      
      // Test that the next query call returns custom tabs
      global.chrome.tabs.query({}).then((tabs: any) => {
        expect(tabs).toEqual(customTabs);
      });
    });

    it('should provide utility to set storage data', () => {
      const testData = { setting1: 'value1', setting2: 'value2' };
      
      chromeMockUtils.setStorageData('local', testData);
      
      // Test that get returns the set data
      global.chrome.storage.local.get(['setting1']).then((result: any) => {
        expect(result).toEqual({ setting1: 'value1' });
      });
    });

    it('should provide utility to simulate messages', () => {
      const listener = vi.fn();
      global.chrome.runtime.onMessage.addListener(listener);
      
      const message = { type: 'test', data: 'hello' };
      const sender = { tab: { id: 1 } };
      const sendResponse = vi.fn();
      
      chromeMockUtils.simulateMessage(message, sender, sendResponse);
      
      expect(listener).toHaveBeenCalledWith(message, sender, sendResponse);
    });
  });
});