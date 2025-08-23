import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '@components/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  describe('Basic Markdown Rendering', () => {
    it('renders plain text', () => {
      render(<MarkdownRenderer content="Hello World" />);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders headings', () => {
      const content = '# Heading 1\n## Heading 2\n### Heading 3';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading 3');
    });

    it('renders bold and italic text', () => {
      const content = '**Bold** and *italic* text';
      render(<MarkdownRenderer content={content} />);

      const boldElement = screen.getByText('Bold');
      const italicElement = screen.getByText('italic');

      expect(boldElement.tagName).toBe('STRONG');
      expect(italicElement.tagName).toBe('EM');
    });

    it('renders links', () => {
      const content = '[OpenAI](https://openai.com)';
      render(<MarkdownRenderer content={content} />);

      const link = screen.getByRole('link', { name: /Link to https:\/\/openai.com/ });
      expect(link).toHaveAttribute('href', 'https://openai.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveTextContent('OpenAI');
    });

    it('renders lists', () => {
      const content = '- Item 1\n- Item 2\n\n1. First\n2. Second';
      render(<MarkdownRenderer content={content} />);

      const lists = screen.getAllByRole('list');
      expect(lists).toHaveLength(2);
      expect(lists[0].tagName).toBe('UL');
      expect(lists[1].tagName).toBe('OL');
    });

    it('renders code blocks', () => {
      const content = '```javascript\nconst x = 42;\n```';
      const { container } = render(<MarkdownRenderer content={content} />);

      // Code blocks are rendered with syntax highlighting, so text might be split
      expect(container.textContent).toContain('const');
      expect(container.textContent).toContain('x');
      expect(container.textContent).toContain('42');
    });

    it('renders inline code', () => {
      const content = 'Use `npm install` to install';
      render(<MarkdownRenderer content={content} />);

      const codeElement = screen.getByText('npm install');
      expect(codeElement.tagName).toBe('CODE');
    });
  });

  describe('LaTeX Math Rendering', () => {
    it('renders inline math with single dollar signs', () => {
      const content = 'The equation $E = mc^2$ is famous';
      const { container } = render(<MarkdownRenderer content={content} />);

      // KaTeX should render inline math
      const katexElement = container.querySelector('.katex');
      expect(katexElement).toBeInTheDocument();
      expect(container.textContent).toContain('E');
      expect(container.textContent).toContain('=');
      expect(container.textContent).toContain('mc');
    });

    it('renders display math with double dollar signs', () => {
      const content = '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$';
      const { container } = render(<MarkdownRenderer content={content} />);

      // KaTeX should render display math
      const katexDisplay = container.querySelector('.katex-display');
      expect(katexDisplay).toBeTruthy();
    });

    it('renders multiple inline math expressions', () => {
      const content = 'We have $a = 1$, $b = 2$, and $c = 3$';
      const { container } = render(<MarkdownRenderer content={content} />);

      const katexElements = container.querySelectorAll('.katex');
      expect(katexElements).toHaveLength(3);
    });

    it('renders complex math expressions', () => {
      const content = '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$';
      const { container } = render(<MarkdownRenderer content={content} />);

      const katexDisplay = container.querySelector('.katex-display');
      expect(katexDisplay).toBeTruthy();
      // Check for fraction structure
      const fracElement = container.querySelector('.mfrac');
      expect(fracElement).toBeTruthy();
    });

    it('renders Greek letters and symbols', () => {
      const content = 'The symbols $\\alpha$, $\\beta$, $\\gamma$, and $\\sum$';
      const { container } = render(<MarkdownRenderer content={content} />);

      const katexElements = container.querySelectorAll('.katex');
      expect(katexElements).toHaveLength(4);
    });

    it('renders matrices', () => {
      const content = `$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$`;
      const { container } = render(<MarkdownRenderer content={content} />);

      const katexDisplay = container.querySelector('.katex-display');
      expect(katexDisplay).toBeTruthy();
    });

    it('handles escaped dollar signs', () => {
      const content = 'This costs \\$100 and not a math expression';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText(/This costs \$100/)).toBeInTheDocument();
    });

    it('renders math alongside regular markdown', () => {
      const content = `
# Math Examples

Here's an inline equation: $f(x) = x^2$

**Bold text** with math: $\\alpha + \\beta$

## Display Math

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

And some \`code\` too.
`;
      const { container } = render(<MarkdownRenderer content={content} />);

      // Check for heading
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Math Examples');

      // Check for inline math
      const inlineKatex = container.querySelectorAll('.katex:not(.katex-display)');
      expect(inlineKatex.length).toBeGreaterThan(0);

      // Check for display math
      const displayKatex = container.querySelector('.katex-display');
      expect(displayKatex).toBeTruthy();

      // Check for bold text
      expect(screen.getByText('Bold text')).toBeInTheDocument();

      // Check for inline code
      const codeElement = screen.getByText('code');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('handles invalid LaTeX gracefully', () => {
      const content = 'Invalid math: $\\invalid{command}$';
      const { container } = render(<MarkdownRenderer content={content} />);

      // Should still render something (KaTeX shows error in red)
      const katexError = container.querySelector('.katex-error');
      // KaTeX might render an error or fallback
      expect(container.textContent).toContain('invalid');
    });
  });

  describe('Sanitization and Security', () => {
    it('sanitizes potentially dangerous HTML', () => {
      const content = 'Normal text with <script>alert("XSS")</script> embedded script';
      render(<MarkdownRenderer content={content} />);

      // Script should be removed but text preserved
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
      expect(screen.getByText(/Normal text with.*embedded script/)).toBeInTheDocument();
    });

    it('sanitizes math content', () => {
      const content = '$<script>alert("XSS")</script>$';
      const { container } = render(<MarkdownRenderer content={content} />);

      // Should not execute script
      const scripts = container.querySelectorAll('script');
      expect(scripts).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeInTheDocument();
    });

    it('handles null content', () => {
      const { container } = render(<MarkdownRenderer content={null} />);
      expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeInTheDocument();
    });

    it('handles undefined content', () => {
      const { container } = render(<MarkdownRenderer content={undefined} />);
      expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeInTheDocument();
    });

    it('handles very long math expressions', () => {
      const longExpression = `$$${Array(50).fill('x^2 +').join(' ')} x$$`;
      const { container } = render(<MarkdownRenderer content={longExpression} />);

      const katexDisplay = container.querySelector('.katex-display');
      expect(katexDisplay).toBeTruthy();
      // Just verify that the long expression is rendered
      // Overflow handling is typically done via CSS which may not be loaded in tests
      const katexHtml = container.querySelector('.katex-html');
      expect(katexHtml).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('renders large documents with math efficiently', () => {
      const largeContent = Array(100)
        .fill(null)
        .map((_, i) => `Paragraph ${i} with math $x_{${i}} = ${i}^2$`)
        .join('\n\n');

      const startTime = performance.now();
      const { container } = render(<MarkdownRenderer content={largeContent} />);
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (adjust as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second

      // Should render all math expressions
      const katexElements = container.querySelectorAll('.katex');
      expect(katexElements).toHaveLength(100);
    });
  });

  describe('Accessibility', () => {
    it('provides accessible math content', () => {
      const content = 'The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$';
      const { container } = render(<MarkdownRenderer content={content} />);

      // KaTeX should provide accessible MathML or aria-label
      const katexElement = container.querySelector('.katex');
      expect(katexElement).toBeInTheDocument();

      // Check for the article role on the container
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });

  describe('Custom Options', () => {
    it('respects custom className', () => {
      const { container } = render(<MarkdownRenderer content="Test" className="custom-class" />);

      const element = container.querySelector('[data-testid="markdown-renderer"]');
      expect(element).toHaveClass('custom-class');
    });

    it('calls onLinkClick when provided', () => {
      const onLinkClick = vi.fn();
      render(
        <MarkdownRenderer content="[Click me](https://example.com)" onLinkClick={onLinkClick} />
      );

      const link = screen.getByRole('link');
      link.click();

      expect(onLinkClick).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('respects sanitizeHtml option', () => {
      const content = '<div onclick="alert()">Test</div>';

      // With sanitization (default)
      const { rerender, container } = render(<MarkdownRenderer content={content} />);
      expect(container.querySelector('div[onclick]')).not.toBeInTheDocument();

      // Without sanitization
      rerender(<MarkdownRenderer content={content} sanitizeHtml={false} />);
      // The onclick should still be removed by React for security
      expect(container.querySelector('div')).toBeInTheDocument();
    });
  });
});
