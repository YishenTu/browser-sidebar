/**
 * @file API Key Types
 *
 * Comprehensive TypeScript type definitions for API key management including
 * support for multiple AI providers (OpenAI, Anthropic, Google, Custom),
 * encryption, validation, usage tracking, and rotation capabilities.
 *
 * This module provides type-safe interfaces for secure API key storage,
 * management operations, and integration with the extension's encryption
 * and storage systems.
 */

import type { EncryptedData } from '../security/crypto';
import type { StorageVersion } from './storage';

// =============================================================================
// Provider and Basic Types
// =============================================================================

/**
 * Supported AI providers for API keys
 */
export type APIProvider = 'openai' | 'anthropic' | 'google' | 'custom';

/**
 * API key types based on provider tiers
 */
export type APIKeyType = 'standard' | 'pro' | 'enterprise';

/**
 * Current status of an API key
 */
export type APIKeyStatus = 
  | 'active'      // Key is active and usable
  | 'inactive'    // Key is disabled but not revoked
  | 'expired'     // Key has expired
  | 'revoked'     // Key has been permanently revoked
  | 'rotating';   // Key is in the process of rotation

/**
 * Permissions that can be granted to an API key
 */
export type APIKeyPermissions = 
  | 'read'        // Read-only access
  | 'write'       // Write access (create/modify)
  | 'delete'      // Delete access
  | 'admin';      // Administrative access

/**
 * Encryption levels for API key security
 */
export type EncryptionLevel = 'standard' | 'high' | 'maximum';

/**
 * Rotation status for key rotation management
 */
export type RotationStatus = 
  | 'none'        // No rotation scheduled
  | 'scheduled'   // Rotation is scheduled
  | 'in_progress' // Rotation is currently happening
  | 'completed'   // Rotation completed successfully
  | 'failed';     // Rotation failed

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Rate limiting configuration for API keys
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute?: number;
  /** Maximum requests per hour */
  requestsPerHour?: number;
  /** Maximum requests per day */
  requestsPerDay?: number;
  /** Maximum tokens per minute */
  tokensPerMinute?: number;
  /** Maximum tokens per hour */
  tokensPerHour?: number;
  /** Maximum tokens per day */
  tokensPerDay?: number;
  /** Whether to enforce rate limits strictly */
  enforceLimit: boolean;
  /** Grace period before enforcing limits (seconds) */
  gracePeriod?: number;
}

/**
 * API endpoint configuration
 */
export interface APIEndpointConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Custom headers to include with requests */
  customHeaders?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to use keep-alive connections */
  keepAlive?: boolean;
}

/**
 * Proxy configuration for API requests
 */
export interface ProxyConfig {
  /** Whether proxy is enabled */
  enabled: boolean;
  /** Proxy host */
  host?: string;
  /** Proxy port */
  port?: number;
  /** Proxy protocol */
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
  /** Proxy authentication */
  auth?: {
    username: string;
    password: string;
  };
  /** Bypass proxy for specific hosts */
  bypass?: string[];
}

/**
 * Key rotation configuration
 */
export interface RotationConfig {
  /** Whether automatic rotation is enabled */
  enabled: boolean;
  /** Rotation interval in days */
  intervalDays?: number;
  /** Days before expiration to warn user */
  warnDays?: number;
  /** Whether to automatically rotate without user confirmation */
  autoRotate?: boolean;
  /** Maximum number of old keys to keep */
  keepOldKeys?: number;
}

/**
 * Security configuration for API keys
 */
export interface APIKeySecurityConfig {
  /** Allowed origins for this key */
  allowedOrigins?: string[];
  /** IP whitelist for key usage */
  ipWhitelist?: string[];
  /** Whether HTTPS is required */
  requireHTTPS?: boolean;
  /** Encryption level for storage */
  encryptionLevel?: EncryptionLevel;
  /** Maximum key age in days */
  maxAge?: number;
  /** Whether to log all key usage */
  auditLogging?: boolean;
}

/**
 * Complete API key configuration
 */
