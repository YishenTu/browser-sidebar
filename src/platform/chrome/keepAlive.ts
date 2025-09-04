/**
 * Chrome Service Worker KeepAlive Wrapper
 *
 * Provides strongly typed wrapper around service worker keepAlive mechanisms with:
 * - Port-based keepAlive strategy for long-running connections
 * - Timer-based periodic ping management
 * - Service worker lifecycle utilities
 * - Multiple keepAlive strategies and patterns
 * - Graceful handling of service worker suspension/resume
 * - Compatible with existing keepAlive implementation
 */

import { ManagedPort, createStreamingPort, PortMessage } from './ports';
import {
  KeepAlive as BaseKeepAlive,
  KeepAliveOptions as BaseKeepAliveOptions,
  startKeepAlive as baseStartKeepAlive,
  stopKeepAlive as baseStopKeepAlive,
  isKeepAliveActive as baseIsKeepAliveActive,
} from '@extension/background/keepAlive';

/**
 * KeepAlive strategy types
 */
export type KeepAliveStrategy =
  | 'timer' // Timer-based periodic pings
  | 'port' // Port-based connection keepAlive
  | 'hybrid' // Combination of timer and port strategies
  | 'adaptive'; // Adaptive strategy based on conditions

/**
 * Port-based keepAlive configuration
 */
export interface PortKeepAliveOptions {
  /** Port name for keepAlive connection */
  portName?: string;
  /** Whether to auto-reconnect ports */
  autoReconnect?: boolean;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Ping interval through port in milliseconds */
  portPingInterval?: number;
}

/**
 * Extended keepAlive options with strategy selection
 */
export interface ExtendedKeepAliveOptions extends BaseKeepAliveOptions, PortKeepAliveOptions {
  /** KeepAlive strategy to use */
  strategy?: KeepAliveStrategy;
  /** Fallback strategy if primary fails */
  fallbackStrategy?: KeepAliveStrategy;
  /** Service worker activity monitoring */
  monitorActivity?: boolean;
  /** Custom ping handlers */
  customPingHandlers?: Array<() => Promise<void> | void>;
}

/**
 * Service worker lifecycle events
 */
export interface ServiceWorkerLifecycleEvents {
  onInstall?: () => void;
  onActivate?: () => void;
  onSuspend?: () => void;
  onResume?: () => void;
  onTerminate?: () => void;
}

/**
 * KeepAlive statistics and monitoring
 */
export interface KeepAliveStats {
  strategy: KeepAliveStrategy;
  isActive: boolean;
  uptime: number;
  totalPings: number;
  successfulPings: number;
  failedPings: number;
  portConnections: number;
  suspensions: number;
  resumes: number;
  lastActivity: number;
}

/**
 * Port-based keepAlive ping message
 */
export interface KeepAlivePingMessage
  extends PortMessage<{
    timestamp: number;
    strategy: KeepAliveStrategy;
    pingId: string;
  }> {
  type: 'keepalive-ping';
}

/**
 * Port-based keepAlive pong message
 */
export interface KeepAlivePongMessage
  extends PortMessage<{
    timestamp: number;
    originalPingId: string;
    roundTripTime?: number;
  }> {
  type: 'keepalive-pong';
}

/**
 * Enhanced KeepAlive wrapper with multiple strategies
 */
export class EnhancedKeepAlive {
  private baseKeepAlive: BaseKeepAlive;
  private strategy: KeepAliveStrategy;
  private port: ManagedPort<KeepAlivePingMessage | KeepAlivePongMessage> | null = null;
  private portPingTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private stats: KeepAliveStats;
  private listeners: ServiceWorkerLifecycleEvents = {};
  private customPingHandlers: Array<() => Promise<void> | void> = [];
  private suspensionDetector: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();
  private startTime = 0;

  constructor(private options: ExtendedKeepAliveOptions = {}) {
    this.strategy = options.strategy || 'timer';
    this.baseKeepAlive = new BaseKeepAlive({
      interval: options.interval,
      verbose: options.verbose,
    });

    this.customPingHandlers = options.customPingHandlers || [];

    this.stats = {
      strategy: this.strategy,
      isActive: false,
      uptime: 0,
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      portConnections: 0,
      suspensions: 0,
      resumes: 0,
      lastActivity: Date.now(),
    };
  }

