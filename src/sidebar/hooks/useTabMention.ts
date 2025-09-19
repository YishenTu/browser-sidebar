/**
 * @file useTabMention Hook
 *
 * Custom React hook for detecting @ mentions and managing dropdown state
 * in text input elements. Provides debounced detection with proper boundary
 * checks and cursor position tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TabInfo } from '../../types/tabs';
import {
  detectMentionInternal as detectMentionCore,
  insertTab as insertTabCore,
  DEFAULT_STOP_CHARS,
  type MentionDetection,
} from '@core/utils/textProcessing';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type { MentionDetection } from '@core/utils/textProcessing';

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
   * Core mention detection logic (using core utility)
   */
  const detectMentionInternal = useCallback(
    (text: string, cursorPosition: number): MentionDetection | null => {
      return detectMentionCore(text, cursorPosition, {
        enabled,
        isComposing,
        stopChars,
      });
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
      return insertTabCore(text, tab.title, tab.domain, mentionToReplace, stopChars);
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
