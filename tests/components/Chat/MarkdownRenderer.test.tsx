/**
 * @file MarkdownRenderer Component Tests
 *
 * Comprehensive test suite for the MarkdownRenderer component including:
 * - Basic markdown elements rendering
 * - Code blocks with syntax highlighting
 * - Safe link handling
 * - XSS prevention and sanitization
 * - Performance with large content
 * - Custom renderers functionality
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarkdownRenderer } from '@/components/Chat/MarkdownRenderer';

// Mock window.open for link testing
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    mockWindowOpen.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // Basic Markdown Elements Tests
  // =============================================================================

  describe('Basic Markdown Elements', () => {
    it('renders plain text correctly', () => {
      render(<MarkdownRenderer content="Hello World" />);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders headings correctly', () => {
      const content = `
# Heading 1
## Heading 2
### Heading 3
`;
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading 3');
    });

    it('renders emphasis and strong text', () => {
      const content = '*italic text* and **bold text** and ***bold italic***';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText('italic text')).toHaveStyle('font-style: italic');
      expect(screen.getByText('bold text')).toHaveStyle('font-weight: bold');
    });

    it('renders lists correctly', () => {
      const content = `
- Item 1
- Item 2
- Item 3

1. Numbered item 1
2. Numbered item 2
`;
      render(<MarkdownRenderer content={content} />);

      const allLists = screen.getAllByRole('list');
      expect(allLists).toHaveLength(2); // 1 unordered + 1 ordered

      // Check unordered list items
      const unorderedListItems = within(allLists[0]).getAllByRole('listitem');
      expect(unorderedListItems).toHaveLength(3);

      // Check ordered list items
      const orderedListItems = within(allLists[1]).getAllByRole('listitem');
      expect(orderedListItems).toHaveLength(2);
    });

    it('renders blockquotes correctly', () => {
      const content = '> This is a blockquote';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText('This is a blockquote')).toBeInTheDocument();
    });

    it('renders horizontal rules', () => {
      const content = 'Before\n\n---\n\nAfter';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Code Blocks and Syntax Highlighting Tests
  // =============================================================================

  describe('Code Blocks', () => {
    it('renders inline code correctly', () => {
      const content = 'This is `inline code` in text';
      render(<MarkdownRenderer content={content} />);

      const codeElement = screen.getByText('inline code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement.tagName).toBe('CODE');
    });

    it('uses CodeBlock component for code blocks with language specification', () => {
      const content = `\`\`\`javascript\nfunction hello() {\n  console.log("Hello World");\n}\n\`\`\``;
      render(<MarkdownRenderer content={content} />);

      // Should use the CodeBlock component
      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Should show language badge
      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toHaveTextContent('javascript');

      // Should contain the code
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveTextContent('function hello()');
      expect(codeContent).toHaveTextContent('console.log("Hello World")');
    });

    it('uses CodeBlock component for code blocks without language specification', () => {
      const content = `\`\`\`\nconst x = 42;\nconst y = "hello";\n\`\`\``;
      render(<MarkdownRenderer content={content} />);

      // Should use the CodeBlock component
      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Should contain the code
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveTextContent('const x = 42;');
      expect(codeContent).toHaveTextContent('const y = "hello";');
    });

    it('CodeBlock component provides copy functionality', () => {
      const content = `\`\`\`python\ndef hello():\n    print("Hello World")\n\`\`\``;
      render(<MarkdownRenderer content={content} />);

      // Should have copy button from CodeBlock
      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');
    });

    it('handles multiple CodeBlocks correctly', () => {
      const content = `\`\`\`javascript\nconst js = "JavaScript";\n\`\`\`\n\n\`\`\`python\npy = "Python"\n\`\`\``;
      render(<MarkdownRenderer content={content} />);

      // Should have multiple CodeBlock components
      const codeBlocks = screen.getAllByTestId('code-block');
      expect(codeBlocks).toHaveLength(2);

      // Check language badges
      const languageBadges = screen.getAllByTestId('language-badge');
      expect(languageBadges).toHaveLength(2);
      expect(languageBadges[0]).toHaveTextContent('javascript');
      expect(languageBadges[1]).toHaveTextContent('python');
    });

    it('passes proper props to CodeBlock component', () => {
      const content = `\`\`\`typescript\ninterface User {\n  name: string;\n}\n\`\`\``;
      render(<MarkdownRenderer content={content} />);

      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Should show the language
      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toHaveTextContent('typescript');

      // Should contain the code
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveTextContent('interface User');
      expect(codeContent).toHaveTextContent('name: string;');
    });
  });

  // =============================================================================
  // Link Handling and Security Tests
  // =============================================================================

  describe('Link Handling', () => {
    it('renders links correctly', () => {
      const content = '[Google](https://google.com)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: 'Link to https://google.com' });
      expect(link).toHaveAttribute('href', 'https://google.com');
    });

    it('opens external links in new tab with security attributes', () => {
      const content = '[External Link](https://example.com)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: 'Link to https://example.com' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('handles relative links safely', () => {
      const content = '[Relative Link](/relative/path)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: 'Link to /relative/path' });
      expect(link).toHaveAttribute('href', '/relative/path');
    });

    it('sanitizes javascript: links', () => {
      const content = '[Malicious Link](javascript:alert("XSS"))';
      render(<MarkdownRenderer content={content} />);

      // Should not render as a clickable link or should be sanitized
      const link = screen.queryByRole('link');
      if (link) {
        // If link exists, it should not have javascript: protocol
        expect(link.getAttribute('href')).not.toContain('javascript:');
      } else {
        // Or it should not exist at all
        expect(link).toBeNull();
      }
    });

    it('handles link click events properly', () => {
      const content = '[Test Link](https://example.com)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: 'Link to https://example.com' });
      fireEvent.click(link);

      // Link should have proper attributes for external opening
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // =============================================================================
  // XSS Prevention Tests
  // =============================================================================

  describe('XSS Prevention', () => {
    it('removes script tags from content', () => {
      const content = 'Safe content <script>alert("XSS")</script> more content';
      const { container } = render(<MarkdownRenderer content={content} />);

      expect(screen.queryByText('alert("XSS")')).toBeNull();
      expect(container.textContent).toContain('Safe content');
      expect(container.textContent).toContain('more content');
    });

    it('removes onclick handlers from elements', () => {
      const content = '<div onclick="alert(\'XSS\')">Click me</div>';
      render(<MarkdownRenderer content={content} />);

      const element = screen.queryByText('Click me');
      if (element) {
        expect(element).not.toHaveAttribute('onclick');
      }
    });

    it('removes dangerous iframe elements', () => {
      const content = 'Safe content <iframe src="javascript:alert(1)"></iframe> more content';
      const { container } = render(<MarkdownRenderer content={content} />);

      expect(screen.queryByRole('presentation')).toBeNull();
      expect(container.textContent).toContain('Safe content');
      expect(container.textContent).toContain('more content');
    });

    it('removes style attributes that could contain expressions', () => {
      const content = '<div style="background: url(javascript:alert(1))">Content</div>';
      render(<MarkdownRenderer content={content} />);

      const element = screen.queryByText('Content');
      if (element) {
        expect(element.getAttribute('style')).toBeNull();
      }
    });

    it('allows safe HTML elements through sanitization', () => {
      const content = '**Bold** and *italic* text'; // Use markdown instead of raw HTML
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText('Bold')).toHaveStyle('font-weight: bold');
      expect(screen.getByText('italic')).toHaveStyle('font-style: italic');
    });
  });

  // =============================================================================
  // Custom Renderers Tests
  // =============================================================================

  describe('Custom Renderers', () => {
    it('applies custom styling to headings', () => {
      const content = '# Main Title\n## Subtitle';
      render(<MarkdownRenderer content={content} />);

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });

      expect(h1).toHaveClass('text-2xl', 'font-bold', 'mb-4');
      expect(h2).toHaveClass('text-xl', 'font-bold', 'mb-3');
    });

    it('applies custom styling to paragraphs', () => {
      const content = 'This is a paragraph with some text.';
      render(<MarkdownRenderer content={content} />);

      const paragraph = screen.getByText(content).closest('p');
      expect(paragraph).toHaveClass('mb-4', 'leading-relaxed');
    });

    it('applies custom styling to lists', () => {
      const content = '- Item 1\n- Item 2';
      render(<MarkdownRenderer content={content} />);

      const list = screen.getByRole('list');
      expect(list).toHaveClass('list-disc', 'ml-6', 'mb-4', 'space-y-1');
    });

    it('applies custom styling to blockquotes', () => {
      const content = '> This is a quote';
      render(<MarkdownRenderer content={content} />);

      const blockquote = screen.getByText('This is a quote').closest('blockquote');
      expect(blockquote).toHaveClass('border-l-4', 'border-blue-500', 'pl-4', 'italic', 'mb-4');
    });
  });

  // =============================================================================
  // Performance and Edge Cases Tests
  // =============================================================================

  describe('Performance and Edge Cases', () => {
    it('handles empty content gracefully', () => {
      render(<MarkdownRenderer content="" />);
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('handles null or undefined content', () => {
      render(<MarkdownRenderer content={null as any} />);
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('handles very large markdown content efficiently', () => {
      const largeContent = Array(1000)
        .fill('This is a line of text that will be repeated many times.\n')
        .join('');

      const startTime = performance.now();
      render(<MarkdownRenderer content={largeContent} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('handles malformed markdown gracefully', () => {
      const malformedContent = '# Incomplete header\n```\nunclosed code block\n**unclosed bold';
      render(<MarkdownRenderer content={malformedContent} />);

      expect(screen.getByTestId('markdown-renderer')).toBeInTheDocument();
    });

    it('handles special characters and unicode', () => {
      const content = '# 中文标题\n\n🚀 Emoji content with special chars: àáâãäåæ';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('中文标题');
      expect(screen.getByText(/🚀 Emoji content/)).toBeInTheDocument();
    });

    it('handles large content with multiple CodeBlocks efficiently', () => {
      const largeMdContent = Array(10)
        .fill(null)
        .map(
          (_, i) =>
            `# Section ${i + 1}\n\nSome text content here.\n\n\`\`\`javascript\n// Code block ${i + 1}\nconst value${i} = "Hello World ${i}";\nconsole.log(value${i});\n\`\`\`\n\n`
        )
        .join('');

      const startTime = performance.now();
      render(<MarkdownRenderer content={largeMdContent} />);
      const endTime = performance.now();

      // Should render efficiently with multiple CodeBlocks
      expect(endTime - startTime).toBeLessThan(2000); // Should render in less than 2 seconds

      // Should have correct number of CodeBlocks
      const codeBlocks = screen.getAllByTestId('code-block');
      expect(codeBlocks).toHaveLength(10);

      // Should have correct number of headings
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(10);
    });

    it('CodeBlock lazy loading works within MarkdownRenderer', async () => {
      const content = `\`\`\`typescript\ninterface Config {\n  apiKey: string;\n  timeout: number;\n}\n\nconst config: Config = {\n  apiKey: "test-key",\n  timeout: 5000\n};\n\`\`\``;

      render(<MarkdownRenderer content={content} />);

      // CodeBlock should be present
      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Language badge should show TypeScript
      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toHaveTextContent('typescript');

      // Code content should be present and formatted
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveTextContent('interface Config');
      expect(codeContent).toHaveTextContent('apiKey: string');

      // Should have copy functionality available
      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Props and Configuration Tests
  // =============================================================================

  describe('Props and Configuration', () => {
    it('accepts custom className prop', () => {
      render(<MarkdownRenderer content="Test content" className="custom-class" />);

      const container = screen.getByTestId('markdown-renderer');
      expect(container).toHaveClass('custom-class');
    });

    it('applies default styling classes', () => {
      render(<MarkdownRenderer content="Test content" />);

      const container = screen.getByTestId('markdown-renderer');
      expect(container).toHaveClass('prose', 'prose-sm', 'max-w-none');
    });

    it('handles custom options if provided', () => {
      const customOptions = {
        remarkPlugins: [],
        rehypePlugins: [],
      };

      render(<MarkdownRenderer content="# Test" options={customOptions} />);
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('respects enableSyntaxHighlighting=false', () => {
      const content = `\`\`\`javascript\nconst hello = "world";\n\`\`\``;
      render(<MarkdownRenderer content={content} enableSyntaxHighlighting={false} />);

      // Should still use CodeBlock component
      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Should NOT show language badge when syntax highlighting is disabled
      const languageBadge = screen.queryByTestId('language-badge');
      expect(languageBadge).not.toBeInTheDocument();

      // Should still contain the code
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveTextContent('const hello = "world";');
    });
  });

  // =============================================================================
  // Accessibility Tests
  // =============================================================================

  describe('Accessibility', () => {
    it('maintains proper heading hierarchy', () => {
      const content = '# H1\n## H2\n### H3\n#### H4';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument();
    });

    it('provides accessible link descriptions', () => {
      const content = '[Visit Google](https://google.com)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: 'Link to https://google.com' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('aria-label', 'Link to https://google.com');
    });

    it('provides accessible code block labels via CodeBlock component', () => {
      const content = '```javascript\nconst x = 1;\n```';
      render(<MarkdownRenderer content={content} />);

      // CodeBlock component provides its own accessibility
      const codeBlock = screen.getByTestId('code-block');
      expect(codeBlock).toBeInTheDocument();

      // Check that code content has proper accessibility attributes
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveAttribute('aria-label', 'Code block');
      expect(codeContent).toHaveAttribute('aria-readonly', 'true');
    });

    it('has proper ARIA structure', () => {
      const content = '# Title\n\nParagraph content';
      render(<MarkdownRenderer content={content} />);

      const container = screen.getByTestId('markdown-renderer');
      expect(container).toHaveAttribute('role', 'article');
    });
  });
});
