/**
 * Content Aggregation Formatter
 *
 * Formats multiple tab contents with a cleaner, more readable structure.
 * Uses clean XML structure with markdown content for better clarity.
 *
 * @example
 * ```typescript
 * const result = formatTabContent(
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
import type { ImageExtractedContent } from '@/types/extraction';
import { isImageExtractedContent } from '@/types/extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TabFormatResult {
  /** Formatted content for display and storage */
  formatted: string;
  /** Individual sections for provider-specific formatting */
  sections: {
    systemInstruction: string;
    tabContent: string;
    userQuery: string;
  };
  /** Metadata about the formatting */
  metadata: {
    totalTabs: number;
    totalChars: number;
    format: 'markdown' | 'structured';
  };
}

export interface FormatOptions {
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
 * Now handles both text and image content
 */
function extractContent(tabContent: TabContent | null | undefined): string | ImageExtractedContent {
  if (!tabContent?.extractedContent) {
    return '';
  }
  const content = tabContent.extractedContent.content;

  // Check if content is an image reference object
  if (isImageExtractedContent(content)) {
    return content;
  }

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
 * @param tabs - Array of tab contents to include
 * @param options - Formatting options
 * @returns Formatted content and metadata
 */
export function formatTabContent(
  userMessage: string,
  tabs: TabContent[] = [],
  options: FormatOptions = {}
): TabFormatResult {
  const { hasSelection = false } = options;

  // If no tabs, just return the user message with a simple system instruction
  if (tabs.length === 0) {
    const systemInstruction = `<system_instruction>
You are a helpful assistant.
</system_instruction>`;
    const userQuery = `<user_query>
${userMessage}
</user_query>`;
    const formatted = `${systemInstruction}

${userQuery}`;

    return {
      formatted,
      sections: {
        systemInstruction,
        tabContent: '',
        userQuery,
      },
      metadata: {
        totalTabs: 0,
        totalChars: formatted.length,
        format: 'markdown',
      },
    };
  }

  const sectionsArray: string[] = [];

  // ====================================================================
  // PART 1: BROWSER CONTEXT INSTRUCTION
  // ====================================================================
  const tabWord = tabs.length === 1 ? 'web page' : 'web pages';
  const domains = [...new Set(tabs.map(tab => extractDomain(extractURL(tab))).filter(Boolean))];

  const systemInstructionParts: string[] = [];
  systemInstructionParts.push('<system_instruction>');
  systemInstructionParts.push(`The user is viewing ${tabs.length} ${tabWord} in the browser.`);
  if (domains.length > 0) {
    systemInstructionParts.push(`Source${domains.length > 1 ? 's' : ''}: ${domains.join(', ')}`);
  }

  if (hasSelection) {
    systemInstructionParts.push(
      `Below is the extracted content from ${tabs.length === 1 ? 'this tab' : 'these tabs'}. Selected portions are marked within the tab content, followed by the user's query about it.`
    );
    systemInstructionParts.push(
      `Please analyze the provided content to answer the user's query, and do prioritize consideration of the selected content.`
    );
  } else {
    systemInstructionParts.push(
      `Below is the extracted content from ${tabs.length === 1 ? 'this tab' : 'these tabs'}, followed by the user's query about it.`
    );
    systemInstructionParts.push(`Please analyze the provided content to answer the user's query.`);
  }

  systemInstructionParts.push('</system_instruction>');
  const systemInstruction = systemInstructionParts.join('\n');

  sectionsArray.push(systemInstruction);
  sectionsArray.push('');

  // ====================================================================
  // PART 2: TAB CONTENT (Browser Tabs)
  // ====================================================================
  const tabContentParts: string[] = [];
  tabContentParts.push('<tab_content>');

  // Process each tab with proper XML structure
  for (const tab of tabs) {
    const title = extractTitle(tab);
    const url = extractURL(tab);
    const domain = extractDomain(url);
    const content = extractContent(tab);

    // Build tab content with XML metadata and handle both text and image content
    let contentSection: string;

    if (isImageExtractedContent(content)) {
      // Handle image content
      if (content.uploadState === 'uploading') {
        contentSection = `  <content>
[Image content - uploading]
  </content>`;
      } else if (content.uploadState === 'error') {
        const message = content.errorMessage || 'Image upload failed';
        contentSection = `  <content>
[Image content - ${message}]
  </content>`;
      } else if (content.fileUri) {
        // Gemini format - only fileUri and mimeType required
        contentSection = `  <content type="image">
    <fileUri>${content.fileUri}</fileUri>
    <mimeType>${content.mimeType}</mimeType>
  </content>`;
      } else if (content.fileId) {
        // OpenAI format - only fileId required
        contentSection = `  <content type="image">
    <fileId>${content.fileId}</fileId>
  </content>`;
      } else {
        contentSection = `  <content>
[Image content - upload failed]
  </content>`;
      }
    } else {
      // Handle text content
      contentSection = `  <content>
${content || '[No content extracted]'}
  </content>`;
    }

    const tabContentItem = `<tab>
  <metadata>
    <title>${title}</title>
    <url>${url}</url>${
      domain
        ? `
    <domain>${domain}</domain>`
        : ''
    }
  </metadata>
${contentSection}
</tab>`;

    tabContentParts.push(tabContentItem);
  }

  tabContentParts.push('\n</tab_content>');
  const tabContent = tabContentParts.join('\n');

  sectionsArray.push(tabContent);
  sectionsArray.push('');

  // ====================================================================
  // PART 3: USER QUERY
  // ====================================================================
  const userQuery = `<user_query>\n${userMessage}\n</user_query>`;
  sectionsArray.push(userQuery);

  const formatted = sectionsArray.join('\n');

  return {
    formatted,
    sections: {
      systemInstruction,
      tabContent,
      userQuery,
    },
    metadata: {
      totalTabs: tabs.length,
      totalChars: formatted.length,
      format: 'markdown',
    },
  };
}
