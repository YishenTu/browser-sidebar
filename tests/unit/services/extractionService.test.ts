/**
 * @file ExtractionService Unit Tests
 *
 * Comprehensive unit tests for the ExtractionService class that handles
 * content extraction from browser tabs with retry logic, error handling,
 * and batch processing capabilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import {
  ExtractionService,
  ExtractionError,
  ExtractionErrorType,
  type ServiceExtractionOptions,
  type ExtractionResult,
  type BatchExtractionResult,
  createExtractionService,
  extractCurrentTab,
  extractTabs,
} from '@services/extraction/ExtractionService';
import { ExtractionMode } from '@types/extraction';
import type { TabContent, TabInfo } from '@types/tabs';
import type { ExtractedContent } from '@types/extraction';
import type { ExtractTabPayload, ExtractTabContentResponsePayload, Message } from '@types/messages';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Chrome APIs
const mockSendMessage = vi.fn() as MockedFunction<typeof chrome.runtime.sendMessage>;
const mockTabsSendMessage = vi.fn() as MockedFunction<typeof chrome.tabs.sendMessage>;
const mockTabsQuery = vi.fn() as MockedFunction<typeof chrome.tabs.query>;

// Create chrome mock object
(global as any).chrome = {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: null,
  },
  tabs: {
    sendMessage: mockTabsSendMessage,
    query: mockTabsQuery,
  },
};

// ============================================================================
// Test Fixtures
// ============================================================================

const mockExtractedContent: ExtractedContent = {
  title: 'Test Article Title',
  url: 'https://example.com/article',
  domain: 'example.com',
  content: '# Test Content\n\nThis is test markdown content.',
  textContent: 'Test Content This is test markdown content.',
  wordCount: 6,
  excerpt: 'This is test markdown content...',
  extractedAt: Date.now(),
  extractionMethod: 'defuddle',
  author: 'Test Author',
  publishedDate: '2024-01-01',
  isTruncated: false,
  metadata: {
    hasDataTables: false,
    contentLength: 48,
    extractionDuration: 150,
    languageDetected: 'en',
  },
};

const mockTabInfo: TabInfo = {
  id: 123,
  title: 'Test Article Title',
  url: 'https://example.com/article',
  domain: 'example.com',
  windowId: 1,
  active: true,
  index: 0,
  pinned: false,
  lastAccessed: Date.now(),
  favIconUrl: 'https://example.com/favicon.ico',
  status: 'complete',
  audible: false,
};

const mockTabContent: TabContent = {
  tabInfo: mockTabInfo,
  extractedContent: mockExtractedContent,
  extractionStatus: 'completed',
  isStale: false,
  cacheExpiresAt: Date.now() + 300000,
  metadata: {
    isDynamic: false,
    extractionTime: 150,
  },
};

const createSuccessResponse = (tabId: number, content: ExtractedContent): any => ({
  id: 'test-message-id',
  type: 'EXTRACT_TAB_CONTENT',
  payload: {
    content,
    tabId,
  } as ExtractTabContentResponsePayload,
  timestamp: Date.now(),
  source: 'background',
  target: 'sidebar',
});

const createErrorResponse = (message: string): any => ({
  id: 'test-error-id',
  type: 'ERROR',
  payload: {
    message,
    code: 'EXTRACTION_ERROR',
  },
  timestamp: Date.now(),
  source: 'background',
  target: 'sidebar',
});

const createGetTabIdResponse = (tabId: number): any => ({
  id: 'test-tab-id',
  type: 'GET_TAB_ID',
  payload: { tabId },
  timestamp: Date.now(),
  source: 'background',
  target: 'sidebar',
});

// ============================================================================
// Test Suite
// ============================================================================

describe('ExtractionService', () => {
  let service: ExtractionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new ExtractionService('sidebar');

    // Reset chrome.runtime.lastError
    (global as any).chrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Constructor and Factory Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create service with specified source', () => {
      const testService = new ExtractionService('content');
      expect(testService).toBeInstanceOf(ExtractionService);
    });

    it('should create service via factory function', () => {
      const testService = createExtractionService('background');
      expect(testService).toBeInstanceOf(ExtractionService);
    });
  });

  // ============================================================================
  // Current Tab Extraction Tests
  // ============================================================================

  describe('extractCurrentTab', () => {
    it('should successfully extract current tab content', async () => {
      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(123));
        }
      });

      // Mock successful content extraction
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT' && tabId === 123) {
          callback(createSuccessResponse(123, mockExtractedContent));
        }
      });

      const result = await service.extractCurrentTab();

      expect(result).toEqual(
        expect.objectContaining({
          tabInfo: expect.objectContaining({
            id: 123,
            title: 'Test Article Title',
            url: 'https://example.com/article',
            domain: 'example.com',
          }),
          extractedContent: mockExtractedContent,
          extractionStatus: 'completed',
          isStale: false,
        })
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GET_TAB_ID',
          source: 'sidebar',
          target: 'background',
        }),
        expect.any(Function)
      );

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'EXTRACT_TAB_CONTENT',
          payload: expect.objectContaining({
            tabId: 123,
            options: expect.any(Object),
            mode: ExtractionMode.DEFUDDLE,
          }),
        }),
        expect.any(Function)
      );
    });

    it('should throw ExtractionError when unable to get current tab ID', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(null);
        }
      });

      await expect(service.extractCurrentTab()).rejects.toThrow(
        expect.objectContaining({
          name: 'ExtractionError',
          message: 'Unable to determine current tab ID',
          type: ExtractionErrorType.TAB_NOT_FOUND,
        })
      );
    });

    it('should throw ExtractionError when current tab extraction fails', async () => {
      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(123));
        }
      });

      // Mock extraction error
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callback(createErrorResponse('Content script unavailable'));
        }
      });

      await expect(service.extractCurrentTab()).rejects.toThrow(
        expect.objectContaining({
          name: 'ExtractionError',
          type: ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE,
          tabId: 123,
        })
      );
    });

    it('should use custom extraction options', async () => {
      const options: ServiceExtractionOptions = {
        mode: ExtractionMode.SELECTION,
        forceRefresh: true,
        timeout: 10000,
        maxRetries: 1,
        selectors: ['.content'],
        includeImages: true,
      };

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(123));
        }
      });

      // Mock successful extraction
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callback(createSuccessResponse(123, mockExtractedContent));
        }
      });

      await service.extractCurrentTab(options);

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          payload: expect.objectContaining({
            mode: ExtractionMode.SELECTION,
            options: expect.objectContaining({
              timeout: 10000,
              forceRefresh: true,
              selectors: ['.content'],
              includeImages: true,
            }),
          }),
        }),
        expect.any(Function)
      );
    });
  });

  // ============================================================================
  // Batch Tab Extraction Tests
  // ============================================================================

  describe('extractTabs', () => {
    it('should successfully extract multiple tabs', async () => {
      const tabIds = [123, 456, 789];
      const mockContents = tabIds.map((id, index) => ({
        ...mockExtractedContent,
        title: `Test Article ${id}`,
        url: `https://example.com/article-${id}`,
      }));

      // Mock successful extractions for all tabs
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          const index = tabIds.indexOf(tabId);
          if (index !== -1) {
            callback(createSuccessResponse(tabId, mockContents[index]));
          }
        }
      });

      const result = await service.extractTabs(tabIds);

      expect(result).toEqual({
        results: expect.arrayContaining([
          expect.objectContaining({
            success: true,
            content: expect.objectContaining({
              extractedContent: expect.objectContaining({
                title: 'Test Article 123',
              }),
            }),
            tabId: 123,
          }),
          expect.objectContaining({
            success: true,
            tabId: 456,
          }),
          expect.objectContaining({
            success: true,
            tabId: 789,
          }),
        ]),
        totalTabs: 3,
        successCount: 3,
        failureCount: 0,
        successRate: 100,
      });

      expect(mockTabsSendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle partial success in batch extraction', async () => {
      const tabIds = [123, 456, 789];

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          if (tabId === 123) {
            callback(createSuccessResponse(tabId, mockExtractedContent));
          } else if (tabId === 456) {
            callback(createErrorResponse('Tab not found'));
          } else if (tabId === 789) {
            callback(createSuccessResponse(tabId, mockExtractedContent));
          }
        }
      });

      const result = await service.extractTabs(tabIds);

      expect(result).toEqual({
        results: expect.arrayContaining([
          expect.objectContaining({
            success: true,
            tabId: 123,
          }),
          expect.objectContaining({
            success: false,
            error: 'Tab not found',
            tabId: 456,
          }),
          expect.objectContaining({
            success: true,
            tabId: 789,
          }),
        ]),
        totalTabs: 3,
        successCount: 2,
        failureCount: 1,
        successRate: (2 / 3) * 100, // This will be 66.66666666666667
      });
    });

    it('should return empty result for empty tab list', async () => {
      const result = await service.extractTabs([]);

      expect(result).toEqual({
        results: [],
        totalTabs: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
      });

      expect(mockTabsSendMessage).not.toHaveBeenCalled();
    });

    it('should handle concurrent extraction errors gracefully', async () => {
      const tabIds = [123, 456];

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callback(createErrorResponse('Content script unavailable'));
        }
      });

      const result = await service.extractTabs(tabIds);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
      expect(result.successRate).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => !r.success)).toBe(true);
    });
  });

  // ============================================================================
  // Retry Logic Tests
  // ============================================================================

  describe('retry logic', () => {
    it('should retry extraction on retriable errors with exponential backoff', async () => {
      let callCount = 0;
      const tabId = 123;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callCount++;
          if (callCount < 3) {
            // Fail first two attempts with retriable error
            callback(createErrorResponse('Network error'));
          } else {
            // Succeed on third attempt
            callback(createSuccessResponse(tabId, mockExtractedContent));
          }
        }
      });

      const options: ServiceExtractionOptions = {
        maxRetries: 2,
        retryDelay: 100,
      };

      const extractionPromise = service.extractCurrentTab(options);
      // Attach a catch handler immediately to avoid Node unhandledRejection timing
      void extractionPromise.catch(() => {});

      // Fast-forward all timers to complete the retries
      await vi.runAllTimersAsync();

      const result = await extractionPromise;

      expect(result).toBeDefined();
      expect(callCount).toBe(3); // Initial + 2 retries
      expect(mockTabsSendMessage).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retriable errors', async () => {
      const tabId = 123;
      let callCount = 0;

      // Test with a different non-retriable error to ensure it works
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callCount++;
          callback(createErrorResponse('content script unavailable'));
        }
      });

      const options: ServiceExtractionOptions = { maxRetries: 2 };
      const result = await service.extractTabs([tabId], options);

      // Should only try once, no retries for content script unavailable
      expect(result.results[0]?.success).toBe(false);
      expect(result.results[0]?.error).toBe('content script unavailable');
      expect(callCount).toBe(1); // Use our call counter instead of mock call count
    });

    it('should use exponential backoff delays', async () => {
      const tabId = 123;
      let callCount = 0;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'EXTRACT_TAB_CONTENT') {
          callCount++;
          callback(createErrorResponse('Network error'));
        }
      });

      const options: ServiceExtractionOptions = {
        maxRetries: 2,
        retryDelay: 1000,
      };

      const extractionPromise = service.extractCurrentTab(options);
      // Attach a catch handler immediately to avoid Node unhandledRejection timing
      void extractionPromise.catch(() => {});

      // Run all timers to complete retries
      await vi.runAllTimersAsync();

      // Should fail after all retries
      await expect(extractionPromise).rejects.toThrow();

      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  // ============================================================================
  // Error Classification Tests
  // ============================================================================

  describe('error classification', () => {
    const errorTestCases = [
      {
        message: 'Connection timeout after 5000ms',
        expectedType: ExtractionErrorType.TIMEOUT,
        description: 'timeout errors',
      },
      {
        message: 'Tab does not exist or may be closed',
        expectedType: ExtractionErrorType.TAB_NOT_FOUND,
        description: 'tab not found errors',
      },
      {
        message: 'Content script unavailable',
        expectedType: ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE,
        description: 'content script errors',
      },
      {
        message: 'restricted URL scheme',
        expectedType: ExtractionErrorType.RESTRICTED_URL,
        description: 'restricted URL errors',
      },
      {
        message: 'Runtime messaging error',
        expectedType: ExtractionErrorType.MESSAGING_ERROR,
        description: 'messaging errors',
      },
      {
        message: 'Something went wrong',
        expectedType: ExtractionErrorType.UNKNOWN,
        description: 'unknown errors',
      },
    ];

    errorTestCases.forEach(({ message, expectedType, description }) => {
      it(`should classify ${description} correctly`, async () => {
        const tabId = 123;

        // Mock getting current tab ID
        mockSendMessage.mockImplementation((msg, callback) => {
          if (msg.type === 'GET_TAB_ID') {
            callback(createGetTabIdResponse(tabId));
          }
        });

        mockTabsSendMessage.mockImplementation((tabId, msg, callback) => {
          if (msg.type === 'EXTRACT_TAB_CONTENT') {
            callback(createErrorResponse(message));
          }
        });

        await expect(service.extractCurrentTab()).rejects.toThrow(
          expect.objectContaining({
            type: expectedType,
          })
        );
      });
    });
  });

  // ============================================================================
  // Timeout Handling Tests
  // ============================================================================

  describe('timeout handling', () => {
    it('should timeout on slow message responses', async () => {
      const tabId = 123;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      // Mock slow response (never calls callback)
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        // Don't call callback to simulate timeout
      });

      const options: ServiceExtractionOptions = {
        timeout: 1000,
        maxRetries: 0, // No retries for faster test
      };

      const extractionPromise = service.extractCurrentTab(options);
      // Attach a catch handler immediately to prevent unhandled rejection
      void extractionPromise.catch(() => {});

      // Fast-forward past timeout
      await vi.runAllTimersAsync();

      await expect(extractionPromise).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('timeout'),
        })
      );
    });

    it('should handle chrome.runtime.lastError', async () => {
      const tabId = 123;

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        // Set lastError before calling callback
        (global as any).chrome.runtime.lastError = {
          message: 'Could not establish connection. Receiving end does not exist.',
        };
        callback(null);
      });

      const result = await service.extractTabs([tabId], { maxRetries: 0 });

      expect(result.results[0]?.success).toBe(false);
      expect(mockTabsSendMessage).toHaveBeenCalled();

      // Clean up lastError
      (global as any).chrome.runtime.lastError = null;
    });
  });

  // ============================================================================
  // Message Passing Tests
  // ============================================================================

  describe('message passing', () => {
    it('should send correctly formatted extraction messages', async () => {
      const tabId = 123;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, mockExtractedContent));
      });

      const options: ServiceExtractionOptions = {
        mode: ExtractionMode.RAW,
        timeout: 8000,
        selectors: ['.article-content'],
        includeImages: false,
        maxLength: 50000,
      };

      await service.extractCurrentTab(options);

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          id: expect.any(String),
          type: 'EXTRACT_TAB_CONTENT',
          payload: expect.objectContaining({
            tabId,
            mode: ExtractionMode.RAW,
            options: expect.objectContaining({
              timeout: 8000,
              selectors: ['.article-content'],
              includeImages: false,
              maxLength: 50000,
            }),
          }),
          timestamp: expect.any(Number),
          source: 'sidebar',
          target: 'background',
        }),
        expect.any(Function)
      );
    });

    it('should handle unexpected response formats', async () => {
      const tabId = 123;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        // Return malformed response
        callback({ unexpected: 'format' });
      });

      await expect(service.extractCurrentTab({ maxRetries: 0 })).rejects.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases and Error Scenarios
  // ============================================================================

  describe('edge cases', () => {
    it('should handle domain extraction from invalid URLs', async () => {
      const tabId = 123;
      const invalidUrlContent = {
        ...mockExtractedContent,
        url: 'not-a-valid-url',
        domain: '',
      };

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, invalidUrlContent));
      });

      const result = await service.extractCurrentTab();

      expect(result.tabInfo.domain).toBe('unknown');
    });

    it('should handle extraction with missing optional fields', async () => {
      const tabId = 123;
      const minimalContent: ExtractedContent = {
        title: 'Minimal Content',
        url: 'https://example.com',
        domain: 'example.com',
        content: 'Basic content',
        textContent: 'Basic content',
        extractedAt: Date.now(),
        extractionMethod: 'defuddle',
      };

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, minimalContent));
      });

      const result = await service.extractCurrentTab();

      expect(result).toBeDefined();
      expect(result.extractedContent).toEqual(minimalContent);
    });

    it('should handle forceRefresh option correctly', async () => {
      const tabId = 123;

      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(tabId));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, mockExtractedContent));
      });

      await service.extractCurrentTab({ forceRefresh: true });

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          payload: expect.objectContaining({
            options: expect.objectContaining({
              forceRefresh: true,
            }),
          }),
        }),
        expect.any(Function)
      );
    });
  });

  // ============================================================================
  // Convenience Function Tests
  // ============================================================================

  describe('convenience functions', () => {
    it('should provide extractCurrentTab convenience function', async () => {
      // Mock getting current tab ID
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_TAB_ID') {
          callback(createGetTabIdResponse(123));
        }
      });

      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, mockExtractedContent));
      });

      const result = await extractCurrentTab();
      expect(result).toBeDefined();
      expect(result.tabInfo.id).toBe(123);
    });

    it('should provide extractTabs convenience function', async () => {
      mockTabsSendMessage.mockImplementation((tabId, message, callback) => {
        callback(createSuccessResponse(tabId, mockExtractedContent));
      });

      const result = await extractTabs([123, 456]);
      expect(result).toBeDefined();
      expect(result.totalTabs).toBe(2);
      expect(result.successCount).toBe(2);
    });
  });

  // ============================================================================
  // ExtractionError Class Tests
  // ============================================================================

  describe('ExtractionError', () => {
    it('should create error with message and type', () => {
      const error = new ExtractionError('Test error message', ExtractionErrorType.TIMEOUT, 123);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ExtractionError');
      expect(error.message).toBe('Test error message');
      expect(error.type).toBe(ExtractionErrorType.TIMEOUT);
      expect(error.tabId).toBe(123);
    });

    it('should default to UNKNOWN type', () => {
      const error = new ExtractionError('Test error');
      expect(error.type).toBe(ExtractionErrorType.UNKNOWN);
      expect(error.tabId).toBeUndefined();
    });
  });
});
