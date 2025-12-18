/**
 * @file Text Processing Tests
 *
 * Tests for text manipulation, slash command detection,
 * and tab mention detection utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  detectSlashCommandInternal,
  insertSlashCommand,
  detectMentionInternal,
  insertTab,
  WHITESPACE_CHARS,
  TERMINATOR_CHARS,
  DEFAULT_STOP_CHARS,
} from '@core/utils/textProcessing';
import type {
  SlashCommandConfig,
  MentionConfig,
  SlashCommandDetection,
  MentionDetection,
} from '@core/utils/textProcessing';

describe('detectSlashCommandInternal', () => {
  const enabledConfig: SlashCommandConfig = {
    enabled: true,
    isComposing: false,
  };

  const disabledConfig: SlashCommandConfig = {
    enabled: false,
    isComposing: false,
  };

  const composingConfig: SlashCommandConfig = {
    enabled: true,
    isComposing: true,
  };

  describe('basic detection', () => {
    it('should detect slash command at start of text', () => {
      const result = detectSlashCommandInternal('/help', 5, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.startIndex).toBe(0);
      expect(result?.query).toBe('help');
    });

    it('should detect slash command after whitespace', () => {
      const result = detectSlashCommandInternal('hello /test', 11, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.startIndex).toBe(6);
      expect(result?.query).toBe('test');
    });

    it('should detect partial command while typing', () => {
      const result = detectSlashCommandInternal('/su', 3, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('su');
    });
  });

  describe('cursor position handling', () => {
    it('should only detect command up to cursor position', () => {
      // Cursor is at position 4 (/sum|marize)
      const result = detectSlashCommandInternal('/summarize', 4, enabledConfig);

      expect(result?.query).toBe('sum');
    });

    it('should return null when cursor is before slash', () => {
      const result = detectSlashCommandInternal('/help', 0, enabledConfig);

      expect(result).toBeNull();
    });

    it('should handle cursor at slash position', () => {
      const result = detectSlashCommandInternal('/help', 1, enabledConfig);

      expect(result?.query).toBe('');
    });
  });

  describe('disabled states', () => {
    it('should return null when disabled', () => {
      const result = detectSlashCommandInternal('/help', 5, disabledConfig);

      expect(result).toBeNull();
    });

    it('should return null during IME composition', () => {
      const result = detectSlashCommandInternal('/help', 5, composingConfig);

      expect(result).toBeNull();
    });
  });

  describe('terminator handling', () => {
    it('should not detect command after space in query', () => {
      const result = detectSlashCommandInternal('/help me', 8, enabledConfig);

      // The command ends at the space
      expect(result).toBeNull();
    });

    it('should not detect command after punctuation in query', () => {
      const result = detectSlashCommandInternal('/help.now', 9, enabledConfig);

      expect(result).toBeNull();
    });
  });

  describe('escaped slash handling', () => {
    it('should not detect escaped slash', () => {
      const result = detectSlashCommandInternal('path\\/to', 8, enabledConfig);

      expect(result).toBeNull();
    });
  });

  describe('invalid input handling', () => {
    it('should return null for empty text', () => {
      const result = detectSlashCommandInternal('', 0, enabledConfig);

      expect(result).toBeNull();
    });

    it('should return null for negative cursor position', () => {
      const result = detectSlashCommandInternal('/help', -1, enabledConfig);

      expect(result).toBeNull();
    });
  });

  describe('search distance limits', () => {
    it('should find slash within 50 characters', () => {
      const text = 'a'.repeat(45) + ' /cmd';
      const result = detectSlashCommandInternal(text, text.length, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('cmd');
    });
  });

  describe('multiple slashes', () => {
    it('should detect most recent slash in current word', () => {
      const result = detectSlashCommandInternal('text /first /second', 19, enabledConfig);

      expect(result?.startIndex).toBe(12);
      expect(result?.query).toBe('second');
    });
  });

  describe('whitespace before slash', () => {
    it('should require whitespace before slash (not mid-word)', () => {
      const result = detectSlashCommandInternal('no/command', 10, enabledConfig);

      expect(result).toBeNull();
    });

    it('should detect with tab before slash', () => {
      const result = detectSlashCommandInternal('text\t/cmd', 9, enabledConfig);

      expect(result).not.toBeNull();
    });

    it('should detect with newline before slash', () => {
      const result = detectSlashCommandInternal('text\n/cmd', 9, enabledConfig);

      expect(result).not.toBeNull();
    });
  });
});

describe('insertSlashCommand', () => {
  const detection: SlashCommandDetection = {
    startIndex: 0,
    query: 'summarize',
  };

  it('should replace command with display text', () => {
    const result = insertSlashCommand(
      '/summarize',
      'summarize',
      'Please summarize the following:',
      detection
    );

    expect(result.newText).toBe('/summarize');
    expect(result.expandedPrompt).toBe('Please summarize the following:');
  });

  it('should include text after command', () => {
    const result = insertSlashCommand('/summarize this content', 'summarize', 'Please summarize:', {
      startIndex: 0,
      query: 'summarize',
    });

    expect(result.newText).toBe('/summarize this content');
    expect(result.expandedPrompt).toContain('this content');
  });

  it('should preserve text before command', () => {
    const result = insertSlashCommand('Hello /help', 'help', 'Here is help:', {
      startIndex: 6,
      query: 'help',
    });

    expect(result.newText).toContain('Hello');
    expect(result.expandedPrompt).toContain('Hello');
  });

  it('should calculate correct cursor position', () => {
    const result = insertSlashCommand('/cmd', 'cmd', 'Prompt', {
      startIndex: 0,
      query: 'cmd',
    });

    expect(result.newCursorPosition).toBe('/cmd'.length);
  });
});

describe('detectMentionInternal', () => {
  const enabledConfig: MentionConfig = {
    enabled: true,
    isComposing: false,
    stopChars: DEFAULT_STOP_CHARS,
  };

  const disabledConfig: MentionConfig = {
    enabled: false,
    isComposing: false,
    stopChars: DEFAULT_STOP_CHARS,
  };

  describe('basic detection', () => {
    it('should detect @ mention at start of text', () => {
      const result = detectMentionInternal('@example', 8, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.startIndex).toBe(0);
      expect(result?.query).toBe('example');
    });

    it('should detect @ mention after whitespace', () => {
      const result = detectMentionInternal('hello @tab', 10, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.startIndex).toBe(6);
      expect(result?.query).toBe('tab');
    });

    it('should detect partial mention while typing', () => {
      const result = detectMentionInternal('@ex', 3, enabledConfig);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('ex');
    });
  });

  describe('cursor position handling', () => {
    it('should only detect mention up to cursor position', () => {
      const result = detectMentionInternal('@example', 4, enabledConfig);

      expect(result?.query).toBe('exa');
    });

    it('should return null when cursor is before @', () => {
      const result = detectMentionInternal('@mention', 0, enabledConfig);

      expect(result).toBeNull();
    });
  });

  describe('disabled states', () => {
    it('should return null when disabled', () => {
      const result = detectMentionInternal('@test', 5, disabledConfig);

      expect(result).toBeNull();
    });

    it('should return null during IME composition', () => {
      const config: MentionConfig = {
        enabled: true,
        isComposing: true,
        stopChars: DEFAULT_STOP_CHARS,
      };
      const result = detectMentionInternal('@test', 5, config);

      expect(result).toBeNull();
    });
  });

  describe('stop character handling', () => {
    it('should stop detection at punctuation', () => {
      const result = detectMentionInternal('@test.com', 9, enabledConfig);

      expect(result).toBeNull();
    });

    it('should stop detection at slash', () => {
      const result = detectMentionInternal('@path/to', 8, enabledConfig);

      expect(result).toBeNull();
    });
  });

  describe('whitespace before @', () => {
    it('should not detect @ in middle of word', () => {
      const result = detectMentionInternal('email@test', 10, enabledConfig);

      expect(result).toBeNull();
    });

    it('should detect with newline before @', () => {
      const result = detectMentionInternal('text\n@mention', 13, enabledConfig);

      expect(result).not.toBeNull();
    });
  });

  describe('search distance limits', () => {
    it('should find @ within 100 characters', () => {
      const text = 'a'.repeat(95) + ' @tab';
      const result = detectMentionInternal(text, text.length, enabledConfig);

      expect(result).not.toBeNull();
    });
  });
});

describe('insertTab', () => {
  const mention: MentionDetection = {
    startIndex: 0,
    query: 'tab',
  };

  it('should replace mention with tab reference', () => {
    const result = insertTab('@tab', 'Page Title', 'example.com', mention, DEFAULT_STOP_CHARS);

    expect(result.newText).toBe('Tab: Page Title (example.com)');
  });

  it('should preserve text before mention', () => {
    const result = insertTab(
      'Check @tab',
      'Title',
      'test.com',
      { startIndex: 6, query: 'tab' },
      DEFAULT_STOP_CHARS
    );

    expect(result.newText).toBe('Check Tab: Title (test.com)');
  });

  it('should preserve text after mention', () => {
    const result = insertTab(
      '@tab and more',
      'Title',
      'test.com',
      { startIndex: 0, query: 'tab' },
      DEFAULT_STOP_CHARS
    );

    expect(result.newText).toBe('Tab: Title (test.com) and more');
  });

  it('should calculate correct cursor position', () => {
    const result = insertTab('@t', 'Title', 'test.com', mention, DEFAULT_STOP_CHARS);

    expect(result.newCursorPosition).toBe('Tab: Title (test.com)'.length);
  });
});

describe('constants', () => {
  describe('WHITESPACE_CHARS', () => {
    it('should include common whitespace characters', () => {
      expect(WHITESPACE_CHARS).toContain(' ');
      expect(WHITESPACE_CHARS).toContain('\t');
      expect(WHITESPACE_CHARS).toContain('\n');
      expect(WHITESPACE_CHARS).toContain('\r');
    });
  });

  describe('TERMINATOR_CHARS', () => {
    it('should include whitespace and punctuation', () => {
      expect(TERMINATOR_CHARS).toContain(' ');
      expect(TERMINATOR_CHARS).toContain('.');
      expect(TERMINATOR_CHARS).toContain(',');
      expect(TERMINATOR_CHARS).toContain('!');
    });
  });

  describe('DEFAULT_STOP_CHARS', () => {
    it('should include common stop characters', () => {
      expect(DEFAULT_STOP_CHARS).toContain('.');
      expect(DEFAULT_STOP_CHARS).toContain(',');
      expect(DEFAULT_STOP_CHARS).toContain('/');
      expect(DEFAULT_STOP_CHARS).toContain('(');
      expect(DEFAULT_STOP_CHARS).toContain(')');
    });
  });
});
