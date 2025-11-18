/**
 * @file Grok Provider Type Definitions
 *
 * Grok uses xAI Response API format (similar to OpenAI Responses API)
 */

/** Grok search parameters */
export interface GrokSearchParameters {
  mode: 'on';
  return_citations?: boolean;
  max_search_results?: number;
}

/** Grok chat configuration */
export interface GrokChatConfig {
  stream?: boolean;
  signal?: AbortSignal;
  systemPrompt?: string;
  previousResponseId?: string;
}

/** Grok Response API request format */
export interface GrokRequest {
  model: string;
  input?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  previous_response_id?: string;
  tools?: Array<{ type: string }>;
  stream?: boolean;
  store?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/** Grok Response API response format */
export interface GrokResponse {
  id: string;
  response_id?: string;
  object: string;
  created: number;
  model: string;
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  status?: string;
  finish_reason?: string;
  usage?: GrokUsage;
}

/** Grok usage metadata */
export interface GrokUsage {
  prompt_tokens?: number;
  input_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  num_sources_used?: number;
}

/** Grok streaming event */
export interface GrokStreamEvent {
  id?: string;
  response_id?: string;
  response?: {
    id?: string;
  };
  object?: string;
  created?: number;
  model?: string;
  type?: string;
  delta?: string | { output_text?: string };
  output_text?: string;
  text?: string;
  status?: string;
  finish_reason?: string | null;
  usage?: GrokUsage;
  // Legacy chat completions format support (for backward compatibility)
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}
