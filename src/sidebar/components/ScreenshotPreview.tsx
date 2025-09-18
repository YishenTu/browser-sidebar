import React from 'react';
export interface ScreenshotPreviewData {
  /** Data URL of the captured screenshot */
  dataUrl: string;
  /** Natural width in pixels */
  width: number;
  /** Natural height in pixels */
  height: number;
  /** Timestamp when capture completed */
  capturedAt: number;
  /** Capture duration in milliseconds */
  durationMs?: number;
  /** Identifier for the capture method used */
  captureMethod?: string;
  /** Whether captureBeyondViewport succeeded */
  captureBeyondViewport?: boolean;
}

export interface ScreenshotPreviewProps {
  /** Latest screenshot result */
  screenshot: ScreenshotPreviewData | null;
  /** Close the preview container */
  onClose: () => void;
  /** Optional handler when the user wants to use the pasted image */
  onUseImage?: () => void;
}

export const ScreenshotPreview: React.FC<ScreenshotPreviewProps> = ({
  screenshot,
  onClose,
  onUseImage,
}) => {
  if (!screenshot?.dataUrl) {
    return null;
  }

  return (
    <section
      className="ai-sidebar-screenshot-preview"
      aria-label="Screenshot preview"
      data-testid="screenshot-preview"
    >
      <div className="ai-sidebar-screenshot-preview__actions">
        <button
          type="button"
          className="ai-sidebar-screenshot-preview__button"
          onClick={() => onUseImage?.()}
        >
          Use Image
        </button>
        <button type="button" className="ai-sidebar-screenshot-preview__button" onClick={onClose}>
          Dismiss
        </button>
      </div>
      <div className="ai-sidebar-screenshot-preview__image">
        <img src={screenshot.dataUrl} alt="Screenshot preview" loading="lazy" />
      </div>
    </section>
  );
};

export default ScreenshotPreview;
