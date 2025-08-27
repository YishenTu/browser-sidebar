/**
 * @file Content Extraction Example Component
 *
 * Example component demonstrating how to use the useContentExtraction hook
 * for extracting content from the current tab. This is a demo component
 * showing the hook's usage patterns.
 */

import React, { useState } from 'react';
import { useContentExtraction } from '../hooks/useContentExtraction';
import { ExtractionMode } from '@/types/extraction';
import { ExtractionModeSelector } from './ExtractionModeSelector';

/**
 * Example component showing useContentExtraction hook usage
 */
export function ContentExtractionExample(): React.ReactElement {
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(ExtractionMode.DEFUDDLE);
  const { content, loading, error, extractContent, reextract } = useContentExtraction();

  return (
    <div className="content-extraction-example" style={{ padding: '16px' }}>
      <h3>Content Extraction Demo</h3>

      {/* Mode selector */}
      <ExtractionModeSelector
        mode={extractionMode}
        onModeChange={setExtractionMode}
        disabled={loading}
      />

      {/* Control buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => extractContent({ mode: extractionMode })}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Extracting...' : 'Extract Content'}
        </button>

        <button
          onClick={() => reextract({ mode: extractionMode })}
          disabled={loading || !content}
          style={{
            padding: '8px 16px',
            backgroundColor: loading || !content ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !content ? 'not-allowed' : 'pointer',
          }}
        >
          Re-extract
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ color: '#666', fontStyle: 'italic' }}>
          Extracting content from the current tab...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            color: '#dc3545',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Content display */}
      {content && !loading && (
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '16px' }}>
          <h4>Extracted Content</h4>

          {/* Content metadata */}
          <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
            <div>
              <strong>Title:</strong> {content.title}
            </div>
            <div>
              <strong>URL:</strong> {content.url}
            </div>
            <div>
              <strong>Domain:</strong> {content.domain}
            </div>
            <div>
              <strong>Word Count:</strong> {content.metadata?.wordCount ?? content.wordCount ?? 0}
            </div>
            <div>
              <strong>Extraction Method:</strong> {content.extractionMethod}
            </div>
            <div>
              <strong>Extraction Mode:</strong> {extractionMode}
            </div>
            <div>
              <strong>Extraction Time:</strong> {content.extractionTime ?? 0}ms
            </div>
            {content.author && (
              <div>
                <strong>Author:</strong> {content.author}
              </div>
            )}
            {content.publishedDate && (
              <div>
                <strong>Published:</strong> {content.publishedDate}
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px' }}>
              <span>
                <strong>Has Code:</strong>{' '}
                {(content.metadata?.hasCodeBlocks ?? content.hasCode) ? 'Yes' : 'No'}
              </span>
              <span>
                <strong>Has Tables:</strong>{' '}
                {(content.metadata?.hasTables ?? content.hasTables) ? 'Yes' : 'No'}
              </span>
              <span>
                <strong>Truncated:</strong>{' '}
                {(content.metadata?.truncated ?? content.isTruncated) ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Content excerpt */}
          <div style={{ marginBottom: '16px' }}>
            <h5>Excerpt</h5>
            <p
              style={{
                fontStyle: 'italic',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                borderRadius: '4px',
              }}
            >
              {content.excerpt}
            </p>
          </div>

          {/* Full content (first 500 characters) */}
          <div>
            <h5>Content Preview</h5>
            <div
              style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '200px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {(content.content || content.markdown || '').length > 500
                ? (content.content || content.markdown || '').substring(0, 500) + '...'
                : content.content || content.markdown || ''}
            </div>
          </div>
        </div>
      )}

      {/* No content state */}
      {!content && !loading && !error && (
        <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
          Click &ldquo;Extract Content&rdquo; to extract content from the current tab
        </div>
      )}
    </div>
  );
}

/**
 * Auto-extraction example component
 */
export function AutoContentExtractionExample(): React.ReactElement {
  // Auto-extract content on mount
  const { content, loading, error } = useContentExtraction(true);

  return (
    <div className="auto-content-extraction-example" style={{ padding: '16px' }}>
      <h3>Auto Content Extraction Demo</h3>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
        This component automatically extracts content when it mounts.
      </p>

      {loading && <div style={{ color: '#007acc' }}>Auto-extracting content...</div>}

      {error && <div style={{ color: '#dc3545' }}>Auto-extraction failed: {error.message}</div>}

      {content && (
        <div style={{ border: '1px solid #28a745', borderRadius: '4px', padding: '12px' }}>
          <h5 style={{ color: '#28a745', marginTop: 0 }}>✓ Content Extracted</h5>
          <div style={{ fontSize: '14px' }}>
            <div>
              <strong>{content.title}</strong>
            </div>
            <div>
              {content.metadata?.wordCount ?? content.wordCount ?? 0} words from {content.domain}
            </div>
            {content.author && <div>By {content.author}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
