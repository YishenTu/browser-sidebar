/**
 * @file Database Service
 *
 * IndexedDB operations for API key metadata storage
 */

import type { DatabaseService } from './types';

/** Stub IndexedDB helper - simplified database operations */
export class DatabaseServiceStub implements DatabaseService {
  async add(_storeName: string, _data: any): Promise<void> {
    // Stub implementation
  }

  async get(_storeName: string, _key: any): Promise<any> {
    // Stub implementation
    return null;
  }

  async update(_storeName: string, _data: any): Promise<void> {
    // Stub implementation
  }

  async delete(_storeName: string, _key: any): Promise<void> {
    // Stub implementation
  }

  async getAll(_storeName: string): Promise<any[]> {
    // Stub implementation
    return [];
  }

  async query(_storeName: string, _filter: any): Promise<any[]> {
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
