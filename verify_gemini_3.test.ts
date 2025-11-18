import { buildGenerationConfig } from './src/core/ai/gemini/requestBuilder';
import { GeminiConfig } from './src/types/providers';
import { GeminiChatConfig } from './src/core/ai/gemini/types';
import { vi, describe, it, expect } from 'vitest';

// Mock supportsThinking
vi.mock('./src/config/models', () => ({
  supportsThinking: (_model: string) => true,
}));

describe('Gemini 3 Request Builder', () => {
  it('should use thinkingLevel for Gemini 3 models', () => {
    const geminiConfig: GeminiConfig = {
      apiKey: 'test-key',
      model: 'gemini-3-pro-preview',
      thinkingLevel: 'high',
    };

    const config = buildGenerationConfig(geminiConfig);
    expect(config.thinkingLevel).toBe('high');
    expect(config.thinkingConfig).toBeUndefined();
  });

  it('should use thinkingBudget for Gemini 2.5 models', () => {
    const geminiConfig: GeminiConfig = {
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      thinkingBudget: 1024,
    };

    const config = buildGenerationConfig(geminiConfig);
    expect(config.thinkingConfig).toEqual({
      thinkingBudget: 1024,
      includeThoughts: true,
    });
    expect(config.thinkingLevel).toBeUndefined();
  });

  it('should prioritize thinkingLevel from chatConfig', () => {
    const geminiConfig: GeminiConfig = {
      apiKey: 'test-key',
      model: 'gemini-3-pro-preview',
      thinkingLevel: 'low',
    };

    const chatConfig: GeminiChatConfig = {
      thinkingLevel: 'high',
    };

    const config = buildGenerationConfig(geminiConfig, chatConfig);
    expect(config.thinkingLevel).toBe('high');
  });
});
