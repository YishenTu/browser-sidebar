/**
 * @file Footer Layout Component
 *
 * Sidebar footer that contains the ChatInput component
 */

import React, { useEffect, useRef } from 'react';
import { ChatInput } from '@components/ChatInput';
import type { TabInfo, TabContent } from '@/types/tabs';

export interface FooterProps {
  /** Send message handler */
  onSend: (message: string, metadata?: { expandedPrompt?: string }) => void;
  /** Cancel message handler */
  onCancel?: () => void;
  /** Whether currently loading */
  loading: boolean;
  /** Input placeholder text */
  placeholder?: string;
  /** Message being edited */
  editingMessage?: string;
  /** Clear edit mode */
  onClearEdit?: () => void;
  /** Available tabs for @ mention functionality */
  availableTabs?: TabInfo[];
  /** Loaded tabs to display as chips */
  loadedTabs?: Record<number, TabContent>;
  /** Callback fired when a tab chip is removed */
  onTabRemove?: (tabId: number) => void;
  /** Callback when a tab is selected from @ mention dropdown */
  onMentionSelectTab?: (tabId: number) => void;
}

/**
 * Footer component for the sidebar
 * Wraps ChatInput with proper layout styling
 */
export const Footer: React.FC<FooterProps> = ({
  onSend,
  onCancel,
  loading,
  placeholder,
  editingMessage,
  onClearEdit,
  availableTabs = [],
  loadedTabs = {},
  onTabRemove,
  onMentionSelectTab,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use key to force re-render of ChatInput when editing message changes
  const chatInputKey = editingMessage ? `edit-${editingMessage}` : 'normal';

  // Handle send with edit clearing
  const handleSend = (message: string, metadata?: { expandedPrompt?: string }) => {
    onSend(message, metadata);
    // Clear edit will be handled in ChatPanel after successful send
  };

  // Focus input when editing message changes
  useEffect(() => {
    if (editingMessage && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end of text
      inputRef.current.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length
      );
    }
  }, [editingMessage]);

  return (
    <div className="ai-sidebar-footer" data-testid="sidebar-footer">
      <ChatInput
        key={chatInputKey}
        ref={inputRef}
        onSend={handleSend}
        onCancel={editingMessage ? onClearEdit : onCancel}
        loading={loading}
        placeholder={
          editingMessage ? 'Edit your message...' : placeholder || '\n@ for tabs, / for commands'
        }
        defaultValue={editingMessage || ''}
        className={editingMessage ? 'editing-mode' : ''}
        availableTabs={availableTabs}
        enableMentions={true}
        enableSlashCommands={true}
        loadedTabs={loadedTabs}
        onTabRemove={onTabRemove}
        onMentionSelectTab={onMentionSelectTab}
      />
    </div>
  );
};
