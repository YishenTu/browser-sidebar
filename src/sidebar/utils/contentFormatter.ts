/**
 * Content Aggregation Formatter
 *
 * Formats multiple tab contents with a cleaner, more readable structure.
 * Uses clean XML structure with markdown content for better clarity.
 *
 * @example
 * ```typescript
 * const result = formatMultiTabContent(
 *   "Analyze these pages for common themes",
 *   currentTab,
 *   [tab1, tab2, tab3]
 * );
 *
 * // result.formatted contains clean, structured content
 * // result.metadata contains useful context info
 * ```
 */

import { TabContent } from '../../types/tabs';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MultiTabFormatResult {
  /** Formatted content ready for AI processing */
  formatted: string;
  /** Metadata about the formatting */
  metadata: {
    totalTabs: number;
    currentTabId: number | null;
    truncated: boolean;
    truncatedCount: number;
    truncatedTabIds: number[];
    totalChars: number;
    format: 'markdown' | 'structured';
  };
}

export interface FormatOptions {
  /** Edited content for tabs (tab ID -> edited content) */
  editedTabContent?: Record<number | string, string>;
  /** Whether there's a text selection in any tab */
  hasSelection?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extracts content from TabContent
 */
function extractContent(
  tabContent: TabContent | null | undefined,
  editedContent?: Record<number | string, string>
): string {
  // Check if we have edited content for this tab
  if (editedContent && tabContent?.tabInfo?.id !== undefined) {
    const edited = editedContent[tabContent.tabInfo.id];
    if (edited !== undefined) {
      return edited;
    }
  }

  if (!tabContent?.extractedContent) {
    return '';
  }
  const content = tabContent.extractedContent.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Safely extracts title from TabContent
 */
function extractTitle(tabContent: TabContent | null | undefined): string {
  if (!tabContent) {
    return 'Unknown Tab';
  }
  const extractedTitle = tabContent.extractedContent?.title;
  const tabInfoTitle = tabContent.tabInfo?.title;
  return extractedTitle || tabInfoTitle || 'Unknown Tab';
}

/**
 * Safely extracts URL from TabContent
 */
function extractURL(tabContent: TabContent | null | undefined): string {
  if (!tabContent) {
    return '';
  }
  const extractedURL = tabContent.extractedContent?.url;
  const tabInfoURL = tabContent.tabInfo?.url;
  return extractedURL || tabInfoURL || '';
}

/**
 * Extracts domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

// ============================================================================
// Main Formatting Functions
// ============================================================================

/**
 * Creates a clean, structured format for multiple tab contents
 *
 * @param userMessage - The user's query message
 * @param currentTab - Current active tab content
 * @param additionalTabs - Additional tabs to include
 * @param options - Formatting options
 * @returns Formatted content and metadata
 */
export function formatMultiTabContent(
  userMessage: string,
  currentTab: TabContent | null | undefined,
  additionalTabs: TabContent[] = [],
  options: FormatOptions = {}
): MultiTabFormatResult {
  const { editedTabContent, hasSelection = false } = options;

  const allTabs: TabContent[] = [];
  const currentTabId = currentTab?.tabInfo?.id || null;

  // Combine all tabs
  if (currentTab) {
    allTabs.push(currentTab);
  }
  allTabs.push(...additionalTabs);

  const sections: string[] = [];

  // If no tabs, just return the user message
  if (allTabs.length === 0) {
    return {
      formatted: userMessage,
      metadata: {
        totalTabs: 0,
        currentTabId: null,
        truncated: false,
        truncatedCount: 0,
        truncatedTabIds: [],
        totalChars: userMessage.length,
        format: 'markdown',
      },
    };
  }

  // ====================================================================
  // PART 1: BROWSER CONTEXT INSTRUCTION
  // ====================================================================
  const tabWord = allTabs.length === 1 ? 'web page' : 'web pages';
  const domains = [...new Set(allTabs.map(tab => extractDomain(extractURL(tab))).filter(Boolean))];

  sections.push('<system_instruction>');
  sections.push(`The user is viewing ${allTabs.length} ${tabWord} in the browser.`);
  if (domains.length > 0) {
    sections.push(`Source${domains.length > 1 ? 's' : ''}: ${domains.join(', ')}`);
  }

  if (hasSelection) {
    sections.push(
      `Below is the extracted content from ${allTabs.length === 1 ? 'this tab' : 'these tabs'}. Selected portions are marked within the tab content, followed by the user's query about it.`
    );
    sections.push(
      `Please analyze the provided content to answer the user's query, and do prioritize consideration of the selected content.`
    );
  } else {
    sections.push(
      `Below is the extracted content from ${allTabs.length === 1 ? 'this tab' : 'these tabs'}, followed by the user's query about it.`
    );
    sections.push(`Please analyze the provided content to answer the user's query.`);
  }

  sections.push('</system_instruction>');
  sections.push('');

  // ====================================================================
  // PART 2: TAB CONTENT (Browser Tabs)
  // ====================================================================
  sections.push('<tab_content>');

  // Process each tab with proper XML structure
  for (const tab of allTabs) {
    const title = extractTitle(tab);
    const url = extractURL(tab);
    const domain = extractDomain(url);
    const content = extractContent(tab, editedTabContent);

    // Build tab content with XML metadata and markdown content
    const tabContent = `<tab>
  <metadata>
    <title>${title}</title>
    <url>${url}</url>${
      domain
        ? `
    <domain>${domain}</domain>`
        : ''
    }
  </metadata>
  <content>
${content || '[No content extracted]'}
  </content>
</tab>`;

    sections.push(tabContent);
  }

  sections.push('\n</tab_content>');
  sections.push('');

  // ====================================================================
  // PART 3: USER QUERY
  // ====================================================================
  sections.push(`<user_query>\n${userMessage}\n</user_query>`);

  const formatted = sections.join('\n');

  return {
    formatted,
    metadata: {
      totalTabs: allTabs.length,
      currentTabId,
      truncated: false,
      truncatedCount: 0,
      truncatedTabIds: [],
      totalChars: formatted.length,
      format: 'markdown',
    },
  };
}
