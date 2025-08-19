# Stage 4: AI Provider System - Detailed Task Breakdown

## Stage Overview
**Goal:** Implement a unified AI provider system supporting multiple providers (OpenAI, Gemini, Anthropic) with streaming, rate limiting, and complete integration with the chat UI.

**Duration:** Estimated 2 weeks
**Total Tasks:** 22
**Parallelizable:** 11 (50%)
**Sequential:** 11 (50%)

## Prerequisites from Previous Stages
- [x] Message passing system (Stage 1)
- [x] Chat UI components (Stage 2)
- [x] Secure API key storage (Stage 3)
- [x] State management with Zustand (Stage 2)
- [x] Streaming message display (Stage 2)

## Stage 4 Deliverables
By the end of this stage, you will have:
1. ✅ Unified provider interface
2. ✅ OpenAI integration with Response API
3. ✅ Google Gemini integration
4. ✅ Anthropic via OpenRouter
5. ✅ Streaming response handling
6. ✅ Rate limiting and retry logic
7. ✅ Provider selection UI
8. ✅ Fully functional AI chatbot

---

## Phase 4.1: Provider Foundation (4 tasks)
**Goal:** Create the base infrastructure for all AI providers

### ⚡ Sequential Block: Core Provider Infrastructure

#### Task 4.1.1a - Provider Types 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** API key storage from Stage 3

**Test Requirements:**
```typescript
// tests/types/providers.test.ts
import { describe, it, expect } from 'vitest';
import {
  ProviderConfig,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  validateProviderConfig,
  validateChatRequest,
  isStreamChunk,
  ProviderError
} from '@/types/providers';

describe('Provider Types', () => {
  it('should validate provider configuration', () => {
    const config: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      apiKey: 'sk-test',
      endpoint: 'https://api.openai.com/v1',
      models: [
        { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096 }
      ],
      defaultModel: 'gpt-4',
      options: {
        temperature: 0.7,
        maxTokens: 2000,
        stream: true
      }
    };
    
    expect(validateProviderConfig(config)).toBe(true);
  });
  
  it('should validate chat request', () => {
    const request: ChatRequest = {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ],
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      stream: true,
      context: {
        conversationId: 'conv-123',
        tabContext: ['https://example.com']
      }
    };
    
    expect(validateChatRequest(request)).toBe(true);
  });
  
  it('should identify stream chunks', () => {
    const chunk: StreamChunk = {
      type: 'content',
      content: 'Hello',
      index: 0,
      finished: false
    };
    
    expect(isStreamChunk(chunk)).toBe(true);
  });
  
  it('should handle provider errors', () => {
    const error = new ProviderError(
      'Rate limit exceeded',
      'RATE_LIMIT',
      { retryAfter: 60 }
    );
    
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.details.retryAfter).toBe(60);
  });
});
```

