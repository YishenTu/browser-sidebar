import React, { useState, useEffect } from 'react';
import { Alert } from '@ui/Alert';
import { CloseIcon, InfoIcon } from '@ui/Icons';

export interface FirstTimeGuideProps {
  /** Feature name for localStorage key */
  featureName: string;
  /** Guide content to display */
  children: React.ReactNode;
  /** Whether to show immediately or wait for user trigger */
  showImmediately?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Callback when guide is dismissed */
  onDismiss?: () => void;
}

/**
 * FirstTimeGuide Component
 * 
 * Shows a dismissible guide for first-time users of a feature.
 * Uses localStorage to track whether the guide has been seen.
 */
export const FirstTimeGuide: React.FC<FirstTimeGuideProps> = ({
  featureName,
  children,
  showImmediately = false,
  className = '',
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  
  const storageKey = `ai-sidebar-guide-${featureName}`;

  // Check if guide has been seen on mount
  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey) === 'true';
      setHasBeenSeen(seen);
      
      if (!seen && showImmediately) {
        setIsVisible(true);
      }
    } catch (error) {
      setHasBeenSeen(false);
    }
  }, [storageKey, showImmediately]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
      setHasBeenSeen(true);
      setIsVisible(false);
      onDismiss?.();
    } catch (error) {
      // Still hide the guide even if we can't save the status
      setIsVisible(false);
      onDismiss?.();
    }
  };

  const handleShow = () => {
    if (!hasBeenSeen || !showImmediately) {
      setIsVisible(true);
    }
  };

  // Don't render anything if permanently dismissed and not manually shown
  if (hasBeenSeen && showImmediately && !isVisible) {
    return null;
  }

  return (
    <>
      {/* Show button for manual trigger */}
      {!showImmediately && (
        <button
          onClick={handleShow}
          className={`first-time-guide-trigger ${className}`}
          aria-label={`Show ${featureName} guide`}
          type="button"
        >
          <InfoIcon size={14} />
        </button>
      )}
      
      {/* Guide content */}
      {isVisible && (
        <div className="first-time-guide">
          <Alert
            type="info"
            message={
              <div className="first-time-guide-content">
                <div className="first-time-guide-header">
                  <InfoIcon size={16} />
                  <strong>New Feature: Multi-Tab Content</strong>
                  <button
                    onClick={handleDismiss}
                    className="first-time-guide-close"
                    aria-label="Dismiss guide"
                    type="button"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
                <div className="first-time-guide-body">
                  {children}
                </div>
              </div>
            }
            dismissible={false}
            showIcon={false}
            className="first-time-guide-alert"
          />
        </div>
      )}
    </>
  );
};

/**
 * MultiTabFeatureGuide Component
 * 
 * Pre-configured guide specifically for the multi-tab feature
 */
export const MultiTabFeatureGuide: React.FC<{
  showImmediately?: boolean;
  onDismiss?: () => void;
}> = ({ showImmediately = false, onDismiss }) => {
  return (
    <FirstTimeGuide
      featureName="multi-tab-content"
      showImmediately={showImmediately}
      onDismiss={onDismiss}
    >
      <div>
        <p>You can now include content from multiple browser tabs in your conversations:</p>
        <ul>
          <li>✨ Your current tab content is automatically included</li>
          <li>📋 Type <code>@</code> in the input to add more tabs</li>
          <li>🔍 Search and select tabs by title or domain</li>
          <li>📚 All selected tab content is sent to the AI together</li>
        </ul>
        <p>Try typing <code>@</code> in the input below to see it in action!</p>
      </div>
    </FirstTimeGuide>
  );
};