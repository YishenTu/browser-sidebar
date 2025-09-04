/**
 * Chrome Runtime Port Management Wrapper
 *
 * Provides strongly typed wrapper around chrome.runtime Port API with:
 * - Type-safe port creation and management
 * - Auto-reconnection logic for resilient connections
 * - Graceful handling of port disconnect events
 * - Streaming patterns for SSE-like communication
 * - Utilities for managing multiple ports
 * - Compatible with existing port usage patterns
 */

/**
 * Port connection configuration options
 */
export interface PortConnectOptions {
  /** Port name identifier */
  name: string;
  /** Tab ID for tab-specific ports (content script ports) */
  tabId?: number;
  /** Frame ID for frame-specific ports */
  frameId?: number;
  /** Whether to auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts (0 for infinite) */
  maxReconnectAttempts?: number;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
}

/**
 * Port message with type safety
 */
export interface PortMessage<T = unknown> {
  /** Message type identifier */
  type: string;
  /** Message payload */
  data?: T;
  /** Message timestamp */
  timestamp?: number;
  /** Message ID for request/response patterns */
  id?: string;
}

/**
 * Port connection state
 */
export type PortConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

/**
 * Port event listeners
 */
export interface PortEventListeners<T = unknown> {
  /** Called when port successfully connects */
  onConnect?: (port: ManagedPort<T>) => void;
  /** Called when port disconnects */
  onDisconnect?: (port: ManagedPort<T>, error?: chrome.runtime.LastError) => void;
  /** Called when a message is received */
  onMessage?: (message: PortMessage<T>, port: ManagedPort<T>) => void;
  /** Called when connection state changes */
  onStateChange?: (state: PortConnectionState, port: ManagedPort<T>) => void;
  /** Called when reconnection fails */
  onReconnectFailed?: (attempts: number, port: ManagedPort<T>) => void;
}

/**
 * Managed port wrapper with auto-reconnection and lifecycle management
 */
export class ManagedPort<T = unknown> {
  private port: chrome.runtime.Port | null = null;
  private state: PortConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectTimeoutTimer: NodeJS.Timeout | null = null;
  private messageQueue: PortMessage<T>[] = [];
  private isDestroyed = false;

  constructor(
    private options: PortConnectOptions,
    private listeners: PortEventListeners<T> = {}
  ) {
    // Set defaults
    this.options = {
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      connectTimeout: 5000,
      ...options,
    };
  }

