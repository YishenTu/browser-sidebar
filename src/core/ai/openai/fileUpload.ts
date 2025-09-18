/**
 * @file OpenAI File Upload Service
 *
 * Provides helpers for uploading vision files to the OpenAI File API so they can be
 * referenced by the Responses API as `input_image_file` content items.
 */

import type { OpenAIConfig } from '@/types/providers';

export interface OpenAIFileMetadata {
  id: string;
  object?: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status?: 'queued' | 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
  status_details?: unknown;
  expires_at?: number | null;
  [key: string]: unknown;
}

export interface OpenAIFileUploadOptions {
  /** Optional override for file name sent to OpenAI */
  fileName?: string;
  /** Optional override for upload purpose (defaults to `vision`) */
  purpose?: string;
  /** Polling interval while waiting for the file to reach `processed` status */
  pollingIntervalMs?: number;
  /** Maximum time to wait for processing before timing out */
  maxWaitMs?: number;
  /** Abort signal for cancelling upload or polling */
  signal?: AbortSignal;
}

const OPENAI_FILES_ENDPOINT = 'https://api.openai.com/v1/files';
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_WAIT_MS = 30_000;

/**
 * Upload a file to the OpenAI Files API and wait for it to reach the `processed` state.
 */
export async function uploadFileToOpenAI(
  file: File | Blob,
  openaiConfig: OpenAIConfig,
  options: OpenAIFileUploadOptions = {}
): Promise<OpenAIFileMetadata> {
  const apiKey = openaiConfig.apiKey;
  if (!apiKey) {
    throw new Error('OpenAI API key is required for file uploads.');
  }

  const fileName =
    options.fileName ||
    (file instanceof File
      ? file.name
      : `image_${Date.now().toString(36)}.${inferExtension(file.type)}`);

  const formData = new FormData();
  formData.append('purpose', options.purpose || 'vision');
  formData.append('file', file, fileName);

  const uploadResponse = await fetch(OPENAI_FILES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: options.signal,
  });

  if (!uploadResponse.ok) {
    const errorText = await safeReadError(uploadResponse);
    throw new Error(`Failed to upload file to OpenAI: ${uploadResponse.status} ${errorText}`);
  }

  const metadata = (await uploadResponse.json()) as OpenAIFileMetadata;

  if ((options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS) <= 0) {
    return metadata;
  }

  if (metadata.status === 'processed') {
    return metadata;
  }

  return await waitForProcessing(metadata.id, apiKey, options);
}

async function waitForProcessing(
  fileId: string,
  apiKey: string,
  options: Pick<OpenAIFileUploadOptions, 'pollingIntervalMs' | 'maxWaitMs' | 'signal'>
): Promise<OpenAIFileMetadata> {
  const start = Date.now();
  const pollingInterval = options.pollingIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWait = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

  while (Date.now() - start < maxWait) {
    const metadata = await fetchFileMetadata(fileId, apiKey, options.signal);

    if (!metadata.status || metadata.status === 'processed') {
      return metadata;
    }

    if (metadata.status === 'error') {
      throw new Error('OpenAI reported an error while processing the uploaded file.');
    }

    await delay(pollingInterval, options.signal);
  }

  throw new Error('Timed out waiting for OpenAI to process the uploaded file.');
}

async function fetchFileMetadata(
  fileId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<OpenAIFileMetadata> {
  const response = await fetch(`${OPENAI_FILES_ENDPOINT}/${fileId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
  });

  if (!response.ok) {
    const errorText = await safeReadError(response);
    throw new Error(`Failed to retrieve OpenAI file metadata: ${response.status} ${errorText}`);
  }

  return (await response.json()) as OpenAIFileMetadata;
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const abortHandler = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abortHandler);
    };

    if (signal.aborted) {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    signal.addEventListener('abort', abortHandler);
  });
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: { message?: string } }).error?.message;
      if (message) {
        return message;
      }
    }
    return JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return 'Unknown error';
    }
  }
}

function inferExtension(mimeType: string | undefined): string {
  if (!mimeType) {
    return 'bin';
  }

  const [, subtype] = mimeType.split('/');
  if (!subtype) {
    return 'bin';
  }

  if (subtype.includes(';')) {
    const [cleanSubtype] = subtype.split(';');
    return cleanSubtype || 'bin';
  }

  return subtype;
}
