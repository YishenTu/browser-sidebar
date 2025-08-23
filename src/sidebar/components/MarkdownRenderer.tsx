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
import { cn } from '@utils/cn';
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
type HeadingProps = React.HTMLAttributes<HTMLElement> & {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: React.ReactNode;
};
const HeadingRenderer = ({ level, children }: HeadingProps) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  const getHeadingClasses = (level: number): string => {
    const baseClasses = 'font-bold text-gray-900 dark:text-gray-100';

    switch (level) {
      case 1:
        return cn(
          baseClasses,
          'text-2xl m-0 p-0 leading-tight'
        );
      case 2:
        return cn(baseClasses, 'text-xl m-0 p-0 leading-tight');
      case 3:
        return cn(baseClasses, 'text-lg m-0 p-0 leading-tight');
      case 4:
        return cn(baseClasses, 'text-base m-0 p-0 leading-tight');
      case 5:
        return cn(baseClasses, 'text-sm m-0 p-0 leading-tight');
      case 6:
        return cn(baseClasses, 'text-xs m-0 p-0 leading-tight');
      default:
        return cn(baseClasses, 'text-base m-0 p-0 leading-tight');
    }
  };

  return <Tag className={getHeadingClasses(level)}>{children}</Tag>;
};

/**
 * Custom paragraph renderer
 */
const ParagraphRenderer = ({ children, ...props }: React.ComponentProps<'p'>) => (
  <p className="text-gray-800 dark:text-gray-200 m-0 p-0 leading-tight" style={{ textAlign: 'inherit' }} {...props}>
    {children}
  </p>
);

/**
 * Custom list renderer
 */
const ListRenderer = ({
  ordered,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  ordered?: boolean;
  children?: React.ReactNode;
}) => {
  const Tag = ordered ? 'ol' : 'ul';
  
  // Force minimal indentation with inline styles that override everything
  const listStyle: React.CSSProperties = {
    paddingLeft: '12px', // Ultra minimal space for bullets/numbers
    marginLeft: '0',
    margin: '0',
    listStylePosition: 'outside',
  };
  
  const listClasses = ordered
    ? 'list-decimal m-0 p-0'
    : 'list-disc m-0 p-0';

  return (
    <Tag className={listClasses} style={listStyle} {...props}>
      {children}
    </Tag>
  );
};

/**
 * Custom list item renderer
 */
const ListItemRenderer = ({ children, ...props }: React.ComponentProps<'li'>) => (
  <li className="text-gray-800 dark:text-gray-200 m-0 p-0" {...props}>
    {children}
  </li>
);

/**
 * Custom blockquote renderer
 */
const BlockquoteRenderer = ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
  <blockquote
    className="border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300"
    style={{ margin: 0, paddingLeft: '4px', paddingTop: 0, paddingBottom: 0, paddingRight: 0 }}
    {...props}
  >
    {children}
  </blockquote>
);

/**
 * Custom link renderer with security features
 */
