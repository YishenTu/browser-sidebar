import type { ExtractedContent } from '../../../types/extraction';
import { htmlToMarkdown } from '@core/extraction/markdownConverter';

// Minimal Defuddle parse response type to avoid importing internal package paths
type DefuddleParsed = {
  title?: string;
  author?: string;
  published?: string;
  content?: string;
  contentMarkdown?: string;
  description?: string;
  favicon?: string;
  image?: string;
  parseTime?: number;
  schemaOrgData?: unknown;
  metaTags?: Array<Record<string, string>>;
};

// Optionally accept a full HTML snapshot to ensure processing on the original, unmodified DOM
export async function extractWithDefuddle(originalHtml?: string): Promise<ExtractedContent> {
  // Debug logging disabled for production

  try {
    // Dynamically import Defuddle to avoid bundling issues
    // Import defuddle library
    const { default: Defuddle } = await import('defuddle/full');

    // If provided, parse the original HTML into a fresh Document for Defuddle to process
    const parser = originalHtml ? new DOMParser() : null;
    const sourceDoc = originalHtml ? parser!.parseFromString(originalHtml, 'text/html') : document;

    const defuddleInstance = new Defuddle(sourceDoc, {
      url: document.URL,
      markdown: true, // Convert content to markdown
      separateMarkdown: false, // Don't keep separate HTML, only return markdown
    });

    const defuddled = defuddleInstance.parse() as unknown as DefuddleParsed;

    // Extract domain from URL
    const url = new URL(document.URL);
    const domain = url.hostname.replace(/^www\./, '');

    // Check if we have markdown content
    let markdownContent = '';

    // First check if contentMarkdown field exists (from separateMarkdown option)
    if (defuddled.contentMarkdown) {
      markdownContent = defuddled.contentMarkdown;
    }
    // Check if content looks like HTML (has HTML tags)
    else if (
      defuddled.content &&
      defuddled.content.includes('<') &&
      defuddled.content.includes('>')
    ) {
      // Convert HTML to markdown manually
      markdownContent = await htmlToMarkdown(defuddled.content, { includeLinks: false });
    }
    // Otherwise assume content is already markdown
    else {
      markdownContent = defuddled.content || '';
    }

    const hasTables = markdownContent.includes('|') && markdownContent.includes('---|');

    const result: ExtractedContent = {
      title: defuddled.title || document.title || '',
      url: document.URL,
      domain,
      content: markdownContent, // Use markdown content (from contentMarkdown or content field)
      textContent: markdownContent,
      excerpt: defuddled.description || markdownContent.substring(0, 200) + '...' || '',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle' as const,
      metadata: {
        hasTables,
        truncated: false,
        timeoutMs: defuddled.parseTime || 0,
      },
    };

    return result;
  } catch (error) {
    // Return a basic fallback with document content
    const fallbackContent = document.body?.textContent || 'Content extraction failed';
    const fallbackTitle = document.title || 'Untitled';

    return {
      title: fallbackTitle,
      url: document.URL,
      domain: new URL(document.URL).hostname.replace(/^www\./, ''),
      content: fallbackContent,
      textContent: fallbackContent,
      excerpt: fallbackContent.substring(0, 200) + '...',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle',
      metadata: {
        hasTables: false,
        truncated: false,
        timeoutMs: 0,
      },
    };
  }
}