  /**
   * Start the enhanced keepAlive system
   */
  async start(): Promise<boolean> {
    if (this.isActive) {
      return false;
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.updateStats({ isActive: true, lastActivity: Date.now() });

    try {
      switch (this.strategy) {
        case 'timer':
          return this.startTimerStrategy();
        case 'port':
          return await this.startPortStrategy();
        case 'hybrid':
          return await this.startHybridStrategy();
        case 'adaptive':
          return await this.startAdaptiveStrategy();
        default:
          return this.startTimerStrategy();
      }
    } catch (error) {
      this.isActive = false;
      this.updateStats({ isActive: false });

      // Try fallback strategy if available
      if (this.options.fallbackStrategy && this.options.fallbackStrategy !== this.strategy) {
        this.strategy = this.options.fallbackStrategy;
        return this.start();
      }

      throw error;
    }
  }

  /**
   * Stop the enhanced keepAlive system
   */
  stop(): boolean {
    if (!this.isActive) {
      return false;
    }

    this.isActive = false;
    this.updateStats({ isActive: false });

    // Stop all strategies
    this.baseKeepAlive.stop();
    this.stopPortStrategy();
    this.stopSuspensionDetector();

    return true;
  }

  /**
   * Get current keepAlive statistics
   */
  getStats(): KeepAliveStats {
    if (this.isActive && this.startTime > 0) {
      this.updateStats({ uptime: Date.now() - this.startTime });
    }
    return { ...this.stats };
  }

  /**
   * Check if the keepAlive system is active
   */
  isKeepAliveActive(): boolean {
    return this.isActive;
  }

  /**
   * Set service worker lifecycle event listeners
   */
  setLifecycleListeners(listeners: ServiceWorkerLifecycleEvents): void {
    this.listeners = { ...listeners };
  }

  /**
   * Add custom ping handler
   */
  addCustomPingHandler(handler: () => Promise<void> | void): void {
    this.customPingHandlers.push(handler);
  }

  /**
   * Remove custom ping handler
   */
  removeCustomPingHandler(handler: () => Promise<void> | void): void {
    const index = this.customPingHandlers.indexOf(handler);
    if (index > -1) {
      this.customPingHandlers.splice(index, 1);
    }
  }

  /**
   * Manually perform a keepAlive ping
   */
  async performManualPing(): Promise<void> {
    this.updateStats({ totalPings: this.stats.totalPings + 1 });

    try {
      // Execute base keepAlive ping
      await this.executeBasePing();

      // Execute custom ping handlers
      await this.executeCustomPings();

      // Send port ping if available
      if (this.port && this.port.isConnected()) {
        await this.sendPortPing();
      }

      this.updateStats({
        successfulPings: this.stats.successfulPings + 1,
        lastActivity: Date.now(),
      });
    } catch (error) {
      this.updateStats({ failedPings: this.stats.failedPings + 1 });
      throw error;
    }
  }

  /**
   * Start timer-based strategy
   */
  private startTimerStrategy(): boolean {
    const success = this.baseKeepAlive.start();

    if (this.options.monitorActivity) {
      this.startSuspensionDetector();
    }

    return success;
  }

  /**
   * Start port-based strategy
   */
  private async startPortStrategy(): Promise<boolean> {
    const portName = this.options.portName || 'keepalive-port';

    try {
      this.port = createStreamingPort<KeepAlivePingMessage | KeepAlivePongMessage>(portName, {
        autoReconnect: this.options.autoReconnect ?? true,
        reconnectDelay: this.options.reconnectDelay || 1000,
        maxReconnectAttempts: this.options.maxReconnectAttempts || 5,
      });

      // Set up port event listeners
      this.setupPortListeners();

      // Connect the port
      await this.port.connect();

      // Start port ping timer
      this.startPortPingTimer();

      this.updateStats({ portConnections: this.stats.portConnections + 1 });

      if (this.options.monitorActivity) {
        this.startSuspensionDetector();
      }

      return true;
    } catch (error) {
      this.port = null;
      throw error;
    }
  }

  /**
   * Start hybrid strategy (timer + port)
   */
  private async startHybridStrategy(): Promise<boolean> {
    const timerSuccess = this.startTimerStrategy();

    try {
      await this.startPortStrategy();
      return timerSuccess;
    } catch (error) {
      // Port strategy failed, but timer strategy might still work
      return timerSuccess;
    }
  }

  /**
   * Start adaptive strategy
   */
  private async startAdaptiveStrategy(): Promise<boolean> {
    // Try port strategy first (most reliable for long connections)
    try {
      return await this.startPortStrategy();
    } catch (error) {
      // Fall back to hybrid strategy
      try {
        return await this.startHybridStrategy();
      } catch (hybridError) {
        // Fall back to timer strategy
        return this.startTimerStrategy();
      }
    }
  }

  /**
   * Stop port-based strategy
   */
  private stopPortStrategy(): void {
    if (this.portPingTimer) {
      clearInterval(this.portPingTimer);
      this.portPingTimer = null;
    }

    if (this.port) {
      this.port.destroy();
      this.port = null;
    }
  }

  /**
   * Set up port event listeners
   */
  private setupPortListeners(): void {
    if (!this.port) return;

    // Handle port messages (pongs)
    this.port.getNativePort()?.onMessage.addListener((message: KeepAlivePongMessage) => {
      if (message.type === 'keepalive-pong') {
        this.handlePortPong(message);
      }
    });

    // Handle port disconnection
    this.port.getNativePort()?.onDisconnect.addListener(() => {
      // Port will auto-reconnect if configured
    });
  }

  /**
   * Start port ping timer
   */
  private startPortPingTimer(): void {
    const interval = this.options.portPingInterval || 25000; // 25 seconds

    this.portPingTimer = setInterval(async () => {
      if (this.port && this.port.isConnected()) {
        try {
          await this.sendPortPing();
        } catch (error) {
          // Port ping failed, will be handled by port management
        }
      }
    }, interval);
  }

  /**
   * Send a ping through the port
   */
  private async sendPortPing(): Promise<void> {
    if (!this.port || !this.port.isConnected()) {
      throw new Error('Port not connected');
    }

    const pingMessage: KeepAlivePingMessage = {
      type: 'keepalive-ping',
      data: {
        timestamp: Date.now(),
        strategy: this.strategy,
        pingId: this.generatePingId(),
      },
    };

    // Send the ping message through the port
    this.port.postMessage(pingMessage);
  }

  /**
   * Handle port pong response
   */
  private handlePortPong(pong: KeepAlivePongMessage): void {
    if (pong.data) {
      const now = Date.now();

      // Update statistics
      this.updateStats({
        lastActivity: now,
        successfulPings: this.stats.successfulPings + 1,
      });
    }
  }

  /**
   * Execute base keepAlive ping
   */
  private async executeBasePing(): Promise<void> {
    // Use Chrome API calls for lightweight activity
    await chrome.runtime.getPlatformInfo();

    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.getBytesInUse();
    }
  }

