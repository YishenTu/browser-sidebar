/**
 * @file E2E Multi-Tab Flow Tests
 *
 * Comprehensive end-to-end tests for the multi-tab content injection workflow.
 * Tests complete user flows from sidebar opening to multi-tab context management,
 * including auto-load behavior, @ mention system, message sending, and tab management.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@sidebar/ChatPanel';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import type { ExtractedContent } from '@types/extraction';
import type { TabInfo, TabContent } from '@types/tabs';
import type { GetAllTabsResponsePayload, ExtractTabContentResponsePayload } from '@types/messages';

// Mock dependencies
vi.mock('@hooks/useMultiTabExtraction', () => ({
  useMultiTabExtraction: vi.fn(),
}));

vi.mock('@hooks/useTabMention', () => ({
  useTabMention: vi.fn(),
}));

vi.mock('@hooks/useAIChat', () => ({
  useAIChat: vi.fn(),
}));

vi.mock('@tabext/utils/tabUtils', () => ({
  getCurrentTabIdSafe: vi.fn(),
}));

vi.mock('@hooks/useDragPosition', () => ({
  useDragPosition: vi.fn(),
}));

vi.mock('@hooks/useResize', () => ({
  useResize: vi.fn(),
}));

vi.mock('@hooks/useContentExtraction', () => ({
  useContentExtraction: vi.fn(),
}));

// Mock extracted content templates
const createMockExtractedContent = (tabId: number, title: string, url: string): ExtractedContent => ({
  title,
  url,
  domain: new URL(url).hostname,
  content: `This is the main content of ${title} with detailed information about the page topic.`,
  links: [
    { text: 'Related Link 1', url: `${url}/related1` },
    { text: 'Related Link 2', url: `${url}/related2` },
  ],
  metadata: {
    description: `Description for ${title}`,
    keywords: ['test', 'content', 'multi-tab'],
    publishedTime: '2024-01-01T10:00:00Z',
    modifiedTime: '2024-01-01T12:00:00Z',
    favIconUrl: `${new URL(url).origin}/favicon.ico`,
    domain: new URL(url).hostname,
  },
  extractorUsed: 'readability',
  extractionTime: Date.now(),
  wordCount: 25,
  isContentExtracted: true,
  qualityScore: 0.85,
});

// Mock tab info templates
const createMockTabInfo = (tabId: number, title: string, url: string, active = false): TabInfo => ({
  id: tabId,
  title,
  url,
  domain: new URL(url).hostname,
  windowId: 1,
  favIconUrl: `${new URL(url).origin}/favicon.ico`,
  active,
  index: tabId - 1,
  pinned: false,
  status: 'complete',
  lastAccessed: Date.now() - (tabId * 1000), // Stagger access times
  audible: false,
});

// Mock data
const mockCurrentTab = createMockTabInfo(1, 'Current Tab - Documentation', 'https://docs.example.com/guide', true);
const mockCurrentTabContent = createMockExtractedContent(1, 'Current Tab - Documentation', 'https://docs.example.com/guide');

const mockAvailableTabs: TabInfo[] = [
  createMockTabInfo(2, 'API Reference - Development Tools', 'https://api.example.com/docs'),
  createMockTabInfo(3, 'Blog Post - Best Practices', 'https://blog.example.com/best-practices'),
  createMockTabInfo(4, 'GitHub Repository - Source Code', 'https://github.com/example/project'),
  createMockTabInfo(5, 'Stack Overflow - Q&A', 'https://stackoverflow.com/questions/12345'),
];

const mockTabContents: Record<number, ExtractedContent> = {
  1: mockCurrentTabContent,
  2: createMockExtractedContent(2, 'API Reference - Development Tools', 'https://api.example.com/docs'),
  3: createMockExtractedContent(3, 'Blog Post - Best Practices', 'https://blog.example.com/best-practices'),
  4: createMockExtractedContent(4, 'GitHub Repository - Source Code', 'https://github.com/example/project'),
  5: createMockExtractedContent(5, 'Stack Overflow - Q&A', 'https://stackoverflow.com/questions/12345'),
};

// Mock implementations
let mockMultiTabExtraction: any;
let mockTabMention: any;
let mockSendMessage: ReturnType<typeof vi.fn>;
let mockStreamingResponse: string[] = [];
let mockResponseDelay: number = 20;

// Performance tracking
let performanceMetrics = {
  autoLoadTime: 0,
  tabExtractionTime: 0,
  messageSendTime: 0,
  totalFlowTime: 0,
};

describe('E2E: Multi-Tab Content Flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup();

    // Reset stores
    useChatStore.getState().clearConversation();
    const settingsStore = useSettingsStore.getState();
    if ('resetSettings' in settingsStore && typeof settingsStore.resetSettings === 'function') {
      settingsStore.resetSettings();
    } else if (
      'resetToDefaults' in settingsStore &&
      typeof settingsStore.resetToDefaults === 'function'
    ) {
      await settingsStore.resetToDefaults();
    }

    // Reset performance metrics
    performanceMetrics = {
      autoLoadTime: 0,
      tabExtractionTime: 0,
      messageSendTime: 0,
      totalFlowTime: 0,
    };

    // Setup mock multi-tab extraction hook
    mockMultiTabExtraction = {
      currentTabContent: mockCurrentTabContent,
      currentTabId: 1,
      loadedTabs: { 1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' } },
      availableTabs: mockAvailableTabs,
      hasAutoLoaded: true,
      extractCurrentTab: vi.fn().mockImplementation(async () => {
        const startTime = performance.now();
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate extraction time
        performanceMetrics.autoLoadTime = performance.now() - startTime;
      }),
      extractTabById: vi.fn().mockImplementation(async (tabId: number) => {
        const startTime = performance.now();
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate extraction time
        
        // Simulate adding tab to loaded tabs
        const tabInfo = mockAvailableTabs.find(tab => tab.id === tabId);
        const extractedContent = mockTabContents[tabId];
        
        if (tabInfo && extractedContent) {
          const tabContent: TabContent = {
            tabInfo,
            extractedContent,
            extractionStatus: 'completed',
            isStale: false,
          };
          
          mockMultiTabExtraction.loadedTabs[tabId] = tabContent;
          mockMultiTabExtraction.availableTabs = mockMultiTabExtraction.availableTabs.filter(
            (tab: TabInfo) => tab.id !== tabId
          );
        }
        
        performanceMetrics.tabExtractionTime = performance.now() - startTime;
      }),
      removeLoadedTab: vi.fn().mockImplementation((tabId: number) => {
        const tabContent = mockMultiTabExtraction.loadedTabs[tabId];
        if (tabContent) {
          delete mockMultiTabExtraction.loadedTabs[tabId];
          mockMultiTabExtraction.availableTabs.push(tabContent.tabInfo);
        }
      }),
      clearAllTabs: vi.fn().mockImplementation(() => {
        mockMultiTabExtraction.loadedTabs = {};
        mockMultiTabExtraction.availableTabs = mockAvailableTabs;
        mockMultiTabExtraction.hasAutoLoaded = false;
      }),
      refreshAvailableTabs: vi.fn(),
      loading: false,
      loadingTabIds: [],
      error: null,
    };

    const { useMultiTabExtraction } = await import('@hooks/useMultiTabExtraction');
    vi.mocked(useMultiTabExtraction).mockReturnValue(mockMultiTabExtraction);

    // Setup mock tab mention hook
    mockTabMention = {
      mention: null,
      showDropdown: false,
      detectMention: vi.fn().mockImplementation((text: string, cursorPosition: number) => {
        // Detect @ mentions in text
        const atIndex = text.lastIndexOf('@', cursorPosition - 1);
        if (atIndex !== -1 && (atIndex === 0 || text[atIndex - 1] === ' ')) {
          const query = text.substring(atIndex + 1, cursorPosition);
          if (query.length > 0 && !query.includes(' ')) {
            const detection = { startIndex: atIndex, query };
            mockTabMention.mention = detection;
            mockTabMention.showDropdown = true;
            return detection;
          }
        }
        mockTabMention.mention = null;
        mockTabMention.showDropdown = false;
        return null;
      }),
      insertTab: vi.fn().mockImplementation((text: string, tab: TabInfo, mention: any) => {
        const tabReference = `Tab: ${tab.title} (${tab.domain})`;
        const beforeMention = text.substring(0, mention.startIndex);
        const afterMention = text.substring(mention.startIndex + mention.query.length + 1);
        const newText = beforeMention + tabReference + afterMention;
        const newCursorPosition = mention.startIndex + tabReference.length;
        
        return { newText, newCursorPosition };
      }),
      clearMention: vi.fn().mockImplementation(() => {
        mockTabMention.mention = null;
        mockTabMention.showDropdown = false;
      }),
      setMention: vi.fn(),
    };

    const { useTabMention } = await import('@hooks/useTabMention');
    vi.mocked(useTabMention).mockReturnValue(mockTabMention);

    // Setup mock AI chat
    mockStreamingResponse = [
      'Based on the content from ',
      'your multiple tabs, I can see you have ',
      'documentation, API references, and ',
      'blog posts. This gives me comprehensive ',
      'context to answer your questions about ',
      'development best practices.',
    ];

    mockSendMessage = vi.fn().mockImplementation(async (content, options) => {
      const startTime = performance.now();

      // Add user message to store
      if (!options?.skipUserMessage) {
        useChatStore.getState().addMessage({
          role: 'user',
          content: content,
          displayContent: options?.displayContent,
          metadata: options?.metadata,
        });
      }

      // Simulate AI response with multi-tab context
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

      performanceMetrics.messageSendTime = performance.now() - startTime;
    });

    const { useAIChat } = await import('@hooks/useAIChat');
    vi.mocked(useAIChat).mockReturnValue({
      sendMessage: mockSendMessage,
      isLoading: false,
      error: null,
    });

    // Setup Chrome API mocks for tab operations
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message) => {
      switch (message.type) {
        case 'GET_TAB_ID':
          return { payload: { tabId: 1 } };
        
        case 'GET_ALL_TABS':
          return {
            payload: {
              tabs: [mockCurrentTab, ...mockAvailableTabs],
            } as GetAllTabsResponsePayload,
          };
        
        case 'EXTRACT_TAB_CONTENT':
          const tabId = message.payload?.tabId;
          const content = mockTabContents[tabId as number];
          return {
            payload: { content },
          } as { payload: ExtractTabContentResponsePayload };
        
        default:
          return { success: false };
      }
    });

    // Setup other mocks
    const { getCurrentTabIdSafe } = await import('@tabext/utils/tabUtils');
    vi.mocked(getCurrentTabIdSafe).mockResolvedValue(1);
    
    const { useDragPosition } = await import('@hooks/useDragPosition');
    vi.mocked(useDragPosition).mockReturnValue({
      position: { x: 100, y: 100 },
      isDragging: false,
      onMouseDown: vi.fn(),
      setPosition: vi.fn(),
    });

    const { useResize } = await import('@hooks/useResize');
    vi.mocked(useResize).mockReturnValue({
      size: { width: 400, height: 600 },
      onMouseDown: vi.fn(),
      setSize: vi.fn(),
    });

    // Mock content extraction hook
    const { useContentExtraction } = await import('@hooks/useContentExtraction');
    vi.mocked(useContentExtraction).mockReturnValue({
      content: mockCurrentTabContent,
      loading: false,
      error: null,
      qualityAssessment: null,
      extractContent: vi.fn(),
      reextract: vi.fn(),
    });

    // Mock chrome storage to prevent loading issues
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      settings: {
        selectedModel: 'gpt-5-nano',
        apiKeyReferences: {
          openai: 'test-openai-key-ref',
          google: 'test-google-key-ref',
        }
      }
    });

    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      settings: {
        selectedModel: 'gpt-5-nano',
        apiKeyReferences: {
          openai: 'test-openai-key-ref',
          google: 'test-google-key-ref',
        }
      }
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
    cleanup();
    vi.clearAllMocks();
  });

  describe('Sidebar Opening and Auto-Load Behavior', () => {
    it('auto-loads current tab content when sidebar opens', async () => {
      const user = userEvent.setup({ delay: null });
      const startTime = performance.now();

      // Render sidebar (simulating opening)
      render(<ChatPanel onClose={vi.fn()} />);

      // Wait for sidebar to mount and auto-load current tab
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /type your message/i })).toBeInTheDocument();
      });

      // Verify auto-load was called
      expect(mockMultiTabExtraction.extractCurrentTab).toHaveBeenCalledTimes(1);

      // Verify current tab content is displayed in preview
      await waitFor(() => {
        expect(screen.getByText('Current Tab - Documentation')).toBeInTheDocument();
        expect(screen.getByText('docs.example.com')).toBeInTheDocument();
      });

      // Verify tab context indicator is shown
      const contextIndicator = screen.getByRole('img', { name: /tab context/i });
      expect(contextIndicator).toBeInTheDocument();

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Auto-load should be fast
      expect(performanceMetrics.autoLoadTime).toBeLessThan(200);
    });

    it('shows loading state during auto-load', async () => {
      // Mock slow auto-load
      mockMultiTabExtraction.extractCurrentTab = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      mockMultiTabExtraction.loading = true;
      mockMultiTabExtraction.currentTabContent = null;

      render(<ChatPanel onClose={vi.fn()} />);

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByText(/extracting content/i)).toBeInTheDocument();
      });

      // Update mock to completed state
      act(() => {
        mockMultiTabExtraction.loading = false;
        mockMultiTabExtraction.currentTabContent = mockCurrentTabContent;
      });

      // Wait for content to appear
      await waitFor(() => {
        expect(screen.getByText('Current Tab - Documentation')).toBeInTheDocument();
      });
    });

    it('handles auto-load failure gracefully', async () => {
      // Mock auto-load failure
      mockMultiTabExtraction.extractCurrentTab = vi.fn().mockRejectedValue(new Error('Network error'));
      mockMultiTabExtraction.error = new Error('Network error');
      mockMultiTabExtraction.currentTabContent = null;

      render(<ChatPanel onClose={vi.fn()} />);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/content extraction unavailable/i)).toBeInTheDocument();
      });

      // Chat input should still be available
      expect(screen.getByRole('textbox', { name: /type your message/i })).toBeInTheDocument();
    });
  });

  describe('@ Mention System for Adding Tabs', () => {
    it('shows dropdown when typing @ in chat input', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ to trigger mention
      await user.type(chatInput, '@');

      // Simulate mention detection
      act(() => {
        mockTabMention.detectMention('@', 1);
      });

      // Should show tab mention dropdown
      await waitFor(() => {
        expect(screen.getByRole('listbox', { name: /select tab to mention/i })).toBeInTheDocument();
      });

      // Should show available tabs
      expect(screen.getByText('API Reference - Development Tools')).toBeInTheDocument();
      expect(screen.getByText('Blog Post - Best Practices')).toBeInTheDocument();
      expect(screen.getByText('GitHub Repository - Source Code')).toBeInTheDocument();
    });

    it('filters tabs in dropdown based on @ mention query', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ with query to filter tabs
      await user.type(chatInput, '@api');

      // Simulate mention detection with query
      act(() => {
        mockTabMention.detectMention('@api', 4);
        // Simulate filtering in dropdown (would be handled by TabMentionDropdown component)
        mockMultiTabExtraction.availableTabs = [mockAvailableTabs[0]]; // Only API tab
      });

      await waitFor(() => {
        expect(screen.getByText('API Reference - Development Tools')).toBeInTheDocument();
      });

      // Should not show other tabs
      expect(screen.queryByText('Blog Post - Best Practices')).not.toBeInTheDocument();
    });

    it('selects and loads tab from dropdown', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ and select a tab
      await user.type(chatInput, '@');

      // Simulate dropdown opening
      act(() => {
        mockTabMention.detectMention('@', 1);
      });

      // Click on API tab option
      const apiTabOption = screen.getByText('API Reference - Development Tools');
      await user.click(apiTabOption);

      // Should call extractTabById
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(2);

      // Should insert tab reference in input
      expect(mockTabMention.insertTab).toHaveBeenCalledWith(
        '@',
        expect.objectContaining({ id: 2, title: 'API Reference - Development Tools' }),
        expect.objectContaining({ startIndex: 0, query: '' })
      );

      // Should close dropdown
      expect(mockTabMention.clearMention).toHaveBeenCalled();
    });

    it('handles keyboard navigation in tab dropdown', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ to trigger mention
      await user.type(chatInput, '@');

      // Simulate dropdown opening
      act(() => {
        mockTabMention.detectMention('@', 1);
      });

      const dropdown = screen.getByRole('listbox', { name: /select tab to mention/i });

      // Press arrow down to navigate
      await user.type(dropdown, '{ArrowDown}');
      await user.type(dropdown, '{ArrowDown}');

      // Press Enter to select
      await user.type(dropdown, '{Enter}');

      // Should have selected the appropriate tab
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalled();
    });
  });

  describe('Multi-Tab Message Sending and Context', () => {
    it('sends message with multi-tab context', async () => {
      const user = userEvent.setup({ delay: null });
      const startTime = performance.now();

      // Setup scenario with multiple loaded tabs
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
        3: { tabInfo: mockAvailableTabs[1], extractedContent: mockTabContents[3], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Type question
      await user.type(chatInput, 'Compare the documentation with the API reference and blog post');

      // Send message
      await user.click(sendButton);

      // Verify message was sent with multi-tab context
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2); // User + AI messages

        const userMessage = messages[0];
        expect(userMessage?.content).toContain('multiple tabs');
        expect(userMessage?.content).toContain('Current Tab - Documentation');
        expect(userMessage?.content).toContain('API Reference - Development Tools');
        expect(userMessage?.content).toContain('Blog Post - Best Practices');
        expect(userMessage?.displayContent).toBe('Compare the documentation with the API reference and blog post');
        expect(userMessage?.metadata?.hasTabContext).toBe(true);
        expect(userMessage?.metadata?.tabCount).toBe(3);
      });

      // Verify AI response references multiple tabs
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        const aiMessage = messages[1];
        expect(aiMessage?.content).toContain('multiple tabs');
        expect(aiMessage?.content).toContain('documentation, API references');
        expect(aiMessage?.status).toBe('received');
      });

      performanceMetrics.totalFlowTime = performance.now() - startTime;
      expect(performanceMetrics.totalFlowTime).toBeLessThan(2000);
    });

    it('shows multi-tab content preview with all loaded tabs', async () => {
      // Setup scenario with multiple loaded tabs
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
        3: { tabInfo: mockAvailableTabs[1], extractedContent: mockTabContents[3], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Should show current tab section
      expect(screen.getByText('Current Tab')).toBeInTheDocument();
      expect(screen.getByText('Current Tab - Documentation')).toBeInTheDocument();

      // Should show additional tabs section
      expect(screen.getByText('Additional Tabs (2)')).toBeInTheDocument();

      // Should show collapsible additional tabs
      const apiTab = screen.getByText('API Reference - Development Tools');
      expect(apiTab).toBeInTheDocument();

      const blogTab = screen.getByText('Blog Post - Best Practices');
      expect(blogTab).toBeInTheDocument();

      // Should show clear all button
      expect(screen.getByText(/clear all.*3 tabs/i)).toBeInTheDocument();
    });

    it('expands and collapses additional tabs in preview', async () => {
      const user = userEvent.setup({ delay: null });

      // Setup with additional tabs
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Find and click on API tab to expand
      const apiTabHeader = screen.getByText('API Reference - Development Tools');
      await user.click(apiTabHeader);

      // Should show expanded content
      await waitFor(() => {
        expect(screen.getByText(/development tools.*detailed information/i)).toBeInTheDocument();
      });

      // Click again to collapse
      await user.click(apiTabHeader);

      // Content should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/development tools.*detailed information/i)).not.toBeInTheDocument();
      });
    });

    it('handles loading state for individual tabs', async () => {
      // Setup with one tab loading
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: null, extractionStatus: 'extracting' },
      };
      mockMultiTabExtraction.loadingTabIds = [2];

      render(<ChatPanel onClose={vi.fn()} />);

      // Should show loading indicator for the extracting tab
      expect(screen.getByText('API Reference - Development Tools')).toBeInTheDocument();
      // Loading spinner would be shown by the MultiTabContentPreview component
    });
  });

  describe('Tab Management - Remove and Re-add', () => {
    it('removes individual tabs from loaded collection', async () => {
      const user = userEvent.setup({ delay: null });

      // Setup with multiple loaded tabs
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
        3: { tabInfo: mockAvailableTabs[1], extractedContent: mockTabContents[3], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Find remove button for API tab (should be in additional tabs section)
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      const apiRemoveButton = removeButtons.find(button => 
        button.getAttribute('aria-label')?.includes('API Reference')
      );

      expect(apiRemoveButton).toBeInTheDocument();

      // Click remove button
      await user.click(apiRemoveButton!);

      // Should call removeLoadedTab
      expect(mockMultiTabExtraction.removeLoadedTab).toHaveBeenCalledWith(2);

      // Tab should be removed from loaded tabs and added back to available tabs
      expect(mockMultiTabExtraction.loadedTabs[2]).toBeUndefined();
      expect(mockMultiTabExtraction.availableTabs).toContain(
        expect.objectContaining({ id: 2, title: 'API Reference - Development Tools' })
      );
    });

    it('removes all tabs with clear all button', async () => {
      const user = userEvent.setup({ delay: null });

      // Setup with multiple loaded tabs
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
        3: { tabInfo: mockAvailableTabs[1], extractedContent: mockTabContents[3], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Find and click clear all button
      const clearAllButton = screen.getByText(/clear all.*3 tabs/i);
      await user.click(clearAllButton);

      // Should call clearAllTabs
      expect(mockMultiTabExtraction.clearAllTabs).toHaveBeenCalled();

      // All tabs should be cleared and conversation reset
      expect(mockMultiTabExtraction.loadedTabs).toEqual({});
      expect(mockMultiTabExtraction.availableTabs).toEqual(mockAvailableTabs);
    });

    it('re-adds previously removed tabs via @ mention', async () => {
      const user = userEvent.setup({ delay: null });

      // Start with API tab loaded
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
      };
      mockMultiTabExtraction.availableTabs = mockAvailableTabs.slice(1); // Remove API tab from available

      render(<ChatPanel onClose={vi.fn()} />);

      // Remove the API tab
      const removeButton = screen.getByRole('button', { name: /remove.*api reference/i });
      await user.click(removeButton);

      // Verify tab was removed and added back to available
      expect(mockMultiTabExtraction.removeLoadedTab).toHaveBeenCalledWith(2);

      // Now re-add the same tab via @ mention
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ and select the API tab again
      await user.type(chatInput, '@api');

      // Simulate dropdown and selection
      act(() => {
        mockTabMention.detectMention('@api', 4);
      });

      const apiTabOption = screen.getByText('API Reference - Development Tools');
      await user.click(apiTabOption);

      // Should extract the tab again
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(2);

      // Tab should be loaded again
      expect(mockMultiTabExtraction.loadedTabs[2]).toBeDefined();
    });

    it('maintains conversation state when removing/adding tabs', async () => {
      const user = userEvent.setup({ delay: null });

      // Setup initial state with messages and tabs
      act(() => {
        useChatStore.getState().addMessage({
          role: 'user',
          content: 'Initial question with tab context',
          metadata: { hasTabContext: true, tabCount: 2 },
        });
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: 'Response based on multi-tab context',
        });
      });

      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Verify initial messages are present
      expect(screen.getByText('Initial question with tab context')).toBeInTheDocument();
      expect(screen.getByText('Response based on multi-tab context')).toBeInTheDocument();

      // Remove a tab
      const removeButton = screen.getByRole('button', { name: /remove.*api reference/i });
      await user.click(removeButton);

      // Messages should still be present
      expect(screen.getByText('Initial question with tab context')).toBeInTheDocument();
      expect(screen.getByText('Response based on multi-tab context')).toBeInTheDocument();

      // Send new message with reduced tab context
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      await user.type(chatInput, 'Follow-up question');
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Should have new messages in addition to old ones
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(4); // 2 initial + 2 new
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles tab extraction failure during @ mention selection', async () => {
      const user = userEvent.setup({ delay: null });

      // Mock extraction failure
      mockMultiTabExtraction.extractTabById = vi.fn().mockRejectedValue(new Error('Tab extraction failed'));

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Type @ and attempt to select a tab
      await user.type(chatInput, '@');

      act(() => {
        mockTabMention.detectMention('@', 1);
      });

      const apiTabOption = screen.getByText('API Reference - Development Tools');
      await user.click(apiTabOption);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/tab extraction failed/i)).toBeInTheDocument();
      });

      // Tab should be marked as failed but still in loaded tabs
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(2);
    });

    it('handles excessive tabs warning', async () => {
      // Setup with many tabs to trigger warning
      const manyTabs: Record<number, TabContent> = {};
      for (let i = 1; i <= 12; i++) {
        manyTabs[i] = {
          tabInfo: createMockTabInfo(i, `Tab ${i}`, `https://example${i}.com`),
          extractedContent: createMockExtractedContent(i, `Tab ${i}`, `https://example${i}.com`),
          extractionStatus: 'completed',
          isStale: false,
        };
      }

      mockMultiTabExtraction.loadedTabs = manyTabs;

      render(<ChatPanel onClose={vi.fn()} />);

      // Should show warning for excessive tabs
      await waitFor(() => {
        expect(screen.getByText(/you have 12 tabs loaded.*consider reducing/i)).toBeInTheDocument();
      });

      // Should still show clear all button
      expect(screen.getByText(/clear all.*12 tabs/i)).toBeInTheDocument();
    });

    it('handles empty tab list gracefully', async () => {
      // Mock empty state
      mockMultiTabExtraction.currentTabContent = null;
      mockMultiTabExtraction.loadedTabs = {};
      mockMultiTabExtraction.availableTabs = [];
      mockMultiTabExtraction.hasAutoLoaded = false;

      render(<ChatPanel onClose={vi.fn()} />);

      // Should still render chat input
      expect(screen.getByRole('textbox', { name: /type your message/i })).toBeInTheDocument();

      // Should show no content available message
      expect(screen.getByText(/no content available/i)).toBeInTheDocument();

      // @ mentions should show empty dropdown or not trigger
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      const user = userEvent.setup({ delay: null });
      
      await user.type(chatInput, '@');

      // Should not show dropdown or show empty state
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('maintains performance under load with many tabs', async () => {
      const user = userEvent.setup({ delay: null });
      const startTime = performance.now();

      // Setup with moderate number of tabs
      const manyTabs: Record<number, TabContent> = {};
      for (let i = 1; i <= 8; i++) {
        manyTabs[i] = {
          tabInfo: createMockTabInfo(i, `Performance Tab ${i}`, `https://perf${i}.example.com`),
          extractedContent: createMockExtractedContent(i, `Performance Tab ${i}`, `https://perf${i}.example.com`),
          extractionStatus: 'completed',
          isStale: false,
        };
      }

      mockMultiTabExtraction.loadedTabs = manyTabs;

      render(<ChatPanel onClose={vi.fn()} />);

      // Perform various operations
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      await user.type(chatInput, 'Performance test with many tabs loaded');

      // Send message
      await user.click(screen.getByRole('button', { name: /send/i }));

      // Wait for completion
      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
      });

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(3000); // Should handle 8 tabs efficiently
    });
  });

  describe('Integration with Chat State Management', () => {
    it('preserves multi-tab state across conversation resets', async () => {
      const user = userEvent.setup({ delay: null });

      // Setup initial multi-tab state
      mockMultiTabExtraction.loadedTabs = {
        1: { tabInfo: mockCurrentTab, extractedContent: mockCurrentTabContent, extractionStatus: 'completed' },
        2: { tabInfo: mockAvailableTabs[0], extractedContent: mockTabContents[2], extractionStatus: 'completed' },
      };

      render(<ChatPanel onClose={vi.fn()} />);

      // Send initial message
      const chatInput = screen.getByRole('textbox', { name: /type your message/i });
      await user.type(chatInput, 'Initial message with tabs');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(useChatStore.getState().messages).toHaveLength(2);
      });

      // Clear conversation using new conversation button
      const newConversationButton = screen.getByRole('button', { name: /new conversation/i });
      await user.click(newConversationButton);

      // Conversation should be cleared but tabs should remain loaded
      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(Object.keys(mockMultiTabExtraction.loadedTabs)).toHaveLength(2);

      // Send new message - should still have multi-tab context
      await user.type(chatInput, 'New conversation with same tabs');
      await user.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages).toHaveLength(2);
        expect(messages[0]?.metadata?.hasTabContext).toBe(true);
        expect(messages[0]?.metadata?.tabCount).toBe(2);
      });
    });

    it('handles rapid tab operations without race conditions', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ChatPanel onClose={vi.fn()} />);

      const chatInput = screen.getByRole('textbox', { name: /type your message/i });

      // Rapidly add multiple tabs via @ mentions
      const tabIds = [2, 3, 4];
      
      for (const tabId of tabIds) {
        await user.clear(chatInput);
        await user.type(chatInput, '@');
        
        act(() => {
          mockTabMention.detectMention('@', 1);
        });

        const tabOption = screen.getByText(mockAvailableTabs[tabId - 2].title);
        await user.click(tabOption);
        
        // Small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // All tabs should be extracted without conflicts
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledTimes(3);
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(2);
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(3);
      expect(mockMultiTabExtraction.extractTabById).toHaveBeenCalledWith(4);

      // Final state should be consistent
      expect(Object.keys(mockMultiTabExtraction.loadedTabs)).toContain('2');
      expect(Object.keys(mockMultiTabExtraction.loadedTabs)).toContain('3');
      expect(Object.keys(mockMultiTabExtraction.loadedTabs)).toContain('4');
    });
  });
});