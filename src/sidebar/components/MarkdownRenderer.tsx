/**
 * @file MarkdownRenderer Component
 *
 * A comprehensive markdown renderer with syntax highlighting, LaTeX math rendering,
 * XSS protection, and custom styling for chat messages. Built on react-markdown with
 * KaTeX for math, rehype-highlight for syntax highlighting, and DOMPurify for sanitization.
 *
 * Features:
 * - Safe markdown rendering with XSS protection
 * - LaTeX math rendering (inline $ and display $$)
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
import remarkMath from 'remark-math';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
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
 * Create sanitization schema that allows KaTeX output safely
 */
const createSanitizeSchema = () => {
  const schema: typeof defaultSchema = { ...defaultSchema };

  if (!schema.attributes) schema.attributes = {};
  if (!schema.tagNames) schema.tagNames = [];

  // Allow global basic attributes
  const starAttrs: string[] = Array.isArray(schema.attributes['*'])
    ? [...(schema.attributes['*'] as string[])]
    : [];
  for (const attr of ['className', 'aria-hidden', 'role']) {
    if (!starAttrs.includes(attr)) starAttrs.push(attr);
  }
  schema.attributes['*'] = starAttrs;

  // Allow inline style only on span/div for KaTeX spacing
  for (const tag of ['span', 'div']) {
    const attrs = Array.isArray(schema.attributes[tag])
      ? [...(schema.attributes[tag] as string[])]
      : [];
    if (!attrs.includes('style')) attrs.push('style');
    if (!attrs.includes('className')) attrs.push('className');
    schema.attributes[tag] = attrs;
  }

  // Allow MathML tags used by KaTeX
  const mathTags = [
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'mroot',
    'msqrt',
    'mtable',
    'mtr',
    'mtd',
    'munder',
    'mover',
    'munderover',
    'annotation',
  ];
  for (const tag of mathTags) {
    if (!schema.tagNames.includes(tag)) schema.tagNames.push(tag);
  }

  // Minimal attributes for MathML
  const mathAttrs = Array.isArray(schema.attributes['math'])
    ? [...(schema.attributes['math'] as string[])]
    : [];
  for (const attr of ['display', 'xmlns']) {
    if (!mathAttrs.includes(attr)) mathAttrs.push(attr);
  }
  schema.attributes['math'] = mathAttrs;

  const annotationAttrs = Array.isArray(schema.attributes['annotation'])
    ? [...(schema.attributes['annotation'] as string[])]
    : [];
  if (!annotationAttrs.includes('encoding')) annotationAttrs.push('encoding');
  schema.attributes['annotation'] = annotationAttrs;

  return schema;
};

/**
 * Normalize display math $$...$$ outside of code segments safely
 */
