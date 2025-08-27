/**
 * @file Database Service
 *
 * IndexedDB operations for API key metadata storage
 */

import type { DatabaseService } from './types';

/** Stub IndexedDB helper - simplified database operations */
export class DatabaseServiceStub implements DatabaseService {
  async add(_storeName: string, _data: unknown): Promise<void> {
    // Stub implementation
  }

  async get(_storeName: string, _key: unknown): Promise<unknown> {
    // Stub implementation
    return null;
  }

  async update(_storeName: string, _data: unknown): Promise<void> {
    // Stub implementation
  }

  async delete(_storeName: string, _key: unknown): Promise<void> {
    // Stub implementation
  }

  async getAll(_storeName: string): Promise<unknown[]> {
    // Stub implementation
    return [];
  }

  async query(_storeName: string, _filter: unknown): Promise<unknown[]> {
    // Stub implementation
    return [];
  }

  async openDatabase(): Promise<void> {
    // Stub implementation
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService | null {
  if (!dbInstance) {
    dbInstance = new DatabaseServiceStub();
  }
  return dbInstance;
}

export function setDatabase(db: DatabaseService | null): void {
  dbInstance = db;
}
