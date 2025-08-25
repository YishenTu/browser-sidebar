import React from 'react';
import { cn } from '@sidebar/lib/cn';
import { ChatMessage, MessageRole, MessageStatus } from '@store/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingWrapper } from './ThinkingWrapper';
import { SearchSources } from './SearchSources';

/**
 * MessageBubble Props Interface
 */
export interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The message data to display */
  message: ChatMessage;
  /** Whether to show timestamp (default: true) */
  showTimestamp?: boolean;
  /** Whether to show full date for timestamps (default: false) */
  showFullDate?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Callback for retry action on error messages */
  onRetry?: (messageId: string) => void;
}

/**
 * MessageBubble Component
 *
 * Displays chat messages with different styling based on role (user, assistant, system).
 * Supports timestamps, message states, error handling, and accessibility features.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showTimestamp = true,
  showFullDate = false,
  className,
  ...props
}) => {
  // Format timestamp based on options
  const formatTimestamp = (timestamp: Date) => {
    if (showFullDate) {
      return timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get message bubble styling based on role
  const getMessageClasses = (role: MessageRole) => {
    switch (role) {
      case 'user':
        return 'message-bubble--user';
      case 'assistant':
        return 'message-bubble--assistant full-width';
      case 'system':
        return 'message-bubble--system';
      default:
        return 'message-bubble--assistant full-width';
    }
  };

  // Get status indicator for different message states
  const getStatusIndicator = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return null; // Removed "Sending..." indicator
      case 'streaming':
        return null; // Removed streaming dots indicator
      case 'error':
        return null; // Errors are now displayed in the banner at the top
      default:
        return null;
    }
  };

  // Get ARIA label for the message
  const getAriaLabel = (role: MessageRole) => {
    switch (role) {
      case 'user':
        return 'User message';
      case 'assistant':
        return 'Assistant message';
      case 'system':
        return 'System message';
      default:
        return 'Message';
    }
  };

  return (
    <div
      className={cn('message-row', `message-row--${message.role}`, className)}
      data-testid="message-bubble"
      aria-label={getAriaLabel(message.role)}
      {...props}
    >
      <div className={cn('message-content-wrapper', `message-content-wrapper--${message.role}`)}>
        {/* Display thinking wrapper for assistant messages with thinking content */}
        {message.role === 'assistant' &&
        message.metadata?.['thinking'] &&
        typeof message.metadata['thinking'] === 'string' ? (
          <ThinkingWrapper
            thinking={message.metadata['thinking']}
            isStreaming={message.metadata?.['thinkingStreaming'] as boolean}
            initialCollapsed={false}
            className=""
          />
        ) : null}

        <div className={cn(getMessageClasses(message.role))}>
          <div data-testid="message-content">
            {/* Show spinner for assistant messages that are streaming but have no content or thinking yet */}
            {message.role === 'assistant' &&
            message.status === 'streaming' &&
            !message.content &&
            !message.metadata?.['thinking'] ? (
              <div className="message-spinner">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeOpacity="0.25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>
        </div>

        {/* Search results display for assistant messages */}
        {message.role === 'assistant' && message.metadata?.['searchResults'] && (
          <div className="message-search-metadata">
            {(message.metadata['searchResults'] as any).sources && (
              <SearchSources sources={(message.metadata['searchResults'] as any).sources} />
            )}
          </div>
        )}

        {/* Timestamp and model name (for assistant) - same row under bubble */}
        {showTimestamp &&
          (message.role !== 'assistant' ||
            message.status === 'sent' ||
            message.status === 'received') && (
            <div
              className={cn(
                'message-timestamp-container',
                `message-timestamp-container--${message.role}`
              )}
            >
              {message.role === 'assistant' && (
                <span className="message-model-name" aria-label="model-name">
                  {(message.metadata?.['model'] as string) || 'AI Assistant'}
                </span>
              )}
              <time
                data-testid="message-timestamp"
                dateTime={message.timestamp.toISOString()}
                className="message-timestamp"
              >
                {formatTimestamp(message.timestamp)}
              </time>
            </div>
          )}

        {/* Status indicator */}
        {message.status !== 'sent' && (
          <div className="message-status">{getStatusIndicator(message.status)}</div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
