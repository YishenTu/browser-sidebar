/**
 * @file screenshot.test.ts
 * Tests for screenshot and clipboard utilities
 *
 * Focus:
 * - Retry loop behavior
 * - Clipboard API absence errors
 * - Image dimension loading
 * - Blob to data URL conversion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadImageDimensions,
  blobToDataUrl,
  tryReadClipboardImage,
  readClipboardImageWithRetries,
  SYSTEM_CAPTURE_HIDE_DELAY_MS,
  CLIPBOARD_POLL_ATTEMPTS,
  CLIPBOARD_POLL_INTERVAL_MS,
} from '@core/utils/screenshot';

describe('screenshot utilities', () => {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  describe('constants', () => {
    it('exports SYSTEM_CAPTURE_HIDE_DELAY_MS', () => {
      expect(SYSTEM_CAPTURE_HIDE_DELAY_MS).toBe(600);
    });

    it('exports CLIPBOARD_POLL_ATTEMPTS', () => {
      expect(CLIPBOARD_POLL_ATTEMPTS).toBe(6);
    });

    it('exports CLIPBOARD_POLL_INTERVAL_MS', () => {
      expect(CLIPBOARD_POLL_INTERVAL_MS).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // loadImageDimensions
  // ---------------------------------------------------------------------------
  describe('loadImageDimensions', () => {
    beforeEach(() => {
      // Mock Image constructor
      vi.stubGlobal(
        'Image',
        class MockImage {
          src = '';
          decoding = '';
          naturalWidth = 800;
          naturalHeight = 600;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;

          constructor() {
            // Trigger onload asynchronously when src is set
            const originalSrc = Object.getOwnPropertyDescriptor(this, 'src');
            Object.defineProperty(this, 'src', {
              set: (value: string) => {
                if (originalSrc?.set) {
                  originalSrc.set.call(this, value);
                }
                // Trigger onload after microtask
                Promise.resolve().then(() => {
                  if (this.onload) {
                    this.onload();
                  }
                });
              },
              get: () => originalSrc?.get?.call(this) || '',
            });
          }
        }
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns dimensions when image loads successfully', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

      const result = await loadImageDimensions(dataUrl);

      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('returns { width: 0, height: 0 } when Image is undefined', async () => {
      vi.stubGlobal('Image', undefined);

      const result = await loadImageDimensions('data:image/png;base64,test');

      expect(result).toEqual({ width: 0, height: 0 });
    });

    it('rejects when image fails to decode', async () => {
      vi.stubGlobal(
        'Image',
        class MockImage {
          src = '';
          decoding = '';
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;

          constructor() {
            Object.defineProperty(this, 'src', {
              set: () => {
                Promise.resolve().then(() => {
                  if (this.onerror) {
                    this.onerror();
                  }
                });
              },
            });
          }
        }
      );

      await expect(loadImageDimensions('invalid-data')).rejects.toThrow(
        'Failed to decode screenshot image'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // blobToDataUrl
  // ---------------------------------------------------------------------------
  describe('blobToDataUrl', () => {
    it('converts blob to data URL', async () => {
      const blob = new Blob(['test image data'], { type: 'image/png' });

      const result = await blobToDataUrl(blob);

      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('handles empty blob', async () => {
      const blob = new Blob([], { type: 'image/png' });

      const result = await blobToDataUrl(blob);

      expect(result).toBe('data:image/png;base64,');
    });

    it('handles different mime types', async () => {
      const jpegBlob = new Blob(['jpeg data'], { type: 'image/jpeg' });

      const result = await blobToDataUrl(jpegBlob);

      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  // ---------------------------------------------------------------------------
  // tryReadClipboardImage
  // ---------------------------------------------------------------------------
  describe('tryReadClipboardImage', () => {
    beforeEach(() => {
      // Reset clipboard mock
      vi.stubGlobal('navigator', {
        clipboard: undefined,
      });

      // Mock Image for dimensions
      vi.stubGlobal(
        'Image',
        class MockImage {
          naturalWidth = 100;
          naturalHeight = 100;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;

          constructor() {
            Object.defineProperty(this, 'src', {
              set: () => {
                Promise.resolve().then(() => {
                  if (this.onload) {
                    this.onload();
                  }
                });
              },
            });
          }
        }
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('throws when clipboard.read is not available', async () => {
      vi.stubGlobal('navigator', { clipboard: {} });

      await expect(tryReadClipboardImage()).rejects.toThrow(
        'Clipboard read is not supported in this browser'
      );
    });

    it('throws when clipboard is undefined', async () => {
      vi.stubGlobal('navigator', { clipboard: undefined });

      await expect(tryReadClipboardImage()).rejects.toThrow(
        'Clipboard read is not supported in this browser'
      );
    });

    it('returns null when no image in clipboard', async () => {
      const mockClipboardItem = {
        types: ['text/plain'],
        getType: vi.fn(),
      };

      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi.fn().mockResolvedValue([mockClipboardItem]),
        },
      });

      const result = await tryReadClipboardImage();

      expect(result).toBeNull();
    });

    it('returns image result when image is in clipboard', async () => {
      const imageBlob = new Blob(['fake image data'], { type: 'image/png' });
      const mockClipboardItem = {
        types: ['image/png'],
        getType: vi.fn().mockResolvedValue(imageBlob),
      };

      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi.fn().mockResolvedValue([mockClipboardItem]),
        },
      });

      const result = await tryReadClipboardImage();

      expect(result).not.toBeNull();
      expect(result?.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result?.width).toBe(100);
      expect(result?.height).toBe(100);
    });

    it('handles multiple clipboard items and finds image', async () => {
      const textItem = {
        types: ['text/plain'],
        getType: vi.fn(),
      };
      const imageBlob = new Blob(['image'], { type: 'image/jpeg' });
      const imageItem = {
        types: ['text/plain', 'image/jpeg'],
        getType: vi.fn().mockResolvedValue(imageBlob),
      };

      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi.fn().mockResolvedValue([textItem, imageItem]),
        },
      });

      const result = await tryReadClipboardImage();

      expect(result).not.toBeNull();
      expect(imageItem.getType).toHaveBeenCalledWith('image/jpeg');
    });
  });

  // ---------------------------------------------------------------------------
  // readClipboardImageWithRetries
  // ---------------------------------------------------------------------------
  describe('readClipboardImageWithRetries', () => {
    beforeEach(() => {
      vi.useFakeTimers();

      // Default: no image in clipboard
      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi.fn().mockResolvedValue([{ types: ['text/plain'] }]),
        },
      });

      vi.stubGlobal(
        'Image',
        class MockImage {
          naturalWidth = 200;
          naturalHeight = 150;
          onload: (() => void) | null = null;

          constructor() {
            Object.defineProperty(this, 'src', {
              set: () => {
                Promise.resolve().then(() => {
                  if (this.onload) {
                    this.onload();
                  }
                });
              },
            });
          }
        }
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('returns image on first attempt if available', async () => {
      const imageBlob = new Blob(['image'], { type: 'image/png' });
      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi
            .fn()
            .mockResolvedValue([
              { types: ['image/png'], getType: vi.fn().mockResolvedValue(imageBlob) },
            ]),
        },
      });

      const resultPromise = readClipboardImageWithRetries(3, 100);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).not.toBeNull();
      expect(result?.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('retries until image is found', async () => {
      let callCount = 0;
      const imageBlob = new Blob(['image'], { type: 'image/png' });

      vi.stubGlobal('navigator', {
        clipboard: {
          read: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount >= 3) {
              return [{ types: ['image/png'], getType: vi.fn().mockResolvedValue(imageBlob) }];
            }
            return [{ types: ['text/plain'] }];
          }),
        },
      });

      const resultPromise = readClipboardImageWithRetries(5, 50);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).not.toBeNull();
      expect(callCount).toBe(3);
    });

    it('returns null after all attempts exhausted', async () => {
      const readMock = vi.fn().mockResolvedValue([{ types: ['text/plain'] }]);
      vi.stubGlobal('navigator', {
        clipboard: { read: readMock },
      });

      const resultPromise = readClipboardImageWithRetries(3, 50);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBeNull();
      expect(readMock).toHaveBeenCalledTimes(3);
    });

    it('waits between retry attempts', async () => {
      const readMock = vi.fn().mockResolvedValue([{ types: ['text/plain'] }]);
      vi.stubGlobal('navigator', {
        clipboard: { read: readMock },
      });

      const resultPromise = readClipboardImageWithRetries(3, 100);

      // First attempt immediate
      await vi.advanceTimersByTimeAsync(0);
      expect(readMock).toHaveBeenCalledTimes(1);

      // Wait for first interval
      await vi.advanceTimersByTimeAsync(100);
      expect(readMock).toHaveBeenCalledTimes(2);

      // Wait for second interval
      await vi.advanceTimersByTimeAsync(100);
      expect(readMock).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('does not wait after last attempt', async () => {
      const readMock = vi.fn().mockResolvedValue([{ types: ['text/plain'] }]);
      vi.stubGlobal('navigator', {
        clipboard: { read: readMock },
      });

      const resultPromise = readClipboardImageWithRetries(2, 100);

      // Run all timers
      await vi.runAllTimersAsync();
      await resultPromise;

      // Should only wait between attempts, not after last
      // 2 attempts with 1 interval = 100ms (not 200ms)
      expect(vi.getTimerCount()).toBe(0);
    });

    it('handles single attempt correctly', async () => {
      const readMock = vi.fn().mockResolvedValue([{ types: ['text/plain'] }]);
      vi.stubGlobal('navigator', {
        clipboard: { read: readMock },
      });

      const resultPromise = readClipboardImageWithRetries(1, 100);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBeNull();
      expect(readMock).toHaveBeenCalledTimes(1);
    });
  });
});
