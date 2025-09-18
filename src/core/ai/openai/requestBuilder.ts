/**
 * @file OpenAI Request Builder
 *
 * Handles construction of OpenAI API requests for the Responses API,
 * including message conversion and parameter configuration.
 */

import type { ProviderChatMessage, OpenAIConfig } from '../../../types/providers';
import type {
  OpenAIResponseRequest,
  OpenAIChatConfig,
  OpenAIInputContent,
  OpenAIImageDetail,
} from './types';

/**
 * Build complete OpenAI Responses API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  openaiConfig: OpenAIConfig,
  chatConfig?: OpenAIChatConfig
): OpenAIResponseRequest {
  // Extract system prompt for instructions field
  const systemMessages = messages.filter(m => m.role === 'system');
  const systemPrompt =
    chatConfig?.systemPrompt ||
    (systemMessages.length > 0 ? systemMessages.map(m => m.content).join('\n') : undefined);

  // Build request parameters for Response API
  const request: OpenAIResponseRequest = {
    model: openaiConfig.model,
    // Always enable web search
    tools: [{ type: 'web_search' }],
    // Always store for conversation continuity
    store: true,
  };

  // Add instructions if available
  if (systemPrompt) {
    request.instructions = systemPrompt;
  }

  // Handle conversation context
  // Only use previous_response_id when we have it (consecutive OpenAI calls)
  // Otherwise, send full history for context preservation
  if (chatConfig?.previousResponseId) {
    // We have a previous response ID from the last OpenAI call
    // This means we're continuing an OpenAI conversation
    request.previous_response_id = chatConfig.previousResponseId;

    // Only include the LAST user message (the new input)
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const normalizedLastUser = lastUserMessage ? mapMessageToOpenAIInput(lastUserMessage) : null;

    if (normalizedLastUser) {
      request.input = [normalizedLastUser];
    }
  } else {
    const conversationInputs = buildConversationInputs(messages);
    if (conversationInputs.length > 0) {
      request.input = conversationInputs;
    }
  }

  // Add streaming flag if needed
  if (chatConfig?.stream) {
    request.stream = true;
  }

  // Add reasoning params for models that support it
  const reasoningEffort = chatConfig?.reasoningEffort ?? openaiConfig.reasoningEffort;
  if (reasoningEffort) {
    request.reasoning = {
      effort: reasoningEffort,
      summary: 'auto',
    };
  }

  return request;
}

function buildConversationInputs(
  messages: ProviderChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: OpenAIInputContent[] }> {
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  const hasAssistantMessages = nonSystemMessages.some(m => m.role === 'assistant');

  if (hasAssistantMessages) {
    return nonSystemMessages
      .map(mapMessageToOpenAIInput)
      .filter(
        (entry): entry is { role: 'user' | 'assistant'; content: OpenAIInputContent[] } =>
          entry !== null
      );
  }

  const firstUserMessage = nonSystemMessages.find(m => m.role === 'user');
  const normalized = firstUserMessage ? mapMessageToOpenAIInput(firstUserMessage) : null;
  return normalized ? [normalized] : [];
}

function mapMessageToOpenAIInput(
  message: ProviderChatMessage
): { role: 'user' | 'assistant'; content: OpenAIInputContent[] } | null {
  if (message.role === 'system') {
    return null;
  }

  const role = message.role === 'assistant' ? 'assistant' : 'user';
  const content = buildContentParts(message, role);

  if (content.length === 0) {
    return null;
  }

  return {
    role,
    content,
  };
}

function buildContentParts(
  message: ProviderChatMessage,
  role: 'user' | 'assistant'
): OpenAIInputContent[] {
  const parts: OpenAIInputContent[] = [];
  const attachments = role === 'user' ? extractImageAttachments(message) : [];
  const trimmed = message.content?.trim();

  // Check if the message has sections metadata (from formatTabContent)
  const sections = message.metadata?.['sections'] as
    | {
        systemInstruction?: string;
        tabContent?: string;
        userQuery?: string;
      }
    | undefined;

  if (sections && role === 'user') {
    // If we have sections, add them as separate text parts
    if (sections.systemInstruction !== undefined) {
      parts.push({
        type: 'input_text',
        text: sections.systemInstruction,
      });
    }
    // Handle tabContent section - may contain images
    if (sections.tabContent !== undefined && sections.tabContent !== '') {
      // Parse the tabContent to check for image references
      const tabContentParts = parseTabContentForImages(sections.tabContent);
      parts.push(...tabContentParts);
    }
    if (sections.userQuery !== undefined) {
      parts.push({
        type: 'input_text',
        text: sections.userQuery,
      });
    }
  } else if (trimmed && !(attachments.length > 0 && isPlaceholderContent(trimmed))) {
    // Otherwise use the regular content
    parts.push({
      type: role === 'assistant' ? 'output_text' : 'input_text',
      text: trimmed,
    });
  }

  if (role === 'user') {
    for (const attachment of attachments) {
      // Prefer OpenAI fileId (works even if both fileId and fileUri exist after sync)
      // After successful cross-provider sync, attachments will have both references
      if (attachment.fileId) {
        const detail = normalizeImageDetail(attachment.detail) ?? 'auto';
        parts.push({
          type: 'input_image',
          file_id: attachment.fileId,
          detail,
        });
      } else if (attachment.fileUri && !attachment.fileId) {
        // If we only have Gemini fileUri (no fileId), this image needs to be synced to OpenAI
        console.warn(
          `Image with Gemini fileUri but no OpenAI fileId: ${attachment.fileUri}. Image sync to OpenAI may be needed.`
        );
      } else if (attachment.data && !attachment.fileId && !attachment.fileUri) {
        // Image has base64 data but no provider-specific reference, upload may be needed
        console.warn(
          'Image attachment has base64 data but no fileId for OpenAI provider. Image sync may be needed.',
          attachment
        );
      } else {
        // No valid image reference found
        console.warn('Image attachment has no valid fileId for OpenAI provider:', attachment);
      }
    }
  }

  return parts;
}

function extractImageAttachments(message: ProviderChatMessage): Array<{
  fileId?: string;
  fileUri?: string;
  detail?: unknown;
  mimeType?: string;
  data?: string;
  type?: string;
}> {
  if (!message.metadata || !('attachments' in message.metadata)) {
    return [];
  }

  const raw = message.metadata['attachments'];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    att => att && typeof att === 'object' && (att as { type?: string }).type === 'image'
  ) as Array<{
    fileId?: string;
    fileUri?: string;
    detail?: unknown;
    mimeType?: string;
    data?: string;
    type?: string;
  }>;
}

function normalizeImageDetail(detail: unknown): OpenAIImageDetail | undefined {
  if (typeof detail !== 'string') {
    return undefined;
  }

  const normalized = detail.toLowerCase() as OpenAIImageDetail;
  if (normalized === 'auto' || normalized === 'low' || normalized === 'high') {
    return normalized;
  }

  return undefined;
}

function isPlaceholderContent(content: string): boolean {
  return content === '[Image]' || content === '[Images]';
}

/**
 * Parse tab content for image references and split into text and image parts
 */
