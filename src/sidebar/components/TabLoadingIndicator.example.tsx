import React, { useState } from 'react';
import { TabLoadingIndicator } from './TabLoadingIndicator';
import type { TabLoadingIndicatorStatus, TabLoadingIndicatorSize } from './TabLoadingIndicator';

/**
 * Example usage of TabLoadingIndicator component
 * This file demonstrates various states and sizes of the loading indicator
 */
export const TabLoadingIndicatorExample: React.FC = () => {
  const [status, setStatus] = useState<TabLoadingIndicatorStatus>('idle');
  const [size, setSize] = useState<TabLoadingIndicatorSize>('medium');

  const handleRetry = () => {
    setStatus('loading');
    // Simulate loading process
    setTimeout(() => {
      setStatus('error');
    }, 2000);
  };

  const handleStartLoading = () => {
    setStatus('loading');
    setTimeout(() => setStatus('idle'), 3000);
  };

  const handleSimulateError = () => {
    setStatus('error');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>TabLoadingIndicator Examples</h2>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Status:</label>
          <button onClick={() => setStatus('idle')} disabled={status === 'idle'}>
            Idle
          </button>
          <button onClick={handleStartLoading} disabled={status === 'loading'}>
            Loading
          </button>
          <button onClick={handleSimulateError} disabled={status === 'error'}>
            Error
          </button>
        </div>
        
        <div>
          <label style={{ marginRight: '10px' }}>Size:</label>
          <select value={size} onChange={(e) => setSize(e.target.value as TabLoadingIndicatorSize)}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      {/* Current State Demo */}
      <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Current State: {status} ({size})</h3>
        <TabLoadingIndicator
          status={status}
          size={size}
          loadingText="Extracting tab content..."
          errorMessage="Failed to extract tab content"
          onRetry={handleRetry}
        />
      </div>

      {/* All States Demo */}
      <h3>All States and Sizes</h3>
      
      {/* Loading States */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Loading States</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <strong>Small:</strong>
            <TabLoadingIndicator
              status="loading"
              size="small"
              loadingText="Loading..."
            />
          </div>
          <div>
            <strong>Medium:</strong>
            <TabLoadingIndicator
              status="loading"
              size="medium"
              loadingText="Extracting content..."
            />
          </div>
          <div>
            <strong>Large:</strong>
            <TabLoadingIndicator
              status="loading"
              size="large"
              loadingText="Processing tab data..."
            />
          </div>
        </div>
      </div>

      {/* Error States */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Error States</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <strong>Small (with retry):</strong>
            <TabLoadingIndicator
              status="error"
              size="small"
              errorMessage="Load failed"
              onRetry={() => {}}
            />
          </div>
          <div>
            <strong>Medium (with retry):</strong>
            <TabLoadingIndicator
              status="error"
              size="medium"
              errorMessage="Failed to extract content"
              onRetry={() => {}}
            />
          </div>
          <div>
            <strong>Large (no retry):</strong>
            <TabLoadingIndicator
              status="error"
              size="large"
              errorMessage="Tab content extraction failed"
            />
          </div>
        </div>
      </div>

      {/* Compact Usage */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Compact Usage (no text)</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <TabLoadingIndicator
            status="loading"
            size="small"
            showText={false}
          />
          <TabLoadingIndicator
            status="error"
            size="small"
            showText={false}
            onRetry={() => {}}
          />
        </div>
      </div>

      {/* Use Cases */}
      <div>
        <h4>Real-world Use Cases</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
              In Tab Mention Dropdown Item:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📄 Page Title</span>
              <TabLoadingIndicator
                status="loading"
                size="small"
                loadingText="Loading..."
              />
            </div>
          </div>
          
          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
              In Multi-tab Content Preview:
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Selected Tabs (2)</div>
              <TabLoadingIndicator
                status="error"
                size="medium"
                errorMessage="Failed to load content from 1 tab"
                onRetry={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabLoadingIndicatorExample;