/**
 * @file API Key Storage Types
 *
 * Type definitions for the API key storage system
 */

import type { EncryptedData } from '@/data/security/crypto';
import type { EncryptedAPIKey } from '@/types/apiKeys';

/** Encryption Service interface */
export interface EncryptionService {
  initialize(password: string): Promise<void>;
  shutdown(): Promise<void>;
  encryptData(data: string, type: string): Promise<EncryptedData>;
  decryptData(encryptedData: EncryptedData): Promise<string>;
  createIntegrityChecksum(data: EncryptedData): Promise<string>;
  verifyIntegrity(data: EncryptedData, checksum?: string): Promise<boolean>;
  validateIntegrityChecksum(data: EncryptedData, checksum?: string): Promise<boolean>;
  getInstance(): EncryptionService;
  isInitialized?: boolean;
  isSessionActive?: boolean;
  openDatabase?: () => Promise<void>;
}

/** Database interface */
export interface DatabaseService {
  add(_storeName: string, _data: any): Promise<void>;
  get(_storeName: string, _key: any): Promise<any>;
  update(_storeName: string, _data: any): Promise<void>;
  delete(_storeName: string, _key: any): Promise<void>;
  getAll(_storeName: string): Promise<any[]>;
  query(_storeName: string, _filter: any): Promise<any[]>;
  openDatabase(): Promise<void>;
}

/** Cache entry structure */
export interface CacheEntry {
  key: EncryptedAPIKey;
  timestamp: number;
  accessCount: number;
}

/** Service metrics for monitoring */
export interface ServiceMetrics {
  totalKeys: number;
  cacheHits: number;
  cacheMisses: number;
  operationCounts: Record<string, number>;
  lastCleanup: number;
}

/** Service state */
export interface ServiceState {
  isInitialized: boolean;
  encryptionService: EncryptionService | null;
  cache: Map<string, CacheEntry>;
  cacheCleanupInterval: NodeJS.Timeout | null;
  metrics: ServiceMetrics;
}