**Implementation Steps:**
1. Create provider type definitions:
   ```typescript
   // src/types/providers.ts
   
   // Provider Configuration
   export interface ModelInfo {
     id: string;
     name: string;
     description?: string;
     maxTokens: number;
     supportsFunctions?: boolean;
     supportsVision?: boolean;
     costPer1kTokens?: {
       input: number;
       output: number;
     };
   }

   export interface ProviderConfig {
     id: string;
     name: string;
     apiKey: string;
     endpoint?: string;
     models: ModelInfo[];
     defaultModel: string;
     options?: {
       temperature?: number;
       maxTokens?: number;
       topP?: number;
       frequencyPenalty?: number;
       presencePenalty?: number;
       stream?: boolean;
     };
     headers?: Record<string, string>;
   }

   // Chat Types
   export interface ChatMessage {
     role: 'system' | 'user' | 'assistant' | 'function';
     content: string;
     name?: string; // For function messages
     functionCall?: {
       name: string;
       arguments: string;
     };
   }

   export interface ChatRequest {
     messages: ChatMessage[];
     model: string;
     temperature?: number;
     maxTokens?: number;
     topP?: number;
     frequencyPenalty?: number;
     presencePenalty?: number;
     stop?: string[];
     stream?: boolean;
     functions?: Array<{
       name: string;
       description: string;
       parameters: any;
     }>;
     context?: {
       conversationId?: string;
       tabContext?: string[];
       metadata?: Record<string, any>;
     };
   }

   export interface ChatResponse {
     id: string;
     model: string;
     choices: Array<{
       message: ChatMessage;
       finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
       index: number;
     }>;
     usage?: {
       promptTokens: number;
       completionTokens: number;
       totalTokens: number;
     };
     created: number;
   }

   // Streaming Types
   export interface StreamChunk {
     type: 'content' | 'function_call' | 'error' | 'done';
     content?: string;
     functionCall?: {
       name?: string;
       arguments?: string;
     };
     error?: string;
     index: number;
     finished: boolean;
     usage?: ChatResponse['usage'];
   }

   export type StreamCallback = (chunk: StreamChunk) => void;

   // Error Types
   export class ProviderError extends Error {
     constructor(
       message: string,
       public code: string,
       public details?: any
     ) {
       super(message);
       this.name = 'ProviderError';
     }
   }

   export const ErrorCodes = {
     RATE_LIMIT: 'RATE_LIMIT',
     INVALID_API_KEY: 'INVALID_API_KEY',
     MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
     CONTEXT_LENGTH_EXCEEDED: 'CONTEXT_LENGTH_EXCEEDED',
     NETWORK_ERROR: 'NETWORK_ERROR',
     INVALID_REQUEST: 'INVALID_REQUEST',
     SERVER_ERROR: 'SERVER_ERROR',
     TIMEOUT: 'TIMEOUT',
   } as const;

   // Validation Functions
   export function validateProviderConfig(config: any): config is ProviderConfig {
     return (
       typeof config === 'object' &&
       typeof config.id === 'string' &&
       typeof config.name === 'string' &&
       typeof config.apiKey === 'string' &&
       Array.isArray(config.models) &&
       config.models.length > 0 &&
       typeof config.defaultModel === 'string'
     );
   }

   export function validateChatRequest(request: any): request is ChatRequest {
     return (
       typeof request === 'object' &&
       Array.isArray(request.messages) &&
       request.messages.every((msg: any) =>
         typeof msg === 'object' &&
         ['system', 'user', 'assistant', 'function'].includes(msg.role) &&
         typeof msg.content === 'string'
       ) &&
       typeof request.model === 'string'
     );
   }

   export function isStreamChunk(data: any): data is StreamChunk {
     return (
       typeof data === 'object' &&
       ['content', 'function_call', 'error', 'done'].includes(data.type) &&
       typeof data.index === 'number' &&
       typeof data.finished === 'boolean'
     );
   }

   // Provider Interface
   export interface Provider {
     id: string;
     name: string;
     
     // Configuration
     configure(config: ProviderConfig): Promise<void>;
     validateConfig(): Promise<boolean>;
     getModels(): ModelInfo[];
     
     // Chat Operations
     chat(request: ChatRequest): Promise<ChatResponse>;
     streamChat(request: ChatRequest, callback: StreamCallback): Promise<void>;
     
     // Utilities
     countTokens(text: string, model?: string): number;
     getUsage(): Promise<{ used: number; limit: number }>;
   }
   ```

**Deliverables:**
- `src/types/providers.ts` - Provider type definitions
- Model information types
- Chat request/response types
- Streaming types
- Error types and codes
- Validation functions

**Acceptance Criteria:**
- [ ] Types cover all provider needs
- [ ] Validation functions work
- [ ] Error types comprehensive
- [ ] Stream types defined
- [ ] Tests pass

---

#### Task 4.1.1b - Base Provider Class 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 4.1.1a

