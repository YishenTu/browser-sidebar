/**
 * @file Integration Tests - Provider Streaming with Injected Content
 *
 * Integration tests to verify that both OpenAI and Gemini providers properly handle
 * messages with injected content from tab extraction. Tests streaming capabilities,
 * large content handling, conversation history preservation, and performance overhead.
 *
 * Task 5.2 from Phase 5: Testing & Validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '@provider/openai/OpenAIProvider';
import { GeminiProvider } from '@provider/gemini/GeminiProvider';
import type {
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  OpenAIConfig,
  GeminiConfig,
} from '@types/providers';
import type { ExtractedContent } from '@types/extraction';

// ============================================================================
// Test Fixtures and Utilities
// ============================================================================

/**
 * Mock extracted content that would come from tab injection
 */
const mockExtractedContent: ExtractedContent = {
  title: 'Advanced JavaScript Performance Optimization Techniques',
  url: 'https://example.com/js-performance',
  domain: 'example.com',
  content: `# Advanced JavaScript Performance Optimization Techniques

JavaScript performance optimization is crucial for modern web applications. Here are the most effective techniques:

## 1. DOM Manipulation Optimization

Direct DOM manipulation is expensive. Use these patterns:

\`\`\`javascript
// Inefficient - multiple DOM touches
for (let i = 0; i < items.length; i++) {
  document.getElementById('list').innerHTML += items[i];
}

// Efficient - batch DOM updates
const list = document.getElementById('list');
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item;
  fragment.appendChild(li);
});
list.appendChild(fragment);
\`\`\`

## 2. Memory Management

Prevent memory leaks by:
- Cleaning up event listeners
- Avoiding global variables
- Using WeakMap for object associations

## 3. Bundle Optimization

| Strategy | Impact | Implementation |
|----------|---------|----------------|
| Tree Shaking | 30-50% size reduction | ES6 modules |
| Code Splitting | Faster initial load | Dynamic imports |
| Minification | 20-30% size reduction | Build tools |

These techniques can dramatically improve your application performance.`,
  textContent: 'Advanced JavaScript Performance Optimization Techniques JavaScript performance optimization is crucial for modern web applications...',
  excerpt: 'JavaScript performance optimization is crucial for modern web applications. Here are the most effective techniques for DOM manipulation...',
  author: 'Performance Expert',
  publishedDate: '2024-08-27',
  extractedAt: Date.now(),
  extractionMethod: 'readability',
  metadata: {
    wordCount: 156,
    hasCodeBlocks: true,
    hasTables: true,
    truncated: false,
  },
};

/**
 * Generate large content for stress testing (200K characters)
 */
