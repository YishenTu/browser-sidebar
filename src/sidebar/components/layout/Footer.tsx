/**
 * @file Footer Layout Component
 *
 * Sidebar footer that contains the ChatInput component
 */

import React, { useEffect, useRef } from 'react';
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
  /** Message being edited */
  editingMessage?: string;
  /** Clear edit mode */
  onClearEdit?: () => void;
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
  editingMessage,
  onClearEdit,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use key to force re-render of ChatInput when editing message changes
  const chatInputKey = editingMessage ? `edit-${editingMessage}` : 'normal';

  // Handle send with edit clearing
  const handleSend = (message: string) => {
    onSend(message);
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
        placeholder={placeholder}
        defaultValue={editingMessage || ''}
      />
      {editingMessage && (
        <div className="edit-indicator">
          <span>Editing message</span>
          <button onClick={onClearEdit} className="edit-cancel-btn" aria-label="Cancel edit">
            ×
          </button>
        </div>
      )}
    </div>
  );
};
