/**
 * @file Message Queue Service
 * Manages message queuing when images are uploading, ensuring proper sequencing
 * of messages with attachments and preventing race conditions.
 */

import { debugLog } from '@/utils/debug';

// Simple EventEmitter for browser environment
class EventEmitter {
  private events: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  on(event: string, listener: (...args: unknown[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.events.get(event)?.delete(listener);
  }

  emit(event: string, ...args: unknown[]): void {
    this.events.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        // Silently handle listener errors
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export interface QueuedMessage {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    uploadId: string;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    fileUri?: string;
    fileId?: string;
    mimeType?: string;
    data?: string;
    error?: string;
  }>;
  timestamp: number;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  onSend?: (message: string, metadata?: Record<string, unknown>) => void;
}

export interface ActiveUpload {
  id: string;
  messageId?: string; // Associated message ID if part of a queued message
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  result?: {
    fileUri?: string;
    fileId?: string;
    mimeType: string;
    previewUrl?: string;
  };
  error?: Error;
  timeoutHandle?: NodeJS.Timeout;
  reason?: string;
  blockQueue: boolean;
}

export interface UploadRegistrationOptions {
  reason?: string;
  blockQueue?: boolean;
}

interface QueueState {
  messages: QueuedMessage[];
  activeUploads: Map<string, ActiveUpload>;
  isProcessing: boolean;
  isPaused: boolean;
}

class MessageQueueService extends EventEmitter {
  private state: QueueState = {
    messages: [],
    activeUploads: new Map(),
    isProcessing: false,
    isPaused: false,
  };

  private readonly UPLOAD_TIMEOUT_MS = 30000; // 30 seconds timeout for uploads
  private readonly MAX_QUEUE_SIZE = 50; // Maximum number of queued messages
  private idleResolvers: Set<() => void> = new Set();

  constructor() {
    super();
  }

  /**
   * Register a new upload and get a unique upload ID
   */
  registerUpload(messageId?: string, options: UploadRegistrationOptions = {}): string {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Set timeout for upload
    const timeoutHandle = setTimeout(() => {
      this.handleUploadTimeout(uploadId);
    }, this.UPLOAD_TIMEOUT_MS);

    const blockQueue = options.blockQueue ?? !messageId;

    const upload: ActiveUpload = {
      id: uploadId,
      messageId,
      status: 'pending',
      startTime: Date.now(),
      timeoutHandle,
      reason: options.reason,
      blockQueue,
    };

    this.state.activeUploads.set(uploadId, upload);

    this.emit('uploadRegistered', uploadId);
    return uploadId;
  }

  /**
   * Mark an upload as started
   */
  startUpload(uploadId: string): void {
    const upload = this.state.activeUploads.get(uploadId);
    if (!upload) {
      return;
    }

    upload.status = 'uploading';
    this.emit('uploadStarted', uploadId);

    debugLog('MessageQueue', `start ${uploadId}`);
  }

  /**
   * Complete an upload with result
   */
  completeUpload(
    uploadId: string,
    result: { fileUri?: string; fileId?: string; mimeType: string; previewUrl?: string }
  ): void {
    const upload = this.state.activeUploads.get(uploadId);
    if (!upload) {
      return;
    }

    // Clear timeout
    if (upload.timeoutHandle) {
      clearTimeout(upload.timeoutHandle);
    }

    upload.status = 'completed';
    upload.endTime = Date.now();
    upload.result = result;

    const completeParts: string[] = [
      `complete ${uploadId}`,
      `t+${upload.endTime - upload.startTime}ms`,
    ];
    if (upload.messageId) completeParts.push(`msg:${upload.messageId}`);
    if (upload.reason) completeParts.push(`reason:${upload.reason}`);
    debugLog('MessageQueue', completeParts.join(' | '));

    // Update associated message if exists
    if (upload.messageId) {
      this.updateMessageAttachment(upload.messageId, uploadId, result);
    } else {
      // If no messageId yet, check if any queued messages are waiting for this upload
      for (const message of this.state.messages) {
        const attachment = message.attachments?.find(att => att.uploadId === uploadId);
        if (attachment) {
          attachment.status = 'completed';
          attachment.fileUri = result.fileUri;
          attachment.fileId = result.fileId;
          attachment.mimeType = result.mimeType;
          attachment.data = result.previewUrl;
          debugLog(
            'MessageQueue',
            `Updated orphaned attachment ${uploadId} in message ${message.id}`
          );
          break;
        }
      }
    }

    this.emit('uploadCompleted', uploadId, result);

    // Remove upload from active set to avoid leaking completed entries
    this.state.activeUploads.delete(uploadId);

    // Check if we can process queue
    this.processQueue();
    this.checkIdle();
  }

  /**
   * Fail an upload with error
   */
  failUpload(uploadId: string, error: Error): void {
    const upload = this.state.activeUploads.get(uploadId);
    if (!upload) {
      return;
    }

    // Clear timeout
    if (upload.timeoutHandle) {
      clearTimeout(upload.timeoutHandle);
    }

    upload.status = 'failed';
    upload.endTime = Date.now();
    upload.error = error;

    const failParts: string[] = [
      `fail ${uploadId}`,
      `t+${upload.endTime - upload.startTime}ms`,
      `error:${error.message}`,
    ];
    if (upload.messageId) failParts.push(`msg:${upload.messageId}`);
    if (upload.reason) failParts.push(`reason:${upload.reason}`);
    debugLog('MessageQueue', failParts.join(' | '));

    // Update associated message if exists
    if (upload.messageId) {
      this.updateMessageAttachmentError(upload.messageId, uploadId, error.message);
    }

    this.emit('uploadFailed', uploadId, error);

    // Remove failed upload to unblock queue
    this.state.activeUploads.delete(uploadId);

    // Check if we can process queue (might proceed without this upload)
    this.processQueue();
    this.checkIdle();
  }

  /**
   * Handle upload timeout
   */
  private handleUploadTimeout(uploadId: string): void {
    const upload = this.state.activeUploads.get(uploadId);
    if (upload && upload.status !== 'completed' && upload.status !== 'failed') {
      this.failUpload(uploadId, new Error('Upload timeout after 30 seconds'));
    }
  }

  /**
   * Queue a message (with or without attachments)
   */
  queueMessage(
    content: string,
    metadata?: Record<string, unknown>,
    uploadIds?: string[],
    onSend?: (message: string, metadata?: Record<string, unknown>) => void
  ): string {
    if (this.state.messages.length >= this.MAX_QUEUE_SIZE) {
      throw new Error('Message queue is full. Please wait for messages to be processed.');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create attachments from upload IDs
    const attachments = uploadIds?.map(uploadId => {
      const upload = this.state.activeUploads.get(uploadId);
      if (upload) {
        upload.messageId = messageId; // Associate upload with message

        debugLog(
          'MessageQueue',
          `attach ${uploadId} -> ${messageId} (status:${upload.status}${upload.result ? ',ready' : ''})`
        );
      }

      return {
        uploadId,
        status: upload?.status || ('pending' as const),
        fileUri: upload?.result?.fileUri,
        fileId: upload?.result?.fileId,
        mimeType: upload?.result?.mimeType,
        data: upload?.result?.previewUrl,
      };
    });

    const metadataCopy = metadata
      ? (JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>)
      : undefined;

    const message: QueuedMessage = {
      id: messageId,
      content,
      metadata: metadataCopy,
      attachments,
      timestamp: Date.now(),
      status: 'queued',
      onSend,
    };

    this.state.messages.push(message);

    debugLog('MessageQueue', `queued ${messageId} (len:${this.state.messages.length})`);

    this.emit('messageQueued', messageId);

    // Try to process queue immediately
    this.processQueue();

    return messageId;
  }

  /**
   * Check if there are active uploads not associated with any message
   */
  hasBlockingDependencies(): boolean {
    for (const upload of this.state.activeUploads.values()) {
      if (upload.blockQueue && (upload.status === 'pending' || upload.status === 'uploading')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process the message queue
   */
  private async processQueue(): Promise<void> {
    if (this.state.isProcessing || this.state.isPaused) {
      return;
    }

    // Check if there are blocking uploads in progress
    if (this.hasBlockingDependencies()) {
      return;
    }

    const nextMessage = this.state.messages.find(msg => msg.status === 'queued');
    if (!nextMessage) {
      return;
    }

    // Check if message has pending uploads
    const hasPendingUploads = nextMessage.attachments?.some(
      att => att.status === 'pending' || att.status === 'uploading'
    );

    if (hasPendingUploads) {
      return;
    }

    this.state.isProcessing = true;
    nextMessage.status = 'processing';
    this.emit('messageProcessing', nextMessage.id);

    try {
      // Filter out failed attachments and prepare metadata
      const successfulAttachments = nextMessage.attachments?.filter(
        att => att.status === 'completed' && (att.fileUri || att.fileId)
      );

      // Merge existing attachments from metadata with newly uploaded ones
      const existingAttachments = Array.isArray(nextMessage.metadata?.['attachments'])
        ? nextMessage.metadata['attachments']
        : [];
      const newAttachments =
        successfulAttachments?.map(att => ({
          type: 'image',
          fileUri: att.fileUri,
          fileId: att.fileId,
          mimeType: att.mimeType,
          data: att.data,
        })) || [];

      const allAttachments = [...existingAttachments, ...newAttachments];

      const finalMetadata = {
        ...nextMessage.metadata,
        ...(allAttachments.length > 0 && {
          attachments: allAttachments,
        }),
      };

      if (nextMessage.onSend) {
        debugLog('MessageQueue', `dequeue ${nextMessage.id}`);
        await nextMessage.onSend(
          nextMessage.content || (successfulAttachments?.length ? '[Image]' : ''),
          Object.keys(finalMetadata).length > 0 ? finalMetadata : undefined
        );
      }

      // Clean up associated uploads
      nextMessage.attachments?.forEach(att => {
        this.state.activeUploads.delete(att.uploadId);
      });

      // Remove from queue
      this.state.messages = this.state.messages.filter(msg => msg.id !== nextMessage.id);

      nextMessage.status = 'sent';
      this.emit('messageSent', nextMessage.id);
    } catch (error) {
      // Remove failed message from queue
      this.state.messages = this.state.messages.filter(msg => msg.id !== nextMessage.id);

      nextMessage.status = 'failed';
      this.emit('messageFailed', nextMessage.id, error);
    } finally {
      this.state.isProcessing = false;

      // Process next message if available
      setTimeout(() => this.processQueue(), 0);
      this.checkIdle();
    }
  }

  /**
   * Update message attachment with upload result
   */
  private updateMessageAttachment(
    messageId: string,
    uploadId: string,
    result: { fileUri?: string; fileId?: string; mimeType: string; previewUrl?: string }
  ): void {
    const message = this.state.messages.find(msg => msg.id === messageId);
    if (!message) return;

    const attachment = message.attachments?.find(att => att.uploadId === uploadId);
    if (!attachment) return;

    attachment.status = 'completed';
    attachment.fileUri = result.fileUri;
    attachment.fileId = result.fileId;
    attachment.mimeType = result.mimeType;
    attachment.data = result.previewUrl;
  }

  /**
   * Update message attachment with error
   */
  private updateMessageAttachmentError(messageId: string, uploadId: string, error: string): void {
    const message = this.state.messages.find(msg => msg.id === messageId);
    if (!message) return;

    const attachment = message.attachments?.find(att => att.uploadId === uploadId);
    if (!attachment) return;

    attachment.status = 'failed';
    attachment.error = error;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    activeUploads: number;
    blockingDependencies: number;
    isProcessing: boolean;
    isPaused: boolean;
  } {
    let activeUploads = 0;
    let blockingDependencies = 0;
    for (const upload of this.state.activeUploads.values()) {
      if (upload.status === 'pending' || upload.status === 'uploading') {
        activeUploads += 1;
        if (upload.blockQueue) {
          blockingDependencies += 1;
        }
      }
    }

    return {
      queueLength: this.state.messages.length,
      activeUploads,
      blockingDependencies,
      isProcessing: this.state.isProcessing,
      isPaused: this.state.isPaused,
    };
  }

  /**
   * Get queued messages
   */
  getQueuedMessages(): QueuedMessage[] {
    return [...this.state.messages];
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit('queuePaused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.state.isPaused = false;
    this.emit('queueResumed');
    this.processQueue();
  }

  /**
   * Clear the queue (emergency use only)
   */
  clearQueue(): void {
    // Cancel all timeouts
    for (const upload of this.state.activeUploads.values()) {
      if (upload.timeoutHandle) {
        clearTimeout(upload.timeoutHandle);
      }
    }

    this.state.messages = [];
    this.state.activeUploads.clear();
    this.state.isProcessing = false;
    this.emit('queueCleared');
    this.checkIdle();
  }

  /**
   * Cancel a specific message
   */
  cancelMessage(messageId: string): boolean {
    const messageIndex = this.state.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return false;

    const message = this.state.messages[messageIndex];
    if (!message || message.status === 'processing') {
      // Can't cancel a message being processed
      return false;
    }

    // Cancel associated uploads
    message.attachments?.forEach(att => {
      const upload = this.state.activeUploads.get(att.uploadId);
      if (upload?.timeoutHandle) {
        clearTimeout(upload.timeoutHandle);
      }
      this.state.activeUploads.delete(att.uploadId);
    });

    this.state.messages.splice(messageIndex, 1);
    this.emit('messageCancelled', messageId);
    this.checkIdle();
    return true;
  }

  /**
   * Await completion of all queued messages and blocking uploads
   */
  waitUntilIdle(): Promise<void> {
    if (this.isIdle()) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.idleResolvers.add(resolve);
    });
  }

  private isIdle(): boolean {
    const hasQueued = this.state.messages.some(
      msg => msg.status === 'queued' || msg.status === 'processing'
    );
    const hasActiveUploads = Array.from(this.state.activeUploads.values()).some(
      upload => upload.status === 'pending' || upload.status === 'uploading'
    );

    return !hasQueued && !hasActiveUploads;
  }

  private checkIdle(): void {
    if (!this.isIdle()) {
      return;
    }

    if (this.idleResolvers.size > 0) {
      for (const resolve of this.idleResolvers) {
        resolve();
      }
      this.idleResolvers.clear();
    }
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();

// Export types
export type { MessageQueueService };
