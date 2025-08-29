/**
 * @file Tab Content Item Component
 *
 * Component for displaying extracted content from a single browser tab.
 * Shows title, domain, and excerpt with loading and error states.
 * Used as the atomic unit within ContentPreview for multi-tab scenarios.
 */

import React, { useState } from 'react';
import type { ExtractedContent } from '@/types/extraction';
import { Spinner } from '@ui/Spinner';
import { Alert } from '@ui/Alert';
// Badge imported but not used - removed
import { Collapsible } from '@ui/Collapsible';
import { RegenerateIcon, ExpandIcon, CancelIcon } from '@ui/Icons';
import { FullscreenModal } from '@ui/FullscreenModal';
import '../styles/tab-content-item.css';

export interface TabContentItemProps {
  /** Extracted content data */
  content: ExtractedContent | null;
  /** Loading state during extraction */
  loading: boolean;
  /** Error state if extraction fails */
  error: Error | null;
  /** Function to trigger re-extraction */
  onReextract: () => void;
  /** Function to clear extracted content */
  onClearContent?: () => void;
  /** Custom CSS class */
  className?: string;
  /** Optional tab identifier for multi-tab scenarios */
  tabId?: number | string;
}

/**
 * Tab Content Item Component
 *
 * Displays extracted content from a single browser tab in a compact, collapsible format.
 * Shows key metadata like title, domain, and excerpt with error handling.
 * Can be used standalone or as part of the ContentPreview component for multiple tabs.
 */
export const TabContentItem: React.FC<TabContentItemProps> = ({
  content,
  loading,
  error,
  onReextract,
  onClearContent,
  className = '',
  tabId,
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasCodeBlocks = content?.metadata?.hasCodeBlocks ?? content?.hasCode ?? false;
  const truncated = content?.metadata?.truncated ?? content?.isTruncated ?? false;

  // Use full text content, let CSS handle truncation
  const excerpt = content?.excerpt || content?.textContent || '';

  // Create header content for collapsible
  const headerContent = (isCollapsed: boolean) => {
    if (loading) {
      return (
        <div className="content-preview-header">
          <div className="content-preview-header-content">
            <Spinner size="sm" />
            <span>Extracting content...</span>
          </div>
          {(isHovered || !isCollapsed) && onClearContent && (
            <button
              className="content-preview-header-close"
              onClick={e => {
                e.stopPropagation();
                onClearContent();
              }}
              aria-label="Clear content"
              title="Clear content"
            >
              <CancelIcon size={12} />
            </button>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="content-preview-header content-preview-header--error">
          <div className="content-preview-header-content">
            <span>Content extraction failed</span>
          </div>
          {(isHovered || !isCollapsed) && onClearContent && (
            <button
              className="content-preview-header-close"
              onClick={e => {
                e.stopPropagation();
                onClearContent();
              }}
              aria-label="Clear content"
              title="Clear content"
            >
              <CancelIcon size={12} />
            </button>
          )}
        </div>
      );
    }

    if (content) {
      return (
        <div className="content-preview-header">
          <div className="content-preview-header-content">
            <div className="content-preview-header-main">
              <div className="content-preview-title-wrapper">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(content.url || 'https://example.com').hostname)}&sz=16`}
                  alt=""
                  className="content-preview-favicon"
                  width="16"
                  height="16"
                  onError={e => {
                    // Hide on error instead of using data URL fallback
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="content-preview-title">{content.title}</span>
              </div>
            </div>
          </div>
          {(isHovered || !isCollapsed) && onClearContent && (
            <button
              className="content-preview-header-close"
              onClick={e => {
                e.stopPropagation();
                onClearContent();
              }}
              aria-label="Clear content"
              title="Clear content"
            >
              <CancelIcon size={12} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="content-preview-header">
        <div className="content-preview-header-content">
          <span>Page content</span>
        </div>
        {(isHovered || isExpanded) && onClearContent && (
          <button
            className="content-preview-header-close"
            onClick={e => {
              e.stopPropagation();
              onClearContent();
            }}
            aria-label="Clear content"
            title="Clear content"
          >
            <CancelIcon size={10} />
          </button>
        )}
      </div>
    );
  };

  // If there's no content and no loading/error, don't render anything
  if (!content && !loading && !error) {
    return null;
  }

  return (
    <>
      <div className={`content-preview ${className}`} data-tab-id={tabId}>
        {error ? (
          // Show error as Alert instead of collapsible
          <Alert
            type="error"
            message={error.message}
            dismissible={false}
            action={{
              label: 'Retry',
              handler: onReextract,
            }}
            className="content-preview-error"
          />
        ) : (
          // Show content or loading state in collapsible
          <div
            className="content-preview-wrapper"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Collapsible
              header={headerContent}
              initialCollapsed={true}
              className="content-preview-collapsible"
              headerClassName="content-preview-header-button"
              showChevron={false}
              chevronPosition="right"
              onToggle={expanded => {
                setIsExpanded(expanded);
              }}
            >
              {loading ? (
                <div className="content-preview-loading">
                  <p>Extracting webpage content...</p>
                </div>
              ) : content ? (
                <div className="content-preview-content">
                  {/* Content excerpt with proper truncation */}
                  {excerpt && (
                    <div className="content-preview-excerpt">
                      <p>{excerpt}</p>
                    </div>
                  )}

                  {/* Overlay badges and actions on bottom right corner */}
                  <div className="content-preview-overlay-actions">
                    {truncated && <span className="content-preview-badge">Truncated</span>}
                    {hasCodeBlocks && <span className="content-preview-badge">Code</span>}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onReextract();
                      }}
                      className="content-preview-refresh-inline"
                      title="Re-extract content"
                      aria-label="Re-extract content"
                    >
                      <RegenerateIcon size={14} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setShowFullContent(true);
                      }}
                      className="content-preview-expand-inline"
                      title="View full content"
                      aria-label="View full content"
                    >
                      <ExpandIcon size={14} />
                    </button>
                  </div>
                </div>
              ) : null}
            </Collapsible>
          </div>
        )}
      </div>

      {/* Full Content Modal */}
      <FullscreenModal
        isOpen={showFullContent}
        onClose={() => setShowFullContent(false)}
        title={content ? content.title : 'Page Content'}
        subtitle={content ? content.url : undefined}
        maxWidth="72vw"
        maxHeight="72vh"
        className="content-full-modal"
      >
        {content && (
          <>
            {/* Content metadata badges */}
            {(truncated || hasCodeBlocks) && (
              <div className="full-content-badges">
                {truncated && <span className="full-content-badge-error">Truncated</span>}
                {hasCodeBlocks && <span className="full-content-badge-info">Contains code</span>}
              </div>
            )}

            {/* Full content display */}
            <pre className="full-content-pre">
              {content.content || content.markdown || content.textContent || ''}
            </pre>
          </>
        )}
      </FullscreenModal>
    </>
  );
};

export default TabContentItem;