function generateLargeContent(): ExtractedContent {
  // Generate more content to ensure we exceed 200K characters
  const baseText = `
## Section: Performance Optimization Technique

This section discusses advanced performance optimization techniques in great detail. 
Performance is absolutely critical for user experience and business success in modern web applications.
We need to consider multiple factors including DOM manipulation, memory management, bundle optimization,
network requests, caching strategies, lazy loading, code splitting, tree shaking, minification,
compression, and many other aspects of web performance optimization.

### Subsection A: Implementation Details

Here are the comprehensive and detailed implementation steps for this optimization technique:

1. First, we need to thoroughly analyze the current performance bottlenecks using profiling tools
2. Identify and document all root causes of performance issues across the application
3. Design and implement a comprehensive optimization strategy with multiple phases
4. Carefully measure the performance improvements using various metrics and benchmarks
5. Set up continuous monitoring systems to detect and prevent regressions over time
6. Document all changes and create guidelines for future development
7. Train team members on performance best practices and optimization techniques
8. Establish performance budgets and automated testing to maintain standards

\`\`\`javascript
// Comprehensive example code for performance optimization
function optimizeApplicationPerformance() {
  const startTime = performance.now();
  
  // Phase 1: DOM optimization implementation
  const domData = processAndOptimizeDOMOperations();
  const domResult = applyDOMOptimization(domData);
  
  // Phase 2: Memory management optimization
  const memoryData = analyzeMemoryUsagePatterns();
  const memoryResult = implementMemoryOptimizations(memoryData);
  
  // Phase 3: Bundle and asset optimization
  const bundleData = analyzeBundleSize();
  const bundleResult = optimizeBundleAndAssets(bundleData);
  
  // Phase 4: Network optimization
  const networkData = analyzeNetworkPerformance();
  const networkResult = optimizeNetworkRequests(networkData);
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(\`Comprehensive optimization completed in \${totalTime} milliseconds\`);
  console.log(\`DOM optimization: \${domResult.improvement}% improvement\`);
  console.log(\`Memory optimization: \${memoryResult.improvement}% improvement\`);
  console.log(\`Bundle optimization: \${bundleResult.improvement}% improvement\`);
  console.log(\`Network optimization: \${networkResult.improvement}% improvement\`);
  
  return {
    totalTime,
    domResult,
    memoryResult,
    bundleResult,
    networkResult,
    overallImprovement: (domResult.improvement + memoryResult.improvement + bundleResult.improvement + networkResult.improvement) / 4
  };
}

function processAndOptimizeDOMOperations() {
  // Comprehensive DOM processing simulation
  const elements = Array.from({ length: 10000 }, (_, index) => ({
    id: \`element-\${index}\`,
    type: ['div', 'span', 'p', 'section', 'article'][index % 5],
    content: \`Content for element \${index} with detailed information\`,
    attributes: {
      class: \`class-\${index}\`,
      'data-index': index,
      'data-optimized': false
    },
    children: Array.from({ length: Math.floor(Math.random() * 5) }, (_, childIndex) => ({
      id: \`child-\${index}-\${childIndex}\`,
      content: \`Child content \${childIndex} for parent \${index}\`
    }))
  }));
  
  return elements.map(element => ({
    ...element,
    optimized: true,
    performance: {
      renderTime: Math.random() * 10 + 1,
      memoryUsage: Math.random() * 100 + 50
    }
  }));
}

function applyDOMOptimization(data) {
  // Apply comprehensive DOM optimization techniques
  return data.map(item => ({
    ...item,
    processed: true,
    optimized: true,
    improvement: Math.random() * 50 + 25
  }));
}

function analyzeMemoryUsagePatterns() {
  // Comprehensive memory analysis
  return {
    heapUsage: Math.random() * 100 + 50,
    eventListeners: Math.random() * 1000 + 500,
    domNodes: Math.random() * 5000 + 2500,
    detachedNodes: Math.random() * 100 + 25
  };
}

function implementMemoryOptimizations(data) {
  return {
    ...data,
    improvement: Math.random() * 40 + 30,
    optimized: true
  };
}

function analyzeBundleSize() {
  return {
    totalSize: Math.random() * 1000 + 500,
    unusedCode: Math.random() * 200 + 100,
    duplicateModules: Math.random() * 50 + 25
  };
}

function optimizeBundleAndAssets(data) {
  return {
    ...data,
    improvement: Math.random() * 60 + 40,
    optimized: true
  };
}

function analyzeNetworkPerformance() {
  return {
    totalRequests: Math.random() * 100 + 50,
    totalSize: Math.random() * 2000 + 1000,
    cacheHitRate: Math.random() * 0.5 + 0.3
  };
}

function optimizeNetworkRequests(data) {
  return {
    ...data,
    improvement: Math.random() * 45 + 35,
    optimized: true
  };
}
\`\`\`

### Comprehensive Performance Results Analysis Table

| Metric | Before Optimization | After Optimization | Improvement Percentage |
|--------|---------------------|-------------------|------------------------|
| Load Time | ${(Math.random() * 1000 + 500).toFixed(0)}ms | ${(Math.random() * 500 + 100).toFixed(0)}ms | ${(Math.random() * 50 + 30).toFixed(0)}% |
| Memory Usage | ${(Math.random() * 100 + 50).toFixed(1)}MB | ${(Math.random() * 50 + 20).toFixed(1)}MB | ${(Math.random() * 40 + 20).toFixed(0)}% |
| Bundle Size | ${(Math.random() * 500 + 200).toFixed(0)}KB | ${(Math.random() * 300 + 100).toFixed(0)}KB | ${(Math.random() * 30 + 15).toFixed(0)}% |
| First Contentful Paint | ${(Math.random() * 2000 + 1000).toFixed(0)}ms | ${(Math.random() * 1000 + 500).toFixed(0)}ms | ${(Math.random() * 45 + 25).toFixed(0)}% |
| Largest Contentful Paint | ${(Math.random() * 3000 + 2000).toFixed(0)}ms | ${(Math.random() * 1500 + 1000).toFixed(0)}ms | ${(Math.random() * 40 + 30).toFixed(0)}% |
| Cumulative Layout Shift | ${(Math.random() * 0.5 + 0.1).toFixed(3)} | ${(Math.random() * 0.1 + 0.01).toFixed(3)} | ${(Math.random() * 80 + 70).toFixed(0)}% |

This comprehensive optimization technique demonstrates significant improvements across all key performance metrics and provides a solid foundation for maintaining excellent application performance.
`;

  // Repeat the content multiple times to ensure we exceed 200K characters
  const sections = Array.from({ length: 150 }, () => baseText).join('\n');
  const content = `# Comprehensive JavaScript Performance Guide\n\n${sections}`;
  
  return {
    ...mockExtractedContent,
    title: 'Comprehensive JavaScript Performance Guide - 200K Characters',
    content,
    textContent: content.replace(/[#*`|]/g, ''),
    metadata: {
      wordCount: content.split(/\s+/).length,
      hasCodeBlocks: true,
      hasTables: true,
      truncated: false,
    },
  };
}

/**
 * Create a message with injected content
 */
function createMessageWithInjectedContent(
  userQuery: string,
  extractedContent: ExtractedContent,
  includeFullContext = true
): ProviderChatMessage[] {
  const contextInfo = includeFullContext ? 
    `Context from web page "${extractedContent.title}" (${extractedContent.url}):\n\n${extractedContent.content}\n\n---\n\n` :
    `Context from web page "${extractedContent.title}": ${extractedContent.excerpt}\n\n---\n\n`;

  return [
    {
      id: 'msg-system',
      role: 'system',
      content: 'You are a helpful AI assistant. When provided with web page content, analyze it to answer user questions accurately.',
      timestamp: new Date(),
    },
    {
      id: 'msg-user',
      role: 'user', 
      content: `${contextInfo}${userQuery}`,
      timestamp: new Date(),
    },
  ];
}

/**
 * Mock provider configurations
 */
const mockOpenAIConfig: ProviderConfig = {
  type: 'openai',
  config: {
    apiKey: 'sk-test-key-openai-123456789abcdef',
    model: 'gpt-5-nano',
    reasoningEffort: 'medium',
  } as OpenAIConfig,
};

const mockGeminiConfig: ProviderConfig = {
  type: 'gemini',
  config: {
    apiKey: 'test-gemini-api-key-123456789abcdef',
    model: 'gemini-2.5-flash',
    thinkingBudget: '-1',
    showThoughts: true,
  } as GeminiConfig,
};

// ============================================================================
// Test Setup
// ============================================================================

describe('Provider Streaming with Injected Content - Integration Tests', () => {
  let openaiProvider: OpenAIProvider;
  let geminiProvider: GeminiProvider;
  let mockOpenAIInstance: any;
  let mockFetch: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Initialize providers
    openaiProvider = new OpenAIProvider();
    geminiProvider = new GeminiProvider();

    // Mock OpenAI instance
    mockOpenAIInstance = {
      responses: {
        create: vi.fn(),
      },
    };

    // Mock OpenAI client initialization
    const openaiClient = (openaiProvider as any).openaiClient;
    vi.spyOn(openaiClient, 'initialize').mockResolvedValue(undefined);
    vi.spyOn(openaiClient, 'getOpenAIInstance').mockReturnValue(mockOpenAIInstance);
    vi.spyOn(openaiClient, 'testConnection').mockResolvedValue(true);

    // Mock fetch for Gemini
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Initialize providers with test configs
    await openaiProvider.initialize(mockOpenAIConfig);
    await geminiProvider.initialize(mockGeminiConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // OpenAI Provider Tests
  // ============================================================================

  describe('OpenAI Provider with Injected Content', () => {
    it('should handle streaming with small injected content', async () => {
      const userQuery = 'What are the main performance optimization techniques mentioned?';
      const messages = createMessageWithInjectedContent(userQuery, mockExtractedContent);

      // Mock streaming response events (OpenAI Responses API format)
      const mockStreamEvents = [
        {
          type: 'response.output_text.delta',
          delta: 'Based on the content provided, there are three main performance optimization techniques:',
          response: { id: 'resp-123' },
        },
        {
          type: 'response.output_text.delta',
          delta: '\n\n1. **DOM Manipulation Optimization**',
          response: { id: 'resp-123' },
        },
        {
          type: 'response.output_text.delta',
          delta: '\n2. **Memory Management**',
          response: { id: 'resp-123' },
        },
        {
          type: 'response.output_text.delta',
          delta: '\n3. **Bundle Optimization**',
          response: { id: 'resp-123' },
        },
        {
          type: 'response.done',
          response: { id: 'resp-123', finish_reason: 'stop' },
        },
      ];

      async function* mockStreamGenerator() {
        for (const event of mockStreamEvents) {
          yield event;
        }
      }

      mockOpenAIInstance.responses.create.mockResolvedValue(mockStreamGenerator());

      const startTime = performance.now();
      const chunks: StreamChunk[] = [];
      
      for await (const chunk of openaiProvider.streamChat(messages)) {
        chunks.push(chunk);
      }

      const endTime = performance.now();
      const overhead = endTime - startTime;

      // Verify streaming worked
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('choices');
      expect(chunks[0].choices[0]).toHaveProperty('delta');

      // Verify content handling
      const fullContent = chunks
        .map(chunk => chunk.choices[0]?.delta?.content || '')
        .join('');
      expect(fullContent).toContain('DOM Manipulation Optimization');
      expect(fullContent).toContain('Memory Management');
      expect(fullContent).toContain('Bundle Optimization');

      // Verify performance overhead is reasonable (should be minimal for test)
      expect(overhead).toBeLessThan(1000); // 1 second max for test environment

      // Verify the request included injected content
      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Context from web page'),
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('should handle non-streaming requests with injected content', async () => {
      const userQuery = 'Summarize the key points about JavaScript performance';
      const messages = createMessageWithInjectedContent(userQuery, mockExtractedContent);

      const mockResponse = {
        id: 'resp-456',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5-nano',
        output_text: 'The key JavaScript performance techniques include: 1) DOM manipulation optimization using document fragments, 2) Memory management through proper cleanup, and 3) Bundle optimization via tree shaking and code splitting.',
        finish_reason: 'stop',
        usage: {
          input_tokens: 250, // Increased due to injected content
          output_tokens: 45,
          total_tokens: 295,
        },
      };

      mockOpenAIInstance.responses.create.mockResolvedValue(mockResponse);

      const startTime = performance.now();
      const response = await openaiProvider.chat(messages);
      const endTime = performance.now();
      const overhead = endTime - startTime;

      expect(response).toBeDefined();
      expect(response.content).toContain('JavaScript performance techniques');
      expect(response.usage.promptTokens).toBeGreaterThan(200); // Should include injected content tokens
      
      // Verify performance overhead
      expect(overhead).toBeLessThan(100); // Should be under 100ms overhead
    });

    it('should handle large injected content (200K characters)', async () => {
      const largeContent = generateLargeContent();
      const userQuery = 'What is the overall theme of this performance guide?';
      const messages = createMessageWithInjectedContent(userQuery, largeContent);

      // Verify content is actually large
      expect(largeContent.content.length).toBeGreaterThan(200000);

      const mockResponse = {
        id: 'resp-large',
        object: 'response', 
        created: Date.now(),
        model: 'gpt-5-nano',
        output_text: 'This comprehensive guide focuses on JavaScript performance optimization techniques, covering 100 different strategies including DOM manipulation, memory management, and bundle optimization.',
        finish_reason: 'stop',
        usage: {
          input_tokens: 50000, // Large number due to injected content
          output_tokens: 30,
          total_tokens: 50030,
        },
      };

      mockOpenAIInstance.responses.create.mockResolvedValue(mockResponse);

      const startTime = performance.now();
      const response = await openaiProvider.chat(messages);
      const endTime = performance.now();
      const overhead = endTime - startTime;

      expect(response).toBeDefined();
      expect(response.content).toContain('performance optimization');
      expect(response.usage.promptTokens).toBeGreaterThan(10000); // Should reflect large content

      // Verify the provider can handle large content without errors
      expect(response.finishReason).toBe('stop');
      
      // Performance should still be reasonable
      expect(overhead).toBeLessThan(100); // 100ms overhead max
    });
  });

  // ============================================================================
  // Gemini Provider Tests
  // ============================================================================

  describe('Gemini Provider with Injected Content', () => {
    it('should handle streaming with injected content', async () => {
      const userQuery = 'Explain the DOM optimization techniques in detail';
      const messages = createMessageWithInjectedContent(userQuery, mockExtractedContent);

      // Mock Gemini streaming response
      const mockStreamData = [
        { candidates: [{ content: { parts: [{ text: 'Based on the provided content, DOM optimization involves' }] } }] },
        { candidates: [{ content: { parts: [{ text: ' using document fragments to batch DOM updates.' }] } }] },
        { candidates: [{ content: { parts: [{ text: ' This approach significantly reduces browser reflow and repaint operations.' }] }, finishReason: 'STOP' }] },
      ];

      // Convert to streaming format
      const streamChunks = mockStreamData
        .map(data => `data: ${JSON.stringify(data)}\n\n`)
        .join('');

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamChunks) })
              .mockResolvedValueOnce({ done: true, value: null }),
            releaseLock: vi.fn(),
          }),
        },
      };

      mockFetch.mockResolvedValue(mockResponse);

      const startTime = performance.now();
      const chunks: StreamChunk[] = [];

      for await (const chunk of geminiProvider.streamChat(messages)) {
        chunks.push(chunk);
      }

      const endTime = performance.now();
      const overhead = endTime - startTime;

      expect(chunks.length).toBeGreaterThan(0);
      
      const fullContent = chunks
        .map(chunk => chunk.choices[0]?.delta?.content || '')
        .join('');
      expect(fullContent).toContain('DOM optimization');
      expect(fullContent).toContain('document fragments');

      // Verify performance
      expect(overhead).toBeLessThan(100); // 100ms overhead max

      // Verify fetch was called with injected content
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Context from web page'),
        })
      );
    });

    it('should handle non-streaming requests with injected content', async () => {
      const userQuery = 'What memory management techniques are mentioned?';
      const messages = createMessageWithInjectedContent(userQuery, mockExtractedContent);

      const mockResponseData = {
        candidates: [{
          content: {
            parts: [{ text: 'The content mentions three key memory management techniques: cleaning up event listeners, avoiding global variables, and using WeakMap for object associations.' }]
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 220,
          candidatesTokenCount: 25,
          totalTokenCount: 245,
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponseData),
      });

      const startTime = performance.now();
      const response = await geminiProvider.chat(messages);
      const endTime = performance.now();
      const overhead = endTime - startTime;

      expect(response).toBeDefined();
      expect(response.content).toContain('memory management techniques');
      expect(response.usage.promptTokens).toBeGreaterThan(200); // Should include injected content

      // Verify performance
      expect(overhead).toBeLessThan(100);
    });

    it('should handle large injected content with Gemini', async () => {
      const largeContent = generateLargeContent();
      const userQuery = 'Give me a brief overview of this guide';
      const messages = createMessageWithInjectedContent(userQuery, largeContent);

      const mockResponseData = {
        candidates: [{
          content: {
            parts: [{ text: 'This is a comprehensive JavaScript performance guide covering 100 different optimization techniques across DOM manipulation, memory management, and bundle optimization strategies.' }]
          },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 45000,
          candidatesTokenCount: 30,
          totalTokenCount: 45030,
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponseData),
      });

      const startTime = performance.now();
      const response = await geminiProvider.chat(messages);
      const endTime = performance.now();
      const overhead = endTime - startTime;

      expect(response).toBeDefined();
      expect(response.content).toContain('comprehensive');
      expect(response.usage.promptTokens).toBeGreaterThan(10000);

      // Even with large content, overhead should be reasonable
      expect(overhead).toBeLessThan(100);
    });
  });

  // ============================================================================
  // Conversation History Tests
  // ============================================================================

  describe('Conversation History Preservation', () => {
    it('should maintain conversation history with injected content - OpenAI', async () => {
      const initialQuery = 'What performance techniques are mentioned?';
      const followupQuery = 'Can you elaborate on the DOM technique?';
      
      // First message with injected content
      const initialMessages = createMessageWithInjectedContent(initialQuery, mockExtractedContent);
      
      const mockInitialResponse = {
        id: 'resp-1',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5-nano',
        output_text: 'The content mentions three main techniques: DOM manipulation optimization, memory management, and bundle optimization.',
        finish_reason: 'stop',
        usage: { input_tokens: 200, output_tokens: 20, total_tokens: 220 },
      };

      mockOpenAIInstance.responses.create.mockResolvedValueOnce(mockInitialResponse);

      const initialResponse = await openaiProvider.chat(initialMessages);

      // Follow-up message (should include conversation history)
      const followupMessages = [
        ...initialMessages,
        {
          id: 'msg-assistant-1',
          role: 'assistant' as const,
          content: initialResponse.content,
          timestamp: new Date(),
        },
        {
          id: 'msg-user-2', 
          role: 'user' as const,
          content: followupQuery,
          timestamp: new Date(),
        },
      ];

      const mockFollowupResponse = {
        id: 'resp-2',
        object: 'response',
        created: Date.now(),
        model: 'gpt-5-nano',
        output_text: 'DOM optimization involves using document fragments to batch DOM updates, avoiding multiple reflows and repaints.',
        finish_reason: 'stop',
        usage: { input_tokens: 250, output_tokens: 25, total_tokens: 275 },
      };

      mockOpenAIInstance.responses.create.mockResolvedValueOnce(mockFollowupResponse);

      const followupResponse = await openaiProvider.chat(followupMessages);

      expect(followupResponse).toBeDefined();
      expect(followupResponse.content).toContain('document fragments');

      // Verify both requests were made with proper history
      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledTimes(2);
      
      // Second call should include the assistant's previous response in the input array
      const secondCallArgs = mockOpenAIInstance.responses.create.mock.calls[1][0];
      expect(Array.isArray(secondCallArgs.input)).toBe(true);
      expect(secondCallArgs.input.length).toBeGreaterThan(2); // Should have multiple messages
      
      // Should contain the injected content and conversation history
      const inputContent = secondCallArgs.input.map((msg: any) => msg.content).join(' ');
      expect(inputContent).toContain('Context from web page');
    });

    it('should maintain conversation history with injected content - Gemini', async () => {
      const initialQuery = 'What are the bundle optimization strategies?';
      const followupQuery = 'How much size reduction can I expect?';
      
      const initialMessages = createMessageWithInjectedContent(initialQuery, mockExtractedContent);

      // Mock initial response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ text: 'The bundle optimization strategies include tree shaking, code splitting, and minification as shown in the table.' }]
            },
            finishReason: 'STOP'
          }],
          usageMetadata: { promptTokenCount: 180, candidatesTokenCount: 18, totalTokenCount: 198 }
        })
      });

      const initialResponse = await geminiProvider.chat(initialMessages);

      // Follow-up with conversation history
      const followupMessages = [
        ...initialMessages,
        {
          id: 'msg-assistant-1',
          role: 'assistant' as const,
          content: initialResponse.content,
          timestamp: new Date(),
        },
        {
          id: 'msg-user-2',
          role: 'user' as const, 
          content: followupQuery,
          timestamp: new Date(),
        },
      ];

      // Mock follow-up response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ text: 'According to the performance table, you can expect 30-50% size reduction with tree shaking, and 20-30% with minification.' }]
            },
            finishReason: 'STOP'
          }],
          usageMetadata: { promptTokenCount: 220, candidatesTokenCount: 22, totalTokenCount: 242 }
        })
      });

      const followupResponse = await geminiProvider.chat(followupMessages);

      expect(followupResponse).toBeDefined();
      expect(followupResponse.content).toContain('30-50%');
      expect(followupResponse.content).toContain('tree shaking');

      // Verify conversation history was preserved
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const secondRequestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondRequestBody.contents).toHaveLength(4); // system + user + assistant + user
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance Overhead Tests', () => {
    it('should measure streaming overhead with injected content', async () => {
      const messages = createMessageWithInjectedContent(
        'Analyze this content',
        mockExtractedContent
      );

      // Baseline - measure without injected content
      const baselineMessages: ProviderChatMessage[] = [{
        id: 'msg-baseline',
        role: 'user',
        content: 'Analyze this simple query',
        timestamp: new Date(),
      }];

      // Mock responses for both scenarios
      async function* mockStream() {
        yield {
          type: 'response.output_text.delta',
          delta: 'Response',
          response: { id: 'test-resp' },
        };
        yield {
          type: 'response.done',
          response: { id: 'test-resp', finish_reason: 'stop' },
        };
      }

      mockOpenAIInstance.responses.create.mockResolvedValue(mockStream());

      // Measure baseline
      const baselineStart = performance.now();
      const baselineChunks = [];
      for await (const chunk of openaiProvider.streamChat(baselineMessages)) {
        baselineChunks.push(chunk);
      }
      const baselineTime = performance.now() - baselineStart;

      // Reset mock for second call
      mockOpenAIInstance.responses.create.mockResolvedValue(mockStream());

      // Measure with injected content
      const injectedStart = performance.now();
      const injectedChunks = [];
      for await (const chunk of openaiProvider.streamChat(messages)) {
        injectedChunks.push(chunk);
      }
      const injectedTime = performance.now() - injectedStart;

      // Calculate overhead
      const overhead = injectedTime - baselineTime;

      expect(baselineChunks.length).toBeGreaterThan(0);
      expect(injectedChunks.length).toBeGreaterThan(0);
      
      // Overhead should be minimal (under 100ms as specified)
      expect(Math.abs(overhead)).toBeLessThan(100);
      
      // In test environment, overhead should be very minimal
      expect(Math.abs(overhead)).toBeLessThan(50); // Even more strict for tests
    });

    it('should handle concurrent requests with injected content efficiently', async () => {
      const messages1 = createMessageWithInjectedContent('Query 1', mockExtractedContent);
      const messages2 = createMessageWithInjectedContent('Query 2', mockExtractedContent);
      const messages3 = createMessageWithInjectedContent('Query 3', mockExtractedContent);

      // Mock responses
      mockOpenAIInstance.responses.create.mockImplementation(() => 
        Promise.resolve({
          id: 'concurrent-test',
          output_text: 'Concurrent response',
          finish_reason: 'stop',
          usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 },
        })
      );

      const startTime = performance.now();
      
      // Run concurrent requests
      const responses = await Promise.all([
        openaiProvider.chat(messages1),
        openaiProvider.chat(messages2),
        openaiProvider.chat(messages3),
      ]);

      const totalTime = performance.now() - startTime;

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.content).toBe('Concurrent response');
      });

      // Total time for 3 concurrent requests should still be reasonable
      expect(totalTime).toBeLessThan(300); // 300ms max for 3 concurrent requests
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling with Injected Content', () => {
    it('should handle API errors gracefully with large injected content', async () => {
      const largeContent = generateLargeContent();
      const messages = createMessageWithInjectedContent('Process this', largeContent);

      // Mock API error
      mockOpenAIInstance.responses.create.mockRejectedValue({
        error: {
          message: 'Request too large',
          type: 'invalid_request_error',
          code: 'request_too_large',
        },
        status: 400,
      });

      await expect(openaiProvider.chat(messages)).rejects.toThrow();
    });

    it('should handle network errors during streaming with injected content', async () => {
      const messages = createMessageWithInjectedContent('Test query', mockExtractedContent);

      // Mock network error during streaming
      async function* errorStream() {
        yield {
          type: 'response.output_text.delta',
          delta: 'Starting...',
          response: { id: 'error-test' },
        };
        throw new Error('Network error during streaming');
      }

      mockOpenAIInstance.responses.create.mockResolvedValue(errorStream());

      const stream = openaiProvider.streamChat(messages);
      const chunks = [];
      
      try {
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network error');
      }

      expect(chunks.length).toBeGreaterThanOrEqual(1); // Should get at least the first chunk
    });
  });

  // ============================================================================
  // Content Truncation Tests  
  // ============================================================================

  describe('Content Truncation Handling', () => {
    it('should handle truncated injected content gracefully', async () => {
      const truncatedContent: ExtractedContent = {
        ...mockExtractedContent,
        content: mockExtractedContent.content.substring(0, 1000) + '... [content truncated]',
        metadata: {
          ...mockExtractedContent.metadata!,
          truncated: true,
        },
      };

      const messages = createMessageWithInjectedContent(
        'Summarize the key points',
        truncatedContent
      );

      mockOpenAIInstance.responses.create.mockResolvedValue({
        id: 'truncated-test',
        output_text: 'Based on the provided content (note: content appears to be truncated), the main topics covered include JavaScript performance optimization techniques.',
        finish_reason: 'stop',
        usage: { input_tokens: 150, output_tokens: 25, total_tokens: 175 },
      });

      const response = await openaiProvider.chat(messages);

      expect(response).toBeDefined();
      expect(response.content).toContain('performance optimization');
      
      // Should handle truncated content without errors
      expect(response.finishReason).toBe('stop');
    });
  });
});