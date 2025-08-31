import React from 'react';
import type { TabInfo } from '@/types/tabs';
import { getDomSafeFaviconUrlSync } from '@/sidebar/utils/favicon';

export interface TabChipProps {
  /** Tab information to display */
  tabInfo: TabInfo;
  /** Callback fired when chip is removed */
  onRemove: (tabId: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show full title on hover (default: true) */
  showTooltip?: boolean;
  /** Maximum title length before truncation (default: 20) */
  maxTitleLength?: number;
}

/**
 * TabChip Component
 *
 * Displays a tab as a removable chip showing favicon, truncated title, and close button.
 * Used in the ChatInput to show currently loaded tabs.
 */
export const TabChip: React.FC<TabChipProps> = ({
  tabInfo,
  onRemove,
  className = '',
  showTooltip = true,
  maxTitleLength = 20,
}) => {
  // Truncate title if it's too long
  const truncatedTitle =
    tabInfo.title.length > maxTitleLength
      ? `${tabInfo.title.slice(0, maxTitleLength)}...`
      : tabInfo.title;

  // Handle remove click
  const handleRemoveClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove(tabInfo.id);
  };

  // Handle keyboard navigation for remove button
  const handleRemoveKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onRemove(tabInfo.id);
    }
  };

  return (
    <div
      className={`tab-chip${className ? ` ${className}` : ''}`}
      title={showTooltip ? tabInfo.title : undefined}
      role="group"
      aria-label={`Tab: ${tabInfo.title}`}
    >
      {/* Favicon */}
      <div className="tab-chip__favicon">
        {(() => {
          const faviconResult = getDomSafeFaviconUrlSync(tabInfo.url, tabInfo.favIconUrl, 16);
          return (
            <img
              src={faviconResult.url}
              alt=""
              className="tab-chip__favicon-image"
              loading="eager"
              decoding="async"
              onError={e => {
                // Fallback to Google service or generic icon on error
                const fallbackResult = getDomSafeFaviconUrlSync(tabInfo.url, undefined, 16);
                if (fallbackResult.url !== e.currentTarget.src) {
                  e.currentTarget.src = fallbackResult.url;
                }
              }}
              title={faviconResult.isFallback ? `Favicon from ${faviconResult.source}` : undefined}
            />
          );
        })()}
      </div>

      {/* Tab title */}
      <span className="tab-chip__title">{truncatedTitle}</span>

      {/* Remove button */}
      <button
        type="button"
        className="tab-chip__remove"
        onClick={handleRemoveClick}
        onKeyDown={handleRemoveKeyDown}
        aria-label={`Remove tab: ${tabInfo.title}`}
        tabIndex={0}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export default TabChip;
