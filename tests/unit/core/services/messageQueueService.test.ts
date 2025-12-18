/**
 * @file Message Queue Service Tests
 *
 * Tests for the MessageQueueService that manages message queuing when images
 * are uploading, ensuring proper sequencing and preventing race conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFakeTimers, mockMathRandom } from '@tests/helpers/time';

// Mock debugLog to suppress output and avoid side effects
vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
}));

// Import after mocks are set up
import { messageQueueService } from '@core/services/messageQueueService';

describe('MessageQueueService', () => {
  let cleanupRandom: (() => void) | null = null;
  let cleanupTimers: (() => void) | null = null;

  beforeEach(() => {
    // Clear all pending messages and uploads
    messageQueueService.clearQueue();
    messageQueueService.resume();
    messageQueueService.removeAllListeners();

    // Use fake timers so upload timeout logic can be tested deterministically.
    cleanupTimers = useFakeTimers(1700000000000);

    // Provide enough unique values to avoid ID collisions in bulk-queue tests.
    const randomValues = Array.from({ length: 128 }, (_, i) => (i + 1) / 1000);
    cleanupRandom = mockMathRandom(randomValues);
  });

  afterEach(() => {
    messageQueueService.clearQueue();
    messageQueueService.resume();
    messageQueueService.removeAllListeners();

    if (cleanupRandom) {
      cleanupRandom();
      cleanupRandom = null;
    }
    if (cleanupTimers) {
      cleanupTimers();
      cleanupTimers = null;
    }
  });

  describe('upload registration and tracking', () => {
    it('should register upload and return ID', () => {
      const uploadId = messageQueueService.registerUpload();

      expect(uploadId).toBeDefined();
      expect(uploadId).toMatch(/^upload_/);
    });

    it('should emit uploadRegistered event', () => {
      let registeredId: string | null = null;

      messageQueueService.on('uploadRegistered', (id: unknown) => {
        registeredId = id as string;
      });

      const uploadId = messageQueueService.registerUpload();

      expect(registeredId).toBe(uploadId);
    });

    it('should emit uploadStarted event', () => {
      let startedId: string | null = null;

      messageQueueService.on('uploadStarted', (id: unknown) => {
        startedId = id as string;
      });

      const uploadId = messageQueueService.registerUpload();
      messageQueueService.startUpload(uploadId);

      expect(startedId).toBe(uploadId);
    });

    it('should emit uploadCompleted event with result', () => {
      let completedId: string | null = null;
      let completedResult: unknown = null;

      messageQueueService.on('uploadCompleted', (id: unknown, result: unknown) => {
        completedId = id as string;
        completedResult = result;
      });

      const uploadId = messageQueueService.registerUpload();
      const result = { mimeType: 'image/png', fileUri: 'gs://bucket/test.png' };
      messageQueueService.completeUpload(uploadId, result);

      expect(completedId).toBe(uploadId);
      expect(completedResult).toEqual(result);
    });

    it('should emit uploadFailed event with error', () => {
      let failedId: string | null = null;
      let failedError: Error | null = null;

      messageQueueService.on('uploadFailed', (id: unknown, error: unknown) => {
        failedId = id as string;
        failedError = error as Error;
      });

      const uploadId = messageQueueService.registerUpload();
      const error = new Error('Test error');
      messageQueueService.failUpload(uploadId, error);

      expect(failedId).toBe(uploadId);
      expect(failedError).toBe(error);
    });

    it('should return correct status with active uploads', () => {
      messageQueueService.registerUpload();
      messageQueueService.registerUpload(undefined, { blockQueue: false });

      const status = messageQueueService.getStatus();

      expect(status.activeUploads).toBe(2);
      expect(status.blockingDependencies).toBe(1);
    });
  });

  describe('blocking dependency rules', () => {
    it('should have blocking dependencies when blockQueue=true upload is in progress', () => {
      messageQueueService.registerUpload();

      expect(messageQueueService.hasBlockingDependencies()).toBe(true);
    });

    it('should not have blocking dependencies when blockQueue=false', () => {
      messageQueueService.registerUpload('existing-msg-id', { blockQueue: false });

      expect(messageQueueService.hasBlockingDependencies()).toBe(false);
    });

    it('should clear blocking dependency when upload completes', () => {
      const uploadId = messageQueueService.registerUpload();
      expect(messageQueueService.hasBlockingDependencies()).toBe(true);

      messageQueueService.completeUpload(uploadId, { mimeType: 'image/png' });

      expect(messageQueueService.hasBlockingDependencies()).toBe(false);
    });

    it('should clear blocking dependency when upload fails', () => {
      const uploadId = messageQueueService.registerUpload();
      expect(messageQueueService.hasBlockingDependencies()).toBe(true);

      messageQueueService.failUpload(uploadId, new Error('Failed'));

      expect(messageQueueService.hasBlockingDependencies()).toBe(false);
    });
  });

  describe('queue message', () => {
    it('should queue message and emit event', () => {
      let queuedId: string | null = null;

      messageQueueService.on('messageQueued', (id: unknown) => {
        queuedId = id as string;
      });

      // Pause to prevent immediate processing
      messageQueueService.pause();

      const messageId = messageQueueService.queueMessage(
        'Test message',
        undefined,
        undefined,
        vi.fn()
      );

      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg_/);
      expect(queuedId).toBe(messageId);
    });

    it('should include metadata and attachments', () => {
      messageQueueService.pause();

      const uploadId = messageQueueService.registerUpload(undefined, { blockQueue: false });

      messageQueueService.queueMessage('Test', { key: 'value' }, [uploadId], vi.fn());

      const messages = messageQueueService.getQueuedMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.metadata).toEqual({ key: 'value' });
      expect(messages[0]?.attachments).toHaveLength(1);
    });

    it('should return copy of queued messages', () => {
      messageQueueService.pause();

      messageQueueService.queueMessage('Message 1', undefined, undefined, vi.fn());
      messageQueueService.queueMessage('Message 2', undefined, undefined, vi.fn());

      const messages = messageQueueService.getQueuedMessages();

      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('Message 1');
      expect(messages[1]?.content).toBe('Message 2');

      // Should be a copy
      messages.pop();
      expect(messageQueueService.getQueuedMessages()).toHaveLength(2);
    });
  });

  describe('queue size limit', () => {
    it('should throw when queue exceeds MAX_QUEUE_SIZE (50)', () => {
      messageQueueService.pause();

      // Fill up queue with 50 messages
      for (let i = 0; i < 50; i++) {
        messageQueueService.queueMessage(`Message ${i}`, undefined, undefined, vi.fn());
      }

      // 51st message should throw
      expect(() => {
        messageQueueService.queueMessage('One too many', undefined, undefined, vi.fn());
      }).toThrow('Message queue is full');
    });
  });

  describe('pause and resume', () => {
    it('should emit queuePaused event', () => {
      let paused = false;

      messageQueueService.on('queuePaused', () => {
        paused = true;
      });

      messageQueueService.pause();

      expect(paused).toBe(true);
      expect(messageQueueService.getStatus().isPaused).toBe(true);
    });

    it('should emit queueResumed event', () => {
      let resumed = false;

      messageQueueService.on('queueResumed', () => {
        resumed = true;
      });

      messageQueueService.pause();
      messageQueueService.resume();

      expect(resumed).toBe(true);
      expect(messageQueueService.getStatus().isPaused).toBe(false);
    });
  });

  describe('cancel message', () => {
    it('should cancel a queued message', () => {
      messageQueueService.pause();
      const messageId = messageQueueService.queueMessage(
        'To cancel',
        undefined,
        undefined,
        vi.fn()
      );

      const cancelled = messageQueueService.cancelMessage(messageId);

      expect(cancelled).toBe(true);
      expect(messageQueueService.getQueuedMessages()).toHaveLength(0);
    });

    it('should emit messageCancelled event', () => {
      let cancelledId: string | null = null;

      messageQueueService.on('messageCancelled', (id: unknown) => {
        cancelledId = id as string;
      });

      messageQueueService.pause();
      const messageId = messageQueueService.queueMessage(
        'To cancel',
        undefined,
        undefined,
        vi.fn()
      );
      messageQueueService.cancelMessage(messageId);

      expect(cancelledId).toBe(messageId);
    });

    it('should return false for non-existent message', () => {
      const result = messageQueueService.cancelMessage('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clear queue', () => {
    it('should clear all messages and uploads', () => {
      messageQueueService.pause();
      messageQueueService.registerUpload();
      messageQueueService.queueMessage('Message 1', undefined, undefined, vi.fn());
      messageQueueService.queueMessage('Message 2', undefined, undefined, vi.fn());

      messageQueueService.clearQueue();

      const status = messageQueueService.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.activeUploads).toBe(0);
    });

    it('should emit queueCleared event', () => {
      let cleared = false;

      messageQueueService.on('queueCleared', () => {
        cleared = true;
      });

      messageQueueService.clearQueue();

      expect(cleared).toBe(true);
    });
  });

  describe('waitUntilIdle', () => {
    it('should resolve immediately when already idle', async () => {
      const idle = messageQueueService.waitUntilIdle();
      await expect(idle).resolves.toBeUndefined();
    });

    it('should resolve after pending upload completes and message is sent', async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);

      const uploadId = messageQueueService.registerUpload(undefined, { blockQueue: false });
      messageQueueService.queueMessage('Hello', undefined, [uploadId], onSend);

      const idle = messageQueueService.waitUntilIdle();

      expect(onSend).not.toHaveBeenCalled();

      messageQueueService.completeUpload(uploadId, {
        fileId: 'file-test-1',
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,AAA',
      });

      await expect(idle).resolves.toBeUndefined();
      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle completing non-existent upload gracefully', () => {
      expect(() => {
        messageQueueService.completeUpload('non-existent', { mimeType: 'image/png' });
      }).not.toThrow();
    });

    it('should handle failing non-existent upload gracefully', () => {
      expect(() => {
        messageQueueService.failUpload('non-existent', new Error('Test'));
      }).not.toThrow();
    });

    it('should handle starting non-existent upload gracefully', () => {
      expect(() => {
        messageQueueService.startUpload('non-existent');
      }).not.toThrow();
    });

    it('should handle exception in event listener without breaking other listeners', () => {
      const goodListener = vi.fn();

      messageQueueService.on('uploadRegistered', () => {
        throw new Error('Listener error');
      });
      messageQueueService.on('uploadRegistered', goodListener);

      messageQueueService.registerUpload();

      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return complete status', () => {
      messageQueueService.pause();
      messageQueueService.registerUpload();
      messageQueueService.queueMessage('Test', undefined, undefined, vi.fn());

      const status = messageQueueService.getStatus();

      expect(status).toEqual({
        queueLength: 1,
        activeUploads: 1,
        blockingDependencies: 1,
        isProcessing: false,
        isPaused: true,
      });
    });
  });

  describe('queue processing', () => {
    it('should process a queued message and call onSend', async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);

      messageQueueService.queueMessage('Test message', undefined, undefined, onSend);

      await messageQueueService.waitUntilIdle();

      expect(onSend).toHaveBeenCalledWith('Test message', undefined);
      expect(messageQueueService.getQueuedMessages()).toHaveLength(0);
    });

    it('should merge existing attachments with newly uploaded ones', async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      const existingAttachment = {
        type: 'image',
        fileId: 'existing-file',
        mimeType: 'image/png',
      };

      const uploadId = messageQueueService.registerUpload(undefined, { blockQueue: false });

      messageQueueService.queueMessage(
        'Hello',
        { attachments: [existingAttachment], other: 'value' },
        [uploadId],
        onSend
      );

      // Complete the upload to unblock message processing.
      messageQueueService.startUpload(uploadId);
      messageQueueService.completeUpload(uploadId, {
        fileId: 'new-file',
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,BBB',
      });

      await messageQueueService.waitUntilIdle();

      expect(onSend).toHaveBeenCalledTimes(1);
      const sentMetadata = onSend.mock.calls[0]?.[1] as Record<string, unknown> | undefined;

      expect(sentMetadata).toBeDefined();
      expect(sentMetadata?.['other']).toBe('value');

      const attachments = sentMetadata?.['attachments'] as unknown[];
      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments).toHaveLength(2);
      expect(attachments[0]).toEqual(existingAttachment);
      expect(attachments[1]).toEqual(
        expect.objectContaining({
          type: 'image',
          fileId: 'new-file',
          mimeType: 'image/png',
          data: 'data:image/png;base64,BBB',
        })
      );
    });
  });

  describe('upload timeout', () => {
    it('should fail an upload after 30 seconds and emit uploadFailed', async () => {
      const failed: Array<{ id: string; message: string }> = [];

      messageQueueService.on('uploadFailed', (id: unknown, err: unknown) => {
        failed.push({
          id: String(id),
          message: (err as Error).message,
        });
      });

      const uploadId = messageQueueService.registerUpload();
      expect(messageQueueService.hasBlockingDependencies()).toBe(true);

      await vi.advanceTimersByTimeAsync(30000);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.id).toBe(uploadId);
      expect(failed[0]?.message).toContain('Upload timeout');
      expect(messageQueueService.getStatus().activeUploads).toBe(0);
      expect(messageQueueService.hasBlockingDependencies()).toBe(false);
    });
  });
});
