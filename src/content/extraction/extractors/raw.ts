/**
 * @file Raw Mode Extractor
 *
 * Extracts content with minimal processing to preserve HTML structure,
 * especially tables. Alternative to Defuddle for table-heavy pages.
 */

import { isVisible } from '@content/utils/domUtils';
import type { ExtractedContent } from '@/types/extraction';

/**
 * Helper function to process nodes recursively for markdown conversion
 */
function processNode(node: Node, listLevel: number = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\s+/g, ' ');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  let result = '';

  // Process children first for most elements
  const processChildren = (separator: string = ''): string => {
    return Array.from(element.childNodes)
      .map(child => processNode(child, listLevel))
      .filter(text => text.trim())
      .join(separator);
  };

  // Handle different HTML elements
  switch (tagName) {
    // Headings
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(tagName[1] || '1');
      const prefix = '#'.repeat(level);
      const text = processChildren(' ').trim();
      if (text) result = `\n${prefix} ${text}\n`;
      break;
    }

    // Paragraphs and divs
    case 'p':
    case 'div': {
      const content = processChildren(' ').trim();
      if (content) result = `\n${content}\n`;
      break;
    }

    // Lists
    case 'ul':
    case 'ol': {
      const items = Array.from(element.children)
        .filter(child => child.tagName.toLowerCase() === 'li')
        .map((li, index) => {
          const prefix = tagName === 'ol' ? `${index + 1}.` : '-';
          const indent = '  '.repeat(listLevel);
          const content = processNode(li, listLevel + 1).trim();
          return content ? `${indent}${prefix} ${content}` : '';
        })
        .filter(item => item);

      if (items.length > 0) {
        result = '\n' + items.join('\n') + '\n';
      }
      break;
    }

    case 'li': {
      // Process list item content (handled by parent ul/ol)
      result = processChildren(' ');
      break;
    }

    // Tables - special handling for structured data
    case 'table': {
      const rows: string[][] = [];
      const trs = element.querySelectorAll('tr');

      trs.forEach(tr => {
        const cells: string[] = [];
        tr.querySelectorAll('td, th').forEach(cell => {
          const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
          cells.push(text);
        });
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length > 0) {
        // Simple table format for LLM
        result = '\n```table\n';
        rows.forEach(row => {
          result += row.join(' | ') + '\n';
        });
        result += '```\n';
      }
      break;
    }

    // Definition lists (common in Chinese business sites)
    case 'dl': {
      const items: string[] = [];
      let currentTerm = '';

      Array.from(element.children).forEach(child => {
        if (child.tagName.toLowerCase() === 'dt') {
          currentTerm = (child.textContent || '').trim();
        } else if (child.tagName.toLowerCase() === 'dd' && currentTerm) {
          const definition = (child.textContent || '').trim();
          if (definition) {
            items.push(`**${currentTerm}**: ${definition}`);
          }
          currentTerm = '';
        }
      });

      if (items.length > 0) {
        result = '\n' + items.join('\n') + '\n';
      }
      break;
    }

    // Inline elements
    case 'strong':
    case 'b': {
      const text = processChildren().trim();
      if (text) result = `**${text}**`;
      break;
    }

    case 'em':
    case 'i': {
      const text = processChildren().trim();
      if (text) result = `*${text}*`;
      break;
    }

    case 'code': {
      const text = processChildren().trim();
      if (text) result = `\`${text}\``;
      break;
    }

    case 'pre': {
      const text = (element.textContent || '').trim();
      if (text) result = `\n\`\`\`\n${text}\n\`\`\`\n`;
      break;
    }

    // Links (URLs are stripped in Phase 1, so just preserve text)
    case 'a': {
      const href = element.getAttribute('href');
      const text = processChildren().trim();
      if (href && text) {
        // If href still exists (Phase 1 not applied), convert to markdown link
        result = `[${text}](${href})`;
      } else if (text) {
        // No href (stripped by Phase 1), just keep the text
        result = text;
      }
      break;
    }

    // Line breaks
    case 'br': {
      result = '\n';
      break;
    }

    // Horizontal rules
    case 'hr': {
      result = '\n---\n';
      break;
    }

    // Blockquotes
    case 'blockquote': {
      const lines = processChildren('\n').trim().split('\n');
      result = '\n' + lines.map(line => `> ${line}`).join('\n') + '\n';
      break;
    }

    // Special handling for elements with copy-value class (key data)
    default: {
      // Check for copy-value class (important data)
      if (element.classList.contains('copy-value')) {
        const text = (element.textContent || '').trim();
        if (text) result = `**${text}**`;
      } else {
        // Default: just process children
        result = processChildren(' ');
      }
      break;
    }
  }

  return result;
}

