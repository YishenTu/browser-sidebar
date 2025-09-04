/**
 * @file Extraction Service
 *
 * Provides high-level API for content extraction from browser tabs.
 * Integrates with the background script messaging system and handles
 * retry logic, error handling, and consistent TabContent formatting.
 */

import type { TabContent, TabInfo } from '@/types/tabs';
import type { ExtractedContent, ExtractionOptions } from '@/types/extraction';
import { ExtractionMode } from '@/types/extraction';
import type { ExtractTabPayload, ExtractTabContentResponsePayload } from '@/types/messages';
import { createMessage, MessageSource } from '@/types/messages';
import { sendMessageAsync } from '@platform/chrome/runtime';
import { sendMessageToTab } from '@platform/chrome/tabs';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Extended extraction options with service-specific features
 */
export interface ServiceExtractionOptions extends ExtractionOptions {
  /** Force refresh extraction, ignoring cache */
  forceRefresh?: boolean;
  /** Extraction mode to use */
  mode?: ExtractionMode;
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Extraction result with success/error status
 */
export interface ExtractionResult {
  /** Whether the extraction was successful */
  success: boolean;
  /** Extracted content if successful */
  content?: TabContent;
  /** Error message if failed */
  error?: string;
  /** Tab ID that was processed */
  tabId: number;
}

/**
 * Batch extraction result for multiple tabs
 */
export interface BatchExtractionResult {
  /** Array of individual extraction results */
  results: ExtractionResult[];
  /** Total number of tabs processed */
  totalTabs: number;
  /** Number of successful extractions */
  successCount: number;
  /** Number of failed extractions */
  failureCount: number;
  /** Overall success rate as percentage */
  successRate: number;
}

/**
 * Extraction error types for better error handling
 */
export enum ExtractionErrorType {
  TIMEOUT = 'timeout',
  TAB_NOT_FOUND = 'tab_not_found',
  CONTENT_SCRIPT_UNAVAILABLE = 'content_script_unavailable',
  RESTRICTED_URL = 'restricted_url',
  MESSAGING_ERROR = 'messaging_error',
  UNKNOWN = 'unknown',
}

/**
 * Structured extraction error with type classification
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly type: ExtractionErrorType = ExtractionErrorType.UNKNOWN,
    public readonly tabId?: number
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// ============================================================================
// Extraction Service Implementation
// ============================================================================

/**
 * Service class for content extraction from browser tabs
 *
 * Provides high-level API for extracting content from current tab or multiple
 * tabs with retry logic, error handling, and consistent formatting.
 *
 * @example
 * ```ts
 * const service = new ExtractionService('sidebar');
 *
 * // Extract current tab
 * const result = await service.extractCurrentTab();
 *
 * // Extract multiple tabs
 * const results = await service.extractTabs([123, 456]);
 * ```
 */
export class ExtractionService {
  private readonly source: MessageSource;

  /**
   * Create a new extraction service instance
   *
   * @param source - The message source identifier for this service instance
   */
  constructor(source: MessageSource) {
    this.source = source;
  }

