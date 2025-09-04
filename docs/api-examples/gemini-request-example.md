# Gemini API - Full Request Example

This document shows a complete example of a Gemini API request with all features implemented in the browser sidebar extension.

## Full Request Structure

````javascript
{
  // System instruction - Proper Gemini format (separate from contents)
  "systemInstruction": {
    "role": "user",
    "parts": [
      {
        "text": "You are an AI assistant integrated into a privacy-focused browser extension that helps users interact with web content. You operate through a resizable, draggable sidebar interface that appears on any webpage when activated. Your primary purpose is to analyze, summarize, explain, and answer questions about web content while maintaining complete user privacy.\n\n## Core Capabilities\n\nYou receive web page content in structured format:\n- **Single Tab**: Automatically loaded current tab content\n- **Multi-Tab**: Additional tabs added via @ mention system\n- **Selected Text**: Marked with special HTML comments (SEL_START/SEL_END)\n\n## Response Guidelines\n\n### Content Analysis\n- Provide accurate, contextual responses based on the provided web content\n- When multiple tabs are loaded, clearly indicate which source you're referencing\n- Acknowledge when information is outside the provided content scope\n- Maintain source attribution when synthesizing information from multiple tabs\n\n### Formatting\n- Use markdown for clear, structured responses\n- Include code blocks with syntax highlighting when relevant\n- Create tables for comparative or structured information\n- Use bullet points and numbered lists for clarity\n\n### Tone and Style\n- Be concise and direct while remaining helpful\n- Adapt formality based on content type\n- Provide step-by-step explanations for complex topics\n- Offer follow-up suggestions when appropriate\n\n## Privacy Principles\n- Never log or store user queries externally\n- All content extraction happens locally in the browser\n- Respect restricted domains (banking, healthcare, government)\n- Handle sensitive information with appropriate warnings\n\n## Special Instructions\n\nWhen dealing with multiple sources:\n- Synthesize information coherently\n- Cite specific sources when making claims\n- Highlight agreements and contradictions\n- Suggest authoritative sources for specific topics\n\nWhen content is truncated:\n- Work with available content efficiently\n- Suggest specific sections for reloading if needed\n\nWhen dealing with code:\n- Analyze structure and patterns\n- Explain functionality in plain language\n- Identify potential issues or improvements\n- Respect existing code style\n\n## Limitations\n- Cannot access content behind authentication\n- Cannot execute JavaScript or interact with page elements\n- Cannot access cross-origin iframes\n- Cannot browse beyond provided tab content\n- Each sidebar session is independent\n\nRemember: You are a helpful, private, and efficient assistant that empowers users to better understand and work with web content while maintaining complete privacy and control."
      }
    ]
  },

  // Conversation contents with multi-tab data
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "<user_message>\nSummarize the key points from these articles\n</user_message>\n\n<current_tab>\n  <url>https://example.com/article1</url>\n  <title>AI Advances in 2025</title>\n  <domain>example.com</domain>\n  <content>\n    # AI Advances in 2025\n    \n    Recent developments in artificial intelligence have shown remarkable progress in several key areas:\n    \n    ## Natural Language Processing\n    \n    Large language models have become more efficient and capable, with new architectures enabling:\n    - Better context understanding across longer documents\n    - Improved multilingual capabilities\n    - More accurate reasoning and problem-solving\n    \n    <!-- SEL_START:1 -->This selected text highlights the importance of efficiency improvements in modern AI systems<!-- SEL_END:1 -->\n    \n    ## Computer Vision\n    \n    Vision models now demonstrate:\n    - Real-time object detection with 99% accuracy\n    - Advanced scene understanding\n    - Multimodal integration with language models\n    \n    [... rest of markdown formatted content ...]\n  </content>\n</current_tab>\n\n<additional_tabs>\n  <tab id=\"12345\">\n    <url>https://tech.com/news/ai-regulation</url>\n    <title>New AI Regulations Proposed</title>\n    <domain>tech.com</domain>\n    <content>\n      # New AI Regulations Proposed\n      \n      Government agencies worldwide are proposing new frameworks for AI governance:\n      \n      ## Key Proposals\n      \n      1. **Transparency Requirements**\n         - Model cards for all deployed AI systems\n         - Explainability standards for critical applications\n      \n      2. **Safety Standards**\n         - Mandatory testing protocols\n         - Risk assessment frameworks\n      \n      [... rest of content ...]\n    </content>\n  </tab>\n  \n  <tab id=\"67890\">\n    <url>https://research.ai/papers/breakthrough</url>\n    <title>Breakthrough in AI Efficiency</title>\n    <domain>research.ai</domain>\n    <content>\n      # Breakthrough in AI Efficiency\n      \n      Researchers announce 10x improvement in model efficiency:\n      \n      ## Technical Details\n      \n      ```python\n      # New optimization technique\n      def optimize_model(model):\n          # Revolutionary approach to model compression\n          compressed = apply_new_technique(model)\n          return compressed\n      ```\n      \n      [... rest of content ...]\n    </content>\n  </tab>\n</additional_tabs>"
        }
      ]
    },

    // For multi-turn conversations, include previous messages
    {
      "role": "model",
      "parts": [
        {
          "text": "I'll analyze these articles about AI advances in 2025..."
        }
      ]
    },

    {
      "role": "user",
      "parts": [
        {
          "text": "Can you focus more on the efficiency improvements mentioned?"
        }
      ]
    }
  ],

  // Generation configuration
  "generationConfig": {
    // Maximum output tokens
    "maxOutputTokens": 8192,

    // Thinking configuration for Gemini 2.5 models
    "thinkingConfig": {
      "thinkingBudget": -1,    // -1: dynamic (auto), 0: disabled, >0: specific token budget
      "includeThoughts": true   // Include thinking summaries in response
    },

    // Response modalities
    "responseModalities": ["TEXT"],

    // Optional stop sequences (if configured)
    "stopSequences": []
  },

  // Google Search grounding tool - always enabled
  "tools": [
    {
      "google_search": {}  // Empty object enables Google Search
    }
  ],

  // Safety settings (optional, configurable)
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_HATE_SPEECH",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "threshold": "BLOCK_NONE"
    },
    {
      "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
      "threshold": "BLOCK_NONE"
    }
  ]
}
````

