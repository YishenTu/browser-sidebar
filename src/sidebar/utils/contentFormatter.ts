/**
 * Content Aggregation Formatter
 * 
 * Formats multiple tab contents with XML structure and enforces size limits.
 * Used to prepare multi-tab content for AI message processing.
 * 
 * @example
 * ```typescript
 * const result = formatMultiTabContent(
 *   "Analyze these pages for common themes",
 *   currentTab,
 *   [tab1, tab2, tab3]
 * );
 * 
 * if (result.truncated) {
 *   // Content was truncated, result.truncatedTabs.length tabs removed
 * }
 * 
 * // Send result.formatted to AI
 * sendToAI(result.formatted);
 * ```
 */

import { TabContent } from '@types/tabs';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MultiTabFormatResult {
  /** Formatted XML content ready for AI processing */
  formatted: string;
  /** Whether content was truncated due to size limits */
  truncated: boolean;
  /** Array of tab IDs that were removed due to truncation */
  truncatedTabs: number[];
}

export interface FormatOptions {
  /** Maximum combined size in bytes (default: 1MB) */
  maxSize?: number;
  /** Order in which tabs were selected (for deterministic truncation) */
  selectionOrder?: number[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum combined size (1MB) */
const DEFAULT_MAX_SIZE = 1024 * 1024; // 1MB

/** XML characters that need escaping */
const XML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

// ============================================================================
// Core Formatting Functions
// ============================================================================

/**
 * Escapes XML special characters in a string
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for XML content
 */
function escapeXML(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPE_MAP[char] || char);
}

/**
 * Calculates the byte size of a string in UTF-8 encoding
 * 
 * @param str - String to measure
 * @returns Size in bytes
 */
function getByteSize(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Safely extracts content from TabContent, handling null/undefined gracefully
 * 
 * @param tabContent - TabContent object to extract from
 * @returns Content string or empty string if unavailable
 */
function extractContent(tabContent: TabContent | null | undefined): string {
  if (!tabContent?.extractedContent) {
    return '';
  }

  const content = tabContent.extractedContent.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Safely extracts title from TabContent, handling null/undefined gracefully
 * 
 * @param tabContent - TabContent object to extract from
 * @returns Title string or fallback title
 */
function extractTitle(tabContent: TabContent | null | undefined): string {
  if (!tabContent) {
    return 'Unknown Tab';
  }

  // Try extractedContent title first, then tabInfo title
  const extractedTitle = tabContent.extractedContent?.title;
  const tabInfoTitle = tabContent.tabInfo?.title;
  
  return extractedTitle || tabInfoTitle || 'Unknown Tab';
}

/**
 * Safely extracts URL from TabContent, handling null/undefined gracefully
 * 
 * @param tabContent - TabContent object to extract from
 * @returns URL string or fallback URL
 */
function extractURL(tabContent: TabContent | null | undefined): string {
  if (!tabContent) {
    return '';
  }

  // Try extractedContent URL first, then tabInfo URL
  const extractedURL = tabContent.extractedContent?.url;
  const tabInfoURL = tabContent.tabInfo?.url;
  
  return extractedURL || tabInfoURL || '';
}

/**
 * Formats a single tab as XML content
 * 
 * @param tabContent - Tab content to format
 * @returns XML string for the tab
 */
function formatTabXML(tabContent: TabContent): string {
  const title = extractTitle(tabContent);
  const url = extractURL(tabContent);
  const content = extractContent(tabContent);

  return [
    '    <tab>',
    `      <title>${escapeXML(title)}</title>`,
    `      <url>${escapeXML(url)}</url>`,
    `      <content>${escapeXML(content)}</content>`,
    '    </tab>'
  ].join('\n');
}

/**
 * Formats the current tab as XML content
 * 
 * @param currentTab - Current tab content to format
 * @returns XML string for the current tab
 */
function formatCurrentTabXML(currentTab: TabContent): string {
  const title = extractTitle(currentTab);
  const url = extractURL(currentTab);
  const content = extractContent(currentTab);

  return [
    '  <current_tab>',
    `    <title>${escapeXML(title)}</title>`,
    `    <url>${escapeXML(url)}</url>`,
    `    <content>${escapeXML(content)}</content>`,
    '  </current_tab>'
  ].join('\n');
}

/**
 * Determines truncation priority for tabs
 * Uses selection order if provided, otherwise falls back to lastAccessed time
 * 
 * @param tabs - Array of tabs to sort
 * @param selectionOrder - Optional order in which tabs were selected
 * @returns Sorted array with tabs to truncate first at the beginning
 */
function sortTabsByTruncationPriority(tabs: TabContent[], selectionOrder?: number[]): TabContent[] {
  return [...tabs].sort((a, b) => {
    const aId = a.tabInfo?.id || 0;
    const bId = b.tabInfo?.id || 0;
    
    // If selection order is provided, use it for deterministic truncation
    if (selectionOrder && selectionOrder.length > 0) {
      const aIndex = selectionOrder.indexOf(aId);
      const bIndex = selectionOrder.indexOf(bId);
      
      // Tabs not in selection order go first (oldest)
      if (aIndex === -1 && bIndex === -1) {
        // Both not in order, use lastAccessed
        const aLastAccessed = a.tabInfo?.lastAccessed || 0;
        const bLastAccessed = b.tabInfo?.lastAccessed || 0;
        return aLastAccessed - bLastAccessed;
      }
      
      if (aIndex === -1) return -1; // a goes first (to be truncated)
      if (bIndex === -1) return 1;  // b goes first (to be truncated)
      
      // Both in selection order - earlier selections get truncated first
      // (oldest selections have lower indices)
      return aIndex - bIndex;
    }
    
    // Fallback: sort by lastAccessed (oldest first)
    const aLastAccessed = a.tabInfo?.lastAccessed || 0;
    const bLastAccessed = b.tabInfo?.lastAccessed || 0;
    
    if (aLastAccessed !== bLastAccessed) {
      return aLastAccessed - bLastAccessed;
    }
    
    // Final tie-breaker: by tab ID for consistency
    return aId - bId;
  });
}

// ============================================================================
// Main Formatting Function
// ============================================================================

/**
 * Creates XML structure for multiple tab contents with size limits
 * 
 * Formats user message, current tab, and additional tabs into a structured XML format
 * for AI processing. Enforces maximum combined size by truncating oldest or least-recently-selected
 * tabs when the size limit is exceeded.
 * 
 * @param userMessage - The user's query message
 * @param currentTab - Current active tab content (always included)
 * @param additionalTabs - Additional tabs to include (may be truncated)
 * @param options - Formatting options including max size
 * @returns Object containing formatted XML, truncation status, and truncated tab IDs
 * 
 * @example
 * ```typescript
 * const result = formatMultiTabContent(
 *   "Compare these articles",
 *   currentTab,
 *   [tab1, tab2, tab3],
 *   { maxSize: 512 * 1024 } // 512KB limit
 * );
 * 
 * // result.formatted contains XML content
 * // result.truncated is true if content was truncated
 * // result.truncatedTabs contains [2, 3] if tabs 2 and 3 were removed
 * ```
 */
export function formatMultiTabContent(
  userMessage: string,
  currentTab: TabContent | null | undefined,
  additionalTabs: TabContent[] = [],
  options: FormatOptions = {}
): MultiTabFormatResult {
  const { maxSize = DEFAULT_MAX_SIZE, selectionOrder } = options;

  // Handle null/undefined inputs gracefully
  const safeUserMessage = userMessage || '';
  const safeAdditionalTabs = additionalTabs || [];

  // Start building the XML structure
  const baseXML = [
    '<multi_tab_content>',
    `  <user_query>${escapeXML(safeUserMessage)}</user_query>`
  ];

  // Add current tab (always included, even if null/undefined)
  if (currentTab) {
    baseXML.push(formatCurrentTabXML(currentTab));
  } else {
    // Include empty current tab structure for consistency
    baseXML.push(
      '  <current_tab>',
      '    <title></title>',
      '    <url></url>',
      '    <content></content>',
      '  </current_tab>'
    );
  }

  // Calculate base size (user query + current tab)
  const baseContent = baseXML.join('\n');
  let currentSize = getByteSize(baseContent);

  // Add additional tabs section header
  const additionalTabsHeader = '  <additional_tabs>';
  const additionalTabsFooter = '  </additional_tabs>';
  const closingTag = '</multi_tab_content>';

  // Account for additional tabs structure and closing tag
  const structureOverhead = getByteSize(additionalTabsHeader + '\n' + additionalTabsFooter + '\n' + closingTag);
  currentSize += structureOverhead;

  // Process additional tabs with truncation
  const truncatedTabs: number[] = [];
  const includedTabs: string[] = [];

  // Sort tabs by truncation priority using selection order if provided
  const sortedTabs = sortTabsByTruncationPriority(safeAdditionalTabs, selectionOrder);

  // Try to include as many additional tabs as possible
  for (const tab of sortedTabs) {
    const tabXML = formatTabXML(tab);
    const tabSize = getByteSize(tabXML + '\n'); // Include newline

    if (currentSize + tabSize <= maxSize) {
      includedTabs.push(tabXML);
      currentSize += tabSize;
    } else {
      // Tab would exceed limit, add to truncated list
      if (tab.tabInfo?.id !== undefined) {
        truncatedTabs.push(tab.tabInfo.id);
      }
    }
  }

  // Build final XML
  const finalXML = [
    ...baseXML,
    additionalTabsHeader,
    ...includedTabs,
    additionalTabsFooter,
    closingTag
  ].join('\n');

  return {
    formatted: finalXML,
    truncated: truncatedTabs.length > 0,
    truncatedTabs
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates the size of formatted content without actually formatting it
 * Useful for size estimation before formatting
 * 
 * @param userMessage - User message
 * @param currentTab - Current tab
 * @param additionalTabs - Additional tabs
 * @returns Estimated size in bytes
 */
export function estimateFormattedSize(
  userMessage: string,
  currentTab: TabContent | null | undefined,
  additionalTabs: TabContent[] = []
): number {
  // This is a simplified estimation - actual XML escaping might change size slightly
  const userQuerySize = getByteSize(escapeXML(userMessage || ''));
  
  let currentTabSize = 0;
  if (currentTab) {
    const title = extractTitle(currentTab);
    const url = extractURL(currentTab);
    const content = extractContent(currentTab);
    currentTabSize = getByteSize(escapeXML(title) + escapeXML(url) + escapeXML(content));
  }

  let additionalTabsSize = 0;
  for (const tab of additionalTabs || []) {
    const title = extractTitle(tab);
    const url = extractURL(tab);
    const content = extractContent(tab);
    additionalTabsSize += getByteSize(escapeXML(title) + escapeXML(url) + escapeXML(content));
  }

  // Add XML structure overhead (rough estimation)
  const xmlOverhead = 500; // Rough estimate for XML tags and structure
  
  return userQuerySize + currentTabSize + additionalTabsSize + xmlOverhead;
}

/**
 * Validates that a TabContent object has the minimum required structure
 * 
 * @param tabContent - TabContent to validate
 * @returns True if the tab content is valid
 */
export function isValidTabContent(tabContent: unknown): tabContent is TabContent {
  if (!tabContent || typeof tabContent !== 'object') {
    return false;
  }

  const tab = tabContent as Record<string, unknown>;
  
  // Check for required structure
  return (
    tab.tabInfo !== null &&
    typeof tab.tabInfo === 'object' &&
    (tab.extractedContent === null || typeof tab.extractedContent === 'object')
  );
}