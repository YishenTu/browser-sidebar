/**
 * @file Fullscreen Modal Component
 *
 * A modal component that renders outside the sidebar container using React Portal
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';

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
      <div 
        className="fullscreen-modal-backdrop" 
        onClick={onClose} 
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 2147483646,
        }}
      />

      {/* Modal Container */}
      <div
        className={`fullscreen-modal-container ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'fullscreen-modal-title' : undefined}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth,
          maxHeight,
          width: 'calc(100% - 40px)',
          height: 'calc(100% - 40px)',
          // Match chat panel background
          backgroundColor: 'rgba(26, 26, 26, 0.8)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2147483647,
        }}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div 
            className="fullscreen-modal-header"
            style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {title && (
                <h2 
                  id="fullscreen-modal-title" 
                  className="fullscreen-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#ffffff',
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <div
                  className="fullscreen-modal-subtitle"
                  style={{
                    fontSize: '14px',
                    color: '#9ca3af',
                    wordBreak: 'break-all',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="fullscreen-modal-close-button"
                aria-label="Close modal"
                type="button"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <CloseIcon size={24} />
              </button>
            )}
          </div>
        )}

        {/* Modal Content */}
        <div 
          className="fullscreen-modal-content"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            // Ensure host page styles don't introduce a white background
            backgroundColor: 'transparent',
          }}
        >
          {children}
        </div>
      </div>
    </>,
    modalRoot
  );
};

export default FullscreenModal;
