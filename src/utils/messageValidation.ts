/**
 * @file Message Validation Utilities
 *
 * Provides comprehensive validation for messages and their payloads
 * in the extension's message passing protocol.
 */

import { Message, MessageType, isValidMessage } from '../types/messages';

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Additional validation details */
  details?: Record<string, unknown>;
}

/**
 * Message validator class for comprehensive message validation
 */
export class MessageValidator {
  /**
   * Validates a message structure and content
   *
   * @param message - Message to validate
   * @returns Validation result
   */
  static validate(message: unknown): ValidationResult {
    // First check basic message structure
    if (!isValidMessage(message)) {
      return {
        isValid: false,
        error: 'Invalid message structure',
      };
    }

    // Validate message ID format
    if (!MessageValidator.isValidMessageId(message.id)) {
      return {
        isValid: false,
        error: 'Invalid message ID format',
      };
    }

    // Validate timestamp
    if (!MessageValidator.isValidTimestamp(message.timestamp)) {
      return {
        isValid: false,
        error: 'Invalid timestamp',
      };
    }

    // Validate payload based on message type
    const payloadValidation = MessageValidator.validatePayload(message.type, message.payload);

    if (!payloadValidation.isValid) {
      return payloadValidation;
    }

    return { isValid: true };
  }

  /**
   * Validates message payload based on message type
   *
   * @param type - Message type
   * @param payload - Payload to validate
   * @returns Validation result
   */
  static validatePayload(type: MessageType, payload: unknown): ValidationResult {
    switch (type) {
      case 'TOGGLE_SIDEBAR':
        return MessageValidator.validateToggleSidebarPayload(payload);

      case 'CLOSE_SIDEBAR':
      case 'PING':
      case 'PONG':
        // These messages should have no payload or undefined payload
        if (payload !== undefined) {
          return {
            isValid: false,
            error: `Message type ${type} should not have a payload`,
          };
        }
        return { isValid: true };

      case 'EXTRACT_CONTENT':
        return MessageValidator.validateExtractContentPayload(payload);

      case 'CONTENT_EXTRACTED':
        return MessageValidator.validateContentExtractedPayload(payload);

      case 'CONTENT_READY':
        return MessageValidator.validateContentReadyPayload(payload);

      case 'SIDEBAR_STATE':
        return MessageValidator.validateSidebarStatePayload(payload);

      case 'SEND_TO_AI':
        return MessageValidator.validateSendToAIPayload(payload);

      case 'AI_RESPONSE':
        return MessageValidator.validateAIResponsePayload(payload);

      case 'ERROR':
        return MessageValidator.validateErrorPayload(payload);

      default:
        return {
          isValid: false,
          error: `Unknown message type: ${type}`,
        };
    }
  }

  /**
   * Validates message ID format
   */
  private static isValidMessageId(id: string): boolean {
    // Message ID should follow the pattern: msg_<timestamp>_<random>
    const messageIdPattern = /^msg_\d+_[a-z0-9]+$/;
    return messageIdPattern.test(id);
  }

  /**
   * Validates timestamp
   */
  private static isValidTimestamp(timestamp: number): boolean {
    // Timestamp should be a positive number and not too far in the future
    const now = Date.now();
    const oneHourInMs = 60 * 60 * 1000;

    return (
      timestamp > 0 &&
      timestamp <= now + oneHourInMs && // Allow some future tolerance
      timestamp >= now - 24 * oneHourInMs // Not too old
    );
  }