function parseTabContentForImages(tabContent: string): OpenAIInputContent[] {
  const parts: OpenAIInputContent[] = [];

  // Check if the tab content contains image references
  const imageFileIdMatch = /<content\s+type="image">\s*<fileId>([^<]+)<\/fileId>/g;

  let lastIndex = 0;
  let match;
  let hasImage = false;

  // Find all image references in the content
  const matches: Array<{ fileId: string; start: number; end: number }> = [];
  while ((match = imageFileIdMatch.exec(tabContent)) !== null) {
    matches.push({
      fileId: match[1] || '',
      start: match.index,
      end: match.index + match[0].length,
    });
    hasImage = true;
  }

  if (!hasImage) {
    // No images, return the entire content as text
    parts.push({
      type: 'input_text',
      text: tabContent,
    });
    return parts;
  }

  // Split content around image references
  for (const imageMatch of matches) {
    // Add text before the image
    if (imageMatch.start > lastIndex) {
      const textBefore = tabContent.substring(lastIndex, imageMatch.start);
      if (textBefore.trim()) {
        parts.push({
          type: 'input_text',
          text: textBefore,
        });
      }
    }

    // Add the image reference
    parts.push({
      type: 'input_image',
      file_id: imageMatch.fileId,
      detail: 'auto',
    });

    lastIndex = imageMatch.end;
  }

  // Add any remaining text after the last image
  if (lastIndex < tabContent.length) {
    const textAfter = tabContent.substring(lastIndex);
    if (textAfter.trim()) {
      parts.push({
        type: 'input_text',
        text: textAfter,
      });
    }
  }

  return parts;
}

/**
 * Convert provider messages to OpenAI Responses API input format
 */
export function convertMessagesToInput(messages: ProviderChatMessage[]): string {
  // For Responses API, we need to maintain conversation order
  // Only extract system messages to put first, then keep conversation order
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Combine: system messages first (if any), then conversation in original order
  const orderedMessages = [...systemMessages, ...conversationMessages];

  return orderedMessages
    .map(m => {
      const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
      return `${role}: ${m.content}`;
    })
    .join('\n');
}

/**
 * Build request options for fetch
 */
export function buildRequestOptions(
  apiKey: string,
  body: unknown,
  signal?: AbortSignal
): RequestInit {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please add your API key in settings.');
  }

  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  };
}
