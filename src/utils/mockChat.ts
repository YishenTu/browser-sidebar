/**
 * @file Mock Chat Utilities
 *
 * Provides realistic mock chat functionality for testing and demo purposes.
 * Includes mock response generation, streaming simulation, error scenarios,
 * and sample conversations.
 */

import type { ChatMessage, MessageRole, MessageStatus } from '@/store/chat';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Types of mock responses that can be generated
 */
export type MockResponseType = 'text' | 'code' | 'list' | 'table' | 'long';

/**
 * Types of mock errors that can be generated
 */
export type MockErrorType = 'network' | 'api' | 'parsing' | 'timeout' | 'generic';

/**
 * Predefined conversation scenarios
 */
export type ConversationScenario = 'greeting' | 'coding' | 'help' | 'error' | 'long';

/**
 * Streaming speed options
 */
export type StreamingSpeed = 'slow' | 'normal' | 'fast';

/**
 * Options for creating mock messages
 */
export interface MockMessageOptions {
  role: MessageRole;
  content: string;
  id?: string;
  timestamp?: Date;
  status?: MessageStatus;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for streaming simulation
 */
export interface StreamingOptions {
  /** Callback for each chunk of streamed content */
  onChunk?: (chunk: string, metadata: StreamingMetadata) => void;
  /** Callback when streaming completes successfully */
  onComplete?: (finalContent: string) => void;
  /** Callback when streaming encounters an error */
  onError?: (error: MockError) => void;
  /** Speed of streaming animation */
  speed?: StreamingSpeed;
  /** Delay before starting to stream (thinking time) */
  thinkingDelay?: number;
  /** Average characters per chunk */
  chunkSize?: number;
  /** Whether to simulate an error during streaming */
  shouldError?: boolean;
  /** Probability of error occurring (0-1) */
  errorProbability?: number;
}

/**
 * Metadata provided with each streaming chunk
 */
export interface StreamingMetadata {
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Current chunk index */
  chunkIndex: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Unique streaming session ID */
  streamingId: string;
  /** Estimated completion percentage */
  progress: number;
}

/**
 * Structure for mock AI responses
 */
export interface MockResponse {
  /** Generated response content */
  content: string;
  /** Type of response generated */
  type: MockResponseType;
  /** Metadata about the response generation */
  metadata: {
    /** Response generation time in ms */
    responseTime: number;
    /** Estimated token count */
    tokens: number;
    /** Original prompt (if provided) */
    prompt?: string;
    /** Simulated model name */
    model: string;
  };
}

/**
 * Structure for mock errors
 */
export interface MockError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Error type */
  type: MockErrorType;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Options for generating mock conversations
 */
export interface ConversationOptions {
  /** Number of messages to generate */
  messageCount?: number;
  /** Include system messages */
  includeSystemMessages?: boolean;
  /** Include error messages */
  includeErrors?: boolean;
}

// =============================================================================
// Core Utilities
// =============================================================================

/**
 * Generates a unique ID for messages or conversations
 */
function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generates a unique message ID
 */
function generateMessageId(): string {
  return generateId('msg');
}

/**
 * Generates a unique streaming session ID
 */
function generateStreamingId(): string {
  return generateId('stream');
}

/**
 * Determines default status based on message role
 */
function getDefaultStatus(role: MessageRole): MessageStatus {
  switch (role) {
    case 'user':
      return 'sent';
    case 'assistant':
      return 'received';
    case 'system':
      return 'received';
    default:
      return 'received';
  }
}

/**
 * Simulates realistic response time based on content length
 */
function simulateResponseTime(contentLength: number): number {
  // Base time of 200ms + 10ms per character (roughly)
  const baseTime = 200;
  const variableTime = contentLength * 10;
  const randomFactor = 0.5 + Math.random(); // 0.5x to 1.5x
  return Math.floor((baseTime + variableTime) * randomFactor);
}

/**
 * Estimates token count based on content length
 */
function estimateTokens(content: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(content.length / 4);
}

// =============================================================================
// Mock Response Generation
// =============================================================================

/**
 * Collection of sample responses by type
 */
const MOCK_RESPONSES = {
  text: [
    "I'd be happy to help you with that! Let me provide some guidance on this topic.",
    "That's a great question! Here's what I think about this subject.",
    "I understand what you're looking for. Let me explain this concept in detail.",
    "Absolutely! This is something I can definitely assist you with.",
    "Thanks for asking! Here's my take on this interesting topic.",
    "I see what you're getting at. Let me break this down for you.",
    "That's an excellent point you've raised. Here's how I would approach it.",
    "I'm glad you asked about this! It's a topic I find quite fascinating.",
  ],
  
  code: [
    "Here's a simple example to get you started:\n\n```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));\n```\n\nThis function demonstrates basic JavaScript syntax.",
    "Let me show you how to implement this:\n\n```python\ndef calculate_fibonacci(n):\n    if n <= 1:\n        return n\n    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)\n\nprint(calculate_fibonacci(10))\n```",
    "Here's a React component example:\n\n```tsx\nimport React, { useState } from 'react';\n\nconst Counter: React.FC = () => {\n  const [count, setCount] = useState(0);\n  \n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>\n        Increment\n      </button>\n    </div>\n  );\n};\n```",
  ],
  
  list: [
    "Here are the key points to consider:\n\n1. First, analyze the requirements carefully\n2. Break down the problem into smaller components\n3. Design a clear architecture\n4. Implement with testing in mind\n5. Document your code thoroughly\n6. Review and refactor as needed",
    "The main benefits include:\n\n1. **Improved Performance** - Faster execution and better resource usage\n2. **Enhanced Security** - Better protection against common vulnerabilities\n3. **Easier Maintenance** - Cleaner code that's easier to update\n4. **Better User Experience** - More responsive and intuitive interface\n5. **Scalability** - Can handle increased load and complexity",
  ],
  
  table: [
    "Here's a comparison of the different options:\n\n| Feature | Option A | Option B | Option C |\n|---------|----------|----------|----------|\n| Performance | Excellent | Good | Fair |\n| Cost | High | Medium | Low |\n| Complexity | Low | Medium | High |\n| Maintenance | Easy | Moderate | Difficult |",
    "Let me break down the framework comparison:\n\n| Framework | Learning Curve | Performance | Community | Use Case |\n|-----------|----------------|-------------|-----------|----------|\n| React | Moderate | High | Large | SPAs, Apps |\n| Vue | Easy | High | Growing | SPAs, Progressive |\n| Angular | Steep | High | Large | Enterprise Apps |\n| Svelte | Easy | Excellent | Small | Modern SPAs |",
  ],
  
  long: [
    `When considering the implementation of a comprehensive solution, there are numerous factors that need to be carefully evaluated and balanced against each other.

First and foremost, we need to establish a clear understanding of the requirements and constraints. This involves not only the functional requirements - what the system needs to do - but also the non-functional requirements such as performance, scalability, security, and maintainability.

The architectural decisions we make early in the process will have far-reaching implications for the entire project lifecycle. We need to consider factors such as:

**Technical Architecture:**
- How the different components will communicate with each other
- What protocols and standards we'll use
- How we'll handle data persistence and caching
- What our deployment and scaling strategy will be

**Development Workflow:**
- Code organization and structure
- Testing strategy and automation
- Continuous integration and deployment
- Code review processes and quality gates

**Long-term Considerations:**
- How we'll handle future feature additions
- Performance optimization strategies
- Security update procedures
- Documentation and knowledge transfer

By taking a holistic approach and considering all these factors from the beginning, we can create a solution that not only meets the immediate needs but also provides a solid foundation for future growth and evolution.`,
  ],
};

/**
 * Generates a mock AI response based on the specified type
 */
export function generateMockResponse(
  type: MockResponseType,
  prompt?: string
): MockResponse {
  const responses = MOCK_RESPONSES[type];
  let content = responses[Math.floor(Math.random() * responses.length)];
  
  // Customize content based on prompt if provided
  if (prompt && content) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (type === 'text') {
      if (lowerPrompt.includes('react')) {
        content = "React is a powerful JavaScript library for building user interfaces. It uses a component-based architecture that makes it easy to create reusable UI elements and manage complex application state.";
      } else if (lowerPrompt.includes('python')) {
        content = "Python is an excellent programming language known for its simplicity and readability. It's great for beginners but powerful enough for complex applications in data science, web development, and automation.";
      } else if (lowerPrompt.includes('javascript')) {
        content = "JavaScript is the language of the web! It's versatile, running both in browsers and on servers. Modern JavaScript includes many powerful features that make development more efficient and enjoyable.";
      }
    }
  }
  
