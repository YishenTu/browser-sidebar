/**
 * @file Query and List Operations
 *
 * Functions for querying and listing API keys with filtering and pagination
 */

import type {
  APIProvider,
  APIKeyQueryOptions,
  APIKeyListResult,
  EncryptedAPIKey,
  APIKeyMetadata,
} from '@/types/apiKeys';

import { DB_STORES } from './constants';
import { getDatabase } from './database';
import type { ServiceState } from './types';
import { requireInitialized, incrementOperationCount } from './utils';

/**
 * List API keys with filtering and pagination
 */
export async function listAPIKeys(
  state: ServiceState,
  options: APIKeyQueryOptions = {}
): Promise<APIKeyListResult> {
  requireInitialized(state);
  incrementOperationCount(state.metrics, 'list');
  const dbInstance = getDatabase();

  try {
    let results: APIKeyMetadata[] = [];

    // Use appropriate query method based on filters
    if (dbInstance) {
      if (options.provider) {
        results = (await dbInstance.query(DB_STORES.METADATA, {
          provider: options.provider,
          limit: options.limit,
          offset: options.offset,
        })) as APIKeyMetadata[];
      } else if (options.status) {
        results = (await dbInstance.query(DB_STORES.METADATA, {
          status: options.status,
          limit: options.limit,
          offset: options.offset,
        })) as APIKeyMetadata[];
      } else {
        results = (await dbInstance.getAll(DB_STORES.METADATA)) as APIKeyMetadata[];
      }
    }

    // Apply additional filters
    if (options.keyType) {
      results = results.filter(key => key.keyType === options.keyType);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(key => options.tags!.some(tag => key.tags?.includes(tag)));
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(
        key =>
          key.name.toLowerCase().includes(searchLower) ||
          key.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (options.sortBy) {
      results.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return options.sortOrder === 'desc' ? -comparison : comparison;
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          const comparison = aVal - bVal;
          return options.sortOrder === 'desc' ? -comparison : comparison;
        }

        return 0;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < results.length;

    // Return metadata-only results (no encrypted payloads)
    const keys: Array<{ id: string; metadata: APIKeyMetadata }> = paginatedResults.map(
      metadata => ({
        id: metadata.id,
        metadata,
      })
    );

    return {
      keys: keys as EncryptedAPIKey[],
      total: results.length,
      hasMore,
      nextCursor: hasMore ? `${offset + limit}` : undefined,
    };
  } catch (error) {
    throw new Error(
      `Failed to list API keys: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get API keys for a specific provider
 */
export async function getKeysByProvider(
  state: ServiceState,
  provider: APIProvider
): Promise<EncryptedAPIKey[]> {
  requireInitialized(state);
  const dbInstance = getDatabase();

  try {
    const results = dbInstance ? await dbInstance.query(DB_STORES.METADATA, { provider }) : [];

    // Convert to EncryptedAPIKey format (metadata only)
    return results.map((metadata: unknown) => {
      const meta = metadata as APIKeyMetadata;
      return {
        id: meta.id,
        metadata: meta,
        encryptedData: {
          data: new Uint8Array(),
          iv: new Uint8Array(),
          algorithm: 'AES-GCM' as const,
          version: 1,
        },
        keyHash: '',
        checksum: '',
        storageVersion: 1,
        configuration: {},
        usageStats: undefined,
        rotationStatus: undefined,
      };
    });
  } catch (error) {
    throw new Error(
      `Failed to get keys for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
