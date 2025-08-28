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
import { getFaviconUrlSync } from '@/sidebar/utils/favicon';

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
                  src={getFaviconUrlSync(content.url || '', undefined, { size: 16 }).url}
                  alt=""
                  className="content-preview-favicon"
                  width="16"
                  height="16"
                  onError={e => {
                    // Use fallback from favicon utility
                    const fallback = getFaviconUrlSync('', undefined, { size: 16 });
                    (e.target as HTMLImageElement).src = fallback.url;
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
                <div className="content-preview-content" style={{ position: 'relative' }}>
                  {/* Content excerpt */}
                  {excerpt && (
                    <div className="content-preview-excerpt">
                      <p>{excerpt}</p>
                    </div>
                  )}
                  {/* Overlay badges and actions on bottom right corner */}
                  <div
                    className="content-preview-overlay-actions"
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'transparent',
                      padding: '0',
                    }}
                  >
                    {truncated && (
                      <span
                        className="content-preview-truncated"
                        style={{ fontSize: '10px', opacity: 0.7 }}
                      >
                        Truncated
                      </span>
                    )}
                    {hasCodeBlocks && <span style={{ fontSize: '10px', opacity: 0.7 }}>Code</span>}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onReextract();
                      }}
                      className="content-preview-refresh-inline"
                      title="Re-extract content"
                      aria-label="Re-extract content"
                      style={{
                        padding: '4px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >
                      <RegenerateIcon size={14} />
                    </button>
                    <button
                      onClick={() => setShowFullContent(true)}
                      className="content-preview-expand-inline"
                      title="View full content"
                      aria-label="View full content"
                      style={{
                        padding: '4px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >
                      <ExpandIcon size={14} />
                    </button>
                  </div>

                  {/* Truncation warning */}
                  {truncated && (
                    <div className="content-preview-truncation-warning">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 9v4" />
                        <circle cx="12" cy="17" r="1" />
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                      <span>Content was truncated due to size limits.</span>
                    </div>
                  )}

                  {/* Removed author and date metadata */}
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              color: '#ffffff',
            }}
          >
            {/* Content metadata */}
            <div
              style={{
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                {truncated && (
                  <span
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    Truncated
                  </span>
                )}
                {hasCodeBlocks && (
                  <span
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    Contains code
                  </span>
                )}
              </div>
            </div>

            {/* Full content with better formatting */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                background: 'rgba(26, 26, 26, 0.8)' /* Match chat panel background */,
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: 0,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  color: '#e5e7eb',
                  // Prevent host page CSS from forcing a white card look
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                }}
              >
                {content.content || content.markdown || content.textContent || ''}
              </pre>
            </div>
          </div>
        )}
      </FullscreenModal>
    </>
  );
};

export default TabContentItem;