**Test Requirements:**
```typescript
// tests/providers/BaseProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseProvider } from '@/providers/BaseProvider';
import { ChatRequest, ProviderConfig } from '@/types/providers';

class TestProvider extends BaseProvider {
  async validateConfig(): Promise<boolean> {
    return true;
  }
  
  protected async sendRequest(request: ChatRequest): Promise<any> {
    return { choices: [{ message: { content: 'Test response' } }] };
  }
  
  protected parseStreamChunk(data: string): any {
    return JSON.parse(data);
  }
}

describe('Base Provider', () => {
  let provider: TestProvider;
  
  beforeEach(() => {
    provider = new TestProvider();
  });
  
  it('should configure provider', async () => {
    const config: ProviderConfig = {
      id: 'test',
      name: 'Test Provider',
      apiKey: 'test-key',
      models: [{ id: 'model-1', name: 'Model 1', maxTokens: 1000 }],
      defaultModel: 'model-1'
    };
    
    await provider.configure(config);
    expect(provider.getModels()).toEqual(config.models);
  });
  
  it('should handle retries on failure', async () => {
    let attempts = 0;
    provider['sendRequest'] = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Network error');
      }
      return { choices: [{ message: { content: 'Success' } }] };
    });
    
    const response = await provider.chat({
      messages: [{ role: 'user', content: 'Test' }],
      model: 'model-1'
    });
    
    expect(attempts).toBe(3);
    expect(response.choices[0].message.content).toBe('Success');
  });
  
  it('should respect rate limits', async () => {
    provider['rateLimiter'].addRequest();
    provider['rateLimiter'].addRequest();
    provider['rateLimiter'].addRequest();
    
    const startTime = Date.now();
    await provider.chat({
      messages: [{ role: 'user', content: 'Test' }],
      model: 'model-1'
    });
    const duration = Date.now() - startTime;
    
    expect(duration).toBeGreaterThanOrEqual(100); // Should be rate limited
  });
  
  it('should handle streaming', async () => {
    const chunks: any[] = [];
    
    provider['streamChat'] = vi.fn().mockImplementation(async (request, callback) => {
      callback({ type: 'content', content: 'Hello', index: 0, finished: false });
      callback({ type: 'content', content: ' World', index: 1, finished: false });
      callback({ type: 'done', index: 2, finished: true });
    });
    
    await provider.streamChat(
      { messages: [], model: 'model-1' },
      (chunk) => chunks.push(chunk)
    );
    
    expect(chunks).toHaveLength(3);
    expect(chunks[0].content).toBe('Hello');
    expect(chunks[2].type).toBe('done');
  });
});
```

