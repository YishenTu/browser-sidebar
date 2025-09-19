/**
 * @file Cross-provider image synchronization service
 * Handles re-uploading images when switching between AI providers
 * to ensure all images in chat history remain accessible
 */

import type { ChatMessage } from '@store/chat';
import { uploadImage, uploadResultToImageReference } from './imageUploadService';

export interface ImageReference {
  fileUri?: string; // Gemini format
  fileId?: string; // OpenAI format
  mimeType: string;
  data?: string; // Base64 data URL
  type: string; // Should be 'image'
}

export interface ImageSyncResult {
  originalRef: ImageReference;
  newRef: ImageReference;
}

/**
 * Cache for image mappings to avoid re-uploading the same image multiple times
 * Key format: `${provider}_${fileId/fileUri}`
 */
const imageReferenceCache = new Map<string, ImageReference>();

/**
 * Re-upload an image to a different provider
 */
async function reuploadImage(
  imageRef: ImageReference,
  targetProvider: 'gemini' | 'openai',
  apiKey: string,
  model: string
): Promise<ImageReference | null> {
  // Check if we have the base64 data
  if (!imageRef.data) {
    console.warn('Cannot re-upload image: no base64 data available', imageRef);
    return null;
  }

  // Check cache first
  const cacheKey = `${targetProvider}_${imageRef.fileId || imageRef.fileUri}`;
  const cached = imageReferenceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use unified upload service
    const uploadResult = await uploadImage(
      { dataUrl: imageRef.data, mimeType: imageRef.mimeType },
      {
        apiKey,
        model,
        provider: targetProvider,
        source: 'sync',
        metadata: {
          displayName: `reupload_${Date.now()}`,
          fileName: `reupload_${Date.now()}.${imageRef.mimeType.split('/')[1] || 'png'}`,
          purpose: 'vision',
        },
      }
    );

    if (!uploadResult) {
      console.warn(`File upload returned null for ${targetProvider} provider`);
      return null;
    }

    // Convert to ImageReference format and preserve original data
    const newRef: ImageReference = {
      ...imageRef,
      ...uploadResultToImageReference(uploadResult),
      data: imageRef.data, // Preserve the base64 data
    };

    // Cache the result
    imageReferenceCache.set(cacheKey, newRef);

    console.log(`Successfully re-uploaded image to ${targetProvider}:`, {
      original: imageRef.fileId || imageRef.fileUri,
      new: newRef.fileId || newRef.fileUri,
    });

    return newRef;
  } catch (error) {
    console.error(`Failed to re-upload image to ${targetProvider}:`, error);

    // Provide more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('API key')) {
      console.error(
        `API key issue when uploading to ${targetProvider}. Please check your API key configuration.`
      );
    } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      console.error(`API quota or rate limit exceeded for ${targetProvider}.`);
    } else if (errorMessage.includes('file size') || errorMessage.includes('too large')) {
      console.error(`File size too large for ${targetProvider}.`);
    }

    return null;
  }
}

/**
 * Sync all images in chat history to target provider
 * This ensures all images are accessible when switching providers
 */
export async function syncImagesToProvider(
  messages: ChatMessage[],
  targetProvider: 'gemini' | 'openai',
  apiKey: string,
  model: string
): Promise<Map<string, ImageSyncResult>> {
  const syncResults = new Map<string, ImageSyncResult>();
  const imagesToSync: Array<{ message: ChatMessage; attachment: ImageReference; index: number }> =
    [];

  // Find all images that need syncing
  for (const message of messages) {
    if (message.metadata?.['attachments'] && Array.isArray(message.metadata['attachments'])) {
      const attachments = message.metadata['attachments'] as ImageReference[];
      attachments.forEach((attachment, index) => {
        if (attachment.type === 'image') {
          // Check if this image needs syncing to target provider
          const needsSync =
            (targetProvider === 'gemini' && attachment.fileId && !attachment.fileUri) ||
            (targetProvider === 'openai' && attachment.fileUri && !attachment.fileId);

          if (needsSync) {
            imagesToSync.push({ message, attachment, index });
          }
        }
      });
    }
  }

  // Sync all images in parallel for better performance
  const syncPromises = imagesToSync.map(async ({ message, attachment, index }) => {
    try {
      const newRef = await reuploadImage(attachment, targetProvider, apiKey, model);

      if (newRef) {
        // Create a key for this specific image
        const key = `${message.id}_attachment_${index}`;

        syncResults.set(key, {
          originalRef: attachment,
          newRef: {
            ...attachment,
            ...newRef, // Merge new upload references
          },
        });
      } else {
        console.warn(
          `Failed to sync image ${index} from message ${message.id} to ${targetProvider}`
        );
      }
    } catch (error) {
      console.error(`Error syncing image ${index} from message ${message.id}:`, error);
      // Continue with other images even if one fails
    }
  });

  await Promise.allSettled(syncPromises);

  return syncResults;
}

/**
 * Update message attachments with synced image references
 * This modifies the messages in place to use the new references
 */
export function updateMessagesWithSyncedImages(
  messages: ChatMessage[],
  syncResults: Map<string, ImageSyncResult>
): ChatMessage[] {
  return messages.map(message => {
    if (!message.metadata?.['attachments']) {
      return message;
    }

    const attachments = message.metadata['attachments'] as ImageReference[];
    const updatedAttachments = attachments.map((attachment, index) => {
      if (attachment.type === 'image') {
        const key = `${message.id}_attachment_${index}`;
        const syncResult = syncResults.get(key);

        if (syncResult) {
          // Merge original and new references
          return {
            ...attachment,
            ...syncResult.newRef,
          };
        }
      }
      return attachment;
    });

    return {
      ...message,
      metadata: {
        ...message.metadata,
        attachments: updatedAttachments,
      },
    };
  });
}

/**
 * Clear the image reference cache
 * Call this when switching sessions or clearing chat history
 */
export function clearImageReferenceCache(): void {
  imageReferenceCache.clear();
}

/**
 * Check if an image reference is valid for a specific provider
 */
export function isImageValidForProvider(
  imageRef: ImageReference,
  provider: 'gemini' | 'openai'
): boolean {
  if (provider === 'gemini') {
    return Boolean(imageRef.fileUri || imageRef.data);
  } else if (provider === 'openai') {
    return Boolean(imageRef.fileId || imageRef.data);
  }
  return false;
}
