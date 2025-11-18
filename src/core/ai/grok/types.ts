/**
 * @file Grok Provider Type Definitions
 *
 * Grok uses an OpenAI-compatible API format
 */

/** Grok chat configuration */
export interface GrokChatConfig {
  stream?: boolean;
  signal?: AbortSignal;
  systemPrompt?: string;
}

/** Grok API request format */
export interface GrokRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/** Grok API response format */
export interface GrokResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: GrokUsage;
}

/** Grok usage metadata */
export interface GrokUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Grok streaming event */
export interface GrokStreamEvent {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: GrokUsage;
}
