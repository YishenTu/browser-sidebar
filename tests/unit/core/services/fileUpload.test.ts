/**
 * @file fileUpload.test.ts
 * Tests for unified file upload service
 *
 * Focus:
 * - Provider branching (Gemini, OpenAI, OpenRouter)
 * - Argument mapping
 * - API key validation
 * - Error cases per provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile, type FileUploadOptions } from '@core/services/fileUpload';
import * as geminiFileUpload from '@core/ai/gemini/fileUpload';
import * as openaiFileUpload from '@core/ai/openai/fileUpload';

// Mock the provider-specific upload functions
vi.mock('@core/ai/gemini/fileUpload', () => ({
  uploadFileToGemini: vi.fn(),
}));

vi.mock('@core/ai/openai/fileUpload', () => ({
  uploadFileToOpenAI: vi.fn(),
}));

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // API Key Validation
  // ---------------------------------------------------------------------------
  describe('API key validation', () => {
    it('throws error when API key is missing for Gemini', async () => {
      const options: FileUploadOptions = {
        apiKey: '',
        model: 'gemini-pro',
        provider: 'gemini',
        file: new File(['test'], 'test.txt', { type: 'text/plain' }),
      };

      await expect(uploadFile(options)).rejects.toThrow(
        'gemini API key is required for file upload'
      );
    });

    it('throws error when API key is missing for OpenAI', async () => {
      const options: FileUploadOptions = {
        apiKey: '',
        model: 'gpt-4',
        provider: 'openai',
        file: new File(['test'], 'test.txt', { type: 'text/plain' }),
      };

      await expect(uploadFile(options)).rejects.toThrow(
        'openai API key is required for file upload'
      );
    });

    it('throws error when API key is missing for OpenRouter', async () => {
      const options: FileUploadOptions = {
        apiKey: '',
        model: 'anthropic/claude-3',
        provider: 'openrouter',
        file: new File(['test'], 'test.txt', { type: 'text/plain' }),
      };

      await expect(uploadFile(options)).rejects.toThrow(
        'openrouter API key is required for file upload'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Gemini Provider
  // ---------------------------------------------------------------------------
  describe('Gemini provider', () => {
    it('calls uploadFileToGemini with correct arguments', async () => {
      vi.mocked(geminiFileUpload.uploadFileToGemini).mockResolvedValue({
        uri: 'https://gemini.googleapis.com/v1/files/abc123',
        name: 'files/abc123',
        mimeType: 'image/png',
        sizeBytes: '1024',
        state: 'ACTIVE',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:00:00Z',
        expirationTime: '2024-01-01T00:00:00Z',
        sha256Hash: 'abc123hash',
      });

      const file = new File(['test content'], 'image.png', { type: 'image/png' });
      const options: FileUploadOptions = {
        apiKey: 'test-api-key',
        model: 'gemini-pro-vision',
        provider: 'gemini',
        file,
        metadata: {
          displayName: 'My Image',
        },
      };

      const result = await uploadFile(options);

      expect(geminiFileUpload.uploadFileToGemini).toHaveBeenCalledWith(
        file,
        { apiKey: 'test-api-key', model: 'gemini-pro-vision' },
        { displayName: 'My Image', mimeType: 'image/png' }
      );
      expect(result).toEqual({
        fileUri: 'https://gemini.googleapis.com/v1/files/abc123',
        mimeType: 'image/png',
      });
    });

    it('uses default displayName when not provided', async () => {
      vi.mocked(geminiFileUpload.uploadFileToGemini).mockResolvedValue({
        uri: 'https://gemini.googleapis.com/v1/files/abc123',
        name: 'files/abc123',
        mimeType: 'text/plain',
        sizeBytes: '100',
        state: 'ACTIVE',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:00:00Z',
        expirationTime: '2024-01-01T00:00:00Z',
        sha256Hash: 'abc123hash',
      });

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const options: FileUploadOptions = {
        apiKey: 'test-api-key',
        model: 'gemini-pro',
        provider: 'gemini',
        file,
      };

      await uploadFile(options);

      expect(geminiFileUpload.uploadFileToGemini).toHaveBeenCalledWith(
        file,
        { apiKey: 'test-api-key', model: 'gemini-pro' },
        expect.objectContaining({
          displayName: expect.stringMatching(/^File_\d+$/),
          mimeType: 'text/plain',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // OpenAI Provider
  // ---------------------------------------------------------------------------
  describe('OpenAI provider', () => {
    it('calls uploadFileToOpenAI with correct arguments', async () => {
      vi.mocked(openaiFileUpload.uploadFileToOpenAI).mockResolvedValue({
        id: 'file-xyz789',
        object: 'file',
        bytes: 2048,
        created_at: 1700000000,
        filename: 'document.pdf',
        purpose: 'vision',
      });

      const file = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
      const options: FileUploadOptions = {
        apiKey: 'sk-test-key',
        model: 'gpt-4-vision',
        provider: 'openai',
        file,
        metadata: {
          fileName: 'my-doc.pdf',
          purpose: 'assistants',
        },
      };

      const result = await uploadFile(options);

      expect(openaiFileUpload.uploadFileToOpenAI).toHaveBeenCalledWith(
        file,
        { apiKey: 'sk-test-key', model: 'gpt-4-vision' },
        { fileName: 'my-doc.pdf', purpose: 'assistants' }
      );
      expect(result).toEqual({
        fileId: 'file-xyz789',
        mimeType: 'application/pdf',
      });
    });

    it('uses default fileName and purpose when not provided', async () => {
      vi.mocked(openaiFileUpload.uploadFileToOpenAI).mockResolvedValue({
        id: 'file-abc123',
        object: 'file',
        bytes: 1024,
        created_at: 1700000000,
        filename: 'image.jpg',
        purpose: 'vision',
      });

      const file = new File(['image data'], 'image.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'name', { value: 'image.jpg' });

      const options: FileUploadOptions = {
        apiKey: 'sk-test-key',
        model: 'gpt-4-vision',
        provider: 'openai',
        file,
      };

      await uploadFile(options);

      expect(openaiFileUpload.uploadFileToOpenAI).toHaveBeenCalledWith(
        file,
        { apiKey: 'sk-test-key', model: 'gpt-4-vision' },
        { fileName: 'image.jpg', purpose: 'vision' }
      );
    });

    it('uses fallback fileName when file.name is empty', async () => {
      vi.mocked(openaiFileUpload.uploadFileToOpenAI).mockResolvedValue({
        id: 'file-def456',
        object: 'file',
        bytes: 512,
        created_at: 1700000000,
        filename: 'file',
        purpose: 'vision',
      });

      const file = new File(['data'], '', { type: 'text/plain' });

      const options: FileUploadOptions = {
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        provider: 'openai',
        file,
      };

      await uploadFile(options);

      expect(openaiFileUpload.uploadFileToOpenAI).toHaveBeenCalledWith(
        file,
        { apiKey: 'sk-test-key', model: 'gpt-4' },
        expect.objectContaining({
          fileName: expect.stringMatching(/^file_\d+$/),
          purpose: 'vision',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // OpenRouter Provider
  // ---------------------------------------------------------------------------
  describe('OpenRouter provider', () => {
    it('returns null for OpenRouter (unsupported)', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const options: FileUploadOptions = {
        apiKey: 'test-api-key',
        model: 'anthropic/claude-3-sonnet',
        provider: 'openrouter',
        file,
      };

      const result = await uploadFile(options);

      expect(result).toBeNull();
      expect(geminiFileUpload.uploadFileToGemini).not.toHaveBeenCalled();
      expect(openaiFileUpload.uploadFileToOpenAI).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Unsupported Provider
  // ---------------------------------------------------------------------------
  describe('unsupported provider', () => {
    it('throws error for unknown provider', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const options = {
        apiKey: 'test-api-key',
        model: 'some-model',
        provider: 'unknown-provider' as 'gemini' | 'openai' | 'openrouter',
        file,
      };

      await expect(uploadFile(options)).rejects.toThrow(
        'File upload is not supported for unknown-provider provider'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('propagates errors from Gemini upload', async () => {
      vi.mocked(geminiFileUpload.uploadFileToGemini).mockRejectedValue(
        new Error('Gemini API rate limit exceeded')
      );

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const options: FileUploadOptions = {
        apiKey: 'test-api-key',
        model: 'gemini-pro',
        provider: 'gemini',
        file,
      };

      await expect(uploadFile(options)).rejects.toThrow('Gemini API rate limit exceeded');
    });

    it('propagates errors from OpenAI upload', async () => {
      vi.mocked(openaiFileUpload.uploadFileToOpenAI).mockRejectedValue(
        new Error('OpenAI quota exceeded')
      );

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const options: FileUploadOptions = {
        apiKey: 'sk-test',
        model: 'gpt-4',
        provider: 'openai',
        file,
      };

      await expect(uploadFile(options)).rejects.toThrow('OpenAI quota exceeded');
    });
  });
});