export interface APIKeyConfiguration {
  /** Rate limiting settings */
  rateLimit?: RateLimitConfig;
  /** API endpoint configuration */
  endpoint?: APIEndpointConfig;
  /** Proxy settings */
  proxy?: ProxyConfig;
  /** Key rotation settings */
  rotation?: RotationConfig;
  /** Security settings */
  security?: APIKeySecurityConfig;
}

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * API key metadata (stored unencrypted for indexing and display)
 */
export interface APIKeyMetadata {
  /** Unique identifier for the API key */
  id: string;
  /** Provider this key belongs to */
  provider: APIProvider;
  /** Type/tier of the API key */
  keyType: APIKeyType;
  /** Current status of the key */
  status: APIKeyStatus;
  /** User-friendly name for the key */
  name: string;
  /** Optional description */
  description?: string;
  /** When the key was created */
  createdAt: number;
  /** When the key was last used */
  lastUsed: number;
  /** When the key expires (if applicable) */
  expiresAt?: number;
  /** Masked version of the key for display */
  maskedKey: string;
  /** Permissions granted to this key */
  permissions?: APIKeyPermissions[];
  /** Tags for organization */
  tags?: string[];
  /** User ID who owns this key */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
}

/**
 * Usage statistics for API keys
 */
export interface APIKeyUsageStats {
  /** Total number of requests made */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Total cost incurred */
  totalCost: number;
  /** Average request response time in ms */
  avgRequestTime: number;
  /** When stats were last reset */
  lastResetAt: number;
  /** Daily usage breakdown */
  dailyStats?: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  /** Weekly usage breakdown */
  weeklyStats?: Array<{
    week: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  /** Monthly usage breakdown */
  monthlyStats?: Array<{
    month: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

/**
 * Key rotation tracking information
 */
export interface APIKeyRotationStatus {
  /** Current rotation status */
  status: RotationStatus;
  /** When key was last rotated */
  lastRotation?: number;
  /** When next rotation is scheduled */
  nextScheduledRotation?: number;
  /** History of rotations */
  rotationHistory: Array<{
    timestamp: number;
    success: boolean;
    reason: string;
    oldKeyId?: string;
    newKeyId?: string;
  }>;
}

/**
 * Encrypted API key storage format
 */
export interface EncryptedAPIKey {
  /** Unique identifier */
  id: string;
  /** Unencrypted metadata */
  metadata: APIKeyMetadata;
  /** Encrypted key data */
  encryptedData: EncryptedData;
  /** Hash of the original key for verification */
  keyHash: string;
  /** Integrity checksum */
  checksum: string;
  /** Storage schema version */
  storageVersion: StorageVersion;
  /** Configuration settings */
  configuration: APIKeyConfiguration;
  /** Usage statistics (optional, may be stored separately) */
  usageStats?: APIKeyUsageStats;
  /** Rotation status */
  rotationStatus?: APIKeyRotationStatus;
}

/**
 * Complete API key storage entry (extends base storage interface)
 */
export interface APIKeyStorage extends EncryptedAPIKey {
  /** Usage statistics (required for storage) */
  usageStats: APIKeyUsageStats;
  /** Rotation status (required for storage) */
  rotationStatus: APIKeyRotationStatus;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation rules for a specific provider
 */
export interface ProviderValidationRule {
  /** Regular expression pattern for key format */
  pattern: RegExp;
  /** Minimum key length */
  minLength: number;
  /** Maximum key length */
  maxLength: number;
  /** Required prefix for the key */
  requiredPrefix?: string;
  /** Human-readable description */
  description: string;
}

/**
 * Validation rules for all providers
 */
export interface ProviderValidationRules {
  openai: ProviderValidationRule;
  anthropic: ProviderValidationRule;
  google: ProviderValidationRule;
  custom: ProviderValidationRule;
}

/**
 * Result of API key validation
 */
export interface ValidationResult {
  /** Whether the key is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of warnings (non-blocking) */
  warnings: string[];
  /** Detected provider (may differ from specified) */
  provider?: APIProvider;
  /** Detected key type */
  keyType?: APIKeyType;
  /** Estimated tier based on key format */
  estimatedTier?: APIKeyType;
}

/**
 * API key validation schema interface
 */
export interface APIKeyValidationSchema {
  /** Validate an API key string */
  validateKey: (key: string, provider: APIProvider) => ValidationResult;
  /** Validate API key configuration */
  validateConfiguration: (config: APIKeyConfiguration) => ValidationResult;
  /** Get validation rules for a provider */
  getProviderRules: (provider: APIProvider) => ProviderValidationRule;
  /** Create masked version of key */
  maskKey: (key: string) => string;
}

// =============================================================================
// Manager Interface Types
// =============================================================================

/**
 * Input for creating a new API key
 */
export interface CreateAPIKeyInput {
  /** The actual API key */
  key: string;
  /** Provider for this key */
  provider: APIProvider;
  /** User-friendly name */
  name: string;
  /** Optional description */
  description?: string;
  /** Configuration settings */
  configuration?: APIKeyConfiguration;
  /** Tags for organization */
  tags?: string[];
  /** Permissions to grant */
  permissions?: APIKeyPermissions[];
}

/**
 * Input for updating an existing API key
 */
export interface UpdateAPIKeyInput {
  /** New name */
  name?: string;
  /** New description */
  description?: string;
  /** Updated configuration */
  configuration?: Partial<APIKeyConfiguration>;
  /** Updated tags */
  tags?: string[];
  /** Updated permissions */
  permissions?: APIKeyPermissions[];
  /** New status */
  status?: APIKeyStatus;
}

/**
 * Options for querying API keys
 */
export interface APIKeyQueryOptions {
  /** Filter by provider */
  provider?: APIProvider;
  /** Filter by status */
  status?: APIKeyStatus;
  /** Filter by key type */
  keyType?: APIKeyType;
  /** Filter by tags */
  tags?: string[];
  /** Search in names and descriptions */
  search?: string;
  /** Number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'lastUsed' | 'provider';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result of listing API keys
 */
export interface APIKeyListResult {
  /** List of API keys */
  keys: EncryptedAPIKey[];
  /** Total count (for pagination) */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Next cursor for pagination */
  nextCursor?: string;
}

/**
 * Result of key rotation operation
 */
export interface KeyRotationResult {
  /** Whether rotation was successful */
  success: boolean;
  /** New key ID if rotation was successful */
  newKeyId?: string;
  /** Error message if rotation failed */
  error?: string;
  /** Whether rollback is available */
  rollbackAvailable: boolean;
}

/**
 * Result of key connection test
 */
export interface ConnectionTestResult {
  /** Whether connection was successful */
  success: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error message if connection failed */
  error?: string;
  /** Additional metadata from the test */
  metadata?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;
  /** Individual check results */
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
}

/**
 * Bulk import result
 */
export interface ImportResult {
  /** Number of successfully imported keys */
  success: number;
  /** Number of failed imports */
  failed: number;
  /** List of import errors */
  errors: Array<{
    key: string;
    error: string;
  }>;
}

/**
 * Complete API key manager interface
 */
export interface APIKeyManager {
  // Create operations
  /** Create a new API key */
  createKey: (input: CreateAPIKeyInput) => Promise<EncryptedAPIKey>;
  
  // Read operations
  /** Get a specific API key by ID */
  getKey: (id: string) => Promise<EncryptedAPIKey | null>;
  /** List API keys with optional filtering */
  listKeys: (options?: APIKeyQueryOptions) => Promise<APIKeyListResult>;
  /** Find keys matching criteria */
  findKeys: (query: Partial<APIKeyMetadata>) => Promise<EncryptedAPIKey[]>;
  
  // Update operations
  /** Update an API key */
  updateKey: (id: string, updates: UpdateAPIKeyInput) => Promise<EncryptedAPIKey>;
  /** Update key status */
  updateKeyStatus: (id: string, status: APIKeyStatus) => Promise<EncryptedAPIKey>;
  
  // Delete operations
  /** Delete an API key permanently */
  deleteKey: (id: string) => Promise<boolean>;
  /** Revoke an API key (soft delete) */
  revokeKey: (id: string) => Promise<boolean>;
  
  // Validation operations
  /** Validate an API key */
  validateKey: (key: string, provider: APIProvider) => Promise<ValidationResult>;
  /** Test API key connection */
  testKeyConnection: (id: string) => Promise<ConnectionTestResult>;
  
  // Usage tracking
  /** Record API key usage */
  recordUsage: (id: string, usage: {
    requests: number;
    tokens: number;
    cost: number;
    responseTime: number;
  }) => Promise<void>;
  /** Get usage statistics */
  getUsageStats: (id: string, period?: string) => Promise<APIKeyUsageStats>;
  
  // Rotation operations
  /** Rotate an API key */
  rotateKey: (id: string) => Promise<KeyRotationResult>;
  /** Schedule key rotation */
  scheduleRotation: (id: string, config: RotationConfig) => Promise<void>;
  /** Cancel scheduled rotation */
  cancelRotation: (id: string) => Promise<boolean>;
  
  // Utility operations
  /** Export keys (optionally including secrets) */
  exportKeys: (includeSecrets?: boolean) => Promise<Record<string, unknown>>;
  /** Import keys from backup */
  importKeys: (data: Record<string, unknown>) => Promise<ImportResult>;
  /** Clear cached data */
  clearCache: () => Promise<void>;
  /** Get system health status */
  getHealthStatus: () => Promise<HealthCheckResult>;
}

// =============================================================================
// Default Validation Rules
// =============================================================================

/**
 * Default validation rules for all supported providers
 */
export const DEFAULT_PROVIDER_RULES: ProviderValidationRules = {
  openai: {
    pattern: /^sk-[A-Za-z0-9]{48}$/,
    minLength: 51,
    maxLength: 51,
    requiredPrefix: 'sk-',
    description: 'OpenAI API keys start with "sk-" followed by 48 alphanumeric characters'
  },
  anthropic: {
    pattern: /^sk-ant-[A-Za-z0-9]{40,52}$/,
    minLength: 47,
    maxLength: 59,
    requiredPrefix: 'sk-ant-',
    description: 'Anthropic API keys start with "sk-ant-" followed by 40-52 alphanumeric characters'
  },
  google: {
    pattern: /^AIza[A-Za-z0-9_-]{35}$/,
    minLength: 39,
    maxLength: 39,
    requiredPrefix: 'AIza',
    description: 'Google API keys start with "AIza" followed by 35 alphanumeric, underscore, or dash characters'
  },
  custom: {
    pattern: /^.{1,1000}$/,
    minLength: 1,
    maxLength: 1000,
    description: 'Custom provider keys can be any format between 1-1000 characters'
  }
};

/**
 * Default key type mapping based on key format
 */
export const DEFAULT_KEY_TYPE_DETECTION: Record<APIProvider, (key: string) => APIKeyType> = {
  openai: (_key: string) => {
    // OpenAI doesn't have different formats for different tiers
    return 'standard';
  },
  anthropic: (_key: string) => {
    // Anthropic uses consistent format for all tiers
    return 'standard';
  },
  google: (_key: string) => {
    // Google API keys don't indicate tier in the key format
    return 'standard';
  },
  custom: (_key: string) => {
    return 'standard';
  }
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a masked version of an API key for safe display
 */
export function maskAPIKey(key: string, visibleChars: number = 4): string {
  if (key.length <= visibleChars * 2) {
    return '***';
  }
  
  const start = key.slice(0, Math.min(visibleChars, 8));
  const end = key.slice(-Math.min(visibleChars, 8));
  return `${start}...${end}`;
}

/**
 * Detect provider from API key format
 */
export function detectProvider(key: string): APIProvider | null {
  for (const [provider, rule] of Object.entries(DEFAULT_PROVIDER_RULES)) {
    if (rule.pattern.test(key)) {
      return provider as APIProvider;
    }
  }
  return null;
}

/**
 * Validate API key format for a specific provider
 */
export function validateKeyFormat(key: string, provider: APIProvider): ValidationResult {
  const rule = DEFAULT_PROVIDER_RULES[provider];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check length
  if (key.length < rule.minLength) {
    errors.push(`Key too short. Expected at least ${rule.minLength} characters, got ${key.length}`);
  }
  if (key.length > rule.maxLength) {
    errors.push(`Key too long. Expected at most ${rule.maxLength} characters, got ${key.length}`);
  }

  // Check prefix
  if (rule.requiredPrefix && !key.startsWith(rule.requiredPrefix)) {
    errors.push(`Key must start with "${rule.requiredPrefix}"`);
  }

  // Check pattern
  if (!rule.pattern.test(key)) {
    errors.push(`Key format invalid. ${rule.description}`);
  }

  // Detect actual provider
  const detectedProvider = detectProvider(key);
  if (detectedProvider && detectedProvider !== provider) {
    warnings.push(`Key appears to be for ${detectedProvider}, not ${provider}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    provider: detectedProvider || provider,
    keyType: DEFAULT_KEY_TYPE_DETECTION[provider](key),
    estimatedTier: DEFAULT_KEY_TYPE_DETECTION[provider](key)
  };
}

/**
 * Generate a unique ID for an API key
 */
export function generateKeyId(provider: APIProvider, keyHash?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const hashSuffix = keyHash ? keyHash.substring(0, 8) : '';
  return `${provider}-${timestamp}-${random}${hashSuffix}`;
}

/**
 * Check if an API key is expired
 */
export function isKeyExpired(metadata: APIKeyMetadata): boolean {
  if (!metadata.expiresAt) {
    return false;
  }
  return Date.now() > metadata.expiresAt;
}

/**
 * Check if an API key needs rotation
 */
export function needsRotation(
  metadata: APIKeyMetadata, 
  rotationConfig: RotationConfig
): boolean {
  if (!rotationConfig.enabled || !rotationConfig.intervalDays) {
    return false;
  }

  const rotationIntervalMs = rotationConfig.intervalDays * 24 * 60 * 60 * 1000;
  const timeSinceCreation = Date.now() - metadata.createdAt;
  
  return timeSinceCreation >= rotationIntervalMs;
}

/**
 * Get days until key expiration
 */
export function getDaysUntilExpiration(metadata: APIKeyMetadata): number | null {
  if (!metadata.expiresAt) {
    return null;
  }
  
  const msUntilExpiration = metadata.expiresAt - Date.now();
  return Math.ceil(msUntilExpiration / (24 * 60 * 60 * 1000));
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for APIKeyMetadata
 */
export function isAPIKeyMetadata(value: unknown): value is APIKeyMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).provider === 'string' &&
    typeof (value as any).keyType === 'string' &&
    typeof (value as any).status === 'string' &&
    typeof (value as any).name === 'string' &&
    typeof (value as any).createdAt === 'number' &&
    typeof (value as any).lastUsed === 'number' &&
    typeof (value as any).maskedKey === 'string'
  );
}

/**
 * Type guard for EncryptedAPIKey
 */
export function isEncryptedAPIKey(value: unknown): value is EncryptedAPIKey {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).id === 'string' &&
    isAPIKeyMetadata((value as any).metadata) &&
    typeof (value as any).encryptedData === 'object' &&
    typeof (value as any).keyHash === 'string' &&
    typeof (value as any).checksum === 'string' &&
    typeof (value as any).storageVersion === 'number' &&
    typeof (value as any).configuration === 'object'
  );
}

/**
 * Type guard for APIKeyStorage
 */
export function isAPIKeyStorage(value: unknown): value is APIKeyStorage {
  return (
    isEncryptedAPIKey(value) &&
    typeof (value as any).usageStats === 'object' &&
    typeof (value as any).rotationStatus === 'object'
  );
}

/**
 * Type guard for ValidationResult
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).isValid === 'boolean' &&
    Array.isArray((value as any).errors) &&
    Array.isArray((value as any).warnings)
  );
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  // Validation rules
  DEFAULT_PROVIDER_RULES,
  DEFAULT_KEY_TYPE_DETECTION,
  
  // Utility functions
  maskAPIKey,
  detectProvider,
  validateKeyFormat,
  generateKeyId,
  isKeyExpired,
  needsRotation,
  getDaysUntilExpiration,
  
  // Type guards
  isAPIKeyMetadata,
  isEncryptedAPIKey,
  isAPIKeyStorage,
  isValidationResult,
};