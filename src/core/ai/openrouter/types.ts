/**
 * OpenRouter-specific types
 */

/**
 * OpenRouter annotation types
 */
export interface OpenRouterAnnotation {
  type: 'url_citation' | string;
  title?: string;
  url?: string;
  snippet?: string;
  domain?: string;
}

/**
 * OpenRouter-specific message delta
 */
export interface OpenRouterDelta {
  role?: string;
  content?: string;
  reasoning?: string;
  annotations?: OpenRouterAnnotation[];
}

/**
 * OpenRouter-specific choice
 */
export interface OpenRouterChoice {
  index: number;
  delta: OpenRouterDelta;
  finish_reason?: string | null;
}

/**
 * OpenRouter streaming chunk
 */
export interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * OpenRouter error response
 */
export interface OpenRouterError {
  error: {
    message: string;
    type?: string;
    code?: string | number;
  };
}

/**
 * OpenRouter request options
 */
export interface OpenRouterTextPart {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface OpenRouterRequestOptions {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | OpenRouterTextPart[];
  }>;
  stream: boolean;
  usage?: {
    include: boolean;
  };
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
    max_tokens?: number;
    exclude?: boolean;
  };
  cache_control?: Array<{
    type: 'ephemeral';
  }>;
}
