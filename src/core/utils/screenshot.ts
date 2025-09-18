/**
 * @file Screenshot and clipboard utility functions
 * Pure utility functions for handling screenshots and clipboard operations
 */

export const SYSTEM_CAPTURE_HIDE_DELAY_MS = 600;
export const CLIPBOARD_POLL_ATTEMPTS = 6;
export const CLIPBOARD_POLL_INTERVAL_MS = 200;

export interface ClipboardImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load image dimensions from a data URL
 */
export const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      reject(new Error('Failed to decode screenshot image'));
    };
    image.src = src;
  });
};

/**
 * Convert a Blob to a data URL
 */
export const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read clipboard image'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Try to read an image from the clipboard
 */
export const tryReadClipboardImage = async (): Promise<ClipboardImageResult | null> => {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('Clipboard read is not supported in this browser');
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find(type => type.startsWith('image/'));
    if (!imageType) continue;

    const blob = await item.getType(imageType);
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await loadImageDimensions(dataUrl);

    return {
      dataUrl,
      width,
      height,
    };
  }

  return null;
};

/**
 * Read clipboard image with retries
 */
export const readClipboardImageWithRetries = async (
  attempts: number,
  intervalMs: number
): Promise<ClipboardImageResult | null> => {
  for (let i = 0; i < attempts; i += 1) {
    const image = await tryReadClipboardImage();
    if (image) {
      return image;
    }

    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  return null;
};
