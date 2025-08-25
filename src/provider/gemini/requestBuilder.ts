/**
 * @file Gemini Request Builder
 *
 * Handles construction of Gemini API requests including message conversion,
 * generation config, and multimodal content processing.
 */

import { supportsThinking } from '../../config/models';
import type { ProviderChatMessage, GeminiConfig } from '../../types/providers';
import type {
  GeminiRequest,
  GeminiContent,
  GeminiPart,
  GeminiGenerationConfig,
  GeminiChatConfig,
  GeminiSafetySetting,
  SupportedImageType,
} from './types';
import { SUPPORTED_IMAGE_TYPES } from './types';

/**
 * Builds complete Gemini API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  geminiConfig: GeminiConfig,
  chatConfig?: GeminiChatConfig
): GeminiRequest {
  // Convert messages and filter out any empty ones
  const contents = convertMessages(messages);

  // Validate that we have at least one message with content
  if (contents.length === 0 || contents.every(c => c.parts.length === 0)) {
    throw new Error('Messages array cannot be empty');
  }

  const request: GeminiRequest = {
    contents,
    generationConfig: buildGenerationConfig(geminiConfig, chatConfig),
    // Always enable Google Search grounding for better accuracy
    tools: [{ google_search: {} }],
  };

  // Add safety settings if configured
  if (geminiConfig.safetySettings) {
    request.safetySettings = geminiConfig.safetySettings as GeminiSafetySetting[];
  }

  return request;
}

/**
 * Convert provider messages to Gemini format
 */
export function convertMessages(messages: ProviderChatMessage[]): GeminiContent[] {
  return messages.map(message => {
    const parts: GeminiPart[] = [];

    // Add text content
    if (message.content.trim()) {
      parts.push({ text: message.content });
    }

    // Add multimodal attachments
    if (message.metadata?.['attachments']) {
      for (const attachment of message.metadata['attachments']) {
        if (attachment.type === 'image') {
          const imagePart = processImageAttachment(attachment);
          if (imagePart) {
            parts.push(imagePart);
          }
        } else {
          throw new Error(`Unsupported media type: ${attachment.type}`);
        }
      }
    }

    return {
      role: message.role === 'assistant' ? 'model' : message.role,
      parts,
    };
  });
}

/**
 * Process image attachment into Gemini format
 */
function processImageAttachment(attachment: any): GeminiPart | null {
  // Extract base64 data and mime type
  const matches = attachment.data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return null;
  }

  const [, mimeType, data] = matches;

  // Validate supported image types
  if (!isSupportedImageType(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  return {
    inlineData: {
      mimeType,
      data,
    },
  };
}

/**
 * Build generation config from provider config and chat config
 */
export function buildGenerationConfig(
  geminiConfig: GeminiConfig,
  chatConfig?: GeminiChatConfig
): GeminiGenerationConfig {
  // Use a reasonable default for max output tokens
  const config: GeminiGenerationConfig = {
    maxOutputTokens: 8192, // Default max output tokens
  };

  // Add stop sequences
  if (geminiConfig.stopSequences && geminiConfig.stopSequences.length > 0) {
    config.stopSequences = geminiConfig.stopSequences;
  }

  // Configure thinking budget if model supports it
  const thinkingBudget = chatConfig?.thinkingBudget ?? geminiConfig.thinkingBudget;

  if (supportsThinking(geminiConfig.model)) {
    // Convert string budget to number for the API
    const budgetNum = parseInt(thinkingBudget || '0', 10);

    if (!isNaN(budgetNum)) {
      config.thinkingConfig = {
        thinkingBudget: budgetNum,
        includeThoughts: true, // Enable thinking summaries
      };
    }
    config.responseModalities = ['TEXT'];
  }

  return config;
}

/**
 * Build request headers for Gemini API
 */
export function buildHeaders(apiKey: string): Record<string, string> {
  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Please add your Google API key in settings.'
    );
  }

  return {
    'x-goog-api-key': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Build API URL for Gemini endpoints
 */
export function buildApiUrl(
  endpoint: string,
  apiKey: string,
  baseUrl: string = 'https://generativelanguage.googleapis.com'
): string {
  const fullUrl = `${baseUrl}/v1beta${endpoint}`;
  // Add API key as query parameter
  return `${fullUrl}?key=${apiKey}`;
}

/**
 * Check if image type is supported
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageType {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType.toLowerCase() as SupportedImageType);
}
