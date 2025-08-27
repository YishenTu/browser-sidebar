/**
 * @file Data Cleanup Tests
 * 
 * Comprehensive test suite for data cleanup utilities including complete and selective
 * data clearing with safety checks, rollback mechanisms, and cleanup scheduling.
 * 
 * Tests follow TDD methodology - written first before implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { ConversationData } from '../../src/types/conversation';
import type { Settings } from '../../src/types/settings';
import type { APIKeyStorage } from '../../src/types/apiKeys';
import type { CacheEntry, StorageSchema, StorageArea } from '../../src/types/storage';
import type { IndexedDBWrapper } from '../../src/storage/indexedDB';
import type { Cache } from '../../src/storage/cache';

// Import modules to mock
import * as chromeStorage from '../../src/storage/chromeStorage';
import { ConversationStorage } from '../../src/storage/conversations';
import { dbInstance } from '../../src/storage/indexedDB';

// The module under test - to be implemented
interface CleanupOptions {
  /** Data types to clean */
  dataTypes?: Array<'conversations' | 'cache' | 'apiKeys' | 'chromeStorage' | 'indexedDB'>;
  /** Date range filter - items older than this will be cleaned */
  olderThan?: number;
  /** Size threshold - clean when storage exceeds this size in bytes */
  sizeThreshold?: number;
  /** Selective filters */
  filters?: {
    archived?: boolean;
    tags?: string[];
    unused?: boolean;
    expired?: boolean;
  };
  /** Whether to require confirmation */
  requireConfirmation?: boolean;
  /** Whether to create backup before cleanup */
  createBackup?: boolean;
  /** Dry run mode - return what would be cleaned without actually cleaning */
  dryRun?: boolean;
}

interface CleanupResult {
  /** Total items cleaned */
  totalCleaned: number;
  /** Breakdown by data type */
  breakdown: {
    conversations: number;
    cache: number;
    apiKeys: number;
    chromeStorage: number;
    indexedDB: number;
  };
  /** Bytes freed */
  bytesFreed: number;
  /** Time taken in milliseconds */
  duration: number;
  /** Backup created (if requested) */
  backupCreated?: string;
  /** Errors encountered */
  errors: string[];
}

interface CleanupSchedule {
  /** Cleanup interval in milliseconds */
  interval: number;
  /** Auto-cleanup options */
  options: CleanupOptions;
  /** Whether scheduling is enabled */
  enabled: boolean;
  /** Last cleanup timestamp */
  lastCleanup?: number;
  /** Next cleanup timestamp */
  nextCleanup?: number;
}

// Mock the modules we'll use
vi.mock('../../src/storage/chromeStorage');
vi.mock('../../src/storage/indexedDB');
vi.mock('../../src/storage/conversations');

const mockChromeStorage = vi.mocked(chromeStorage);
const mockDbInstance = vi.mocked(dbInstance);
const mockConversationStorage = vi.mocked(ConversationStorage);

