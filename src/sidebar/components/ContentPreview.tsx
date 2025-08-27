/**
 * @file Content Preview Component
 *
 * Component for displaying extracted webpage content in a compact preview format.
 * Shows title, domain, and excerpt with loading and error states.
 */

import React, { useState } from 'react';
import type { ExtractedContent } from '@/types/extraction';
import {
  scoreContentQuality,
  getQualityDescription,
  getQualityBadgeVariant,
} from '@tabext/contentQuality';
import { Spinner } from '@ui/Spinner';
import { Alert } from '@ui/Alert';
import { Badge } from '@ui/Badge';
import { Collapsible } from '@ui/Collapsible';
import { RegenerateIcon, ExpandIcon } from '@ui/Icons';
import { Modal } from '@ui/Modal';

export interface ContentPreviewProps {
  /** Extracted content data */
  content: ExtractedContent | null;
  /** Loading state during extraction */
  loading: boolean;
  /** Error state if extraction fails */
  error: Error | null;
  /** Function to trigger re-extraction */
  onReextract: () => void;
  /** Pre-calculated quality assessment (optional) */
  qualityAssessment?: ReturnType<typeof scoreContentQuality> | null;
  /** Custom CSS class */
  className?: string;
}

/**
 * Content Preview Component
 *
 * Displays extracted webpage content in a compact, collapsible format.
 * Shows key metadata like title, domain, and excerpt with error handling.
 */
export const ContentPreview: React.FC<ContentPreviewProps> = ({
  content,
  loading,
  error,
  onReextract,
  qualityAssessment: providedQualityAssessment,
  className = '',
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const wordCount = content?.metadata?.wordCount ?? content?.wordCount ?? 0;
  const hasCodeBlocks = content?.metadata?.hasCodeBlocks ?? content?.hasCode ?? false;
  const hasTables = content?.metadata?.hasTables ?? content?.hasTables ?? false;
  const truncated = content?.metadata?.truncated ?? content?.isTruncated ?? false;

  // Generate excerpt if not provided
  const excerpt =
    content?.excerpt || (content?.textContent ? content.textContent.substring(0, 200) + '...' : '');

  // Use provided quality assessment or calculate it
  const qualityAssessment =
    providedQualityAssessment ?? (content ? scoreContentQuality(content) : null);

  // Create header content for collapsible
  const headerContent = (isCollapsed: boolean) => {
    if (loading) {
      return (
        <div className="content-preview-header">
          <Spinner size="sm" />
          <span>Extracting content...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="content-preview-header content-preview-header--error">
          <span>Content extraction failed</span>
        </div>
      );
    }

    if (content) {
      return (
        <div className="content-preview-header">
          <div className="content-preview-header-main">
            <div className="content-preview-title-wrapper">
              <img 
                src={`https://www.google.com/s2/favicons?domain=${content.domain}&sz=16`}
                alt=""
                className="content-preview-favicon"
                width="16"
                height="16"
                onError={(e) => {
                  // Fallback to a generic icon if favicon fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="content-preview-title">{content.title}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="content-preview-header">
        <span>Page content</span>
      </div>
    );
  };

  // If there's no content and no loading/error, don't render anything
  if (!content && !loading && !error) {
    return null;
  }

  return (
    <>
      <div className={`content-preview ${className}`}>
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
        <Collapsible
          header={headerContent}
          initialCollapsed={true}
          className={`content-preview-collapsible ${
            qualityAssessment
              ? `content-preview-quality-${qualityAssessment.qualityLevel}`
              : ''
          }`}
          showChevron={false}
          chevronPosition="right"
        >
          {loading ? (
            <div className="content-preview-loading">
              <p>Extracting webpage content...</p>
            </div>
          ) : content ? (
            <div className="content-preview-content">
              {/* Content metadata */}
              <div className="content-preview-stats">
                <div className="content-preview-stats-badges">
                  <span>{wordCount.toLocaleString()} words</span>
                  {truncated && <span className="content-preview-truncated">Truncated</span>}
                  {hasCodeBlocks && <span>Code</span>}
                  {hasTables && <span>Tables</span>}
                  <span className="content-preview-method">
                    {content.extractionMethod === 'readability' ? 'Readability' : 
                     content.extractionMethod === 'defuddle' ? 'Smart' :
                     content.extractionMethod === 'comprehensive' ? 'Full' :
                     content.extractionMethod === 'selection' ? 'Selection' :
                     content.extractionMethod === 'fallback' ? 'Fallback' : 
                     'Unknown'}
                  </span>
                </div>
                <div className="content-preview-stats-actions">
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
                    onClick={() => setShowFullContent(true)}
                    className="content-preview-expand-inline"
                    title="View full content"
                    aria-label="View full content"
                  >
                    <ExpandIcon size={14} />
                  </button>
                </div>
              </div>

              {/* Quality assessment removed - now shown via border color */}

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

              {/* Content excerpt */}
              {excerpt && (
                <div className="content-preview-excerpt">
                  <p>{excerpt}</p>
                </div>
              )}

              {/* Removed author and date metadata */}
            </div>
          ) : null}
          </Collapsible>
        )}
      </div>

      {/* Full Content Modal */}
      <Modal
        isOpen={showFullContent}
        onClose={() => setShowFullContent(false)}
        title={
          content ? (
            <div className="content-full-modal-title">
              <img 
                src={`https://www.google.com/s2/favicons?domain=${content.domain}&sz=16`}
                alt=""
                className="content-full-modal-favicon"
                width="16"
                height="16"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span>{content.title}</span>
            </div>
          ) : 'Page Content'
        }
        maxWidth="80%"
        className="content-full-modal"
      >
        {content && (
          <div className="content-full-modal-body">
            {/* Content metadata */}
            <div className="content-full-modal-meta">
              <span className="content-full-modal-url">{content.url}</span>
              <div className="content-full-modal-stats">
                <span>{wordCount.toLocaleString()} words</span>
                {truncated && <span className="content-full-modal-truncated">Truncated</span>}
                {hasCodeBlocks && <span>Contains code</span>}
                {hasTables && <span>Contains tables</span>}
              </div>
            </div>

            {/* Full content */}
            <div className="content-full-modal-text">
              <pre>{content.content || content.markdown || content.textContent || ''}</pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ContentPreview;
