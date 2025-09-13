/**
 * @file Gemini Request Builder
 *
 * Handles construction of Gemini API requests including message conversion,
 * generation config, and multimodal content processing.
 */

import { supportsThinking } from '../../../config/models';
import type { ProviderChatMessage, GeminiConfig } from '../../../types/providers';
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

  // Add system instruction if provided
  if (chatConfig?.systemPrompt) {
    request.systemInstruction = {
      parts: [{ text: chatConfig.systemPrompt }],
    };
  }

  // Add safety settings if configured
  if (geminiConfig.safetySettings) {
    request.safetySettings = geminiConfig.safetySettings as GeminiSafetySetting[];
  }

  // Content analysis removed - was only for debugging

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
    if (message.metadata?.['attachments'] && Array.isArray(message.metadata['attachments'])) {
      for (const attachment of message.metadata['attachments'] as Array<{
        type: string;
        data?: string;
      }>) {
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
function processImageAttachment(attachment: unknown): GeminiPart | null {
  const att = attachment as { data?: string };
  if (!att.data) {
    return null;
  }
  // Extract base64 data and mime type
  const matches = att.data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return null;
  }

  const [, mimeType, data] = matches;

  // Validate supported image types
  if (!mimeType || !data) {
    throw new Error('Invalid image data format');
  }

  if (!isSupportedImageType(mimeType!)) {
    throw new Error(`Unsupported image type: ${mimeType!}`);
  }

  return {
    inlineData: {
      mimeType: mimeType!,
      data: data!,
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
    let budget = thinkingBudget;
    // Safety: Gemini 2.5 Pro cannot disable thinking (0 is invalid)
    if (typeof budget === 'number' && budget === 0 && /gemini-2\.5-pro/i.test(geminiConfig.model)) {
      budget = -1; // fall back to dynamic per API guidance
    }

    if (typeof budget === 'number' && Number.isInteger(budget)) {
      config.thinkingConfig = {
        thinkingBudget: budget,
        // Only include thought summaries when requested
        includeThoughts: geminiConfig.showThoughts === true || chatConfig?.showThoughts === true,
      };
    }

    // Ask for text by default; include THOUGHT modality when showing thoughts
    const wantThoughts = geminiConfig.showThoughts === true || chatConfig?.showThoughts === true;
    config.responseModalities = wantThoughts ? ['TEXT', 'THOUGHT'] : ['TEXT'];
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
