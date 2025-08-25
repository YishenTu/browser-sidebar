/**
 * @file ThinkingWrapper Component
 *
 * A collapsible wrapper for displaying AI model thinking/reasoning content.
 * Works with both OpenAI and Gemini models.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ThinkingWrapperProps {
  thinking: string;
  isStreaming?: boolean;
  initialCollapsed?: boolean;
  className?: string;
}

export const ThinkingWrapper: React.FC<ThinkingWrapperProps> = ({
  thinking,
  isStreaming = false,
  initialCollapsed = false,
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [thinkingDuration, setThinkingDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track thinking duration
  useEffect(() => {
    if (isStreaming && !startTimeRef.current) {
      // Start timing when streaming begins
      startTimeRef.current = Date.now();

      // Update timer every 100ms for smooth display
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          setThinkingDuration(elapsed);
        }
      }, 100);
    } else if (!isStreaming && startTimeRef.current) {
      // Stop timing when streaming ends
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Final duration update
      const finalDuration = (Date.now() - startTimeRef.current) / 1000;
      setThinkingDuration(finalDuration);

      // Auto-collapse after streaming ends
      setTimeout(() => {
        setIsCollapsed(true);
      }, 500);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming]);

  if (!thinking) return null;

  // Format duration display
  const formatDuration = (seconds: number) => {
    return Math.round(seconds).toString();
  };

  return (
    <div className={`thinking-wrapper ${className} ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="thinking-header"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand thinking' : 'Collapse thinking'}
      >
        <span className="thinking-label">
          Thought for {formatDuration(thinkingDuration)} seconds
        </span>
      </button>

      <div style={{ display: isCollapsed ? 'none' : 'block' }}>
        <div className="thinking-content-bubble">
          <div className="thinking-text">
            <MarkdownRenderer content={thinking} />
          </div>
        </div>
        {isStreaming && (
          <div className="thinking-indicator">
            <span className="thinking-indicator-text">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThinkingWrapper;
