/**
 * @file Footer Layout Component
 *
 * Sidebar footer that contains the ChatInput component
 */

import React from 'react';
import { ChatInput } from '@components/ChatInput';

export interface FooterProps {
  /** Send message handler */
  onSend: (message: string) => void;
  /** Cancel message handler */
  onCancel?: () => void;
  /** Whether currently loading */
  loading: boolean;
  /** Input placeholder text */
  placeholder?: string;
}

/**
 * Footer component for the sidebar
 * Wraps ChatInput with proper layout styling
 */
export const Footer: React.FC<FooterProps> = ({
  onSend,
  onCancel,
  loading,
  placeholder = 'Ask about this webpage...',
}) => {
  return (
    <div className="ai-sidebar-footer" data-testid="sidebar-footer">
      <ChatInput onSend={onSend} onCancel={onCancel} loading={loading} placeholder={placeholder} />
    </div>
  );
};
