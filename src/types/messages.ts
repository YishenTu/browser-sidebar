/**
 * @file Message Types and Protocol
 * 
 * Defines the message passing protocol for communication between
 * the extension's background script, content script, and sidebar.
 */

/**
 * Available message types for inter-component communication
 */
export type MessageType =
  | 'TOGGLE_SIDEBAR'
  | 'CLOSE_SIDEBAR'
  | 'EXTRACT_CONTENT'
  | 'CONTENT_EXTRACTED'
  | 'SEND_TO_AI'
  | 'AI_RESPONSE'
  | 'ERROR'
  | 'PING'
  | 'PONG';

/**
 * Message source/target identifiers
 */
export type MessageSource = 'background' | 'content' | 'sidebar';

/**
 * Base message structure for all inter-component communication
 */
export interface Message<T = unknown> {
  /** Unique message identifier */
  id: string;
  /** Message type identifier */
  type: MessageType;
  /** Message payload data */
  payload?: T;
  /** Message creation timestamp */
  timestamp: number;
  /** Message source component */
  source: MessageSource;
  /** Message target component */
  target: MessageSource;
}

/**
 * Specific payload types for different message types
 */
export interface ToggleSidebarPayload {
  /** Whether to show or hide the sidebar */
  show?: boolean;
}

export interface ExtractContentPayload {
  /** Specific content selectors to extract */
  selectors?: string[];
  /** Whether to include images */
  includeImages?: boolean;
}

export interface ContentExtractedPayload {
  /** Extracted text content */
  text: string;
  /** Page title */
  title: string;
  /** Page URL */
  url: string;
  /** Extracted images (if requested) */
  images?: string[];
  /** Content metadata */
  metadata?: Record<string, unknown>;
}

export interface SendToAIPayload {
  /** User message content */
  message: string;
  /** Conversation context */
  context?: string;
  /** AI provider settings */
  settings?: Record<string, unknown>;
}

export interface AIResponsePayload {
  /** AI response content */
  response: string;
  /** Response metadata */
  metadata?: Record<string, unknown>;
  /** Whether this is a streaming response chunk */
  isStreaming?: boolean;
  /** Whether this is the final chunk in a stream */
  isFinal?: boolean;
}

export interface ErrorPayload {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Type-safe message interfaces for specific message types
 */
export interface ToggleSidebarMessage extends Message<ToggleSidebarPayload> {
  type: 'TOGGLE_SIDEBAR';
}

export interface CloseSidebarMessage extends Message<void> {
  type: 'CLOSE_SIDEBAR';
}

export interface ExtractContentMessage extends Message<ExtractContentPayload> {
  type: 'EXTRACT_CONTENT';
}

export interface ContentExtractedMessage extends Message<ContentExtractedPayload> {
  type: 'CONTENT_EXTRACTED';
}

export interface SendToAIMessage extends Message<SendToAIPayload> {
  type: 'SEND_TO_AI';
}

export interface AIResponseMessage extends Message<AIResponsePayload> {
  type: 'AI_RESPONSE';
}

export interface ErrorMessage extends Message<ErrorPayload> {
  type: 'ERROR';
}

export interface PingMessage extends Message<void> {
  type: 'PING';
}

export interface PongMessage extends Message<void> {
  type: 'PONG';
}

/**
 * Union type for all specific message types
 */
export type TypedMessage =
  | ToggleSidebarMessage
  | CloseSidebarMessage
  | ExtractContentMessage
  | ContentExtractedMessage
  | SendToAIMessage
  | AIResponseMessage
  | ErrorMessage
  | PingMessage
  | PongMessage;

/**
 * Message creation options
 */
export interface CreateMessageOptions<T = unknown> {
  type: MessageType;
  payload?: T;
  source: MessageSource;
  target: MessageSource;
}

/**
 * Generates a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Factory function to create properly formatted messages
 * Supports both options object and direct parameters for backwards compatibility
 * 
 * @param typeOrOptions - MessageType string or CreateMessageOptions object
 * @param payload - Message payload (when using direct parameters)
 * @param source - Message source (when using direct parameters)
 * @param target - Message target (when using direct parameters)
 * @returns Properly formatted message with unique ID and timestamp
 */
export function createMessage<T = unknown>(
  typeOrOptions: MessageType | CreateMessageOptions<T>,
  payload?: T,
  source?: MessageSource,
  target?: MessageSource
): Message<T> {
  // Handle backwards compatibility with direct parameters
  if (typeof typeOrOptions === 'string') {
    return {
      id: generateMessageId(),
      type: typeOrOptions as MessageType,
      payload,
      timestamp: Date.now(),
      source: source || 'background',
      target: target || 'background',
    };
  }
  
  // Handle options object
  const options = typeOrOptions as CreateMessageOptions<T>;
  return {
    id: generateMessageId(),
    type: options.type,
    payload: options.payload,
    timestamp: Date.now(),
    source: options.source,
    target: options.target,
  };
}

/**
 * Type guard to check if an object is a valid message
 * 
 * @param obj - Object to validate
 * @returns True if the object is a valid message
 */
export function isValidMessage(obj: unknown): obj is Message {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const message = obj as Record<string, unknown>;

  // Check required fields
  if (
    typeof message['id'] !== 'string' ||
    typeof message['type'] !== 'string' ||
    typeof message['timestamp'] !== 'number' ||
    typeof message['source'] !== 'string' ||
    typeof message['target'] !== 'string'
  ) {
    return false;
  }

  // Validate message type
  const validTypes: MessageType[] = [
    'TOGGLE_SIDEBAR',
    'CLOSE_SIDEBAR',
    'EXTRACT_CONTENT',
    'CONTENT_EXTRACTED',
    'SEND_TO_AI',
    'AI_RESPONSE',
    'ERROR',
    'PING',
    'PONG',
  ];

  if (!validTypes.includes(message['type'] as MessageType)) {
    return false;
  }

  // Validate source and target
  const validSources: MessageSource[] = ['background', 'content', 'sidebar'];
  if (
    !validSources.includes(message['source'] as MessageSource) ||
    !validSources.includes(message['target'] as MessageSource)
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a message has a specific type
 * 
 * @param message - Message to check
 * @param type - Expected message type
 * @returns True if the message has the specified type
 */
export function isMessageOfType<T extends MessageType>(
  message: Message,
  type: T
): message is Message & { type: T } {
  return message.type === type;
}