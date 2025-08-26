import type TurndownService from 'turndown';

// Cache for Turndown service instance to avoid reloading
let turndownInstance: TurndownService | null = null;

/**
 * Get or create a configured Turndown service instance with caching
 */
async function getTurndownService(): Promise<TurndownService> {
  if (!turndownInstance) {
    // Dynamic imports to reduce bundle size
    const TurndownService = (await import('turndown')).default;
    const { gfm } = (await import('turndown-plugin-gfm')) as any;

    // Create and configure Turndown service
    turndownInstance = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      bulletListMarker: '-',
    });

    // Use GitHub Flavored Markdown plugin
    turndownInstance.use(gfm);

    // Custom rule for fenced code blocks with language detection
    turndownInstance.addRule('fencedCodeWithLang', {
      filter: ['pre'],
      replacement: function (content, node) {
        const codeElement = node.querySelector('code');
        if (!codeElement) {
          return '\n\n```\n' + content + '\n```\n\n';
        }

        // Extract language from class attributes
        let language = '';
        const className = codeElement.className || '';

        // Look for language-* or lang-* patterns
        const langMatch = className.match(/(?:language-|lang-)([a-zA-Z0-9-]+)/);
        if (langMatch) {
          language = langMatch[1] || '';
        }

        const codeContent = codeElement.textContent || '';
        return '\n\n```' + (language || '') + '\n' + codeContent + '\n```\n\n';
      },
    });

    // Custom rule to strip links when includeLinks is false
    turndownInstance.addRule('stripLinks', {
      filter: ['a'],
      replacement: function (content, node, options) {
        // This will be dynamically enabled/disabled based on options
        const includeLinks = (options as any).includeLinks !== false;

        if (!includeLinks) {
          return content; // Just return the text content without the link
        }

        // Default link handling
        const href = (node as HTMLAnchorElement).getAttribute('href');
        const title = (node as HTMLAnchorElement).getAttribute('title');

        if (!href) return content;

        let link = '[' + content + '](' + href;
        if (title) {
          link += ' "' + title + '"';
        }
        link += ')';

        return link;
      },
    });
  }

  return turndownInstance;
}

/**
 * Converts HTML to Markdown with DOMPurify sanitization
 *
 * @param html - The HTML string to convert
 * @param options - Conversion options
 * @param options.includeLinks - Whether to include links in the output (default: true)
 * @returns Promise that resolves to the Markdown string
 */
export async function htmlToMarkdown(
  html: string,
  options: { includeLinks?: boolean } = {}
): Promise<string> {
  try {
    // Default options
    const { includeLinks = true } = options;

    // Dynamic import of DOMPurify
    const { default: DOMPurify } = await import('dompurify');

    // Sanitize HTML first for security
    const cleanHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        // Text formatting
        'p',
        'br',
        'div',
        'span',
        // Headings
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        // Lists
        'ul',
        'ol',
        'li',
        // Text styling
        'strong',
        'b',
        'em',
        'i',
        'u',
        'del',
        's',
        'strike',
        // Code
        'code',
        'pre',
        'kbd',
        'samp',
        // Links and media
        'a',
        'img',
        // Tables
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        // Quotes and sections
        'blockquote',
        'hr',
        'section',
        'article',
        'nav',
        'aside',
        // Definition lists
        'dl',
        'dt',
        'dd',
      ],
      ALLOWED_ATTR: [
        'href',
        'title',
        'alt',
        'src',
        'class',
        'id',
        'colspan',
        'rowspan',
        'start',
        'type',
      ],
      KEEP_CONTENT: true,
    });

    // Get Turndown service instance
    const turndownService = await getTurndownService();

    // Set the includeLinks option for this conversion
    (turndownService.options as any).includeLinks = includeLinks;

    // Convert to Markdown
    let markdown = turndownService.turndown(cleanHtml);

    // Clean up extra whitespace and normalize line breaks
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .replace(/^\n+/, '') // Remove leading newlines
      .replace(/\n+$/, '') // Remove trailing newlines
      .trim();

    return markdown;
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);

    // Return a basic text extraction as fallback
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    } catch (fallbackError) {
      console.error('Fallback text extraction failed:', fallbackError);
      return '';
    }
  }
}

/**
 * Type definitions for better TypeScript support
 */
export interface MarkdownConversionOptions {
  /** Whether to include links in the markdown output */
  includeLinks?: boolean;
}

/**
 * Export types for external use
 */
export type { TurndownService };
