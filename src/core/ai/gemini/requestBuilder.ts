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

  // Build request with contents at the end for better token caching
  const request: GeminiRequest = {} as GeminiRequest;

  // Add system instruction first if provided
  if (chatConfig?.systemPrompt) {
    request.systemInstruction = {
      parts: [{ text: chatConfig.systemPrompt }],
    };
  }

  // Add generation config
  request.generationConfig = buildGenerationConfig(geminiConfig, chatConfig);

  // Always enable Google Search grounding for better accuracy
  request.tools = [{ google_search: {} }];

  // Add contents at the end for better token caching in multi-turn conversations
  request.contents = contents;

  // Content analysis removed - was only for debugging

  return request;
}

/**
 * Convert provider messages to Gemini format
 */
export function convertMessages(messages: ProviderChatMessage[]): GeminiContent[] {
  return messages.map(message => {
    const parts: GeminiPart[] = [];

    // Check if the message has sections metadata (from formatTabContent)
    const sections = message.metadata?.['sections'] as
      | {
          systemInstruction?: string;
          tabContent?: string;
          userQuery?: string;
        }
      | undefined;

    if (sections) {
      // If we have sections, add them as separate parts
      if (sections.systemInstruction !== undefined) {
        parts.push({ text: sections.systemInstruction });
      }
      // Handle tabContent section - may contain images
      if (sections.tabContent !== undefined && sections.tabContent !== '') {
        // Parse the tabContent to check for image references
        const tabContentParts = parseTabContentForImages(sections.tabContent);
        parts.push(...tabContentParts);
      }
      if (sections.userQuery !== undefined) {
        parts.push({ text: sections.userQuery });
      }
    } else if (message.content.trim()) {
      // Otherwise use the regular content
      parts.push({ text: message.content });
    }

    // Add multimodal attachments
    if (message.metadata?.['attachments'] && Array.isArray(message.metadata['attachments'])) {
      for (const attachment of message.metadata['attachments'] as Array<{
        type: string;
        data?: string;
        fileUri?: string;
        mimeType?: string;
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
  const att = attachment as {
    fileUri?: string;
    fileId?: string;
    mimeType?: string;
    data?: string;
    type?: string;
  };

  // Skip non-image attachments
  if (att.type !== 'image') {
    return null;
  }

  // Validate MIME type - return null for invalid types instead of throwing
  if (!att.mimeType || !isSupportedImageType(att.mimeType)) {
    console.warn(`Unsupported or missing image type: ${att.mimeType}`);
    return null;
  }

  // Prefer fileUri for Gemini (works even if both fileId and fileUri exist after sync)
  // After successful cross-provider sync, attachments will have both references
  if (att.fileUri) {
    return {
      fileData: {
        mimeType: att.mimeType,
        fileUri: att.fileUri,
      },
    };
  }

  // If we only have OpenAI fileId (no fileUri), this image needs to be synced to Gemini
  if (att.fileId && !att.fileUri) {
    console.warn(
      `Image with OpenAI fileId but no Gemini fileUri: ${att.fileId}. Image sync to Gemini may be needed.`
    );
    return null;
  }

  // If we have base64 data but no fileUri, image upload may be needed
  if (!att.fileUri && att.data) {
    console.warn(
      'Image attachment has base64 data but no fileUri for Gemini provider. Image sync may be needed.',
      att
    );
    return null;
  }

  // No valid image reference found
  console.warn('Image attachment has no valid fileUri for Gemini provider:', att);
  return null;
}

/**
 * Build generation config from provider config and chat config
 */
export function buildGenerationConfig(
  geminiConfig: GeminiConfig,
  chatConfig?: GeminiChatConfig
): GeminiGenerationConfig {
  const config: GeminiGenerationConfig = {};

  // Add stop sequences
  if (geminiConfig.stopSequences && geminiConfig.stopSequences.length > 0) {
    config.stopSequences = geminiConfig.stopSequences;
  }

  // Configure thinking budget if model supports it
  const rawThinkingBudget = (chatConfig?.thinkingBudget ?? geminiConfig.thinkingBudget) as unknown;
  let normalizedBudget: number | undefined;

  if (typeof rawThinkingBudget === 'number' && Number.isInteger(rawThinkingBudget)) {
    normalizedBudget = rawThinkingBudget;
  } else if (typeof rawThinkingBudget === 'string') {
    const trimmed = rawThinkingBudget.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isInteger(parsed)) {
        normalizedBudget = parsed;
      }
    }
  }

  if (supportsThinking(geminiConfig.model)) {
    // Safety: Gemini 2.5 Pro cannot disable thinking (0 is invalid)
    if (
      typeof normalizedBudget === 'number' &&
      normalizedBudget === 0 &&
      /gemini-2\.5-pro/i.test(geminiConfig.model)
    ) {
      normalizedBudget = -1; // fall back to dynamic per API guidance
    }

    if (typeof normalizedBudget === 'number' && Number.isInteger(normalizedBudget)) {
      config.thinkingConfig = {
        thinkingBudget: normalizedBudget,
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

/**
 * Parse tab content for image references and split into text and image parts
 */
function parseTabContentForImages(tabContent: string): GeminiPart[] {
  const parts: GeminiPart[] = [];

  // Check if the tab content contains image references
  const imagePattern =
    /<content\s+type="image">\s*<fileUri>([^<]+)<\/fileUri>\s*<mimeType>([^<]+)<\/mimeType>\s*<\/content>/g;

  let lastIndex = 0;
  let match;
  let hasImage = false;

  // Find all image references in the content
  const matches: Array<{ fileUri: string; mimeType: string; start: number; end: number }> = [];
  while ((match = imagePattern.exec(tabContent)) !== null) {
    matches.push({
      fileUri: match[1] || '',
      mimeType: match[2] || '',
      start: match.index,
      end: match.index + match[0].length,
    });
    hasImage = true;
  }

  if (!hasImage) {
    // No images, return the entire content as text
    parts.push({ text: tabContent });
    return parts;
  }

  // Split content around image references
  for (let i = 0; i < matches.length; i++) {
    const imageMatch = matches[i];
    if (!imageMatch) continue; // Type guard for TypeScript

    // Add text before the image (including opening tags)
    if (imageMatch.start > lastIndex) {
      const textBefore = tabContent.substring(lastIndex, imageMatch.start);
      if (textBefore.trim()) {
        // Replace <content type="image"> opening with regular <content>
        const modifiedText =
          i === 0 && textBefore.includes('</metadata>') ? textBefore + '\n  <content>' : textBefore;
        parts.push({ text: modifiedText });
      }
    } else if (i === 0 && imageMatch.start === lastIndex) {
      // Image is at the very beginning after metadata
      const precedingText = tabContent.substring(0, imageMatch.start);
      if (precedingText.includes('</metadata>')) {
        // Add opening content tag
        parts.push({ text: precedingText + '\n  <content>' });
      }
    }

    // Add the image reference
    parts.push({
      fileData: {
        fileUri: imageMatch.fileUri,
        mimeType: imageMatch.mimeType as SupportedImageType,
      },
    });

    lastIndex = imageMatch.end;
  }

  // Add closing content tag and any remaining text (usually </tab> and </tab_content>)
  if (lastIndex < tabContent.length) {
    const textAfter = tabContent.substring(lastIndex);
    if (textAfter.trim()) {
      // Include the closing </content> tag with the remaining XML
      parts.push({ text: '\n  </content>' + textAfter });
    }
  } else {
    // No remaining text, just add the closing content tag
    parts.push({ text: '\n  </content>' });
  }

  return parts;
}
