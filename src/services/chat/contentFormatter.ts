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
    urlContextTabs?: number;
    urlContextEnabled?: boolean;
  };
}

export interface FormatOptions {
  /** Whether there's a text selection in any tab */
  hasSelection?: boolean;
  /**
   * Whether the active provider supports URL context (Gemini only). Individual tabs opt-in
   * by setting metadata.useUrlContext.
   */
  useUrlContext?: boolean;
  /**
   * Whether the active provider supports video content via file_uri (Gemini only).
   * When enabled, YouTube videos are sent as video references instead of extracted content.
   */
  providerSupportsVideo?: boolean;
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

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Checks if a URL is a YouTube video URL
 */
function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com';
  } catch {
    return false;
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
  const {
    hasSelection = false,
    useUrlContext: urlContextSupported = false,
    providerSupportsVideo = false,
  } = options;
  const urlContextTabs = urlContextSupported
    ? tabs.filter(tab => tab.metadata?.useUrlContext === true)
    : [];
  const hasUrlContextTabs = urlContextTabs.length > 0;

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
        format: 'structured',
      },
    };
  }

  const sectionsArray: string[] = [];

  // ====================================================================
  // PART 1: BROWSER CONTEXT INSTRUCTION
  // ====================================================================
  const tabWord = tabs.length === 1 ? 'web page' : 'web pages';
  const domains = [...new Set(tabs.map(tab => extractDomain(extractURL(tab))).filter(Boolean))];

  // Count YouTube video tabs
  const youtubeVideoTabs = providerSupportsVideo
    ? tabs.filter(tab => isYouTubeUrl(extractURL(tab)))
    : [];
  const hasYoutubeVideos = youtubeVideoTabs.length > 0;

  const systemInstructionParts: string[] = [];
  systemInstructionParts.push('<system_instruction>');
  systemInstructionParts.push(`The user is viewing ${tabs.length} ${tabWord} in the browser.`);
  if (domains.length > 0) {
    systemInstructionParts.push(`Source${domains.length > 1 ? 's' : ''}: ${domains.join(', ')}`);
  }

  // Build content description based on content types
  if (hasYoutubeVideos) {
    const videoCount = youtubeVideoTabs.length;
    const otherTabsCount = tabs.length - videoCount;

    if (videoCount === tabs.length) {
      // All tabs are YouTube videos
      systemInstructionParts.push(
        `${videoCount === 1 ? 'A YouTube video is' : `${videoCount} YouTube videos are`} provided below, followed by the user's query about ${videoCount === 1 ? 'it' : 'them'}.`
      );
    } else {
      // Mixed: some YouTube videos, some regular content
      systemInstructionParts.push(
        `Below are ${videoCount === 1 ? 'a YouTube video' : `${videoCount} YouTube videos`} and ${otherTabsCount === 1 ? 'a web page' : `${otherTabsCount} web pages`} with extracted content, followed by the user's query about them.`
      );
    }
    systemInstructionParts.push(
      `Please analyze the provided ${videoCount === 1 && tabs.length === 1 ? 'video' : 'content'} to answer the user's query.`
    );
  } else {
    // No YouTube videos - regular content only
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
      systemInstructionParts.push(
        `Please analyze the provided content to answer the user's query.`
      );
    }
  }

  if (urlContextSupported && hasUrlContextTabs) {
    systemInstructionParts.push(
      `Use \`url_context\` tool to fetch web content from the URL in tab metadata for tabs marked with URL Context.`
    );
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

  // Process each tab with XML structure
  for (const tab of tabs) {
    const title = extractTitle(tab);
    const url = extractURL(tab);
    const domain = extractDomain(url);
    const content = extractContent(tab);
    const tabUsesUrlContext = urlContextSupported && tab?.metadata?.useUrlContext === true;
    const isYouTubeVideo = providerSupportsVideo && isYouTubeUrl(url);

    let contentSection: string;

    if (isYouTubeVideo) {
      // YouTube video - send URL as video reference for Gemini
      contentSection = `  <content type="video">
    <fileUri>${escapeXml(url)}</fileUri>
  </content>`;
    } else if (tabUsesUrlContext) {
      // URL context - no content section needed
      contentSection = '';
    } else if (isImageExtractedContent(content)) {
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
        contentSection = `  <content type="image">
    <fileUri>${content.fileUri}</fileUri>
    <mimeType>${content.mimeType}</mimeType>
  </content>`;
      } else if (content.fileId) {
        contentSection = `  <content type="image">
    <fileId>${content.fileId}</fileId>
  </content>`;
      } else {
        contentSection = `  <content>
[Image content - upload failed]
  </content>`;
      }
    } else {
      contentSection = `  <content>
${content || '[No content extracted]'}
  </content>`;
    }

    const tabContentItem = `<tab>
  <metadata>
    <title>${escapeXml(title)}</title>
    <url>${escapeXml(url)}</url>${
      domain
        ? `
    <domain>${escapeXml(domain)}</domain>`
        : ''
    }${
      tabUsesUrlContext
        ? `
    <urlContextEnabled>true</urlContextEnabled>`
        : ''
    }
  </metadata>${contentSection ? '\n' + contentSection : ''}
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
  const userQuery = `<user_query>
${userMessage}
</user_query>`;
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
      format: 'structured',
      urlContextTabs: hasUrlContextTabs ? urlContextTabs.length : undefined,
      urlContextEnabled: urlContextSupported && hasUrlContextTabs ? true : undefined,
    },
  };
}
