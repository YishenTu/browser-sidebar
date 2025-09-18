declare module 'openai/resources/chat/completions' {
  export interface ChatCompletionCreateParams {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{ type: 'text'; text: string }>;
    }>;
    [key: string]: unknown;
  }

  export interface ChatCompletionChunk {
    id: string;
    object?: string;
    choices: Array<{
      index: number;
      finish_reason: string | null;
      delta?: {
        role?: 'assistant' | 'user' | 'system';
        content?: string;
      };
      message?: {
        role: 'assistant' | 'user' | 'system';
        content?: string;
      };
      logprobs?: unknown;
    }>;
    created?: number;
    model?: string;
    system_fingerprint?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
}
