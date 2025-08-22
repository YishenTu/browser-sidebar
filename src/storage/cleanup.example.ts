/**
 * @file Data Cleanup Usage Examples
 * 
 * Examples showing how to use the data cleanup utilities for various scenarios.
 * This file is for documentation purposes and is not included in the build.
 */

import { DataCleanup } from './cleanup';

// =============================================================================
// Basic Usage Examples
// =============================================================================

async function basicCleanupExamples() {
  const cleanup = new DataCleanup();

  // Example 1: Complete data wipe with confirmation
  const completeWipeResult = await cleanup.clearAll({
    requireConfirmation: true,
    createBackup: true,
  });
  console.log('Complete wipe result:', completeWipeResult);

  // Example 2: Clean only conversations older than 30 days
  const oldConversationsResult = await cleanup.cleanConversations({
    olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
  });
  console.log('Old conversations cleaned:', oldConversationsResult.breakdown.conversations);

  // Example 3: Clean archived conversations
  const archivedResult = await cleanup.cleanConversations({
    filters: { archived: true },
  });
  console.log('Archived conversations cleaned:', archivedResult.breakdown.conversations);

  // Example 4: Clean expired cache entries
  const expiredCacheResult = await cleanup.cleanCache({
    filters: { expired: true },
  });
  console.log('Expired cache entries cleaned:', expiredCacheResult.breakdown.cache);

  // Example 5: Size-based cleanup when storage exceeds 50MB
  const sizeLimitResult = await cleanup.cleanBySize({
    sizeThreshold: 50 * 1024 * 1024, // 50MB
  });
  console.log('Size-based cleanup:', sizeLimitResult);
}

// =============================================================================
// Advanced Usage Examples
// =============================================================================

async function advancedCleanupExamples() {
  const cleanup = new DataCleanup();

  // Set up confirmation handler
  cleanup.setConfirmationHandler(async (details) => {
    console.log(`Cleanup will remove ${details.itemsToClean} items and free ${details.bytesToFree} bytes`);
    return confirm('Are you sure you want to proceed?');
  });

  // Example 1: Dry run to see what would be cleaned
  const dryRunResult = await cleanup.clearAll({
    dataTypes: ['conversations', 'cache'],
    dryRun: true,
  });
  console.log('Dry run result - would clean:', dryRunResult.totalCleaned, 'items');

  // Example 2: Clean conversations with specific tags
  const taggedCleanupResult = await cleanup.cleanConversations({
    filters: { tags: ['temporary', 'test'] },
  });
  console.log('Tagged conversations cleaned:', taggedCleanupResult.breakdown.conversations);

  // Example 3: Selective cleanup with backup
  const selectiveResult = await cleanup.clearAll({
    dataTypes: ['cache', 'apiKeys'],
    createBackup: true,
    requireConfirmation: false,
  });
  console.log('Selective cleanup completed, backup:', selectiveResult.backupCreated);

  // Example 4: Rollback from backup
  if (selectiveResult.backupCreated) {
    const rollbackResult = await cleanup.rollback(selectiveResult.backupCreated);
    console.log('Rollback result:', rollbackResult);
  }
}

// =============================================================================
// Scheduled Cleanup Examples
// =============================================================================

async function scheduledCleanupExamples() {
  const cleanup = new DataCleanup();

  // Example 1: Schedule daily cache cleanup
  const dailyCacheCleanup = cleanup.scheduleCleanup({
    interval: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
    options: {
      dataTypes: ['cache'],
      filters: { expired: true },
    },
  });
  console.log('Scheduled cleanup:', dailyCacheCleanup);

  // Example 2: Schedule weekly conversation archive cleanup
  const weeklyArchiveCleanup = cleanup.scheduleCleanup({
    interval: 7 * 24 * 60 * 60 * 1000, // 7 days
    enabled: true,
    options: {
      dataTypes: ['conversations'],
      filters: { archived: true },
      olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000, // Older than 30 days
    },
  });
  console.log('Scheduled archive cleanup:', weeklyArchiveCleanup);

  // Cancel scheduled cleanup when done
  setTimeout(() => {
    const cancelled = cleanup.cancelScheduledCleanup();
    console.log('Scheduled cleanup cancelled:', cancelled);
  }, 60000); // Cancel after 1 minute
}

// =============================================================================
// Error Handling Examples
// =============================================================================

async function errorHandlingExamples() {
  const cleanup = new DataCleanup();

  try {
    // Example: Handle cleanup errors gracefully
    const result = await cleanup.clearAll({
      dataTypes: ['conversations', 'cache', 'apiKeys'],
    });

    if (result.errors.length > 0) {
      console.warn('Cleanup completed with errors:', result.errors);
    } else {
      console.log('Cleanup completed successfully:', result);
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// =============================================================================
// Export Examples (not executed)
// =============================================================================

export {
  basicCleanupExamples,
  advancedCleanupExamples,
  scheduledCleanupExamples,
  errorHandlingExamples,
};