import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ModelSelector } from '@/sidebar/components/ModelSelector';

// Mock compat provider listing to simulate a saved compat key
vi.mock('@/data/storage/keys/compat', () => ({
  listOpenAICompatProviders: vi
    .fn()
    .mockResolvedValue([
      { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1' },
    ]),
}));

// Minimal mock for settings store: selectedModel defaults to OpenAI, no standard keys
vi.mock('@/data/store/settings', async orig => {
  const actual = await (orig as any)();
  return {
    ...actual,
    useSettingsStore: (sel: any) =>
      sel({
        settings: {
          apiKeys: { openai: null, google: null, openrouter: null },
          availableModels: [
            { id: 'gpt-5-nano', name: 'GPT 5 Nano', provider: 'openai', available: true },
            { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', available: true },
          ],
        },
      }),
  };
});

describe('ModelSelector with compat providers', () => {
  afterEach(() => cleanup());

  it('shows "Select model..." and auto-suggests a compat model when only compat key exists', async () => {
    const onChange = vi.fn();

    render(
      <ModelSelector
        value="gpt-5-nano" // default OpenAI selection that is not available due to missing key
        onChange={onChange}
      />
    );

    // With a compat provider available but selected model unavailable, trigger shows "Select model..."
    expect(await screen.findByText('Select model...')).toBeInTheDocument();

    // Auto-selection effect should suggest a compat default by calling onChange
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const picked = onChange.mock.calls[0][0];
    expect(picked).toBe('deepseek-chat');
  });
});
