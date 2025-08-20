import React from 'react';
import { Card } from '@/components/ui/Card';
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

  // Get alignment classes based on message role
  const getAlignmentClasses = (role: MessageRole) => {
    switch (role) {
      case 'user':
        return 'justify-end';
      case 'assistant':
        return 'justify-start';
      case 'system':
        return 'justify-center';
      default:
        return 'justify-start';
    }
  };

  // Get bubble styling classes based on message role
  const getBubbleClasses = (role: MessageRole) => {
    switch (role) {
      case 'user':
        return 'bg-blue-500 text-white max-w-[80%]';
      case 'assistant':
        return 'bg-gray-100 text-gray-900 max-w-[80%]';
      case 'system':
        return 'bg-yellow-100 text-yellow-800 max-w-[90%]';
      default:
        return 'bg-gray-100 text-gray-900 max-w-[80%]';
    }
  };

  // Get status indicator for different message states
  const getStatusIndicator = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return <span data-testid="message-status">Sending...</span>;
      case 'streaming':
        return (
          <span
            data-testid="message-status"
            aria-label="AI is typing"
            className="flex items-center gap-1"
          >
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-150"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse animation-delay-300"></span>
          </span>
        );
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
      className={cn('flex w-full mb-4 group', getAlignmentClasses(message.role), className)}
      data-testid="message-bubble"
      aria-label={getAriaLabel(message.role)}
      {...props}
    >
      <Card
        className={cn(
          'relative p-3 rounded-lg shadow-sm',
          getBubbleClasses(message.role),
          message.status === 'error' && 'border-red-200'
        )}
        padding="none"
      >
        <div
          data-testid="message-content"
          className={cn('whitespace-pre-wrap break-words', getBubbleClasses(message.role))}
        >
          {message.content}
        </div>

        {/* Timestamp and status */}
        <div className="flex items-center justify-between mt-2 text-xs opacity-70">
          {showTimestamp && (
            <time
              data-testid="message-timestamp"
              dateTime={message.timestamp.toISOString()}
              className="text-xs"
            >
              {formatTimestamp(message.timestamp)}
            </time>
          )}
          {getStatusIndicator(message.status)}
        </div>

        {/* Hover timestamp when not always visible */}
        {!showTimestamp && (
          <time
            data-testid="message-timestamp-hover"
            dateTime={message.timestamp.toISOString()}
            className="absolute -bottom-6 left-0 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {formatTimestamp(message.timestamp)}
          </time>
        )}
      </Card>
    </div>
  );
};

export default MessageBubble;
