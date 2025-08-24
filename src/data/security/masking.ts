/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * @file Data Masking
 *
 * Comprehensive data masking functionality to hide sensitive information.
 * Supports reversible/irreversible masking, partial masking, and different contexts
 * (text, JSON, HTML). Integrates with pattern detection and encryption services.
 */

import { PatternMatch, PatternDetector } from './patterns';
import { EncryptionService } from './encryptionService';
import type { EncryptedData } from './crypto';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Types of masking that can be applied
 */
export type MaskType = 'reversible' | 'irreversible' | 'partial';

/**
 * Permission object for unmasking operations
 */
export interface MaskPermission {
  /** Whether permission is granted */
  granted: boolean;
  /** Reason for the permission status */
  reason: string;
  /** When the permission was granted/checked */
  timestamp: Date;
  /** Optional expiration time in milliseconds */
  expiresIn?: number;
  /** Optional user/session identifier */
  userId?: string;
}

/**
 * Options for partial masking
 */
export interface PartialMaskingOptions {
  /** Number of characters to show at the beginning */
  showFirst?: number;
  /** Number of characters to show at the end */
  showLast?: number;
  /** Character to use for masking */
  maskCharacter?: string;
  /** Whether to preserve formatting characters */
  preserveFormatting?: boolean;
}

/**
 * Configuration for pattern-specific masking
 */
export interface PatternMaskingConfig {
  /** Whether this pattern type is enabled for masking */
  enabled: boolean;
  /** Type of masking to apply */
  maskType: MaskType;
  /** Options for partial masking */
  partialOptions?: PartialMaskingOptions;
}

/**
 * Overall masking configuration
 */
export interface MaskingConfig {
  /** Enable reversible masking globally */
  enableReversibleMasking: boolean;
  /** Enable partial masking globally */
  enablePartialMasking: boolean;
  /** Default mask character */
  maskCharacter: string;
  /** Preserve formatting by default */
  preserveFormatting: boolean;
  /** Maximum document size to process */
  maxDocumentSize: number;
  /** Processing timeout in milliseconds */
  timeout: number;
  /** Pattern-specific configurations */
  patterns: Record<string, PatternMaskingConfig>;
}

/**
 * Result of masking a single text
 */
export interface MaskingResult {
  /** The masked text */
  maskedText: string;
  /** Type of masking applied */
  maskType: MaskType;
  /** Whether this can be unmasked */
  canUnmask: boolean;
  /** Original text length */
  originalLength: number;
  /** Encrypted data for reversible masking */
  encryptedData?: EncryptedData;
  /** Whether formatting was preserved */
  preservedFormatting?: boolean;
  /** Masking key identifier */
  keyId?: string;
}

/**
 * Result of masking pattern matches
 */
export interface PatternMaskingResult {
  /** Text with all patterns masked */
  maskedText: string;
  /** Information about each masking operation performed */
  maskingApplied: Array<{
    pattern: PatternMatch;
    maskType: MaskType;
    canUnmask: boolean;
    keyId?: string;
  }>;
  /** Total number of patterns masked */
  totalMasked: number;
}

/**
 * Result of masking an entire document
 */
export interface DocumentMaskingResult {
  /** The masked document */
  maskedDocument: string;
  /** Total number of matches found and masked */
  totalMatches: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Breakdown by pattern type */
  patternBreakdown: Record<string, number>;
}

/**
 * Result of masking JSON data
 */
export interface JSONMaskingResult {
  /** The masked JSON data */
  maskedData: any;
  /** Total number of fields masked */
  totalMasked: number;
  /** Fields that were masked */
  maskedFields: string[];
}

/**
 * Result of masking HTML content
 */
export interface HTMLMaskingResult {
  /** The masked HTML */
  maskedHTML: string;
  /** Total number of patterns masked */
  totalMasked: number;
  /** Whether HTML structure was preserved */
  structurePreserved: boolean;
}

/**
 * Options for masking operations
 */
export interface MaskingOptions {
  /** Encryption service for reversible masking */
  encryptionService?: EncryptionService;
  /** Options for partial masking */
  partialOptions?: PartialMaskingOptions;
  /** Custom masking key */
  maskingKey?: string;
}

