/**
 * @file Extraction Mode Selector Component
 *
 * UI component for selecting content extraction mode (Defuddle/Selection).
 * Allows users to choose how content should be extracted from web pages.
 */

import React from 'react';
import { ExtractionMode } from '@/types/extraction';
import { FileText, MousePointer } from './ui/Icons';

interface ExtractionModeSelectorProps {
  /** Current selected extraction mode */
  mode: ExtractionMode;
  /** Callback when extraction mode changes */
  onModeChange: (mode: ExtractionMode) => void;
  /** Whether the selector is disabled during extraction */
  disabled?: boolean;
}

/**
 * Mode selector component for content extraction
 */
export function ExtractionModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: ExtractionModeSelectorProps): React.ReactElement {
  return (
    <div className="extraction-mode-selector">
      <button
        className={`mode-btn ${mode === ExtractionMode.DEFUDDLE ? 'active' : ''}`}
        onClick={() => onModeChange(ExtractionMode.DEFUDDLE)}
        disabled={disabled}
        title="Defuddle extraction (default) - Extract main article content"
        aria-label="Defuddle extraction mode"
      >
        <FileText className="mode-icon" size={16} />
        <span>Defuddle</span>
      </button>

      <button
        className={`mode-btn ${mode === ExtractionMode.SELECTION ? 'active' : ''}`}
        onClick={() => onModeChange(ExtractionMode.SELECTION)}
        disabled={disabled}
        title="Extract only selected text"
        aria-label="Selection extraction mode"
      >
        <MousePointer className="mode-icon" size={16} />
        <span>Selection</span>
      </button>
    </div>
  );
}
