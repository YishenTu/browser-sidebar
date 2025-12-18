/**
 * @file Time Helpers
 *
 * Utilities for controlling time in tests:
 * - freezeTime() / unfreezeTime() for deterministic Date.now()
 * - mockMathRandom() for deterministic random values
 * - flushPromises() for awaiting microtask queue
 */

import { vi } from 'vitest';

// =============================================================================
// Time Freezing
// =============================================================================

let frozenTime: number | null = null;
let originalDateNow: typeof Date.now | null = null;

/**
 * Freeze time at a specific timestamp.
 * All calls to Date.now() will return this value until unfreezeTime() is called.
 *
 * @param timestamp - Unix timestamp in milliseconds. Defaults to a fixed test time.
 * @returns The frozen timestamp
 *
 * @example
 * ```ts
 * freezeTime(1700000000000);
 * expect(Date.now()).toBe(1700000000000);
 * unfreezeTime();
 * ```
 */
export function freezeTime(timestamp: number = 1700000000000): number {
  if (originalDateNow === null) {
    originalDateNow = Date.now;
  }
  frozenTime = timestamp;
  Date.now = () => frozenTime!;
  return frozenTime;
}

/**
 * Unfreeze time, restoring the original Date.now() behavior.
 */
export function unfreezeTime(): void {
  if (originalDateNow !== null) {
    Date.now = originalDateNow;
    originalDateNow = null;
  }
  frozenTime = null;
}

/**
 * Get the currently frozen time, or null if time is not frozen.
 */
export function getFrozenTime(): number | null {
  return frozenTime;
}

/**
 * Advance frozen time by a specified amount.
 * Only works if time is already frozen.
 *
 * @param ms - Milliseconds to advance
 * @returns The new frozen timestamp
 * @throws Error if time is not frozen
 *
 * @example
 * ```ts
 * freezeTime(1000);
 * advanceTime(500);
 * expect(Date.now()).toBe(1500);
 * ```
 */
export function advanceTime(ms: number): number {
  if (frozenTime === null) {
    throw new Error('Cannot advance time: time is not frozen. Call freezeTime() first.');
  }
  frozenTime += ms;
  return frozenTime;
}

// =============================================================================
// Fake Timers
// =============================================================================

/**
 * Install Vitest fake timers with a specific system time.
 * This controls setTimeout, setInterval, and Date.now() together.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Cleanup function to restore real timers
 *
 * @example
 * ```ts
 * const cleanup = useFakeTimers(1700000000000);
 * // ... test code
 * cleanup();
 * ```
 */
export function useFakeTimers(timestamp: number = 1700000000000): () => void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(timestamp));

  return () => {
    vi.useRealTimers();
  };
}

/**
 * Advance Vitest fake timers by a specified amount.
 * @param ms - Milliseconds to advance
 */
export async function advanceFakeTimers(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/**
 * Run all pending timers (setTimeout, setInterval).
 */
export async function runAllTimers(): Promise<void> {
  await vi.runAllTimersAsync();
}

/**
 * Run only pending timers (not intervals).
 */
export async function runOnlyPendingTimers(): Promise<void> {
  await vi.runOnlyPendingTimersAsync();
}

// =============================================================================
// Random Mocking
// =============================================================================

let originalMathRandom: typeof Math.random | null = null;
let randomSequence: number[] = [];
let randomIndex = 0;

/**
 * Mock Math.random() to return deterministic values.
 *
 * @param values - Array of values to return in sequence (0-1 range).
 *                 If exhausted, cycles back to the beginning.
 * @returns Cleanup function to restore original Math.random()
 *
 * @example
 * ```ts
 * const cleanup = mockMathRandom([0.1, 0.5, 0.9]);
 * expect(Math.random()).toBe(0.1);
 * expect(Math.random()).toBe(0.5);
 * expect(Math.random()).toBe(0.9);
 * expect(Math.random()).toBe(0.1); // cycles back
 * cleanup();
 * ```
 */
export function mockMathRandom(values: number[] = [0.5]): () => void {
  if (originalMathRandom === null) {
    originalMathRandom = Math.random;
  }
  randomSequence = values;
  randomIndex = 0;

  Math.random = () => {
    const value = randomSequence[randomIndex % randomSequence.length]!;
    randomIndex++;
    return value;
  };

  return () => {
    if (originalMathRandom !== null) {
      Math.random = originalMathRandom;
      originalMathRandom = null;
    }
    randomSequence = [];
    randomIndex = 0;
  };
}

/**
 * Reset the random sequence index to start from the beginning.
 */
export function resetRandomSequence(): void {
  randomIndex = 0;
}

// =============================================================================
// Promise Utilities
// =============================================================================

/**
 * Flush all pending microtasks (promises).
 * Useful for waiting for async operations to complete in tests.
 *
 * @example
 * ```ts
 * someFunctionThatSchedulesMicrotasks();
 * await flushPromises();
 * expect(someState).toBe(expectedValue);
 * ```
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => {
    // Use setImmediate if available (Node.js), otherwise setTimeout
    if (typeof setImmediate === 'function') {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Flush promises multiple times to handle nested async operations.
 * @param count - Number of times to flush (default: 3)
 */
export async function flushPromisesMultiple(count: number = 3): Promise<void> {
  for (let i = 0; i < count; i++) {
    await flushPromises();
  }
}

/**
 * Wait for a condition to become true, with timeout.
 *
 * @param condition - Function that returns true when condition is met
 * @param options - Options for polling
 * @returns Promise that resolves when condition is met
 * @throws Error if timeout is reached
 *
 * @example
 * ```ts
 * let value = 0;
 * setTimeout(() => { value = 1; }, 100);
 * await waitFor(() => value === 1, { timeout: 200 });
 * expect(value).toBe(1);
 * ```
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 10 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// =============================================================================
// Delay Helpers
// =============================================================================

/**
 * Create a promise that resolves after a specified delay.
 * Useful for simulating async delays in tests.
 *
 * @param ms - Delay in milliseconds
 * @param value - Optional value to resolve with
 */
export function delay<T = void>(ms: number, value?: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value as T), ms));
}

/**
 * Create a timeout promise that rejects after a specified delay.
 *
 * @param ms - Timeout in milliseconds
 * @param message - Error message
 */
export function timeout(ms: number, message: string = 'Timeout'): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * Race a promise against a timeout.
 *
 * @param promise - Promise to race
 * @param ms - Timeout in milliseconds
 * @param message - Error message on timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([promise, timeout(ms, message)]);
}