  /**
   * Execute custom ping handlers
   */
  private async executeCustomPings(): Promise<void> {
    const promises = this.customPingHandlers.map(handler => {
      try {
        const result = handler();
        return Promise.resolve(result);
      } catch (error) {
        return Promise.resolve(); // Don't let custom handler failures break the ping
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Start suspension detector
   */
  private startSuspensionDetector(): void {
    const checkInterval = 10000; // Check every 10 seconds
    const suspensionThreshold = 35000; // Consider suspended if no activity for 35 seconds

    this.suspensionDetector = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivityTime;

      if (timeSinceLastActivity > suspensionThreshold) {
        // Potential suspension detected
        this.handleSuspension();
      } else {
        // Update last activity time
        this.lastActivityTime = now;
      }
    }, checkInterval);
  }

  /**
   * Stop suspension detector
   */
  private stopSuspensionDetector(): void {
    if (this.suspensionDetector) {
      clearInterval(this.suspensionDetector);
      this.suspensionDetector = null;
    }
  }

  /**
   * Handle service worker suspension
   */
  private handleSuspension(): void {
    this.updateStats({ suspensions: this.stats.suspensions + 1 });
    this.listeners.onSuspend?.();

    // Try to resume activity
    this.performManualPing().catch(() => {
      // Ping failed, service worker might be suspended
    });
  }

  /**
   * Handle service worker resume
   */
  handleResume(): void {
    this.updateStats({
      resumes: this.stats.resumes + 1,
      lastActivity: Date.now(),
    });
    this.listeners.onResume?.();
    this.lastActivityTime = Date.now();
  }

  /**
   * Generate unique ping ID
   */
  private generatePingId(): string {
    return `ping_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Update statistics
   */
  private updateStats(updates: Partial<KeepAliveStats>): void {
    this.stats = { ...this.stats, ...updates };
  }
}

/**
 * Global enhanced keepAlive instance
 */
let globalEnhancedKeepAlive: EnhancedKeepAlive | null = null;

/**
 * Get or create the global enhanced keepAlive instance
 */
export function getEnhancedKeepAlive(options?: ExtendedKeepAliveOptions): EnhancedKeepAlive {
  if (!globalEnhancedKeepAlive) {
    globalEnhancedKeepAlive = new EnhancedKeepAlive(options);
  }
  return globalEnhancedKeepAlive;
}

/**
 * Start the enhanced keepAlive system
 */
export async function startEnhancedKeepAlive(options?: ExtendedKeepAliveOptions): Promise<boolean> {
  const keepAlive = getEnhancedKeepAlive(options);
  return keepAlive.start();
}

/**
 * Stop the enhanced keepAlive system
 */
export function stopEnhancedKeepAlive(): boolean {
  if (!globalEnhancedKeepAlive) {
    return false;
  }
  return globalEnhancedKeepAlive.stop();
}

/**
 * Check if enhanced keepAlive is active
 */
export function isEnhancedKeepAliveActive(): boolean {
  return globalEnhancedKeepAlive?.isKeepAliveActive() || false;
}

/**
 * Get enhanced keepAlive statistics
 */
export function getEnhancedKeepAliveStats(): KeepAliveStats | null {
  return globalEnhancedKeepAlive?.getStats() || null;
}

/**
 * Compatibility layer - re-export base keepAlive functions for backward compatibility
 */
export {
  BaseKeepAlive as KeepAlive,
  type BaseKeepAliveOptions as KeepAliveOptions,
  baseStartKeepAlive as startKeepAlive,
  baseStopKeepAlive as stopKeepAlive,
  baseIsKeepAliveActive as isKeepAliveActive,
};

/**
 * Service worker lifecycle management utilities
 */
export class ServiceWorkerLifecycleManager {
  private lifecycleListeners: ServiceWorkerLifecycleEvents = {};

  /**
   * Set up service worker lifecycle event handlers
   */
  setupLifecycleHandlers(listeners: ServiceWorkerLifecycleEvents): void {
    this.lifecycleListeners = { ...listeners };

    // Set up Chrome service worker event listeners
    if (typeof self !== 'undefined' && 'serviceWorker' in self) {
      self.addEventListener('install', () => {
        this.lifecycleListeners.onInstall?.();
      });

      self.addEventListener('activate', () => {
        this.lifecycleListeners.onActivate?.();
      });

      // Note: suspend/resume events are not directly available in Chrome
      // These would be detected through keepAlive mechanisms
    }
  }

  /**
   * Force service worker to stay active
   */
  preventSuspension(options?: ExtendedKeepAliveOptions): Promise<boolean> {
    return startEnhancedKeepAlive({
      strategy: 'hybrid',
      monitorActivity: true,
      ...options,
    });
  }

  /**
   * Allow service worker to suspend
   */
  allowSuspension(): boolean {
    return stopEnhancedKeepAlive();
  }

  /**
   * Check service worker health
   */
  async checkServiceWorkerHealth(): Promise<{
    isActive: boolean;
    uptime: number;
    strategy: KeepAliveStrategy;
    lastActivity: number;
  }> {
    const stats = getEnhancedKeepAliveStats();

    return {
      isActive: stats?.isActive || false,
      uptime: stats?.uptime || 0,
      strategy: stats?.strategy || 'timer',
      lastActivity: stats?.lastActivity || 0,
    };
  }
}

/**
 * Global service worker lifecycle manager
 */
export const serviceWorkerLifecycleManager = new ServiceWorkerLifecycleManager();

/**
 * Utility functions for common keepAlive patterns
 */

/**
 * Create a keepAlive system optimized for long-running tasks
 */
export async function createLongRunningKeepAlive(
  options?: ExtendedKeepAliveOptions
): Promise<EnhancedKeepAlive> {
  const keepAlive = new EnhancedKeepAlive({
    strategy: 'hybrid',
    interval: 15000, // 15 seconds
    portPingInterval: 20000, // 20 seconds
    autoReconnect: true,
    maxReconnectAttempts: 10,
    monitorActivity: true,
    ...options,
  });

  await keepAlive.start();
  return keepAlive;
}

/**
 * Create a keepAlive system optimized for infrequent activity
 */
export async function createLightweightKeepAlive(
  options?: ExtendedKeepAliveOptions
): Promise<EnhancedKeepAlive> {
  const keepAlive = new EnhancedKeepAlive({
    strategy: 'timer',
    interval: 25000, // 25 seconds
    monitorActivity: false,
    ...options,
  });

  await keepAlive.start();
  return keepAlive;
}

/**
 * Create an adaptive keepAlive system that adjusts based on usage patterns
 */
export async function createAdaptiveKeepAlive(
  options?: ExtendedKeepAliveOptions
): Promise<EnhancedKeepAlive> {
  const keepAlive = new EnhancedKeepAlive({
    strategy: 'adaptive',
    fallbackStrategy: 'hybrid',
    interval: 20000, // 20 seconds
    portPingInterval: 25000, // 25 seconds
    autoReconnect: true,
    monitorActivity: true,
    ...options,
  });

  await keepAlive.start();
  return keepAlive;
}
