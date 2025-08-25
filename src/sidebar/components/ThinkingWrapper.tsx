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
  const hasStartedRef = useRef(false);
  const finalDurationRef = useRef<number | null>(null);

  // Track thinking duration
  useEffect(() => {
    if (isStreaming) {
      // Start timing when streaming begins (only once per instance)
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        startTimeRef.current = Date.now();
        finalDurationRef.current = null;
        setThinkingDuration(0);
      }

      // Always set up the interval when streaming
      if (!timerRef.current && startTimeRef.current) {
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            setThinkingDuration(elapsed);
          }
        }, 100);
      }
    } else {
      // Stop timing when streaming ends
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Calculate and store final duration only once
      if (hasStartedRef.current && startTimeRef.current && finalDurationRef.current === null) {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        finalDurationRef.current = duration;
        setThinkingDuration(duration);

        // Auto-collapse after streaming ends only if user hasn't interacted
        if (!hasUserInteracted) {
          setTimeout(() => {
            setIsCollapsed(true);
          }, 500);
        }
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
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