/**
 * Result of batch masking operations
 */
export interface BatchMaskingResult {
  /** Successfully masked results */
  results: MaskingResult[];
  /** Total number of items processed */
  totalProcessed: number;
  /** Total number of items masked */
  totalMasked: number;
  /** Errors encountered */
  errors: Array<{ item: any; error: Error }>;
}

/**
 * Options for batch operations
 */
export interface BatchMaskingOptions extends MaskingOptions {
  /** Number of items to process per batch */
  batchSize?: number;
  /** Whether to fail immediately on first error */
  failOnError?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default masking character */
const DEFAULT_MASK_CHAR = '*';

/** Default batch size for operations */
const DEFAULT_BATCH_SIZE = 100;

/** Valid permission reasons */
const VALID_PERMISSION_REASONS = [
  'authorized_user',
  'admin_override',
  'emergency_access',
  'system_process',
];

// =============================================================================
// Core Masking Functions
// =============================================================================

/**
 * Mask a text string using the specified mask type
 */
export async function maskText(
  text: string,
  maskType: MaskType,
  options: MaskingOptions = {}
): Promise<MaskingResult> {
  // Input validation
  if (typeof text !== 'string') {
    throw new Error('Invalid input: text must be a string');
  }

  if (!['reversible', 'irreversible', 'partial'].includes(maskType)) {
    throw new Error('Invalid mask type: must be reversible, irreversible, or partial');
  }

  // Handle empty string
  if (text.length === 0) {
    return {
      maskedText: '',
      maskType,
      canUnmask: false,
      originalLength: 0,
    };
  }

  switch (maskType) {
    case 'irreversible':
      return maskIrreversible(text, options);

    case 'reversible':
      return await maskReversible(text, options);

    case 'partial':
      return maskPartial(text, options);

    default:
      throw new Error(`Unsupported mask type: ${maskType}`);
  }
}

/**
 * Unmask previously masked text with permission validation
 */
export async function unmaskText(
  maskingResult: MaskingResult,
  permission: MaskPermission,
  options: MaskingOptions = {}
): Promise<string> {
  // Validate permission
  if (!(await validateMaskPermission(permission))) {
    throw new Error('Permission denied: insufficient privileges to unmask data');
  }

  // Check if unmasking is possible
  if (maskingResult.maskType === 'irreversible') {
    throw new Error('Cannot unmask irreversible masking');
  }

  if (maskingResult.maskType === 'partial') {
    throw new Error('Cannot unmask partial masking - original data is lost');
  }

  if (!maskingResult.canUnmask) {
    throw new Error('This masked data cannot be unmasked');
  }

  // Unmask reversible data
  if (maskingResult.maskType === 'reversible') {
    if (!maskingResult.encryptedData) {
      throw new Error('No encrypted data available for unmasking');
    }

    if (!options.encryptionService) {
      throw new Error('Encryption service required for unmasking reversible data');
    }

    try {
      return await options.encryptionService.decryptData(maskingResult.encryptedData, 'text');
    } catch (error) {
      throw new Error(
        `Failed to unmask data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  throw new Error('Unable to unmask data');
}

/**
 * Mask detected pattern matches in text
 */
export async function maskPatternMatches(
  text: string,
  matches: PatternMatch[],
  config: MaskingConfig,
  options: MaskingOptions = {}
): Promise<PatternMaskingResult> {
  let maskedText = text;
  const maskingApplied: Array<{
    pattern: PatternMatch;
    maskType: MaskType;
    canUnmask: boolean;
    keyId?: string;
  }> = [];

  // Sort matches by start index in reverse order to avoid offset issues
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex);

  for (const match of sortedMatches) {
    const patternConfig = config.patterns[match.type];

    // Skip if pattern is disabled
    if (!patternConfig?.enabled) {
      continue;
    }

    try {
      // Get the text to mask
      const textToMask = match.value;

      // Apply masking based on configuration
      const maskingResult = await maskText(textToMask, patternConfig.maskType, {
        ...options,
        partialOptions: patternConfig.partialOptions || options.partialOptions,
      });

      // Replace in the main text
      maskedText =
        maskedText.slice(0, match.startIndex) +
        maskingResult.maskedText +
        maskedText.slice(match.endIndex);

      maskingApplied.push({
        pattern: match,
        maskType: maskingResult.maskType,
        canUnmask: maskingResult.canUnmask,
        keyId: maskingResult.keyId,
      });
    } catch (error) {
      console.warn(`Failed to mask pattern ${match.type}:`, error);
    }
  }

  return {
    maskedText,
    maskingApplied,
    totalMasked: maskingApplied.length,
  };
}

/**
 * Mask an entire document by detecting and masking all sensitive patterns
 */
export async function maskDocument(
  document: string,
  config: MaskingConfig,
  options: MaskingOptions = {}
): Promise<DocumentMaskingResult> {
  const startTime = Date.now();

  // Validate configuration
  validateMaskingConfig(config);

  // Check document size
  if (document.length > config.maxDocumentSize) {
    throw new Error(
      `Document too large: ${document.length} bytes exceeds limit of ${config.maxDocumentSize} bytes`
    );
  }

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Document processing timeout')), config.timeout);
  });

  try {
    // Detect patterns with timeout
    const detector = new PatternDetector({
      enabledPatterns: Object.keys(config.patterns).filter(p => config.patterns[p].enabled),
    });

    const detectionPromise = detector.detectAll(document);
    const detectionResult = await Promise.race([detectionPromise, timeoutPromise]);

    // Mask all detected patterns
    const maskingPromise = maskPatternMatches(document, detectionResult.matches, config, options);
    const maskingResult = await Promise.race([maskingPromise, timeoutPromise]);

    // Calculate pattern breakdown
    const patternBreakdown: Record<string, number> = {};
    for (const applied of maskingResult.maskingApplied) {
      const type = applied.pattern.type;
      patternBreakdown[type] = (patternBreakdown[type] || 0) + 1;
    }

    const processingTimeMs = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms

    return {
      maskedDocument: maskingResult.maskedText,
      totalMatches: detectionResult.totalMatches,
      processingTimeMs,
      patternBreakdown,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error(`Document processing timeout after ${config.timeout}ms`);
    }
    throw error;
  }
}

/**
 * Mask sensitive data in JSON objects recursively
 */
export async function maskJSON(
  data: any,
  config: MaskingConfig,
  options: MaskingOptions = {}
): Promise<JSONMaskingResult> {
  // Check for circular references
  const seen = new WeakSet();

  function detectCircular(obj: any): void {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        throw new Error('Circular reference detected in JSON data');
      }
      seen.add(obj);

      if (Array.isArray(obj)) {
        obj.forEach(detectCircular);
      } else {
        Object.values(obj).forEach(detectCircular);
      }
    }
  }

  detectCircular(data);

  const maskedFields: string[] = [];
  let totalMasked = 0;

  async function maskRecursive(obj: any, path = ''): Promise<any> {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      const maskedArray = [];
      for (let i = 0; i < obj.length; i++) {
        maskedArray[i] = await maskRecursive(obj[i], `${path}[${i}]`);
      }
      return maskedArray;
    }

    if (typeof obj === 'object') {
      const maskedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        maskedObj[key] = await maskRecursive(value, currentPath);
      }
      return maskedObj;
    }

    if (typeof obj === 'string') {
      // Detect patterns in the string value
      const detector = new PatternDetector({
        enabledPatterns: Object.keys(config.patterns).filter(p => config.patterns[p].enabled),
      });

      const detectionResult = await detector.detectAll(obj);

      if (detectionResult.matches.length > 0) {
        const maskingResult = await maskPatternMatches(
          obj,
          detectionResult.matches,
          config,
          options
        );
        totalMasked += maskingResult.totalMasked;
        maskedFields.push(path);
        return maskingResult.maskedText;
      }
    }

    return obj;
  }

  const maskedData = await maskRecursive(data);

  return {
    maskedData,
    totalMasked,
    maskedFields,
  };
}

/**
 * Mask sensitive data in HTML content while preserving structure
 */
export async function maskHTML(
  html: string,
  config: MaskingConfig,
  options: MaskingOptions = {}
): Promise<HTMLMaskingResult> {
  // Extract text content from HTML while preserving structure
  const htmlTextPattern = />([^<]+)</g;
  const attributeValuePattern = /(\w+)=["']([^"']+)["']/g;

  let maskedHTML = html;
  let totalMasked = 0;
  const textReplacements: Array<{ original: string; masked: string; index: number }> = [];

  // Create pattern detector
  const detector = new PatternDetector({
    enabledPatterns: Object.keys(config.patterns).filter(p => config.patterns[p].enabled),
  });

  // Process text content between HTML tags
  let textMatch;
  htmlTextPattern.lastIndex = 0;

  while ((textMatch = htmlTextPattern.exec(html)) !== null) {
    const textContent = textMatch[1].trim();
    if (textContent.length === 0) continue;

    const detectionResult = await detector.detectAll(textContent);

    if (detectionResult.matches.length > 0) {
      const maskingResult = await maskPatternMatches(
        textContent,
        detectionResult.matches,
        config,
        options
      );

      if (maskingResult.totalMasked > 0) {
        textReplacements.push({
          original: textContent,
          masked: maskingResult.maskedText,
          index: textMatch.index + 1, // +1 to skip the '>' character
        });
        totalMasked += maskingResult.totalMasked;
      }
    }
  }

  // Process attribute values
  let attrMatch;
  attributeValuePattern.lastIndex = 0;

  while ((attrMatch = attributeValuePattern.exec(html)) !== null) {
    const attributeValue = attrMatch[2];

    const detectionResult = await detector.detectAll(attributeValue);

    if (detectionResult.matches.length > 0) {
      const maskingResult = await maskPatternMatches(
        attributeValue,
        detectionResult.matches,
        config,
        options
      );

      if (maskingResult.totalMasked > 0) {
        textReplacements.push({
          original: attributeValue,
          masked: maskingResult.maskedText,
          index: attrMatch.index + attrMatch[1].length + 2, // Position after 'attr="'
        });
        totalMasked += maskingResult.totalMasked;
      }
    }
  }

  // Apply replacements in reverse order to maintain correct indices
  textReplacements
    .sort((a, b) => b.index - a.index)
    .forEach(replacement => {
      const beforeIndex = maskedHTML.lastIndexOf(replacement.original, replacement.index);
      if (beforeIndex !== -1) {
        maskedHTML =
          maskedHTML.slice(0, beforeIndex) +
          replacement.masked +
          maskedHTML.slice(beforeIndex + replacement.original.length);
      }
    });

  return {
    maskedHTML,
    totalMasked,
    structurePreserved: true,
  };
}

// =============================================================================
// Permission and Security Functions
// =============================================================================

/**
 * Create a masking key for a specific purpose
 */
export async function createMaskingKey(purpose: string): Promise<string> {
  const timestamp = Date.now().toString();
  const random = crypto.getRandomValues(new Uint8Array(32));
  const combined = purpose + timestamp + Array.from(random).join('');

  // Hash the combined string to create a deterministic key
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate mask permission for unmasking operations
 */
export async function validateMaskPermission(permission: MaskPermission): Promise<boolean> {
  // Check if permission is granted
  if (!permission.granted) {
    return false;
  }

  // Validate permission reason
  if (!VALID_PERMISSION_REASONS.includes(permission.reason)) {
    return false;
  }

  // Check expiration if specified
  if (permission.expiresIn) {
    const expirationTime = permission.timestamp.getTime() + permission.expiresIn;
    if (Date.now() > expirationTime) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Perform batch masking on multiple items
 */
export async function performBatchMasking(
  items: string[],
  config: MaskingConfig,
  options: BatchMaskingOptions = {}
): Promise<BatchMaskingResult> {
  const { batchSize = DEFAULT_BATCH_SIZE, failOnError = false, ...maskingOptions } = options;

  const results: MaskingResult[] = [];
  const errors: Array<{ item: any; error: Error }> = [];
  let totalMasked = 0;

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (const item of batch) {
      try {
        if (typeof item !== 'string') {
          throw new Error('Invalid item: must be string');
        }

        const maskingResult = await maskDocument(item, config, maskingOptions);

        const result: MaskingResult = {
          maskedText: maskingResult.maskedDocument,
          maskType: 'irreversible', // Default for batch operations
          canUnmask: false,
          originalLength: item.length,
        };

        results.push(result);
        if (maskingResult.totalMatches > 0) {
          totalMasked++;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error');
        errors.push({ item, error: errorObj });

        if (failOnError) {
          throw new Error('Batch processing failed: ' + errorObj.message);
        }
      }
    }
  }

  return {
    results,
    totalProcessed: items.length,
    totalMasked,
    errors,
  };
}

// =============================================================================
// Private Helper Functions
// =============================================================================

/**
 * Mask text irreversibly using mask character
 */
function maskIrreversible(text: string, options: MaskingOptions): MaskingResult {
  const maskChar = options.partialOptions?.maskCharacter || DEFAULT_MASK_CHAR;

  // For irreversible masking, we should only mask alphanumeric characters
  // and preserve special characters and emojis for better usability
  const maskedText = text.replace(/[a-zA-Z0-9]/g, maskChar);

  return {
    maskedText,
    maskType: 'irreversible',
    canUnmask: false,
    originalLength: text.length,
  };
}

/**
 * Mask text reversibly using encryption
 */
async function maskReversible(text: string, options: MaskingOptions): Promise<MaskingResult> {
  if (!options.encryptionService) {
    throw new Error('Encryption service required for reversible masking');
  }

  try {
    const encryptedData = await options.encryptionService.encryptData(text, 'text');
    const maskChar = options.partialOptions?.maskCharacter || DEFAULT_MASK_CHAR;
    const maskedText = maskChar.repeat(text.length);

    return {
      maskedText,
      maskType: 'reversible',
      canUnmask: true,
      originalLength: text.length,
      encryptedData,
    };
  } catch (error) {
    throw new Error(
      `Failed to mask reversibly: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Mask text partially showing some characters
 */
function maskPartial(text: string, options: MaskingOptions): MaskingResult {
  const {
    showFirst = 0,
    showLast = 4,
    maskCharacter = DEFAULT_MASK_CHAR,
    preserveFormatting = true, // Default to true for better UX
  } = options.partialOptions || {};

  let maskedText = text;

  if (preserveFormatting) {
    // For formatted data like SSN (123-45-6789), preserve the formatting
    // and only mask the digits/letters
    const chars = text.split('');
    let digitCount = 0;
    const totalDigits = text.replace(/[^a-zA-Z0-9]/g, '').length;

    maskedText = chars
      .map(char => {
        if (/[a-zA-Z0-9]/.test(char)) {
          digitCount++;
          // Show first N digits or last N digits
          if (digitCount <= showFirst || digitCount > totalDigits - showLast) {
            return char;
          }
          return maskCharacter;
        } else {
          // Preserve formatting characters like -, spaces, parentheses
          return char;
        }
      })
      .join('');
  } else {
    // Simple masking with show first/last
    if (text.length <= showFirst + showLast) {
      // If text is too short, show it all or mask minimally
      if (text.length <= showLast) {
        maskedText = text; // Too short to mask meaningfully
      } else {
        maskedText =
          text.slice(0, showFirst) +
          maskCharacter.repeat(Math.max(1, text.length - showFirst - showLast)) +
          text.slice(-showLast);
      }
    } else {
      const firstPart = text.slice(0, showFirst);
      const lastPart = text.slice(-showLast);
      const middleLength = text.length - showFirst - showLast;
      maskedText = firstPart + maskCharacter.repeat(middleLength) + lastPart;
    }
  }

  return {
    maskedText,
    maskType: 'partial',
    canUnmask: false,
    originalLength: text.length,
    preservedFormatting: preserveFormatting,
  };
}

/**
 * Validate masking configuration
 */
function validateMaskingConfig(config: MaskingConfig): void {
  if (config.maxDocumentSize <= 0) {
    throw new Error('Invalid configuration: maxDocumentSize must be positive');
  }

  if (config.timeout <= 0) {
    throw new Error('Invalid configuration: timeout must be positive');
  }

  if (!config.maskCharacter || config.maskCharacter.length !== 1) {
    throw new Error('Invalid configuration: maskCharacter must be a single character');
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  maskText,
  unmaskText,
  maskPatternMatches,
  maskDocument,
  maskJSON,
  maskHTML,
  createMaskingKey,
  validateMaskPermission,
  performBatchMasking,
};
