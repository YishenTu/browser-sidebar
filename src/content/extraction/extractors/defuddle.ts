import type { ExtractedContent } from '../../../types/extraction';

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
    const { default: Defuddle } = await import('defuddle');

    // If provided, parse the original HTML into a fresh Document for Defuddle to process
    const parser = originalHtml ? new DOMParser() : null;
    const sourceDoc = originalHtml ? parser!.parseFromString(originalHtml, 'text/html') : document;

    const defuddleInstance = new Defuddle(sourceDoc, {
      // Important: let Defuddle work on the full original DOM and return HTML.
      // We do our own HTML→Markdown later to avoid losing inline text/captions.
      url: document.URL,
    });

    const defuddled = defuddleInstance.parse() as unknown as DefuddleParsed;

    // Extract domain from URL
    const url = new URL(document.URL);
    const domain = url.hostname.replace(/^www\./, '');

    // Calculate features for content quality
    const contentElement = document.createElement('div');
    contentElement.innerHTML = defuddled.content || '';

    const tables = contentElement.querySelectorAll('table').length;

    const result = {
      title: defuddled.title || document.title || '',
      author: defuddled.author || '',
      publishedDate: defuddled.published || '',
      url: document.URL,
      domain,
      content: defuddled.content || '', // Return HTML for orchestrator to convert
      textContent: contentElement.textContent || '',
      excerpt: defuddled.description || contentElement.textContent?.substring(0, 200) + '...' || '',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle' as const,
      metadata: {
        hasTables: tables > 0,
        truncated: false,
        timeoutMs: defuddled.parseTime || 0,
        // Include schema and meta data for internal use
        schemaOrgData: defuddled.schemaOrgData,
        metaTags: defuddled.metaTags,
      },
    };

    return result;
  } catch (error) {
    // Return a basic fallback with document content
    const fallbackContent = document.body?.textContent || 'Content extraction failed';
    const fallbackTitle = document.title || 'Untitled';

    return {
      title: fallbackTitle,
      author: '',
      publishedDate: '',
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
      },
    };
  }
}
