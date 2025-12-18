/**
 * @file Hotkey Utility Tests
 *
 * Tests for keyboard event handling and hotkey detection.
 */

import { describe, it, expect } from 'vitest';
import { isSystemCaptureHotkey, type HotkeyConfig } from '@core/utils/hotkeys';

// Helper to create a minimal KeyboardEvent
function createKeyboardEvent(options: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent {
  return {
    key: options.key,
    code: options.code || '',
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    shiftKey: options.shiftKey || false,
    metaKey: options.metaKey || false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as KeyboardEvent;
}

describe('isSystemCaptureHotkey', () => {
  describe('disabled state', () => {
    it('should return false when hotkey is disabled', () => {
      const config: HotkeyConfig = { enabled: false, modifiers: ['ctrl'], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });

    it('should return false when key is empty', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: '' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });
  });

  describe('modifier exact match', () => {
    it('should match when all required modifiers are pressed', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl', 'shift'], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true, shiftKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should not match when extra modifiers are pressed', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true, altKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });

    it('should not match when required modifier is missing', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl', 'alt'], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });

    it('should match with no modifiers required', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'a' };
      const event = createKeyboardEvent({ key: 'a' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should not match when modifiers pressed but not required', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });
  });

  describe('individual modifiers', () => {
    it('should match ctrl modifier', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: 'c' };
      const event = createKeyboardEvent({ key: 'c', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match alt modifier', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['alt'], key: 'a' };
      const event = createKeyboardEvent({ key: 'a', altKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match shift modifier', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['shift'], key: 's' };
      const event = createKeyboardEvent({ key: 'S', shiftKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match meta modifier', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['meta'], key: 'm' };
      const event = createKeyboardEvent({ key: 'm', metaKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });
  });

  describe('case insensitive key matching', () => {
    it('should match uppercase event key to lowercase config', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'a' };
      const event = createKeyboardEvent({ key: 'A' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match lowercase event key to uppercase config', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'A' };
      const event = createKeyboardEvent({ key: 'a' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });
  });

  describe('digit keys', () => {
    it('should match digit key by key property', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: '1' };
      const event = createKeyboardEvent({ key: '1', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match digit key by code property (Digit)', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: '2' };
      const event = createKeyboardEvent({ key: '!', code: 'Digit2', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match digit key by code property (Numpad)', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: '5' };
      const event = createKeyboardEvent({ key: '5', code: 'Numpad5' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match all digits 0-9', () => {
      for (let i = 0; i <= 9; i++) {
        const config: HotkeyConfig = { enabled: true, modifiers: [], key: String(i) };
        const event = createKeyboardEvent({ key: String(i) });

        expect(isSystemCaptureHotkey(event, config)).toBe(true);
      }
    });
  });

  describe('function keys (F1-F12)', () => {
    it('should match F1 key', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'F1' };
      const event = createKeyboardEvent({ key: 'F1', code: 'F1' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match F12 key', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'F12' };
      const event = createKeyboardEvent({ key: 'F12', code: 'F12' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match function key case insensitively', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'f5' };
      const event = createKeyboardEvent({ key: 'F5', code: 'F5' });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match F1-F9', () => {
      for (let i = 1; i <= 9; i++) {
        const config: HotkeyConfig = { enabled: true, modifiers: [], key: `F${i}` };
        const event = createKeyboardEvent({ key: `F${i}`, code: `F${i}` });

        expect(isSystemCaptureHotkey(event, config)).toBe(true);
      }
    });

    it('should match F10-F12', () => {
      for (let i = 10; i <= 12; i++) {
        const config: HotkeyConfig = { enabled: true, modifiers: [], key: `F${i}` };
        const event = createKeyboardEvent({ key: `F${i}`, code: `F${i}` });

        expect(isSystemCaptureHotkey(event, config)).toBe(true);
      }
    });
  });

  describe('combined modifiers and special keys', () => {
    it('should match Ctrl+Shift+1', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl', 'shift'], key: '1' };
      const event = createKeyboardEvent({
        key: '!',
        code: 'Digit1',
        ctrlKey: true,
        shiftKey: true,
      });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match Alt+F4', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['alt'], key: 'F4' };
      const event = createKeyboardEvent({ key: 'F4', code: 'F4', altKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });

    it('should match Ctrl+Meta+Shift+A', () => {
      const config: HotkeyConfig = {
        enabled: true,
        modifiers: ['ctrl', 'meta', 'shift'],
        key: 'a',
      };
      const event = createKeyboardEvent({
        key: 'A',
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
      });

      expect(isSystemCaptureHotkey(event, config)).toBe(true);
    });
  });

  describe('non-matching cases', () => {
    it('should not match wrong key', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: ['ctrl'], key: 'a' };
      const event = createKeyboardEvent({ key: 'b', ctrlKey: true });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });

    it('should not match special key as letter', () => {
      const config: HotkeyConfig = { enabled: true, modifiers: [], key: 'Enter' };
      const event = createKeyboardEvent({ key: 'e' });

      expect(isSystemCaptureHotkey(event, config)).toBe(false);
    });
  });
});
