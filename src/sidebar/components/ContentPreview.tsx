/**
 * @file Content Preview Component
 *
 * Component for displaying extracted webpage content in a compact preview format.
 * Shows title, domain, and excerpt with loading and error states.
 */

import React from 'react';
import type { ExtractedContent } from '@/types/extraction';
import { Spinner } from '@ui/Spinner';
import { Alert } from '@ui/Alert';
import { Collapsible } from '@ui/Collapsible';
import { RegenerateIcon } from '@ui/Icons';

export interface ContentPreviewProps {
  /** Extracted content data */
  content: ExtractedContent | null;
  /** Loading state during extraction */
  loading: boolean;
  /** Error state if extraction fails */
  error: Error | null;
  /** Function to trigger re-extraction */
  onReextract: () => void;
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
  className = '',
}) => {
  const wordCount = content?.metadata?.wordCount ?? content?.wordCount ?? 0;
  const hasCodeBlocks = content?.metadata?.hasCodeBlocks ?? content?.hasCode ?? false;
  const hasTables = content?.metadata?.hasTables ?? content?.hasTables ?? false;

  // Generate excerpt if not provided
  const excerpt =
    content?.excerpt || (content?.textContent ? content.textContent.substring(0, 200) + '...' : '');

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
            <span className="content-preview-title">{content.title}</span>
            <span className="content-preview-domain">{content.domain}</span>
          </div>
          {!isCollapsed && (
            <button
              onClick={e => {
                e.stopPropagation();
                onReextract();
              }}
              className="content-preview-refresh"
              title="Re-extract content"
              aria-label="Re-extract content"
            >
              <RegenerateIcon size={16} />
            </button>
          )}
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
          className="content-preview-collapsible"
          showChevron={true}
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
                <span>{wordCount.toLocaleString()} words</span>
                {hasCodeBlocks && <span>Code</span>}
                {hasTables && <span>Tables</span>}
                <span className="content-preview-method">{content.extractionMethod}</span>
              </div>

              {/* Content excerpt */}
              {excerpt && (
                <div className="content-preview-excerpt">
                  <p>{excerpt}</p>
                </div>
              )}

              {/* Additional metadata if available */}
              {(content.author || content.publishedDate) && (
                <div className="content-preview-meta">
                  {content.author && (
                    <span className="content-preview-author">By {content.author}</span>
                  )}
                  {content.publishedDate && (
                    <span className="content-preview-date">{content.publishedDate}</span>
                  )}
                </div>
              )}

              {/* Re-extract button in expanded view */}
              <div className="content-preview-actions">
                <button
                  onClick={onReextract}
                  className="content-preview-reextract-button"
                  disabled={loading}
                >
                  <RegenerateIcon size={16} />
                  Re-extract content
                </button>
              </div>
            </div>
          ) : null}
        </Collapsible>
      )}
    </div>
  );
};

export default ContentPreview;
