/**
 * @file Body Layout Component
 *
 * Sidebar body that wraps the MessageList component
 */

import React from 'react';
import { MessageList } from '@components/MessageList';
import type { ChatMessage } from '@store/chat';

export interface BodyProps {
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Whether currently loading */
  isLoading: boolean;
  /** Height for the body (CSS value) */
  height?: string;
  /** Empty message text */
  emptyMessage?: string;
}

/**
 * Body component for the sidebar
 * Wraps MessageList with proper layout styling
 */
export const Body: React.FC<BodyProps> = ({
  messages,
  isLoading,
  height = 'calc(100% - 60px - 70px)',
  emptyMessage = '',
}) => {
  return (
    <div
      className="ai-sidebar-body"
      data-testid="sidebar-body"
      style={{
        height,
      }}
    >
      <MessageList
        messages={messages}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        height="100%"
      />
    </div>
  );
};
