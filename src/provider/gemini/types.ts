/**
 * @file Gemini Provider Type Definitions
 *
 * Comprehensive type definitions for Google Gemini API integration.
 * Includes request/response formats, configuration types, and internal interfaces.
 */

import type { FinishReason, ThinkingBudget } from '../../types/providers';

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Content part in Gemini API format
 */
export interface GeminiPart {
  text?: string;
  thinking?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * Content block for messages
 */
export interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

/**
 * Generation configuration for API requests
 */
export interface GeminiGenerationConfig {
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseModalities?: string[];
  thinkingConfig?: {
    thinkingBudget: number;
    includeThoughts?: boolean;
  };
}

/**
 * Tool configuration for API requests
 */
export interface GeminiTool {
  google_search?: Record<string, never>; // Empty object for Google Search
}

/**
 * Safety settings for content filtering
 */
export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

/**
 * Complete API request structure
 */
export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  tools?: GeminiTool[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response part from Gemini API
 */
export interface GeminiResponsePart {
  text?: string;
  thinking?: string;
  thought?: boolean; // Indicates if this part contains thought summary
}

/**
 * Response candidate
 */
export interface GeminiCandidate {
  content?: {
    parts: GeminiResponsePart[];
    role?: string;
  };
  finishReason?: string;
  index?: number;
  groundingMetadata?: GeminiSearchMetadata; // Can appear in candidates during streaming
}

/**
 * Search/grounding metadata
 */
export interface GeminiSearchMetadata {
  webSearchQueries?: string[];
  web_search_queries?: string[]; // Snake case variant
  groundingChunks?: GeminiGroundingChunk[];
  grounding_chunks?: GeminiGroundingChunk[]; // Snake case variant
  groundingSupports?: GeminiGroundingSupport[];
  grounding_supports?: GeminiGroundingSupport[]; // Snake case variant
  searchEntryPoint?: GeminiSearchEntryPoint;
  search_entry_point?: GeminiSearchEntryPoint; // Snake case variant
}

/**
 * Grounding chunk with source information
 */
export interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

/**
 * Grounding support with citation information
 */
export interface GeminiGroundingSupport {
  segment?: {
    startIndex?: number;
    start_index?: number; // Snake case variant
    endIndex?: number;
    end_index?: number; // Snake case variant
    text?: string;
  };
  groundingChunkIndices?: number[];
  grounding_chunk_indices?: number[]; // Snake case variant
}

/**
 * Search entry point with rendered content
 */
export interface GeminiSearchEntryPoint {
  renderedContent?: string;
  rendered_content?: string; // Snake case variant
}

/**
 * Usage metadata from API response
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thinkingTokenCount?: number;
}

/**
 * Complete API response structure
 */
export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  groundingMetadata?: GeminiSearchMetadata;
  grounding_metadata?: GeminiSearchMetadata; // Snake case variant
  searchMetadata?: GeminiSearchMetadata; // Alternative name
  search_metadata?: GeminiSearchMetadata; // Snake case variant
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Chat configuration options
 */
export interface GeminiChatConfig {
  thinkingBudget?: ThinkingBudget;
  showThoughts?: boolean;
  signal?: AbortSignal;
}

/**
 * API configuration constants
 */
export interface GeminiApiConfig {
  BASE_URL: string;
  VERSION: string;
  DEFAULT_RETRY_AFTER: number;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Formatted search metadata for responses
 */
export interface FormattedSearchMetadata {
  queries?: string[];
  sources?: Array<{
    url: string;
    title: string;
  }>;
  citations?: Array<{
    text: string;
    startIndex?: number;
    endIndex?: number;
    sourceIndices: number[];
  }>;
  searchWidget?: string;
}

/**
 * Supported image MIME types
 */
export type SupportedImageType =
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

/**
 * Normalized finish reason mapping
 */
export const FINISH_REASON_MAP: Record<string, FinishReason> = {
  STOP: 'stop',
  FINISH: 'stop',
  MAX_TOKENS: 'length',
  LENGTH: 'length',
  SAFETY: 'content_filter',
  CONTENT_FILTER: 'content_filter',
} as const;

/**
 * API configuration constants
 */
export const GEMINI_API_CONFIG: GeminiApiConfig = {
  BASE_URL: 'https://generativelanguage.googleapis.com',
  VERSION: 'v1beta',
  DEFAULT_RETRY_AFTER: 60,
} as const;

/**
 * Supported image types for multimodal inputs
 */
export const SUPPORTED_IMAGE_TYPES: readonly SupportedImageType[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
