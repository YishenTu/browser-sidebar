/**
 * @file Fullscreen Modal Component
 *
 * A modal component that renders outside the sidebar container using React Portal
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';
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
  /** Modal content */
  children: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Maximum width of modal content */
  maxWidth?: string;
  /** Maximum height of modal content */
  maxHeight?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
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
}) => {
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
        {(title || showCloseButton) && (
          <div className="fullscreen-modal-header">
            <div>
              {title && (
                <h2 id="fullscreen-modal-title" className="fullscreen-modal-title">
                  {title}
                </h2>
              )}
              {subtitle && <div className="fullscreen-modal-subtitle">{subtitle}</div>}
            </div>
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
        <div className="fullscreen-modal-body">{children}</div>
      </div>
    </>,
    modalRoot
  );
};

export default FullscreenModal;
