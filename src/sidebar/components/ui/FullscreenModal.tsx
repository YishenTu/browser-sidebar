/**
 * @file Fullscreen Modal Component
 *
 * A modal component that renders outside the sidebar container using React Portal
 */

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, EditIcon, SaveIcon, RegenerateIcon } from './Icons';
import '../../styles/fullscreen-modal.css';

export interface FullscreenModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: React.ReactNode;
  /** Optional subtitle shown under title (e.g., URL) */
  subtitle?: React.ReactNode;
  /** Modal content (used when not editable) */
  children?: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Maximum width of modal content */
  maxWidth?: string;
  /** Maximum height of modal content */
  maxHeight?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Enable edit mode for content */
  editable?: boolean;
  /** Content to display/edit (when editable is true) */
  content?: string;
  /** Whether content has been edited */
  edited?: boolean;
  /** Callback when content is saved */
  onContentSave?: (content: string) => void;
  /** Whether content is truncated */
  truncated?: boolean;
  /** Callback to re-extract/regenerate content */
  onRegenerate?: () => void;
}

/**
 * Fullscreen Modal Component
 *
 * Displays content in a centered overlay outside the sidebar container
 */
export const FullscreenModal: React.FC<FullscreenModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className = '',
  maxWidth = '72vw',
  maxHeight = '72vh',
  showCloseButton = true,
  editable = false,
  content = '',
  edited = false,
  onContentSave,
  truncated = false,
  onRegenerate,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
    }
  }, [isOpen]);

  // Update edited content when content prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);
  // Handle ESC key press
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  // Create modal container element
  const modalRoot = document.body;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fullscreen-modal-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div
        className={`fullscreen-modal-container ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'fullscreen-modal-title' : undefined}
        style={{
          maxWidth,
          maxHeight,
        }}
      >
        {/* Modal Header */}
        {(title || showCloseButton || editable) && (
          <div className="fullscreen-modal-header">
            <div className="fullscreen-modal-header-content">
              {title && (
                <h2 id="fullscreen-modal-title" className="fullscreen-modal-title">
                  {title}
                </h2>
              )}
              {subtitle && <div className="fullscreen-modal-subtitle">{subtitle}</div>}
            </div>

            {/* Header actions - absolutely positioned like the close button */}
            {/* Show edited badge */}
            {editable && edited && (
              <span
                className={`fullscreen-modal-edited-badge ${
                  editable
                    ? 'fullscreen-modal-edited-badge--with-edit'
                    : 'fullscreen-modal-edited-badge--without-edit'
                }`}
              >
                Edited
              </span>
            )}

            {/* Edit/Save buttons - positioned next to close button */}
            {editable && (
              <>
                {!isEditMode ? (
                  <button
                    onClick={() => {
                      setIsEditMode(true);
                      setEditedContent(content);
                    }}
                    aria-label="Edit content"
                    title="Edit content"
                    type="button"
                    className="fullscreen-modal-edit-button"
                  >
                    <EditIcon size={20} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (onContentSave) {
                          onContentSave(editedContent);
                        }
                        setIsEditMode(false);
                      }}
                      aria-label="Save changes"
                      title="Save changes"
                      type="button"
                      className="fullscreen-modal-save-button"
                    >
                      <SaveIcon size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        setEditedContent(content);
                        // Trigger re-extraction if callback is provided
                        if (onRegenerate) {
                          onRegenerate();
                        }
                      }}
                      aria-label="Re-extract content"
                      title="Re-extract content"
                      type="button"
                      className="fullscreen-modal-regenerate-button"
                    >
                      <RegenerateIcon size={20} />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Close button - already absolutely positioned via CSS */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="fullscreen-modal-close-button"
                aria-label="Close modal"
                type="button"
              >
                <CloseIcon size={24} />
              </button>
            )}
          </div>
        )}

        {/* Modal Content */}
        <div className="fullscreen-modal-body">
          {editable ? (
            <>
              {/* Truncated badge */}
              {truncated && (
                <div className="fullscreen-modal-content-spacing">
                  <span
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--color-error)',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    Truncated
                  </span>
                </div>
              )}
              {/* Editable content */}
              {isEditMode ? (
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  className="fullscreen-modal-edit-textarea"
                  style={{
                    width: '100%',
                    height: truncated ? 'calc(100% - 40px)' : '100%',
                    padding: '16px',
                    margin: '0',
                    border: 'none',
                    resize: 'none',
                    outline: 'none',
                    background: 'transparent !important',
                    backgroundColor: 'transparent !important',
                    color: '#d4d4d4',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    wordBreak: 'break-word',
                    overflow: 'auto',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  placeholder="Edit the extracted content here..."
                  autoFocus
                />
              ) : (
                <pre className="full-content-pre">{edited ? editedContent : content}</pre>
              )}
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </>,
    modalRoot
  );
};

export default FullscreenModal;