const LinkRenderer = ({
  href,
  children,
  onLinkClick,
  ...props
}: React.ComponentProps<'a'> & {
  onLinkClick?: (url: string, event: React.MouseEvent) => void;
}) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onLinkClick) {
        e.preventDefault();
        onLinkClick(href ?? '', e);
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
const InlineCodeRenderer = ({ children, ...props }: React.ComponentProps<'code'>) => (
  <code
    className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 rounded text-sm font-mono"
    {...props}
  >
    {children}
  </code>
);

// We will render both inline and block code via the `code` component mapping below.

/**
 * Custom horizontal rule renderer
 */
const HrRenderer = (props: React.ComponentProps<'hr'>) => (
  <hr className="border-gray-300 dark:border-gray-600 my-1" {...props} />
);

/**
 * Custom table renderer
 */
const TableRenderer = ({ children, ...props }: React.ComponentProps<'table'>) => (
  <div className="overflow-x-auto">
    <table
      className="min-w-full border-collapse border border-gray-300 dark:border-gray-600"
      {...props}
    >
      {children}
    </table>
  </div>
);

/**
 * Custom table head renderer
 */
const TheadRenderer = ({ children, ...props }: React.ComponentProps<'thead'>) => (
  <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
    {children}
  </thead>
);

/**
 * Custom table body renderer
 */
const TbodyRenderer = ({ children, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props}>
    {children}
  </tbody>
);

/**
 * Custom table row renderer
 */
const TrRenderer = ({ children, ...props }: React.ComponentProps<'tr'>) => (
  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800" {...props}>
    {children}
  </tr>
);

/**
 * Custom table cell renderers
 */
const ThRenderer = ({ children, ...props }: React.ComponentProps<'th'>) => (
  <th
    className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-800 font-semibold text-left"
    {...props}
  >
    {children}
  </th>
);

const TdRenderer = ({ children, ...props }: React.ComponentProps<'td'>) => (
  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-800 dark:text-gray-200" {...props}>
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
  sanitizeHtml = true,
  onLinkClick,
}) => {

  // Memoize sanitized content for performance
  const sanitizedContent = useMemo(() => {
    if (!content) {
      return '';
    }

    let result = content;
    
    if (sanitizeHtml) {
      result = DOMPurify.sanitize(result, SANITIZE_CONFIG);
    }

    return result;
  }, [content, sanitizeHtml]);

  // Memoize react-markdown options for performance
  const markdownOptions = useMemo((): Options => {
    const baseOptions: Options = {
      remarkPlugins: [remarkGfm, ...(options.remarkPlugins || [])],
      rehypePlugins: options.rehypePlugins || [],
      components: {
        p: ParagraphRenderer,
        // Headings
        h1: props => <HeadingRenderer level={1} {...props} />,
        h2: props => <HeadingRenderer level={2} {...props} />,
        h3: props => <HeadingRenderer level={3} {...props} />,
        h4: props => <HeadingRenderer level={4} {...props} />,
        h5: props => <HeadingRenderer level={5} {...props} />,
        h6: props => <HeadingRenderer level={6} {...props} />,

        // Lists
        ul: props => <ListRenderer ordered={false} {...props} />,
        ol: props => <ListRenderer ordered={true} {...props} />,
        li: ListItemRenderer,

        // Blockquote
        blockquote: BlockquoteRenderer,

        // Links
        a: props => <LinkRenderer onLinkClick={onLinkClick} {...props} />,

        // Pre element renderer to prevent double wrapping
        pre: ({ children, ...props }: any) => {
          // Extract the code element from children
          if (React.isValidElement(children)) {
            const codeElement = children as any;
            // Check if it's a code element with language
            if (codeElement.type === 'code' || codeElement.props?.className) {
              const match = /language-(\w+)/.exec(codeElement.props?.className || '');
              const language = match?.[1];
              
              // Extract the actual code text - it might be nested in various ways
              let codeText = '';
              if (typeof codeElement.props?.children === 'string') {
                codeText = codeElement.props.children;
              } else if (Array.isArray(codeElement.props?.children)) {
                codeText = codeElement.props.children.join('');
              } else if (codeElement.props?.children) {
                codeText = String(codeElement.props.children);
              }
              
              return (
                <CodeBlock
                  code={codeText}
                  language={language}
                  className="m-0"
                />
              );
            }
          }
          
          // Fallback for non-language code blocks
          return <pre {...props}>{children}</pre>;
        },
        
        // Code renderer for inline code only
        code: ({ children, ...props }: any) => {
          // Only handle inline code here, block code is handled by pre
          return <InlineCodeRenderer {...props}>{children}</InlineCodeRenderer>;
        },

        // Horizontal rule
        hr: HrRenderer,

        // Tables
        table: TableRenderer,
        thead: TheadRenderer,
        tbody: TbodyRenderer,
        tr: TrRenderer,
        th: ThRenderer,
        td: TdRenderer,

        // Override default components with custom ones
        ...(options.components || {}),
      },
      ...options,
    };

    return baseOptions;
  }, [options, onLinkClick]);

  // Handle empty content
  if (!sanitizedContent) {
    return (
      <div
        data-testid="markdown-renderer"
        role="article"
        className={cn('max-w-none', className)}
        aria-label="Empty content"
        style={{ padding: 0, margin: 0 }}
      />
    );
  }

  return (
    <div
      data-testid="markdown-renderer"
      role="article"
      className={cn(
        'max-w-none',
        'text-inherit', // Inherit text color from parent
        className
      )}
      aria-label="Markdown content"
      style={{
        padding: 0,
        margin: 0,
      }}
    >
      <ReactMarkdown {...markdownOptions}>{sanitizedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
