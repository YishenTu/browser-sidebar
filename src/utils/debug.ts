/**
 * @file Debug Logging Utility
 *
 * Provides a centralized debug logging function that respects the debug mode setting
 */

/* eslint-disable no-console */

import { useSettingsStore } from '@store/settings';

/**
 * Debug log function that only outputs when debug mode is enabled
 * @param module The module/component name for context
 * @param args Arguments to log
 */
export function debugLog(module: string, ...args: unknown[]): void {
  const settings = useSettingsStore.getState();
  const debugMode = settings.settings.ui?.debugMode || false;

  if (debugMode) {
    console.log(`[${module}]`, ...args);
  }
}

/**
 * Debug error function that only outputs when debug mode is enabled
 * @param module The module/component name for context
 * @param args Arguments to log
 */
export function debugError(module: string, ...args: unknown[]): void {
  const settings = useSettingsStore.getState();
  const debugMode = settings.settings.ui?.debugMode || false;

  if (debugMode) {
    console.error(`[${module}]`, ...args);
  }
}

/**
 * Debug warn function that only outputs when debug mode is enabled
 * @param module The module/component name for context
 * @param args Arguments to log
 */
export function debugWarn(module: string, ...args: unknown[]): void {
  const settings = useSettingsStore.getState();
  const debugMode = settings.settings.ui?.debugMode || false;

  if (debugMode) {
    console.warn(`[${module}]`, ...args);
  }
}