  /**
   * Connect to the port
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Port is destroyed and cannot be reconnected');
    }

    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.setState('connecting');

    try {
      // Create port connection
      if (this.options.tabId) {
        this.port = chrome.tabs.connect(this.options.tabId, {
          name: this.options.name,
          frameId: this.options.frameId,
        });
      } else {
        this.port = chrome.runtime.connect({
          name: this.options.name,
        });
      }

      // Set up connection timeout
      if (this.options.connectTimeout && this.options.connectTimeout > 0) {
        this.connectTimeoutTimer = setTimeout(() => {
          this.handleConnectionTimeout();
        }, this.options.connectTimeout);
      }

      // Set up port event listeners
      this.setupPortListeners();

      // Port is considered connected immediately after creation
      this.handleConnect();

      // Send any queued messages
      this.flushMessageQueue();
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Disconnect from the port
   */
  disconnect(): void {
    this.clearTimers();

    if (this.port) {
      try {
        this.port.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.port = null;
    }

    if (this.state !== 'disconnected') {
      this.setState('disconnected');
    }
  }

  /**
   * Destroy the port and clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.messageQueue = [];
    this.listeners = {};
  }

  /**
   * Send a message through the port
   */
  postMessage(message: PortMessage<T>): void {
    const messageWithTimestamp: PortMessage<T> = {
      ...message,
      timestamp: message.timestamp || Date.now(),
      id: message.id || this.generateMessageId(),
    };

    if (this.state === 'connected' && this.port) {
      try {
        this.port.postMessage(messageWithTimestamp);
      } catch (error) {
        // Port might be disconnected, queue the message
        this.messageQueue.push(messageWithTimestamp);
        this.handlePortError(error);
      }
    } else {
      // Queue message for when port reconnects
      this.messageQueue.push(messageWithTimestamp);

      // Auto-connect if not connecting and auto-reconnect is enabled
      if (this.options.autoReconnect && this.state === 'disconnected') {
        this.connect().catch(() => {
          // Error is handled in connect method
        });
      }
    }
  }

  /**
   * Send a message and wait for a response
   */
  async sendMessage<R = unknown>(
    message: Omit<PortMessage<T>, 'id'>,
    timeout: number = 10000
  ): Promise<R> {
    const messageId = this.generateMessageId();
    const requestMessage: PortMessage<T> = {
      ...message,
      id: messageId,
    };

    return new Promise<R>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error(`Message response timeout after ${timeout}ms`));
      }, timeout);

      const responseListener = (receivedMessage: PortMessage, port: ManagedPort<T>) => {
        if (receivedMessage.id === messageId && port === this) {
          cleanup();
          resolve(receivedMessage.data as R);
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        // Remove the temporary listener
        const originalListener = this.listeners.onMessage;
        this.listeners.onMessage = originalListener;
      };

      // Set up temporary response listener
      const originalListener = this.listeners.onMessage;
      this.listeners.onMessage = (msg, port) => {
        responseListener(msg, port);
        originalListener?.(msg, port);
      };

      this.postMessage(requestMessage);
    });
  }

  /**
   * Get current connection state
   */
  getState(): PortConnectionState {
    return this.state;
  }

  /**
   * Check if port is connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.port !== null;
  }

  /**
   * Get port name
   */
  getName(): string {
    return this.options.name;
  }

  /**
   * Get native Chrome port (for advanced usage)
   */
  getNativePort(): chrome.runtime.Port | null {
    return this.port;
  }

  /**
   * Set up port event listeners
   */
  private setupPortListeners(): void {
    if (!this.port) return;

    this.port.onMessage.addListener((message: unknown) => {
      if (this.isValidPortMessage(message)) {
        this.listeners.onMessage?.(message, this);
      }
    });

    this.port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      this.handleDisconnect(error);
    });
  }

  /**
   * Handle successful port connection
   */
  private handleConnect(): void {
    this.clearConnectTimeout();
    this.reconnectAttempts = 0;
    this.setState('connected');
    this.listeners.onConnect?.(this);
  }

  /**
   * Handle port disconnection
   */
  private handleDisconnect(error?: chrome.runtime.LastError): void {
    this.clearTimers();
    this.port = null;
    this.setState('disconnected');
    this.listeners.onDisconnect?.(this, error);

    // Attempt reconnection if enabled
    if (this.options.autoReconnect && !this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection timeout
   */
  private handleConnectionTimeout(): void {
    this.clearConnectTimeout();
    const error = new Error('Port connection timeout');
    this.handleConnectionError(error);
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(_error: unknown): void {
    this.clearTimers();
    this.setState('failed');

    if (this.options.autoReconnect && !this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle port errors during operation
   */
  private handlePortError(_error: unknown): void {
    // Port error usually means disconnection
    this.handleDisconnect();
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    const maxAttempts = this.options.maxReconnectAttempts || 0;
    if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
      this.setState('failed');
      this.listeners.onReconnectFailed?.(this.reconnectAttempts, this);
      return;
    }

    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error handling is done in connect method
      });
    }, this.options.reconnectDelay || 1000);
  }

  /**
   * Set connection state and notify listeners
   */
  private setState(newState: PortConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.listeners.onStateChange?.(newState, this);
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearConnectTimeout();
    this.clearReconnectTimer();
  }

  /**
   * Clear connection timeout timer
   */
  private clearConnectTimeout(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Send all queued messages
   */
  private flushMessageQueue(): void {
    if (!this.isConnected()) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.port!.postMessage(message);
        } catch (error) {
          // Re-queue the message and stop flushing
          this.messageQueue.unshift(message);
          this.handlePortError(error);
          break;
        }
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `port_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate port message format
   */
  private isValidPortMessage(obj: unknown): obj is PortMessage<T> {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'type' in obj! &&
      typeof (obj as Record<string, unknown>)['type'] === 'string'
    );
  }
}

/**
 * Port manager for managing multiple ports
 */
export class PortManager {
  private ports = new Map<string, ManagedPort<unknown>>();

  /**
   * Create or get an existing port
   */
  createPort<T = unknown>(
    name: string,
    options: Omit<PortConnectOptions, 'name'> = {},
    listeners: PortEventListeners<T> = {}
  ): ManagedPort<T> {
    const existingPort = this.ports.get(name);
    if (existingPort) {
      return existingPort as ManagedPort<T>;
    }

    const port = new ManagedPort<T>({ ...options, name }, listeners);
    // Type erasure for storage - all ports stored as ManagedPort<unknown>
    this.ports.set(name, port as ManagedPort<unknown>);
    return port;
  }

  /**
   * Get an existing port by name
   */
  getPort<T = unknown>(name: string): ManagedPort<T> | null {
    return (this.ports.get(name) as ManagedPort<T>) || null;
  }

  /**
   * Remove and destroy a port
   */
  destroyPort(name: string): boolean {
    const port = this.ports.get(name);
    if (port) {
      port.destroy();
      this.ports.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get all port names
   */
  getPortNames(): string[] {
    return Array.from(this.ports.keys());
  }

  /**
   * Get all ports
   */
  getAllPorts(): ManagedPort<unknown>[] {
    return Array.from(this.ports.values());
  }

  /**
   * Destroy all ports
   */
  destroyAll(): void {
    this.ports.forEach(port => port.destroy());
    this.ports.clear();
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    connecting: number;
    reconnecting: number;
    failed: number;
  } {
    const ports = this.getAllPorts();
    return {
      total: ports.length,
      connected: ports.filter(p => p.getState() === 'connected').length,
      disconnected: ports.filter(p => p.getState() === 'disconnected').length,
      connecting: ports.filter(p => p.getState() === 'connecting').length,
      reconnecting: ports.filter(p => p.getState() === 'reconnecting').length,
      failed: ports.filter(p => p.getState() === 'failed').length,
    };
  }
}

/**
 * Global port manager instance
 */
export const portManager = new PortManager();

/**
 * Utility functions for common port operations
 */

/**
 * Create a streaming port for SSE-like communication
 */
export function createStreamingPort<T = unknown>(
  name: string,
  options: Omit<PortConnectOptions, 'name'> = {}
): ManagedPort<T> {
  return portManager.createPort<T>(name, {
    autoReconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    ...options,
  });
}

/**
 * Create a one-time port for single request/response
 */
export function createOneTimePort<T = unknown>(
  name: string,
  options: Omit<PortConnectOptions, 'name'> = {}
): ManagedPort<T> {
  return portManager.createPort<T>(name, {
    autoReconnect: false,
    ...options,
  });
}

/**
 * Create a port with automatic cleanup after timeout
 */
export function createTemporaryPort<T = unknown>(
  name: string,
  timeoutMs: number = 30000,
  options: Omit<PortConnectOptions, 'name'> = {}
): ManagedPort<T> {
  const port = portManager.createPort<T>(name, options);

  setTimeout(() => {
    portManager.destroyPort(name);
  }, timeoutMs);

  return port;
}

/**
 * Wait for port to reach a specific state
 */
export function waitForPortState<T = unknown>(
  port: ManagedPort<T>,
  state: PortConnectionState,
  timeoutMs: number = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (port.getState() === state) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Port did not reach state '${state}' within ${timeoutMs}ms`));
    }, timeoutMs);

    const stateListener = (newState: PortConnectionState) => {
      if (newState === state) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      // Remove state listener (this is simplified - in real implementation
      // you'd need to properly manage listener removal)
    };

    // Add temporary state listener
    // Note: This is a simplified implementation for demonstration
    // In a production system, you'd want proper listener management
    const portInternal = port as unknown as { listeners: PortEventListeners<T> };
    const originalStateListener = portInternal.listeners.onStateChange;
    portInternal.listeners.onStateChange = (s: PortConnectionState, p: ManagedPort<T>) => {
      stateListener(s);
      originalStateListener?.(s, p);
    };
  });
}