/**
 * Converts HTML to Markdown format for optimal LLM consumption
 * Phase 2: HTML to Markdown conversion (additional 20-30% token reduction)
 *
 * @param html - HTML string to convert
 * @returns Markdown string optimized for LLM consumption
 */
function htmlToMarkdown(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Process the entire document
    let markdown = processNode(doc.body);

    // Clean up the markdown
    markdown = markdown
      .replace(/&nbsp;?/gi, ' ') // Replace &nbsp entities with spaces
      .replace(/&gt;/gi, '>') // Replace &gt entities
      .replace(/&lt;/gi, '<') // Replace &lt entities
      .replace(/&amp;/gi, '&') // Replace &amp entities
      .replace(/&quot;/gi, '"') // Replace &quot entities
      .replace(/&#39;/gi, "'") // Replace &#39 entities
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/^\s+|\s+$/g, '') // Trim
      .replace(/\n\s+\n/g, '\n\n') // Clean empty lines with spaces
      .replace(/\s+$/gm, '') // Remove trailing spaces from lines
      .replace(/\s{2,}/g, ' '); // Collapse multiple spaces

    return markdown;
  } catch (error) {
    console.error('[htmlToMarkdown] Error during conversion:', error);
    return html; // Fallback to HTML if conversion fails
  }
}

/**
 * Strips unnecessary HTML elements and flattens structure for token optimization
 * Phase 1: HTML stripping & structure flattening (40-50% token reduction)
 *
 * @param html - Raw HTML string to process
 * @param targetDoc - Document to use for processing (allows testing)
 * @returns Optimized HTML string with reduced tokens
 */
