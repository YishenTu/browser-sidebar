/**
 * @file Keep Alive System
 *
 * Prevents the service worker from being suspended by maintaining periodic activity.
 * Chrome extension service workers are suspended after 30 seconds of inactivity,
 * which can interrupt background operations.
 */

import { getPlatformInfo } from '@platform/chrome/runtime';
import { getStorageQuota } from '@platform/chrome/storage';
import { getAllAlarms } from '@platform/chrome/alarms';

/**
 * Configuration options for the KeepAlive system
 */
export interface KeepAliveOptions {
  /** Interval between keep-alive pings in milliseconds (default: 20000) */
  interval?: number;
  /** Whether to log keep-alive activity for debugging (default: false) */
  verbose?: boolean;
}

/**
 * Manages keep-alive functionality to prevent service worker suspension
 */
export class KeepAlive {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly interval: number;
  private pingCount = 0;

  constructor(options: KeepAliveOptions = {}) {
    this.interval = options.interval || 20000; // 20 seconds default
  }

  /**
   * Start the keep-alive system
   *
   * @returns True if started successfully, false if already running
   */
  start(): boolean {
    if (this.isRunning) {
      return false;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.performKeepAlivePing();
    }, this.interval);

    // Perform initial ping
    this.performKeepAlivePing();

    return true;
  }

  /**
   * Stop the keep-alive system
   *
   * @returns True if stopped successfully, false if not running
   */
  stop(): boolean {
    if (!this.isRunning) {
      return false;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    return true;
  }

  /**
   * Check if the keep-alive system is currently running
   *
   * @returns True if running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the current ping count
   *
   * @returns Number of pings performed
   */
  getPingCount(): number {
    return this.pingCount;
  }

  /**
   * Reset the ping count
   */
  resetPingCount(): void {
    this.pingCount = 0;
  }

  /**
   * Perform a keep-alive ping using Chrome API
   * This method uses chrome.runtime.getPlatformInfo() as a lightweight
   * operation that keeps the service worker active.
   */
  private async performKeepAlivePing(): Promise<void> {
    try {
      this.pingCount++;

      // Use a lightweight Chrome API call to maintain activity
      await getPlatformInfo();

      // Additional lightweight operations to ensure activity
      await this.performAdditionalPings();
    } catch (error) {
      // If the primary method fails, try alternative approaches
      this.performFallbackPing();
    }
  }

  /**
   * Perform additional lightweight operations
   */
  private async performAdditionalPings(): Promise<void> {
    try {
      // Check storage quota (lightweight operation)
      try {
        await getStorageQuota();
      } catch {
        // Ignore errors for storage operations
      }

      // Check if any alarms are set (another lightweight operation)
      await getAllAlarms();
    } catch (error) {
      // These are optional operations, so we don't need to handle failures
    }
  }

  /**
   * Fallback ping method when primary methods fail
   */
  private performFallbackPing(): void {
    try {
      // Use a simple calculation as absolute fallback
      const timestamp = Date.now();
      Math.sqrt(timestamp) + Math.random();
    } catch (error) {
      // Even fallback ping failed
    }
  }
}

/**
 * Global keep-alive instance for the service worker
 */
let globalKeepAlive: KeepAlive | null = null;

/**
 * Get or create the global keep-alive instance
 *
 * @param options - Configuration options
 * @returns The global KeepAlive instance
 */
export function getKeepAlive(options?: KeepAliveOptions): KeepAlive {
  if (!globalKeepAlive) {
    globalKeepAlive = new KeepAlive(options);
  }
  return globalKeepAlive;
}

/**
 * Start the global keep-alive system
 *
 * @param options - Configuration options
 * @returns True if started successfully
 */
export function startKeepAlive(options?: KeepAliveOptions): boolean {
  const keepAlive = getKeepAlive(options);
  return keepAlive.start();
}

/**
 * Stop the global keep-alive system
 *
 * @returns True if stopped successfully
 */
export function stopKeepAlive(): boolean {
  if (!globalKeepAlive) {
    return false;
  }
  return globalKeepAlive.stop();
}

/**
 * Check if the global keep-alive system is active
 *
 * @returns True if active
 */
export function isKeepAliveActive(): boolean {
  return globalKeepAlive?.isActive() || false;
}