  const responseTime = simulateResponseTime(content?.length || 0);
  const tokens = estimateTokens(content || '');
  
  return {
    content: content || '',
    type,
    metadata: {
      responseTime,
      tokens,
      prompt,
      model: 'mock-ai-v1.0',
    },
  };
}

/**
 * Generates a mock error scenario
 */
export function generateMockError(type: MockErrorType = 'generic'): MockError {
  const errors = {
    network: {
      messages: [
        'Network connection failed. Please check your internet connection.',
        'Unable to reach the AI service. The network may be temporarily unavailable.',
        'Network timeout. Please try again later.',
      ],
      codes: ['NETWORK_ERROR', 'NETWORK_ERROR', 'NETWORK_ERROR'],
      recoverable: true,
    },
    api: {
      messages: [
        'API rate limit exceeded. Please wait before making more requests.',
        'Invalid API key or insufficient permissions.',
        'The AI service is temporarily unavailable.',
      ],
      codes: ['RATE_LIMIT', 'UNAUTHORIZED', 'API_ERROR'],
      recoverable: [true, false, true],
    },
    parsing: {
      messages: [
        'Failed to parse the AI response. The format was unexpected.',
        'Parse error: Invalid response format received from the AI service.',
        'Error parsing the AI response. Please try again.',
      ],
      codes: ['PARSING_ERROR', 'PARSING_ERROR', 'PARSING_ERROR'],
      recoverable: false,
    },
    timeout: {
      messages: [
        'Request timeout. The AI is taking too long to respond.',
        'Response timeout. Please try with a shorter message.',
        'The request took too long to complete.',
      ],
      codes: ['TIMEOUT_ERROR', 'TIMEOUT_ERROR', 'TIMEOUT_ERROR'],
      recoverable: true,
    },
    generic: {
      messages: [
        'An unexpected error occurred. Please try again.',
        'Something went wrong. Please refresh and try again.',
        'Error processing your request. Please try again later.',
      ],
      codes: ['UNKNOWN_ERROR', 'GENERIC_ERROR', 'UNEXPECTED_ERROR'],
      recoverable: true,
    },
  };
  
  const errorConfig = errors[type];
  const index = Math.floor(Math.random() * errorConfig.messages.length);
  const message = errorConfig.messages[index] ?? errorConfig.messages[0] ?? 'An error occurred';
  const code = errorConfig.codes[index] ?? errorConfig.codes[0] ?? 'GENERIC_ERROR';
  const recoverable = Array.isArray(errorConfig.recoverable) 
    ? (errorConfig.recoverable[index] ?? errorConfig.recoverable[0] ?? false) 
    : (errorConfig.recoverable ?? false);
  
  return {
    message,
    code,
    type,
    recoverable,
    details: {
      timestamp: new Date().toISOString(),
      requestId: generateId('req'),
    },
  };
}

