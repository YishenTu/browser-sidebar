/**
 * @file ThinkingWrapper Component
 *
 * A collapsible wrapper for displaying AI model thinking/reasoning content.
 * Works with both OpenAI and Gemini models.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Collapsible } from '@ui/Collapsible';

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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
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

      // Auto-collapse after streaming ends only if user hasn't interacted
      if (!hasUserInteracted) {
        setTimeout(() => {
          setIsCollapsed(true);
        }, 500);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming, hasUserInteracted]);

  if (!thinking) return null;

  // Format duration display
  const formatDuration = (seconds: number) => {
    return Math.round(seconds).toString();
  };

  const headerContent = (
    <span className="thinking-label">Thought for {formatDuration(thinkingDuration)} seconds</span>
  );

  return (
    <div className={`thinking-wrapper ${className}`}>
      <Collapsible
        header={headerContent}
        collapsed={isCollapsed}
        onToggle={collapsed => {
          setIsCollapsed(collapsed);
          setHasUserInteracted(true);
        }}
        headerClassName="thinking-header"
        showChevron={false}
      >
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
      </Collapsible>
    </div>
  );
};

export default ThinkingWrapper;