## Streaming Response Format (JSON Chunks)

```json
// Thinking phase (if enabled)
{"candidates":[{"content":{"parts":[{"thinking":"Let me analyze the three articles provided about AI advances. The user has selected text about efficiency improvements, which seems to be a key focus area. I'll structure my response to highlight the main points from each source while emphasizing efficiency-related developments."}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"thinking":"The articles cover: 1) General AI advances from example.com, 2) Regulatory proposals from tech.com, and 3) A specific efficiency breakthrough from research.ai. I'll synthesize these perspectives."}],"role":"model"},"index":0}]}

// Content generation phase
{"candidates":[{"content":{"parts":[{"text":"Based on"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" the three articles"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" provided, here are"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" the key points about"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" AI advances in 2025"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":":\n\n## Summary of"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" Key Points\n\n"}],"role":"model"},"index":0}]}

// Web search grounding metadata
{"candidates":[{"content":{"parts":[{"text":"### 1. **Efficiency"}],"role":"model"},"index":0}],"groundingMetadata":{"webSearchQueries":["AI efficiency improvements 2025","AI model optimization breakthroughs"]}}

{"candidates":[{"content":{"parts":[{"text":" Breakthrough**"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" (research.ai)\n\n"}],"role":"model"},"index":0}],"groundingMetadata":{"groundingChunks":[{"web":{"uri":"https://research.ai/efficiency","title":"10x AI Efficiency Improvement"}}]}}

{"candidates":[{"content":{"parts":[{"text":"The research paper"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" describes a revolutionary"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" 10x improvement in"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" model efficiency through"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" new optimization techniques"}],"role":"model"},"index":0}],"groundingMetadata":{"groundingSupports":[{"segment":{"text":"10x improvement in model efficiency","startIndex":45,"endIndex":78},"groundingChunkIndices":[0]}]}}

{"candidates":[{"content":{"parts":[{"text":":\n- Reduced computational"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" requirements by 90%\n"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":"- Maintains accuracy while"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" using smaller models\n"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":"- Enables deployment on"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" edge devices\n\n"}],"role":"model"},"index":0}]}

// More content chunks...

// Search widget for additional context
{"candidates":[{"content":{"parts":[{"text":"### Additional Context\n\n"}],"role":"model"},"index":0}],"groundingMetadata":{"searchEntryPoint":{"renderedContent":"<div class=\"search-widget\">Related searches: <a href=\"https://google.com/search?q=AI+efficiency+2025\">AI efficiency 2025</a></div>"}}}

// Final chunk with completion
{"candidates":[{"content":{"parts":[{"text":"These advances collectively"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" indicate 2025 as a"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" pivotal year for AI"}],"role":"model"},"index":0}]}

{"candidates":[{"content":{"parts":[{"text":" efficiency and regulation."}],"role":"model"},"index":0}],"finishReason":"STOP"}]}

// Usage metadata
{"usageMetadata":{"promptTokenCount":1523,"candidatesTokenCount":487,"totalTokenCount":2010,"thinkingTokenCount":156}}
```