// =============================================================================
// Message Creation
// =============================================================================

/**
 * Creates a mock chat message with proper defaults
 */
export function createMockMessage(options: MockMessageOptions): ChatMessage {
  return {
    id: options.id || generateMessageId(),
    role: options.role,
    content: options.content,
    timestamp: options.timestamp || new Date(),
    status: options.status || getDefaultStatus(options.role),
    error: options.error,
    metadata: options.metadata,
  };
}

// =============================================================================
// Conversation Generation
// =============================================================================

/**
 * Predefined conversation scenarios
 */
const CONVERSATION_SCENARIOS = {
  greeting: [
    { role: 'user' as MessageRole, content: 'Hello! How are you today?' },
    { role: 'assistant' as MessageRole, content: "Hello! I'm doing well, thank you for asking. I'm here and ready to help you with any questions or tasks you might have. How can I assist you today?" },
  ],
  
  coding: [
    { role: 'user' as MessageRole, content: 'Can you help me debug this JavaScript code?' },
    { role: 'assistant' as MessageRole, content: "I'd be happy to help you debug your JavaScript code! Please share the code you're having trouble with, and let me know what error messages or unexpected behavior you're experiencing." },
    { role: 'user' as MessageRole, content: 'Here it is:\n```javascript\nfunction add(a, b) {\n  return a + b\n}\nconsole.log(add(2, "3"));\n```' },
    { role: 'assistant' as MessageRole, content: "I see the issue! Your function is adding a number and a string, which results in string concatenation instead of mathematical addition. Here's the fix:\n\n```javascript\nfunction add(a, b) {\n  return Number(a) + Number(b);\n}\nconsole.log(add(2, \"3\")); // Now returns 5\n```\n\nAlternatively, you could add type checking to ensure both parameters are numbers before performing the operation." },
  ],
  
  help: [
    { role: 'user' as MessageRole, content: 'What can you help me with?' },
    { role: 'assistant' as MessageRole, content: "I can help you with a wide variety of tasks! Here are some areas where I'm particularly useful:\n\n• **Programming & Development** - Code review, debugging, explaining concepts\n• **Writing & Communication** - Editing, proofreading, content creation\n• **Analysis & Research** - Data analysis, summarizing information\n• **Problem Solving** - Breaking down complex problems, finding solutions\n• **Learning & Education** - Explaining topics, answering questions\n\nWhat specific area would you like help with today?" },
  ],
  
  error: [
    { role: 'user' as MessageRole, content: 'Can you analyze this large dataset for me?' },
    { role: 'assistant' as MessageRole, content: '', status: 'error' as MessageStatus, error: 'Failed to process the request. The dataset may be too large or in an unsupported format.' },
    { role: 'user' as MessageRole, content: 'Let me try with a smaller sample instead.' },
    { role: 'assistant' as MessageRole, content: "That's a good approach! Working with a smaller sample will be much more manageable. Please share the sample data and let me know what kind of analysis you're looking for." },
  ],
  
  long: [
    { role: 'user' as MessageRole, content: 'Can you explain machine learning in detail?' },
    { role: 'assistant' as MessageRole, content: "Machine learning is a fascinating subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed for every task. Let me break this down comprehensively:\n\n**Core Concepts:**\nAt its heart, machine learning is about pattern recognition. Instead of programming specific rules, we feed algorithms large amounts of data and let them discover patterns and relationships on their own.\n\n**Types of Machine Learning:**\n1. **Supervised Learning** - Learning with labeled examples\n2. **Unsupervised Learning** - Finding patterns in unlabeled data\n3. **Reinforcement Learning** - Learning through trial and error with rewards\n\n**Common Applications:**\n• Image and speech recognition\n• Recommendation systems (Netflix, Spotify)\n• Fraud detection in banking\n• Medical diagnosis assistance\n• Autonomous vehicles\n\nWould you like me to dive deeper into any particular aspect?" },
    { role: 'user' as MessageRole, content: 'Yes, can you explain neural networks?' },
    { role: 'assistant' as MessageRole, content: "Neural networks are one of the most powerful machine learning techniques, inspired by how the human brain processes information!\n\n**Basic Structure:**\nA neural network consists of interconnected nodes (neurons) organized in layers:\n• **Input Layer** - Receives the raw data\n• **Hidden Layers** - Process and transform the data\n• **Output Layer** - Produces the final result\n\n**How They Work:**\n1. Each neuron receives inputs, applies weights, and passes the result through an activation function\n2. The network learns by adjusting these weights based on training data\n3. Through backpropagation, errors are propagated backward to improve accuracy\n\n**Types of Neural Networks:**\n• **Feedforward Networks** - Simple, one-way data flow\n• **Convolutional Networks (CNNs)** - Excellent for image processing\n• **Recurrent Networks (RNNs)** - Great for sequential data like text\n• **Transformer Networks** - State-of-the-art for language tasks\n\nThe beauty of neural networks lies in their ability to learn complex, non-linear relationships in data that traditional algorithms might miss." },
    { role: 'user' as MessageRole, content: 'This is really helpful! What about deep learning?' },
    { role: 'assistant' as MessageRole, content: "I'm glad you're finding this helpful! Deep learning is essentially neural networks taken to the next level - it's what happens when we use neural networks with many hidden layers (typically 3 or more, but often dozens or even hundreds).\n\n**Why \"Deep\" Matters:**\nEach layer can learn increasingly complex features:\n• **Layer 1** might detect edges in an image\n• **Layer 2** might recognize shapes\n• **Layer 3** might identify objects\n• **Final layers** might understand complex scenes\n\n**Key Advantages:**\n• **Automatic Feature Learning** - No need to manually engineer features\n• **Hierarchical Representation** - Builds understanding from simple to complex\n• **End-to-End Learning** - Can optimize the entire pipeline\n\n**Breakthrough Applications:**\n• **Computer Vision** - Image classification, object detection\n• **Natural Language Processing** - Translation, chatbots, text generation\n• **Game Playing** - AlphaGo, chess engines\n• **Scientific Discovery** - Protein folding, drug discovery\n\nThe combination of big data, powerful GPUs, and algorithmic improvements has made deep learning incredibly effective for problems that were previously unsolvable!" },
  ],
};

