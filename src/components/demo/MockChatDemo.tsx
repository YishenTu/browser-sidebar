/**
 * @file Mock Chat Demo Component
 *
 * Demonstrates the complete mock chat system integration with the ChatPanel.
 * This component showcases how the mock utilities work with the real chat UI.
 */

import React, { useCallback, useState } from 'react';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { useChatStore } from '@/store/chat';
import { 
  generateMockResponse, 
  simulateStreaming, 
  generateMockConversation,
  type MockResponseType,
  type ConversationScenario 
} from '@/utils/mockChat';

export interface MockChatDemoProps {
  /** Custom CSS class name */
  className?: string;
}

/**
 * MockChatDemo Component
 *
 * A complete demo showing how the mock chat system integrates with the
 * actual chat UI components. Includes buttons to trigger various mock
 * scenarios and automatic AI responses with streaming simulation.
 */
export const MockChatDemo: React.FC<MockChatDemoProps> = ({ className }) => {
  const { addMessage, updateMessage, clearConversation } = useChatStore();
  const [isResponding, setIsResponding] = useState(false);

  /**
   * Simulates an AI response to the last user message
   */
  const simulateAIResponse = useCallback(async (responseType: MockResponseType = 'text') => {
    if (isResponding) return;
    
    setIsResponding(true);
    
    try {
      // Generate mock response
      const mockResponse = generateMockResponse(responseType);
      
      // Create assistant message in streaming state
      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      addMessage({
        role: 'assistant',
        content: '',
        id: assistantMessageId,
        status: 'streaming',
        metadata: mockResponse.metadata,
      });
      
      // Simulate streaming
      await simulateStreaming(mockResponse.content, {
        onChunk: (chunk) => {
          updateMessage(assistantMessageId, {
            content: chunk,
            status: 'streaming',
          });
        },
        onComplete: (finalContent) => {
          updateMessage(assistantMessageId, {
            content: finalContent,
            status: 'received',
          });
          setIsResponding(false);
        },
        onError: (error) => {
          updateMessage(assistantMessageId, {
            content: '',
            status: 'error',
            error: error.message,
          });
          setIsResponding(false);
        },
        speed: 'normal',
        thinkingDelay: 500,
      });
    } catch (error) {
      setIsResponding(false);
      console.error('Error simulating AI response:', error);
    }
  }, [addMessage, updateMessage, isResponding]);

  /**
   * Loads a predefined conversation scenario
   */
  const loadConversationScenario = useCallback((scenario: ConversationScenario) => {
    clearConversation();
    
    const conversation = generateMockConversation(scenario);
    conversation.forEach(message => {
      addMessage({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        status: message.status,
        error: message.error,
        metadata: message.metadata,
      });
    });
  }, [clearConversation, addMessage]);

  /**
   * Demo control panel with various mock scenarios
   */
  const ControlPanel: React.FC = () => (
    <div className="mock-chat-demo__controls">
      <h3>Mock Chat Demo Controls</h3>
      
      <div className="control-group">
        <h4>Response Types</h4>
        <button 
          onClick={() => simulateAIResponse('text')}
          disabled={isResponding}
        >
          Generate Text Response
        </button>
        <button 
          onClick={() => simulateAIResponse('code')}
          disabled={isResponding}
        >
          Generate Code Response
        </button>
        <button 
          onClick={() => simulateAIResponse('list')}
          disabled={isResponding}
        >
          Generate List Response
        </button>
        <button 
          onClick={() => simulateAIResponse('table')}
          disabled={isResponding}
        >
          Generate Table Response
        </button>
        <button 
          onClick={() => simulateAIResponse('long')}
          disabled={isResponding}
        >
          Generate Long Response
        </button>
      </div>
      
      <div className="control-group">
        <h4>Conversation Scenarios</h4>
        <button onClick={() => loadConversationScenario('greeting')}>
          Load Greeting Conversation
        </button>
        <button onClick={() => loadConversationScenario('coding')}>
          Load Coding Conversation
        </button>
        <button onClick={() => loadConversationScenario('help')}>
          Load Help Conversation
        </button>
        <button onClick={() => loadConversationScenario('error')}>
          Load Error Conversation
        </button>
        <button onClick={() => loadConversationScenario('long')}>
          Load Long Conversation
        </button>
      </div>
      
      <div className="control-group">
        <h4>Utilities</h4>
        <button onClick={clearConversation}>
          Clear Conversation
        </button>
      </div>
    </div>
  );

  return (
    <div className={`mock-chat-demo ${className || ''}`}>
      <div className="mock-chat-demo__layout">
        <div className="mock-chat-demo__sidebar">
          <ControlPanel />
        </div>
        
        <div className="mock-chat-demo__chat">
          <ChatPanel 
            title="Mock Chat Demo"
            showMessageCount={true}
            emptyMessage="No messages yet. Use the controls to load a conversation or send a message!"
          />
        </div>
      </div>
      
      {isResponding && (
        <div className="mock-chat-demo__status">
          AI is responding...
        </div>
      )}
    </div>
  );
};

export default MockChatDemo;

// Demo-specific CSS styles
const mockChatDemoStyles = `
.mock-chat-demo {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.mock-chat-demo__layout {
  display: flex;
  flex: 1;
  gap: 1rem;
  padding: 1rem;
  min-height: 0;
}

.mock-chat-demo__sidebar {
  width: 300px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-y: auto;
}

.mock-chat-demo__chat {
  flex: 1;
  min-width: 0;
}

.mock-chat-demo__controls h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #212529;
}

.control-group {
  margin-bottom: 1.5rem;
}

.control-group h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 500;
  color: #495057;
}

.control-group button {
  display: block;
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #007bff;
  color: white;
  border: 1px solid #007bff;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s ease-in-out;
}

.control-group button:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.control-group button:disabled {
  background: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.65;
}

.mock-chat-demo__status {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: #17a2b8;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

/* Dark mode support */
.dark .mock-chat-demo__sidebar {
  background: #343a40;
  border-color: #495057;
}

.dark .mock-chat-demo__controls h3 {
  color: #f8f9fa;
}

.dark .control-group h4 {
  color: #ced4da;
}

/* Responsive design */
@media (max-width: 768px) {
  .mock-chat-demo__layout {
    flex-direction: column;
    padding: 0.5rem;
  }
  
  .mock-chat-demo__sidebar {
    width: 100%;
    max-height: 200px;
  }
  
  .control-group {
    margin-bottom: 1rem;
  }
  
  .control-group button {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
  }
}
`;

// Inject styles when component is imported
if (typeof document !== 'undefined') {
  const styleId = 'mock-chat-demo-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = mockChatDemoStyles;
    document.head.appendChild(style);
  }
}