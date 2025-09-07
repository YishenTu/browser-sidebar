/**
 * @file System Prompt Configuration Tests
 *
 * Tests for the system prompt configuration with provider-specific features
 */

import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../../../src/config/systemPrompt';

describe('getSystemPrompt', () => {
  it('should return base system prompt without web search for undefined provider', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain('# System Instruction');
    expect(prompt).toContain('## Your Role');
    expect(prompt).toContain('## Content Format');
    expect(prompt).not.toContain('## Available Tools');
    expect(prompt).not.toContain('Web Search');
  });

  it('should include web search section for OpenAI provider', () => {
    const prompt = getSystemPrompt('openai');
    expect(prompt).toContain('# System Instruction');
    expect(prompt).toContain('## Available Tools');
    expect(prompt).toContain('**Web Search**: Can search the web for current information');
    expect(prompt).toContain('Use web search to supplement tab analysis');
  });

  it('should include web search section for Gemini provider', () => {
    const prompt = getSystemPrompt('gemini');
    expect(prompt).toContain('# System Instruction');
    expect(prompt).toContain('## Available Tools');
    expect(prompt).toContain('**Web Search**: Can search the web for current information');
    expect(prompt).toContain('Use web search to supplement tab analysis');
  });

  it('should NOT include web search section for OpenRouter provider', () => {
    const prompt = getSystemPrompt('openrouter');
    expect(prompt).toContain('# System Instruction');
    expect(prompt).not.toContain('## Available Tools');
    expect(prompt).not.toContain('Web Search');
  });

  it('should NOT include web search section for OpenAI-Compatible provider', () => {
    const prompt = getSystemPrompt('openai_compat');
    expect(prompt).toContain('# System Instruction');
    expect(prompt).not.toContain('## Available Tools');
    expect(prompt).not.toContain('Web Search');
  });

  it('should maintain all other sections regardless of provider', () => {
    const providers: Array<'openai' | 'gemini' | 'openrouter' | 'openai_compat' | undefined> = [
      'openai',
      'gemini',
      'openrouter',
      'openai_compat',
      undefined,
    ];

    providers.forEach(provider => {
      const prompt = getSystemPrompt(provider);

      // Check all standard sections are present
      expect(prompt).toContain('## Your Role');
      expect(prompt).toContain('## Content Format');
      expect(prompt).toContain('## Language');
      expect(prompt).toContain('## Style and Expression');
      expect(prompt).toContain('## Reasoning and Approach');
      expect(prompt).toContain('## Content Sources and Citation');

      // Check important content
      expect(prompt).toContain('browser-integrated chatbot');
      expect(prompt).toContain('<browser_context>');
      expect(prompt).toContain('<tab_content>');
      expect(prompt).toContain('GitHub-Flavored Markdown');
    });
  });
});