  /**
   * Get a list of available tabs from the background script
   *
   * Used by UI components to display tab metadata without accessing chrome.* directly.
   */
  public async getAllTabs(): Promise<TabInfo[]> {
    try {
      const message = createMessage({
        type: 'GET_ALL_TABS',
        source: this.source,
        target: 'background',
      });

      const response = await this.sendMessageWithTimeout(message, undefined, 5000);

      if (response && typeof response === 'object' && 'payload' in response) {
        const payload = (response as { payload: { tabs?: TabInfo[] } }).payload;
        if (payload?.tabs && Array.isArray(payload.tabs)) {
          return payload.tabs as TabInfo[];
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Extract content from the current active tab
   *
   * Determines the current tab ID and extracts its content with the specified
   * options. Includes retry logic and comprehensive error handling.
   *
   * @param options - Extraction configuration options
   * @returns Promise resolving to TabContent or throws ExtractionError
   */
  public async extractCurrentTab(options: ServiceExtractionOptions = {}): Promise<TabContent> {
    try {
      // Get current tab ID first
      const tabId = await this.getCurrentTabId();
      if (!tabId) {
        throw new ExtractionError(
          'Unable to determine current tab ID',
          ExtractionErrorType.TAB_NOT_FOUND
        );
      }

      // Extract content from the current tab
      const result = await this.extractTabById(tabId, options);
      if (!result.success || !result.content) {
        throw new ExtractionError(
          result.error || 'Failed to extract current tab content',
          this.classifyErrorType(result.error),
          tabId
        );
      }

      return result.content;
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      throw new ExtractionError(
        `Current tab extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        ExtractionErrorType.UNKNOWN
      );
    }
  }

  /**
   * Extract content from multiple tabs
   *
   * Processes multiple tabs concurrently with individual retry logic.
   * Returns results for all tabs, including failures with error details.
   *
   * @param tabIds - Array of tab IDs to extract content from
   * @param options - Extraction configuration options
   * @returns Promise resolving to batch extraction results
   */
  public async extractTabs(
    tabIds: number[],
    options: ServiceExtractionOptions = {}
  ): Promise<BatchExtractionResult> {
    if (tabIds.length === 0) {
      return {
        results: [],
        totalTabs: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
      };
    }

    // Extract all tabs concurrently
    const extractionPromises = tabIds.map(tabId => this.extractTabById(tabId, options));

    try {
      const results = await Promise.all(extractionPromises);

      // Calculate statistics
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      const successRate = (successCount / results.length) * 100;

      return {
        results,
        totalTabs: tabIds.length,
        successCount,
        failureCount,
        successRate,
      };
    } catch (error) {
      throw new ExtractionError(
        `Batch extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        ExtractionErrorType.UNKNOWN
      );
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Extract content from a specific tab by ID with retry logic
   */
  private async extractTabById(
    tabId: number,
    options: ServiceExtractionOptions
  ): Promise<ExtractionResult> {
    const {
      maxRetries = 2,
      retryDelay = 1000,
      forceRefresh = false,
      mode = ExtractionMode.DEFUDDLE,
      timeout = 5000,
      ...extractionOptions
    } = options;

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Prepare extraction payload
        const payload: ExtractTabPayload = {
          tabId,
          options: {
            ...extractionOptions,
            timeout,
            // Additional extraction options for retry attempts
            ...(attempt > 0 || forceRefresh ? { forceRefresh: true } : {}),
          } as ExtractionOptions & { forceRefresh?: boolean },
          mode,
        };

        // Send extraction message
        const message = createMessage({
          type: 'EXTRACT_TAB_CONTENT',
          payload,
          source: this.source,
          target: 'background',
        });

        // Send message with timeout
        const response = await this.sendMessageWithTimeout(message, tabId, timeout + 1000);

        // Handle response
        if (this.isErrorResponse(response)) {
          const errorMessage = this.extractErrorMessage(response);
          lastError = new Error(errorMessage);

          // Don't retry certain error types
          if (this.isNonRetriableError(errorMessage)) {
            break;
          }

          // Continue to retry
          continue;
        }

        if (this.isSuccessResponse(response)) {
          const responsePayload = (response as { payload: ExtractTabContentResponsePayload })
            .payload;
          const content = responsePayload.content;

          // Create TabContent from ExtractedContent
          const tabContent = await this.createTabContentFromExtracted(tabId, content);

          return {
            success: true,
            content: tabContent,
            tabId,
          };
        }

        // Unexpected response format
        lastError = new Error('Unexpected response format from background script');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on timeout or messaging errors
        if (this.isNonRetriableError(lastError.message)) {
          break;
        }
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    // All attempts failed
    const errorMessage = lastError?.message || 'Unknown extraction error';
    return {
      success: false,
      error: errorMessage,
      tabId,
    };
  }

  /**
   * Get the current active tab ID
   */
  private async getCurrentTabId(): Promise<number | null> {
    try {
      const message = createMessage({
        type: 'GET_TAB_ID',
        source: this.source,
        target: 'background',
      });

      const response = await this.sendMessageWithTimeout(message, undefined, 3000);

      if (response && typeof response === 'object' && 'type' in response && 'payload' in response) {
        const messageResponse = response as { type: string; payload?: { tabId?: number } };
        if (messageResponse.type === 'GET_TAB_ID' && messageResponse.payload?.tabId) {
          return (messageResponse.payload as { tabId: number }).tabId;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Send message with timeout enforcement
   */
  private async sendMessageWithTimeout(
    message: unknown,
    _tabId: number | undefined,
    timeoutMs: number
  ): Promise<unknown> {
    try {
      // In real content scripts, chrome.tabs.* is not available. Tests may stub it.
      const canUseTabsApi =
        typeof chrome !== 'undefined' &&
        (chrome as { tabs?: { sendMessage?: (...args: unknown[]) => unknown } }).tabs &&
        typeof chrome.tabs.sendMessage === 'function';

      if (_tabId !== undefined && canUseTabsApi) {
        const result = await sendMessageToTab(_tabId, message as Message, { timeout: timeoutMs });
        if (!result.success) {
          throw new Error(result.error || 'Tab messaging failed');
        }
        return result.response;
      }

      // Fallback (and production path): message background and let it forward
      return await sendMessageAsync(message as Message, { timeout: timeoutMs });
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Create TabContent from ExtractedContent with proper TabInfo
   */
  private async createTabContentFromExtracted(
    tabId: number,
    extractedContent: ExtractedContent
  ): Promise<TabContent> {
    // Create basic TabInfo from extracted content
    const tabInfo: TabInfo = {
      id: tabId,
      title: extractedContent.title || 'Unknown Title',
      url: extractedContent.url || '',
      domain: extractedContent.domain || this.extractDomainFromUrl(extractedContent.url || ''),
      windowId: 0, // Default value
      active: false, // We don't know this from extracted content
      index: 0, // Default value
      pinned: false, // Default value
      lastAccessed: extractedContent.extractedAt || Date.now(),
      favIconUrl: undefined,
      status: 'complete',
      audible: false,
    };

    const tabContent: TabContent = {
      tabInfo,
      extractedContent,
      extractionStatus: 'completed',
      isStale: false,
      cacheExpiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      metadata: {
        isDynamic: false,
        extractionTime: Date.now() - extractedContent.extractedAt,
      },
    };

    return tabContent;
  }

  /**
   * Extract domain from URL string
   */
  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url.split('/')[2] || 'unknown';
    }
  }

  /**
   * Check if response indicates success
   */
  private isSuccessResponse(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) {
      return false;
    }
    const responseObj = response as Record<string, unknown>;
    return (
      responseObj['type'] === 'EXTRACT_TAB_CONTENT' &&
      typeof responseObj['payload'] === 'object' &&
      responseObj['payload'] !== null &&
      'content' in responseObj['payload']
    );
  }

  /**
   * Check if response indicates error
   */
  private isErrorResponse(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) {
      return false;
    }
    const responseObj = response as Record<string, unknown>;
    return responseObj['type'] === 'ERROR';
  }

  /**
   * Extract error message from response
   */
  private extractErrorMessage(response: unknown): string {
    if (typeof response !== 'object' || response === null) {
      return 'Unknown error from background script';
    }
    const responseObj = response as Record<string, unknown>;
    const payload = responseObj['payload'] as Record<string, unknown> | undefined;
    return (payload?.['message'] as string) || 'Unknown error from background script';
  }

  /**
   * Check if error is non-retriable
   */
  private isNonRetriableError(errorMessage: string): boolean {
    const nonRetriablePatterns = [
      'restricted URL',
      'content script unavailable',
      'tab may be closed',
      'timeout',
      'connection',
      'does not exist',
    ];

    const lowercaseMessage = errorMessage.toLowerCase();
    return nonRetriablePatterns.some(pattern => lowercaseMessage.includes(pattern));
  }

  /**
   * Classify error type from message
   */
  private classifyErrorType(errorMessage?: string): ExtractionErrorType {
    if (!errorMessage) return ExtractionErrorType.UNKNOWN;

    const message = errorMessage.toLowerCase();

    if (message.includes('timeout')) {
      return ExtractionErrorType.TIMEOUT;
    }

    if (message.includes('tab') && (message.includes('closed') || message.includes('not found'))) {
      return ExtractionErrorType.TAB_NOT_FOUND;
    }

    if (message.includes('content script') || message.includes('connection')) {
      return ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE;
    }

    if (message.includes('restricted')) {
      return ExtractionErrorType.RESTRICTED_URL;
    }

    if (message.includes('message') || message.includes('runtime')) {
      return ExtractionErrorType.MESSAGING_ERROR;
    }

    return ExtractionErrorType.UNKNOWN;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory and Convenience Functions
// ============================================================================

/**
 * Create a new ExtractionService instance
 *
 * @param source - Message source identifier
 * @returns New ExtractionService instance
 */
export function createExtractionService(source: MessageSource): ExtractionService {
  return new ExtractionService(source);
}

/**
 * Default extraction service instance for sidebar use
 */
export const defaultExtractionService = createExtractionService('sidebar');

/**
 * Convenience function to extract current tab content
 *
 * @param options - Extraction options
 * @returns Promise resolving to TabContent
 */
export async function extractCurrentTab(options?: ServiceExtractionOptions): Promise<TabContent> {
  return defaultExtractionService.extractCurrentTab(options);
}

/**
 * Convenience function to extract multiple tabs
 *
 * @param tabIds - Array of tab IDs
 * @param options - Extraction options
 * @returns Promise resolving to batch results
 */
export async function extractTabs(
  tabIds: number[],
  options?: ServiceExtractionOptions
): Promise<BatchExtractionResult> {
  return defaultExtractionService.extractTabs(tabIds, options);
}
