# OpenAI Responses API - Full Request Example

This document shows a complete example of an OpenAI Responses API request with all features implemented in the browser sidebar extension.

## Full Request Structure

```javascript
{
  // Model selection - supports GPT-5 series and O-series models
  "model": "gpt-5",  // Options: "gpt-5-nano", "gpt-5-mini", "gpt-5", "o3", etc.
  
  // System prompt via instructions field (from src/config/systemPrompt.ts)
  "instructions": "You are an AI assistant integrated into a privacy-focused browser extension that helps users interact with web content. You operate through a resizable, draggable sidebar interface that appears on any webpage when activated. Your primary purpose is to analyze, summarize, explain, and answer questions about web content while maintaining complete user privacy.\n\n## Core Capabilities\n\nYou receive web page content in structured format:\n- **Single Tab**: Automatically loaded current tab content\n- **Multi-Tab**: Additional tabs added via @ mention system\n- **Selected Text**: Marked with special HTML comments (SEL_START/SEL_END)\n\n## Response Guidelines\n\n### Content Analysis\n- Provide accurate, contextual responses based on the provided web content\n- When multiple tabs are loaded, clearly indicate which source you're referencing\n- Acknowledge when information is outside the provided content scope\n- Maintain source attribution when synthesizing information from multiple tabs\n\n### Formatting\n- Use markdown for clear, structured responses\n- Include code blocks with syntax highlighting when relevant\n- Create tables for comparative or structured information\n- Use bullet points and numbered lists for clarity\n\n### Tone and Style\n- Be concise and direct while remaining helpful\n- Adapt formality based on content type\n- Provide step-by-step explanations for complex topics\n- Offer follow-up suggestions when appropriate\n\n## Privacy Principles\n- Never log or store user queries externally\n- All content extraction happens locally in the browser\n- Respect restricted domains (banking, healthcare, government)\n- Handle sensitive information with appropriate warnings\n\n## Special Instructions\n\nWhen dealing with multiple sources:\n- Synthesize information coherently\n- Cite specific sources when making claims\n- Highlight agreements and contradictions\n- Suggest authoritative sources for specific topics\n\nWhen content is truncated:\n- Work with available content efficiently\n- Suggest specific sections for reloading if needed\n\nWhen dealing with code:\n- Analyze structure and patterns\n- Explain functionality in plain language\n- Identify potential issues or improvements\n- Respect existing code style\n\n## Limitations\n- Cannot access content behind authentication\n- Cannot execute JavaScript or interact with page elements\n- Cannot access cross-origin iframes\n- Cannot browse beyond provided tab content\n- Each sidebar session is independent\n\nRemember: You are a helpful, private, and efficient assistant that empowers users to better understand and work with web content while maintaining complete privacy and control.",
  
  // User input with multi-tab content (formatted by formatMultiTabContent)
  "input": [
    {
      "role": "user",
      "content": "<user_message>\nSummarize the key points from these articles\n</user_message>\n\n<current_tab>\n  <url>https://example.com/article1</url>\n  <title>AI Advances in 2025</title>\n  <domain>example.com</domain>\n  <content>\n    # AI Advances in 2025\n    \n    Recent developments in artificial intelligence have shown remarkable progress in several key areas:\n    \n    ## Natural Language Processing\n    \n    Large language models have become more efficient and capable, with new architectures enabling:\n    - Better context understanding across longer documents\n    - Improved multilingual capabilities\n    - More accurate reasoning and problem-solving\n    \n    <!-- SEL_START:1 -->This selected text highlights the importance of efficiency improvements in modern AI systems<!-- SEL_END:1 -->\n    \n    ## Computer Vision\n    \n    Vision models now demonstrate:\n    - Real-time object detection with 99% accuracy\n    - Advanced scene understanding\n    - Multimodal integration with language models\n    \n    [... rest of markdown formatted content ...]\n  </content>\n</current_tab>\n\n<additional_tabs>\n  <tab id=\"12345\">\n    <url>https://tech.com/news/ai-regulation</url>\n    <title>New AI Regulations Proposed</title>\n    <domain>tech.com</domain>\n    <content>\n      # New AI Regulations Proposed\n      \n      Government agencies worldwide are proposing new frameworks for AI governance:\n      \n      ## Key Proposals\n      \n      1. **Transparency Requirements**\n         - Model cards for all deployed AI systems\n         - Explainability standards for critical applications\n      \n      2. **Safety Standards**\n         - Mandatory testing protocols\n         - Risk assessment frameworks\n      \n      [... rest of content ...]\n    </content>\n  </tab>\n  \n  <tab id=\"67890\">\n    <url>https://research.ai/papers/breakthrough</url>\n    <title>Breakthrough in AI Efficiency</title>\n    <domain>research.ai</domain>\n    <content>\n      # Breakthrough in AI Efficiency\n      \n      Researchers announce 10x improvement in model efficiency:\n      \n      ## Technical Details\n      \n      ```python\n      # New optimization technique\n      def optimize_model(model):\n          # Revolutionary approach to model compression\n          compressed = apply_new_technique(model)\n          return compressed\n      ```\n      \n      [... rest of content ...]\n    </content>\n  </tab>\n</additional_tabs>"
    }
  ],
  
  // Previous response ID for conversation continuity 
  // Only present when continuing an existing OpenAI conversation
  "previous_response_id": "resp_abc123def456789",
  
  // Web search tool enabled by default
  "tools": [
    { "type": "web_search" }
  ],
  
  // Reasoning configuration for models that support it
  "reasoning": {
    "effort": "medium",  // Options: "minimal", "low", "medium", "high"
    "summary": "auto"    // Return reasoning summary for display
  },
  
  // Enable streaming for real-time token delivery
  "stream": true,
  
  // Store conversation for continuity across requests
  "store": true
}
```

## Streaming Response Format (Server-Sent Events)

```
data: {"id":"chunk-001","type":"reasoning.delta","delta":{"thinking":"Analyzing the content from multiple tabs to identify key themes and connections..."},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-002","type":"reasoning.delta","delta":{"thinking":"The articles cover AI advances, regulations, and efficiency improvements. Let me structure the summary..."},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-003","type":"web_search_call","action":{"type":"web_search","query":"AI advances 2025 latest developments"}}

