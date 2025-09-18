/**
 * @file Hotkey detection and handling utilities
 * Pure utility functions for keyboard event handling
 */

export interface HotkeyConfig {
  enabled: boolean;
  modifiers: string[];
  key: string;
}

/**
 * Check if a keyboard event matches a configured hotkey
 */
export const isSystemCaptureHotkey = (event: KeyboardEvent, hotkey: HotkeyConfig): boolean => {
  if (!hotkey.enabled || !hotkey.key) {
    return false;
  }

  // Check if all required modifiers are pressed
  const modifiersMatch =
    (!hotkey.modifiers.includes('ctrl') || event.ctrlKey) &&
    (!hotkey.modifiers.includes('alt') || event.altKey) &&
    (!hotkey.modifiers.includes('shift') || event.shiftKey) &&
    (!hotkey.modifiers.includes('meta') || event.metaKey) &&
    // Also check that ONLY the required modifiers are pressed
    hotkey.modifiers.includes('ctrl') === event.ctrlKey &&
    hotkey.modifiers.includes('alt') === event.altKey &&
    hotkey.modifiers.includes('shift') === event.shiftKey &&
    hotkey.modifiers.includes('meta') === event.metaKey;

  if (!modifiersMatch) {
    return false;
  }

  // Check if the key matches (case-insensitive)
  const pressedKey = event.key.toLowerCase();
  const configuredKey = hotkey.key.toLowerCase();

  // Handle both event.key and event.code for better compatibility
  if (pressedKey === configuredKey) {
    return true;
  }

  // Handle digit keys generically - if configured key is a digit, check the code
  if (configuredKey.match(/^[0-9]$/)) {
    const digitCode = `Digit${configuredKey}`;
    const numpadCode = `Numpad${configuredKey}`;
    if (event.code === digitCode || event.code === numpadCode) {
      return true;
    }
  }

  // Handle function keys (F1-F12)
  if (configuredKey.match(/^f([1-9]|1[0-2])$/i)) {
    if (event.code.toLowerCase() === configuredKey.toLowerCase()) {
      return true;
    }
  }

  return false;
};