/**
 * Generates a mock conversation based on a predefined scenario
 */
export function generateMockConversation(
  scenario: ConversationScenario,
  options: ConversationOptions = {}
): ChatMessage[] {
  const {
    messageCount,
    includeErrors = scenario === 'error',
  } = options;
  
  let messages = CONVERSATION_SCENARIOS[scenario] || CONVERSATION_SCENARIOS.greeting;
  
  if (!messages) {
    messages = CONVERSATION_SCENARIOS.greeting;
  }
  
  // If specific message count requested, adjust accordingly
  if (messageCount !== undefined) {
    if (messageCount > messages.length) {
      // Add more messages by repeating patterns
      while (messages.length < messageCount) {
        const lastMessage = messages[messages.length - 1];
        const isUserTurn = lastMessage ? lastMessage.role !== 'user' : true;
        if (isUserTurn) {
          messages.push({
            role: 'user',
            content: 'Can you tell me more about that?',
          });
        } else {
          const response = generateMockResponse('text');
          messages.push({
            role: 'assistant',
            content: response.content,
          });
        }
      }
    } else if (messageCount < messages.length) {
      messages = messages.slice(0, messageCount);
    }
  }
  
  // Convert to proper ChatMessage format with timestamps
  const baseTime = Date.now() - (messages.length * 30000); // 30 seconds apart
  
  return messages.map((msg, index) => {
    const timestamp = new Date(baseTime + (index * 30000));
    const msgStatus = 'status' in msg ? msg.status : undefined;
    const msgError = 'error' in msg ? msg.error : undefined;
    const isError = msgStatus === 'error' || (includeErrors && Math.random() < 0.1);
    
    return createMockMessage({
      role: msg.role,
      content: msg.content || '',
      timestamp,
      status: isError ? 'error' : (msgStatus as MessageStatus) || getDefaultStatus(msg.role),
      error: isError ? (typeof msgError === 'string' ? msgError : 'An error occurred') : undefined,
      metadata: {
        tokens: estimateTokens(msg.content || ''),
        model: 'mock-ai-v1.0',
      },
    });
  });
}

