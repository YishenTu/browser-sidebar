/**
 * @file MarkdownRenderer Component
 *
 * A comprehensive markdown renderer with syntax highlighting, XSS protection,
 * and custom styling for chat messages. Built on react-markdown with
 * rehype-highlight for syntax highlighting and DOMPurify for sanitization.
 *
 * Features:
 * - Safe markdown rendering with XSS protection
 * - Syntax highlighting for code blocks
 * - Custom styled components matching chat UI
 * - External link security (opens in new tab)
 * - Performance optimized for large content
 * - Lazy loading for syntax highlighting
 * - Accessibility support
 */

import React, { useMemo, useCallback } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { cn } from '@/utils/cn';
import { CodeBlock } from './CodeBlock';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Props for the MarkdownRenderer component
 */
export interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string | null | undefined;
  /** Additional CSS classes */
  className?: string;
  /** Custom react-markdown options */
  options?: Partial<Options>;
  /** Whether to enable syntax highlighting (default: true) */
  enableSyntaxHighlighting?: boolean;
  /** Whether to sanitize HTML content (default: true) */
  sanitizeHtml?: boolean;
  /** Custom link click handler */
  onLinkClick?: (url: string, event: React.MouseEvent) => void;
}

/**
 * Sanitization configuration for DOMPurify
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'div',
    'span',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'a',
    'br',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'alt',
    'src',
    'class',
    'id',
    'target',
    'rel',
    'aria-label',
    'role',
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

// =============================================================================
// Custom Renderer Components
// =============================================================================

/**
 * Custom heading renderer with proper styling
 */
const HeadingRenderer = ({ level, children, ...props }: any) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  const getHeadingClasses = (level: number): string => {
    const baseClasses = 'font-bold text-gray-900 dark:text-gray-100';

    switch (level) {
      case 1:
        return cn(
          baseClasses,
          'text-2xl mb-4 mt-6 first:mt-0 border-b border-gray-200 dark:border-gray-700 pb-2'
        );
      case 2:
        return cn(baseClasses, 'text-xl mb-3 mt-5 first:mt-0');
      case 3:
        return cn(baseClasses, 'text-lg mb-3 mt-4 first:mt-0');
      case 4:
        return cn(baseClasses, 'text-base mb-2 mt-3 first:mt-0');
      case 5:
        return cn(baseClasses, 'text-sm mb-2 mt-3 first:mt-0');
      case 6:
        return cn(baseClasses, 'text-xs mb-2 mt-3 first:mt-0');
      default:
        return cn(baseClasses, 'text-base mb-2 mt-3 first:mt-0');
    }
  };

  return (
    <Tag className={getHeadingClasses(level)} {...props}>
      {children}
    </Tag>
  );
};

/**
 * Custom paragraph renderer
 */
const ParagraphRenderer = ({ children, ...props }: any) => (
  <p className="mb-4 leading-relaxed text-gray-800 dark:text-gray-200 last:mb-0" {...props}>
    {children}
  </p>
);

/**
 * Custom list renderer
 */
const ListRenderer = ({ ordered, children, ...props }: any) => {
  const Tag = ordered ? 'ol' : 'ul';
  const listClasses = ordered
    ? 'list-decimal ml-6 mb-4 space-y-1'
    : 'list-disc ml-6 mb-4 space-y-1';

  return (
    <Tag className={listClasses} {...props}>
      {children}
    </Tag>
  );
};

/**
 * Custom list item renderer
 */
const ListItemRenderer = ({ children, ...props }: any) => (
  <li className="text-gray-800 dark:text-gray-200" {...props}>
    {children}
  </li>
);

/**
 * Custom blockquote renderer
 */
const BlockquoteRenderer = ({ children, ...props }: any) => (
  <blockquote
    className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300"
    {...props}
  >
    {children}
  </blockquote>
);

/**
 * Custom link renderer with security features
 */
const LinkRenderer = ({ href, children, onLinkClick, ...props }: any) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onLinkClick) {
        e.preventDefault();
        onLinkClick(href, e);
      }
    },
    [href, onLinkClick]
  );

  // Determine if link is external
  const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
      aria-label={`Link to ${href}`}
      {...props}
    >
      {children}
    </a>
  );
};

/**
 * Custom code renderer (inline)
 */
const InlineCodeRenderer = ({ children, ...props }: any) => (
  <code
    className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
    {...props}
  >
    {children}
  </code>
);

/**
 * Custom pre renderer (code blocks) - uses CodeBlock component
 */
