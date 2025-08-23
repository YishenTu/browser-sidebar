/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@store/settings';
import { ThemeProvider } from '@contexts/ThemeContext';
import { ErrorProvider, useError, getErrorSource } from '@contexts/ErrorContext';
import { ErrorBanner } from '@components/ErrorBanner';
import { MessageList } from '@components/MessageList';
import { ChatInput } from '@components/ChatInput';
import { ModelSelector } from '@components/ModelSelector';
import { useChatStore } from '@store/chat';
import { useAIChat } from '@hooks/useAIChat';

// Constants for sizing and positioning
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = typeof window !== 'undefined' ? Math.round(window.innerHeight) : 1000;
const SIDEBAR_HEIGHT_RATIO = 0.85;
const RIGHT_PADDING = 30; // default space from the right edge

export interface ChatPanelProps {
  /** Custom CSS class name */
  className?: string;
  /** Callback when sidebar is closed */
  onClose: () => void;
}

/**
 * Inner ChatPanel Component that uses the error context
 */
const ChatPanelInner: React.FC<ChatPanelProps> = ({ className, onClose }) => {
  // Positioning and sizing state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(Math.round(window.innerHeight * SIDEBAR_HEIGHT_RATIO));
  const [isResizing, setIsResizing] = useState(false);
  const resizeDirRef = useRef<null | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const initialRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const sidebarHeight = height;
  const initialY = Math.round(window.innerHeight * ((1 - SIDEBAR_HEIGHT_RATIO) / 2));
  const [position, setPosition] = useState({
    x: window.innerWidth - DEFAULT_WIDTH - RIGHT_PADDING,
    y: initialY,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Settings store integration
  const theme = useSettingsStore(state => state.settings.theme);
  const selectedModel = useSettingsStore(state => state.settings.selectedModel);
  const updateSelectedModel = useSettingsStore(state => state.updateSelectedModel);
  const getProviderTypeForModel = useSettingsStore(state => state.getProviderTypeForModel);
  const loadSettings = useSettingsStore(state => state.loadSettings);
  const settingsLoading = useSettingsStore(state => state.isLoading);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // Load settings on mount and track when they're ready
  useEffect(() => {
    loadSettings()
      .then(() => {
        setSettingsInitialized(true);
      })
      .catch((error) => {
        console.error('Failed to load settings:', error);
        // Still initialize even if settings fail to load
        // This allows the app to work with default settings
        setSettingsInitialized(true);
      });
    
    // Fallback timeout to ensure we don't get stuck on loading screen
    const timeout = setTimeout(() => {
      // Silently proceed with defaults after timeout
      setSettingsInitialized(true);
    }, 3000); // 3 second timeout
    
    return () => clearTimeout(timeout);
  }, [loadSettings]);

  // Theme is now handled by ThemeContext, no need to apply it here
  // This prevents duplicate theme application and potential flickering

  // Chat store and AI chat integration
  const { messages, isLoading, clearConversation, hasMessages } = useChatStore();
  const { sendMessage, switchProvider, cancelMessage } = useAIChat({
    enabled: true,
    autoInitialize: true, // Auto-initialize providers from settings
  });
  
  // Centralized error management
  const { addError } = useError();

  // API key state for temporary settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState({ openai: '', google: '' });
  const [testingKeys, setTestingKeys] = useState({ openai: false, google: false });
  const [testResults, setTestResults] = useState<{openai?: boolean; google?: boolean}>({});
  const storedApiKeys = useSettingsStore(state => state.settings.apiKeys);
  const updateAPIKeyReferences = useSettingsStore(state => state.updateAPIKeyReferences);
  const resetToDefaults = useSettingsStore(state => state.resetToDefaults);
  
  // Clear API key inputs when settings panel opens (show only placeholders)
  useEffect(() => {
    if (showSettings) {
      setApiKeys({
        openai: '',
        google: ''
      });
      setTestResults({});
    }
  }, [showSettings]);
  
  // Function to mask API key
  const maskApiKey = (key: string | null): string => {
    if (!key || key.length < 8) return '';
    const start = key.substring(0, 4);
    const end = key.substring(key.length - 4);
    return `${start}...${end}`;
  };
  
  // Function to test API key
  const testApiKey = async (provider: 'openai' | 'google', key: string) => {
    // Use the entered key if available, otherwise use the stored key
    const keyToTest = key || (provider === 'openai' ? storedApiKeys.openai : storedApiKeys.google);
    
    if (!keyToTest) {
      alert('Please enter an API key first');
      return;
    }
    
    setTestingKeys(prev => ({ ...prev, [provider]: true }));
    setTestResults(prev => ({ ...prev, [provider]: undefined }));
    
    try {
      // Dynamically import validation service
      const { APIKeyValidationService } = await import('@provider/validation');
      const validator = new APIKeyValidationService();
      
      const providerType = provider === 'openai' ? 'openai' : 'gemini';
      const result = await validator.validateAPIKey(keyToTest, providerType, {
        skipLiveValidation: false,
        timeout: 10000
      });
      
      setTestResults(prev => ({ ...prev, [provider]: result.isValid }));
      
      if (result.isValid) {
        alert(`✅ ${provider === 'openai' ? 'OpenAI' : 'Google'} API key is valid!`);
      } else {
        const errorMsg = result.errors.join(', ') || 'Invalid API key';
        alert(`❌ ${provider === 'openai' ? 'OpenAI' : 'Google'} API key validation failed: ${errorMsg}`);
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [provider]: false }));
      alert(`❌ Failed to test ${provider === 'openai' ? 'OpenAI' : 'Google'} API key: ${error}`);
    } finally {
      setTestingKeys(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        await sendMessage(content, {
          streaming: true,
        });
      } catch (error) {
        // Add error to centralized error context
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        addError({
          message: errorMessage,
          type: 'error',
          source: getErrorSource(error instanceof Error ? error : errorMessage),
          dismissible: true,
        });
      }
    },
    [sendMessage, addError]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (hasMessages() && window.confirm('Clear conversation? This cannot be undone.')) {
      clearConversation();
    }
  }, [hasMessages, clearConversation]);

  // Handle resize and drag mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const dir = resizeDirRef.current;
        const start = startRef.current;
        const initial = initialRectRef.current;
        if (!dir || !start || !initial) return;

        const initialRight = initial.x + initial.width;
        const initialBottom = initial.y + initial.height;

        let nextX = initial.x;
        let nextY = initial.y;
        let nextW = initial.width;
        let nextH = initial.height;

        // Horizontal edges (absolute mouse coordinates relative to opposite edge)
        if (dir.includes('w')) {
          const rawW = initialRight - e.clientX;
          const clampedW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawW));
          nextW = clampedW;
          nextX = initialRight - clampedW;
        }
        if (dir.includes('e')) {
          const rawW = e.clientX - initial.x;
          const clampedW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawW));
          nextW = clampedW;
          nextX = initial.x;
        }

        // Vertical edges
        if (dir.includes('n')) {
          const rawH = initialBottom - e.clientY;
          const clampedH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rawH));
          nextH = clampedH;
          nextY = initialBottom - clampedH;
        }
        if (dir.includes('s')) {
          const rawH = e.clientY - initial.y;
          const clampedH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rawH));
          nextH = clampedH;
          nextY = initial.y;
        }

        setPosition({ x: nextX, y: nextY });
        setWidth(nextW);
        setHeight(nextH);
      }
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsDragging(false);
      resizeDirRef.current = null;
      startRef.current = null;
      initialRectRef.current = null;
    };

    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing, isDragging, dragOffset]);

  // Handle close functionality
  const handleClose = useCallback(() => {
    unmountSidebar();
    chrome.runtime.sendMessage({ type: 'sidebar-closed' });
    onClose();
  }, [onClose]);

  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Auto-focus sidebar when opened for accessibility
  useEffect(() => {
    const sidebar = document.querySelector('.ai-sidebar-overlay') as HTMLElement;
    if (sidebar) {
      sidebar.setAttribute('tabindex', '-1');
      sidebar.focus();
    }
  }, []);

  // Handle header mouse down for dragging
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start dragging if not clicking on close button, clear button, or ModelSelector
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('ai-sidebar-close') ||
        target.closest('.ai-sidebar-clear') ||
        target.closest('.model-selector') ||
        target.closest('button')
      ) {
        return;
      }

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position]
  );

  // Generic resize mouse down handler for any edge/corner
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
      if (isDragging) return;
      resizeDirRef.current = dir;
      startRef.current = { x: e.clientX, y: e.clientY };
      initialRectRef.current = { x: position.x, y: position.y, width, height };
      setIsResizing(true);
      e.preventDefault();
      e.stopPropagation();
    },
    [height, width, position, isDragging]
  );

  // Show loading spinner while settings are being loaded
  if (!settingsInitialized) {
    return (
      <div
        className={`ai-sidebar-overlay ${className || ''}`}
        role="dialog"
        aria-label="AI Browser Sidebar Loading"
        aria-modal="false"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${width}px`,
          height: `${sidebarHeight}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-testid="chat-panel-loading"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⌛</div>
          <div>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ai-sidebar-overlay ${className || ''}`}
      role="dialog"
      aria-label="AI Browser Sidebar"
      aria-modal="false"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${sidebarHeight}px`,
      }}
      data-testid="chat-panel"
    >
      <div className="ai-sidebar-container" data-testid="sidebar-container">
        <div
          className="ai-sidebar-header"
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          data-testid="sidebar-header"
        >
          <div className="ai-sidebar-header-title">
            <ModelSelector
              className="model-selector--header"
              value={selectedModel}
              onChange={async modelId => {
                // Store the previous model for potential rollback
                const previousModel = selectedModel;
                
                try {
                  // Get the provider type for this model
                  const providerType = getProviderTypeForModel(modelId);
                  
                  // Check if the API key exists for this provider
                  const settings = useSettingsStore.getState();
                  const apiKeys = settings.settings.apiKeys;
                  
                  let hasApiKey = false;
                  if (providerType === 'openai') {
                    hasApiKey = !!apiKeys?.openai;
                  } else if (providerType === 'gemini') {
                    hasApiKey = !!apiKeys?.google;
                  }
                  
                  if (!hasApiKey) {
                    // Show settings panel if API key is missing
                    setShowSettings(true);
                    // User will see the settings panel to add API key
                    return;
                  }
                  
                  // Atomic operation: Try to switch both model and provider
                  // If either fails, rollback both
                  try {
                    // First update the model in settings
                    await updateSelectedModel(modelId);
                    
                    // Then switch the provider
                    if (providerType) {
                      await switchProvider(providerType);
                    }
                  } catch (switchError) {
                    // Rollback: Restore previous model if provider switch failed
                    console.error('Provider switch failed, rolling back model selection:', switchError);
                    await updateSelectedModel(previousModel);
                    
                    // Show error to user
                    const errorMsg = switchError instanceof Error ? switchError.message : 'Failed to switch provider';
                    alert(`Failed to switch to ${modelId}: ${errorMsg}`);
                    throw switchError; // Re-throw to be caught by outer catch
                  }
                } catch (err) {
                  // Log error but don't show additional alert if we already showed one
                  console.warn('Failed to switch model/provider:', err);
                }
              }}
              disabled={isLoading}
              aria-label="Select AI model"
            />
            <h2></h2>
          </div>
          <div className="ai-sidebar-header-actions">
            {hasMessages() && (
              <button
                onClick={handleClearConversation}
                className="ai-sidebar-clear"
                aria-label="New session"
                title="Start new session"
                style={{
                  marginRight: '8px',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="ai-sidebar-settings"
              aria-label="Settings"
              title="API Settings"
              style={{
                marginRight: '8px',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="ai-sidebar-close"
              aria-label="Close sidebar"
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Centralized Error Banner */}
        <ErrorBanner />

        <ThemeProvider>
          {showSettings ? (
            <div
              className="ai-sidebar-settings-panel"
              style={{
                padding: '20px',
                overflowY: 'auto',
                height: 'calc(100% - 60px - 70px)',
              }}
            >
              <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 'bold' }}>
                API Settings
              </h3>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  OpenAI API Key (for GPT-5 Nano)
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={storedApiKeys.openai ? maskApiKey(storedApiKeys.openai) : "sk-..."}
                    value={apiKeys.openai}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: testResults.openai === true ? '1px solid #4CAF50' : testResults.openai === false ? '1px solid #f44336' : '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                    onChange={e => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                  />
                  <button
                    onClick={() => testApiKey('openai', apiKeys.openai)}
                    disabled={testingKeys.openai}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: testingKeys.openai ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: testingKeys.openai ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      minWidth: '60px',
                    }}
                  >
                    {testingKeys.openai ? '...' : 'Test'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Google API Key (for Gemini 2.5 Flash Lite)
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={storedApiKeys.google ? maskApiKey(storedApiKeys.google) : "AIza..."}
                    value={apiKeys.google}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: testResults.google === true ? '1px solid #4CAF50' : testResults.google === false ? '1px solid #f44336' : '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                    }}
                    onChange={e => setApiKeys(prev => ({ ...prev, google: e.target.value }))}
                  />
                  <button
                    onClick={() => testApiKey('google', apiKeys.google)}
                    disabled={testingKeys.google}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: testingKeys.google ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: testingKeys.google ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      minWidth: '60px',
                    }}
                  >
                    {testingKeys.google ? '...' : 'Test'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={async () => {
                    try {
                      // Only save non-empty keys, keep existing ones if input is empty
                      const keysToSave = {
                        openai: apiKeys.openai || storedApiKeys.openai,
                        google: apiKeys.google || storedApiKeys.google,
                        openrouter: null
                      };
                      await updateAPIKeyReferences(keysToSave);
                      
                      // Reinitialize providers with new API keys
                      // This ensures the AI chat system immediately uses the new keys
                      const currentProvider = getProviderTypeForModel(selectedModel);
                      if (currentProvider) {
                        await switchProvider(currentProvider);
                      }
                      
                      alert('API keys saved and providers updated! You can start chatting now.');
                      // Clear the input fields after saving
                      setApiKeys({ openai: '', google: '' });
                      setTestResults({});
                    } catch (error) {
                      alert('Failed to save API keys: ' + error);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Save API Keys
                </button>

                <button
                  onClick={async () => {
                    try {
                      await resetToDefaults();
                      alert('Settings reset! Please re-enter your API keys.');
                      window.location.reload();
                    } catch (error) {
                      alert('Failed to reset settings: ' + error);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Reset Settings
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="ai-sidebar-body" 
              data-testid="sidebar-body"
              style={{
                height: 'calc(100% - 60px - 70px)',
              }}
            >
              <MessageList
                messages={messages}
                isLoading={isLoading}
                emptyMessage=""
                height="100%"
              />
            </div>
          )}

          <div className="ai-sidebar-footer" data-testid="sidebar-footer">
            <ChatInput
              onSend={handleSendMessage}
              onCancel={cancelMessage}
              loading={isLoading}
              placeholder="Ask about this webpage..."
            />
          </div>
        </ThemeProvider>
      </div>

      {/* Resize handles placed AFTER the container so they are not covered */}
      {/* West (left) - keep existing test id for compatibility */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--w"
        onMouseDown={e => handleResizeMouseDown(e, 'w')}
        data-testid="resize-handle"
        style={{ cursor: 'ew-resize' }}
        aria-label="Resize left"
      />
      {/* East (right) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--e"
        onMouseDown={e => handleResizeMouseDown(e, 'e')}
        aria-label="Resize right"
      />
      {/* North (top) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--n"
        onMouseDown={e => handleResizeMouseDown(e, 'n')}
        aria-label="Resize top"
      />
      {/* South (bottom) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--s"
        onMouseDown={e => handleResizeMouseDown(e, 's')}
        aria-label="Resize bottom"
      />
      {/* Corners for diagonal resize */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--nw"
        onMouseDown={e => handleResizeMouseDown(e, 'nw')}
        aria-label="Resize top-left"
        style={{ cursor: 'nwse-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--ne"
        onMouseDown={e => handleResizeMouseDown(e, 'ne')}
        aria-label="Resize top-right"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--sw"
        onMouseDown={e => handleResizeMouseDown(e, 'sw')}
        aria-label="Resize bottom-left"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--se"
        onMouseDown={e => handleResizeMouseDown(e, 'se')}
        aria-label="Resize bottom-right"
        style={{ cursor: 'nwse-resize' }}
      />
    </div>
  );
};

/**
 * Unified ChatPanel Component
 *
 * A complete chat interface that combines overlay positioning, resize/drag functionality,
 * and chat components into a single unified component. Features:
 *
 * - Fixed overlay positioning with high z-index
 * - Resizable width (300-800px) with left edge drag handle
 * - Draggable positioning by header
 * - 85% viewport height, vertically centered
 * - Shadow DOM isolation
 * - Theme support
 * - Keyboard accessibility (Escape to close)
 * - Chat functionality with message history and AI responses
 * - Centralized error management
 *
 * @example
 * ```tsx
 * <ChatPanel onClose={() => unmountSidebar()} />
 * ```
 */
export const ChatPanel: React.FC<ChatPanelProps> = (props) => {
  return (
    <ErrorProvider>
      <ChatPanelInner {...props} />
    </ErrorProvider>
  );
};

export default ChatPanel;
