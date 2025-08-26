import React from 'react';
import { cn } from '@sidebar/lib/cn';
import { ChatMessage, MessageRole, MessageStatus } from '@store/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingWrapper } from './ThinkingWrapper';
import { SearchSources } from './SearchSources';
import { Spinner, CopyButton, EditIcon, RegenerateIcon } from './ui';

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
  /** Callback for edit action on user messages */
  onEdit?: (message: ChatMessage) => void;
  /** Callback for regenerate action on assistant messages */
  onRegenerate?: (message: ChatMessage) => void;
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
  onEdit,
  onRegenerate,
  ...props
}) => {
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

  // Determine what content to show
  const messageContent: React.ReactNode = (() => {
    if (
      message.role === 'assistant' &&
      message.status === 'streaming' &&
      !message.content &&
      !message.metadata?.['thinking']
    ) {
      return (
        <div className="message-spinner">
          <Spinner size="md" aria-label="AI is thinking..." />
        </div>
      );
    }
    return <MarkdownRenderer content={message.content || ''} />;
  })();

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
            thinking={message.metadata['thinking'] as string}
            isStreaming={message.metadata?.['thinkingStreaming'] as boolean}
            initialCollapsed={false}
            className=""
          />
        ) : null}

        {/* Hover container for bubble and footer */}
        <div className={cn('message-hover-container', `message-hover-container--${message.role}`)}>
          <div className={cn(getMessageClasses(message.role))}>
            <div data-testid="message-content">{messageContent}</div>
          </div>

          {/* Search results display for assistant messages - inside hover container */}
          {message.role === 'assistant' && message.metadata?.['searchResults'] ? (
            <div className="message-search-metadata">
              {(message.metadata['searchResults'] as any)?.sources ? (
                <SearchSources sources={(message.metadata['searchResults'] as any).sources} />
              ) : null}
            </div>
          ) : null}

          {/* Message Footer - displays metadata below the message bubble */}
          {showTimestamp &&
            (message.role !== 'assistant' ||
              message.status === 'sent' ||
              message.status === 'received') &&
            (() => {
              // Format timestamp based on options (24-hour format)
              const formatTimestamp = (timestamp: Date) => {
                if (showFullDate) {
                  return timestamp.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                }
                return timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });
              };

              return (
                <div className={cn('message-footer', `message-footer--${message.role}`)}>
                  {/* Assistant Footer: Model name + Regenerate button + Copy button | Timestamp (far right) */}
                  {message.role === 'assistant' && (
                    <>
                      <div className="message-footer-left">
                        <span className="message-footer-model" aria-label="model-name">
                          {(message.metadata?.['model'] as string) || 'AI Assistant'}
                        </span>

                        {onRegenerate && (
                          <button
                            onClick={() => onRegenerate(message)}
                            className="message-footer-regenerate"
                            aria-label="Regenerate response"
                            title="Regenerate response"
                            type="button"
                          >
                            <RegenerateIcon size={12} className="message-footer-regenerate-icon" />
                          </button>
                        )}
                        <CopyButton
                          text={message.content || ''}
                          className="message-footer-copy"
                          iconSize={12}
                        />
                      </div>
                      <time
                        data-testid="message-timestamp"
                        dateTime={message.timestamp.toISOString()}
                        className="message-footer-timestamp"
                      >
                        {formatTimestamp(message.timestamp)}
                      </time>
                    </>
                  )}

                  {/* User Footer: Edit button + Copy button + Timestamp */}
                  {message.role === 'user' && (
                    <>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(message)}
                          className="message-footer-edit"
                          aria-label="Edit message"
                          title="Edit message"
                          type="button"
                        >
                          <EditIcon size={12} className="message-footer-edit-icon" />
                        </button>
                      )}
                      <CopyButton
                        text={message.content || ''}
                        className="message-footer-copy"
                        iconSize={12}
                      />
                      <time
                        data-testid="message-timestamp"
                        dateTime={message.timestamp.toISOString()}
                        className="message-footer-timestamp"
                      >
                        {formatTimestamp(message.timestamp)}
                      </time>
                    </>
                  )}
                </div>
              );
            })()}
        </div>

        {/* Status indicator */}
        {message.status !== 'sent' && (
          <div className="message-status">{getStatusIndicator(message.status)}</div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
