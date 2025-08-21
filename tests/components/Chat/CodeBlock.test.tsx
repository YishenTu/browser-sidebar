import { render, screen, waitFor } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeAll, beforeEach, test, expect } from 'vitest';
import { CodeBlock } from '@/sidebar/components/CodeBlock';

// Mock clipboard API
const mockWriteText = vi.fn();

// Mock Prism.js modules
vi.mock('prismjs', () => ({
  default: {
    highlight: vi.fn((code: string, _grammar: any, language: string) => {
      return `<span class="token ${language}">${code}</span>`;
    }),
    languages: {
      javascript: {},
      typescript: {},
      python: {},
      java: {},
      css: {},
      html: {},
    },
  },
}));

vi.mock('prismjs/components/prism-typescript', () => ({}));
vi.mock('prismjs/components/prism-python', () => ({}));
vi.mock('prismjs/components/prism-java', () => ({}));
vi.mock('prismjs/components/prism-css', () => ({}));

describe('CodeBlock', () => {
  const mockUser = userEvent.setup();

  beforeAll(() => {
    // Setup clipboard mock
    vi.stubGlobal('navigator', {
      ...global.navigator,
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset clipboard mock
    mockWriteText.mockResolvedValue(undefined);
  });

  describe('Basic Rendering', () => {
    test('renders code with JavaScript syntax highlighting', () => {
      const code = 'const message = "Hello World";';
      render(<CodeBlock code={code} language="javascript" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveTextContent(code);
    });

    test('renders code with TypeScript syntax highlighting', () => {
      const code = 'interface User { name: string; }';
      render(<CodeBlock code={code} language="typescript" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveTextContent(code);
    });

    test('renders code with Python syntax highlighting', () => {
      const code = 'def hello_world():\n    print("Hello World")';
      render(<CodeBlock code={code} language="python" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      // Check that the code content contains the function definition and print statement
      expect(codeElement).toHaveTextContent('def hello_world():');
      expect(codeElement).toHaveTextContent('print("Hello World")');
    });

    test('handles unknown language gracefully', () => {
      const code = 'some unknown code';
      render(<CodeBlock code={code} language="unknown" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveTextContent(code);
    });

    test('renders without language (plain text)', () => {
      const code = 'plain text content';
      render(<CodeBlock code={code} />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveTextContent(code);
    });
  });

  describe('Language Badge', () => {
    test('displays language badge when language is provided', () => {
      render(<CodeBlock code="test" language="javascript" />);

      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toBeInTheDocument();
      expect(languageBadge).toHaveTextContent('javascript');
    });

    test('does not display language badge when no language provided', () => {
      render(<CodeBlock code="test" />);

      expect(screen.queryByTestId('language-badge')).not.toBeInTheDocument();
    });

    test('displays custom language names correctly', () => {
      render(<CodeBlock code="test" language="js" />);

      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toHaveTextContent('js');
    });
  });

  describe('Copy Functionality', () => {
    test('renders copy button', () => {
      render(<CodeBlock code="test code" />);

      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');
    });

    test('copies code to clipboard when copy button is clicked', async () => {
      const code = 'const test = "copy me";';
      render(<CodeBlock code={code} />);

      const copyButton = screen.getByTestId('copy-button');

      // Verify initial state
      expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');

      await mockUser.click(copyButton);

      // Wait for the success state to appear, which proves copy was called
      await waitFor(() => {
        expect(copyButton).toHaveAttribute('aria-label', 'Code copied to clipboard');
      });

      // Check that writeText was called
      expect(mockWriteText).toHaveBeenCalledWith(code);
    });

    test('shows copy success feedback', async () => {
      render(<CodeBlock code="test" />);

      const copyButton = screen.getByTestId('copy-button');
      await mockUser.click(copyButton);

      // Should show success state briefly
      expect(copyButton).toHaveAttribute('aria-label', 'Code copied to clipboard');

      // Wait for the success state to reset
      await waitFor(
        () => {
          expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');
        },
        { timeout: 2500 }
      );
    });

    test('handles copy failure gracefully', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Copy failed'));

      render(<CodeBlock code="test" />);

      const copyButton = screen.getByTestId('copy-button');
      await mockUser.click(copyButton);

      // Should still show the button without crashing
      expect(copyButton).toBeInTheDocument();
    });

    test('copy button is keyboard accessible', async () => {
      render(<CodeBlock code="test code" />);

      const copyButton = screen.getByTestId('copy-button');
      copyButton.focus();

      await mockUser.keyboard('{Enter}');

      // Wait for any async operations to complete
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('test code');
      });
    });
  });

  describe('Line Numbers', () => {
    test('does not show line numbers by default', () => {
      const code = 'line 1\nline 2\nline 3';
      render(<CodeBlock code={code} />);

      expect(screen.queryByTestId('line-numbers')).not.toBeInTheDocument();
    });

    test('shows line numbers when showLineNumbers is true', () => {
      const code = 'line 1\nline 2\nline 3';
      render(<CodeBlock code={code} showLineNumbers />);

      const lineNumbers = screen.getByTestId('line-numbers');
      expect(lineNumbers).toBeInTheDocument();

      // Check that line numbers are displayed for each line
      expect(lineNumbers).toHaveTextContent('1');
      expect(lineNumbers).toHaveTextContent('2');
      expect(lineNumbers).toHaveTextContent('3');
    });

    test('line numbers align with code lines', () => {
      const code = 'function test() {\n  return "hello";\n}';
      render(<CodeBlock code={code} showLineNumbers />);

      const lineNumbers = screen.getByTestId('line-numbers');
      const codeContent = screen.getByTestId('code-content');

      expect(lineNumbers).toBeInTheDocument();
      expect(codeContent).toBeInTheDocument();
    });
  });

  describe('Filename Display', () => {
    test('does not show filename when not provided', () => {
      render(<CodeBlock code="test" />);

      expect(screen.queryByTestId('filename')).not.toBeInTheDocument();
    });

    test('displays filename when provided', () => {
      render(<CodeBlock code="test" filename="example.js" />);

      const filename = screen.getByTestId('filename');
      expect(filename).toBeInTheDocument();
      expect(filename).toHaveTextContent('example.js');
    });

    test('filename is positioned in header area', () => {
      render(<CodeBlock code="test" filename="example.js" />);

      const header = screen.getByTestId('code-header');
      const filename = screen.getByTestId('filename');

      expect(header).toContainElement(filename);
    });
  });

  describe('Word Wrap Toggle', () => {
    test('does not show word wrap toggle by default', () => {
      render(<CodeBlock code="test" />);

      expect(screen.queryByTestId('word-wrap-toggle')).not.toBeInTheDocument();
    });

    test('shows word wrap toggle when showWordWrapToggle is true', () => {
      render(<CodeBlock code="test" showWordWrapToggle />);

      const toggle = screen.getByTestId('word-wrap-toggle');
      expect(toggle).toBeInTheDocument();
    });

    test('toggles word wrap when clicked', async () => {
      render(
        <CodeBlock
          code="very long line that should wrap when word wrap is enabled"
          showWordWrapToggle
        />
      );

      const toggle = screen.getByTestId('word-wrap-toggle');
      const codeContent = screen.getByTestId('code-content');

      // Initially should not have word wrap
      expect(codeContent).not.toHaveClass('whitespace-pre-wrap');

      await mockUser.click(toggle);

      // Should now have word wrap
      expect(codeContent).toHaveClass('whitespace-pre-wrap');

      await mockUser.click(toggle);

      // Should toggle back
      expect(codeContent).not.toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('Theme Support', () => {
    test('applies light theme classes by default', () => {
      render(<CodeBlock code="test" />);

      const container = screen.getByTestId('code-block');
      expect(container).toHaveClass('bg-gray-50', 'border-gray-200');
    });

    test('applies dark theme classes when theme is dark', () => {
      // Mock theme context or prop
      render(
        <div data-theme="dark">
          <CodeBlock code="test" />
        </div>
      );

      const container = screen.getByTestId('code-block');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Scrolling and Long Code', () => {
    test('applies scrollable styles for long code', () => {
      const longCode = 'const veryLongLine = '.repeat(50) + '"test";';
      render(<CodeBlock code={longCode} />);

      const codeContent = screen.getByTestId('code-content');
      expect(codeContent).toHaveClass('overflow-x-auto');
    });

    test('handles multiline code with proper scrolling', () => {
      const multilineCode = Array(20).fill('console.log("line");').join('\n');
      render(<CodeBlock code={multilineCode} />);

      const container = screen.getByTestId('code-block');
      expect(container).toHaveClass('max-h-96', 'overflow-y-auto');
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<CodeBlock code="test" language="javascript" />);

      const codeElement = screen.getByRole('textbox');
      expect(codeElement).toHaveAttribute('aria-label', 'Code block');
      expect(codeElement).toHaveAttribute('aria-readonly', 'true');
    });

    test('code is keyboard navigable', () => {
      render(<CodeBlock code="test code" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toHaveAttribute('tabIndex', '0');
    });

    test('provides screen reader friendly code content', () => {
      const code = 'function test() { return "hello"; }';
      render(<CodeBlock code={code} language="javascript" />);

      const codeElement = screen.getByRole('textbox');
      expect(codeElement).toHaveTextContent(code);
    });

    test('language information is accessible', () => {
      render(<CodeBlock code="test" language="javascript" />);

      const languageBadge = screen.getByTestId('language-badge');
      expect(languageBadge).toHaveAttribute('aria-label', 'Code language: javascript');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty code', () => {
      render(<CodeBlock code="" />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveTextContent('');
    });

    test('handles code with special characters', () => {
      const code = 'const test = "Hello <>&\\"World\\"";';
      render(<CodeBlock code={code} />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toHaveTextContent(code);
    });

    test('handles very long single line', () => {
      const longLine = 'a'.repeat(1000);
      render(<CodeBlock code={longLine} />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveClass('overflow-x-auto');
    });

    test('handles code with tabs and mixed whitespace', () => {
      const code = '\tfunction test() {\n\t\treturn "hello";\n\t}';
      render(<CodeBlock code={code} />);

      const codeElement = screen.getByTestId('code-content');
      expect(codeElement).toBeInTheDocument();
      // Check that the code contains the function and return statement
      expect(codeElement).toHaveTextContent('function test()');
      expect(codeElement).toHaveTextContent('return "hello"');
    });
  });

  describe('Custom Props', () => {
    test('accepts custom className', () => {
      render(<CodeBlock code="test" className="custom-class" />);

      const container = screen.getByTestId('code-block');
      expect(container).toHaveClass('custom-class');
    });

    test('forwards additional props', () => {
      render(<CodeBlock code="test" data-custom="value" />);

      const container = screen.getByTestId('code-block');
      expect(container).toHaveAttribute('data-custom', 'value');
    });
  });
});
