import React, { useState, useEffect } from 'react';
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
  const [copySuccess, setCopySuccess] = useState(false);

  // Copy functionality
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopySuccess(true);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle copy success timeout
  useEffect(() => {
    if (copySuccess) {
      const timeout = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timeout);
    }
    return; // Return undefined when condition is not met
  }, [copySuccess]);

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

  // Get avatar component for different roles
  const getAvatar = (role: MessageRole) => {
    const avatarClasses =
      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3';

    switch (role) {
      case 'user':
        return (
          <div
            className={cn(avatarClasses, 'bg-blue-500 text-white')}
            data-testid="message-avatar"
            aria-label="User avatar"
          >
            U
          </div>
        );
      case 'assistant':
        return (
          <div
            className={cn(avatarClasses, 'bg-green-500 text-white')}
            data-testid="message-avatar"
            aria-label="Assistant avatar"
          >
            AI
          </div>
        );
      case 'system':
        return (
          <div
            className={cn(avatarClasses, 'bg-yellow-500 text-yellow-900')}
            data-testid="message-avatar"
            aria-label="System message"
          >
            !
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn('flex w-full mb-4 group', getAlignmentClasses(message.role), className)}
      data-testid="message-bubble"
      aria-label={getAriaLabel(message.role)}
      {...props}
    >
      {/* Avatar - only for left-aligned messages */}
      {message.role !== 'user' && getAvatar(message.role)}

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

        {/* Copy button and feedback */}
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {copySuccess ? (
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs">Copied!</div>
          ) : (
            <button
              onClick={handleCopy}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCopy();
                }
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-testid="copy-button"
              aria-label="Copy message"
              title="Copy message"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
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

      {/* Avatar - only for right-aligned messages (user) */}
      {message.role === 'user' && <div className="ml-3">{getAvatar(message.role)}</div>}
    </div>
  );
};

export default MessageBubble;
