/**
 * @file useSlashCommand Hook
 *
 * Custom React hook for detecting slash commands and managing dropdown state
 * in text input elements. Provides debounced detection with proper boundary
 * checks and cursor position tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SlashCommand } from '../../config/slashCommands';
import {
  detectSlashCommandInternal as detectSlashCommandCore,
  insertSlashCommand as insertSlashCommandCore,
  type SlashCommandDetection,
} from '@core/utils/textProcessing';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type { SlashCommandDetection } from '@core/utils/textProcessing';

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
   * Core slash command detection logic (using core utility)
   */
  const detectSlashCommandInternal = useCallback(
    (text: string, cursorPosition: number): SlashCommandDetection | null => {
      return detectSlashCommandCore(text, cursorPosition, {
        enabled,
        isComposing,
      });
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
      const result = insertSlashCommandCore(text, command.name, command.prompt, detection);
      return {
        ...result,
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