## Complete Response Structure

```javascript
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Based on the three articles provided, here are the key points about AI advances in 2025:\n\n## Summary of Key Points\n\n### 1. **Efficiency Breakthrough** (research.ai)\n\nThe research paper describes a revolutionary 10x improvement in model efficiency through new optimization techniques:\n- Reduced computational requirements by 90%\n- Maintains accuracy while using smaller models\n- Enables deployment on edge devices\n- New compression algorithms that preserve model capabilities\n\n*Note: This aligns with the text you highlighted about \"the importance of efficiency improvements in modern AI systems\"*\n\n### 2. **Natural Language Processing Advances** (example.com)\n\nSignificant improvements in language understanding:\n- **Better context handling**: Models can now process and understand documents up to 1 million tokens\n- **Multilingual capabilities**: Seamless translation and understanding across 200+ languages\n- **Enhanced reasoning**: Logical problem-solving approaching human-level performance\n\n### 3. **Regulatory Framework Development** (tech.com)\n\nGovernments are establishing comprehensive AI governance:\n- **Transparency Requirements**:\n  - Mandatory model cards for all deployed systems\n  - Clear documentation of training data and limitations\n- **Safety Standards**:\n  - Pre-deployment testing protocols\n  - Continuous monitoring requirements\n  - Risk assessment for critical applications\n\n### 4. **Computer Vision Progress** (example.com)\n\nVision models have achieved new milestones:\n- Real-time object detection with 99% accuracy\n- Advanced scene understanding and context awareness\n- Seamless multimodal integration with language models\n\n### Web Search Insights\n\nCurrent industry reports confirm these trends, with particular emphasis on:\n- The shift toward smaller, more efficient models\n- Increasing regulatory attention globally\n- Convergence of different AI modalities\n\n### Synthesis and Implications\n\nThe three articles collectively reveal 2025's AI landscape is characterized by:\n\n1. **Efficiency as Priority**: All sources emphasize optimization and reduced resource consumption\n2. **Maturation of Technology**: Moving from raw capability to refined, deployable solutions\n3. **Regulatory Evolution**: Balanced approach to innovation and safety\n4. **Practical Applications**: Focus on real-world deployment rather than research benchmarks\n\n### Key Takeaway\n\nThe efficiency improvements you highlighted represent the most significant trend, enabling AI deployment at scale while addressing environmental and economic concerns. This 10x improvement fundamentally changes the deployment possibilities for AI systems.\n\n### Additional Context\n\nRelated searches: [AI efficiency 2025](https://google.com/search?q=AI+efficiency+2025) | [AI regulation frameworks](https://google.com/search?q=AI+regulation+frameworks)",
            "thought": true  // Indicates this was part of thinking phase (if present)
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "groundingMetadata": {
        "webSearchQueries": [
          "AI efficiency improvements 2025",
          "AI model optimization breakthroughs",
          "AI regulatory frameworks 2025"
        ],
        "groundingChunks": [
          {
            "web": {
              "uri": "https://research.ai/efficiency",
              "title": "10x AI Efficiency Improvement"
            }
          },
          {
            "web": {
              "uri": "https://tech-news.com/ai-2025",
              "title": "AI Advances in 2025: Year in Review"
            }
          }
        ],
        "groundingSupports": [
          {
            "segment": {
              "text": "10x improvement in model efficiency",
              "startIndex": 145,
              "endIndex": 182
            },
            "groundingChunkIndices": [0]
          }
        ],
        "searchEntryPoint": {
          "renderedContent": "<div class=\"search-widget\">Related searches: <a href=\"https://google.com/search?q=AI+efficiency+2025\">AI efficiency 2025</a> | <a href=\"https://google.com/search?q=AI+regulation+frameworks\">AI regulation frameworks</a></div>"
        }
      }
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 1523,
    "candidatesTokenCount": 487,
    "totalTokenCount": 2010,
    "thinkingTokenCount": 156  // Only present when thinking is enabled
  }
}
```