const PreRenderer = ({ children, enableSyntaxHighlighting = true, ...props }: any) => {
  // Extract code content and language from children
  const child = React.Children.only(children);
  const code = child?.props?.children || '';
  const className = child?.props?.className || '';
  const language = enableSyntaxHighlighting
    ? className.replace('language-', '') || undefined
    : undefined;

  return (
    <CodeBlock
      code={code}
      language={language}
      showLineNumbers={false}
      showWordWrapToggle={false}
      className="mb-4"
      {...props}
    />
  );
};

/**
 * Custom horizontal rule renderer
 */
const HrRenderer = (props: any) => (
  <hr className="border-gray-300 dark:border-gray-600 my-6" {...props} />
);

/**
 * Custom table renderer
 */
const TableRenderer = ({ children, ...props }: any) => (
  <div className="overflow-x-auto mb-4">
    <table
      className="min-w-full border-collapse border border-gray-300 dark:border-gray-600"
      {...props}
    >
      {children}
    </table>
  </div>
);

/**
 * Custom table cell renderers
 */
const ThRenderer = ({ children, ...props }: any) => (
  <th
    className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left"
    {...props}
  >
    {children}
  </th>
);

const TdRenderer = ({ children, ...props }: any) => (
  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2" {...props}>
    {children}
  </td>
);

// =============================================================================
// Main Component
// =============================================================================

/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with syntax highlighting, XSS protection,
 * and custom styling optimized for chat interfaces.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  options = {},
  enableSyntaxHighlighting = true,
  sanitizeHtml = true,
  onLinkClick,
}) => {
  // Memoize sanitized content for performance
  const sanitizedContent = useMemo(() => {
    if (!content) return '';

    if (sanitizeHtml) {
      return DOMPurify.sanitize(content, SANITIZE_CONFIG);
    }

    return content;
  }, [content, sanitizeHtml]);

  // Memoize react-markdown options for performance
  const markdownOptions = useMemo((): Options => {
    const baseOptions: Options = {
      remarkPlugins: [remarkGfm, ...(options.remarkPlugins || [])],
      rehypePlugins: options.rehypePlugins || [],
      components: {
        // Headings
        h1: props => <HeadingRenderer level={1} {...props} />,
        h2: props => <HeadingRenderer level={2} {...props} />,
        h3: props => <HeadingRenderer level={3} {...props} />,
        h4: props => <HeadingRenderer level={4} {...props} />,
        h5: props => <HeadingRenderer level={5} {...props} />,
        h6: props => <HeadingRenderer level={6} {...props} />,

        // Text elements
        p: ParagraphRenderer,

        // Lists
        ul: props => <ListRenderer ordered={false} {...props} />,
        ol: props => <ListRenderer ordered={true} {...props} />,
        li: ListItemRenderer,

        // Blockquote
        blockquote: BlockquoteRenderer,

        // Links
        a: props => <LinkRenderer onLinkClick={onLinkClick} {...props} />,

        // Code
        code: InlineCodeRenderer,
        pre: props => (
          <PreRenderer enableSyntaxHighlighting={enableSyntaxHighlighting} {...props} />
        ),

        // Horizontal rule
        hr: HrRenderer,

        // Tables
        table: TableRenderer,
        th: ThRenderer,
        td: TdRenderer,

        // Override default components with custom ones
        ...(options.components || {}),
      },
      ...options,
    };

    return baseOptions;
  }, [options, enableSyntaxHighlighting, onLinkClick]);

  // Handle empty content
  if (!sanitizedContent) {
    return (
      <div
        data-testid="markdown-renderer"
        role="article"
        className={cn('prose prose-sm max-w-none', className)}
        aria-label="Empty content"
      />
    );
  }

  return (
    <div
      data-testid="markdown-renderer"
      role="article"
      className={cn(
        'prose prose-sm max-w-none',
        'prose-headings:text-gray-900 dark:prose-headings:text-gray-100',
        'prose-p:text-gray-800 dark:prose-p:text-gray-200',
        'prose-strong:text-gray-900 dark:prose-strong:text-gray-100',
        'prose-em:text-gray-800 dark:prose-em:text-gray-200',
        'prose-code:text-gray-900 dark:prose-code:text-gray-100',
        'prose-pre:bg-gray-900 prose-pre:text-gray-100',
        'prose-a:text-blue-600 dark:prose-a:text-blue-400',
        className
      )}
      aria-label="Markdown content"
    >
      <ReactMarkdown {...markdownOptions}>{sanitizedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
