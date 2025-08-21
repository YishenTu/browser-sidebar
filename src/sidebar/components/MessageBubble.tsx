import React from 'react';
import { cn } from '@/utils/cn';
import { ChatMessage, MessageRole, MessageStatus } from '@/store/chat';

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
  onRetry,
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
        return (
          <div data-testid="message-status" className="text-red-500 text-sm">
            <div>{message.error}</div>
            {onRetry && (
              <button
                onClick={() => onRetry(message.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onRetry(message.id);
                  }
                }}
                className="mt-1 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Retry
              </button>
            )}
          </div>
        );
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems:
            message.role === 'user'
              ? 'flex-end'
              : message.role === 'assistant'
                ? 'flex-start'
                : 'center',
          paddingRight: message.role === 'user' ? '20px' : '0',
          paddingLeft: '0', // No padding for AI messages
          width: '100%',
        }}
      >
        <div className={cn(getMessageClasses(message.role))}>
          <span data-testid="message-content">{message.content}</span>
        </div>

        {/* Timestamp and model name (for assistant) - same row under bubble */}
        {(showTimestamp && (message.role !== 'assistant' || message.status === 'sent' || message.status === 'received')) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              marginTop: '4px',
              paddingLeft: message.role === 'assistant' ? '12px' : '0',
              paddingRight: message.role === 'user' ? '4px' : '0',
            }}
          >
            {message.role === 'assistant' && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  fontWeight: 500,
                }}
                aria-label="model-name"
              >
                AI Assistant
              </span>
            )}
            <time
              data-testid="message-timestamp"
              dateTime={message.timestamp.toISOString()}
              className="text-xs text-gray-500"
              style={{
                fontSize: '10px',
                color: '#6b7280',
              }}
            >
              {formatTimestamp(message.timestamp)}
            </time>
          </div>
        )}

        {/* Status indicator */}
        {message.status !== 'sent' && (
          <div className="mt-1" style={{ fontSize: '12px' }}>
            {getStatusIndicator(message.status)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