**Implementation Steps:**
1. Create base provider class:
   ```typescript
   // src/providers/BaseProvider.ts
   import {
     Provider,
     ProviderConfig,
     ChatRequest,
     ChatResponse,
     StreamCallback,
     StreamChunk,
     ModelInfo,
     ProviderError,
     ErrorCodes
   } from '@/types/providers';
   
   export abstract class BaseProvider implements Provider {
     protected config: ProviderConfig | null = null;
     protected rateLimiter: RateLimiter;
     protected retryManager: RetryManager;
     
     constructor() {
       this.rateLimiter = new RateLimiter();
       this.retryManager = new RetryManager();
     }
     
     get id(): string {
       return this.config?.id || '';
     }
     
     get name(): string {
       return this.config?.name || '';
     }
     
     async configure(config: ProviderConfig): Promise<void> {
       this.config = config;
       
       // Validate configuration
       const isValid = await this.validateConfig();
       if (!isValid) {
         throw new ProviderError(
           'Invalid provider configuration',
           ErrorCodes.INVALID_REQUEST
         );
       }
     }
     
     abstract validateConfig(): Promise<boolean>;
     
     getModels(): ModelInfo[] {
       return this.config?.models || [];
     }
     
     async chat(request: ChatRequest): Promise<ChatResponse> {
       this.ensureConfigured();
       
       // Apply rate limiting
       await this.rateLimiter.waitIfNeeded();
       
       // Retry with exponential backoff
       return this.retryManager.execute(async () => {
         try {
           const response = await this.sendRequest(request);
           return this.parseChatResponse(response);
         } catch (error) {
           throw this.handleError(error);
         }
       });
     }
     
     async streamChat(request: ChatRequest, callback: StreamCallback): Promise<void> {
       this.ensureConfigured();
       
       // Apply rate limiting
       await this.rateLimiter.waitIfNeeded();
       
       return this.retryManager.execute(async () => {
         try {
           await this.sendStreamRequest(request, callback);
         } catch (error) {
           callback({
             type: 'error',
             error: error.message,
             index: 0,
             finished: true
           });
           throw this.handleError(error);
         }
       });
     }
     
     protected ensureConfigured(): void {
       if (!this.config) {
         throw new ProviderError(
           'Provider not configured',
           ErrorCodes.INVALID_REQUEST
         );
       }
     }
     
     protected abstract sendRequest(request: ChatRequest): Promise<any>;
     
     protected async sendStreamRequest(
       request: ChatRequest,
       callback: StreamCallback
     ): Promise<void> {
       const response = await fetch(this.getEndpoint(), {
         method: 'POST',
         headers: this.getHeaders(),
         body: JSON.stringify(this.formatRequest(request)),
       });
       
       if (!response.ok) {
         throw new Error(`HTTP ${response.status}: ${response.statusText}`);
       }
       
       const reader = response.body?.getReader();
       if (!reader) {
         throw new Error('No response body');
       }
       
       const decoder = new TextDecoder();
       let buffer = '';
       let index = 0;
       
       while (true) {
         const { done, value } = await reader.read();
         
         if (done) {
           callback({
             type: 'done',
             index,
             finished: true
           });
           break;
         }
         
         buffer += decoder.decode(value, { stream: true });
         
         // Process complete chunks
         const lines = buffer.split('\n');
         buffer = lines.pop() || '';
         
         for (const line of lines) {
           if (line.trim()) {
             const chunk = this.parseStreamChunk(line);
             if (chunk) {
               callback({
                 ...chunk,
                 index: index++,
                 finished: false
               });
             }
           }
         }
       }
     }
     
     protected abstract parseStreamChunk(data: string): StreamChunk | null;
     
     protected parseChatResponse(response: any): ChatResponse {
       // Default implementation - override in specific providers
       return {
         id: response.id || `${Date.now()}`,
         model: response.model || this.config!.defaultModel,
         choices: response.choices || [],
         usage: response.usage,
         created: response.created || Date.now()
       };
     }
     
     protected formatRequest(request: ChatRequest): any {
       // Default implementation - override in specific providers
       return {
         ...request,
         model: request.model || this.config!.defaultModel,
         ...this.config!.options
       };
     }
     
     protected getEndpoint(): string {
       return this.config!.endpoint || '';
     }
     
     protected getHeaders(): Record<string, string> {
       return {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${this.config!.apiKey}`,
         ...this.config!.headers
       };
     }
     
     protected handleError(error: any): ProviderError {
       if (error instanceof ProviderError) {
         return error;
       }
       
       const message = error?.message || error?.toString() || 'Unknown error';
       
       // Parse common error patterns
       if (message.includes('rate limit')) {
         return new ProviderError(message, ErrorCodes.RATE_LIMIT);
       }
       if (message.includes('401') || message.includes('unauthorized')) {
         return new ProviderError(message, ErrorCodes.INVALID_API_KEY);
       }
       if (message.includes('model')) {
         return new ProviderError(message, ErrorCodes.MODEL_NOT_FOUND);
       }
       if (message.includes('context') || message.includes('token')) {
         return new ProviderError(message, ErrorCodes.CONTEXT_LENGTH_EXCEEDED);
       }
       
       return new ProviderError(message, ErrorCodes.SERVER_ERROR);
     }
     
     countTokens(text: string, model?: string): number {
       // Simple approximation - override in specific providers
       return Math.ceil(text.length / 4);
     }
     
     async getUsage(): Promise<{ used: number; limit: number }> {
       // Default implementation - override if provider supports usage API
       return { used: 0, limit: 0 };
     }
   }
   
   // Rate Limiter
   class RateLimiter {
     private requests: number[] = [];
     private readonly limit = 60; // requests per minute
     private readonly window = 60000; // 1 minute
     
     async waitIfNeeded(): Promise<void> {
       this.cleanup();
       
       if (this.requests.length >= this.limit) {
         const oldestRequest = this.requests[0];
         const waitTime = oldestRequest + this.window - Date.now();
         
         if (waitTime > 0) {
           await new Promise(resolve => setTimeout(resolve, waitTime));
         }
       }
       
       this.addRequest();
     }
     
     addRequest(): void {
       this.requests.push(Date.now());
       this.cleanup();
     }
     
     private cleanup(): void {
       const cutoff = Date.now() - this.window;
       this.requests = this.requests.filter(time => time > cutoff);
     }
   }
   
   // Retry Manager
   class RetryManager {
     private readonly maxRetries = 3;
     private readonly baseDelay = 1000;
     
     async execute<T>(fn: () => Promise<T>): Promise<T> {
       let lastError: any;
       
       for (let attempt = 0; attempt < this.maxRetries; attempt++) {
         try {
           return await fn();
         } catch (error) {
           lastError = error;
           
           // Don't retry certain errors
           if (error instanceof ProviderError) {
             if ([
               ErrorCodes.INVALID_API_KEY,
               ErrorCodes.INVALID_REQUEST,
               ErrorCodes.MODEL_NOT_FOUND
             ].includes(error.code)) {
               throw error;
             }
           }
           
           // Exponential backoff
           if (attempt < this.maxRetries - 1) {
             const delay = this.baseDelay * Math.pow(2, attempt);
             await new Promise(resolve => setTimeout(resolve, delay));
           }
         }
       }
       
       throw lastError;
     }
   }
   ```

**Deliverables:**
- `src/providers/BaseProvider.ts` - Abstract base class
- Rate limiting implementation
- Retry logic with exponential backoff
- Stream handling utilities
- Error handling
- Token counting

**Acceptance Criteria:**
- [ ] Base class provides common functionality
- [ ] Rate limiting works
- [ ] Retry logic handles failures
- [ ] Streaming abstracted properly
- [ ] Tests pass

---

#### Task 4.1.2a - Stream Parser 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 4.1.1a

**Test Requirements:**
```typescript
// tests/providers/streamParser.test.ts
import { describe, it, expect } from 'vitest';
import { 
  SSEParser,
  JSONLParser,
  parseOpenAIStream,
  parseGeminiStream,
  parseAnthropicStream
} from '@/providers/streamParser';

