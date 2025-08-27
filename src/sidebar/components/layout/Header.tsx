/**
 * @file Header Layout Component
 *
 * Sidebar header with title, model selector, and action buttons
 */

import React from 'react';
import { ModelSelector } from '@components/ModelSelector';
import type { ExtractedContent } from '@/types/extraction';

export interface HeaderProps {
  /** Currently selected model ID */
  selectedModel: string;
  /** Model change handler */
  onModelChange: (modelId: string) => Promise<void>;
  /** Whether AI is currently loading */
  isLoading: boolean;
  /** Whether there are messages to clear */
  hasMessages: boolean;
  /** Clear conversation handler */
  onClearConversation: () => void;
  /** Settings toggle handler */
  onToggleSettings: () => void;
  /** Close sidebar handler */
  onClose: () => void;
  /** Mouse down handler for dragging */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Extracted content for status display */
  extractedContent?: ExtractedContent | null;
  /** Content extraction loading state */
  contentLoading?: boolean;
  /** Content extraction error state */
  contentError?: Error | null;
}

/**
 * Header component for the sidebar
 * Contains model selector, action buttons, and drag functionality
 */
export const Header: React.FC<HeaderProps> = ({
  selectedModel,
  onModelChange,
  isLoading,
  hasMessages,
  onClearConversation,
  onToggleSettings,
  onClose,
  onMouseDown,
  isDragging,
  extractedContent,
  contentLoading,
  contentError,
}) => {
  // Create extraction status indicator
  const renderExtractionStatus = () => {
    if (contentLoading) {
      return (
        <div className="extraction-status extraction-status--loading" title="Extracting content...">
          <div className="extraction-status-dot"></div>
        </div>
      );
    }

    if (contentError) {
      return (
        <div
          className="extraction-status extraction-status--error"
          title="Content extraction failed"
        >
          <div className="extraction-status-dot"></div>
        </div>
      );
    }

    if (extractedContent) {
      const wordCount = extractedContent.metadata?.wordCount ?? extractedContent.wordCount ?? 0;
      const method = extractedContent.extractionMethod;
      const truncated = extractedContent.metadata?.truncated || extractedContent.isTruncated;

      const title = `Content extracted (${method}) • ${wordCount.toLocaleString()} words${truncated ? ' • Truncated' : ''}`;

      return (
        <div className={`extraction-status extraction-status--success`} title={title}>
          <div className="extraction-status-dot"></div>
          {truncated && <div className="extraction-status-truncated">!</div>}
        </div>
      );
    }

    return null;
  };
  return (
    <div
      className={`ai-sidebar-header ${isDragging ? 'ai-sidebar-header--dragging' : ''}`}
      onMouseDown={onMouseDown}
      data-testid="sidebar-header"
    >
      <div className="ai-sidebar-header-title">
        <ModelSelector
          className="model-selector--header"
          value={selectedModel}
          onChange={onModelChange}
          disabled={isLoading}
          aria-label="Select AI model"
        />
        {renderExtractionStatus()}
        <h2></h2>
      </div>
      <div className="ai-sidebar-header-actions">
        {hasMessages && (
          <button
            onClick={onClearConversation}
            className="ai-sidebar-clear"
            aria-label="New session"
            title="Start new session"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        )}
        <button
          onClick={onToggleSettings}
          className="ai-sidebar-settings"
          aria-label="Settings"
          title="API Settings"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="ai-sidebar-close"
          aria-label="Close sidebar"
          title="Close (Esc)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
