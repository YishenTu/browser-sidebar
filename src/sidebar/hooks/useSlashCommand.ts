/**
 * @file useSlashCommand Hook
 *
 * Custom React hook for detecting slash commands and managing dropdown state
 * in text input elements. Provides debounced detection with proper boundary
 * checks and cursor position tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SlashCommand } from '../../config/slashCommands';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Slash command detection result
 */
export interface SlashCommandDetection {
  /** Start index of the / command in the text */
  startIndex: number;
  /** Query string after the / symbol */
  query: string;
}

/**
 * Slash command hook options
 */
export interface UseSlashCommandOptions {
  /** Debounce delay in milliseconds (default: 100ms) */
  debounceDelay?: number;
  /** Whether to enable slash command detection (default: true) */
  enabled?: boolean;
  /** Whether the user is currently in IME composition (default: false) */
  isComposing?: boolean;
}

/**
 * Slash command hook return interface
 */
export interface UseSlashCommandReturn {
  /** Current slash command detection state */
  slashCommand: SlashCommandDetection | null;
  /** Whether slash command dropdown should be visible */
  showDropdown: boolean;
  /** Function to detect slash commands in text at cursor position */
  detectSlashCommand: (text: string, cursorPosition: number) => SlashCommandDetection | null;
  /** Function to insert slash command replacement */
  insertSlashCommand: (
    text: string,
    command: SlashCommand,
    detection: SlashCommandDetection
  ) => { newText: string; newCursorPosition: number; expandedPrompt: string; model?: string };
  /** Function to clear current slash command state */
  clearSlashCommand: () => void;
  /** Function to manually set slash command state */
  setSlashCommand: (command: SlashCommandDetection | null) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default debounce delay in milliseconds */
const DEFAULT_DEBOUNCE_DELAY = 100;

/** Whitespace characters that can precede a slash command */
const WHITESPACE_CHARS = [' ', '\t', '\n', '\r'];

/** Characters that terminate a slash command */
const TERMINATOR_CHARS = [' ', '\t', '\n', '\r', ',', '.', '!', '?', ';', ':'];

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for detecting and managing slash commands in text inputs
 *
 * This hook provides functionality to detect slash commands that follow proper
 * word boundaries (whitespace or line start), with configurable debouncing
 * for performance optimization.
 *
 * @param options - Configuration options for the hook
 * @returns Hook interface with slash command detection and insertion functions
 */
export function useSlashCommand(options: UseSlashCommandOptions = {}): UseSlashCommandReturn {
  const { debounceDelay = DEFAULT_DEBOUNCE_DELAY, enabled = true, isComposing = false } = options;

  // State management
  const [slashCommand, setSlashCommandState] = useState<SlashCommandDetection | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Debounce timer reference
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * Core slash command detection logic
   *
   * Optimized detection that:
   * 1. Only searches from cursor back to last whitespace
   * 2. Checks / is at start or preceded by whitespace
   * 3. Validates command doesn't contain spaces
   */
  const detectSlashCommandInternal = useCallback(
    (text: string, cursorPosition: number): SlashCommandDetection | null => {
      // Don't detect during IME composition
      if (isComposing) {
        return null;
      }

      if (!enabled || !text || cursorPosition < 0) {
        return null;
      }

      // Performance optimization: only search back to last whitespace
      let searchStart = cursorPosition - 1;
      let lastWhitespaceIndex = -1;

      // Find the last whitespace before cursor (limit search to 50 chars for slash commands)
      const maxSearchDistance = Math.min(50, cursorPosition);
      for (let i = cursorPosition - 1; i >= Math.max(0, cursorPosition - maxSearchDistance); i--) {
        if (WHITESPACE_CHARS.includes(text[i] ?? '') || TERMINATOR_CHARS.includes(text[i] ?? '')) {
          lastWhitespaceIndex = i;
          break;
        }
      }

      // Search for / from last whitespace to cursor
      searchStart = lastWhitespaceIndex + 1;
      let slashIndex = -1;

      for (let i = searchStart; i < cursorPosition && i < text.length; i++) {
        if (text[i] === '/') {
          slashIndex = i;
          // Only keep the most recent /
          // Don't break - continue to find the last one
        }
      }

      // No / found in current word
      if (slashIndex === -1) {
        return null;
      }

      // Check if / is at start or preceded by whitespace
      if (slashIndex > 0) {
        const charBefore = text[slashIndex - 1];
        if (!WHITESPACE_CHARS.includes(charBefore ?? '')) {
          return null;
        }
      }

      // Check if this might be an escaped slash (\\/)
      if (slashIndex > 0 && text[slashIndex - 1] === '\\') {
        return null;
      }

      // Extract query from / to cursor position
      const queryStart = slashIndex + 1;
      const queryEnd = Math.min(cursorPosition, text.length);
      const query = text.substring(queryStart, queryEnd);

      // Check if query contains terminator characters (spaces, punctuation)
      for (const terminator of TERMINATOR_CHARS) {
        if (query.includes(terminator)) {
          return null;
        }
      }

      // Valid slash command found
      return {
        startIndex: slashIndex,
        query: query.trim(),
      };
    },
    [enabled, isComposing]
  );

  /**
   * Debounced slash command detection function
   */
  const detectSlashCommand = useCallback(
    (text: string, cursorPosition: number): SlashCommandDetection | null => {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Immediate detection for the return value
      const immediateResult = detectSlashCommandInternal(text, cursorPosition);

      // Debounced state update
      debounceTimer.current = setTimeout(() => {
        const debouncedResult = detectSlashCommandInternal(text, cursorPosition);
        setSlashCommandState(debouncedResult);
        setShowDropdown(debouncedResult !== null);
      }, debounceDelay);

      return immediateResult;
    },
    [detectSlashCommandInternal, debounceDelay]
  );

  /**
   * Insert slash command replacement
   *
   * Replaces the slash command with the user's text following it,
   * but returns the expanded prompt for sending to the AI.
   */
  const insertSlashCommand = useCallback(
    (
      text: string,
      command: SlashCommand,
      detection: SlashCommandDetection
    ): { newText: string; newCursorPosition: number; expandedPrompt: string; model?: string } => {
      const { startIndex } = detection;

      // Find the end of the slash command
      let endIndex = startIndex + 1; // Start after /

      // Find where the command word ends
      for (let i = endIndex; i < text.length; i++) {
        const char = text[i];
        if (WHITESPACE_CHARS.includes(char ?? '') || TERMINATOR_CHARS.includes(char ?? '')) {
          endIndex = i;
          break;
        }
      }

      // If no terminator found, command goes to end of text
      if (endIndex === startIndex + 1) {
        endIndex = text.length;
      }

      // Extract the text after the slash command
      const afterCommand = text.substring(endIndex).trim();

      // Build the display text (keep the slash command for display)
      const beforeCommand = text.substring(0, startIndex);
      const displayText =
        beforeCommand + `/${command.name}` + (afterCommand ? ' ' + afterCommand : '');

      // Build the expanded prompt for AI
      const expandedPrompt =
        beforeCommand + command.prompt + (afterCommand ? '\n' + afterCommand : '');

      // Calculate new cursor position (after the command)
      const newCursorPosition =
        beforeCommand.length + `/${command.name}`.length + (afterCommand ? 1 : 0);

      return {
        newText: displayText,
        newCursorPosition,
        expandedPrompt,
        model: command.model,
      };
    },
    []
  );

  /**
   * Clear slash command state and hide dropdown
   */
  const clearSlashCommand = useCallback(() => {
    // Clear debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    setSlashCommandState(null);
    setShowDropdown(false);
  }, []);

  /**
   * Manually set slash command state
   */
  const setSlashCommand = useCallback((newCommand: SlashCommandDetection | null) => {
    setSlashCommandState(newCommand);
    setShowDropdown(newCommand !== null);
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
    slashCommand,
    showDropdown,
    detectSlashCommand,
    insertSlashCommand,
    clearSlashCommand,
    setSlashCommand,
  };
}
