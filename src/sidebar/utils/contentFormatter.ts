/**
 * Content Aggregation Formatter V2
 *
 * Formats multiple tab contents with a cleaner, more readable structure.
 * Uses markdown-like format instead of XML for better clarity.
 *
 * @example
 * ```typescript
 * const result = formatMultiTabContentV2(
 *   "Analyze these pages for common themes",
 *   currentTab,
 *   [tab1, tab2, tab3]
 * );
 *
 * // result.formatted contains clean, structured content
 * // result.metadata contains useful context info
 * ```
 */

import { TabContent } from '@types/tabs';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MultiTabFormatResultV2 {
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

export interface FormatOptionsV2 {
  /** Maximum combined size in characters (default: 100k) */
  maxChars?: number;
  /** Order in which tabs were selected (for deterministic truncation) */
  selectionOrder?: number[];
  /** Format style to use */
  format?: 'markdown' | 'structured';
  /** Whether to include full content or summaries */
  includeFullContent?: boolean;
  /** Edited content for tabs (tab ID -> edited content) */
  editedTabContent?: Record<number | string, string>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum character count (100k chars ~= 400KB) */
const DEFAULT_MAX_CHARS = 100_000;

/** Maximum content preview length per tab when truncating */
const MAX_PREVIEW_LENGTH = 5000;

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

/**
 * Truncates content intelligently at sentence/paragraph boundaries
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to truncate at a paragraph boundary
  const truncated = content.substring(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxLength * 0.8) {
    return truncated.substring(0, lastParagraph) + '\n\n[Content truncated...]';
  }

  // Try to truncate at a sentence boundary
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > maxLength * 0.8) {
    return truncated.substring(0, lastSentence + 1) + '\n\n[Content truncated...]';
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...\n\n[Content truncated...]';
  }

  return truncated + '...\n\n[Content truncated...]';
}

/**
 * Formats a single tab in markdown style
 * @deprecated Not currently used - kept for potential future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatTabMarkdown(
  tabContent: TabContent,
  index: number,
  isCurrentTab: boolean = false
): string {
  const title = extractTitle(tabContent);
  const url = extractURL(tabContent);
  const domain = extractDomain(url);
  const content = extractContent(tabContent);

  const lines: string[] = [];

  // Header with tab number and status
  if (isCurrentTab) {
    lines.push(`## Tab ${index} (Active Tab)`);
  } else {
    lines.push(`## Tab ${index}`);
  }

  // Metadata
  lines.push(`**Title:** ${title}`);
  lines.push(`**URL:** ${url}`);
  if (domain) {
    lines.push(`**Domain:** ${domain}`);
  }
  lines.push('');

  // Content with clear separator
  lines.push('---');
  lines.push('');
  lines.push(content || '[No content extracted]');
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats a single tab in structured format
 * @deprecated Not currently used - kept for potential future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatTabStructured(
  tabContent: TabContent,
  index: number,
  isCurrentTab: boolean = false
): { summary: string; content: string } {
  const title = extractTitle(tabContent);
  const url = extractURL(tabContent);
  const domain = extractDomain(url);
  const content = extractContent(tabContent);

  const summary = `[Tab ${index}${isCurrentTab ? ' (Active)' : ''}] ${title} - ${domain || url}`;

  return { summary, content };
}

/**
 * Determines truncation priority for tabs
 */
function sortTabsByPriority(
  tabs: TabContent[],
  currentTabId: number | null,
  selectionOrder?: number[]
): TabContent[] {
  return [...tabs].sort((a, b) => {
    const aId = a.tabInfo?.id || 0;
    const bId = b.tabInfo?.id || 0;

    // Current tab always has highest priority
    if (aId === currentTabId) return -1;
    if (bId === currentTabId) return 1;

    // Use selection order if provided
    if (selectionOrder && selectionOrder.length > 0) {
      const aIndex = selectionOrder.indexOf(aId);
      const bIndex = selectionOrder.indexOf(bId);

      // More recently selected tabs have higher priority
      if (aIndex !== -1 && bIndex !== -1) {
        return bIndex - aIndex; // Reverse order (higher index = more recent)
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
    }

    // Fall back to last accessed time (more recent = higher priority)
    const aLastAccessed = a.tabInfo?.lastAccessed || 0;
    const bLastAccessed = b.tabInfo?.lastAccessed || 0;
    return bLastAccessed - aLastAccessed;
  });
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
export function formatMultiTabContentV2(
  userMessage: string,
  currentTab: TabContent | null | undefined,
  additionalTabs: TabContent[] = [],
  options: FormatOptionsV2 = {}
): MultiTabFormatResultV2 {
  const {
    maxChars = DEFAULT_MAX_CHARS,
    selectionOrder,
    format = 'markdown',
    editedTabContent,
  } = options;

  const allTabs: TabContent[] = [];
  const currentTabId = currentTab?.tabInfo?.id || null;

  // Combine all tabs
  if (currentTab) {
    allTabs.push(currentTab);
  }
  allTabs.push(...additionalTabs);

  // Sort by priority
  const sortedTabs = sortTabsByPriority(allTabs, currentTabId, selectionOrder);

  const sections: string[] = [];
  const truncatedTabIds: number[] = [];
  let totalChars = 0;

  // If no tabs, just return the user message
  if (sortedTabs.length === 0) {
    return {
      formatted: userMessage,
      metadata: {
        totalTabs: 0,
        currentTabId: null,
        truncated: false,
        truncatedCount: 0,
        truncatedTabIds: [],
        totalChars: userMessage.length,
        format,
      },
    };
  }

  // ====================================================================
  // PART 1: BROWSER CONTEXT INSTRUCTION
  // ====================================================================
  const tabWord = sortedTabs.length === 1 ? 'web page' : 'web pages';
  const domains = [
    ...new Set(sortedTabs.map(tab => extractDomain(extractURL(tab))).filter(Boolean)),
  ];

  sections.push('<browser_context>');
  sections.push(`The user is viewing ${sortedTabs.length} ${tabWord} in the browser.`);
  if (domains.length > 0) {
    sections.push(`Source${domains.length > 1 ? 's' : ''}: ${domains.join(', ')}`);
  }
  sections.push('Below is the extracted content from these tabs, followed by the user question.');
  sections.push('Please analyze this content to answer the user query.');
  sections.push('</browser_context>');
  sections.push('');

  // ====================================================================
  // PART 2: TAB CONTENT (Browser Tabs)
  // ====================================================================
  sections.push('<tab_content>');

  // Process each tab with proper XML structure
  for (let i = 0; i < sortedTabs.length; i++) {
    const tab = sortedTabs[i];
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

    // Check size limit
    if (totalChars + tabContent.length > maxChars - 1000) {
      // Leave buffer for user query
      // Try truncating the content
      const remainingSpace = maxChars - totalChars - 2000; // Leave more buffer

      if (remainingSpace > 1000) {
        // Include truncated version
        const truncatedContent = truncateContent(
          extractContent(tab, editedTabContent),
          Math.min(MAX_PREVIEW_LENGTH, remainingSpace)
        );
        const truncatedTabContent = `<tab truncated="true">
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
${truncatedContent}
  </content>
</tab>`;

        sections.push(truncatedTabContent);
        totalChars += truncatedTabContent.length;
      }

      // Mark remaining tabs as truncated
      for (let j = i + (remainingSpace > 1000 ? 1 : 0); j < sortedTabs.length; j++) {
        const truncTab = sortedTabs[j];
        if (truncTab.tabInfo?.id !== undefined) {
          truncatedTabIds.push(truncTab.tabInfo.id);
        }
      }
      break;
    }

    sections.push(tabContent);
    totalChars += tabContent.length;
  }

  // Add truncation notice if needed
  if (truncatedTabIds.length > 0) {
    sections.push(`\n[Note: ${truncatedTabIds.length} tab(s) omitted due to size limits]`);
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
      totalTabs: sortedTabs.length,
      currentTabId,
      truncated: truncatedTabIds.length > 0,
      truncatedCount: truncatedTabIds.length,
      truncatedTabIds,
      totalChars: formatted.length,
      format,
    },
  };
}

/**
 * Legacy function for backward compatibility
 * Converts the new format back to XML style if needed
 */
export function formatMultiTabContent(
  userMessage: string,
  currentTab: TabContent | null | undefined,
  additionalTabs: TabContent[] = [],
  options: {
    maxSize?: number;
    selectionOrder?: number[];
    editedTabContent?: Record<number | string, string>;
  } = {}
): { formatted: string; truncated: boolean; truncatedTabs: number[] } {
  // Use V2 with character limit converted from byte size
  const maxChars = options.maxSize ? Math.floor(options.maxSize / 4) : DEFAULT_MAX_CHARS;

  const resultV2 = formatMultiTabContentV2(userMessage, currentTab, additionalTabs, {
    maxChars,
    selectionOrder: options.selectionOrder,
    format: 'markdown', // Use cleaner format by default
    editedTabContent: options.editedTabContent,
  });

  return {
    formatted: resultV2.formatted,
    truncated: resultV2.metadata.truncated,
    truncatedTabs: resultV2.metadata.truncatedTabIds,
  };
}
