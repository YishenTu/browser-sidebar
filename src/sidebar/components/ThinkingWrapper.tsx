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
  // Use refs to persist state across re-renders
  const hasFinishedStreamingRef = useRef(false);
  const userCollapsedStateRef = useRef<boolean | null>(null);
  const hasUserInteractedRef = useRef(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Priority: user's manual choice > auto-collapsed after streaming > initial prop
    if (userCollapsedStateRef.current !== null) {
      return userCollapsedStateRef.current;
    }
    if (hasFinishedStreamingRef.current) {
      return true;
    }
    return initialCollapsed;
  });

  const [thinkingDuration, setThinkingDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const finalDurationRef = useRef<number | null>(null);

  // Sync collapsed state on re-render if user hasn't interacted
  useEffect(() => {
    if (!hasUserInteractedRef.current) {
      // If streaming finished and user hasn't interacted, ensure it's collapsed
      if (hasFinishedStreamingRef.current && !isStreaming) {
        setIsCollapsed(true);
      }
    }
  }, [isStreaming]); // Run on mount/remount and when streaming changes

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

        // Mark that streaming has finished
        hasFinishedStreamingRef.current = true;

        // Auto-collapse after streaming ends only if user hasn't interacted
        if (!hasUserInteractedRef.current) {
          setTimeout(() => {
            setIsCollapsed(true);
            // Don't update userCollapsedStateRef here since this is auto-collapse
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
  }, [isStreaming]);

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
          hasUserInteractedRef.current = true;
          userCollapsedStateRef.current = collapsed;
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
