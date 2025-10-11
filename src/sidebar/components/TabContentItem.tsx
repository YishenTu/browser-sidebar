/**
 * @file Tab Content Item Component
 *
 * Component for displaying extracted content from a single browser tab.
 * Shows title, domain, and excerpt with loading and error states.
 * Used as the atomic unit within ContentPreview for tab scenarios.
 */

import React, { useState, useCallback } from 'react';
import type { ExtractedContent, ImageExtractedContent } from '@/types/extraction';
import type { TabInfo } from '@/types/tabs';
import { ExtractionMode, isImageExtractedContent } from '@/types/extraction';
import { Spinner } from '@ui/Spinner';
import { Alert } from '@ui/Alert';
// Badge imported but not used - removed
import { Collapsible } from '@ui/Collapsible';
import { ExpandIcon, CloseIcon } from '@ui/Icons';
import { FullscreenModal } from '@ui/FullscreenModal';
import { useSessionStore, useTabStore } from '@/data/store/chat';
import { useSessionManager } from '@hooks/useSessionManager';
import { useSettingsStore } from '@/data/store/settings';
import { getDomSafeFaviconUrlSync } from '@core/utils/favicon';
import '../styles/4-features/tab-content-item.css';

export interface TabContentItemProps {
  /** Extracted content data */
  content: ExtractedContent | null;
  /** Loading state during extraction */
  loading: boolean;
  /** Error state if extraction fails */
  error: Error | null;
  /** Function to trigger re-extraction with optional mode */
  onReextract: (options?: { mode?: ExtractionMode }) => void;
  /** Function to clear extracted content */
  onClearContent?: () => void;
  /** Callback when content is edited */
  onContentEdit?: (tabId: number | string, editedContent: string) => void;
  /** Custom CSS class */
  className?: string;
  /** Optional tab identifier for tab scenarios */
  tabId?: number | string;
  /** Optional tab info for enhanced favicon support */
  tabInfo?: TabInfo;
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
  onContentEdit,
  className = '',
  tabId,
  tabInfo,
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const truncated = content?.metadata?.truncated ?? false;

  // Check if current provider is Gemini for URL Context button
  const getProviderTypeForModel = useSettingsStore(state => state.getProviderTypeForModel);
  const selectedModel = useSettingsStore(state => state.settings.selectedModel);
  const currentProvider = getProviderTypeForModel(selectedModel);
  const isGeminiProvider = currentProvider === 'gemini';

  // Tab store for updating URL context flag
  const tabStore = useTabStore();
  const loadedTabs = tabStore.getLoadedTabs();
  const currentTabData = tabId !== undefined ? loadedTabs[tabId as number] : null;
  const useUrlContext = currentTabData?.metadata?.useUrlContext ?? false;

  // Handler to toggle URL context mode
  const handleToggleUrlContext = useCallback(() => {
    if (tabId === undefined) return;

    const currentTabs = tabStore.getLoadedTabs();
    const tab = currentTabs[tabId as number];
    if (!tab) return;

    const currentValue = tab.metadata?.useUrlContext === true;
    const updatedTab = {
      ...tab,
      metadata: {
        ...tab.metadata,
        useUrlContext: !currentValue,
      },
    };

    tabStore.addLoadedTab(tabId as number, updatedTab);
  }, [tabId, tabStore]);

  // Check if editing should be disabled for current session
  const { getSessionMessageCount } = useSessionStore();
  const { currentSession } = useSessionManager();

  // Disable editing if the current session has messages
  const isEditDisabled = currentSession
    ? getSessionMessageCount(currentSession.tabId, currentSession.url) > 0
    : false;

  // Resolve image content (if present)
  const imageContent: ImageExtractedContent | null =
    content?.content &&
    typeof content.content === 'object' &&
    isImageExtractedContent(content.content)
      ? content.content
      : null;

  const isImageContent = Boolean(imageContent);

