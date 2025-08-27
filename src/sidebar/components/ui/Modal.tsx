/**
 * @file Modal Component
 * 
 * A reusable modal/popup component for displaying content in an overlay
 */

import React, { useEffect, useCallback } from 'react';
import { CloseIcon } from './Icons';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Maximum width of modal content */
  maxWidth?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
}

/**
 * Modal Component
 * 
 * Displays content in a centered overlay with backdrop
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  maxWidth = '90%',
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
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div 
        className={`modal-container ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={{ maxWidth }}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <h2 id="modal-title" className="modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="modal-close-button"
                aria-label="Close modal"
                type="button"
              >
                <CloseIcon size={20} />
              </button>
            )}
          </div>
        )}
        
        {/* Modal Content */}
        <div className="modal-content">
          {children}
        </div>
      </div>
    </>
  );
};

export default Modal;