function stripAndFlattenHTML(html: string): string {
  try {
    // Create a temporary document for processing
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Remove copy buttons/icons but try to preserve nearby content
    const copyElements = doc.querySelectorAll(
      '.app-copy, .copy-button-item, .base_copy, .copy-hover-item, .copy-btn, .copy-icon, button[class*="copy"], i[class*="copy"], svg[class*="copy"]'
    );
    copyElements.forEach(el => {
      try {
        // For button/icon elements, just remove them
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'button' || tagName === 'i' || tagName === 'svg' || tagName === 'img') {
          el.parentNode?.removeChild(el);
        } else {
          // For other elements, check if they have meaningful content beyond copy UI
          const text = el.textContent?.trim() || '';
          const copyTerms = ['copy', '复制', 'copied', '已复制', 'click to copy', '点击复制'];

          // Check if this is ONLY a copy UI element (no other meaningful text)
          const isCopyOnly = copyTerms.some(
            term =>
              text.toLowerCase() === term.toLowerCase() ||
              text.toLowerCase() === `${term.toLowerCase()} to clipboard`
          );

          if (isCopyOnly) {
            // This element only contains copy UI text, safe to remove
            el.parentNode?.removeChild(el);
          } else if (text.length > 0) {
            // Has other content, try to preserve it
            // Remove child elements that are copy buttons but keep text
            const copyChildren = el.querySelectorAll('button, i, svg, .copy-icon, .copy-btn');
            copyChildren.forEach(child => {
              child.parentNode?.removeChild(child);
            });

            // Also try to remove inline copy text while preserving other content
            if (el.childNodes.length > 0) {
              el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                  const nodeText = node.textContent?.trim().toLowerCase() || '';
                  if (copyTerms.some(term => nodeText === term.toLowerCase())) {
                    node.textContent = '';
                  }
                }
              });
            }
          }
        }
      } catch (e) {
        // Skip if element can't be modified
      }
    });

    // 2. Remove icon elements and SVGs (safe removal)
    const iconElements = doc.querySelectorAll('i.aicon, i.qccdicon, svg, [class*="icon-icon_"]');
    iconElements.forEach(el => {
      try {
        el.parentNode?.removeChild(el);
      } catch (e) {
        // Skip if element can't be removed
      }
    });

    // 3. Remove empty or disabled elements (safe removal)
    const disabledElements = doc.querySelectorAll('.item.disable, .count:empty, span:empty');
    disabledElements.forEach(el => {
      try {
        const text = el.textContent?.trim();
        if (!text || text === '0') {
          el.parentNode?.removeChild(el);
        }
      } catch (e) {
        // Skip if element can't be removed
      }
    });

    // 3.5. Remove common non-content elements (ads, banners, modals, etc.)
    const nonContentElements = doc.querySelectorAll(
      '[class*="banner"], [class*="modal"], [class*="popup"], [class*="overlay"], ' +
        '[class*="cookie"], [class*="gdpr"], [class*="alert"], [class*="notice"], ' +
        '[class*="advertise"], [class*="promotion"], [class*="social-share"], ' +
        '[class*="social-media"], [class*="newsletter"], [class*="subscribe"], ' +
        '[id*="ad-"], [id*="ads-"], .ad, .ads, .advertisement'
    );
    nonContentElements.forEach(el => {
      try {
        el.parentNode?.removeChild(el);
      } catch (e) {
        // Skip if element can't be removed
      }
    });

    // 4. Flatten deeply nested structures (skip - can cause DOMException)
    // This step is prone to errors, so we'll skip it for now

    // 5. Remove wrapper divs (safer approach)
    const wrapperDivs = doc.querySelectorAll(
      'div.wrapper, div.container, div.inner, div.part, div.item-wrap'
    );
    wrapperDivs.forEach(div => {
      try {
        // Only remove if it has no ID and is purely decorative
        if (!div.id && div.children.length > 0) {
          const parent = div.parentElement;
          if (parent && parent !== doc.body) {
            // Move children up safely
            const children = Array.from(div.children);
            children.forEach(child => {
              try {
                parent.insertBefore(child, div);
              } catch (e) {
                // Skip if can't move child
              }
            });
            // Remove the now-empty wrapper
            parent.removeChild(div);
          }
        }
      } catch (e) {
        // Skip if operation fails
      }
    });

    // 6. Clean table attributes (safe operation)
    const tables = doc.querySelectorAll('table');
    tables.forEach(table => {
      try {
        table.removeAttribute('class');
        table.removeAttribute('style');
        const tableElements = table.querySelectorAll('td, th, tr, tbody, thead');
        tableElements.forEach(el => {
          el.removeAttribute('class');
          el.removeAttribute('style');
          if (el.getAttribute('colspan') === '1') el.removeAttribute('colspan');
          if (el.getAttribute('rowspan') === '1') el.removeAttribute('rowspan');
        });
      } catch (e) {
        // Skip if can't modify table
      }
    });

    // 7. Strip non-semantic class attributes (safe operation)
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      try {
        const className = el.className;
        if (typeof className === 'string' && className) {
          // Keep only semantically meaningful classes
          if (
            !className.includes('copy-value') &&
            !className.includes('title') &&
            !className.includes('content') &&
            !className.includes('name')
          ) {
            el.removeAttribute('class');
          }
        }
      } catch (e) {
        // Skip if can't access className
      }
    });

    // 8. Remove navigation, header, and footer elements (safe removal)
    // Remove by semantic tags first
    const structuralElements = doc.querySelectorAll('header, nav, footer, aside');
    structuralElements.forEach(el => {
      try {
        el.parentNode?.removeChild(el);
      } catch (e) {
        // Skip if element can't be removed
      }
    });

    // Remove by common class/id patterns
    const commonPatterns = doc.querySelectorAll(
      '[class*="header"], [class*="nav"], [class*="footer"], [class*="sidebar"], ' +
        '[id*="header"], [id*="nav"], [id*="footer"], [id*="sidebar"], ' +
        '.nav-colunm, .nav-item, .breadcrumb, .tab-item, .action-btn, ' +
        '.menu, .toolbar, .topbar, .bottombar'
    );
    commonPatterns.forEach(el => {
      try {
        // Don't remove if it contains main content indicators
        const text = el.textContent || '';
        const hasImportantContent =
          el.querySelector('table') || el.querySelector('.copy-value') || text.length > 1000; // Likely main content if very long

        if (!hasImportantContent) {
          el.parentNode?.removeChild(el);
        }
      } catch (e) {
        // Skip if element can't be removed
      }
    });

    // 9. Remove URLs from links while preserving link text
    const linksWithHref = doc.querySelectorAll('a[href]');
    linksWithHref.forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (href) {
          // Remove the href attribute to strip the URL
          link.removeAttribute('href');
          // Also remove target, rel, and other link-specific attributes
          link.removeAttribute('target');
          link.removeAttribute('rel');
          link.removeAttribute('title');
          // The link text is preserved, just the URL is removed
        }
      } catch (e) {
        // Skip if can't modify link
      }
    });

    // 10. Further flatten structure - remove single-child divs and spans
    const singleChildContainers = doc.querySelectorAll('div, span');
    singleChildContainers.forEach(container => {
      try {
        // Only process if it has exactly one child element and no text content
        if (
          container.children.length === 1 &&
          !container.id &&
          !container.className.includes('copy-value') &&
          !container.textContent?.replace(container.children[0]?.textContent || '', '').trim()
        ) {
          const child = container.children[0];
          if (child && container.parentNode) {
            // Replace container with its child
            container.parentNode.replaceChild(child, container);
          }
        }
      } catch (e) {
        // Skip if operation fails
      }
    });

    // 11. Normalize whitespace (simplified approach)
    // Just normalize the HTML string instead of manipulating text nodes
    let result = doc.body.innerHTML;
    result = result.replace(/\s+/g, ' '); // Normalize all whitespace
    result = result.replace(/>\s+</g, '><'); // Remove whitespace between tags

    // 12. Remove zero-count items (using regex as fallback)
    result = result.replace(
      /<[^>]*class="[^"]*item[^"]*"[^>]*>.*?<span[^>]*class="[^"]*count[^"]*"[^>]*>\s*0\s*<\/span>.*?<\/[^>]+>/gi,
      ''
    );

    return result;
  } catch (error) {
    console.error('[stripAndFlattenHTML] Error during optimization:', error);
    // Return original HTML if optimization fails completely
    return html;
  }
}

