/**
 * @file Simplified E2E Content Injection Test
 *
 * A simplified version to test the basic content injection workflow.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@sidebar/ChatPanel';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import type { ExtractedContent } from '@types/extraction';

// Mock extracted content
const mockExtractedContent: ExtractedContent = {
  title: 'Test Page Title',
  url: 'https://example.com/test-page',
  domain: 'example.com',
  content: 'This is the main content of the test page.',
  links: [],
  metadata: {
    description: 'A test page',
    keywords: ['test'],
    publishedTime: '2023-01-01',
    modifiedTime: '2023-01-01',
  },
  extractorUsed: 'readability',
  extractionTime: Date.now(),
  wordCount: 10,
  isContentExtracted: true,
  qualityScore: 0.85,
};

// Mock dependencies
vi.mock('@hooks/useContentExtraction', () => ({
  useContentExtraction: () => ({
    content: mockExtractedContent,
    loading: false,
    error: null,
    qualityAssessment: null,
    extractContent: vi.fn(),
    reextract: vi.fn(),
  }),
}));

vi.mock('@hooks/useAIChat', () => ({
  useAIChat: () => ({
    sendMessage: vi.fn().mockImplementation(async (content, options) => {
      // Add user message if not skipped
      if (!options?.skipUserMessage) {
        useChatStore.getState().addMessage({
          role: 'user',
          content,
          displayContent: options?.displayContent,
          metadata: options?.metadata,
        });
      }

      // Add mock AI response
      const aiMessage = useChatStore.getState().addMessage({
        role: 'assistant',
        content: 'Mock AI response based on your question.',
        status: 'received',
      });
    }),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@tabext/tabUtils', () => ({
  getCurrentTabIdSafe: () => Promise.resolve(123),
}));

vi.mock('@hooks/useDragPosition', () => ({
  useDragPosition: () => ({
    position: { x: 100, y: 100 },
    isDragging: false,
    onMouseDown: vi.fn(),
    setPosition: vi.fn(),
  }),
}));

vi.mock('@hooks/useResize', () => ({
  useResize: () => ({
    size: { width: 400, height: 600 },
    onMouseDown: vi.fn(),
    setSize: vi.fn(),
  }),
}));

describe('Simplified E2E: Content Injection', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup();

    // Reset stores
    useChatStore.getState().clearConversation();

    // Setup model without causing errors
    try {
      await act(async () => {
        await useSettingsStore.getState().updateSelectedModel('gpt-5-nano');
      });
    } catch (error) {
      // Ignore model setup errors in tests
      // console.warn('Model setup failed in test, continuing...', error);
    }
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('injects content on first message', async () => {
    const user = userEvent.setup({ delay: null });

    render(<ChatPanel onClose={vi.fn()} />);

    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Type and send first message
    const input = screen.getByRole('textbox');
    await user.type(input, 'What is this page about?');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // Wait for message to be processed
    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(2); // User + AI messages

      // Check user message has injected content
      const userMessage = messages[0];
      expect(userMessage?.content).toContain("I'm looking at a webpage");
      expect(userMessage?.content).toContain('Test Page Title');
      expect(userMessage?.content).toContain('What is this page about?');
      expect(userMessage?.displayContent).toBe('What is this page about?');

      // Check metadata
      expect(userMessage?.metadata?.hasTabContext).toBe(true);
      expect(userMessage?.metadata?.originalUserContent).toBe('What is this page about?');
    });
  });

  it('does not inject on subsequent messages', async () => {
    const user = userEvent.setup({ delay: null });

    render(<ChatPanel onClose={vi.fn()} />);

    // Send first message
    const input = screen.getByRole('textbox');
    await user.type(input, 'First message');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });

    // Clear and send second message
    await user.clear(input);
    await user.type(input, 'Second message');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(4);

      // Check second user message doesn't have injection
      const secondUserMessage = messages[2];
      expect(secondUserMessage?.content).toBe('Second message');
      expect(secondUserMessage?.displayContent).toBeUndefined();
      expect(secondUserMessage?.metadata?.hasTabContext).toBeFalsy();
    });
  });

  it('re-injects after conversation reset', async () => {
    const user = userEvent.setup({ delay: null });

    render(<ChatPanel onClose={vi.fn()} />);

    // Send first message
    const input = screen.getByRole('textbox');
    await user.type(input, 'First conversation');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });

    // Clear conversation
    const newConversationButton = screen.getByRole('button', { name: /new conversation/i });
    await user.click(newConversationButton);

    expect(useChatStore.getState().messages).toHaveLength(0);

    // Send message after reset - should inject again
    await user.type(input, 'After reset');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(2);

      // Should inject again
      const userMessage = messages[0];
      expect(userMessage?.content).toContain("I'm looking at a webpage");
      expect(userMessage?.displayContent).toBe('After reset');
      expect(userMessage?.metadata?.hasTabContext).toBe(true);
    });
  });
});
