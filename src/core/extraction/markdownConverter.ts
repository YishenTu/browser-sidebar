import type TurndownService from 'turndown';

// Cache for Turndown service instance to avoid reloading
let turndownInstance: TurndownService | null = null;

async function configureTurndown(service: TurndownService): Promise<void> {
  // Use the official GFM plugin, which includes table handling
  const { gfm } = (await import('turndown-plugin-gfm')) as {
    gfm: (s: TurndownService) => void;
  };
  service.use(gfm as unknown as (s: TurndownService) => void);

  // Custom rule for fenced code blocks with language detection
  service.addRule('fencedCodeWithLang', {
    filter: ['pre'],
    replacement: function (content, node) {
      const codeElement = (node as Element)?.querySelector?.('code');
      if (!codeElement) {
        return '\n\n```\n' + content + '\n```\n\n';
      }

      // Extract language from class attributes
      let language = '';
      const className = (codeElement as Element).className || '';

      const langMatch = className.match(/(?:language-|lang-)([a-zA-Z0-9-]+)/);
      if (langMatch) {
        language = langMatch[1] || '';
      }

      const codeContent = (codeElement as Element).textContent || '';
      return '\n\n```' + (language || '') + '\n' + codeContent + '\n```\n\n';
    },
  });

  // Custom rule to strip links when includeLinks is false (preserve images)
  service.addRule('stripLinks', {
    filter: ['a'],
    replacement: function (content, node, options) {
      const hasImage = (node as Element)?.querySelector?.('img');
      if (hasImage) return content;

      const includeLinks = (options as { includeLinks?: boolean })?.includeLinks !== false;
      if (!includeLinks) return content;

      const href = (node as Element)?.getAttribute?.('href');
      const title = (node as Element)?.getAttribute?.('title');
      if (!href) return content;
      let link = '[' + content + '](' + href;
      if (title) link += ' "' + title + '"';
      link += ')';
      return link;
    },
  });

  // Intentionally no custom figure rule: preserve all text around images
  // by letting Turndown process figure contents normally.

  // Custom rule for footnotes
  service.addRule('footnote', {
    filter: function (node) {
      return (
        node.nodeName === 'SUP' && (node as Element)?.querySelector?.('a[href^="#fn"]') != null
      );
    },
    replacement: function (_content, node) {
      const link = (node as Element)?.querySelector?.('a[href^="#fn"]');
      if (!link) return _content;
      const href = link.getAttribute('href') || '';
      const id = href.replace('#fn', '').replace('#', '');
      return `[^${id}]`;
    },
  });

  // Custom rule for footnote references
  service.addRule('footnoteReference', {
    filter: function (node) {
      return (
        (node.nodeName === 'OL' || node.nodeName === 'UL') &&
        ((node as Element).getAttribute?.('class')?.includes('footnote') ||
          (node as Element)?.querySelector?.('li[id^="fn"]') !== null)
      );
    },
    replacement: function (_content, node) {
      const items = (node as Element)?.querySelectorAll?.('li[id^="fn"]') || [];
      if ((items as NodeList).length === 0) return _content;
      let footnotes = '\n\n---\n\n';
      Array.from(items as NodeList).forEach(item => {
        const element = item as Element;
        const id = element.getAttribute('id')?.replace('fn', '') || '';
        const text = element.textContent?.trim() || '';
        footnotes += `[^${id}]: ${text}\n\n`;
      });
      return footnotes;
    },
  });

  // Custom rule for YouTube/Twitter embeds - preserve
  service.addRule('embedToMarkdown', {
    filter: function (node) {
      return node.nodeName === 'IFRAME' && (node as Element)?.getAttribute?.('src') !== null;
    },
    replacement: function (content, node) {
      const iframe = node as Element;
      const src = iframe?.getAttribute?.('src') || '';
      const ytMatch = src.match(
        /(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([a-zA-Z0-9_-]+)/
      );
      if (ytMatch?.[1]) {
        const videoId = ytMatch[1];
        return `\n\n![YouTube Video](https://img.youtube.com/vi/${videoId}/0.jpg)\n\n`;
      }
      const twitterMatch = src.match(/(?:twitter\.com|x\.com)\/.*?(?:status|statuses)\/(\d+)/);
      if (twitterMatch?.[1]) {
        const tweetId = twitterMatch[1];
        return `\n\n[Tweet ${tweetId}]\n\n`;
      }
      if (src) {
        return `\n\n[Embedded Content]\n\n`;
      }
      return content;
    },
  });

  // Keep/remove configuration
  service.keep(['iframe', 'video', 'audio', 'sup', 'sub', 'mark']);
  service.remove(['script', 'style', 'button', 'noscript']);
}

/**
 * Get or create a configured Turndown service instance with caching
 */
async function getTurndownService(): Promise<TurndownService> {
  if (!turndownInstance) {
    const TurndownCtor = (await import('turndown')).default as new (
      options: Record<string, unknown>
    ) => unknown;
    turndownInstance = new TurndownCtor({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      bulletListMarker: '-',
    }) as unknown as TurndownService;
  }

  // Always (re)apply configuration so tests can observe calls per run
  await configureTurndown(turndownInstance);
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
        'figure',
        'figcaption',
        // Tables
        'table',
        'caption',
        'colgroup',
        'col',
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
    // Return a naive text-only fallback without DOM access
    try {
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([!?,.;:])/g, '$1')
        .trim();
    } catch {
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