data: {"id":"chunk-004","type":"content.delta","delta":{"content":"Based on"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-005","type":"content.delta","delta":{"content":" the articles"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-006","type":"content.delta","delta":{"content":" provided, here"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-007","type":"content.delta","delta":{"content":" are the key points:\n\n"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-008","type":"content.delta","delta":{"content":"## AI Advances"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-009","type":"content.delta","delta":{"content":" Summary\n\n### 1."},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-010","type":"content.delta","delta":{"content":" **Efficiency Breakthrough**"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-011","type":"content.delta","delta":{"content":" (from research.ai)\n"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-012","type":"content.delta","delta":{"content":"- Researchers achieved"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-013","type":"content.delta","delta":{"content":" 10x improvement in"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-014","metadata":{"searchResults":[{"url":"https://example.com/ai-news","title":"Latest AI Developments 2025","snippet":"Comprehensive coverage of AI breakthroughs..."}]}}

data: {"id":"chunk-015","type":"content.delta","delta":{"content":" model efficiency\n"},"metadata":{"responseId":"resp_xyz789abc"}}

data: {"id":"chunk-final","type":"done","finish_reason":"stop","usage":{"prompt_tokens":1500,"completion_tokens":500,"reasoning_tokens":200,"total_tokens":2200}}

data: [DONE]
```

## Response Structure

```javascript
{
  "id": "resp_xyz789abc",
  "response_id": "resp_xyz789abc",  // Used for conversation continuity
  "output_text": "Based on the articles provided, here are the key points:\n\n## AI Advances Summary\n\n### 1. **Efficiency Breakthrough** (from research.ai)\n- Researchers achieved 10x improvement in model efficiency\n- New optimization techniques enable smaller, faster models\n- Significant reduction in computational requirements\n\n### 2. **NLP Improvements** (from example.com)\n- Better context understanding across longer documents\n- Enhanced multilingual capabilities\n- More accurate reasoning and problem-solving\n*Note: You highlighted the importance of efficiency improvements*\n\n### 3. **Regulatory Framework** (from tech.com)\n- New transparency requirements including model cards\n- Mandatory safety testing protocols\n- Risk assessment frameworks for critical applications\n\n### 4. **Computer Vision Advances** (from example.com)\n- 99% accuracy in real-time object detection\n- Advanced scene understanding capabilities\n- Seamless multimodal integration\n\n### Web Search Insights\nBased on current web search, these developments align with broader industry trends toward more efficient and regulated AI systems.\n\n### Synthesis\nThe three articles collectively paint a picture of AI development focusing on:\n1. **Technical advancement** - Especially in efficiency and capability\n2. **Practical application** - Real-world deployment improvements\n3. **Governance** - Increasing regulatory attention\n\nAll sources agree that efficiency is the key theme for 2025's AI landscape.",
  "reasoning": {
    "summary": [
      {
        "text": "I analyzed three articles covering different aspects of AI development in 2025. The first article from example.com focuses on technical advances in NLP and computer vision. The user specifically selected text about efficiency improvements, indicating this is of particular interest. The second article from tech.com discusses regulatory proposals, while the third from research.ai details a specific efficiency breakthrough. I structured my response to highlight key points from each source while synthesizing common themes."
      }
    ]
  },
  "output": [
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "[Full response text as above]",
          "annotations": [
            {
              "type": "url_citation",
              "url": "https://example.com/ai-news",
              "title": "Latest AI Developments 2025"
            }
          ]
        }
      ]
    },
    {
      "type": "reasoning",
      "summary": [
        {
          "text": "[Reasoning summary as above]"
        }
      ]
    },
    {
      "type": "web_search_call",
      "action": {
        "type": "web_search",
        "query": "AI advances 2025 latest developments"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1500,
    "completion_tokens": 500,
    "reasoning_tokens": 200,
    "total_tokens": 2200
  },
  "model": "gpt-5",
  "created": 1735234567,
  "status": "completed",
  "finish_reason": "stop"
}
```

## Key Features Explained

### 1. System Prompt (Instructions)
- Loaded from `src/config/systemPrompt.ts`
- Uses `getSystemPromptForModel()` to select appropriate version
- Compact version for lite models (gpt-5-nano)
- Full version for standard models (gpt-5, gpt-5-mini)

### 2. Multi-Tab Content
- Formatted by `formatMultiTabContent()` function
- XML structure with current tab and additional tabs
- Includes URL, title, domain, and markdown content
- Preserves selected text markers

### 3. Conversation Continuity
- `previous_response_id` maintains context across requests
- Only included when continuing an OpenAI conversation
- Enables minimal token usage for follow-ups

### 4. Web Search Integration
- Always enabled via `tools: [{ type: "web_search" }]`
- Results included in metadata during streaming
- Citations added as annotations

### 5. Reasoning/Thinking
- Configurable effort levels
- Streamed separately from main content
- Summary included for user transparency

### 6. Streaming
- Real-time token-by-token delivery
- Separate handling for thinking vs content
- Metadata preserved throughout stream

## Error Handling

```javascript
// Error response format
{
  "error": {
    "type": "invalid_request_error",
    "message": "Invalid API key provided",
    "code": "invalid_api_key"
  }
}
```

## Configuration in Code

Location: `src/provider/openai/requestBuilder.ts`

```javascript
export function buildRequest(
  messages: ProviderChatMessage[],
  openaiConfig: OpenAIConfig,
  chatConfig?: OpenAIChatConfig
): OpenAIResponseRequest {
  // System prompt extraction
  const systemPrompt = chatConfig?.systemPrompt || 
    (systemMessages.length > 0 ? systemMessages.map(m => m.content).join('\n') : undefined);
  
  const request: OpenAIResponseRequest = {
    model: openaiConfig.model,
    tools: [{ type: 'web_search' }],
    store: true,
  };
  
  // Add instructions if available
  if (systemPrompt) {
    request.instructions = systemPrompt;
  }
  
  // Handle conversation context...
  // Add reasoning params...
  
  return request;
}
```