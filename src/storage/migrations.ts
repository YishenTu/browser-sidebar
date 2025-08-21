/**
 * @file Storage Migration System
 *
 * Comprehensive migration system for storage schema evolution with support for
 * forward migrations, rollbacks, validation, and atomic operations.
 */

import type { StorageSchema, MigrationScript, StorageVersion } from '../types/storage';
import * as chromeStorage from './chromeStorage';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Migration history entry
 */
export interface MigrationHistory {
  version: StorageVersion;
  executedAt: number;
  duration: number;
  description: string;
  type: 'forward' | 'rollback';
}

/**
 * Schema metadata
 */
export interface SchemaMetadata {
  version: StorageVersion;
  createdAt: number;
  updatedAt: number;
  migrations: MigrationHistory[];
  backupAvailable: boolean;
  lastBackupAt: number | null;
}

/**
 * Migration backup data
 */
export interface MigrationBackup {
  timestamp: number;
  schema: StorageSchema | null;
}

/**
 * Migration error with additional context
 */
export class MigrationError extends Error {
  public readonly version: StorageVersion;
  public readonly originalError: Error;

  constructor(message: string, version: StorageVersion, originalError: Error) {
    super(message);
    this.name = 'MigrationError';
    this.version = version;
    this.originalError = originalError;
  }
}

// =============================================================================
// Migration Detection
// =============================================================================

/**
 * Get current storage schema version
 */
export async function getCurrentVersion(): Promise<StorageVersion> {
  try {
    const schema = await chromeStorage.get<StorageSchema>('storage-schema');

    if (!schema) {
      return 0; // No schema exists, return version 0
    }

    if (typeof schema.version !== 'number') {
      throw new Error('Invalid schema format');
    }

    return schema.version;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid schema format') {
      throw error;
    }
    // Re-throw storage errors
    throw error;
  }
}

/**
 * Check if migration is needed to reach target version
 */
export async function needsMigration(targetVersion: StorageVersion): Promise<boolean> {
  const currentVersion = await getCurrentVersion();
  return currentVersion < targetVersion;
}

/**
 * Get migration history
 */
export async function getMigrationHistory(): Promise<MigrationHistory[]> {
  try {
    // First check if there's a schema
    const schema = await chromeStorage.get<StorageSchema>('storage-schema');
    if (!schema) {
      return []; // No schema means no history
    }

    // Get the detailed migration history
    const history = await chromeStorage.get<MigrationHistory[]>('migration-history');
    return history || [];
  } catch (error) {
    // Return empty array on any error
    return [];
  }
}

// =============================================================================
// Migration Execution
// =============================================================================

/**
 * Run all necessary migrations to bring storage to latest version
 */
