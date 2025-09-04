/**
 * @file useTabMention Hook
 *
 * Custom React hook for detecting @ mentions and managing dropdown state
 * in text input elements. Provides debounced detection with proper boundary
 * checks and cursor position tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TabInfo } from '../../types/tabs';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Mention detection result
 */
export interface MentionDetection {
  /** Start index of the @ mention in the text */
  startIndex: number;
  /** Query string after the @ symbol */
  query: string;
}

/**
 * Tab mention hook options
 */
export interface UseTabMentionOptions {
  /** Debounce delay in milliseconds (default: 100ms) */
  debounceDelay?: number;
  /** Punctuation characters that stop mention detection */
  stopChars?: string[];
  /** Whether to enable mention detection (default: true) */
  enabled?: boolean;
  /** Whether the user is currently in IME composition (default: false) */
  isComposing?: boolean;
}

/**
 * Tab mention hook return interface
 */
export interface UseTabMentionReturn {
  /** Current mention detection state */
  mention: MentionDetection | null;
  /** Whether mention dropdown should be visible */
  showDropdown: boolean;
  /** Function to detect mentions in text at cursor position */
  detectMention: (text: string, cursorPosition: number) => MentionDetection | null;
  /** Function to insert tab reference replacing @ mention */
  insertTab: (
    text: string,
    tab: TabInfo,
    mention: MentionDetection
  ) => { newText: string; newCursorPosition: number };
  /** Function to clear current mention state */
  clearMention: () => void;
  /** Function to manually set mention state */
  setMention: (mention: MentionDetection | null) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default debounce delay in milliseconds */
const DEFAULT_DEBOUNCE_DELAY = 100;

/**
 * Punctuation characters that stop mention detection
 * Includes: sentence punctuation, brackets, quotes, and line breaks
 */
const DEFAULT_STOP_CHARS = [
  // Sentence punctuation
  '.',
  ',',
  '!',
  '?',
  ';',
  ':',
  // Brackets and braces
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  // Quotes and code
  '"',
  "'",
  '`',
  // Line breaks and special chars
  '\n',
  '\r',
  '/',
  '\\',
  '|',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '=',
  '+',
  '~',
];

/** Whitespace characters that can precede an @ mention */
const WHITESPACE_CHARS = [' ', '\t', '\n', '\r'];

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for detecting and managing @ tab mentions in text inputs
 *
 * This hook provides functionality to detect @ mentions that follow proper
 * word boundaries (whitespace or line start), with configurable debouncing
 * for performance optimization.
 *
 * @param options - Configuration options for the hook
 * @returns Hook interface with mention detection and insertion functions
 */
export function useTabMention(options: UseTabMentionOptions = {}): UseTabMentionReturn {
  const {
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    stopChars = DEFAULT_STOP_CHARS,
    enabled = true,
    isComposing = false,
  } = options;

  // State management
  const [mention, setMentionState] = useState<MentionDetection | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Debounce timer reference
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * Core mention detection logic
   *
   * Optimized O(1) detection that:
   * 1. Only searches from cursor back to last whitespace (not entire text)
   * 2. Checks @ is preceded by whitespace or at text start
   * 3. Validates query doesn't contain punctuation
   *
   * Performance: O(k) where k is distance from cursor to last whitespace,
   * not O(n) where n is full text length.
   */
  const detectMentionInternal = useCallback(
    (text: string, cursorPosition: number): MentionDetection | null => {
      // Don't detect mentions during IME composition
      if (isComposing) {
        return null;
      }

      if (!enabled || !text || cursorPosition < 0) {
        return null;
      }

      // Performance optimization: only search back to last whitespace
      // This makes detection O(k) where k is word length, not O(n) text length
      let searchStart = cursorPosition - 1;
      let lastWhitespaceIndex = -1;

      // Find the last whitespace before cursor (limit search to 100 chars for safety)
      const maxSearchDistance = Math.min(100, cursorPosition);
      for (let i = cursorPosition - 1; i >= Math.max(0, cursorPosition - maxSearchDistance); i--) {
        if (WHITESPACE_CHARS.includes(text[i] ?? '') || stopChars.includes(text[i] ?? '')) {
          lastWhitespaceIndex = i;
          break;
        }
      }

      // Search for @ from last whitespace to cursor
      searchStart = lastWhitespaceIndex + 1;
      let atIndex = -1;

      for (let i = searchStart; i < cursorPosition && i < text.length; i++) {
        if (text[i] === '@') {
          atIndex = i;
          // Only keep the most recent @
          // Don't break - continue to find the last one
        }
      }

      // No @ found in current word
      if (atIndex === -1) {
        return null;
      }

      // Check if @ is at start or preceded by whitespace
      if (atIndex > 0) {
        const charBefore = text[atIndex - 1];
        if (!WHITESPACE_CHARS.includes(charBefore ?? '')) {
          return null;
        }
      }

      // Extract query from @ to cursor position
      const queryStart = atIndex + 1;
      const queryEnd = Math.min(cursorPosition, text.length);
      const query = text.substring(queryStart, queryEnd);

      // Check if query contains stop characters
      for (const stopChar of stopChars) {
        if (query.includes(stopChar)) {
          return null;
        }
      }

      // Valid mention found
      return {
        startIndex: atIndex,
        query: query.trim(),
      };
    },
    [enabled, stopChars, isComposing]
  );

  /**
   * Debounced mention detection function
   *
   * Uses a timer to debounce detection calls for performance optimization.
   * The debouncing prevents excessive computation during rapid typing.
   */
  const detectMention = useCallback(
    (text: string, cursorPosition: number): MentionDetection | null => {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Immediate detection for the return value
      const immediateResult = detectMentionInternal(text, cursorPosition);

      // Debounced state update
      debounceTimer.current = setTimeout(() => {
        const debouncedResult = detectMentionInternal(text, cursorPosition);
        setMentionState(debouncedResult);
        setShowDropdown(debouncedResult !== null);
      }, debounceDelay);

      return immediateResult;
    },
    [detectMentionInternal, debounceDelay]
  );

  /**
   * Insert tab reference replacing @ mention
   *
   * Replaces the @ mention with a formatted tab reference and calculates
   * the new cursor position after insertion.
   */
  const insertTab = useCallback(
    (
      text: string,
      tab: TabInfo,
      mentionToReplace: MentionDetection
    ): { newText: string; newCursorPosition: number } => {
      const { startIndex } = mentionToReplace;

      // Create tab reference format: "Tab: [title] (domain)"
      const tabReference = `Tab: ${tab.title} (${tab.domain})`;

      // Find the end of the mention
      // We need to find where the current word ends, not where the cursor is
      let endIndex = startIndex + 1; // Start after @

      // Find the end of the word after @
      for (let i = endIndex; i < text.length; i++) {
        const char = text[i];
        if (WHITESPACE_CHARS.includes(char ?? '') || stopChars.includes(char ?? '')) {
          endIndex = i;
          break;
        }
      }

      // If no terminator found, mention goes to end of text
      if (endIndex === startIndex + 1) {
        endIndex = text.length;
      }

      // Replace the mention with tab reference
      const beforeMention = text.substring(0, startIndex);
      const afterMention = text.substring(endIndex);
      const newText = beforeMention + tabReference + afterMention;

      // Calculate new cursor position (after the inserted reference)
      const newCursorPosition = startIndex + tabReference.length;

      return {
        newText,
        newCursorPosition,
      };
    },
    [stopChars]
  );

  /**
   * Clear mention state and hide dropdown
   */
  const clearMention = useCallback(() => {
    // Clear debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    setMentionState(null);
    setShowDropdown(false);
  }, []);

  /**
   * Manually set mention state
   *
   * Allows external control of the mention state, useful for testing
   * or advanced use cases.
   */
  const setMention = useCallback((newMention: MentionDetection | null) => {
    setMentionState(newMention);
    setShowDropdown(newMention !== null);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    mention,
    showDropdown,
    detectMention,
    insertTab,
    clearMention,
    setMention,
  };
}
