/**
 * @file Text Processing Utilities
 *
 * Pure functions for text manipulation, slash command detection,
 * and tab mention detection
 */

// ============================================================================
// Types
// ============================================================================

export interface SlashCommandDetection {
  /** Start index of the / command in the text */
  startIndex: number;
  /** Query string after the / symbol */
  query: string;
}

export interface MentionDetection {
  /** Start index of the @ mention in the text */
  startIndex: number;
  /** Query string after the @ symbol */
  query: string;
}

export interface SlashCommandConfig {
  enabled: boolean;
  isComposing: boolean;
}

export interface MentionConfig {
  enabled: boolean;
  isComposing: boolean;
  stopChars: string[];
}

export interface SlashCommandInsertResult {
  newText: string;
  newCursorPosition: number;
  expandedPrompt: string;
}

export interface TabInsertResult {
  newText: string;
  newCursorPosition: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Whitespace characters that can precede a command or mention */
export const WHITESPACE_CHARS = [' ', '\t', '\n', '\r'];

/** Characters that terminate a slash command */
export const TERMINATOR_CHARS = [' ', '\t', '\n', '\r', ',', '.', '!', '?', ';', ':'];

/** Default punctuation characters that stop mention detection */
export const DEFAULT_STOP_CHARS = [
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

// ============================================================================
// Slash Command Functions
// ============================================================================

/**
 * Core slash command detection logic
 *
 * Optimized detection that:
 * 1. Only searches from cursor back to last whitespace
 * 2. Checks / is at start or preceded by whitespace
 * 3. Validates command doesn't contain spaces
 */
export function detectSlashCommandInternal(
  text: string,
  cursorPosition: number,
  config: SlashCommandConfig
): SlashCommandDetection | null {
  // Don't detect during IME composition
  if (config.isComposing) {
    return null;
  }

  if (!config.enabled || !text || cursorPosition < 0) {
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
}

/**
 * Insert slash command replacement
 *
 * Replaces the slash command with the user's text following it,
 * but returns the expanded prompt for sending to the AI.
 */
export function insertSlashCommand(
  text: string,
  commandName: string,
  commandPrompt: string,
  detection: SlashCommandDetection
): SlashCommandInsertResult {
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
  const displayText = beforeCommand + `/${commandName}` + (afterCommand ? ' ' + afterCommand : '');

  // Build the expanded prompt for AI
  const expandedPrompt = beforeCommand + commandPrompt + (afterCommand ? '\n' + afterCommand : '');

  // Calculate new cursor position (after the command)
  const newCursorPosition =
    beforeCommand.length + `/${commandName}`.length + (afterCommand ? 1 : 0);

  return {
    newText: displayText,
    newCursorPosition,
    expandedPrompt,
  };
}

// ============================================================================
// Tab Mention Functions
// ============================================================================

/**
 * Core mention detection logic
 *
 * Optimized detection that:
 * 1. Only searches from cursor back to last whitespace
 * 2. Checks @ is preceded by whitespace or at text start
 * 3. Validates query doesn't contain punctuation
 */
export function detectMentionInternal(
  text: string,
  cursorPosition: number,
  config: MentionConfig
): MentionDetection | null {
  // Don't detect mentions during IME composition
  if (config.isComposing) {
    return null;
  }

  if (!config.enabled || !text || cursorPosition < 0) {
    return null;
  }

  const { stopChars } = config;

  // Performance optimization: only search back to last whitespace
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
}

/**
 * Insert tab reference replacing @ mention
 *
 * Replaces the @ mention with a formatted tab reference and calculates
 * the new cursor position after insertion.
 */
export function insertTab(
  text: string,
  tabTitle: string,
  tabDomain: string,
  mentionToReplace: MentionDetection,
  stopChars: string[]
): TabInsertResult {
  const { startIndex } = mentionToReplace;

  // Create tab reference format: "Tab: [title] (domain)"
  const tabReference = `Tab: ${tabTitle} (${tabDomain})`;

  // Find the end of the mention
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
}