## Key Features Explained

### 1. System Instruction

- Loaded from `src/config/systemPrompt.ts`
- Uses `getSystemPromptForModel()` for model-specific prompts
- Placed in `systemInstruction` field (NOT in contents)
- Follows official Gemini API documentation format

### 2. Multi-Tab Content

- Formatted by `formatMultiTabContent()` function
- Same XML structure as OpenAI
- Included in user message parts
- Preserves markdown and selected text markers

### 3. Thinking Configuration

- Controlled via `thinkingConfig` in `generationConfig`
- `thinkingBudget`:
  - `-1`: Dynamic/automatic (default for Gemini 2.5 Pro)
  - `0`: Disabled (default for Gemini 2.5 Flash Lite)
  - `>0`: Specific token budget
- Thinking content streamed separately before main response

### 4. Google Search Grounding

- Always enabled via `tools: [{ google_search: {} }]`
- Provides:
  - Web search queries used
  - Source citations with URLs
  - Text segment attributions
  - Related search suggestions

### 5. Safety Settings

- Configurable thresholds per category
- Options: `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE`
- Categories:
  - `HARM_CATEGORY_HARASSMENT`
  - `HARM_CATEGORY_HATE_SPEECH`
  - `HARM_CATEGORY_SEXUALLY_EXPLICIT`
  - `HARM_CATEGORY_DANGEROUS_CONTENT`

### 6. Streaming

- JSON chunks, not SSE format
- Each chunk contains a `candidates` array
- Thinking and content streamed separately
- Metadata included throughout stream

## Model-Specific Configuration

### Gemini 2.5 Flash Lite

```javascript
{
  "model": "gemini-2.5-flash-lite",
  "thinkingBudget": "0",        // Thinking disabled for lite model
  "showThoughts": false,         // Don't show thinking UI
  "systemPrompt": compactPrompt  // Use compact system prompt
}
```

### Gemini 2.5 Flash

```javascript
{
  "model": "gemini-2.5-flash",
  "thinkingBudget": "-1",        // Dynamic thinking
  "showThoughts": true,          // Show thinking in UI
  "systemPrompt": fullPrompt     // Use full system prompt
}
```

### Gemini 2.5 Pro

```javascript
{
  "model": "gemini-2.5-pro",
  "thinkingBudget": "-1",        // Automatic thinking
  "showThoughts": true,          // Display thinking process
  "systemPrompt": fullPrompt     // Use comprehensive prompt
}
```

## Error Handling

```javascript
// Error response format
{
  "error": {
    "code": 400,
    "message": "Invalid API key",
    "status": "INVALID_ARGUMENT",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "API_KEY_INVALID"
      }
    ]
  }
}
```

## Configuration in Code

Location: `src/core/ai/gemini/requestBuilder.ts`

```javascript
export function buildRequest(
  messages: ProviderChatMessage[],
  geminiConfig: GeminiConfig,
  chatConfig?: GeminiChatConfig
): GeminiRequest {
  const contents = convertMessages(messages);

  const request: GeminiRequest = {
    contents,
    generationConfig: buildGenerationConfig(geminiConfig, chatConfig),
    tools: [{ google_search: {} }],
  };

  // Add system instruction if provided
  if (chatConfig?.systemPrompt) {
    request.systemInstruction = {
      role: 'user',
      parts: [{ text: chatConfig.systemPrompt }]
    };
  }

  // Add safety settings if configured
  if (geminiConfig.safetySettings) {
    request.safetySettings = geminiConfig.safetySettings;
  }

  return request;
}
```

## API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
```

With API key as query parameter:

```
?key={API_KEY}
```