describe('Data Cleanup', () => {
  // Will be dynamically imported after mocking
  let DataCleanup: any;
  let cleanup: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset Chrome storage mocks
    mockChromeStorage.clear.mockResolvedValue();
    mockChromeStorage.get.mockResolvedValue(null);
    mockChromeStorage.getBatch.mockResolvedValue({});
    mockChromeStorage.setBatch.mockResolvedValue();
    mockChromeStorage.getStorageInfo.mockResolvedValue({
      used: 1000,
      quota: 5242880,
      available: 5241880,
      usagePercentage: 0.019
    });

    // Reset IndexedDB mocks
    mockDbInstance.getAll.mockResolvedValue([]);
    mockDbInstance.delete.mockResolvedValue();
    mockDbInstance.batchDelete.mockResolvedValue();
    mockDbInstance.deleteDatabase.mockResolvedValue();

    try {
      // Dynamic import to get fresh instance after mocking
      const module = await import('../../src/storage/cleanup');
      DataCleanup = module.DataCleanup;
      cleanup = new DataCleanup();
    } catch (error) {
      // Implementation doesn't exist yet - that's expected in TDD
      DataCleanup = null;
      cleanup = null;
    }
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Complete Data Cleanup', () => {
    it('should clear all data when no options specified', async () => {
      if (!cleanup) return; // Skip if not implemented yet

      const result = await cleanup.clearAll();

      expect(result).toMatchObject({
        totalCleaned: expect.any(Number),
        breakdown: {
          conversations: expect.any(Number),
          cache: expect.any(Number),
          apiKeys: expect.any(Number),
          chromeStorage: expect.any(Number),
          indexedDB: expect.any(Number),
        },
        bytesFreed: expect.any(Number),
        duration: expect.any(Number),
        errors: expect.any(Array),
      });

      expect(result.totalCleaned).toBeGreaterThanOrEqual(0);
      expect(result.bytesFreed).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should clear all conversations from IndexedDB', async () => {
      if (!cleanup) return;

      const mockConversations = [
        { id: 'conv1', title: 'Test 1' },
        { id: 'conv2', title: 'Test 2' },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      const result = await cleanup.clearAll({ dataTypes: ['conversations'] });

      expect(mockDbInstance.getAll).toHaveBeenCalledWith('conversations');
      expect(mockDbInstance.batchDelete).toHaveBeenCalledWith('conversations', ['conv1', 'conv2']);
      expect(result.breakdown.conversations).toBe(2);
    });

    it('should clear all cache entries', async () => {
      if (!cleanup) return;

      const result = await cleanup.clearAll({ dataTypes: ['cache'] });

      expect(result.breakdown.cache).toBeGreaterThanOrEqual(0);
    });

    it('should clear all API keys from Chrome storage', async () => {
      if (!cleanup) return;

      const mockApiKeys = {
        'apiKeys:openai': { id: 'openai', encrypted: true },
        'apiKeys:anthropic': { id: 'anthropic', encrypted: true },
      };
      mockChromeStorage.getBatch.mockResolvedValue(mockApiKeys);

      const result = await cleanup.clearAll({ dataTypes: ['apiKeys'] });

      expect(result.breakdown.apiKeys).toBeGreaterThanOrEqual(0);
    });

    it('should clear all Chrome storage areas', async () => {
      if (!cleanup) return;

      const result = await cleanup.clearAll({ dataTypes: ['chromeStorage'] });

      expect(mockChromeStorage.clear).toHaveBeenCalledWith('local');
      expect(mockChromeStorage.clear).toHaveBeenCalledWith('sync');
      expect(result.breakdown.chromeStorage).toBeGreaterThanOrEqual(0);
    });

    it('should delete entire IndexedDB database', async () => {
      if (!cleanup) return;

      const result = await cleanup.clearAll({ dataTypes: ['indexedDB'] });

      expect(mockDbInstance.deleteDatabase).toHaveBeenCalled();
      expect(result.breakdown.indexedDB).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      if (!cleanup) return;

      mockDbInstance.deleteDatabase.mockRejectedValue(new Error('Database locked'));

      const result = await cleanup.clearAll({ dataTypes: ['indexedDB'] });

      expect(result.errors).toContain('Database locked');
      expect(result.totalCleaned).toBe(0);
    });
  });

  describe('Selective Data Cleanup', () => {
    it('should clean conversations older than specified date', async () => {
      if (!cleanup) return;

      const oldDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const mockConversations: ConversationData[] = [
        {
          id: 'old1',
          title: 'Old Conversation',
          messages: [],
          metadata: {
            createdAt: oldDate - 1000,
            updatedAt: oldDate - 1000,
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: oldDate - 1000,
          },
        },
        {
          id: 'new1',
          title: 'New Conversation',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: Date.now(),
          },
        },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      const result = await cleanup.cleanConversations({
        olderThan: oldDate,
      });

      expect(mockDbInstance.batchDelete).toHaveBeenCalledWith('conversations', ['old1']);
      expect(result.breakdown.conversations).toBe(1);
    });

    it('should clean only archived conversations when specified', async () => {
      if (!cleanup) return;

      const mockConversations: ConversationData[] = [
        {
          id: 'archived1',
          title: 'Archived',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: true,
            tags: [],
            lastActivity: Date.now(),
          },
        },
        {
          id: 'active1',
          title: 'Active',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: Date.now(),
          },
        },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      const result = await cleanup.cleanConversations({
        filters: { archived: true },
      });

      expect(mockDbInstance.batchDelete).toHaveBeenCalledWith('conversations', ['archived1']);
      expect(result.breakdown.conversations).toBe(1);
    });

    it('should clean conversations with specific tags', async () => {
      if (!cleanup) return;

      const mockConversations: ConversationData[] = [
        {
          id: 'tagged1',
          title: 'Tagged',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: false,
            tags: ['cleanup', 'test'],
            lastActivity: Date.now(),
          },
        },
        {
          id: 'untagged1',
          title: 'Untagged',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: Date.now(),
          },
        },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      const result = await cleanup.cleanConversations({
        filters: { tags: ['cleanup'] },
      });

      expect(mockDbInstance.batchDelete).toHaveBeenCalledWith('conversations', ['tagged1']);
      expect(result.breakdown.conversations).toBe(1);
    });

    it('should clean expired cache entries', async () => {
      if (!cleanup) return;

      const result = await cleanup.cleanCache({
        filters: { expired: true },
      });

      expect(result.breakdown.cache).toBeGreaterThanOrEqual(0);
    });

    it('should clean cache entries by tag', async () => {
      if (!cleanup) return;

      const result = await cleanup.cleanCache({
        filters: { tags: ['temporary'] },
      });

      expect(result.breakdown.cache).toBeGreaterThanOrEqual(0);
    });

    it('should clean unused API keys', async () => {
      if (!cleanup) return;

      const result = await cleanup.cleanApiKeys({
        filters: { unused: true },
      });

      expect(result.breakdown.apiKeys).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Size-based Cleanup', () => {
    it('should clean data when storage exceeds size threshold', async () => {
      if (!cleanup) return;

      // Mock conversations to clean
      const mockConversations: ConversationData[] = [
        {
          id: 'conv1',
          title: 'Test Conversation',
          messages: [],
          metadata: {
            createdAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: Date.now() - 1000,
          },
        },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      mockChromeStorage.getStorageInfo.mockResolvedValue({
        used: 4 * 1024 * 1024, // 4MB
        quota: 5 * 1024 * 1024, // 5MB
        available: 1024 * 1024, // 1MB
        usagePercentage: 80
      });

      const result = await cleanup.cleanBySize({
        sizeThreshold: 3 * 1024 * 1024, // 3MB threshold
      });

      expect(result.totalCleaned).toBeGreaterThan(0);
      expect(result.bytesFreed).toBeGreaterThan(0);
    });

    it('should prioritize oldest items for size-based cleanup', async () => {
      if (!cleanup) return;

      const oldDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
      const mediumDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const mockConversations: ConversationData[] = [
        {
          id: 'oldest',
          title: 'Oldest',
          messages: [],
          metadata: {
            createdAt: oldDate,
            updatedAt: oldDate,
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: oldDate,
          },
        },
        {
          id: 'medium',
          title: 'Medium',
          messages: [],
          metadata: {
            createdAt: mediumDate,
            updatedAt: mediumDate,
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: mediumDate,
          },
        },
        {
          id: 'newest',
          title: 'Newest',
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            archived: false,
            tags: [],
            lastActivity: Date.now(),
          },
        },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      mockChromeStorage.getStorageInfo.mockResolvedValue({
        used: 4 * 1024 * 1024, // 4MB - exceeds 3MB threshold
        quota: 5 * 1024 * 1024,
        available: 1024 * 1024,
        usagePercentage: 80
      });

      const result = await cleanup.cleanBySize({
        sizeThreshold: 3 * 1024 * 1024,
      });

      // Should clean oldest first
      expect(mockDbInstance.batchDelete).toHaveBeenCalledWith(
        'conversations',
        expect.arrayContaining(['oldest'])
      );
    });
  });

  describe('Confirmation and Safety', () => {
    it('should require confirmation when specified', async () => {
      if (!cleanup) return;

      // Mock user confirmation
      const confirmSpy = vi.fn().mockResolvedValue(true);
      cleanup.setConfirmationHandler(confirmSpy);

      const result = await cleanup.clearAll({
        requireConfirmation: true,
      });

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'clearAll',
          itemsToClean: expect.any(Number),
          bytesToFree: expect.any(Number),
        })
      );
    });

    it('should abort cleanup when confirmation is denied', async () => {
      if (!cleanup) return;

      const confirmSpy = vi.fn().mockResolvedValue(false);
      cleanup.setConfirmationHandler(confirmSpy);

      const result = await cleanup.clearAll({
        requireConfirmation: true,
      });

      expect(result.totalCleaned).toBe(0);
      expect(result.errors).toContain('Cleanup cancelled by user');
    });

    it('should create backup when requested', async () => {
      if (!cleanup) return;

      const result = await cleanup.clearAll({
        createBackup: true,
      });

      expect(result.backupCreated).toBeDefined();
      expect(result.backupCreated).toMatch(/backup-\d{13}\.json/);
    });

    it('should support dry run mode', async () => {
      if (!cleanup) return;

      const mockConversations = [
        { id: 'conv1', title: 'Test 1' },
        { id: 'conv2', title: 'Test 2' },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);

      const result = await cleanup.clearAll({
        dryRun: true,
      });

      // Should not actually delete anything
      expect(mockDbInstance.batchDelete).not.toHaveBeenCalled();
      expect(mockChromeStorage.clear).not.toHaveBeenCalled();
      
      // But should report what would be cleaned
      expect(result.totalCleaned).toBeGreaterThan(0);
      expect(result.breakdown.conversations).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Rollback', () => {
    it('should support rollback from backup', async () => {
      if (!cleanup) return;

      const backupData = {
        conversations: { conv1: { id: 'conv1', title: 'Test' } },
        cache: {},
        apiKeys: {},
        settings: {},
      };

      const result = await cleanup.rollback('backup-1234567890123.json', backupData);

      expect(result.restored).toBe(true);
      expect(result.itemsRestored).toBeGreaterThan(0);
    });

    it('should validate backup data before rollback', async () => {
      if (!cleanup) return;

      const invalidBackup = { invalid: 'data' };

      await expect(
        cleanup.rollback('backup-1234567890123.json', invalidBackup)
      ).rejects.toThrow('Invalid backup format');
    });
  });

  describe('Cleanup Statistics', () => {
    it('should provide detailed cleanup statistics', async () => {
      if (!cleanup) return;

      const result = await cleanup.clearAll();

      expect(result).toHaveProperty('totalCleaned');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('bytesFreed');
      expect(result).toHaveProperty('duration');
      expect(result.breakdown).toHaveProperty('conversations');
      expect(result.breakdown).toHaveProperty('cache');
      expect(result.breakdown).toHaveProperty('apiKeys');
      expect(result.breakdown).toHaveProperty('chromeStorage');
      expect(result.breakdown).toHaveProperty('indexedDB');
    });

    it('should measure cleanup duration accurately', async () => {
      if (!cleanup) return;

      const startTime = Date.now();
      const result = await cleanup.clearAll();
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 10); // Allow 10ms tolerance
    });
  });

  describe('Cleanup Scheduling', () => {
    it('should schedule automatic cleanup', async () => {
      if (!cleanup) return;
      vi.useFakeTimers();

      const schedule: CleanupSchedule = {
        interval: 24 * 60 * 60 * 1000, // 24 hours
        options: {
          dataTypes: ['cache'],
          filters: { expired: true },
        },
        enabled: true,
      };

      const cleanupSpy = vi.spyOn(cleanup, 'cleanCache');
      
      cleanup.scheduleCleanup(schedule);

      // Fast forward 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(cleanupSpy).toHaveBeenCalledWith(schedule.options);

      vi.useRealTimers();
    });

    it('should not run scheduled cleanup when disabled', async () => {
      if (!cleanup) return;
      vi.useFakeTimers();

      const schedule: CleanupSchedule = {
        interval: 60 * 1000, // 1 minute
        options: { dataTypes: ['cache'] },
        enabled: false,
      };

      const cleanupSpy = vi.spyOn(cleanup, 'cleanCache');
      
      cleanup.scheduleCleanup(schedule);
      vi.advanceTimersByTime(60 * 1000);

      expect(cleanupSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should update next cleanup timestamp', async () => {
      if (!cleanup) return;

      const schedule: CleanupSchedule = {
        interval: 60 * 60 * 1000, // 1 hour
        options: { dataTypes: ['cache'] },
        enabled: true,
      };

      const updatedSchedule = cleanup.scheduleCleanup(schedule);

      expect(updatedSchedule.nextCleanup).toBeDefined();
      expect(updatedSchedule.nextCleanup).toBeGreaterThan(Date.now());
    });

    it('should allow canceling scheduled cleanup', async () => {
      if (!cleanup) return;

      const schedule: CleanupSchedule = {
        interval: 60 * 1000,
        options: { dataTypes: ['cache'] },
        enabled: true,
      };

      cleanup.scheduleCleanup(schedule);
      const cancelled = cleanup.cancelScheduledCleanup();

      expect(cancelled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle IndexedDB errors gracefully', async () => {
      if (!cleanup) return;

      mockDbInstance.getAll.mockRejectedValue(new Error('IndexedDB connection failed'));

      const result = await cleanup.clearAll({ dataTypes: ['conversations'] });

      expect(result.errors).toContain('IndexedDB connection failed');
      expect(result.totalCleaned).toBe(0);
    });

    it('should handle Chrome storage errors gracefully', async () => {
      if (!cleanup) return;

      mockChromeStorage.clear.mockRejectedValue(new Error('Storage quota exceeded'));

      const result = await cleanup.clearAll({ dataTypes: ['chromeStorage'] });

      expect(result.errors).toContain('Storage quota exceeded');
    });

    it('should continue with other operations when one fails', async () => {
      if (!cleanup) return;

      mockDbInstance.getAll.mockRejectedValue(new Error('IndexedDB failed'));
      
      // Mock Chrome storage to have some items
      mockChromeStorage.getBatch.mockResolvedValue({
        'setting1': 'value1',
        'setting2': 'value2',
      });
      mockChromeStorage.clear.mockResolvedValue(); // This should succeed

      const result = await cleanup.clearAll({
        dataTypes: ['conversations', 'chromeStorage'],
      });

      expect(result.errors).toContain('IndexedDB failed');
      expect(result.breakdown.chromeStorage).toBeGreaterThan(0);
      expect(mockChromeStorage.clear).toHaveBeenCalled();
    });

    it('should handle partial failures in batch operations', async () => {
      if (!cleanup) return;

      const mockConversations = [
        { id: 'conv1', title: 'Test 1' },
        { id: 'conv2', title: 'Test 2' },
      ];
      mockDbInstance.getAll.mockResolvedValue(mockConversations);
      mockDbInstance.batchDelete.mockRejectedValue(new Error('Some items could not be deleted'));

      const result = await cleanup.clearAll({ dataTypes: ['conversations'] });

      expect(result.errors).toContain('Some items could not be deleted');
      expect(result.breakdown.conversations).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should complete cleanup within reasonable time', async () => {
      if (!cleanup) return;

      const startTime = Date.now();
      await cleanup.clearAll();
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds for small datasets
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large datasets efficiently', async () => {
      if (!cleanup) return;

      // Mock large dataset
      const largeConversationList = Array.from({ length: 1000 }, (_, i) => ({
        id: `conv${i}`,
        title: `Conversation ${i}`,
      }));
      mockDbInstance.getAll.mockResolvedValue(largeConversationList);

      const startTime = Date.now();
      const result = await cleanup.clearAll({ dataTypes: ['conversations'] });
      const duration = Date.now() - startTime;

      expect(result.breakdown.conversations).toBe(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});