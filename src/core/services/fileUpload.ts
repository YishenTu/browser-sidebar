/**
 * @file Unified file upload service for AI providers
 * Handles file uploads to different AI providers (Gemini, OpenAI, etc.)
 */

import { uploadFileToGemini } from '@core/ai/gemini/fileUpload';
import { uploadFileToOpenAI } from '@core/ai/openai/fileUpload';
import type { GeminiConfig, OpenAIConfig } from '@/types/providers';

export interface FileUploadResult {
  fileUri?: string;
  fileId?: string;
  mimeType: string;
}

export interface FileUploadOptions {
  apiKey: string;
  model: string;
  provider: 'gemini' | 'openai' | 'openrouter';
  file: File;
  metadata?: {
    displayName?: string;
    fileName?: string;
    purpose?: string;
  };
}

/**
 * Upload a file to the specified AI provider
 */
export async function uploadFile(options: FileUploadOptions): Promise<FileUploadResult | null> {
  const { apiKey, model, provider, file, metadata = {} } = options;

  if (!apiKey) {
    throw new Error(`${provider} API key is required for file upload`);
  }

  switch (provider) {
    case 'gemini': {
      const geminiConfig: GeminiConfig = {
        apiKey,
        model,
      };

      const result = await uploadFileToGemini(file, geminiConfig, {
        displayName: metadata.displayName || `File_${Date.now()}`,
        mimeType: file.type,
      });

      return {
        fileUri: result.uri,
        mimeType: file.type,
      };
    }

    case 'openai': {
      const openaiConfig: OpenAIConfig = {
        apiKey,
        model,
      };

      const result = await uploadFileToOpenAI(file, openaiConfig, {
        fileName: metadata.fileName || file.name || `file_${Date.now()}`,
        purpose: metadata.purpose || 'vision',
      });

      return {
        fileId: result.id,
        mimeType: file.type,
      };
    }

    case 'openrouter':
      // OpenRouter doesn't currently support file uploads
      return null;

    default:
      throw new Error(`File upload is not supported for ${provider} provider`);
  }
}

/**
 * Upload an image file specifically (with image-specific defaults)
 */
export async function uploadImage(
  provider: 'gemini' | 'openai' | 'openrouter',
  apiKey: string,
  model: string,
  file: File
): Promise<FileUploadResult | null> {
  return uploadFile({
    apiKey,
    model,
    provider,
    file,
    metadata: {
      displayName: `Image_${Date.now()}`,
      fileName: file.name || `image_${Date.now()}`,
      purpose: 'vision',
    },
  });
}

/**
 * Upload a screenshot (special case of image upload)
 */
export async function uploadScreenshot(
  provider: 'gemini' | 'openai' | 'openrouter',
  apiKey: string,
  model: string,
  dataUrl: string
): Promise<FileUploadResult | null> {
  // Convert data URL to blob and then to file
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });

  return uploadFile({
    apiKey,
    model,
    provider,
    file,
    metadata: {
      displayName: `Screenshot_${Date.now()}`,
      fileName: `screenshot_${Date.now()}.png`,
      purpose: 'vision',
    },
  });
}
