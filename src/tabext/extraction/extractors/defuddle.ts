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
  wordCount?: number;
  parseTime?: number;
  schemaOrgData?: unknown;
  metaTags?: Array<Record<string, string>>;
};

export async function extractWithDefuddle(): Promise<ExtractedContent> {
  // Debug logging disabled for production

  try {
    // Dynamically import Defuddle to avoid bundling issues
    // Import defuddle library
    const { default: Defuddle } = await import('defuddle');

    const defuddleInstance = new Defuddle(document, {
      url: document.URL,
      markdown: true, // Request markdown output
      separateMarkdown: true, // Include both HTML and Markdown
    });

    const defuddled = defuddleInstance.parse() as unknown as DefuddleParsed;

    // Extract domain from URL
    const url = new URL(document.URL);
    const domain = url.hostname.replace(/^www\./, '');

    // Calculate features for content quality
    const contentElement = document.createElement('div');
    contentElement.innerHTML = defuddled.content || '';

    const codeBlocks = contentElement.querySelectorAll('pre, code').length;
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
        wordCount: defuddled.wordCount || 0,
        hasCodeBlocks: codeBlocks > 0,
        hasTables: tables > 0,
        truncated: false,
        timeoutMs: defuddled.parseTime || 0,
        // Include schema and meta data for internal use
        schemaOrgData: defuddled.schemaOrgData,
        metaTags: defuddled.metaTags,
      },
      // Backward compatibility fields
      markdown: defuddled.content || '',
      wordCount: defuddled.wordCount || 0,
      hasCode: codeBlocks > 0,
      hasTables: tables > 0,
      isTruncated: false,
    };

    return result;
  } catch (error) {
    console.error('[Defuddle] Extraction failed with error:', error);
    console.error('[Defuddle] Error stack:', error instanceof Error ? error.stack : 'No stack');

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
        wordCount: fallbackContent.split(/\s+/).length,
        hasCodeBlocks: false,
        hasTables: false,
        truncated: false,
      },
      // Backward compatibility fields
      markdown: fallbackContent,
      wordCount: fallbackContent.split(/\s+/).length,
      hasCode: false,
      hasTables: false,
      isTruncated: false,
    };
  }
}
