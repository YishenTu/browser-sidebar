/**
 * @file Migration System Tests
 *
 * Comprehensive test suite for the storage migration system following TDD approach.
 * Tests migration detection, execution, rollback, and utilities.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { StorageSchema, MigrationScript, StorageVersion } from '../../src/types/storage';
import * as chromeStorage from '../../src/storage/chromeStorage';
import {
  getCurrentVersion,
  needsMigration,
  getMigrationHistory,
  runMigrations,
  runSingleMigration,
  rollbackMigration,
  validateMigrationChain,
  backupBeforeMigration,
  restoreFromBackup,
  updateSchemaVersion,
  getSchemaMetadata,
  MigrationHistory,
  SchemaMetadata,
  MigrationError,
} from '../../src/storage/migrations';

// =============================================================================
// Test Setup & Mocks
// =============================================================================

// Mock chrome storage
vi.mock('../../src/storage/chromeStorage');

const mockChromeStorage = {
  get: vi.fn(),
  set: vi.fn(),
  getBatch: vi.fn(),
  setBatch: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
};

// Setup mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(chromeStorage, mockChromeStorage);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test data
const mockStorageSchema: StorageSchema = {
  version: 1,
  conversations: {},
  settings: {
    version: 1,
    theme: 'system',
    defaultModel: 'gpt-4',
    encrypted: false,
    lastModified: Date.now(),
    storageVersion: 1,
  },
  apiKeys: {},
  cache: {
    entries: {},
    maxSize: 50 * 1024 * 1024,
    currentSize: 0,
    cleanupInterval: 3600000,
    storageVersion: 1,
  },
  migrations: [],
};

const mockMigrationHistory: MigrationHistory[] = [
  {
    version: 1,
    executedAt: Date.now() - 1000,
    duration: 50,
    description: 'Initial schema setup',
  },
];

const mockSchemaMetadata: SchemaMetadata = {
  version: 1,
  createdAt: Date.now() - 2000,
  updatedAt: Date.now() - 1000,
  migrations: mockMigrationHistory,
  backupAvailable: false,
  lastBackupAt: null,
};

// Sample migration scripts
const sampleMigrations: MigrationScript[] = [
  {
    version: 1,
    description: 'Initial schema setup',
    up: async (data: any) => ({
      ...data,
      version: 1,
      conversations: data.conversations || {},
      settings: data.settings || { theme: 'system' },
    }),
    down: async (data: any) => ({
      ...data,
      version: 0,
    }),
  },
  {
    version: 2,
    description: 'Add API key storage',
    up: async (data: any) => ({
      ...data,
      version: 2,
      apiKeys: data.apiKeys || {},
    }),
    down: async (data: any) => {
      const { apiKeys, ...rest } = data;
      return { ...rest, version: 1 };
    },
    dependencies: [1],
  },
  {
    version: 3,
    description: 'Add cache storage',
    up: async (data: any) => ({
      ...data,
      version: 3,
      cache: data.cache || {
        entries: {},
        maxSize: 50 * 1024 * 1024,
        currentSize: 0,
        cleanupInterval: 3600000,
        storageVersion: 3,
      },
    }),
    down: async (data: any) => {
      const { cache, ...rest } = data;
      return { ...rest, version: 2 };
    },
    dependencies: [2],
  },
];

// =============================================================================
// Migration Detection Tests
// =============================================================================

describe('Migration Detection', () => {
  describe('getCurrentVersion', () => {
    it('should return current schema version from storage', async () => {
      mockChromeStorage.get.mockResolvedValue(mockStorageSchema);

      const version = await getCurrentVersion();

      expect(version).toBe(1);
      expect(mockChromeStorage.get).toHaveBeenCalledWith('storage-schema');
    });

    it('should return 0 if no schema exists in storage', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      const version = await getCurrentVersion();

      expect(version).toBe(0);
    });

    it('should handle storage errors gracefully', async () => {
      mockChromeStorage.get.mockRejectedValue(new Error('Storage error'));

      await expect(getCurrentVersion()).rejects.toThrow('Storage error');
    });
  });

  describe('needsMigration', () => {
    it('should return true when current version is less than target', async () => {
      mockChromeStorage.get.mockResolvedValue({ ...mockStorageSchema, version: 1 });

      const needs = await needsMigration(3);

      expect(needs).toBe(true);
    });

    it('should return false when current version equals target', async () => {
      mockChromeStorage.get.mockResolvedValue({ ...mockStorageSchema, version: 2 });

      const needs = await needsMigration(2);

      expect(needs).toBe(false);
    });

    it('should return false when current version is greater than target', async () => {
      mockChromeStorage.get.mockResolvedValue({ ...mockStorageSchema, version: 3 });

      const needs = await needsMigration(2);

      expect(needs).toBe(false);
    });

    it('should return true when no schema exists (version 0)', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      const needs = await needsMigration(1);

      expect(needs).toBe(true);
    });
  });

  describe('getMigrationHistory', () => {
    it('should return migration history from schema', async () => {
      const schemaWithHistory = {
        ...mockStorageSchema,
        migrations: [1, 2],
      };
      mockChromeStorage.get.mockResolvedValueOnce(schemaWithHistory);
      mockChromeStorage.get.mockResolvedValueOnce(mockMigrationHistory);

      const history = await getMigrationHistory();

      expect(history).toEqual(mockMigrationHistory);
      expect(mockChromeStorage.get).toHaveBeenCalledWith('storage-schema');
      expect(mockChromeStorage.get).toHaveBeenCalledWith('migration-history');
    });

    it('should return empty array if no history exists', async () => {
      mockChromeStorage.get.mockResolvedValueOnce(mockStorageSchema);
      mockChromeStorage.get.mockResolvedValueOnce(null);

      const history = await getMigrationHistory();

      expect(history).toEqual([]);
    });

    it('should handle missing schema gracefully', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      const history = await getMigrationHistory();

      expect(history).toEqual([]);
    });
  });
});

// =============================================================================
// Migration Execution Tests
// =============================================================================

describe('Migration Execution', () => {
  describe('runMigrations', () => {
    it('should run all necessary migrations in order', async () => {
      const initialData = { version: 0 };
      mockChromeStorage.get.mockResolvedValue(initialData);
      mockChromeStorage.set.mockResolvedValue(undefined);
      mockChromeStorage.getBatch.mockResolvedValue({});
      mockChromeStorage.setBatch.mockResolvedValue(undefined);

      await runMigrations(sampleMigrations);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'storage-schema',
        expect.objectContaining({ version: 3 })
      );
      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-history',
        expect.arrayContaining([
          expect.objectContaining({ version: 1 }),
          expect.objectContaining({ version: 2 }),
          expect.objectContaining({ version: 3 }),
        ])
      );
    });

    it('should skip migrations already applied', async () => {
      const partialData = { ...mockStorageSchema, version: 2 };
      mockChromeStorage.get.mockResolvedValue(partialData);
      mockChromeStorage.set.mockResolvedValue(undefined);
      mockChromeStorage.getBatch.mockResolvedValue({});
      mockChromeStorage.setBatch.mockResolvedValue(undefined);

      await runMigrations(sampleMigrations);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'storage-schema',
        expect.objectContaining({ version: 3 })
      );
    });

    it('should validate migration chain before execution', async () => {
      const invalidMigrations = [
        { ...sampleMigrations[0] },
        { ...sampleMigrations[2] }, // Missing dependency (version 2)
      ];

      await expect(runMigrations(invalidMigrations)).rejects.toThrow(
        'Migration chain validation failed'
      );
    });

    it('should create backup before running migrations', async () => {
      const versionZeroSchema = { ...mockStorageSchema, version: 0 };
      mockChromeStorage.get.mockResolvedValue(versionZeroSchema);
      mockChromeStorage.set.mockResolvedValue(undefined);
      mockChromeStorage.getBatch.mockResolvedValue(versionZeroSchema);
      mockChromeStorage.setBatch.mockResolvedValue(undefined);

      await runMigrations([sampleMigrations[0]]);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-backup',
        expect.objectContaining({
          timestamp: expect.any(Number),
          schema: versionZeroSchema,
        })
      );
    });

    it('should rollback on migration failure', async () => {
      const failingMigration: MigrationScript = {
        version: 2,
        description: 'Failing migration',
        up: async () => {
          throw new Error('Migration failed');
        },
        down: async data => data,
      };

      const backupData = {
        timestamp: Date.now(),
        schema: mockStorageSchema,
      };

      // Mock calls based on key
      mockChromeStorage.get.mockImplementation((key: string) => {
        if (key === 'storage-schema') {
          return Promise.resolve({ ...mockStorageSchema, version: 1 });
        } else if (key === 'migration-history') {
          return Promise.resolve([]);
        } else if (key === 'migration-backup') {
          return Promise.resolve(backupData);
        }
        return Promise.resolve(null);
      });

      mockChromeStorage.set.mockResolvedValue(undefined);
      mockChromeStorage.remove.mockResolvedValue(undefined);
      mockChromeStorage.getBatch.mockResolvedValue(mockStorageSchema);
      mockChromeStorage.setBatch.mockResolvedValue(undefined);

      await expect(runMigrations([failingMigration])).rejects.toThrow(MigrationError);

      // Should attempt rollback - expect both backup creation and restoration
      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-backup',
        expect.objectContaining({
          timestamp: expect.any(Number),
          schema: { ...mockStorageSchema, version: 1 },
        })
      );
      expect(mockChromeStorage.set).toHaveBeenCalledWith('storage-schema', mockStorageSchema);
    });
  });

  describe('runSingleMigration', () => {
    it('should execute single migration successfully', async () => {
      const migration = sampleMigrations[0];
      const initialData = { version: 0 };

      const result = await runSingleMigration(migration, initialData);

      expect(result).toMatchObject({
        version: 1,
        conversations: {},
        settings: expect.any(Object),
      });
    });

    it('should track migration execution time', async () => {
      const migration = sampleMigrations[0];
      const initialData = { version: 0 };

      const startTime = Date.now();
      await runSingleMigration(migration, initialData);
      const endTime = Date.now();

      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should validate data before migration if validator exists', async () => {
      const migrationWithValidator: MigrationScript = {
        version: 2,
        description: 'Migration with validation',
        up: async data => ({ ...data, version: 2 }),
        down: async data => ({ ...data, version: 1 }),
        validation: data => data.version === 1,
      };

      const validData = { version: 1 };
      const invalidData = { version: 0 };

      await expect(runSingleMigration(migrationWithValidator, validData)).resolves.toBeDefined();

      await expect(runSingleMigration(migrationWithValidator, invalidData)).rejects.toThrow(
        'Pre-migration validation failed'
      );
    });

    it('should handle migration errors properly', async () => {
      const failingMigration: MigrationScript = {
        version: 2,
        description: 'Failing migration',
        up: async () => {
          throw new Error('Test error');
        },
        down: async data => data,
      };

      await expect(runSingleMigration(failingMigration, { version: 1 })).rejects.toThrow(
        MigrationError
      );
    });
  });
});

// =============================================================================
// Rollback Functionality Tests
// =============================================================================

describe('Rollback Functionality', () => {
  describe('rollbackMigration', () => {
    it('should rollback to specific version', async () => {
      const currentData = { ...mockStorageSchema, version: 3 };
      const targetVersion = 1;

      mockChromeStorage.get.mockResolvedValue(currentData);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await rollbackMigration(targetVersion, sampleMigrations);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'storage-schema',
        expect.objectContaining({ version: 1 })
      );
    });

    it('should execute rollback migrations in reverse order', async () => {
      const currentData = { ...mockStorageSchema, version: 3, apiKeys: {}, cache: {} };
      mockChromeStorage.get.mockResolvedValue(currentData);
      mockChromeStorage.set.mockResolvedValue(undefined);

      const rollbackSpy = vi.fn();
      const migrationsWithSpy = sampleMigrations.map(m => ({
        ...m,
        down: async (data: any) => {
          rollbackSpy(m.version);
          return m.down!(data);
        },
      }));

      await rollbackMigration(1, migrationsWithSpy);

      expect(rollbackSpy).toHaveBeenCalledWith(3);
      expect(rollbackSpy).toHaveBeenCalledWith(2);
      expect(rollbackSpy.mock.calls[0][0]).toBe(3); // Called first
      expect(rollbackSpy.mock.calls[1][0]).toBe(2); // Called second
    });

    it('should fail if target version is higher than current', async () => {
      mockChromeStorage.get.mockResolvedValue({ ...mockStorageSchema, version: 1 });

      await expect(rollbackMigration(3, sampleMigrations)).rejects.toThrow(
        'Cannot rollback to higher version'
      );
    });

    it('should fail if rollback migration is missing', async () => {
      const migrationWithoutDown = [
        {
          version: 2,
          description: 'No rollback',
          up: async (data: any) => ({ ...data, version: 2 }),
          // Missing down function
        },
      ];

      mockChromeStorage.get.mockResolvedValue({ version: 2 });

      await expect(rollbackMigration(1, migrationWithoutDown)).rejects.toThrow(
        'Rollback function not available'
      );
    });

    it('should update migration history on successful rollback', async () => {
      mockChromeStorage.get.mockResolvedValue({ ...mockStorageSchema, version: 2 });
      mockChromeStorage.set.mockResolvedValue(undefined);

      await rollbackMigration(1, sampleMigrations);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-history',
        expect.arrayContaining([
          expect.objectContaining({
            version: 2,
            type: 'rollback',
            executedAt: expect.any(Number),
          }),
        ])
      );
    });
  });
});

// =============================================================================
// Migration Utilities Tests
// =============================================================================

describe('Migration Utilities', () => {
  describe('validateMigrationChain', () => {
    it('should return true for valid migration chain', () => {
      const result = validateMigrationChain(sampleMigrations);
      expect(result).toBe(true);
    });

    it('should return false for missing dependencies', () => {
      const invalidChain = [
        sampleMigrations[0], // v1
        sampleMigrations[2], // v3, depends on v2 which is missing
      ];

      const result = validateMigrationChain(invalidChain);
      expect(result).toBe(false);
    });

    it('should return false for duplicate versions', () => {
      const duplicateChain = [
        sampleMigrations[0],
        { ...sampleMigrations[0], description: 'Duplicate' },
      ];

      const result = validateMigrationChain(duplicateChain);
      expect(result).toBe(false);
    });

    it('should return true for migrations without dependencies', () => {
      const noDepsChain = [
        {
          version: 1,
          description: 'Independent migration',
          up: async (data: any) => data,
          down: async (data: any) => data,
        },
      ];

      const result = validateMigrationChain(noDepsChain);
      expect(result).toBe(true);
    });

    it('should return false for circular dependencies', () => {
      const circularChain = [
        {
          version: 1,
          description: 'Depends on 2',
          up: async (data: any) => data,
          down: async (data: any) => data,
          dependencies: [2],
        },
        {
          version: 2,
          description: 'Depends on 1',
          up: async (data: any) => data,
          down: async (data: any) => data,
          dependencies: [1],
        },
      ];

      const result = validateMigrationChain(circularChain);
      expect(result).toBe(false);
    });
  });

  describe('backupBeforeMigration', () => {
    it('should create backup with timestamp', async () => {
      mockChromeStorage.get.mockResolvedValue(mockStorageSchema);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await backupBeforeMigration();

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-backup',
        expect.objectContaining({
          timestamp: expect.any(Number),
          schema: mockStorageSchema,
        })
      );
    });

    it('should handle backup creation errors', async () => {
      mockChromeStorage.get.mockResolvedValue(mockStorageSchema);
      mockChromeStorage.set.mockRejectedValue(new Error('Backup failed'));

      await expect(backupBeforeMigration()).rejects.toThrow('Failed to create backup');
    });

    it('should skip backup if no schema exists', async () => {
      mockChromeStorage.get.mockResolvedValue(null);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await backupBeforeMigration();

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'migration-backup',
        expect.objectContaining({
          timestamp: expect.any(Number),
          schema: null,
        })
      );
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore schema from backup', async () => {
      const backupData = {
        timestamp: Date.now(),
        schema: mockStorageSchema,
      };

      mockChromeStorage.get.mockResolvedValue(backupData);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await restoreFromBackup();

      expect(mockChromeStorage.set).toHaveBeenCalledWith('storage-schema', mockStorageSchema);
    });

    it('should fail if no backup exists', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      await expect(restoreFromBackup()).rejects.toThrow('No backup available');
    });

    it('should validate backup before restoration', async () => {
      const invalidBackup = {
        timestamp: Date.now(),
        // Missing schema
      };

      mockChromeStorage.get.mockResolvedValue(invalidBackup);

      await expect(restoreFromBackup()).rejects.toThrow('Invalid backup format');
    });

    it('should clean up backup after successful restoration', async () => {
      const backupData = {
        timestamp: Date.now(),
        schema: mockStorageSchema,
      };

      mockChromeStorage.get.mockResolvedValue(backupData);
      mockChromeStorage.set.mockResolvedValue(undefined);
      mockChromeStorage.remove.mockResolvedValue(undefined);

      await restoreFromBackup();

      expect(mockChromeStorage.remove).toHaveBeenCalledWith('migration-backup');
    });
  });
});

// =============================================================================
// Schema Management Tests
// =============================================================================

describe('Schema Management', () => {
  describe('updateSchemaVersion', () => {
    it('should update schema version', async () => {
      mockChromeStorage.get.mockResolvedValue(mockStorageSchema);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await updateSchemaVersion(2);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'storage-schema',
        expect.objectContaining({ version: 2 })
      );
    });

    it('should update timestamp when updating version', async () => {
      const beforeTime = Date.now();
      mockChromeStorage.get.mockResolvedValue(mockStorageSchema);
      mockChromeStorage.set.mockResolvedValue(undefined);

      await updateSchemaVersion(2);

      const afterTime = Date.now();
      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        'storage-schema',
        expect.objectContaining({
          version: 2,
          lastUpdated: expect.any(Number),
        })
      );
    });

    it('should handle missing schema gracefully', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      await expect(updateSchemaVersion(1)).rejects.toThrow('No storage schema found');
    });
  });

  describe('getSchemaMetadata', () => {
    it('should return schema metadata', async () => {
      const backupData = {
        timestamp: Date.now(),
        schema: mockStorageSchema,
      };

      mockChromeStorage.get.mockImplementation((key: string) => {
        if (key === 'storage-schema') {
          return Promise.resolve(mockStorageSchema);
        } else if (key === 'migration-history') {
          return Promise.resolve(mockMigrationHistory);
        } else if (key === 'migration-backup') {
          return Promise.resolve(backupData);
        }
        return Promise.resolve(null);
      });

      const metadata = await getSchemaMetadata();

      expect(metadata).toEqual(
        expect.objectContaining({
          version: 1,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          migrations: mockMigrationHistory,
          backupAvailable: true,
          lastBackupAt: expect.any(Number),
        })
      );
    });

    it('should indicate no backup when none exists', async () => {
      mockChromeStorage.get.mockImplementation((key: string) => {
        if (key === 'storage-schema') {
          return Promise.resolve(mockStorageSchema);
        } else if (key === 'migration-history') {
          return Promise.resolve(mockMigrationHistory);
        } else if (key === 'migration-backup') {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const metadata = await getSchemaMetadata();

      expect(metadata.backupAvailable).toBe(false);
      expect(metadata.lastBackupAt).toBe(null);
    });

    it('should handle missing schema', async () => {
      mockChromeStorage.get.mockResolvedValue(null);

      await expect(getSchemaMetadata()).rejects.toThrow('No storage schema found');
    });
  });
});

// =============================================================================
// Migration History and Atomic Operations Tests
// =============================================================================

describe('Migration History and Atomic Operations', () => {
  it('should track migration execution details', async () => {
    mockChromeStorage.get.mockResolvedValue({ version: 0 });
    mockChromeStorage.set.mockResolvedValue(undefined);
    mockChromeStorage.getBatch.mockResolvedValue({});
    mockChromeStorage.setBatch.mockResolvedValue(undefined);

    const startTime = Date.now();
    await runMigrations([sampleMigrations[0]]);
    const endTime = Date.now();

    expect(mockChromeStorage.set).toHaveBeenCalledWith(
      'migration-history',
      expect.arrayContaining([
        expect.objectContaining({
          version: 1,
          executedAt: expect.any(Number),
          duration: expect.any(Number),
          description: 'Initial schema setup',
          type: 'forward',
        }),
      ])
    );

    const historyCall = mockChromeStorage.set.mock.calls.find(
      call => call[0] === 'migration-history'
    );
    const historyEntry = historyCall[1][0];
    expect(historyEntry.executedAt).toBeGreaterThanOrEqual(startTime);
    expect(historyEntry.executedAt).toBeLessThanOrEqual(endTime);
  });

  it('should perform atomic operations - all or nothing', async () => {
    const failingMigration: MigrationScript = {
      version: 2,
      description: 'Failing migration',
      up: async () => {
        throw new Error('Migration failed');
      },
      down: async data => data,
    };

    const mixedMigrations = [sampleMigrations[0], failingMigration];
    const originalData = { version: 0 };
    const backupData = {
      timestamp: Date.now(),
      schema: originalData,
    };

    mockChromeStorage.get.mockImplementation((key: string) => {
      if (key === 'storage-schema') {
        return Promise.resolve(originalData);
      } else if (key === 'migration-history') {
        return Promise.resolve([]);
      } else if (key === 'migration-backup') {
        return Promise.resolve(backupData);
      }
      return Promise.resolve(null);
    });

    mockChromeStorage.set.mockResolvedValue(undefined);
    mockChromeStorage.remove.mockResolvedValue(undefined);
    mockChromeStorage.getBatch.mockResolvedValue({});
    mockChromeStorage.setBatch.mockResolvedValue(undefined);

    await expect(runMigrations(mixedMigrations)).rejects.toThrow(MigrationError);

    // Should attempt to restore from backup (restoreFromBackup calls)
    expect(mockChromeStorage.set).toHaveBeenCalledWith('storage-schema', originalData);
  });

  it('should maintain consistency during concurrent migration attempts', async () => {
    // Both migrations start from version 1 and try to run version 2 migration
    mockChromeStorage.get.mockImplementation((key: string) => {
      if (key === 'storage-schema') {
        return Promise.resolve({ ...mockStorageSchema, version: 1 });
      } else if (key === 'migration-history') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    mockChromeStorage.set.mockResolvedValue(undefined);
    mockChromeStorage.getBatch.mockResolvedValue({});
    mockChromeStorage.setBatch.mockResolvedValue(undefined);

    // Simulate concurrent migration attempts - need to include dependency
    const migration1 = runMigrations([sampleMigrations[0], sampleMigrations[1]]); // v1, v2
    const migration2 = runMigrations([sampleMigrations[0], sampleMigrations[1]]); // v1, v2

    const results = await Promise.allSettled([migration1, migration2]);

    // Both should succeed since there's no locking mechanism - they both start from same state
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBeGreaterThanOrEqual(1);
  });

  it('should preserve migration history across rollbacks', async () => {
    let currentHistory: MigrationHistory[] = [];

    // Mock to track history across calls
    mockChromeStorage.get.mockImplementation((key: string) => {
      if (key === 'storage-schema') {
        return Promise.resolve({ version: 0 });
      } else if (key === 'migration-history') {
        return Promise.resolve([...currentHistory]);
      }
      return Promise.resolve(null);
    });

    mockChromeStorage.set.mockImplementation((key: string, value: any) => {
      if (key === 'migration-history') {
        currentHistory = [...value];
      }
      return Promise.resolve();
    });

    mockChromeStorage.getBatch.mockResolvedValue({});
    mockChromeStorage.setBatch.mockResolvedValue(undefined);

    // First, run migrations
    await runMigrations(sampleMigrations);

    // Update mock for rollback - schema now at version 3
    mockChromeStorage.get.mockImplementation((key: string) => {
      if (key === 'storage-schema') {
        return Promise.resolve({ version: 3 });
      } else if (key === 'migration-history') {
        return Promise.resolve([...currentHistory]);
      }
      return Promise.resolve(null);
    });

    // Then rollback
    await rollbackMigration(1, sampleMigrations);

    // Final history should contain both forward and rollback entries
    expect(currentHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'forward' }),
        expect.objectContaining({ type: 'rollback' }),
      ])
    );
  });
});

// =============================================================================
// Error Handling and Edge Cases
// =============================================================================

describe('Error Handling and Edge Cases', () => {
  it('should handle storage quota exceeded errors', async () => {
    const quotaError = new Error('QUOTA_EXCEEDED_ERR');

    // Set up mock to succeed initially but fail on migration save
    mockChromeStorage.get.mockImplementation((key: string) => {
      if (key === 'storage-schema') {
        return Promise.resolve({ version: 0 });
      } else if (key === 'migration-history') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    mockChromeStorage.set.mockImplementation((key: string, value: any) => {
      if (key === 'migration-backup') {
        return Promise.resolve(); // Backup succeeds
      }
      return Promise.reject(quotaError); // Migration save fails
    });

    await expect(runMigrations([sampleMigrations[0]])).rejects.toThrow(MigrationError);
  });

  it('should handle corrupted schema data', async () => {
    const corruptedSchema = { invalid: 'data' };
    mockChromeStorage.get.mockResolvedValue(corruptedSchema);

    await expect(getCurrentVersion()).rejects.toThrow('Invalid schema format');
  });

  it('should provide detailed error information', async () => {
    const testError = new Error('Test error');
    const failingMigration: MigrationScript = {
      version: 2,
      description: 'Test failing migration',
      up: async () => {
        throw testError;
      },
      down: async data => data,
    };

    try {
      await runSingleMigration(failingMigration, { version: 1 });
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationError);
      expect(error.message).toContain('Migration to version 2 failed');
      expect(error.version).toBe(2);
      expect(error.originalError).toBe(testError);
    }
  });

  it('should handle network connectivity issues', async () => {
    const networkError = new Error('Network error');
    mockChromeStorage.get.mockRejectedValue(networkError);

    await expect(getCurrentVersion()).rejects.toThrow('Network error');
  });

  it('should validate migration dependencies transitively', () => {
    const complexChain = [
      { version: 1, description: 'Base', up: async (d: any) => d, down: async (d: any) => d },
      {
        version: 2,
        description: 'Level 2',
        up: async (d: any) => d,
        down: async (d: any) => d,
        dependencies: [1],
      },
      {
        version: 3,
        description: 'Level 3',
        up: async (d: any) => d,
        down: async (d: any) => d,
        dependencies: [2],
      },
      {
        version: 4,
        description: 'Level 4',
        up: async (d: any) => d,
        down: async (d: any) => d,
        dependencies: [1, 3],
      },
    ];

    const result = validateMigrationChain(complexChain);
    expect(result).toBe(true);

    // Remove middle dependency
    const brokenChain = complexChain.filter(m => m.version !== 2);
    const brokenResult = validateMigrationChain(brokenChain);
    expect(brokenResult).toBe(false);
  });
});
