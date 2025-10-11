/**
 * @file Gemini Provider Type Definitions (Core)
 */

import type { FinishReason, ThinkingBudget } from '@/types/providers';

// API Request Types
export interface GeminiPart {
  text?: string;
  thinking?: string;
  fileData?: { mimeType?: string; fileUri: string };
}

export interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseModalities?: string[];
  thinkingConfig?: { thinkingBudget: number; includeThoughts?: boolean };
}

export interface GeminiTool {
  google_search?: Record<string, never>;
  url_context?: Record<string, never>;
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiSystemInstruction {
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
  tools?: GeminiTool[];
  systemInstruction?: GeminiSystemInstruction;
}

// API Response Types
export interface GeminiResponsePart {
  text?: string;
  thinking?: string;
  thought?: boolean;
}

export interface GeminiCandidate {
  content?: { parts: GeminiResponsePart[]; role?: string };
  finishReason?: string;
  index?: number;
  groundingMetadata?: GeminiSearchMetadata;
}

export interface GeminiSearchMetadata {
  webSearchQueries?: string[];
  web_search_queries?: string[];
  groundingChunks?: GeminiGroundingChunk[];
  grounding_chunks?: GeminiGroundingChunk[];
  groundingSupports?: GeminiGroundingSupport[];
  grounding_supports?: GeminiGroundingSupport[];
  searchEntryPoint?: GeminiSearchEntryPoint;
  search_entry_point?: GeminiSearchEntryPoint;
}

export interface GeminiGroundingChunk {
  web?: { uri?: string; title?: string };
}

export interface GeminiGroundingSupport {
  segment?: {
    startIndex?: number;
    start_index?: number;
    endIndex?: number;
    end_index?: number;
    text?: string;
  };
  groundingChunkIndices?: number[];
  grounding_chunk_indices?: number[];
}

export interface GeminiSearchEntryPoint {
  renderedContent?: string;
  rendered_content?: string;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thinkingTokenCount?: number;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  groundingMetadata?: GeminiSearchMetadata;
  grounding_metadata?: GeminiSearchMetadata;
  searchMetadata?: GeminiSearchMetadata;
  search_metadata?: GeminiSearchMetadata;
}

// Configuration Types
export interface GeminiChatConfig {
  thinkingBudget?: ThinkingBudget;
  signal?: AbortSignal;
  systemPrompt?: string;
  useUrlContext?: boolean;
  [key: string]: unknown;
}

export interface GeminiApiConfig {
  BASE_URL: string;
  VERSION: string;
  DEFAULT_RETRY_AFTER: number;
}

// Internal Types
export interface FormattedSearchMetadata {
  queries?: string[];
  sources?: Array<{ url: string; title: string }>;
  citations?: Array<{
    text: string;
    startIndex?: number;
    endIndex?: number;
    sourceIndices: number[];
  }>;
  searchWidget?: string;
}

export type SupportedImageType =
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export const FINISH_REASON_MAP: Record<string, FinishReason> = {
  STOP: 'stop',
  FINISH: 'stop',
  MAX_TOKENS: 'length',
  LENGTH: 'length',
  SAFETY: 'content_filter',
  CONTENT_FILTER: 'content_filter',
} as const;

export const GEMINI_API_CONFIG: GeminiApiConfig = {
  BASE_URL: 'https://generativelanguage.googleapis.com',
  VERSION: 'v1beta',
  DEFAULT_RETRY_AFTER: 60,
} as const;

export const SUPPORTED_IMAGE_TYPES: readonly SupportedImageType[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];
