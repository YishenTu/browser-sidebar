/**
 * @file Encryption Service
 *
 * Stub implementation of the encryption service for API key storage
 */

import type { EncryptedData } from '@/data/security/crypto';
import type { EncryptionService } from './types';

/** Stub EncryptionService implementation */
export class EncryptionServiceStub implements EncryptionService {
  private static instance: EncryptionService | null = null;
  isInitialized = false;
  isSessionActive = false;

  static getInstance(): EncryptionService {
    if (!EncryptionServiceStub.instance) {
      EncryptionServiceStub.instance = new EncryptionServiceStub();
    }
    return EncryptionServiceStub.instance;
  }

  getInstance(): EncryptionService {
    return EncryptionServiceStub.getInstance();
  }

  async openDatabase(): Promise<void> {
    // Stub implementation
  }

  async initialize(_password: string): Promise<void> {
    this.isInitialized = true;
    this.isSessionActive = true;
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.isSessionActive = false;
  }

  async encryptData(data: string, _type: string): Promise<EncryptedData> {
    // Stub: Return encrypted data structure
    return {
      algorithm: 'AES-256-GCM' as const,
      iv: new Uint8Array(12),
      data: new Uint8Array(Buffer.from(btoa(data))),
      version: 1,
    };
  }

  async decryptData(encryptedData: EncryptedData): Promise<string> {
    // Stub: Decode from encrypted data
    return atob(Buffer.from(encryptedData.data).toString());
  }

  async createIntegrityChecksum(data: EncryptedData): Promise<string> {
    // Stub: Simple hash
    return Buffer.from(data.data).toString('base64').substring(0, 10);
  }

  async verifyIntegrity(data: EncryptedData, checksum?: string): Promise<boolean> {
    // Stub implementation
    return Buffer.from(data.data).toString('base64').substring(0, 10) === checksum;
  }

  async validateIntegrityChecksum(data: EncryptedData, checksum: string): Promise<boolean> {
    return this.verifyIntegrity(data, checksum);
  }
}
