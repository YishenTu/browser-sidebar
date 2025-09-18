/**
 * @file Gemini File Upload Service
 *
 * Handles uploading files to Gemini API using the resumable upload protocol
 */

import type { GeminiConfig } from '@/types/providers';

export interface GeminiFileMetadata {
  name: string;
  displayName?: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  sha256Hash: string;
  uri: string;
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  error?: { message: string };
}

export interface FileUploadResponse {
  file: GeminiFileMetadata;
}

export interface FileUploadOptions {
  displayName?: string;
  mimeType?: string;
}

/**
 * Upload a file to Gemini using the resumable upload protocol
 */
export async function uploadFileToGemini(
  file: File | Blob,
  geminiConfig: GeminiConfig,
  options?: FileUploadOptions
): Promise<GeminiFileMetadata> {
  const apiKey = geminiConfig.apiKey;
  if (!apiKey) {
    throw new Error('Gemini API key is required for file upload');
  }

  // Determine MIME type
  const mimeType =
    options?.mimeType || (file instanceof File ? file.type : 'application/octet-stream');
  const displayName = options?.displayName || (file instanceof File ? file.name : 'uploaded_file');

  // Step 1: Initialize resumable upload
  const uploadUrl = await initializeResumableUpload(apiKey, file.size, mimeType, displayName);

  // Step 2: Upload the actual file data
  const fileMetadata = await uploadFileData(uploadUrl, file, apiKey);

  // Step 3: Wait for processing to complete if needed
  if (fileMetadata.state === 'PROCESSING') {
    return await waitForProcessing(fileMetadata.name, apiKey);
  }

  return fileMetadata;
}

/**
 * Initialize a resumable upload session
 */
async function initializeResumableUpload(
  apiKey: string,
  fileSize: number,
  mimeType: string,
  displayName: string
): Promise<string> {
  const baseUrl = 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl}/upload/v1beta/files?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: {
        display_name: displayName,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to initialize upload: ${response.status} ${error}`);
  }

  // Get the upload URL from response headers
  const uploadUrl = response.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL received from Gemini');
  }

  return uploadUrl;
}

/**
 * Upload the actual file data
 */
async function uploadFileData(
  uploadUrl: string,
  file: File | Blob,
  _apiKey: string
): Promise<GeminiFileMetadata> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': file instanceof File ? file.type : 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file: ${response.status} ${error}`);
  }

  const result = (await response.json()) as FileUploadResponse;
  return result.file;
}

/**
 * Wait for file processing to complete
 */
async function waitForProcessing(
  fileName: string,
  apiKey: string,
  maxWaitTime: number = 30000
): Promise<GeminiFileMetadata> {
  const baseUrl = 'https://generativelanguage.googleapis.com';
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${baseUrl}/v1beta/${fileName}?key=${apiKey}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check file status: ${response.status} ${error}`);
    }

    const metadata = (await response.json()) as GeminiFileMetadata;

    if (metadata.state === 'ACTIVE') {
      return metadata;
    }

    if (metadata.state === 'FAILED') {
      throw new Error(`File processing failed: ${metadata.error?.message || 'Unknown error'}`);
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('File processing timeout');
}

/**
 * Delete a file from Gemini
 */
export async function deleteFileFromGemini(fileName: string, apiKey: string): Promise<void> {
  const baseUrl = 'https://generativelanguage.googleapis.com';
  const response = await fetch(`${baseUrl}/v1beta/${fileName}?key=${apiKey}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete file: ${response.status} ${error}`);
  }
}

/**
 * Convert a base64 data URL to a Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const matches = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const [, mimeType, base64Data] = matches;
  if (!mimeType || !base64Data) {
    throw new Error('Invalid data URL format');
  }
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
