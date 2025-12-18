/**
 * @file imageSyncService.test.ts
 * Tests for cross-provider image synchronization service
 *
 * Focus:
 * - needsSync detection
 * - Provider validation logic
 * - Cache effectiveness testing
 * - Message mutation verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncImagesToProvider,
  updateMessagesWithSyncedImages,
  clearImageReferenceCache,
  isImageValidForProvider,
  type ImageReference,
  type ImageSyncResult,
} from '@core/services/imageSyncService';
import * as imageUploadService from '@core/services/imageUploadService';
import type { ChatMessage } from '@store/chat';

// Mock the image upload service
vi.mock('@core/services/imageUploadService', () => ({
  uploadImage: vi.fn(),
  uploadResultToImageReference: vi.fn().mockImplementation(result => ({
    fileUri: result.fileUri,
    fileId: result.fileId,
    mimeType: result.mimeType,
    data: result.previewUrl,
    type: 'image',
  })),
}));

// Mock debug log
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
}));

describe('imageSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImageReferenceCache();
  });

  // ---------------------------------------------------------------------------
  // isImageValidForProvider
  // ---------------------------------------------------------------------------
  describe('isImageValidForProvider', () => {
    it('returns true for Gemini when fileUri exists', () => {
      const ref: ImageReference = {
        fileUri: 'https://gemini.com/files/123',
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'gemini')).toBe(true);
    });

    it('returns true for Gemini when data exists', () => {
      const ref: ImageReference = {
        data: 'data:image/png;base64,test',
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'gemini')).toBe(true);
    });

    it('returns false for Gemini when neither fileUri nor data exists', () => {
      const ref: ImageReference = {
        fileId: 'file-123', // Only OpenAI reference
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'gemini')).toBe(false);
    });

    it('returns true for OpenAI when fileId exists', () => {
      const ref: ImageReference = {
        fileId: 'file-123',
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'openai')).toBe(true);
    });

    it('returns true for OpenAI when data exists', () => {
      const ref: ImageReference = {
        data: 'data:image/png;base64,test',
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'openai')).toBe(true);
    });

    it('returns false for OpenAI when neither fileId nor data exists', () => {
      const ref: ImageReference = {
        fileUri: 'https://gemini.com/files/123', // Only Gemini reference
        mimeType: 'image/png',
        type: 'image',
      };

      expect(isImageValidForProvider(ref, 'openai')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // syncImagesToProvider
  // ---------------------------------------------------------------------------
  describe('syncImagesToProvider', () => {
    const createTestMessage = (id: string, attachments: ImageReference[]): ChatMessage => ({
      id,
      role: 'user',
      content: 'Test message',
      timestamp: new Date(),
      status: 'sent',
      metadata: {
        attachments,
      },
    });

    it('returns empty map when no messages have attachments', async () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date(), status: 'sent' },
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      expect(result.size).toBe(0);
    });

    it('returns empty map when no images need syncing', async () => {
      const messages = [
        createTestMessage('1', [
          {
            fileUri: 'https://gemini.com/files/123',
            mimeType: 'image/png',
            type: 'image',
          },
        ]),
      ];

      // Image already has Gemini reference, no sync needed
      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      expect(result.size).toBe(0);
      expect(imageUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it('syncs OpenAI image to Gemini when needed', async () => {
      vi.mocked(imageUploadService.uploadImage).mockResolvedValue({
        fileUri: 'https://gemini.com/files/new',
        mimeType: 'image/png',
        source: 'sync',
      });

      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-openai-123', // OpenAI reference only
            mimeType: 'image/png',
            data: 'data:image/png;base64,test',
            type: 'image',
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'gemini-pro');

      expect(result.size).toBe(1);
      expect(result.has('msg-1_attachment_0')).toBe(true);
      expect(imageUploadService.uploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          dataUrl: 'data:image/png;base64,test',
        }),
        expect.objectContaining({
          provider: 'gemini',
          source: 'sync',
        })
      );
    });

    it('syncs Gemini image to OpenAI when needed', async () => {
      vi.mocked(imageUploadService.uploadImage).mockResolvedValue({
        fileId: 'file-openai-new',
        mimeType: 'image/png',
        source: 'sync',
      });

      const messages = [
        createTestMessage('msg-1', [
          {
            fileUri: 'https://gemini.com/files/123', // Gemini reference only
            mimeType: 'image/png',
            data: 'data:image/png;base64,test',
            type: 'image',
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'openai', 'api-key', 'gpt-4');

      expect(result.size).toBe(1);
      expect(result.has('msg-1_attachment_0')).toBe(true);
      expect(imageUploadService.uploadImage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          provider: 'openai',
        })
      );
    });

    it('skips non-image attachments', async () => {
      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-123',
            mimeType: 'application/pdf',
            type: 'document', // Not an image
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      expect(result.size).toBe(0);
      expect(imageUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it('handles upload failure gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(imageUploadService.uploadImage).mockResolvedValue(null);

      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-123',
            mimeType: 'image/png',
            data: 'data:image/png;base64,test',
            type: 'image',
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      // Should not throw, but result should be empty
      expect(result.size).toBe(0);

      expect(warnSpy).toHaveBeenCalledWith('File upload returned null for gemini provider');
      expect(warnSpy).toHaveBeenCalledWith('Failed to sync image 0 from message msg-1 to gemini');
      expect(warnSpy).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });

    it('handles multiple images in single message', async () => {
      let callCount = 0;
      vi.mocked(imageUploadService.uploadImage).mockImplementation(async () => {
        callCount++;
        return {
          fileUri: `https://gemini.com/files/${callCount}`,
          mimeType: 'image/png',
          source: 'sync',
        };
      });

      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-1',
            mimeType: 'image/png',
            data: 'data:image/png;base64,test1',
            type: 'image',
          },
          {
            fileId: 'file-2',
            mimeType: 'image/png',
            data: 'data:image/png;base64,test2',
            type: 'image',
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      expect(result.size).toBe(2);
      expect(result.has('msg-1_attachment_0')).toBe(true);
      expect(result.has('msg-1_attachment_1')).toBe(true);
    });

    it('handles images across multiple messages', async () => {
      vi.mocked(imageUploadService.uploadImage).mockResolvedValue({
        fileUri: 'https://gemini.com/files/synced',
        mimeType: 'image/png',
        source: 'sync',
      });

      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-1',
            mimeType: 'image/png',
            data: 'data:image/png;base64,test1',
            type: 'image',
          },
        ]),
        createTestMessage('msg-2', [
          {
            fileId: 'file-2',
            mimeType: 'image/png',
            data: 'data:image/png;base64,test2',
            type: 'image',
          },
        ]),
      ];

      const result = await syncImagesToProvider(messages, 'gemini', 'api-key', 'model');

      expect(result.size).toBe(2);
      expect(result.has('msg-1_attachment_0')).toBe(true);
      expect(result.has('msg-2_attachment_0')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // updateMessagesWithSyncedImages
  // ---------------------------------------------------------------------------
  describe('updateMessagesWithSyncedImages', () => {
    const createTestMessage = (id: string, attachments: ImageReference[]): ChatMessage => ({
      id,
      role: 'user',
      content: 'Test message',
      timestamp: new Date(),
      status: 'sent',
      metadata: {
        attachments,
      },
    });

    it('returns messages unchanged when no sync results', () => {
      const messages = [
        createTestMessage('msg-1', [
          {
            fileId: 'file-123',
            mimeType: 'image/png',
            type: 'image',
          },
        ]),
      ];
      const syncResults = new Map<string, ImageSyncResult>();

      const result = updateMessagesWithSyncedImages(messages, syncResults);

      expect(result).toEqual(messages);
    });

    it('returns messages unchanged when no attachments', () => {
      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date(), status: 'sent' },
      ];
      const syncResults = new Map<string, ImageSyncResult>();

      const result = updateMessagesWithSyncedImages(messages, syncResults);

      expect(result).toEqual(messages);
    });

    it('updates attachment with synced reference', () => {
      const originalRef: ImageReference = {
        fileId: 'file-123',
        mimeType: 'image/png',
        data: 'data:image/png;base64,test',
        type: 'image',
      };

      const newRef: ImageReference = {
        fileId: 'file-123',
        fileUri: 'https://gemini.com/files/synced',
        mimeType: 'image/png',
        data: 'data:image/png;base64,test',
        type: 'image',
      };

      const messages = [createTestMessage('msg-1', [originalRef])];
      const syncResults = new Map<string, ImageSyncResult>([
        ['msg-1_attachment_0', { originalRef, newRef }],
      ]);

      const result = updateMessagesWithSyncedImages(messages, syncResults);

      const updatedAttachments = result[0]?.metadata?.['attachments'] as ImageReference[];
      expect(updatedAttachments[0]?.fileUri).toBe('https://gemini.com/files/synced');
      expect(updatedAttachments[0]?.fileId).toBe('file-123');
    });

    it('preserves non-image attachments', () => {
      const imageRef: ImageReference = {
        fileId: 'file-123',
        mimeType: 'image/png',
        type: 'image',
      };
      const docRef: ImageReference = {
        fileId: 'doc-456',
        mimeType: 'application/pdf',
        type: 'document',
      };

      const messages = [createTestMessage('msg-1', [imageRef, docRef])];
      const syncResults = new Map<string, ImageSyncResult>();

      const result = updateMessagesWithSyncedImages(messages, syncResults);

      const updatedAttachments = result[0]?.metadata?.['attachments'] as ImageReference[];
      expect(updatedAttachments[1]).toEqual(docRef);
    });

    it('updates multiple attachments correctly', () => {
      const ref1: ImageReference = {
        fileId: 'file-1',
        mimeType: 'image/png',
        type: 'image',
      };
      const ref2: ImageReference = {
        fileId: 'file-2',
        mimeType: 'image/png',
        type: 'image',
      };

      const newRef1: ImageReference = {
        ...ref1,
        fileUri: 'https://gemini.com/files/1',
      };
      const newRef2: ImageReference = {
        ...ref2,
        fileUri: 'https://gemini.com/files/2',
      };

      const messages = [createTestMessage('msg-1', [ref1, ref2])];
      const syncResults = new Map<string, ImageSyncResult>([
        ['msg-1_attachment_0', { originalRef: ref1, newRef: newRef1 }],
        ['msg-1_attachment_1', { originalRef: ref2, newRef: newRef2 }],
      ]);

      const result = updateMessagesWithSyncedImages(messages, syncResults);

      const updatedAttachments = result[0]?.metadata?.['attachments'] as ImageReference[];
      expect(updatedAttachments[0]?.fileUri).toBe('https://gemini.com/files/1');
      expect(updatedAttachments[1]?.fileUri).toBe('https://gemini.com/files/2');
    });

    it('does not mutate original messages', () => {
      const originalRef: ImageReference = {
        fileId: 'file-123',
        mimeType: 'image/png',
        type: 'image',
      };

      const messages = [createTestMessage('msg-1', [originalRef])];
      const syncResults = new Map<string, ImageSyncResult>([
        [
          'msg-1_attachment_0',
          {
            originalRef,
            newRef: { ...originalRef, fileUri: 'https://gemini.com/files/new' },
          },
        ],
      ]);

      const originalAttachments = messages[0]?.metadata?.['attachments'] as ImageReference[];
      const originalFileUri = originalAttachments[0]?.fileUri;

      updateMessagesWithSyncedImages(messages, syncResults);

      // Original should not be mutated
      const checkAttachments = messages[0]?.metadata?.['attachments'] as ImageReference[];
      expect(checkAttachments[0]?.fileUri).toBe(originalFileUri);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache Behavior
  // ---------------------------------------------------------------------------
  describe('cache behavior', () => {
    it('clearImageReferenceCache clears cached references', async () => {
      vi.mocked(imageUploadService.uploadImage).mockResolvedValue({
        fileUri: 'https://gemini.com/files/cached',
        mimeType: 'image/png',
        source: 'sync',
      });

      const createMsg = (id: string): ChatMessage => ({
        id,
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
        status: 'sent',
        metadata: {
          attachments: [
            {
              fileId: 'file-123',
              mimeType: 'image/png',
              data: 'data:image/png;base64,test',
              type: 'image',
            },
          ],
        },
      });

      // First sync
      await syncImagesToProvider([createMsg('1')], 'gemini', 'key', 'model');

      // Clear cache
      clearImageReferenceCache();
      vi.clearAllMocks();

      // Second sync should call uploadImage again (cache was cleared)
      await syncImagesToProvider([createMsg('2')], 'gemini', 'key', 'model');

      expect(imageUploadService.uploadImage).toHaveBeenCalled();
    });
  });
});