const normalizeDisplayMathSafely = (input: string): string => {
  if (!input) return '';
  let text = input;

  // Protect fenced code blocks (```/~~~)
  const blockPlaceholders: string[] = [];
  text = text.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g, m => {
    const idx = blockPlaceholders.push(m) - 1;
    return `__MD_CODE_BLOCK_${idx}__`;
  });

  // Protect inline code (single backticks, no newline)
  const inlinePlaceholders: string[] = [];
  text = text.replace(/`[^`\n]*`/g, m => {
    const idx = inlinePlaceholders.push(m) - 1;
    return `__MD_CODE_INLINE_${idx}__`;
  });

  // Normalize display math: safely convert $$...$$ to block form without lookbehind
  {
    let i = 0;
    let result = '';
    const len = text.length;
    const ensureTwoNewlines = () => {
      if (result.endsWith('\n\n')) return '';
      if (result.endsWith('\n')) return '\n';
      return '\n\n';
    };

    while (i < len) {
      const ch = text[i];
      const next = i + 1 < len ? text[i + 1] : '';

      // Handle escapes
      if (ch === '\\') {
        result += ch;
        if (i + 1 < len) {
          result += text[i + 1];
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }

      // Detect opening $$
      if (ch === '$' && next === '$') {
        // Find closing $$
        let j = i + 2;
        let found = false;
        while (j < len) {
          if (text[j] === '\\') {
            j += 2;
            continue;
          }
          if (text[j] === '$' && j + 1 < len && text[j + 1] === '$') {
            found = true;
            break;
          }
          j += 1;
        }

        if (!found) {
          // No closing $$, treat literally
          result += ch;
          i += 1;
          continue;
        }

        const body = text.slice(i + 2, j).trim();
        result += ensureTwoNewlines() + '$$\n' + body + '\n$$\n\n';
        i = j + 2;
        continue;
      }

      // Default: copy char
      result += ch;
      i += 1;
    }

    text = result;
  }

  // Collapse excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Restore placeholders
  text = text.replace(/__MD_CODE_INLINE_(\d+)__/g, (_m, i) => inlinePlaceholders[Number(i)] || '');
  text = text.replace(/__MD_CODE_BLOCK_(\d+)__/g, (_m, i) => blockPlaceholders[Number(i)] || '');

  return text;
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
  // Keep markup minimal; spacing and typography handled in CSS
  return <Tag className="markdown-heading">{children}</Tag>;
};

/**
 * Custom paragraph renderer
 */
const ParagraphRenderer = ({ children, ...props }: React.ComponentProps<'p'>) => (
  <p className="markdown-p" {...props}>
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

  return <Tag {...props}>{children}</Tag>;
};

/**
 * Custom list item renderer
 */
const ListItemRenderer = ({ children, ...props }: React.ComponentProps<'li'>) => (
  <li className="markdown-li" {...props}>
    {children}
  </li>
);

/**
 * Custom blockquote renderer
 */
const BlockquoteRenderer = ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
  <blockquote className="markdown-blockquote" {...props}>
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
  <code {...props}>{children}</code>
);

// We will render both inline and block code via the `code` component mapping below.

/**
 * Custom horizontal rule renderer
 */
const HrRenderer = (props: React.ComponentProps<'hr'>) => <hr className="markdown-hr" {...props} />;

/**
 * Custom table renderer
 */
const TableRenderer = ({ children, ...props }: React.ComponentProps<'table'>) => (
  <div className="overflow-x-auto">
    <table {...props}>{children}</table>
  </div>
);

/**
 * Custom table head renderer
 */
const TheadRenderer = ({ children, ...props }: React.ComponentProps<'thead'>) => (
  <thead {...props}>{children}</thead>
);

/**
 * Custom table body renderer
 */
const TbodyRenderer = ({ children, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody {...props}>{children}</tbody>
);

/**
 * Custom table row renderer
 */
const TrRenderer = ({ children, ...props }: React.ComponentProps<'tr'>) => (
  <tr {...props}>{children}</tr>
);

/**
 * Custom table cell renderers
 */
const ThRenderer = ({ children, ...props }: React.ComponentProps<'th'>) => (
  <th {...props}>{children}</th>
);

const TdRenderer = ({ children, ...props }: React.ComponentProps<'td'>) => (
  <td {...props}>{children}</td>
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
  // Don't sanitize before markdown processing - it removes math delimiters!
  // We'll handle sanitization through rehype plugins instead
  const processedContent = useMemo(() => {
    if (!content) return '';
    return normalizeDisplayMathSafely(content);
  }, [content]);

  // Memoize sanitize schema
  const sanitizeSchema = useMemo(() => createSanitizeSchema(), []);

  // Memoize react-markdown options for performance
  const markdownOptions = useMemo((): Options => {
    const baseOptions: Options = {
      // Keep inline $...$ enabled for now to preserve behavior
      remarkPlugins: [
        remarkGfm,
        [remarkMath, { singleDollarTextMath: true }] as [
          typeof remarkMath,
          { singleDollarTextMath: boolean },
        ],
        ...(options.remarkPlugins || []),
      ],
      rehypePlugins: [
        // Render KaTeX first, then sanitize its output
        [
          rehypeKatex as typeof rehypeKatex,
          {
            throwOnError: false,
            strict: 'ignore',
            trust: false,
            errorColor: '#ef4444',
            output: 'html', // Only output HTML, not MathML
          },
        ],
        ...(sanitizeHtml
          ? [[rehypeSanitize, sanitizeSchema] as [typeof rehypeSanitize, typeof sanitizeSchema]]
          : []),
        ...(options.rehypePlugins || []),
      ],
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
        pre: ({ children, ...props }: React.HTMLProps<HTMLPreElement>) => {
          // Extract the code element from children
          if (React.isValidElement(children)) {
            const codeElement = children as React.ReactElement<{
              className?: string;
              children?: React.ReactNode;
            }>;
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

              return <CodeBlock code={codeText} language={language} />;
            }
          }

          // Fallback for non-language code blocks
          return <pre {...props}>{children}</pre>;
        },

        // Code renderer for inline code only
        code: ({ children, ...props }: React.HTMLProps<HTMLElement>) => {
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
  }, [options, onLinkClick, sanitizeHtml, sanitizeSchema]);

  // Handle empty content
  if (!processedContent) {
    return (
      <div
        data-testid="markdown-renderer"
        role="article"
        className={`markdown-renderer${className ? ` ${className}` : ''}`}
        aria-label="Empty content"
      />
    );
  }

  return (
    <div
      data-testid="markdown-renderer"
      role="article"
      className={`markdown-renderer${className ? ` ${className}` : ''}`}
      aria-label="Markdown content"
    >
      <ReactMarkdown {...markdownOptions}>{processedContent}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
