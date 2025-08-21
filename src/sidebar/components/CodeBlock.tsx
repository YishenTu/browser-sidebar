import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@utils/cn';

// Lazy load Prism.js to avoid SSR issues
const loadPrism = async () => {
  if (typeof window === 'undefined') return null;

  const Prism = await import('prismjs');

  // Load common languages (with type assertions to avoid TS errors)
  await Promise.all([
    import('prismjs/components/prism-typescript'),
    import('prismjs/components/prism-python'),
    import('prismjs/components/prism-java'),
    import('prismjs/components/prism-css'),
  ]);

  return Prism.default;
};

// CodeBlock props interface
export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The code content to display */
  code: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to show word wrap toggle */
  showWordWrapToggle?: boolean;
  /** Optional filename to display in header */
  filename?: string;
  /** Custom CSS classes */
  className?: string;
}

/**
 * CodeBlock component with syntax highlighting and copy functionality
 *
 * Features:
 * - Syntax highlighting using Prism.js
 * - Copy-to-clipboard with visual feedback
 * - Language badge display
 * - Optional line numbers
 * - Theme support (light/dark)
 * - Word wrap toggle
 * - Filename display
 * - Scrollable for long code
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code="const hello = 'world';"
 *   language="javascript"
 *   showLineNumbers
 *   filename="example.js"
 * />
 * ```
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = false,
  showWordWrapToggle = false,
  filename,
  className,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string>('');

  // Generate line numbers for the code
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Handle syntax highlighting
  useEffect(() => {
    const highlightCode = async () => {
      if (!language) {
        setHighlightedCode(code);
        return;
      }

      try {
        const Prism = await loadPrism();
        if (Prism && Prism.languages[language]) {
          const highlighted = Prism.highlight(code, Prism.languages[language], language);
          setHighlightedCode(highlighted);
        } else {
          setHighlightedCode(code);
        }
      } catch (error) {
        // Fallback to plain text if highlighting fails
        setHighlightedCode(code);
      }
    };

    highlightCode();
  }, [code, language]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Handle copy failure silently
      console.warn('Failed to copy to clipboard:', error);
    }
  }, [code]);

  // Handle word wrap toggle
  const handleWordWrapToggle = useCallback(() => {
    setWordWrap(prev => !prev);
  }, []);

  // Handle keyboard events for copy button
  const handleCopyKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCopy();
    }
  };

  return (
    <div
      data-testid="code-block"
      className={cn(
        'relative rounded-lg border bg-gray-50 border-gray-200 overflow-hidden max-h-96 overflow-y-auto',
        'dark:bg-gray-800 dark:border-gray-600',
        className
      )}
      {...props}
    >
      {/* Header with filename, language badge, and controls */}
      <div
        data-testid="code-header"
        className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200 dark:bg-gray-700 dark:border-gray-600"
      >
        <div className="flex items-center gap-2">
          {filename && (
            <span
              data-testid="filename"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {filename}
            </span>
          )}
          {language && (
            <span
              data-testid="language-badge"
              className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded dark:text-gray-400 dark:bg-gray-600"
              aria-label={`Code language: ${language}`}
            >
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showWordWrapToggle && (
            <button
              data-testid="word-wrap-toggle"
              onClick={handleWordWrapToggle}
              className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600"
              aria-label={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
              title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </svg>
            </button>
          )}
          <button
            data-testid="copy-button"
            onClick={handleCopy}
            onKeyDown={handleCopyKeyDown}
            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600"
            aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Code content area */}
      <div className="relative flex">
        {/* Line numbers */}
        {showLineNumbers && (
          <div
            data-testid="line-numbers"
            className="flex-shrink-0 px-2 py-3 text-sm text-gray-500 bg-gray-100 border-r border-gray-200 select-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
          >
            {lineNumbers.map(num => (
              <div key={num} className="text-right leading-5">
                {num}
              </div>
            ))}
          </div>
        )}

        {/* Code content */}
        <div className="flex-1 overflow-x-auto">
          <pre
            data-testid="code-content"
            className={cn(
              'p-3 text-sm font-mono leading-5 text-gray-900 bg-transparent dark:text-gray-100',
              wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre',
              'overflow-x-auto'
            )}
            role="textbox"
            aria-label="Code block"
            aria-readonly="true"
            tabIndex={0}
          >
            {language && highlightedCode ? (
              <code
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                className={`language-${language}`}
              />
            ) : (
              <code>{code}</code>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;