export async function runMigrations(migrations: MigrationScript[]): Promise<void> {
  // Validate migration chain first
  if (!validateMigrationChain(migrations)) {
    throw new Error('Migration chain validation failed');
  }

  // Get current data
  let currentData = await chromeStorage.get<StorageSchema>('storage-schema');
  const currentVersion = currentData?.version || 0;

  // Filter migrations that need to be applied
  const migrationsToApply = migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (migrationsToApply.length === 0) {
    return; // No migrations needed
  }

  // Create backup before starting migrations
  await backupBeforeMigration();

  try {
    // Track migration history
    let history = await getMigrationHistory();

    // Ensure history is an array
    if (!Array.isArray(history)) {
      history = [];
    }

    // Apply each migration
    for (const migration of migrationsToApply) {
      const startTime = Date.now();

      try {
        const migrationData = currentData || { version: 0 };
        const result = await runSingleMigration(migration, migrationData);

        // Ensure we have a proper StorageSchema
        currentData =
          result && typeof result === 'object' ? (result as StorageSchema) : currentData;
        if (currentData) {
          currentData.version = migration.version;
        }

        const duration = Date.now() - startTime;

        // Add to migration history
        const historyEntry: MigrationHistory = {
          version: migration.version,
          executedAt: startTime,
          duration,
          description: migration.description,
          type: 'forward',
        };

        history.push(historyEntry);

        // Save intermediate state
        await chromeStorage.set('storage-schema', currentData);
        await chromeStorage.set('migration-history', history);
      } catch (error) {
        // Migration failed, attempt rollback
        try {
          await restoreFromBackup();
        } catch (rollbackError) {
          // Rollback failed too, we're in a bad state
          throw new MigrationError(
            `Migration failed and rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            migration.version,
            error instanceof Error ? error : new Error(String(error))
          );
        }

        // Re-throw the original migration error
        throw error;
      }
    }

    // All migrations successful, clean up backup
    try {
      await chromeStorage.remove('migration-backup');
    } catch (cleanupError) {
      // Not critical if cleanup fails
      console.warn('Failed to clean up migration backup:', cleanupError);
    }
  } catch (error) {
    // If it's already a MigrationError, re-throw it
    if (error instanceof MigrationError) {
      throw error;
    }

    // Otherwise, wrap it
    throw new MigrationError(
      `Migration process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentVersion,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Run a single migration script
 */
export async function runSingleMigration(migration: MigrationScript, data: any): Promise<any> {
  try {
    // Validate before migration if validator exists
    if (migration.validation && !migration.validation(data)) {
      throw new Error(`Pre-migration validation failed for version ${migration.version}`);
    }

    // Execute the migration
    const result = await migration.up(data);

    return result;
  } catch (error) {
    throw new MigrationError(
      `Migration to version ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      migration.version,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// =============================================================================
// Rollback Functionality
// =============================================================================

/**
 * Rollback to a specific version
 */
export async function rollbackMigration(
  targetVersion: StorageVersion,
  migrations: MigrationScript[]
): Promise<void> {
  // Get current data
  const currentData = await chromeStorage.get<StorageSchema>('storage-schema');
  const currentVersion = currentData?.version || 0;

  if (targetVersion >= currentVersion) {
    throw new Error('Cannot rollback to higher version');
  }

  // Find migrations to rollback (in reverse order)
  const migrationsToRollback = migrations
    .filter(m => m.version > targetVersion && m.version <= currentVersion)
    .sort((a, b) => b.version - a.version); // Descending order

  // Check that all rollback migrations have down functions
  for (const migration of migrationsToRollback) {
    if (!migration.down) {
      throw new Error(`Rollback function not available for version ${migration.version}`);
    }
  }

  try {
    let data = currentData;
    let history = await getMigrationHistory();

    // Ensure history is an array
    if (!Array.isArray(history)) {
      history = [];
    }

    // Apply rollback migrations
    for (const migration of migrationsToRollback) {
      const startTime = Date.now();

      try {
        data = await migration.down!(data);
        data!.version = migration.version - 1;

        const duration = Date.now() - startTime;

        // Add rollback to migration history
        const historyEntry: MigrationHistory = {
          version: migration.version,
          executedAt: startTime,
          duration,
          description: migration.description,
          type: 'rollback',
        };

        history.push(historyEntry);

        // Save intermediate state
        await chromeStorage.set('storage-schema', data);
        await chromeStorage.set('migration-history', history);
      } catch (error) {
        throw new MigrationError(
          `Rollback of version ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          migration.version,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Ensure final version matches target
    if (data) {
      data.version = targetVersion;
      await chromeStorage.set('storage-schema', data);
    }
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }

    throw new MigrationError(
      `Rollback process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentVersion,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// =============================================================================
// Migration Utilities
// =============================================================================

/**
 * Validate migration chain for consistency and dependencies
 */
export function validateMigrationChain(migrations: MigrationScript[]): boolean {
  if (migrations.length === 0) {
    return true;
  }

  // Check for duplicate versions
  const versions = migrations.map(m => m.version);
  const uniqueVersions = new Set(versions);
  if (versions.length !== uniqueVersions.size) {
    return false;
  }

  // Sort migrations by version
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  // Check dependencies
  for (const migration of sortedMigrations) {
    if (migration.dependencies) {
      // Check if all dependencies exist
      for (const depVersion of migration.dependencies) {
        const dependencyExists = migrations.some(m => m.version === depVersion);
        if (!dependencyExists) {
          return false; // Missing dependency
        }
      }

      // Check for circular dependencies (simple check)
      if (migration.dependencies.includes(migration.version)) {
        return false;
      }

      // Check transitive dependencies - ensure all dependencies come before this migration
      const dependentMigrations = migrations.filter(m =>
        migration.dependencies!.includes(m.version)
      );
      for (const dep of dependentMigrations) {
        if (dep.dependencies) {
          // Simple circular dependency check
          if (dep.dependencies.includes(migration.version)) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Create backup before migration
 */
export async function backupBeforeMigration(): Promise<void> {
  try {
    const schema = await chromeStorage.get<StorageSchema>('storage-schema');

    const backup: MigrationBackup = {
      timestamp: Date.now(),
      schema,
    };

    await chromeStorage.set('migration-backup', backup);
  } catch (error) {
    throw new Error('Failed to create backup');
  }
}

/**
 * Restore from backup
 */
export async function restoreFromBackup(): Promise<void> {
  const backup = await chromeStorage.get<MigrationBackup>('migration-backup');

  if (!backup) {
    throw new Error('No backup available');
  }

  if (!backup.timestamp || backup.schema === undefined) {
    throw new Error('Invalid backup format');
  }

  // Restore the schema
  if (backup.schema) {
    await chromeStorage.set('storage-schema', backup.schema);
  } else {
    await chromeStorage.remove('storage-schema');
  }

  // Clean up backup after successful restoration
  await chromeStorage.remove('migration-backup');
}

// =============================================================================
// Schema Management
// =============================================================================

/**
 * Update schema version
 */
export async function updateSchemaVersion(version: StorageVersion): Promise<void> {
  const schema = await chromeStorage.get<StorageSchema>('storage-schema');

  if (!schema) {
    throw new Error('No storage schema found');
  }

  const updatedSchema = {
    ...schema,
    version,
    lastUpdated: Date.now(),
  };

  await chromeStorage.set('storage-schema', updatedSchema);
}

/**
 * Get schema metadata
 */
export async function getSchemaMetadata(): Promise<SchemaMetadata> {
  const schema = await chromeStorage.get<StorageSchema>('storage-schema');

  if (!schema) {
    throw new Error('No storage schema found');
  }

  const migrations = await getMigrationHistory();
  const backup = await chromeStorage.get<MigrationBackup>('migration-backup');

  const metadata: SchemaMetadata = {
    version: schema.version,
    createdAt: (schema as any).createdAt || Date.now(),
    updatedAt: (schema as any).lastUpdated || (schema as any).createdAt || Date.now(),
    migrations,
    backupAvailable: backup !== null,
    lastBackupAt: backup?.timestamp || null,
  };

  return metadata;
}