  /**
   * Validates ToggleSidebarPayload
   */
  private static validateToggleSidebarPayload(payload: unknown): ValidationResult {
    if (payload === undefined) {
      return { isValid: true };
    }

    if (typeof payload !== 'object' || payload === null) {
      return {
        isValid: false,
        error: 'ToggleSidebar payload must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    if ('show' in typedPayload && typeof typedPayload['show'] !== 'boolean') {
      return {
        isValid: false,
        error: 'ToggleSidebar payload show property must be boolean',
      };
    }

    return { isValid: true };
  }

  /**
   * Validates ExtractContentPayload
   */
  private static validateExtractContentPayload(payload: unknown): ValidationResult {
    if (payload === undefined) {
      return { isValid: true };
    }

    if (typeof payload !== 'object' || payload === null) {
      return {
        isValid: false,
        error: 'ExtractContent payload must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    if ('selectors' in typedPayload) {
      if (!Array.isArray(typedPayload['selectors'])) {
        return {
          isValid: false,
          error: 'ExtractContent payload selectors must be an array',
        };
      }

      if (!(typedPayload['selectors'] as unknown[]).every(s => typeof s === 'string')) {
        return {
          isValid: false,
          error: 'ExtractContent payload selectors must be array of strings',
        };
      }
    }

    if ('includeImages' in typedPayload && typeof typedPayload['includeImages'] !== 'boolean') {
      return {
        isValid: false,
        error: 'ExtractContent payload includeImages must be boolean',
      };
    }

    return { isValid: true };
  }

  /**
   * Validates ContentExtractedPayload
   */
  private static validateContentExtractedPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        error: 'ContentExtracted payload is required and must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    // Required fields
    if (typeof typedPayload['text'] !== 'string') {
      return {
        isValid: false,
        error: 'ContentExtracted payload text is required and must be string',
      };
    }

    if (typeof typedPayload['title'] !== 'string') {
      return {
        isValid: false,
        error: 'ContentExtracted payload title is required and must be string',
      };
    }

    if (typeof typedPayload['url'] !== 'string') {
      return {
        isValid: false,
        error: 'ContentExtracted payload url is required and must be string',
      };
    }

    // Optional fields
    if ('images' in typedPayload) {
      if (!Array.isArray(typedPayload['images'])) {
        return {
          isValid: false,
          error: 'ContentExtracted payload images must be an array',
        };
      }

      if (!(typedPayload['images'] as unknown[]).every(img => typeof img === 'string')) {
        return {
          isValid: false,
          error: 'ContentExtracted payload images must be array of strings',
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validates ContentReadyPayload
   */
  private static validateContentReadyPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'ContentReady payload must be an object' };
    }
    const p = payload as Record<string, unknown>;
    if (p['status'] !== 'content-script-ready') {
      return { isValid: false, error: "ContentReady status must be 'content-script-ready'" };
    }
    if (typeof p['title'] !== 'string' || typeof p['url'] !== 'string') {
      return { isValid: false, error: 'ContentReady title and url must be strings' };
    }
    if ('timestamp' in p && typeof p['timestamp'] !== 'number') {
      return { isValid: false, error: 'ContentReady timestamp must be a number' };
    }
    return { isValid: true };
  }

  /**
   * Validates SidebarStatePayload
   */
  private static validateSidebarStatePayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'SidebarState payload must be an object' };
    }
    const p = payload as Record<string, unknown>;
    if (p['status'] !== 'sidebar-opened' && p['status'] !== 'sidebar-closed') {
      return {
        isValid: false,
        error: "SidebarState status must be 'sidebar-opened' or 'sidebar-closed'",
      };
    }
    if ('timestamp' in p && typeof p['timestamp'] !== 'number') {
      return { isValid: false, error: 'SidebarState timestamp must be a number' };
    }
    return { isValid: true };
  }

  /**
   * Validates SendToAIPayload
   */
  private static validateSendToAIPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        error: 'SendToAI payload is required and must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    if (typeof typedPayload['message'] !== 'string') {
      return {
        isValid: false,
        error: 'SendToAI payload message is required and must be string',
      };
    }

    if ((typedPayload['message'] as string).trim().length === 0) {
      return {
        isValid: false,
        error: 'SendToAI payload message cannot be empty',
      };
    }

    if ('context' in typedPayload && typeof typedPayload['context'] !== 'string') {
      return {
        isValid: false,
        error: 'SendToAI payload context must be string',
      };
    }

    return { isValid: true };
  }

  /**
   * Validates AIResponsePayload
   */
  private static validateAIResponsePayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        error: 'AIResponse payload is required and must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    if (typeof typedPayload['response'] !== 'string') {
      return {
        isValid: false,
        error: 'AIResponse payload response is required and must be string',
      };
    }

    if ('isStreaming' in typedPayload && typeof typedPayload['isStreaming'] !== 'boolean') {
      return {
        isValid: false,
        error: 'AIResponse payload isStreaming must be boolean',
      };
    }

    if ('isFinal' in typedPayload && typeof typedPayload['isFinal'] !== 'boolean') {
      return {
        isValid: false,
        error: 'AIResponse payload isFinal must be boolean',
      };
    }

    return { isValid: true };
  }

  /**
   * Validates ErrorPayload
   */
  private static validateErrorPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        error: 'Error payload is required and must be an object',
      };
    }

    const typedPayload = payload as Record<string, unknown>;

    if (typeof typedPayload['message'] !== 'string') {
      return {
        isValid: false,
        error: 'Error payload message is required and must be string',
      };
    }

    if ((typedPayload['message'] as string).trim().length === 0) {
      return {
        isValid: false,
        error: 'Error payload message cannot be empty',
      };
    }

    if ('code' in typedPayload && typeof typedPayload['code'] !== 'string') {
      return {
        isValid: false,
        error: 'Error payload code must be string',
      };
    }

    return { isValid: true };
  }
}

/**
 * Convenience function for validating messages
 *
 * @param message - Message to validate
 * @returns Validation result
 */
export function validateMessage(message: unknown): ValidationResult {
  return MessageValidator.validate(message);
}

/**
 * Type-safe validation utility for messages
 *
 * @param message - Message to validate
 * @param type - Expected message type
 * @returns True if message is valid and of the expected type
 */
export function isValidMessageOfType<T extends MessageType>(
  message: unknown,
  type: T
): message is Message & { type: T } {
  const validation = validateMessage(message);
  if (!validation.isValid) {
    return false;
  }

  const validMessage = message as Message;
  return validMessage.type === type;
}
