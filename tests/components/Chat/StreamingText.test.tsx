import { render, screen, waitFor } from '@tests/utils/test-utils';
import { vi, beforeEach, afterEach } from 'vitest';
import { StreamingText } from '@/components/Chat/StreamingText';

// Mock requestAnimationFrame for testing
const mockRequestAnimationFrame = vi.fn();
const mockCancelAnimationFrame = vi.fn();

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);

  // Mock RAF to execute immediately for testing
  mockRequestAnimationFrame.mockImplementation((callback: FrameRequestCallback) => {
    const id = Math.random();
    setTimeout(() => callback(performance.now()), 0);
    return id;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StreamingText', () => {
  describe('Token-by-token rendering', () => {
    test('starts with empty content and streams text progressively', async () => {
      const text = 'Hello world this is a test';

      render(
        <StreamingText
          text={text}
          isStreaming={true}
          speed={10} // Fast speed for testing
        />
      );

      const container = screen.getByTestId('streaming-text');

      // Wait for streaming to start and cursor to appear
      await waitFor(() => {
        expect(container.textContent).toContain('|');
      });

      // Wait for some text to appear (first token)
      await waitFor(() => {
        const content = container.textContent?.replace('|', '').trim();
        expect(content).not.toBe('');
      });

      // Should not immediately show full text
      const finalContent = container.textContent?.replace('|', '').trim();
      expect(finalContent).not.toBe(text);
    });

    test('renders text token by token with configurable speed', async () => {
      const text = 'Hello world';
      const tokens = text.split(' ');

      render(<StreamingText text={text} isStreaming={true} speed={50} />);

      const container = screen.getByTestId('streaming-text');

      // Wait for first token
      await waitFor(() => {
        expect(container.textContent).toContain(tokens[0]);
      });

      // Should eventually show full text
      await waitFor(
        () => {
          expect(container.textContent).toBe(text);
        },
        { timeout: 2000 }
      );
    });

    test('handles single character tokens correctly', async () => {
      const text = 'ABC';

      render(<StreamingText text={text} isStreaming={true} speed={10} tokenizeBy="character" />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toContain('A');
      });

      await waitFor(() => {
        expect(container.textContent).toBe('ABC');
      });
    });

    test('handles empty text gracefully', async () => {
      render(<StreamingText text="" isStreaming={true} speed={10} />);

      const container = screen.getByTestId('streaming-text');
      expect(container.textContent).toBe('');

      // Cursor should not appear for empty text
      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });
  });

  describe('Cursor animation', () => {
    test('shows blinking cursor during streaming', () => {
      render(<StreamingText text="Hello world" isStreaming={true} speed={100} />);

      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor).toBeInTheDocument();
      expect(cursor).toHaveClass('animate-pulse');
    });

    test('hides cursor when not streaming', () => {
      render(<StreamingText text="Hello world" isStreaming={false} speed={100} />);

      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });

    test('cursor is visible during streaming process', async () => {
      render(<StreamingText text="Hello world" isStreaming={true} speed={50} />);

      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor).toBeInTheDocument();

      // Cursor should remain visible during streaming
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cursor).toBeInTheDocument();
    });

    test('cursor has correct accessibility attributes', () => {
      render(<StreamingText text="Hello world" isStreaming={true} speed={100} />);

      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Completion detection', () => {
    test('calls onComplete when streaming finishes', async () => {
      const onComplete = vi.fn();
      const text = 'Hello';

      render(<StreamingText text={text} isStreaming={true} speed={10} onComplete={onComplete} />);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(text);
      });
    });

    test('does not call onComplete if not streaming', () => {
      const onComplete = vi.fn();

      render(
        <StreamingText text="Hello world" isStreaming={false} speed={100} onComplete={onComplete} />
      );

      expect(onComplete).not.toHaveBeenCalled();
    });

    test('calls onComplete only once per streaming session', async () => {
      const onComplete = vi.fn();
      const text = 'Hello';

      const { rerender } = render(
        <StreamingText text={text} isStreaming={true} speed={10} onComplete={onComplete} />
      );

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });

      // Rerender with same text - should not call onComplete again
      rerender(<StreamingText text={text} isStreaming={true} speed={10} onComplete={onComplete} />);

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test('detects when text is fully rendered', async () => {
      const text = 'Hello world';

      render(<StreamingText text={text} isStreaming={true} speed={10} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(text);
      });

      // Cursor should be hidden when complete
      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });
  });

  describe('Performance with large text blocks', () => {
    test('handles large text efficiently without blocking UI', async () => {
      const largeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);
      const startTime = performance.now();

      render(
        <StreamingText
          text={largeText}
          isStreaming={true}
          speed={1} // Very fast for testing
        />
      );

      const container = screen.getByTestId('streaming-text');

      // Should start rendering quickly
      await waitFor(() => {
        expect(container.textContent).not.toBe('');
      });

      const renderTime = performance.now() - startTime;
      // Should not take more than 100ms to start rendering
      expect(renderTime).toBeLessThan(100);
    });

    test('uses requestAnimationFrame for smooth animation', () => {
      render(<StreamingText text="Hello world" isStreaming={true} speed={50} />);

      expect(mockRequestAnimationFrame).toHaveBeenCalled();
    });

    test('cancels animation frame on unmount', () => {
      const { unmount } = render(
        <StreamingText text="Hello world" isStreaming={true} speed={50} />
      );

      unmount();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Markdown content support', () => {
    test('preserves markdown formatting in streamed text', async () => {
      const markdownText = '**Bold text** and *italic text*';

      render(
        <StreamingText text={markdownText} isStreaming={true} speed={10} preserveMarkdown={true} />
      );

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(markdownText);
      });
    });

    test('handles code blocks in markdown', async () => {
      const codeText = '```javascript\nconsole.log("hello");\n```';

      render(
        <StreamingText text={codeText} isStreaming={true} speed={10} preserveMarkdown={true} />
      );

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toContain('console.log');
      });
    });
  });

  describe('Component lifecycle and cleanup', () => {
    test('cleans up animation frames on unmount', () => {
      const { unmount } = render(
        <StreamingText text="Hello world" isStreaming={true} speed={50} />
      );

      unmount();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    test('stops streaming when isStreaming becomes false', async () => {
      const { rerender } = render(
        <StreamingText text="Hello world" isStreaming={true} speed={100} />
      );

      const container = screen.getByTestId('streaming-text');

      // Wait for some text to appear (excluding cursor)
      await waitFor(() => {
        const textContent = container.textContent?.replace('|', '') || '';
        expect(textContent.trim()).not.toBe('');
      });

      // const partialTextWithCursor = container.textContent || '';
      // const partialText = partialTextWithCursor.replace('|', '');

      // Stop streaming
      rerender(<StreamingText text="Hello world" isStreaming={false} speed={100} />);

      // When not streaming, it should show the full text
      expect(container.textContent).toBe('Hello world');
      expect(screen.queryByTestId('streaming-cursor')).not.toBeInTheDocument();
    });

    test('handles prop changes during streaming', async () => {
      const { rerender } = render(<StreamingText text="Hello" isStreaming={true} speed={100} />);

      // Change text while streaming
      rerender(<StreamingText text="Hello world" isStreaming={true} speed={100} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe('Hello world');
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA attributes', () => {
      render(<StreamingText text="Hello world" isStreaming={true} speed={100} />);

      const container = screen.getByTestId('streaming-text');
      expect(container).toHaveAttribute('role', 'status');
      expect(container).toHaveAttribute('aria-live', 'polite');
    });

    test('announces completion to screen readers', async () => {
      const text = 'Message complete';

      render(<StreamingText text={text} isStreaming={true} speed={10} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(text);
      });

      // Should have aria-live="polite" for announcements
      expect(container).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Edge cases', () => {
    test('handles very long single words', async () => {
      const longWord = 'a'.repeat(1000);

      render(<StreamingText text={longWord} isStreaming={true} speed={1} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(longWord);
      });
    });

    test('handles special characters correctly', async () => {
      const specialText = 'Hello 🌟 world! @#$%^&*()';

      render(<StreamingText text={specialText} isStreaming={true} speed={10} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(specialText);
      });
    });

    test('handles text with multiple spaces', async () => {
      const spacedText = 'Hello    world    test';

      render(<StreamingText text={spacedText} isStreaming={true} speed={10} />);

      const container = screen.getByTestId('streaming-text');

      await waitFor(() => {
        expect(container.textContent).toBe(spacedText);
      });
    });
  });
});