/**
 * Configuration options for raw mode extraction
 */
interface RawModeOptions {
  /** Selector hints for main content containers */
  root_hints?: string[];
  /** Remove class attributes (default: true) */
  strip_class?: boolean;
  /** Preserve id attributes (default: true) */
  keep_id?: boolean;
  /** Inject ::before/::after content (default: false) */
  inject_pseudo?: boolean;
  /** Handle Shadow DOM (default: false, future feature) */
  shadow_aware?: boolean;

  /** Enable aggressive HTML stripping for token optimization (Phase 1) */
  optimize_tokens?: boolean;

  /** Convert to Markdown format for LLM consumption (Phase 2) */
  convert_to_markdown?: boolean;

  // Stripping toggles - all default to false (don't strip) for testing
  /** Strip invisible elements (default: false for testing) */
  strip_invisible?: boolean;
  /** Strip script tags (default: false for testing) */
  strip_scripts?: boolean;
  /** Strip style tags (default: false for testing) */
  strip_styles?: boolean;
  /** Strip link tags (default: false for testing) */
  strip_links?: boolean;
  /** Strip noscript tags (default: false for testing) */
  strip_noscript?: boolean;
  /** Strip iframe tags (default: false for testing) */
  strip_iframes?: boolean;
  /** Strip object tags (default: false for testing) */
  strip_objects?: boolean;
  /** Strip embed tags (default: false for testing) */
  strip_embeds?: boolean;
  /** Strip applet tags (default: false for testing) */
  strip_applets?: boolean;
  /** Strip svg tags (default: false for testing) */
  strip_svg?: boolean;
  /** Strip canvas tags (default: false for testing) */
  strip_canvas?: boolean;
  /** Strip event handlers (onclick, etc.) (default: false for testing) */
  strip_event_handlers?: boolean;
  /** Strip javascript: URLs (default: false for testing) */
  strip_javascript_urls?: boolean;
  /** Only keep safe attributes (default: false for testing) */
  strip_unsafe_attrs?: boolean;
  /** Try to find main content area (default: false for testing) */
  find_main_content?: boolean;
}

