import { useState, useEffect, useCallback, useRef, memo } from 'react';

/**
 * Props for the StreamingText component
 */
export interface StreamingTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The complete text to stream */
  text: string;
  /** Whether the text is currently streaming */
  isStreaming: boolean;
  /** Animation speed in milliseconds between tokens (default: 50) */
  speed?: number;
  /** How to tokenize the text: 'word' | 'character' (default: 'word') */
  tokenizeBy?: 'word' | 'character';
  /** Whether to preserve markdown formatting (default: false) */
  preserveMarkdown?: boolean;
  /** Callback called when streaming completes */
  onComplete?: (fullText: string) => void;
  /** Custom CSS class name */
  className?: string;
}

/**
 * StreamingText Component
 *
 * Displays text with a streaming animation effect, rendering token by token
 * with a blinking cursor during streaming. Optimized for performance with
 * requestAnimationFrame and React.memo.
 */
export const StreamingText = memo<StreamingTextProps>(
  ({
    text,
    isStreaming,
    speed = 50,
    tokenizeBy = 'word',
    preserveMarkdown = false,
    onComplete,
    className,
    ...props
  }) => {
    const [displayedText, setDisplayedText] = useState<string>('');
    const [isInternalStreaming, setIsInternalStreaming] = useState<boolean>(false);
    const [hasCompleted, setHasCompleted] = useState<boolean>(false);
    const [hasStarted, setHasStarted] = useState<boolean>(false);

    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const tokensRef = useRef<string[]>([]);
    const completedTextRef = useRef<string>('');
    const currentTokenIndexRef = useRef<number>(0);

    /**
     * Tokenize text based on the tokenization strategy
     */
    const tokenizeText = useCallback(
      (inputText: string): string[] => {
        if (!inputText) return [];

        if (tokenizeBy === 'character') {
          return inputText.split('');
        }

        // For word tokenization, preserve spaces
        const words = inputText.split(/(\s+)/);
        return words.filter(token => token.length > 0);
      },
      [tokenizeBy]
    );

    /**
     * Reset streaming state when text or streaming status changes
     */
    useEffect(() => {
      if (!text) {
        setDisplayedText('');
        setIsInternalStreaming(false);
        setHasCompleted(false);
        setHasStarted(false);
        tokensRef.current = [];
        completedTextRef.current = '';
        currentTokenIndexRef.current = 0;
        return;
      }

      const newTokens = tokenizeText(text);
      tokensRef.current = newTokens;
      completedTextRef.current = text;

      if (isStreaming) {
        setDisplayedText('');
        currentTokenIndexRef.current = 0;
        setIsInternalStreaming(true);
        setHasCompleted(false);
        setHasStarted(false);
      } else {
        // If not streaming, show full text immediately
        setDisplayedText(text);
        currentTokenIndexRef.current = newTokens.length;
        setIsInternalStreaming(false);
        setHasCompleted(true);
        setHasStarted(true);
      }
    }, [text, isStreaming, tokenizeText]);

    /**
     * Handle streaming stop mid-process
     */
    useEffect(() => {
      if (!isStreaming && isInternalStreaming) {
        setIsInternalStreaming(false);
        // Keep the current displayed text as is when stopping
      }
    }, [isStreaming, isInternalStreaming]);

    /**
     * Animation function using requestAnimationFrame for smooth performance
     */
    const animate = useCallback(
      (currentTime: number) => {
        if (!isInternalStreaming || !tokensRef.current.length) {
          return;
        }

        // Throttle updates based on speed setting
        if (currentTime - lastUpdateTimeRef.current < speed) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        lastUpdateTimeRef.current = currentTime;

        const nextIndex = currentTokenIndexRef.current + 1;
        const tokens = tokensRef.current;

        if (nextIndex >= tokens.length) {
          // Streaming complete
          setIsInternalStreaming(false);
          setHasCompleted(true);
          setDisplayedText(completedTextRef.current);

          // Call onComplete callback
          if (onComplete && !hasCompleted) {
            onComplete(completedTextRef.current);
          }

          return;
        }

        // Update displayed text
        currentTokenIndexRef.current = nextIndex;
        const newDisplayedText = tokens.slice(0, nextIndex).join('');
        setDisplayedText(newDisplayedText);

        animationFrameRef.current = requestAnimationFrame(animate);
      },
      [isInternalStreaming, speed, onComplete, hasCompleted]
    );

    /**
     * Start animation when streaming begins
     */
    useEffect(() => {
      if (isInternalStreaming && !hasStarted) {
        setHasStarted(true);
        lastUpdateTimeRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(animate);
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }, [isInternalStreaming, hasStarted, animate]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []);

    /**
     * Determine if cursor should be visible
     */
    const shouldShowCursor = isStreaming && isInternalStreaming && text !== '' && hasStarted;

    return (
      <span
        data-testid="streaming-text"
        role="status"
        aria-live="polite"
        className={`inline-block ${preserveMarkdown ? 'whitespace-pre-wrap' : 'whitespace-normal'}${className ? ` ${className}` : ''}`}
        {...props}
      >
        {displayedText}
        {shouldShowCursor && (
          <span
            data-testid="streaming-cursor"
            aria-hidden="true"
            className="inline-block w-2 h-5 bg-current animate-pulse ml-0.5"
            style={{
              animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            |
          </span>
        )}
      </span>
    );
  }
);

StreamingText.displayName = 'StreamingText';

export default StreamingText;