  // Get image data URL if it's an image content
  const imageDataUrl = imageContent?.dataUrl ?? null;
  const isImageUploading = imageContent?.uploadState === 'uploading';
  const hasImageReference = Boolean(imageContent && (imageContent.fileUri || imageContent.fileId));

  // Unified display: Extract plain text from whatever content is available
  let displayText = '';
  if (content && !isImageContent) {
    // Priority: textContent > excerpt > extract from content field
    if (content.textContent && content.textContent.trim()) {
      displayText = content.textContent;
    } else if (content.excerpt && content.excerpt.trim()) {
      displayText = content.excerpt;
    } else if (content.content && typeof content.content === 'string') {
      // Extract plain text from markdown/HTML content field
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content.content;
      displayText = tempDiv.textContent || tempDiv.innerText || '';
    }

    // Clean up excessive whitespace but preserve paragraph breaks
    displayText = displayText
      .trim()
      .replace(/\n\s*\n/g, '\n') // Collapse multiple blank lines to single
      .replace(/[ \t]+/g, ' '); // Normalize spaces/tabs but keep newlines

    // No character truncation - let CSS handle overflow with fixed height
  }
  const excerpt = displayText;

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
              <CloseIcon size={12} />
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
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      );
    }

    if (content) {
      // Use favicon utility for better caching and browser favicon support
      const faviconResult = getDomSafeFaviconUrlSync(
        tabInfo?.url || content.url || 'https://example.com',
        tabInfo?.favIconUrl,
        16
      );

      return (
        <div className="content-preview-header">
          <div className="content-preview-header-content">
            <div className="content-preview-header-main">
              <div className="content-preview-title-wrapper">
                <img
                  src={faviconResult.url}
                  alt=""
                  className="content-preview-favicon"
                  width="16"
                  height="16"
                  loading="eager"
                  decoding="async"
                  onError={e => {
                    const fallback = getDomSafeFaviconUrlSync(
                      tabInfo?.url || content.url || '',
                      undefined,
                      16
                    );
                    if (fallback.url && fallback.url !== (e.target as HTMLImageElement).src) {
                      (e.target as HTMLImageElement).src = fallback.url;
                    } else {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }
                  }}
                />
                <span className="content-preview-title">{content.title}</span>
              </div>
            </div>
          </div>
          {/* Show both image badge and close button when appropriate */}
          <div className="content-preview-header-actions">
            {isImageContent && !isImageUploading && hasImageReference && isCollapsed && (
              <span className="content-preview-badge content-preview-badge--image">Image</span>
            )}
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
                <CloseIcon size={12} />
              </button>
            )}
          </div>
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
            <CloseIcon size={12} />
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
              handler: () => onReextract(),
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
                <div
                  className={`content-preview-content ${isImageContent ? 'content-preview-content--image' : ''}`}
                >
                  {/* Show image preview or text excerpt based on content type */}
                  {isImageContent ? (
                    <div className="content-preview-image-container">
                      <div className="content-preview-image-scroll">
                        {imageDataUrl ? (
                          <img
                            src={imageDataUrl}
                            alt="Screenshot preview"
                            className="content-preview-image-thumbnail"
                            loading="lazy"
                          />
                        ) : (
                          <>
                            <div className="content-preview-image-badge">📷 Screenshot content</div>
                            <p className="content-preview-image-description">
                              This tab contains a screenshot image that will be sent with your
                              message.
                            </p>
                          </>
                        )}
                      </div>
                      {isImageUploading && (
                        <div className="content-preview-image-uploading">
                          <Spinner size="sm" />
                          <span>Uploading image...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    excerpt && (
                      <div className="content-preview-excerpt">
                        <p>{excerpt}</p>
                      </div>
                    )
                  )}

                  {/* Actions row - debug info and buttons on new row */}
                  <div className="content-preview-actions-row">
                    {/* Debug: Show content info */}
                    {!isImageContent && content.content && (
                      <div className="content-preview-debug-info">
                        Length: {typeof content.content === 'string' ? content.content.length : 0}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="content-preview-action-buttons">
                      {/* Show badges based on content type */}
                      {isImageContent ? (
                        <span className="content-preview-badge content-preview-badge--image">
                          {isImageUploading ? 'Uploading...' : 'Image'}
                        </span>
                      ) : (
                        <>
                          {truncated && <span className="content-preview-badge">Truncated</span>}
                          {useUrlContext && (
                            <span className="content-preview-badge content-preview-badge--url-context">
                              URL Context
                            </span>
                          )}
                          {!useUrlContext && content?.extractionMethod === 'raw' && (
                            <span className="content-preview-badge content-preview-badge--raw">
                              Raw
                            </span>
                          )}
                          {!useUrlContext && content?.extractionMethod === 'readability' && (
                            <span className="content-preview-badge content-preview-badge--readability">
                              Readability
                            </span>
                          )}
                          {!useUrlContext && content?.extractionMethod === 'defuddle' && (
                            <span className="content-preview-badge content-preview-badge--defuddle">
                              Defuddle
                            </span>
                          )}
                        </>
                      )}

                      {/* Extraction buttons - always show for re-extraction */}
                      {/* Readability Mode button - default clean extraction */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Re-extract with Readability mode (default)
                          onReextract({ mode: ExtractionMode.READABILITY });
                        }}
                        className="content-preview-readability-inline content-preview-extraction-button"
                        title={
                          isImageContent
                            ? 'Extract text with Readability'
                            : 'Extract with Readability (default clean extraction)'
                        }
                        aria-label="Extract with Readability"
                      >
                        R
                      </button>
                      {/* Defuddle button - alternative extraction */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Re-extract with defuddle method
                          onReextract({ mode: ExtractionMode.DEFUDDLE });
                        }}
                        className="content-preview-defuddle-inline content-preview-extraction-button"
                        title={
                          isImageContent
                            ? 'Extract text with Defuddle'
                            : 'Extract with Defuddle (alternative method)'
                        }
                        aria-label="Extract with Defuddle"
                      >
                        D
                      </button>
                      {/* Raw Mode button - for table-heavy pages */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Just re-extract the current tab with raw mode
                          onReextract({ mode: ExtractionMode.RAW });
                        }}
                        className="content-preview-raw-inline content-preview-extraction-button"
                        title={
                          isImageContent
                            ? 'Extract text with Raw HTML'
                            : 'Extract with Raw HTML (preserves tables)'
                        }
                        aria-label="Extract in Raw Mode"
                      >
                        H
                      </button>
                      {/* URL Context button - Gemini only, sends URL instead of content */}
                      {isGeminiProvider && !isImageContent && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            // Toggle URL Context mode (Gemini only)
                            handleToggleUrlContext();
                          }}
                          className={`content-preview-url-context-inline content-preview-extraction-button ${useUrlContext ? 'active' : ''}`}
                          title={
                            useUrlContext
                              ? 'URL Context enabled - Gemini fetches from URL (click to disable)'
                              : 'Enable URL Context - Gemini will fetch content directly from URL'
                          }
                          aria-label="Toggle URL Context mode"
                        >
                          U
                        </button>
                      )}

                      {/* Expand button - only show for text content */}
                      {!isImageContent && (
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
                      )}
                    </div>
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
        editable={!!content && !isEditDisabled}
        content={
          editedContent !== null
            ? editedContent
            : (typeof content?.content === 'string' ? content.content : content?.textContent) || ''
        }
        edited={editedContent !== null}
        onContentSave={newContent => {
          setEditedContent(newContent);
          if (tabId && onContentEdit) {
            onContentEdit(tabId, newContent);
          }
        }}
        truncated={truncated}
        onRegenerate={() => {
          // Reset edited content and trigger re-extraction
          setEditedContent(null);
          onReextract();
        }}
      />
    </>
  );
};

export default TabContentItem;
