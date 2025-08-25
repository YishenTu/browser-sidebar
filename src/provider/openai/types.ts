/**
 * @file OpenAI Provider Type Definitions
 *
 * Type definitions specific to OpenAI API integration,
 * including Responses API and streaming formats.
 */

/**
 * OpenAI Responses API request format
 */
export interface OpenAIResponseRequest {
  model: string;
  input: string;
  tools?: Array<{ type: string }>;
  reasoning?: {
    effort: string;
    summary: 'auto' | 'none';
  };
  stream?: boolean;
}

/**
 * OpenAI Responses API response format
 */
export interface OpenAIResponse {
  id: string;
  response_id?: string;
  output_text?: string;
  output?: OpenAIOutput[];
  outputs?: OpenAIOutput[];
  content?: Array<{ text: string }>;
  finish_reason?: string;
  status?: string;
  usage?: OpenAIUsage;
  model: string;
  created?: number;
  reasoning?: {
    summary?: Array<{ text: string }>;
  };
}

/**
 * OpenAI output item
 */
export interface OpenAIOutput {
  type: 'message' | 'reasoning' | 'web_search_call';
  item_type?: string;
  content?: OpenAIMessageContent[];
  summary?: Array<{ type: string; text: string }>;
  data?: {
    summary?: Array<{ text: string }>;
  };
  action?: {
    type?: string;
    query?: string;
  };
}

/**
 * OpenAI message content
 */
export interface OpenAIMessageContent {
  type: 'output_text';
  text?: string;
  annotations?: OpenAIAnnotation[];
}

/**
 * OpenAI annotation for citations
 */
export interface OpenAIAnnotation {
  type: 'url_citation';
  url: string;
  title?: string;
}

/**
 * OpenAI usage metadata
 */
export interface OpenAIUsage {
  prompt_tokens?: number;
  input_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  thinking_tokens?: number;
}

/**
 * OpenAI streaming event types
 */
export interface OpenAIStreamEvent {
  id?: string;
  response_id?: string;
  type?: string;
  item_type?: string;
  delta?: string | { output_text?: string };
  output_text?: string;
  text?: string;
  item?: {
    type?: string;
    content?: OpenAIMessageContent[];
    action?: {
      type?: string;
      query?: string;
    };
  };
  finish_reason?: string;
  status?: string;
  usage?: OpenAIUsage;
  model?: string;
  created?: number;
  summary?: Array<{ text: string }> | string;
  summary_text?: string;
}

/**
 * OpenAI chat configuration
 */
export interface OpenAIChatConfig {
  signal?: AbortSignal;
  reasoningEffort?: string;
  stream?: boolean;
}

/**
 * OpenAI error response
 */
export interface OpenAIError {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
  status?: number;
  statusCode?: number;
  headers?: Record<string, string>;
}

/**
 * Supported reasoning effort levels
 */
export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/**
 * Finish reason mappings
 */
export const FINISH_REASON_MAP: Record<string, string> = {
  stop: 'stop',
  length: 'length',
  content_filter: 'content_filter',
  tool_calls: 'tool_calls',
  completed: 'stop',
};
