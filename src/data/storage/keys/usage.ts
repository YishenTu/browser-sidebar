/**
 * @file Usage Statistics
 *
 * Functions for recording and retrieving API key usage statistics
 */

import type { APIKeyUsageStats, APIKeyStorage } from '@/types/apiKeys';
import * as chromeStorage from '@/data/storage/chrome';
import { STORAGE_KEYS, DB_STORES } from './constants';
import { getDatabase } from './database';
import type { ServiceState } from './types';
import { requireInitialized } from './utils';
import { getAPIKey, updateAPIKey } from './operations';
import { invalidateCachedKey } from './cache';

/**
 * Record usage statistics for an API key
 */
export async function recordUsage(
  state: ServiceState,
  id: string,
  usage: {
    requests: number;
    tokens: number;
    cost: number;
    responseTime: number;
  }
): Promise<void> {
  requireInitialized(state);
  const dbInstance = getDatabase();

  try {
    const existingKey = await getAPIKey(state, id);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Calculate new statistics
    const currentStats = existingKey.usageStats || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      avgRequestTime: 0,
      lastResetAt: Date.now(),
      dailyStats: [],
      weeklyStats: [],
      monthlyStats: [],
    };
    const newTotalRequests = currentStats.totalRequests + usage.requests;

    // Calculate new average response time
    const newAvgRequestTime =
      currentStats.totalRequests === 0
        ? usage.responseTime
        : (currentStats.avgRequestTime * currentStats.totalRequests +
            usage.responseTime * usage.requests) /
          newTotalRequests;

    const updatedStats: APIKeyUsageStats = {
      totalRequests: newTotalRequests,
      successfulRequests: currentStats.successfulRequests + usage.requests,
      failedRequests: currentStats.failedRequests || 0,
      totalTokens: currentStats.totalTokens + usage.tokens,
      inputTokens: currentStats.inputTokens || 0,
      outputTokens: currentStats.outputTokens || 0,
      totalCost: currentStats.totalCost + usage.cost,
      avgRequestTime: newAvgRequestTime,
      lastResetAt: currentStats.lastResetAt || Date.now(),
      dailyStats: currentStats.dailyStats || [],
      weeklyStats: currentStats.weeklyStats || [],
      monthlyStats: currentStats.monthlyStats || [],
    };

    // Update the key
    await updateAPIKey(state, id, {
      status: existingKey.metadata.status, // Trigger update
    });

    // Update in storage with new stats
    const updatedKey: APIKeyStorage = {
      id: existingKey.id,
      metadata: existingKey.metadata,
      encryptedData: existingKey.encryptedData,
      keyHash: existingKey.keyHash,
      checksum: existingKey.checksum,
      storageVersion: existingKey.storageVersion || 1,
      configuration: existingKey.configuration,
      usageStats: updatedStats,
      rotationStatus: existingKey.rotationStatus || {
        status: 'none' as const,
        rotationHistory: [],
      },
    };

    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${id}`, updatedKey);
    if (dbInstance) {
      await dbInstance.update(DB_STORES.METADATA, {
        ...existingKey.metadata,
        id,
        lastUsed: Date.now(),
        usageStats: updatedStats,
      });
    }

    invalidateCachedKey(state, id);
  } catch (error) {
    throw new Error(
      `Failed to record usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get usage statistics for an API key
 */
export async function getKeyUsageStats(state: ServiceState, id: string): Promise<APIKeyUsageStats> {
  requireInitialized(state);

  try {
    const key = await getAPIKey(state, id);
    if (!key) {
      throw new Error('API key not found');
    }

    return (
      key.usageStats || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgRequestTime: 0,
        lastResetAt: Date.now(),
        dailyStats: [],
        weeklyStats: [],
        monthlyStats: [],
      }
    );
  } catch (error) {
    throw new Error(
      `Failed to get usage stats: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