/**
 * Extract content in raw mode (preserves HTML structure, especially tables)
 *
 * @param options - Raw mode extraction options
 * @returns Extracted content with preserved HTML structure
 */
export async function extractWithRaw(options?: RawModeOptions): Promise<ExtractedContent> {
  // 1. Find the best root element for content (or use body if disabled)
  const root =
    options?.find_main_content !== false ? pickRoot(document, options?.root_hints) : document.body;

  // 2. Create a clean document for processing
  const cleanDoc = document.implementation.createHTMLDocument('raw');

  // 3. Deep clone nodes with optional sanitization
  const clonedRoot = deepCloneVisible(root, cleanDoc, options);
  if (clonedRoot) {
    cleanDoc.body.appendChild(clonedRoot);
  }

  // 4. Apply token optimization if enabled
  let finalContent = cleanDoc.body.innerHTML;

  // Phase 1: HTML stripping
  if (options?.optimize_tokens) {
    try {
      finalContent = stripAndFlattenHTML(finalContent);
      // Update cleanDoc with optimized HTML for metadata calculation
      cleanDoc.body.innerHTML = finalContent;
    } catch (error) {
      // Token optimization failed, using original HTML
      // Continue with original HTML if optimization fails
    }
  }

  // Phase 2: Markdown conversion (if enabled)
  if (options?.convert_to_markdown) {
    try {
      // If we haven't stripped HTML yet, do it first for better markdown
      if (!options?.optimize_tokens) {
        finalContent = stripAndFlattenHTML(finalContent);
      }
      finalContent = htmlToMarkdown(finalContent);
      // Successfully converted to Markdown format
    } catch (error) {
      // Markdown conversion failed, using HTML
      // Continue with HTML if markdown conversion fails
    }
  }

  // 5. URL normalization will be handled by orchestrator via normalizeUrls()
  // Don't duplicate that work here

  // 6. Calculate metadata
  const tables = cleanDoc.querySelectorAll('table');
  const textContent = cleanDoc.body.textContent || '';

  // 7. Return full ExtractedContent shape
  const result = {
    title: document.title || 'Untitled',
    url: window.location.href,
    domain: window.location.hostname,
    content: finalContent, // Optimized HTML or Markdown based on options
    textContent,
    excerpt: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
    extractedAt: Date.now(),
    extractionMethod: 'raw' as const,
    metadata: {
      hasTables: tables.length > 0,
      truncated: false,
    },
  };

  return result;
}

/**
 * Pick the best root element for content extraction
 *
 * @param doc - Document to search in
 * @param hints - Optional selector hints for known content containers
 * @returns Best root element for extraction
 */
