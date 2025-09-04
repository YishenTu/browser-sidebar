/**
 * @file Text Utilities
 *
 * Text processing utilities including truncation, word counting, and excerpt generation.
 */

/**
 * Text clamping result
 */
export interface ClampResult {
  /** Clamped text content */
  text: string;
  /** Whether the text was truncated */
  isTruncated: boolean;
}

/**
 * Safely truncates text to maximum character count
 *
 * @param text - Text to truncate (can be null/undefined)
 * @param maxChars - Maximum number of characters
 * @returns Clamp result with text and truncation flag
 */
export function clampText(text: string | null | undefined, maxChars: number): ClampResult {
  // Handle null/undefined/empty text
  if (!text) {
    return {
      text: '',
      isTruncated: false,
    };
  }

  // Validate maxChars parameter
  if (maxChars < 0) {
    throw new Error('maxChars must be non-negative');
  }

  if (maxChars === 0) {
    return {
      text: '',
      isTruncated: text.length > 0,
    };
  }

  // No truncation needed
  if (text.length <= maxChars) {
    return {
      text,
      isTruncated: false,
    };
  }

  // Truncate the text
  return {
    text: text.substring(0, maxChars),
    isTruncated: true,
  };
}