/**
 * Create a port with retry logic for initial connection
 */
export async function createPortWithRetry<T = unknown>(
  name: string,
  options: Omit<PortConnectOptions, 'name'> = {},
  maxAttempts: number = 3
): Promise<ManagedPort<T>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const port = portManager.createPort<T>(name, options);
      await port.connect();
      await waitForPortState(port, 'connected', options.connectTimeout || 5000);
      return port;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Clean up failed port
      portManager.destroyPort(name);

      if (attempt < maxAttempts) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to create port after maximum attempts');
}

/**
 * Type definitions for common port message patterns
 */

/**
 * Streaming message types for proxy/streaming communication
 */
export interface StreamStartMessage
  extends PortMessage<{
    headers?: Record<string, string>;
    status?: number;
    statusText?: string;
  }> {
  type: 'stream-start';
}

export interface StreamChunkMessage extends PortMessage<{ chunk: string }> {
  type: 'stream-chunk';
}

export interface StreamEndMessage extends PortMessage<void> {
  type: 'stream-end';
}

export interface StreamErrorMessage
  extends PortMessage<{
    message?: string;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  }> {
  type: 'stream-error';
}

export type StreamMessage =
  | StreamStartMessage
  | StreamChunkMessage
  | StreamEndMessage
  | StreamErrorMessage;

/**
 * Request/response message pattern
 */
export interface RequestMessage<T = unknown> extends PortMessage<T> {
  type: 'request';
}

export interface ResponseMessage<T = unknown> extends PortMessage<T> {
  type: 'response';
}

export interface ErrorResponseMessage
  extends PortMessage<{
    message: string;
    code?: string;
    details?: unknown;
  }> {
  type: 'error';
}

export type RequestResponseMessage<T = unknown> =
  | RequestMessage<T>
  | ResponseMessage<T>
  | ErrorResponseMessage;