describe('Stream Parser', () => {
  describe('SSE Parser', () => {
    it('should parse SSE events', () => {
      const parser = new SSEParser();
      const events: any[] = [];
      
      parser.onEvent((event) => events.push(event));
      
      parser.feed('data: {"text":"Hello"}\n\n');
      parser.feed('data: {"text":"World"}\n\n');
      parser.feed('data: [DONE]\n\n');
      
      expect(events).toHaveLength(3);
      expect(events[0].text).toBe('Hello');
      expect(events[2]).toBe('[DONE]');
    });
    
    it('should handle partial chunks', () => {
      const parser = new SSEParser();
      const events: any[] = [];
      
      parser.onEvent((event) => events.push(event));
      
      parser.feed('data: {"tex');
      parser.feed('t":"Hello');
      parser.feed('"}\n\n');
      
      expect(events).toHaveLength(1);
      expect(events[0].text).toBe('Hello');
    });
  });
  
  describe('Provider-specific parsers', () => {
    it('should parse OpenAI stream format', () => {
      const chunk = {
        choices: [{
          delta: { content: 'Hello' },
          index: 0,
          finish_reason: null
        }]
      };
      
      const parsed = parseOpenAIStream(JSON.stringify(chunk));
      
      expect(parsed?.type).toBe('content');
      expect(parsed?.content).toBe('Hello');
      expect(parsed?.finished).toBe(false);
    });
    
    it('should parse Gemini stream format', () => {
      const chunk = {
        candidates: [{
          content: {
            parts: [{ text: 'Hello' }]
          }
        }]
      };
      
      const parsed = parseGeminiStream(JSON.stringify(chunk));
      
      expect(parsed?.type).toBe('content');
      expect(parsed?.content).toBe('Hello');
    });
    
    it('should parse Anthropic stream format', () => {
      const chunk = {
        type: 'content_block_delta',
        delta: { text: 'Hello' }
      };
      
      const parsed = parseAnthropicStream(JSON.stringify(chunk));
      
      expect(parsed?.type).toBe('content');
      expect(parsed?.content).toBe('Hello');
    });
  });
});
```

**Implementation Steps:**
1. Create stream parser utilities:
   ```typescript
   // src/providers/streamParser.ts
   import { StreamChunk } from '@/types/providers';

   // Generic SSE Parser
   export class SSEParser {
     private buffer = '';
     private eventHandler: ((data: any) => void) | null = null;
     
     onEvent(handler: (data: any) => void): void {
       this.eventHandler = handler;
     }
     
     feed(chunk: string): void {
       this.buffer += chunk;
       this.processBuffer();
     }
     
     private processBuffer(): void {
       const lines = this.buffer.split('\n');
       this.buffer = lines.pop() || '';
       
       for (let i = 0; i < lines.length; i++) {
         const line = lines[i].trim();
         
         if (line.startsWith('data: ')) {
           const data = line.slice(6);
           
           if (data === '[DONE]') {
             this.eventHandler?.(data);
           } else {
             try {
               const parsed = JSON.parse(data);
               this.eventHandler?.(parsed);
             } catch (error) {
               console.warn('Failed to parse SSE data:', data);
             }
           }
         }
       }
     }
     
     reset(): void {
       this.buffer = '';
     }
   }

   // JSON Lines Parser
   export class JSONLParser {
     private buffer = '';
     private lineHandler: ((data: any) => void) | null = null;
     
     onLine(handler: (data: any) => void): void {
       this.lineHandler = handler;
     }
     
     feed(chunk: string): void {
       this.buffer += chunk;
       this.processBuffer();
     }
     
     private processBuffer(): void {
       const lines = this.buffer.split('\n');
       this.buffer = lines.pop() || '';
       
       for (const line of lines) {
         if (line.trim()) {
           try {
             const parsed = JSON.parse(line);
             this.lineHandler?.(parsed);
           } catch (error) {
             console.warn('Failed to parse JSONL:', line);
           }
         }
       }
     }
     
     reset(): void {
       this.buffer = '';
     }
   }

   // OpenAI Stream Parser
   export function parseOpenAIStream(data: string): StreamChunk | null {
     try {
       const parsed = JSON.parse(data);
       
       if (parsed.choices && parsed.choices[0]) {
         const choice = parsed.choices[0];
         const delta = choice.delta;
         
         if (delta?.content) {
           return {
             type: 'content',
             content: delta.content,
             index: choice.index || 0,
             finished: choice.finish_reason !== null
           };
         }
         
         if (delta?.function_call) {
           return {
             type: 'function_call',
             functionCall: {
               name: delta.function_call.name,
               arguments: delta.function_call.arguments
             },
             index: choice.index || 0,
             finished: choice.finish_reason !== null
           };
         }
         
         if (choice.finish_reason) {
           return {
             type: 'done',
             index: choice.index || 0,
             finished: true,
             usage: parsed.usage
           };
         }
       }
     } catch (error) {
       console.error('Failed to parse OpenAI stream:', error);
     }
     
     return null;
   }

   // Gemini Stream Parser
   export function parseGeminiStream(data: string): StreamChunk | null {
     try {
       const parsed = JSON.parse(data);
       
       if (parsed.candidates && parsed.candidates[0]) {
         const candidate = parsed.candidates[0];
         
         if (candidate.content?.parts) {
           const text = candidate.content.parts
             .map((part: any) => part.text || '')
             .join('');
           
           if (text) {
             return {
               type: 'content',
               content: text,
               index: candidate.index || 0,
               finished: candidate.finishReason !== undefined
             };
           }
         }
         
         if (candidate.finishReason) {
           return {
             type: 'done',
             index: candidate.index || 0,
             finished: true,
             usage: parsed.usageMetadata
           };
         }
       }
     } catch (error) {
       console.error('Failed to parse Gemini stream:', error);
     }
     
     return null;
   }

   // Anthropic Stream Parser
   export function parseAnthropicStream(data: string): StreamChunk | null {
     try {
       const parsed = JSON.parse(data);
       
       switch (parsed.type) {
         case 'content_block_delta':
           if (parsed.delta?.text) {
             return {
               type: 'content',
               content: parsed.delta.text,
               index: parsed.index || 0,
               finished: false
             };
           }
           break;
           
         case 'content_block_stop':
           return {
             type: 'done',
             index: parsed.index || 0,
             finished: true
           };
           
         case 'message_stop':
           return {
             type: 'done',
             index: 0,
             finished: true,
             usage: parsed.usage
           };
           
         case 'error':
           return {
             type: 'error',
             error: parsed.error.message,
             index: 0,
             finished: true
           };
       }
     } catch (error) {
       console.error('Failed to parse Anthropic stream:', error);
     }
     
     return null;
   }

   // Unified Stream Parser
   export class UnifiedStreamParser {
     private parser: SSEParser | JSONLParser;
     private provider: 'openai' | 'gemini' | 'anthropic';
     
     constructor(provider: 'openai' | 'gemini' | 'anthropic') {
       this.provider = provider;
       this.parser = provider === 'anthropic' ? new JSONLParser() : new SSEParser();
     }
     
     onChunk(handler: (chunk: StreamChunk) => void): void {
       const parseFunction = 
         this.provider === 'openai' ? parseOpenAIStream :
         this.provider === 'gemini' ? parseGeminiStream :
         parseAnthropicStream;
       
       if (this.parser instanceof SSEParser) {
         this.parser.onEvent((data) => {
           if (data === '[DONE]') {
             handler({
               type: 'done',
               index: 0,
               finished: true
             });
           } else {
             const chunk = parseFunction(JSON.stringify(data));
             if (chunk) handler(chunk);
           }
         });
       } else {
         (this.parser as JSONLParser).onLine((data) => {
           const chunk = parseFunction(JSON.stringify(data));
           if (chunk) handler(chunk);
         });
       }
     }
     
     feed(data: string): void {
       this.parser.feed(data);
     }
     
     reset(): void {
       this.parser.reset();
     }
   }
   ```

**Deliverables:**
- `src/providers/streamParser.ts` - Stream parsing utilities
- SSE parser for Server-Sent Events
- JSONL parser for JSON Lines
- Provider-specific parsers
- Unified stream parser

**Acceptance Criteria:**
- [ ] SSE parsing works correctly
- [ ] Handles partial chunks
- [ ] Provider formats parsed
- [ ] Error handling robust
- [ ] Tests pass

---

Continue with Phase 4.2 (Provider Implementations) and Phase 4.3 (Provider Management)...

[Note: This is a partial file. The complete task-stage-4.md would include all 22 tasks with similar detail.]

---

## Stage 4 Completion Checklist

### Testing Requirements
- [ ] All provider tests written and passing
- [ ] Test coverage > 95% for Stage 4 code
- [ ] Integration tests with mock API responses
- [ ] Streaming tests with various chunk patterns
- [ ] Rate limiting tests

### Documentation
- [ ] Provider API documentation
- [ ] Model configuration guide
- [ ] Error handling documentation
- [ ] Streaming implementation notes

### Quality Gates
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] API key validation working
- [ ] Rate limiting functional
- [ ] Code reviewed

### Deliverables Verification
- [ ] OpenAI provider working
- [ ] Gemini provider working
- [ ] Anthropic provider working
- [ ] Streaming functional
- [ ] Rate limiting active
- [ ] Provider UI complete
- [ ] Chat integration working

## Next Stage Prerequisites
Before moving to Stage 5 (Tab Content Extraction), ensure:
1. ✅ All Stage 4 tasks complete
2. ✅ All providers tested
3. ✅ Streaming working smoothly
4. ✅ Rate limiting functional
5. ✅ Full AI chat operational

---

*Stage 4 Task Guide Version: 1.0*
*Total Tasks: 22*
*Estimated Duration: 2 weeks*
*Dependencies: Stages 1-3 complete*