function pickRoot(doc: Document, hints?: string[]): Element {
  // Try user-provided hints first
  if (hints) {
    for (const selector of hints) {
      try {
        const el = doc.querySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
  }

  // Try common content containers
  const commonSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
    '.article-content',
  ];

  for (const selector of commonSelectors) {
    try {
      const el = doc.querySelector(selector);
      if (el && isVisible(el)) {
        return el;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  // Fallback to body
  return doc.body;
}

/**
 * Deep clone visible nodes with security sanitization
 *
 * @param source - Source element to clone
 * @param targetDoc - Target document for cloned nodes
 * @param options - Raw mode options
 * @returns Cloned and sanitized element
 */
function deepCloneVisible(
  source: Element,
  targetDoc: Document,
  options?: RawModeOptions
): Element | null {
  // Skip invisible elements (if enabled)
  if (options?.strip_invisible !== false && !isVisible(source)) {
    return null;
  }

  // Build list of tags to skip based on options (all default to false = don't strip)
  const dangerousTags: string[] = [];

  if (options?.strip_scripts !== false) dangerousTags.push('SCRIPT');
  if (options?.strip_styles !== false) dangerousTags.push('STYLE');
  if (options?.strip_links !== false) dangerousTags.push('LINK');
  if (options?.strip_noscript !== false) dangerousTags.push('NOSCRIPT');
  if (options?.strip_iframes !== false) dangerousTags.push('IFRAME');
  if (options?.strip_objects !== false) dangerousTags.push('OBJECT');
  if (options?.strip_embeds !== false) dangerousTags.push('EMBED');
  if (options?.strip_applets !== false) dangerousTags.push('APPLET');
  if (options?.strip_svg !== false) dangerousTags.push('SVG');
  if (options?.strip_canvas !== false) dangerousTags.push('CANVAS');

  if (dangerousTags.includes(source.tagName)) {
    return null;
  }

  // Create the cloned element
  const clone = targetDoc.createElement(source.tagName.toLowerCase());

  if (options?.strip_unsafe_attrs !== false) {
    // Only copy safe attributes (original behavior)
    const safeAttributes = [
      'href',
      'src',
      'srcset',
      'alt',
      'title',
      'width',
      'height',
      'colspan',
      'rowspan',
      'scope',
      'headers',
      'role',
      'aria-label',
      'aria-describedby',
      'data-src',
      'data-srcset',
    ];

    // Optionally include id
    if (options?.keep_id !== false) {
      safeAttributes.push('id');
    }

    // Optionally include class (for code language detection)
    if (!options?.strip_class) {
      safeAttributes.push('class');
    }

    for (const attr of safeAttributes) {
      const value = source.getAttribute(attr);
      if (value) {
        // Skip javascript: URLs if stripping is enabled
        if (options?.strip_javascript_urls !== false && (attr === 'href' || attr === 'src')) {
          if (value.startsWith('javascript:')) {
            continue;
          }
        }
        try {
          clone.setAttribute(attr, value);
        } catch (e) {
          // Skip invalid attributes (malformed HTML)
          // Skipping invalid attribute
        }
      }
    }
  } else {
    // Copy ALL attributes (testing mode)
    Array.from(source.attributes).forEach(attr => {
      // Skip event handlers if stripping is enabled
      if (options?.strip_event_handlers !== false && attr.name.startsWith('on')) {
        return;
      }

      // Skip javascript: URLs if stripping is enabled
      if (
        options?.strip_javascript_urls !== false &&
        (attr.name === 'href' || attr.name === 'src') &&
        attr.value.startsWith('javascript:')
      ) {
        return;
      }

      try {
        clone.setAttribute(attr.name, attr.value);
      } catch (e) {
        // Skip invalid attributes (malformed HTML)
        console.warn('[RAW] Skipping invalid attribute:', attr.name);
      }
    });
  }

  // Handle text nodes
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text && text.trim()) {
        clone.appendChild(targetDoc.createTextNode(text));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const clonedChild = deepCloneVisible(child as Element, targetDoc, options);
      if (clonedChild) {
        clone.appendChild(clonedChild);
      }
    }
  }

  // Inject pseudo-elements if requested (future feature)
  if (options?.inject_pseudo && window.getComputedStyle) {
    try {
      const before = window.getComputedStyle(source, '::before').content;
      const after = window.getComputedStyle(source, '::after').content;

      if (before && before !== 'none' && before !== '""') {
        const cleanContent = before.replace(/^["']|["']$/g, '');
        if (cleanContent) {
          clone.insertBefore(targetDoc.createTextNode(cleanContent), clone.firstChild);
        }
      }

      if (after && after !== 'none' && after !== '""') {
        const cleanContent = after.replace(/^["']|["']$/g, '');
        if (cleanContent) {
          clone.appendChild(targetDoc.createTextNode(cleanContent));
        }
      }
    } catch (e) {
      // Ignore pseudo-element extraction errors
    }
  }

  return clone;
}

/**
 * Site-specific configurations for known problematic sites
 * Can be extended in the future for better extraction
 */
export const SITE_CONFIGS: Record<string, RawModeOptions> = {
  'qichacha.com': {
    root_hints: ['.company-detail', '.layout-content'],
    inject_pseudo: true, // They use ::before for some labels
  },
  'bloomberg.com': {
    root_hints: ['.content-main', 'article'],
  },
  'github.com': {
    root_hints: ['.repository-content', '.markdown-body', 'article'],
  },
  'stackoverflow.com': {
    root_hints: ['#mainbar', '.question', '.answer'],
  },
};
