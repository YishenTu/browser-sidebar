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
    const { gfm } = (await import('turndown-plugin-gfm')) as { gfm: (service: unknown) => void };

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
    // IMPORTANT: This preserves image links but removes text links
    turndownInstance.addRule('stripLinks', {
      filter: ['a'],
      replacement: function (content, node, options) {
        // Check if this link contains an image - if so, preserve the image
        const hasImage = (node as HTMLElement).querySelector('img');
        if (hasImage) {
          // Let the image rule handle this
          return content;
        }

        // Enable/disable based on per-conversion option
        const includeLinks = (options as { includeLinks?: boolean })?.includeLinks !== false;

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

    // Custom rule for figures with captions
    turndownInstance.addRule('figureWithCaption', {
      filter: 'figure',
      replacement: function (content, node) {
        const figure = node as HTMLElement;
        const img = figure.querySelector('img');
        const caption = figure.querySelector('figcaption');

        if (!img) return content;

        const alt = img.getAttribute('alt') || '';
        const src = img.getAttribute('src') || '';
        const captionText = caption ? `\n*${caption.textContent?.trim() || ''}*` : '';

        return `\n\n![${alt}](${src})${captionText}\n\n`;
      },
    });

    // Custom rule for footnotes
    turndownInstance.addRule('footnote', {
      filter: function (node) {
        return node.nodeName === 'SUP' && node.querySelector('a[href^="#fn"]') !== null;
      },
      replacement: function (content, node) {
        const link = node.querySelector('a[href^="#fn"]');
        if (!link) return content;

        const href = link.getAttribute('href') || '';
        const id = href.replace('#fn', '').replace('#', '');
        return `[^${id}]`;
      },
    });

    // Custom rule for footnote references
    turndownInstance.addRule('footnoteReference', {
      filter: function (node) {
        return (
          (node.nodeName === 'OL' || node.nodeName === 'UL') &&
          (node.getAttribute('class')?.includes('footnote') ||
            node.querySelector('li[id^="fn"]') !== null)
        );
      },
      replacement: function (content, node) {
        const items = node.querySelectorAll('li[id^="fn"]');
        if (items.length === 0) return content;

        let footnotes = '\n\n---\n\n';
        items.forEach(item => {
          const id = item.getAttribute('id')?.replace('fn', '') || '';
          const text = item.textContent?.trim() || '';
          footnotes += `[^${id}]: ${text}\n\n`;
        });

        return footnotes;
      },
    });

    // Custom rule for YouTube/Twitter embeds - always preserve these
    turndownInstance.addRule('embedToMarkdown', {
      filter: function (node) {
        return node.nodeName === 'IFRAME' && node.getAttribute('src') !== null;
      },
      replacement: function (content, node) {
        const iframe = node as HTMLIFrameElement;
        const src = iframe.getAttribute('src') || '';

        // YouTube embeds - always preserve as image with link
        const ytMatch = src.match(
          /(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([a-zA-Z0-9_-]+)/
        );
        if (ytMatch?.[1]) {
          const videoId = ytMatch[1];
          // Use image markdown which is always preserved
          return `\n\n![YouTube Video](https://img.youtube.com/vi/${videoId}/0.jpg)\n\n`;
        }

        // Twitter/X embeds - preserve as text mention
        const twitterMatch = src.match(/(?:twitter\.com|x\.com)\/.*?(?:status|statuses)\/(\d+)/);
        if (twitterMatch?.[1]) {
          const tweetId = twitterMatch[1];
          // Just mention it as text, no link
          return `\n\n[Tweet ${tweetId}]\n\n`;
        }

        // Generic iframe - just show as text
        if (src) {
          return `\n\n[Embedded Content]\n\n`;
        }

        return content;
      },
    });

    // Keep important elements for better extraction
    turndownInstance.keep(['iframe', 'video', 'audio', 'sup', 'sub', 'mark']);

    // Remove unwanted elements
    turndownInstance.remove(['script', 'style', 'button', 'noscript']);
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
    (turndownService.options as { includeLinks?: boolean }).includeLinks = includeLinks;

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
    // Return a basic text extraction as fallback
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    } catch (fallbackError) {
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
