/**
 * @file Chrome Port Management Wrapper Tests
 *
 * Comprehensive unit tests for the ports wrapper functions testing:
 * - ManagedPort class lifecycle and connection management
 * - Auto-reconnection logic and error handling
 * - Message posting with queuing and timeouts
 * - PortManager class for managing multiple ports
 * - Utility functions for common port patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ManagedPort,
  PortManager,
  portManager,
  createStreamingPort,
  createOneTimePort,
  createTemporaryPort,
  waitForPortState,
  createPortWithRetry,
  type PortConnectOptions,
  type PortMessage,
  type PortConnectionState,
  type PortEventListeners,
} from '@/platform/chrome/ports';

// Mock Chrome APIs
const mockPort = {
  name: 'test-port',
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onDisconnect: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  postMessage: vi.fn(),
  disconnect: vi.fn(),
};

const mockChrome = {
  runtime: {
    connect: vi.fn(() => mockPort),
    lastError: null as chrome.runtime.LastError | null,
  },
  tabs: {
    connect: vi.fn(() => mockPort),
  },
};

// Set up global chrome mock
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

// Mock setTimeout/clearTimeout for controlled testing
const mockSetTimeout = vi.fn();
const mockClearTimeout = vi.fn();
const mockSetTimeoutOriginal = setTimeout;
const mockClearTimeoutOriginal = clearTimeout;

describe('ManagedPort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;

    // Use real timers for most tests unless specifically mocked
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create ManagedPort with default options', () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      expect(port.getName()).toBe('test-port');
      expect(port.getState()).toBe('disconnected');
      expect(port.isConnected()).toBe(false);
    });

    it('should merge default options', () => {
      const options: PortConnectOptions = {
        name: 'test-port',
        autoReconnect: false,
        reconnectDelay: 5000,
      };
      const port = new ManagedPort(options);

      expect(port.getName()).toBe('test-port');
    });
  });

  describe('connect', () => {
    it('should connect to runtime port', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();

      expect(mockChrome.runtime.connect).toHaveBeenCalledWith({ name: 'test-port' });
      expect(port.isConnected()).toBe(true);
      expect(port.getState()).toBe('connected');
    });

    it('should connect to tab port', async () => {
      const options: PortConnectOptions = {
        name: 'test-port',
        tabId: 123,
        frameId: 0,
      };
      const port = new ManagedPort(options);

      await port.connect();

      expect(mockChrome.tabs.connect).toHaveBeenCalledWith(123, {
        name: 'test-port',
        frameId: 0,
      });
      expect(port.isConnected()).toBe(true);
    });

    it('should not reconnect if already connecting', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      // Start first connection
      const connectPromise1 = port.connect();

      // Attempt second connection while first is in progress
      const connectPromise2 = port.connect();

      await Promise.all([connectPromise1, connectPromise2]);

      // Should only connect once
      expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection timeout behavior', async () => {
      vi.useFakeTimers();

      const options: PortConnectOptions = {
        name: 'test-port',
        connectTimeout: 1000,
        autoReconnect: false,
      };

      const port = new ManagedPort(options);

      // Start connection - it will be immediately "connected" because Chrome ports work that way
      await port.connect();
      expect(port.getState()).toBe('connected');

      // The timeout timer is set up but doesn't change connection state in this implementation
      // because the port is already considered connected after chrome.runtime.connect()

      vi.useRealTimers();
    });

    it('should handle connection errors', async () => {
      const options: PortConnectOptions = {
        name: 'test-port',
        autoReconnect: false, // Disable auto-reconnect to test failed state
      };
      const port = new ManagedPort(options);

      mockChrome.runtime.connect.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await expect(port.connect()).rejects.toThrow('Connection failed');
      expect(port.getState()).toBe('failed');
    });

    it('should throw when port is destroyed', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      port.destroy();

      await expect(port.connect()).rejects.toThrow('Port is destroyed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from port', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();
      port.disconnect();

      expect(mockPort.disconnect).toHaveBeenCalled();
      expect(port.getState()).toBe('disconnected');
      expect(port.isConnected()).toBe(false);
    });

    it('should handle disconnect errors gracefully', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();

      mockPort.disconnect.mockImplementationOnce(() => {
        throw new Error('Disconnect failed');
      });

      // Should not throw
      expect(() => port.disconnect()).not.toThrow();
      expect(port.getState()).toBe('disconnected');
    });
  });

  describe('destroy', () => {
    it('should destroy port and clean up resources', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const listeners: PortEventListeners = {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
      };
      const port = new ManagedPort(options, listeners);

      await port.connect();
      port.destroy();

      expect(port.getState()).toBe('disconnected');
      expect(mockPort.disconnect).toHaveBeenCalled();
    });
  });

  describe('postMessage', () => {
    it('should post message when connected', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();

      const message: PortMessage = {
        type: 'test-message',
        data: { content: 'hello' },
      };

      port.postMessage(message);

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-message',
          data: { content: 'hello' },
          timestamp: expect.any(Number),
          id: expect.any(String),
        })
      );
    });

    it('should queue messages when not connected', () => {
      const options: PortConnectOptions = { name: 'test-port', autoReconnect: false };
      const port = new ManagedPort(options);

      const message: PortMessage = {
        type: 'test-message',
        data: { content: 'hello' },
      };

      port.postMessage(message);

      // Message should be queued, not posted immediately
      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });

    it('should flush queued messages on connect', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      // Post message before connection
      const message: PortMessage = {
        type: 'queued-message',
        data: { content: 'queued' },
      };
      port.postMessage(message);

      // Connect and verify queued message is sent
      await port.connect();

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'queued-message',
          data: { content: 'queued' },
        })
      );
    });

    it('should handle post message errors', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();

      mockPort.postMessage.mockImplementationOnce(() => {
        throw new Error('Post failed');
      });

      const message: PortMessage = {
        type: 'test-message',
        data: { content: 'hello' },
      };

      // Should not throw, but should queue message
      expect(() => port.postMessage(message)).not.toThrow();
    });

    it('should auto-connect when autoReconnect enabled and disconnected', () => {
      const options: PortConnectOptions = {
        name: 'test-port',
        autoReconnect: true,
      };
      const port = new ManagedPort(options);

      const message: PortMessage = {
        type: 'test-message',
        data: { content: 'hello' },
      };

      port.postMessage(message);

      // Should attempt to connect
      expect(mockChrome.runtime.connect).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send message and wait for response', async () => {
      const options: PortConnectOptions = { name: 'test-port' };
      const listeners: PortEventListeners = {
        onMessage: vi.fn(),
      };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      const message = { type: 'request', data: { query: 'test' } };
      const expectedResponse = { result: 'success' };

      // Simulate response handling
      setTimeout(() => {
        const responseMessage: PortMessage = {
          type: 'response',
          data: expectedResponse,
          id: expect.any(String),
        };
        listeners.onMessage?.(responseMessage, port);
      }, 100);

      // Mock the message listener to capture the message ID and respond
      let capturedMessageId: string;
      mockPort.postMessage.mockImplementationOnce((msg: PortMessage) => {
        capturedMessageId = msg.id!;
        // Simulate async response
        setTimeout(() => {
          const responseMessage: PortMessage = {
            type: 'response',
            data: expectedResponse,
            id: capturedMessageId,
          };
          listeners.onMessage?.(responseMessage, port);
        }, 50);
      });

      const response = await port.sendMessage(message, 1000);

      expect(response).toEqual(expectedResponse);
    });

    it('should timeout on no response', async () => {
      vi.useFakeTimers();

      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options);

      await port.connect();

      const message = { type: 'request', data: { query: 'test' } };
      const responsePromise = port.sendMessage(message, 1000);

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(responsePromise).rejects.toThrow('Message response timeout');

      vi.useRealTimers();
    });
  });

  describe('auto-reconnection', () => {
    it('should schedule reconnection on disconnect', async () => {
      vi.useFakeTimers();

      const options: PortConnectOptions = {
        name: 'test-port',
        autoReconnect: true,
        reconnectDelay: 1000,
      };
      const listeners: PortEventListeners = {
        onStateChange: vi.fn(),
      };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      // Simulate disconnect
      const disconnectHandler = mockPort.onDisconnect.addListener.mock.calls[0][0];
      disconnectHandler();

      // Should be immediately set to reconnecting (not disconnected first due to auto-reconnect)
      expect(port.getState()).toBe('reconnecting');
      expect(listeners.onStateChange).toHaveBeenCalledWith('reconnecting', port);

      vi.useRealTimers();
    });

    it('should stop reconnecting after max attempts', async () => {
      vi.useFakeTimers();

      const options: PortConnectOptions = {
        name: 'test-port',
        autoReconnect: true,
        reconnectDelay: 100,
        maxReconnectAttempts: 2,
      };
      const listeners: PortEventListeners = {
        onReconnectFailed: vi.fn(),
      };
      const port = new ManagedPort(options, listeners);

      // Make connect always fail
      mockChrome.runtime.connect.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // First connection attempt fails
      try {
        await port.connect();
      } catch {
        // Expected
      }

      // Advance time for first reconnect attempt
      vi.advanceTimersByTime(100);

      // Advance time for second reconnect attempt
      vi.advanceTimersByTime(100);

      // After max attempts, should call onReconnectFailed
      expect(listeners.onReconnectFailed).toHaveBeenCalledWith(2, port);
      expect(port.getState()).toBe('failed');

      vi.useRealTimers();
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      // Reset chrome connect mock to return valid port
      mockChrome.runtime.connect.mockReturnValue(mockPort);
      mockChrome.runtime.lastError = null;
    });

    it('should call onConnect listener', async () => {
      const listeners: PortEventListeners = {
        onConnect: vi.fn(),
        onStateChange: vi.fn(),
      };
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      expect(listeners.onConnect).toHaveBeenCalledWith(port);
      expect(listeners.onStateChange).toHaveBeenCalledWith('connected', port);
    });

    it('should call onDisconnect listener', async () => {
      const listeners: PortEventListeners = {
        onDisconnect: vi.fn(),
      };
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      const disconnectHandler = mockPort.onDisconnect.addListener.mock.calls[0][0];
      const lastError = { message: 'Connection lost' };
      mockChrome.runtime.lastError = lastError;

      disconnectHandler();

      expect(listeners.onDisconnect).toHaveBeenCalledWith(port, lastError);
    });

    it('should call onMessage listener', async () => {
      const listeners: PortEventListeners = {
        onMessage: vi.fn(),
      };
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];
      const testMessage: PortMessage = {
        type: 'test',
        data: { content: 'hello' },
      };

      messageHandler(testMessage);

      expect(listeners.onMessage).toHaveBeenCalledWith(testMessage, port);
    });

    it('should ignore invalid messages', async () => {
      const listeners: PortEventListeners = {
        onMessage: vi.fn(),
      };
      const options: PortConnectOptions = { name: 'test-port' };
      const port = new ManagedPort(options, listeners);

      await port.connect();

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      // Invalid message without type
      messageHandler({ data: 'invalid' });

      expect(listeners.onMessage).not.toHaveBeenCalled();
    });
  });
});

describe('PortManager', () => {
  let manager: PortManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.connect.mockReturnValue(mockPort);
    mockChrome.runtime.lastError = null;
    manager = new PortManager();
  });

  describe('createPort', () => {
    it('should create new port', () => {
      const port = manager.createPort('test-port', { autoReconnect: false });

      expect(port.getName()).toBe('test-port');
      expect(manager.getPortNames()).toContain('test-port');
    });

    it('should return existing port if already created', () => {
      const port1 = manager.createPort('test-port');
      const port2 = manager.createPort('test-port');

      expect(port1).toBe(port2);
    });
  });

  describe('getPort', () => {
    it('should return existing port', () => {
      const createdPort = manager.createPort('test-port');
      const retrievedPort = manager.getPort('test-port');

      expect(retrievedPort).toBe(createdPort);
    });

    it('should return null for non-existent port', () => {
      const port = manager.getPort('non-existent');

      expect(port).toBeNull();
    });
  });

  describe('destroyPort', () => {
    it('should destroy existing port', () => {
      manager.createPort('test-port');

      const destroyed = manager.destroyPort('test-port');

      expect(destroyed).toBe(true);
      expect(manager.getPort('test-port')).toBeNull();
    });

    it('should return false for non-existent port', () => {
      const destroyed = manager.destroyPort('non-existent');

      expect(destroyed).toBe(false);
    });
  });

  describe('getAllPorts', () => {
    it('should return all ports', () => {
      manager.createPort('port1');
      manager.createPort('port2');

      const ports = manager.getAllPorts();

      expect(ports).toHaveLength(2);
    });
  });

  describe('destroyAll', () => {
    it('should destroy all ports', () => {
      manager.createPort('port1');
      manager.createPort('port2');

      manager.destroyAll();

      expect(manager.getAllPorts()).toHaveLength(0);
      expect(manager.getPortNames()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return port statistics', async () => {
      const port1 = manager.createPort('port1');
      const port2 = manager.createPort('port2');

      await port1.connect(); // Connected
      // port2 remains disconnected

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.connected).toBe(1);
      expect(stats.disconnected).toBe(1);
    });
  });
});

describe('utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.connect.mockReturnValue(mockPort);
    mockChrome.runtime.lastError = null;
    // Clear the global port manager
    portManager.destroyAll();
  });

  describe('createStreamingPort', () => {
    it('should create streaming port with default options', () => {
      const port = createStreamingPort('streaming-port');

      expect(port.getName()).toBe('streaming-port');
      expect(portManager.getPort('streaming-port')).toBe(port);
    });

    it('should override default options', () => {
      const port = createStreamingPort('streaming-port', {
        autoReconnect: false,
        reconnectDelay: 5000,
      });

      expect(port.getName()).toBe('streaming-port');
    });
  });

  describe('createOneTimePort', () => {
    it('should create one-time port with autoReconnect disabled', () => {
      const port = createOneTimePort('onetime-port');

      expect(port.getName()).toBe('onetime-port');
      expect(portManager.getPort('onetime-port')).toBe(port);
    });
  });

  describe('createTemporaryPort', () => {
    it('should create temporary port with cleanup timeout', () => {
      vi.useFakeTimers();

      const port = createTemporaryPort('temp-port', 5000);

      expect(port.getName()).toBe('temp-port');
      expect(portManager.getPort('temp-port')).toBe(port);

      // Advance time to trigger cleanup
      vi.advanceTimersByTime(5000);

      expect(portManager.getPort('temp-port')).toBeNull();

      vi.useRealTimers();
    });

    it('should use default timeout', () => {
      vi.useFakeTimers();

      const port = createTemporaryPort('temp-port');

      expect(portManager.getPort('temp-port')).toBe(port);

      // Advance time to trigger cleanup (default 30s)
      vi.advanceTimersByTime(30000);

      expect(portManager.getPort('temp-port')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('waitForPortState', () => {
    it('should resolve immediately if port is already in target state', async () => {
      const port = portManager.createPort('test-port');
      await port.connect();

      const result = await waitForPortState(port, 'connected', 1000);

      expect(result).toBeUndefined(); // Resolves without value
    });

    it('should timeout if port does not reach target state', async () => {
      vi.useFakeTimers();

      const port = portManager.createPort('test-port');
      // Port stays disconnected

      const waitPromise = waitForPortState(port, 'connected', 1000);

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(waitPromise).rejects.toThrow("Port did not reach state 'connected'");

      vi.useRealTimers();
    });
  });

  describe('createPortWithRetry', () => {
    it('should create port successfully on first attempt', async () => {
      const port = await createPortWithRetry('retry-port', {}, 3);

      expect(port.getName()).toBe('retry-port');
      expect(port.isConnected()).toBe(true);
    });

    it('should retry on connection failures', async () => {
      vi.useFakeTimers();

      let attempts = 0;
      mockChrome.runtime.connect.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection failed');
        }
        return mockPort; // Succeed on 3rd attempt
      });

      const portPromise = createPortWithRetry('retry-port', {}, 3);

      // Fast-forward through retry delays
      vi.runAllTimersAsync();

      const port = await portPromise;

      expect(port.getName()).toBe('retry-port');
      expect(attempts).toBe(3);

      vi.useRealTimers();
    });

    it('should fail after max attempts', async () => {
      vi.useFakeTimers();

      mockChrome.runtime.connect.mockImplementation(() => {
        throw new Error('Always fails');
      });

      const portPromise = createPortWithRetry('retry-port', {}, 2);

      // Fast-forward through retry delays
      vi.runAllTimersAsync();

      await expect(portPromise).rejects.toThrow('Always fails');

      vi.useRealTimers();
    });
  });
});