// =============================================================================
// Streaming Simulation
// =============================================================================

/**
 * Gets streaming delay based on speed setting
 */
function getStreamingDelay(speed: StreamingSpeed): number {
  switch (speed) {
    case 'slow':
      return 150;
    case 'normal':
      return 75;
    case 'fast':
      return 25;
    default:
      return 75;
  }
}

/**
 * Simulates realistic streaming of AI responses
 */
export async function simulateStreaming(
  content: string,
  options: StreamingOptions = {}
): Promise<void> {
  const {
    onChunk,
    onComplete,
    onError,
    speed = 'normal',
    thinkingDelay = 0,
    chunkSize = 8,
    shouldError = false,
    errorProbability = 0,
  } = options;
  
  const streamingId = generateStreamingId();
  const delay = getStreamingDelay(speed);
  
  // Thinking delay before starting
  if (thinkingDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, thinkingDelay));
  }
  
  // Check for error simulation
  const willError = shouldError || (Math.random() < errorProbability);
  
  if (willError) {
    const error = generateMockError('network');
    onError?.(error);
    return;
  }
  
  // Handle empty content
  if (!content.trim()) {
    onComplete?.(content);
    return;
  }
  
  // Break content into chunks
  const words = content.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= chunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  // Stream chunks progressively
  let streamedContent = '';
  
  for (let i = 0; i < chunks.length; i++) {
    streamedContent += (i === 0 ? '' : ' ') + chunks[i];
    
    const metadata: StreamingMetadata = {
      isComplete: i === chunks.length - 1,
      chunkIndex: i,
      totalChunks: chunks.length,
      streamingId,
      progress: ((i + 1) / chunks.length) * 100,
    };
    
    onChunk?.(streamedContent, metadata);
    
    // Don't delay after the last chunk
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  onComplete?.(content);
}

// =============================================================================
// Export all utilities
// =============================================================================

export default {
  generateMockResponse,
  generateMockError,
  createMockMessage,
  generateMockConversation,
  simulateStreaming,
};