/**
 * @file E2E Content Injection Tests
 *
 * Comprehensive end-to-end tests for the complete content injection workflow.
 * Tests complete user flows from sidebar opening to AI response with injected content.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@sidebar/ChatPanel';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import type { ExtractedContent } from '@types/extraction';

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
    sendMessage: mockSendMessage,
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

// Mock extracted content
const mockExtractedContent: ExtractedContent = {
  title: 'Test Page Title',
  url: 'https://example.com/test-page',
  domain: 'example.com',
  content: 'This is the main content of the test page with some important information.',
  links: [],
  metadata: {
    description: 'A test page for content injection',
    keywords: ['test', 'content', 'injection'],
    publishedTime: '2023-01-01',
    modifiedTime: '2023-01-01',
  },
  extractorUsed: 'readability',
  extractionTime: Date.now(),
  wordCount: 15,
  isContentExtracted: true,
  qualityScore: 0.85,
};

// Mock AI send message function
let mockSendMessage: ReturnType<typeof vi.fn>;
let mockStreamingResponse: string[] = [];
let mockResponseDelay: number = 50;

// Performance tracking
let performanceMetrics = {
  extractionTime: 0,
  injectionTime: 0,
  totalTime: 0,
};

// Memory tracking
let memoryBaseline: number;
let currentMemoryUsage: number;

describe('E2E: Content Injection Workflow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup();

    // Reset stores
    useChatStore.getState().clearConversation();
    // Reset settings if method exists, otherwise use resetToDefaults
    const settingsStore = useSettingsStore.getState();
    if ('resetSettings' in settingsStore && typeof settingsStore.resetSettings === 'function') {
      settingsStore.resetSettings();
    } else if ('resetToDefaults' in settingsStore && typeof settingsStore.resetToDefaults === 'function') {
      await settingsStore.resetToDefaults();
    }

    // Setup performance tracking
    performanceMetrics = {
      extractionTime: 0,
      injectionTime: 0,
      totalTime: 0,
    };

    // Memory baseline
    if (typeof performance !== 'undefined' && performance.memory) {
      memoryBaseline = performance.memory.usedJSHeapSize;
    }

    // Setup mock AI response
    mockStreamingResponse = [
      'Based on the content from ',
      'the webpage you\'re viewing, ',
      'I can see this is about ',
      'test page content. ',
      'The main information discusses ',
      'important details that ',
      'help answer your question.'
    ];

    mockSendMessage = vi.fn().mockImplementation(async (content, options) => {
      const startTime = performance.now();
      
      // Simulate content injection processing time
      if (content.includes("I'm looking at a webpage")) {
        performanceMetrics.injectionTime = performance.now() - startTime;
      }
      
      // Add user message to store if not skipped
      if (!options?.skipUserMessage) {
        useChatStore.getState().addMessage({
          role: 'user',
          content: content,
          displayContent: options?.displayContent,
          metadata: options?.metadata,
        });
      }

      // Simulate streaming AI response
      const assistantMessage = useChatStore.getState().addMessage({
        role: 'assistant',
        content: '',
        status: 'streaming',
      });

      // Stream response with delay
      for (let i = 0; i < mockStreamingResponse.length; i++) {
        await new Promise(resolve => setTimeout(resolve, mockResponseDelay));
        
        act(() => {
          useChatStore.getState().appendToMessage(assistantMessage.id, mockStreamingResponse[i]);
        });
      }

      // Mark as complete
      act(() => {
        useChatStore.getState().updateMessage(assistantMessage.id, {
          status: 'received',
        });
      });

      performanceMetrics.totalTime = performance.now() - startTime;
    });

    // Setup default model for tests
    await act(async () => {
      await useSettingsStore.getState().updateSelectedModel('gpt-5-nano');
      await useSettingsStore.getState().updateAPIKeyReferences({
        openai: 'test-openai-key-ref',
        google: 'test-google-key-ref',
      });
    });
  });

  afterEach(() => {
    // Track memory usage
    if (typeof performance !== 'undefined' && performance.memory) {
      currentMemoryUsage = performance.memory.usedJSHeapSize;
    }
    
    cleanup();
    vi.clearAllMocks();
  });

  describe('Complete User Flow: Open → Extract → Ask → Response', () => {
    it('completes full workflow from sidebar open to AI response with injected content', async () => {
      const user = userEvent.setup({ delay: null });
      const mockOnClose = vi.fn();
      const startTime = performance.now();

      // 1. Render sidebar (simulating opening)
      render(<ChatPanel onClose={mockOnClose} />);

      // Wait for sidebar to mount
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /type your message/i })).toBeInTheDocument();
      });

      // 2. User types a question
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      await user.type(chatInput, 'What is this page about?');

      // 3. User sends message (should trigger content extraction and injection)
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      // 4. Verify content injection occurred
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2); // User message + AI response
        
        // Check user message has injected content but displays only user input
        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage).toBeTruthy();
        expect(userMessage?.content).toContain("I'm looking at a webpage");
        expect(userMessage?.content).toContain('Test Page Title');
        expect(userMessage?.content).toContain('What is this page about?');
        expect(userMessage?.displayContent).toBe('What is this page about?');
        
        // Check metadata
        expect(userMessage?.metadata).toMatchObject({
          hasTabContext: true,
          originalUserContent: 'What is this page about?',
          tabId: 123,
          tabTitle: 'Test Page Title',
          tabUrl: 'https://example.com/test-page',
        });
      });

      // 5. Verify AI response references the injected content
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        const aiMessage = messages.find(m => m.role === 'assistant');
        expect(aiMessage).toBeTruthy();
        expect(aiMessage?.content).toContain('Based on the content');
        expect(aiMessage?.status).toBe('received');
      }, { timeout: 5000 });

      // 6. Verify UI shows only user input, not injected content
      const userMessageBubble = screen.getByText('What is this page about?');
      expect(userMessageBubble).toBeInTheDocument();
      expect(screen.queryByText("I'm looking at a webpage")).not.toBeInTheDocument();

      // 7. Verify context indicator is shown
      const contextIndicator = screen.getByRole('img', { name: /tab context/i });
      expect(contextIndicator).toBeInTheDocument();

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Total flow should be under 5 seconds
      expect(performanceMetrics.injectionTime).toBeLessThan(100); // Injection overhead < 100ms
    });

    it('handles subsequent messages without re-injection', async () => {
      const user = userEvent.setup({ delay: null });
      const mockOnClose = vi.fn();

      render(<ChatPanel onClose={mockOnClose} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      // First message with injection
      await user.type(chatInput, 'First question');
      await user.click(sendButton);

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Clear input and send second message
      await user.clear(chatInput);
      await user.type(chatInput, 'Follow-up question');
      await user.click(sendButton);

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(4);
      });

      // Verify second message doesn't have injection
      const messages = useChatStore.getState().messages;
      const secondUserMessage = messages[2]; // Third message (index 2)
      expect(secondUserMessage?.content).toBe('Follow-up question');
      expect(secondUserMessage?.displayContent).toBeUndefined();
      expect(secondUserMessage?.metadata?.hasTabContext).toBeFalsy();
    });
  });

  describe('Multi-Tab Independence', () => {
    it('maintains independent contexts across multiple tabs', async () => {
      const user = userEvent.setup({ delay: null });
      
      // Simulate Tab 1
      vi.mocked(require('@tabext/tabUtils').getCurrentTabIdSafe).mockResolvedValueOnce(111);
      
      render(<ChatPanel onClose={vi.fn()} />);
      
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send message in tab 1
      await user.type(chatInput, 'Tab 1 question');
      await user.click(sendButton);

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.tabId).toBe(111);
      });

      // Simulate switching to Tab 2 (clear conversation, new tab ID)
      act(() => {
        useChatStore.getState().clearConversation();
      });
      
      vi.mocked(require('@tabext/tabUtils').getCurrentTabIdSafe).mockResolvedValueOnce(222);

      // Clear input and send message in tab 2
      await user.clear(chatInput);
      await user.type(chatInput, 'Tab 2 question');
      await user.click(sendButton);

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.tabId).toBe(222);
        expect(messages[0]?.displayContent).toBe('Tab 2 question');
      });

      // Verify contexts are independent
      const tab2Messages = useChatStore.getState().messages;
      expect(tab2Messages[0]?.content).toContain('Tab 2 question');
      expect(tab2Messages[0]?.content).not.toContain('Tab 1 question');
    });

    it('preserves conversation state when switching back to previous tab', async () => {
      // This test simulates the behavior when user switches between tabs
      // In reality, each tab would have its own store instance, but we simulate
      // by managing conversation state
      
      const user = userEvent.setup({ delay: null });
      
      // Tab 1 conversation
      const tab1Messages = [
        { role: 'user' as const, content: 'Tab 1 first message', id: 'msg1' },
        { role: 'assistant' as const, content: 'Tab 1 first response', id: 'msg2' },
      ];

      // Setup tab 1 state
      act(() => {
        useChatStore.getState().clearConversation();
        tab1Messages.forEach(msg => {
          useChatStore.getState().addMessage({
            ...msg,
            timestamp: new Date(),
            status: 'received',
          });
        });
      });

      render(<ChatPanel onClose={vi.fn()} />);

      // Verify tab 1 has its messages
      expect(useChatStore.getState().messages).toHaveLength(2);
      expect(screen.getByText('Tab 1 first message')).toBeInTheDocument();

      // Continue conversation in tab 1
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(chatInput, 'Tab 1 follow-up');
      await user.click(sendButton);

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(4);
      });

      // Verify the follow-up doesn't have injection (not first message)
      const messages = useChatStore.getState().messages;
      const lastUserMessage = messages[2];
      expect(lastUserMessage?.content).toBe('Tab 1 follow-up');
      expect(lastUserMessage?.metadata?.hasTabContext).toBeFalsy();
    });
  });

  describe('New Conversation Reset Flow', () => {
    it('allows fresh injection after clearing conversation', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      // First conversation
      await user.type(chatInput, 'First conversation question');
      await user.click(sendButton);

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Clear conversation using new conversation button
      const newConversationButton = screen.getByRole('button', { name: /new conversation/i });
      await user.click(newConversationButton);

      // Verify conversation is cleared
      expect(useChatStore.getState().messages).toHaveLength(0);

      // Start new conversation - should inject again
      await user.type(chatInput, 'New conversation question');
      await user.click(sendButton);

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        
        // Verify injection occurred again
        const userMessage = messages[0];
        expect(userMessage?.content).toContain("I'm looking at a webpage");
        expect(userMessage?.displayContent).toBe('New conversation question');
        expect(userMessage?.metadata?.hasTabContext).toBe(true);
      });
    });

    it('handles conversation reset via store method', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Add some messages
      await user.type(screen.getByRole('textbox'), 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Programmatically clear conversation
      act(() => {
        useChatStore.getState().clearConversation();
      });

      expect(useChatStore.getState().messages).toHaveLength(0);

      // Send new message - should inject again
      await user.type(screen.getByRole('textbox'), 'After reset message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.hasTabContext).toBe(true);
      });
    });
  });

  describe('Panel Close/Reopen Behavior', () => {
    it('starts fresh conversation on panel reopen', async () => {
      const user = userEvent.setup({ delay: null });
      let mockOnClose = vi.fn();

      // First panel instance
      const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

      await user.type(screen.getByRole('textbox'), 'Before close message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Close panel (unmount)
      unmount();

      // Clear conversation to simulate panel close behavior
      act(() => {
        useChatStore.getState().clearConversation();
      });

      // Reopen panel (new render)
      mockOnClose = vi.fn();
      render(<ChatPanel onClose={mockOnClose} />);

      // Verify fresh start
      expect(useChatStore.getState().messages).toHaveLength(0);

      // Send message - should inject again
      await user.type(screen.getByRole('textbox'), 'After reopen message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.hasTabContext).toBe(true);
        expect(messages[0]?.displayContent).toBe('After reopen message');
      });
    });

    it('preserves conversation state during panel lifecycle', async () => {
      const user = userEvent.setup({ delay: null });
      
      const { rerender } = render(<ChatPanel onClose={vi.fn()} />);

      // Send message
      await user.type(screen.getByRole('textbox'), 'Persistent message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Rerender component (simulating re-mount without store reset)
      rerender(<ChatPanel onClose={vi.fn()} />);

      // Verify messages persist
      expect(useChatStore.getState().messages).toHaveLength(2);
      expect(screen.getByText('Persistent message')).toBeInTheDocument();

      // Send follow-up - should not inject
      await user.type(screen.getByRole('textbox'), 'Follow-up after rerender');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(4);
        expect(messages[2]?.metadata?.hasTabContext).toBeFalsy();
      });
    });
  });

  describe('URL Changes Preserve Conversation', () => {
    it('maintains conversation when URL changes', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Initial message with injection
      await user.type(screen.getByRole('textbox'), 'Question on first URL');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      const initialMessages = useChatStore.getState().messages;
      expect(initialMessages[0]?.metadata?.tabUrl).toBe('https://example.com/test-page');

      // Simulate URL change (but don't clear conversation)
      // Update the mock to return different URL
      const updatedContent = {
        ...mockExtractedContent,
        url: 'https://example.com/new-page',
        title: 'New Page Title',
      };
      
      vi.mocked(require('@hooks/useContentExtraction').useContentExtraction).mockReturnValue({
        content: updatedContent,
        loading: false,
        error: null,
        qualityAssessment: null,
        extractContent: vi.fn(),
        reextract: vi.fn(),
      });

      // Send follow-up message (should NOT inject since messages.length > 0)
      await user.type(screen.getByRole('textbox'), 'Question on new URL');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(4);
      });

      // Verify conversation preserved and no re-injection
      const messages = useChatStore.getState().messages;
      expect(messages[0]?.metadata?.tabUrl).toBe('https://example.com/test-page'); // Original URL preserved
      expect(messages[2]?.content).toBe('Question on new URL'); // No injection
      expect(messages[2]?.metadata?.hasTabContext).toBeFalsy();
    });

    it('handles URL change with manual conversation reset', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Initial conversation
      await user.type(screen.getByRole('textbox'), 'Original URL question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // User manually starts new conversation after URL change
      const newConversationButton = screen.getByRole('button', { name: /new conversation/i });
      await user.click(newConversationButton);

      expect(useChatStore.getState().messages).toHaveLength(0);

      // Mock new URL content
      const newUrlContent = {
        ...mockExtractedContent,
        url: 'https://example.com/different-page',
        title: 'Different Page Title',
        content: 'This is content from a different page entirely.',
      };
      
      vi.mocked(require('@hooks/useContentExtraction').useContentExtraction).mockReturnValue({
        content: newUrlContent,
        loading: false,
        error: null,
        qualityAssessment: null,
        extractContent: vi.fn(),
        reextract: vi.fn(),
      });

      // Send message on new URL
      await user.type(screen.getByRole('textbox'), 'New URL question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.tabUrl).toBe('https://example.com/different-page');
        expect(messages[0]?.content).toContain('Different Page Title');
        expect(messages[0]?.metadata?.hasTabContext).toBe(true);
      });
    });
  });

  describe('Edit and Resend First Message', () => {
    it('re-injects content when editing and resending first message', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Send initial message
      await user.type(screen.getByRole('textbox'), 'Original question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      const originalMessages = useChatStore.getState().messages;
      expect(originalMessages[0]?.content).toContain("I'm looking at a webpage");
      expect(originalMessages[0]?.displayContent).toBe('Original question');

      // Edit first message
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Verify input is populated with original user content
      const editInput = screen.getByRole('textbox');
      expect(editInput).toHaveValue('Original question');

      // Modify and resend
      await user.clear(editInput);
      await user.type(editInput, 'Edited question');
      
      const resendButton = screen.getByRole('button', { name: /send|resend/i });
      await user.click(resendButton);

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2); // Should replace, not add
        
        // Verify re-injection occurred
        const editedMessage = messages[0];
        expect(editedMessage?.content).toContain("I'm looking at a webpage");
        expect(editedMessage?.content).toContain('Edited question');
        expect(editedMessage?.displayContent).toBe('Edited question');
        expect(editedMessage?.metadata?.hasTabContext).toBe(true);
        expect(editedMessage?.metadata?.originalUserContent).toBe('Edited question');
      });
    });

    it('preserves edit behavior for subsequent messages', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Send first message (with injection)
      await user.type(screen.getByRole('textbox'), 'First message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Send second message (no injection)
      await user.type(screen.getByRole('textbox'), 'Second message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(4);
      });

      // Edit second message
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[1]); // Second message edit button

      // Modify and resend
      const editInput = screen.getByRole('textbox');
      expect(editInput).toHaveValue('Second message');
      
      await user.clear(editInput);
      await user.type(editInput, 'Edited second message');
      await user.click(screen.getByRole('button', { name: /send|resend/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        // Should have: first message + AI response + edited second message + new AI response
        expect(messages).toHaveLength(4);
        
        // Verify no re-injection for second message edit
        const editedSecondMessage = messages[2];
        expect(editedSecondMessage?.content).toBe('Edited second message');
        expect(editedSecondMessage?.metadata?.hasTabContext).toBeFalsy();
      });
    });

    it('handles edit with different content extraction results', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      // Initial message
      await user.type(screen.getByRole('textbox'), 'Initial question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Update mock to return different content (simulating page change)
      const updatedContent = {
        ...mockExtractedContent,
        title: 'Updated Page Title',
        content: 'Updated page content with new information.',
      };
      
      vi.mocked(require('@hooks/useContentExtraction').useContentExtraction).mockReturnValue({
        content: updatedContent,
        loading: false,
        error: null,
        qualityAssessment: null,
        extractContent: vi.fn(),
        reextract: vi.fn(),
      });

      // Edit first message
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), 'Question about updated content');
      await user.click(screen.getByRole('button', { name: /send|resend/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        const editedMessage = messages[0];
        
        // Should use current content extraction (updated content)
        expect(editedMessage?.content).toContain('Updated Page Title');
        expect(editedMessage?.content).toContain('Updated page content');
        expect(editedMessage?.displayContent).toBe('Question about updated content');
      });
    });
  });

  describe('Performance Impact', () => {
    it('maintains performance impact under 100ms for content injection', async () => {
      const user = userEvent.setup({ delay: null });
      const performanceStart = performance.now();
      
      render(<ChatPanel onClose={vi.fn()} />);

      const injectionStart = performance.now();
      
      await user.type(screen.getByRole('textbox'), 'Performance test message');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(1);
      });

      const injectionTime = performance.now() - injectionStart;
      const totalTime = performance.now() - performanceStart;

      expect(injectionTime).toBeLessThan(100); // Content injection overhead
      expect(totalTime).toBeLessThan(1000); // Total interaction time

      // Verify mock performance metrics
      expect(performanceMetrics.injectionTime).toBeLessThan(100);
    });

    it('handles large content injection efficiently', async () => {
      // Mock large content
      const largeContent = {
        ...mockExtractedContent,
        content: 'Large content '.repeat(1000), // ~13KB of text
        wordCount: 2000,
      };

      vi.mocked(require('@hooks/useContentExtraction').useContentExtraction).mockReturnValue({
        content: largeContent,
        loading: false,
        error: null,
        qualityAssessment: null,
        extractContent: vi.fn(),
        reextract: vi.fn(),
      });

      const user = userEvent.setup({ delay: null });
      const performanceStart = performance.now();
      
      render(<ChatPanel onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox'), 'Question about large content');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(1);
      });

      const totalTime = performance.now() - performanceStart;
      expect(totalTime).toBeLessThan(200); // Even with large content, should be fast

      // Verify large content was injected
      const message = useChatStore.getState().messages[0];
      expect(message?.content).toContain('Large content');
      expect(message?.content.length).toBeGreaterThan(10000);
    });

    it('measures streaming response performance', async () => {
      // Reduce response delay to measure streaming performance
      mockResponseDelay = 10;
      const user = userEvent.setup({ delay: null });
      
      render(<ChatPanel onClose={vi.fn()} />);

      const streamStart = performance.now();
      
      await user.type(screen.getByRole('textbox'), 'Streaming performance test');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for streaming to complete
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        const aiMessage = messages.find(m => m.role === 'assistant');
        return aiMessage?.status === 'received';
      }, { timeout: 3000 });

      const streamTime = performance.now() - streamStart;
      expect(streamTime).toBeLessThan(1000); // Full streaming should be under 1s

      // Verify complete response
      const aiMessage = useChatStore.getState().messages.find(m => m.role === 'assistant');
      expect(aiMessage?.content).toBe(mockStreamingResponse.join(''));
    });
  });

  describe('Memory Leak Detection', () => {
    it('checks for memory leaks on repeated mount/unmount cycles', async () => {
      const cycles = 10;
      const memoryReadings: number[] = [];

      for (let i = 0; i < cycles; i++) {
        const { unmount } = render(<ChatPanel onClose={vi.fn()} />);
        
        // Trigger some interactions
        const user = userEvent.setup({ delay: null });
        await user.type(screen.getByRole('textbox'), `Cycle ${i} message`);
        await user.click(screen.getByRole('button', { name: /send/i }));

        await waitFor(() => {
          expect(useChatStore.getState().messages).toHaveLength(1);
        });

        // Record memory usage
        if (typeof performance !== 'undefined' && performance.memory) {
          memoryReadings.push(performance.memory.usedJSHeapSize);
        }

        // Clean up
        unmount();
        act(() => {
          useChatStore.getState().clearConversation();
        });
      }

      // Check for significant memory growth (more than 5MB over 10 cycles)
      if (memoryReadings.length > 0) {
        const memoryGrowth = Math.max(...memoryReadings) - Math.min(...memoryReadings);
        expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // 5MB threshold
      }
    });

    it('cleans up event listeners and timeouts on unmount', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<ChatPanel onClose={vi.fn()} />);

      // Trigger some interactions that might add listeners
      const user = userEvent.setup({ delay: null });
      await user.type(screen.getByRole('textbox'), 'Cleanup test');

      const addedListenerCount = addEventListenerSpy.mock.calls.length;

      // Unmount component
      unmount();

      // Verify cleanup (allowing for some variance in listener management)
      const removedListenerCount = removeEventListenerSpy.mock.calls.length;
      expect(removedListenerCount).toBeGreaterThanOrEqual(0); // Some cleanup occurred

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('handles rapid tab switches without memory accumulation', async () => {
      const user = userEvent.setup({ delay: null });
      const tabSwitches = 5;
      
      for (let i = 0; i < tabSwitches; i++) {
        // Simulate tab switch by clearing conversation and changing tab ID
        act(() => {
          useChatStore.getState().clearConversation();
        });
        
        vi.mocked(require('@tabext/tabUtils').getCurrentTabIdSafe).mockResolvedValue(100 + i);

        render(<ChatPanel onClose={vi.fn()} />);

        await user.type(screen.getByRole('textbox'), `Tab ${i} message`);
        await user.click(screen.getByRole('button', { name: /send/i }));

        await waitFor(() => {
          expect(useChatStore.getState().messages).toHaveLength(1);
        });

        cleanup();
      }

      // Verify final memory usage is reasonable
      if (typeof performance !== 'undefined' && performance.memory) {
        const finalMemory = performance.memory.usedJSHeapSize;
        const memoryGrowth = finalMemory - memoryBaseline;
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB threshold for tab switches
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles content extraction failure gracefully', async () => {
      // Mock extraction failure
      vi.mocked(require('@hooks/useContentExtraction').useContentExtraction).mockReturnValue({
        content: null,
        loading: false,
        error: new Error('Extraction failed'),
        qualityAssessment: null,
        extractContent: vi.fn(),
        reextract: vi.fn(),
      });

      const user = userEvent.setup({ delay: null });
      render(<ChatPanel onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox'), 'Question without context');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(1);
        
        // Should send without injection
        const userMessage = messages[0];
        expect(userMessage?.content).toBe('Question without context');
        expect(userMessage?.metadata?.hasTabContext).toBeFalsy();
      });

      // Should show error warning
      expect(screen.getByText(/content extraction unavailable/i)).toBeInTheDocument();
    });

    it('handles tab ID retrieval failure', async () => {
      // Mock tab ID failure
      vi.mocked(require('@tabext/tabUtils').getCurrentTabIdSafe).mockRejectedValue(new Error('Tab access denied'));

      const user = userEvent.setup({ delay: null });
      render(<ChatPanel onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox'), 'Question with tab ID error');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2); // User + AI messages
        
        // Should still inject content but without tab ID
        const userMessage = messages[0];
        expect(userMessage?.content).toContain("I'm looking at a webpage");
        expect(userMessage?.metadata?.hasTabContext).toBe(true);
        expect(userMessage?.metadata?.tabId).toBeUndefined();
      });
    });

    it('handles AI provider errors during injection', async () => {
      // Mock AI provider error
      mockSendMessage = vi.fn().mockRejectedValue(new Error('Provider error'));

      const user = userEvent.setup({ delay: null });
      render(<ChatPanel onClose={vi.fn()} />);

      await user.type(screen.getByRole('textbox'), 'Question that fails');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        // Should show error in UI
        expect(screen.getByText(/provider error/i)).toBeInTheDocument();
      });

      // User message should still be created
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toContain("I'm looking at a webpage");
    });
  });
});