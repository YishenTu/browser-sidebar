/**
 * @file Unified Image Upload Service
 * Consolidates all image upload mechanisms (paste, screenshot, model switching)
 * into a single service with consistent error handling and caching
 */

import { uploadFile, type FileUploadResult } from './fileUpload';
import type { ImageReference } from './imageSyncService';

export interface ImageUploadOptions {
  apiKey: string;
  model: string;
  provider: 'gemini' | 'openai' | 'openrouter';
  source: 'paste' | 'screenshot' | 'sync';
  metadata?: {
    displayName?: string;
    fileName?: string;
    purpose?: string;
  };
}

export interface ImageUploadInput {
  file?: File;
  dataUrl?: string;
  mimeType?: string;
}

export interface ImageUploadResult extends FileUploadResult {
  previewUrl?: string;
  source: 'paste' | 'screenshot' | 'sync';
}

/**
 * Cache for uploaded images to avoid duplicate uploads
 * Key format: `${provider}_${dataUrlHash}`
 */
const uploadCache = new Map<string, ImageUploadResult>();

/**
 * Generate a simple hash for cache key from data URL
 */
function hashDataUrl(dataUrl: string): string {
  // Use the last 100 chars of the data URL as a simple fingerprint
  const fingerprint = dataUrl.slice(-100);
  return btoa(fingerprint)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20);
}

/**
 * Convert data URL to File object
 */
async function dataUrlToFile(dataUrl: string, fileName?: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  const finalFileName = fileName || `image_${Date.now()}.${extension}`;
  return new File([blob], finalFileName, { type: mimeType });
}

/**
 * Unified image upload function that handles all scenarios
 * @param input - Either a File object or a data URL string
 * @param options - Upload configuration
 * @returns Image upload result with file references and preview URL
 */
export async function uploadImage(
  input: ImageUploadInput,
  options: ImageUploadOptions
): Promise<ImageUploadResult | null> {
  const { apiKey, model, provider, source, metadata = {} } = options;

  // Validate provider support
  if (provider === 'openrouter') {
    console.warn('OpenRouter does not support image uploads');
    return null;
  }

  // Validate API key
  if (!apiKey) {
    throw new Error(`${provider} API key is required for image upload`);
  }

  let file: File;
  let previewUrl: string | undefined;
  let cacheKey: string | undefined;

  // Convert input to File object
  if (input.file) {
    file = input.file;
    // Generate preview URL if not provided
    if (input.dataUrl) {
      previewUrl = input.dataUrl;
      cacheKey = `${provider}_${hashDataUrl(input.dataUrl)}`;
    } else {
      // Create data URL from file for preview
      previewUrl = await fileToDataUrl(file);
      cacheKey = `${provider}_${hashDataUrl(previewUrl)}`;
    }
  } else if (input.dataUrl) {
    // Check cache first
    cacheKey = `${provider}_${hashDataUrl(input.dataUrl)}`;
    const cached = uploadCache.get(cacheKey);
    if (cached) {
      console.log(`Using cached image upload for ${provider}:`, cached.fileId || cached.fileUri);
      return cached;
    }

    previewUrl = input.dataUrl;
    const fileName = metadata.fileName || `${source}_${Date.now()}.png`;
    file = await dataUrlToFile(input.dataUrl, fileName);
  } else {
    throw new Error('Either file or dataUrl must be provided');
  }

  // Set default metadata based on source
  const finalMetadata = {
    displayName: metadata.displayName || `${source}_${Date.now()}`,
    fileName: metadata.fileName || file.name || `${source}_${Date.now()}.png`,
    purpose: metadata.purpose || 'vision',
  };

  try {
    // Upload using the existing fileUpload service
    const result = await uploadFile({
      apiKey,
      model,
      provider,
      file,
      metadata: finalMetadata,
    });

    if (!result) {
      console.warn(`Upload failed for ${provider}: no result returned`);
      return null;
    }

    // Create the complete result
    const uploadResult: ImageUploadResult = {
      ...result,
      previewUrl,
      source,
    };

    // Cache the result if we have a cache key
    if (cacheKey) {
      uploadCache.set(cacheKey, uploadResult);
    }

    console.log(`Successfully uploaded ${source} image to ${provider}:`, {
      fileId: result.fileId,
      fileUri: result.fileUri,
      source,
    });

    return uploadResult;
  } catch (error) {
    console.error(`Failed to upload ${source} image to ${provider}:`, error);

    // Provide detailed error information
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error(`Invalid ${provider} API key. Please check your settings.`);
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error(`API quota exceeded for ${provider}. Please try again later.`);
      } else if (error.message.includes('size') || error.message.includes('large')) {
        throw new Error(`Image too large for ${provider}. Please use a smaller image.`);
      }
    }

    throw error;
  }
}

/**
 * Convert File to data URL for preview
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Batch upload multiple images
 */
export async function uploadImages(
  inputs: ImageUploadInput[],
  options: ImageUploadOptions
): Promise<(ImageUploadResult | null)[]> {
  // Upload in parallel for better performance
  const uploadPromises = inputs.map(input =>
    uploadImage(input, options).catch(error => {
      console.error('Failed to upload image:', error);
      return null;
    })
  );

  return Promise.all(uploadPromises);
}

/**
 * Clear the upload cache
 * Should be called when switching sessions or clearing chat
 */
export function clearUploadCache(): void {
  uploadCache.clear();
}

/**
 * Convert ImageReference to ImageUploadResult
 * Used for compatibility with existing code
 */
export function imageReferenceToUploadResult(
  ref: ImageReference,
  source: 'paste' | 'screenshot' | 'sync' = 'sync'
): ImageUploadResult {
  return {
    fileUri: ref.fileUri,
    fileId: ref.fileId,
    mimeType: ref.mimeType,
    previewUrl: ref.data,
    source,
  };
}

/**
 * Convert ImageUploadResult to ImageReference
 * Used for compatibility with existing code
 */
export function uploadResultToImageReference(result: ImageUploadResult): ImageReference {
  return {
    fileUri: result.fileUri,
    fileId: result.fileId,
    mimeType: result.mimeType,
    data: result.previewUrl,
    type: 'image',
  };
}
