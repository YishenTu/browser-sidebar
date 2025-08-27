import type { ExtractedContent } from '../../types/extraction';

declare class Defuddle {
  constructor(document: Document, options?: { url?: string; debug?: boolean });
  parse(): {
    title: string;
    author: string;
    published: string;
    content: string;
    description: string;
    favicon: string;
    image: string;
    wordCount: number;
    parseTime: number;
    schemaOrgData?: any;
    metaTags?: any[];
    site?: string;
  };
}

export async function extractWithDefuddle(): Promise<ExtractedContent> {
  try {
    // Dynamically import Defuddle to avoid bundling issues
    const { default: DefuddleLib } = await import('defuddle');
    
    // Use the imported constructor
    const DefuddleClass = DefuddleLib as unknown as typeof Defuddle;
    
    const defuddled = new DefuddleClass(document, {
      url: document.URL,
      debug: false
    }).parse();

    // Extract domain from URL
    const url = new URL(document.URL);
    const domain = url.hostname.replace(/^www\./, '');

    // Calculate features for content quality
    const contentElement = document.createElement('div');
    contentElement.innerHTML = defuddled.content || '';
    
    const codeBlocks = contentElement.querySelectorAll('pre, code').length;
    const tables = contentElement.querySelectorAll('table').length;

    return {
      title: defuddled.title || document.title || '',
      author: defuddled.author || '',
      publishedDate: defuddled.published || '',
      url: document.URL,
      domain,
      content: defuddled.content || '',
      textContent: contentElement.textContent || '',
      excerpt: defuddled.description || '',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle',
      metadata: {
        wordCount: defuddled.wordCount || 0,
        hasCodeBlocks: codeBlocks > 0,
        hasTables: tables > 0,
        truncated: false,
        timeoutMs: defuddled.parseTime || 0,
        // Include schema and meta data for internal use
        schemaOrgData: defuddled.schemaOrgData,
        metaTags: defuddled.metaTags
      },
      // Backward compatibility fields
      markdown: defuddled.content || '',
      wordCount: defuddled.wordCount || 0,
      hasCode: codeBlocks > 0,
      hasTables: tables > 0,
      isTruncated: false
    };
  } catch (error) {
    console.error('[Defuddle] Extraction failed:', error);
    
    // Return a failure result that can be handled by fallback
    return {
      title: '',
      author: '',
      publishedDate: '',
      url: document.URL,
      domain: new URL(document.URL).hostname.replace(/^www\./, ''),
      content: '',
      textContent: '',
      excerpt: '',
      extractedAt: Date.now(),
      extractionMethod: 'failed',
      metadata: {
        wordCount: 0,
        hasCodeBlocks: false,
        hasTables: false,
        truncated: false
      },
      // Backward compatibility fields
      markdown: '',
      wordCount: 0,
      hasCode: false,
      hasTables: false,
      isTruncated: false
    };
  }
}