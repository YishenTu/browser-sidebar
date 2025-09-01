---
title: Quickstart
subtitle: Get started with OpenRouter
slug: quickstart
headline: OpenRouter Quickstart Guide | Developer Documentation
canonical-url: 'https://openrouter.ai/docs/quickstart'
'og:site_name': OpenRouter Documentation
'og:title': OpenRouter Quickstart Guide
'og:description': >-
  Get started with OpenRouter's unified API for hundreds of AI models. Learn how
  to integrate using OpenAI SDK, direct API calls, or third-party frameworks.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?pathname=quickstart&title=Quick%20Start&description=Start%20using%20OpenRouter%20API%20in%20minutes%20with%20any%20SDK
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false
---

OpenRouter provides a unified API that gives you access to hundreds of AI models through a single endpoint, while automatically handling fallbacks and selecting the most cost-effective options. Get started with just a few lines of code using your preferred SDK or framework.

<Tip>
  Looking for information about free models and rate limits? Please see the [FAQ](/docs/faq#how-are-rate-limits-calculated)
</Tip>

In the examples below, the OpenRouter-specific headers are optional. Setting them allows your app to appear on the OpenRouter leaderboards. For detailed information about app attribution, see our [App Attribution guide](/docs/features/app-attribution).

## Using the OpenAI SDK

<CodeGroup>

```python title="Python"
from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="<OPENROUTER_API_KEY>",
)

completion = client.chat.completions.create(
  extra_headers={
    "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai.
  },
  model="openai/gpt-4o",
  messages=[
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
)

print(completion.choices[0].message.content)
```

```typescript title="TypeScript"
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
  defaultHeaders: {
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
  },
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
  });

  console.log(completion.choices[0].message);
}

main();
```

</CodeGroup>

## Using the OpenRouter API directly

<Tip>
  You can use the interactive [Request Builder](/request-builder) to generate OpenRouter API requests in the language of your choice.
</Tip>

<CodeGroup>

```python title="Python"
import requests
import json

response = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": "Bearer <OPENROUTER_API_KEY>",
    "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai.
  },
  data=json.dumps({
    "model": "openai/gpt-4o", # Optional
    "messages": [
      {
        "role": "user",
        "content": "What is the meaning of life?"
      }
    ]
  })
)
```

```typescript title="TypeScript"
fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <OPENROUTER_API_KEY>',
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
  }),
});
```

```shell title="Shell"
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
}'
```

</CodeGroup>

The API also supports [streaming](/docs/api-reference/streaming).

## Using third-party SDKs

For information about using third-party SDKs and frameworks with OpenRouter, please [see our frameworks documentation.](/docs/community/frameworks-overview)

---

title: Web Search
subtitle: Model-agnostic grounding
headline: Web Search | Add Real-time Web Data to AI Model Responses
canonical-url: 'https://openrouter.ai/docs/features/web-search'
'og:site_name': OpenRouter Documentation
'og:title': Web Search - Real-time Web Grounding for AI Models
'og:description': >-
Enable real-time web search capabilities in your AI model responses. Add
factual, up-to-date information to any model's output with OpenRouter's web
search feature.
'og:image':
type: url
value: >-
https://openrouter.ai/dynamic-og?pathname=features/web-search&title=Web%20Search&description=Add%20real-time%20web%20data%20to%20any%20AI%20model%20response
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false

---

You can incorporate relevant web search results for _any_ model on OpenRouter by activating and customizing the `web` plugin, or by appending `:online` to the model slug:

```json
{
  "model": "openai/gpt-4o:online"
}
```

This is a shortcut for using the `web` plugin, and is exactly equivalent to:

```json
{
  "model": "openrouter/auto",
  "plugins": [{ "id": "web" }]
}
```

The web search plugin is powered by [Exa](https://exa.ai) and uses their ["auto"](https://docs.exa.ai/reference/how-exa-search-works#combining-neural-and-keyword-the-best-of-both-worlds-through-exa-auto-search) method (a combination of keyword search and embeddings-based web search) to find the most relevant results and augment/ground your prompt.

## Parsing web search results

Web search results for all models (including native-only models like Perplexity and OpenAI Online) are available in the API and standardized by OpenRouterto follow the same annotation schema in the [OpenAI Chat Completion Message type](https://platform.openai.com/docs/api-reference/chat/object):

```json
{
  "message": {
    "role": "assistant",
    "content": "Here's the latest news I found: ...",
    "annotations": [
      {
        "type": "url_citation",
        "url_citation": {
          "url": "https://www.example.com/web-search-result",
          "title": "Title of the web search result",
          "content": "Content of the web search result", // Added by OpenRouter if available
          "start_index": 100, // The index of the first character of the URL citation in the message.
          "end_index": 200 // The index of the last character of the URL citation in the message.
        }
      }
    ]
  }
}
```

## Customizing the Web Plugin

The maximum results allowed by the web plugin and the prompt used to attach them to your message stream can be customized:

```json
{
  "model": "openai/gpt-4o:online",
  "plugins": [
    {
      "id": "web",
      "max_results": 1, // Defaults to 5
      "search_prompt": "Some relevant web results:" // See default below
    }
  ]
}
```

By default, the web plugin uses the following search prompt, using the current date:

```
A web search was conducted on `date`. Incorporate the following web search results into your response.

IMPORTANT: Cite them using markdown links named using the domain of the source.
Example: [nytimes.com](https://nytimes.com/some-page).
```

## Pricing

The web plugin uses your OpenRouter credits and charges _\$4 per 1000 results_. By default, `max_results` set to 5, this comes out to a maximum of \$0.02 per request, in addition to the LLM usage for the search result prompt tokens.

## Non-plugin Web Search

Some models have built-in web search. These models charge a fee based on the search context size, which determines how much search data is retrieved and processed for a query.

### Search Context Size Thresholds

Search context can be 'low', 'medium', or 'high' and determines how much search context is retrieved for a query:

- **Low**: Minimal search context, suitable for basic queries
- **Medium**: Moderate search context, good for general queries
- **High**: Extensive search context, ideal for detailed research

### Specifying Search Context Size

You can specify the search context size in your API request using the `web_search_options` parameter:

```json
{
  "model": "openai/gpt-4.1",
  "messages": [
    {
      "role": "user",
      "content": "What are the latest developments in quantum computing?"
    }
  ],
  "web_search_options": {
    "search_context_size": "high"
  }
}
```

### OpenAI Model Pricing

For GPT-4.1, GPT-4o, and GPT-4o search preview Models:

| Search Context Size | Price per 1000 Requests |
| ------------------- | ----------------------- |
| Low                 | $30.00                  |
| Medium              | $35.00                  |
| High                | $50.00                  |

For GPT-4.1-Mini, GPT-4o-Mini, and GPT-4o-Mini-Search-Preview Models:

| Search Context Size | Price per 1000 Requests |
| ------------------- | ----------------------- |
| Low                 | $25.00                  |
| Medium              | $27.50                  |
| High                | $30.00                  |

### Perplexity Model Pricing

For Sonar and SonarReasoning:

| Search Context Size | Price per 1000 Requests |
| ------------------- | ----------------------- |
| Low                 | $5.00                   |
| Medium              | $8.00                   |
| High                | $12.00                  |

For SonarPro and SonarReasoningPro:

| Search Context Size | Price per 1000 Requests |
| ------------------- | ----------------------- |
| Low                 | $6.00                   |
| Medium              | $10.00                  |
| High                | $14.00                  |

<Note title='Pricing Documentation'>

For more detailed information about pricing models, refer to the official documentation:

- [OpenAI Pricing](https://platform.openai.com/docs/pricing#web-search)
- [Perplexity Pricing](https://docs.perplexity.ai/guides/pricing)

</Note>

---

title: Streaming
headline: API Streaming | Real-time Model Responses in OpenRouter
canonical-url: 'https://openrouter.ai/docs/api-reference/streaming'
'og:site_name': OpenRouter Documentation
'og:title': API Streaming - Real-time Model Response Integration
'og:description': >-
Learn how to implement streaming responses with OpenRouter's API. Complete
guide to Server-Sent Events (SSE) and real-time model outputs.
'og:image':
type: url
value: >-
https://openrouter.ai/dynamic-og?title=API%20Streaming&description=Real-time%20model%20response%20streaming
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false

---

import { API_KEY_REF, Model } from '../../../imports/constants';

The OpenRouter API allows streaming responses from _any model_. This is useful for building chat interfaces or other applications where the UI should update as the model generates the response.

To enable streaming, you can set the `stream` parameter to `true` in your request. The model will then stream the response to the client in chunks, rather than returning the entire response at once.

Here is an example of how to stream a response, and process it:

<Template data={{
  API_KEY_REF,
  MODEL: Model.GPT_4_Omni
}}>

<CodeGroup>

```python Python
import requests
import json

question = "How would you build the tallest building ever?"

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
  "Authorization": f"Bearer {{API_KEY_REF}}",
  "Content-Type": "application/json"
}

payload = {
  "model": "{{MODEL}}",
  "messages": [{"role": "user", "content": question}],
  "stream": True
}

buffer = ""
with requests.post(url, headers=headers, json=payload, stream=True) as r:
  for chunk in r.iter_content(chunk_size=1024, decode_unicode=True):
    buffer += chunk
    while True:
      try:
        # Find the next complete SSE line
        line_end = buffer.find('\n')
        if line_end == -1:
          break

        line = buffer[:line_end].strip()
        buffer = buffer[line_end + 1:]

        if line.startswith('data: '):
          data = line[6:]
          if data == '[DONE]':
            break

          try:
            data_obj = json.loads(data)
            content = data_obj["choices"][0]["delta"].get("content")
            if content:
              print(content, end="", flush=True)
          except json.JSONDecodeError:
            pass
      except Exception:
        break
```

```typescript TypeScript
const question = 'How would you build the tallest building ever?';
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    messages: [{ role: 'user', content: question }],
    stream: true,
  }),
});

const reader = response.body?.getReader();
if (!reader) {
  throw new Error('Response body is not readable');
}

const decoder = new TextDecoder();
let buffer = '';

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Append new chunk to buffer
    buffer += decoder.decode(value, { stream: true });

    // Process complete lines from buffer
    while (true) {
      const lineEnd = buffer.indexOf('\n');
      if (lineEnd === -1) break;

      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);

      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0].delta.content;
          if (content) {
            console.log(content);
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    }
  }
} finally {
  reader.cancel();
}
```

</CodeGroup>
</Template>

### Additional Information

For SSE (Server-Sent Events) streams, OpenRouter occasionally sends comments to prevent connection timeouts. These comments look like:

```text
: OPENROUTER PROCESSING
```

Comment payload can be safely ignored per the [SSE specs](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation). However, you can leverage it to improve UX as needed, e.g. by showing a dynamic loading indicator.

Some SSE client implementations might not parse the payload according to spec, which leads to an uncaught error when you `JSON.stringify` the non-JSON payloads. We recommend the following clients:

- [eventsource-parser](https://github.com/rexxars/eventsource-parser)
- [OpenAI SDK](https://www.npmjs.com/package/openai)
- [Vercel AI SDK](https://www.npmjs.com/package/ai)

### Stream Cancellation

Streaming requests can be cancelled by aborting the connection. For supported providers, this immediately stops model processing and billing.

<Accordion title="Provider Support">

**Supported**

- OpenAI, Azure, Anthropic
- Fireworks, Mancer, Recursal
- AnyScale, Lepton, OctoAI
- Novita, DeepInfra, Together
- Cohere, Hyperbolic, Infermatic
- Avian, XAI, Cloudflare
- SFCompute, Nineteen, Liquid
- Friendli, Chutes, DeepSeek

**Not Currently Supported**

- AWS Bedrock, Groq, Modal
- Google, Google AI Studio, Minimax
- HuggingFace, Replicate, Perplexity
- Mistral, AI21, Featherless
- Lynn, Lambda, Reflection
- SambaNova, Inflection, ZeroOneAI
- AionLabs, Alibaba, Nebius
- Kluster, Targon, InferenceNet

</Accordion>

To implement stream cancellation:

<Template data={{
  API_KEY_REF,
  MODEL: Model.GPT_4_Omni
}}>

<CodeGroup>

```python Python
import requests
from threading import Event, Thread

def stream_with_cancellation(prompt: str, cancel_event: Event):
    with requests.Session() as session:
        response = session.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {{API_KEY_REF}}"},
            json={"model": "{{MODEL}}", "messages": [{"role": "user", "content": prompt}], "stream": True},
            stream=True
        )

        try:
            for line in response.iter_lines():
                if cancel_event.is_set():
                    response.close()
                    return
                if line:
                    print(line.decode(), end="", flush=True)
        finally:
            response.close()

# Example usage:
cancel_event = Event()
stream_thread = Thread(target=lambda: stream_with_cancellation("Write a story", cancel_event))
stream_thread.start()

# To cancel the stream:
cancel_event.set()
```

```typescript TypeScript
const controller = new AbortController();

try {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${{{API_KEY_REF}}}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        messages: [{ role: 'user', content: 'Write a story' }],
        stream: true,
      }),
      signal: controller.signal,
    },
  );

  // Process the stream...
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream cancelled');
  } else {
    throw error;
  }
}

// To cancel the stream:
controller.abort();
```

</CodeGroup>
</Template>

<Warning>
  Cancellation only works for streaming requests with supported providers. For
  non-streaming requests or unsupported providers, the model will continue
  processing and you will be billed for the complete response.
</Warning>

---

title: Reasoning Tokens
headline: Reasoning Tokens | Enhanced AI Model Reasoning with OpenRouter
canonical-url: 'https://openrouter.ai/docs/use-cases/reasoning-tokens'
'og:site_name': OpenRouter Documentation
'og:title': Reasoning Tokens - Improve AI Model Decision Making
'og:description': >-
Learn how to use reasoning tokens to enhance AI model outputs. Implement
step-by-step reasoning traces for better decision making and transparency.
'og:image':
type: url
value: >-
https://openrouter.ai/dynamic-og?title=Reasoning%20Tokens&description=Enhance%20AI%20model%20outputs%20with%20OpenRouter
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false

---

import { API_KEY_REF, Model } from '../../../imports/constants';

For models that support it, the OpenRouter API can return **Reasoning Tokens**, also known as thinking tokens. OpenRouter normalizes the different ways of customizing the amount of reasoning tokens that the model will use, providing a unified interface across different providers.

Reasoning tokens provide a transparent look into the reasoning steps taken by a model. Reasoning tokens are considered output tokens and charged accordingly.

Reasoning tokens are included in the response by default if the model decides to output them. Reasoning tokens will appear in the `reasoning` field of each message, unless you decide to exclude them.

<Note title='Some reasoning models do not return their reasoning tokens'>
  While most models and providers make reasoning tokens available in the
  response, some (like the OpenAI o-series and Gemini Flash Thinking) do not.
</Note>

## Controlling Reasoning Tokens

You can control reasoning tokens in your requests using the `reasoning` parameter:

```json
{
  "model": "your-model",
  "messages": [],
  "reasoning": {
    // One of the following (not both):
    "effort": "high", // Can be "high", "medium", or "low" (OpenAI-style)
    "max_tokens": 2000, // Specific token limit (Anthropic-style)

    // Optional: Default is false. All models support this.
    "exclude": false, // Set to true to exclude reasoning tokens from response

    // Or enable reasoning with the default parameters:
    "enabled": true // Default: inferred from `effort` or `max_tokens`
  }
}
```

The `reasoning` config object consolidates settings for controlling reasoning strength across different models. See the Note for each option below to see which models are supported and how other models will behave.

### Max Tokens for Reasoning

<Note title='Supported models'>
  Currently supported by:
  <ul>
    <li>Gemini thinking models</li>
    <li>
      Anthropic reasoning models (by using the <code>reasoning.max_tokens</code>{' '}
      parameter)
    </li>
  </ul>
</Note>

For models that support reasoning token allocation, you can control it like this:

- `"max_tokens": 2000` - Directly specifies the maximum number of tokens to use for reasoning

For models that only support `reasoning.effort` (see below), the `max_tokens` value will be used to determine the effort level.

### Reasoning Effort Level

<Note title='Supported models'>
  Currently supported by OpenAI reasoning models (o1 series, o3 series, GPT-5 series) and Grok models
</Note>

- `"effort": "high"` - Allocates a large portion of tokens for reasoning (approximately 80% of max_tokens)
- `"effort": "medium"` - Allocates a moderate portion of tokens (approximately 50% of max_tokens)
- `"effort": "low"` - Allocates a smaller portion of tokens (approximately 20% of max_tokens)

For models that only support `reasoning.max_tokens`, the effort level will be set based on the percentages above.

### Excluding Reasoning Tokens

If you want the model to use reasoning internally but not include it in the response:

- `"exclude": true` - The model will still use reasoning, but it won't be returned in the response

Reasoning tokens will appear in the `reasoning` field of each message.

### Enable Reasoning with Default Config

To enable reasoning with the default parameters:

- `"enabled": true` - Enables reasoning at the "medium" effort level with no exclusions.

## Legacy Parameters

For backward compatibility, OpenRouter still supports the following legacy parameters:

- `include_reasoning: true` - Equivalent to `reasoning: {}`
- `include_reasoning: false` - Equivalent to `reasoning: { exclude: true }`

However, we recommend using the new unified `reasoning` parameter for better control and future compatibility.

## Examples

### Basic Usage with Reasoning Tokens

<Template data={{
  API_KEY_REF,
  MODEL: "openai/o3-mini"
}}>
<CodeGroup>

```python Python
import requests
import json

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}
payload = {
    "model": "{{MODEL}}",
    "messages": [
        {"role": "user", "content": "How would you build the world's tallest skyscraper?"}
    ],
    "reasoning": {
        "effort": "high"  # Use high reasoning effort
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json()['choices'][0]['message']['reasoning'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function getResponseWithReasoning() {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: "How would you build the world's tallest skyscraper?",
      },
    ],
    reasoning: {
      effort: 'high', // Use high reasoning effort
    },
  });

  console.log('REASONING:', response.choices[0].message.reasoning);
  console.log('CONTENT:', response.choices[0].message.content);
}

getResponseWithReasoning();
```

</CodeGroup>
</Template>

### Using Max Tokens for Reasoning

For models that support direct token allocation (like Anthropic models), you can specify the exact number of tokens to use for reasoning:

<Template data={{
  API_KEY_REF,
  MODEL: "anthropic/claude-3.7-sonnet"
}}>
<CodeGroup>

```python Python
import requests
import json

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}
payload = {
    "model": "{{MODEL}}",
    "messages": [
        {"role": "user", "content": "What's the most efficient algorithm for sorting a large dataset?"}
    ],
    "reasoning": {
        "max_tokens": 2000  # Allocate 2000 tokens (or approximate effort) for reasoning
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json()['choices'][0]['message']['reasoning'])
print(response.json()['choices'][0]['message']['content'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function getResponseWithReasoning() {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: "How would you build the world's tallest skyscraper?",
      },
    ],
    reasoning: {
      max_tokens: 2000, // Allocate 2000 tokens (or approximate effort) for reasoning
    },
  });

  console.log('REASONING:', response.choices[0].message.reasoning);
  console.log('CONTENT:', response.choices[0].message.content);
}

getResponseWithReasoning();
```

</CodeGroup>
</Template>

### Excluding Reasoning Tokens from Response

If you want the model to use reasoning internally but not include it in the response:

<Template data={{
  API_KEY_REF,
  MODEL: "deepseek/deepseek-r1"
}}>
<CodeGroup>

```python Python
import requests
import json

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}
payload = {
    "model": "{{MODEL}}",
    "messages": [
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    "reasoning": {
        "effort": "high",
        "exclude": true  # Use reasoning but don't include it in the response
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
# No reasoning field in the response
print(response.json()['choices'][0]['message']['content'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

async function getResponseWithReasoning() {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: "How would you build the world's tallest skyscraper?",
      },
    ],
    reasoning: {
      effort: 'high',
      exclude: true, // Use reasoning but don't include it in the response
    },
  });

  console.log('REASONING:', response.choices[0].message.reasoning);
  console.log('CONTENT:', response.choices[0].message.content);
}

getResponseWithReasoning();
```

</CodeGroup>
</Template>

### Advanced Usage: Reasoning Chain-of-Thought

This example shows how to use reasoning tokens in a more complex workflow. It injects one model's reasoning into another model to improve its response quality:

<Template data={{
  API_KEY_REF,
}}>
<CodeGroup>

```python Python
import requests
import json

question = "Which is bigger: 9.11 or 9.9?"

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {{API_KEY_REF}}",
    "Content-Type": "application/json"
}

def do_req(model, content, reasoning_config=None):
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": content}
        ],
        "stop": "</think>"
    }

    return requests.post(url, headers=headers, data=json.dumps(payload))

# Get reasoning from a capable model
content = f"{question} Please think this through, but don't output an answer"
reasoning_response = do_req("deepseek/deepseek-r1", content)
reasoning = reasoning_response.json()['choices'][0]['message']['reasoning']

# Let's test! Here's the naive response:
simple_response = do_req("openai/gpt-4o-mini", question)
print(simple_response.json()['choices'][0]['message']['content'])

# Here's the response with the reasoning token injected:
content = f"{question}. Here is some context to help you: {reasoning}"
smart_response = do_req("openai/gpt-4o-mini", content)
print(smart_response.json()['choices'][0]['message']['content'])
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

async function doReq(model, content, reasoningConfig) {
  const payload = {
    model,
    messages: [{ role: 'user', content }],
    stop: '</think>',
    ...reasoningConfig,
  };

  return openai.chat.completions.create(payload);
}

async function getResponseWithReasoning() {
  const question = 'Which is bigger: 9.11 or 9.9?';
  const reasoningResponse = await doReq(
    'deepseek/deepseek-r1',
    `${question} Please think this through, but don't output an answer`
  );
  const reasoning = reasoningResponse.choices[0].message.reasoning;

  // Let's test! Here's the naive response:
  const simpleResponse = await doReq('openai/gpt-4o-mini', question);
  console.log(simpleResponse.choices[0].message.content);

  // Here's the response with the reasoning token injected:
  const content = `${question}. Here is some context to help you: ${reasoning}`;
  const smartResponse = await doReq('openai/gpt-4o-mini', content);
  console.log(smartResponse.choices[0].message.content);
}

getResponseWithReasoning();
```

</CodeGroup>
</Template>

## Provider-Specific Reasoning Implementation

### Anthropic Models with Reasoning Tokens

The latest Claude models, such as [anthropic/claude-3.7-sonnet](https://openrouter.ai/anthropic/claude-3.7-sonnet), support working with and returning reasoning tokens.

You can enable reasoning on Anthropic models **only** using the unified `reasoning` parameter with either `effort` or `max_tokens`.

**Note:** The `:thinking` variant is no longer supported for Anthropic models. Use the `reasoning` parameter instead.

#### Reasoning Max Tokens for Anthropic Models

When using Anthropic models with reasoning:

- When using the `reasoning.max_tokens` parameter, that value is used directly with a minimum of 1024 tokens.
- When using the `reasoning.effort` parameter, the budget_tokens are calculated based on the `max_tokens` value.

The reasoning token allocation is capped at 32,000 tokens maximum and 1024 tokens minimum. The formula for calculating the budget_tokens is: `budget_tokens = max(min(max_tokens * {effort_ratio}, 32000), 1024)`

effort_ratio is 0.8 for high effort, 0.5 for medium effort, and 0.2 for low effort.

**Important**: `max_tokens` must be strictly higher than the reasoning budget to ensure there are tokens available for the final response after thinking.

<Note title='Token Usage and Billing'>
  Please note that reasoning tokens are counted as output tokens for billing
  purposes. Using reasoning tokens will increase your token usage but can
  significantly improve the quality of model responses.
</Note>

### Examples with Anthropic Models

#### Example 1: Streaming mode with reasoning tokens

<Template data={{
  API_KEY_REF,
  MODEL: "anthropic/claude-3.7-sonnet"
}}>
<CodeGroup>

```python Python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="{{API_KEY_REF}}",
)

def chat_completion_with_reasoning(messages):
    response = client.chat.completions.create(
        model="{{MODEL}}",
        messages=messages,
        max_tokens=10000,
        reasoning={
            "max_tokens": 8000  # Directly specify reasoning token budget
        },
        stream=True
    )
    return response

for chunk in chat_completion_with_reasoning([
    {"role": "user", "content": "What's bigger, 9.9 or 9.11?"}
]):
    if hasattr(chunk.choices[0].delta, 'reasoning') and chunk.choices[0].delta.reasoning:
        print(f"REASONING: {chunk.choices[0].delta.reasoning}")
    elif chunk.choices[0].delta.content:
        print(f"CONTENT: {chunk.choices[0].delta.content}")
```

```typescript TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
});

async function chatCompletionWithReasoning(messages) {
  const response = await openai.chat.completions.create({
    model: '{{MODEL}}',
    messages,
    maxTokens: 10000,
    reasoning: {
      maxTokens: 8000, // Directly specify reasoning token budget
    },
    stream: true,
  });

  return response;
}

(async () => {
  for await (const chunk of chatCompletionWithReasoning([
    { role: 'user', content: "What's bigger, 9.9 or 9.11?" },
  ])) {
    if (chunk.choices[0].delta.reasoning) {
      console.log(`REASONING: ${chunk.choices[0].delta.reasoning}`);
    } else if (chunk.choices[0].delta.content) {
      console.log(`CONTENT: ${chunk.choices[0].delta.content}`);
    }
  }
})();
```

</CodeGroup>
</Template>

## Preserving Reasoning Blocks

<Note title='Model Support'>
  The reasoning_details are currently returned by all OpenAI reasoning models
  (o1 series, o3 series, GPT-5 series) and all Anthropic reasoning models
  (Claude 3.7, Claude 4, and Claude 4.1 series).
</Note>

The reasoning_details functionality works identically across all supported reasoning models. You can easily switch between OpenAI reasoning models (like `openai/gpt-5-mini`) and Anthropic reasoning models (like `anthropic/claude-sonnet-4`) without changing your code structure.

If you want to pass reasoning back in context, you must pass reasoning blocks back to the API. This is useful for maintaining the model's reasoning flow and conversation integrity.

Preserving reasoning blocks is useful specifically for tool calling. When models like Claude invoke tools, it is pausing its construction of a response to await external information. When tool results are returned, the model will continue building that existing response. This necessitates preserving reasoning blocks during tool use, for a couple of reasons:

**Reasoning continuity**: The reasoning blocks capture the model's step-by-step reasoning that led to tool requests. When you post tool results, including the original reasoning ensures the model can continue its reasoning from where it left off.

**Context maintenance**: While tool results appear as user messages in the API structure, they're part of a continuous reasoning flow. Preserving reasoning blocks maintains this conceptual flow across multiple API calls.

<Note title='Important for Reasoning Models'>
  When providing reasoning_details blocks, the entire sequence of consecutive
  reasoning blocks must match the outputs generated by the model during the
  original request; you cannot rearrange or modify the sequence of these blocks.
</Note>

## Responses API Shape

When reasoning models generate responses, the reasoning information is structured in a standardized format through the `reasoning_details` array. This section documents the API response structure for reasoning details in both streaming and non-streaming responses, based on the schema definitions in the `llm-interfaces` package.

### reasoning_details Array Structure

The `reasoning_details` field contains an array of reasoning detail objects. Each object in the array represents a specific piece of reasoning information and follows one of three possible types. The location of this array differs between streaming and non-streaming responses:

- **Non-streaming responses**: `reasoning_details` appears in `choices[].message.reasoning_details`
- **Streaming responses**: `reasoning_details` appears in `choices[].delta.reasoning_details` for each chunk

#### Common Fields

All reasoning detail objects share these common fields:

- `id` (string | null): Unique identifier for the reasoning detail
- `format` (string): The format of the reasoning detail, with possible values:
  - `"unknown"` - Format is not specified
  - `"openai-responses-v1"` - OpenAI responses format version 1
  - `"anthropic-claude-v1"` - Anthropic Claude format version 1 (default)
- `index` (number, optional): Sequential index of the reasoning detail

#### Reasoning Detail Types

**1. Summary Type (`reasoning.summary`)**

Contains a high-level summary of the reasoning process:

```json
{
  "type": "reasoning.summary",
  "summary": "The model analyzed the problem by first identifying key constraints, then evaluating possible solutions...",
  "id": "reasoning-summary-1",
  "format": "anthropic-claude-v1",
  "index": 0
}
```

**2. Encrypted Type (`reasoning.encrypted`)**

Contains encrypted reasoning data that may be redacted or protected:

```json
{
  "type": "reasoning.encrypted",
  "data": "eyJlbmNyeXB0ZWQiOiJ0cnVlIiwiY29udGVudCI6IltSRURBQ1RFRF0ifQ==",
  "id": "reasoning-encrypted-1",
  "format": "anthropic-claude-v1",
  "index": 1
}
```

**3. Text Type (`reasoning.text`)**

Contains raw text reasoning with optional signature verification:

```json
{
  "type": "reasoning.text",
  "text": "Let me think through this step by step:\n1. First, I need to understand the user's question...",
  "signature": "sha256:abc123def456...",
  "id": "reasoning-text-1",
  "format": "anthropic-claude-v1",
  "index": 2
}
```

### Response Examples

#### Non-Streaming Response

In non-streaming responses, `reasoning_details` appears in the message:

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Based on my analysis, I recommend the following approach...",
        "reasoning_details": [
          {
            "type": "reasoning.summary",
            "summary": "Analyzed the problem by breaking it into components",
            "id": "reasoning-summary-1",
            "format": "anthropic-claude-v1",
            "index": 0
          },
          {
            "type": "reasoning.text",
            "text": "Let me work through this systematically:\n1. First consideration...\n2. Second consideration...",
            "signature": null,
            "id": "reasoning-text-1",
            "format": "anthropic-claude-v1",
            "index": 1
          }
        ]
      }
    }
  ]
}
```

#### Streaming Response

In streaming responses, `reasoning_details` appears in delta chunks as the reasoning is generated:

```json
{
  "choices": [
    {
      "delta": {
        "reasoning_details": [
          {
            "type": "reasoning.text",
            "text": "Let me think about this step by step...",
            "signature": null,
            "id": "reasoning-text-1",
            "format": "anthropic-claude-v1",
            "index": 0
          }
        ]
      }
    }
  ]
}
```

**Streaming Behavior Notes:**

- Each reasoning detail chunk is sent as it becomes available
- The `reasoning_details` array in each chunk may contain one or more reasoning objects
- For encrypted reasoning, the content may appear as `[REDACTED]` in streaming responses
- The complete reasoning sequence is built by concatenating all chunks in order

### Example: Preserving Reasoning Blocks with OpenRouter and Claude

<Template data={{
  API_KEY_REF,
  MODEL: 'anthropic/claude-sonnet-4'
}}>
<CodeGroup>

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="{{API_KEY_REF}}",
)

# First API call with tools
# Note: You can use 'openai/gpt-5-mini' instead of 'anthropic/claude-sonnet-4' - they're completely interchangeable
response = client.chat.completions.create(
    model="{{MODEL}}",
    messages=[
        {"role": "user", "content": "What's the weather like in Boston? Then recommend what to wear."}
    ],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        }
    }],
    reasoning={"max_tokens": 2000}
)

# Extract the assistant message with reasoning_details
message = response.choices[0].message

# Preserve the complete reasoning_details when passing back
messages = [
    {"role": "user", "content": "What's the weather like in Boston? Then recommend what to wear."},
    {
        "role": "assistant",
        "content": message.content,
        "tool_calls": message.tool_calls,
        "reasoning_details": message.reasoning_details  # Pass back unmodified
    },
    {
        "role": "tool",
        "tool_call_id": message.tool_calls[0].id,
        "content": '{"temperature": 45, "condition": "rainy", "humidity": 85}'
    }
]

# Second API call - Claude continues reasoning from where it left off
response2 = client.chat.completions.create(
    model="{{MODEL}}",
    messages=messages,  # Includes preserved thinking blocks
    tools=tools
)
```

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '{{API_KEY_REF}}',
});

// First API call with tools
// Note: You can use 'openai/gpt-5-mini' instead of 'anthropic/claude-sonnet-4' - they're completely interchangeable
const response = await client.chat.completions.create({
  model: '{{MODEL}}',
  messages: [
    {
      role: 'user',
      content: "What's the weather like in Boston? Then recommend what to wear.",
    },
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
      },
    },
  ],
  reasoning: { max_tokens: 2000 },
});

// Extract the assistant message with reasoning_details
const message = response.choices[0].message;

// Preserve the complete reasoning_details when passing back
const messages = [
  {
    role: 'user',
    content: "What's the weather like in Boston? Then recommend what to wear.",
  },
  {
    role: 'assistant',
    content: message.content,
    tool_calls: message.tool_calls,
    reasoning_details: message.reasoning_details, // Pass back unmodified
  },
  {
    role: 'tool',
    tool_call_id: message.tool_calls[0].id,
    content: JSON.stringify({
      temperature: 45,
      condition: 'rainy',
      humidity: 85,
    }),
  },
];

// Second API call - Claude continues reasoning from where it left off
const response2 = await client.chat.completions.create({
  model: '{{MODEL}}',
  messages, // Includes preserved thinking blocks
  tools,
});
```

</CodeGroup>
</Template>

For more detailed information about thinking encryption, redacted blocks, and advanced use cases, see [Anthropic's documentation on extended thinking](https://docs.anthropic.com/en/docs/build-with-claude/tool-use#extended-thinking).

For more information about OpenAI reasoning models, see [OpenAI's reasoning documentation](https://platform.openai.com/docs/guides/reasoning#keeping-reasoning-items-in-context).

---

title: Prompt Caching
subtitle: Cache prompt messages
headline: Prompt Caching | Reduce AI Model Costs with OpenRouter
canonical-url: 'https://openrouter.ai/docs/features/prompt-caching'
'og:site_name': OpenRouter Documentation
'og:title': Prompt Caching - Optimize AI Model Costs with Smart Caching
'og:description': >-
Reduce your AI model costs with OpenRouter's prompt caching feature. Learn how
to cache and reuse responses across OpenAI, Anthropic Claude, and DeepSeek
models.
'og:image':
type: url
value: >-
https://openrouter.ai/dynamic-og?title=Prompt%20Caching&description=Optimize%20AI%20model%20costs%20with%20OpenRouter
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouterAI'
noindex: false
nofollow: false

---

import {
ANTHROPIC_CACHE_READ_MULTIPLIER,
ANTHROPIC_CACHE_WRITE_MULTIPLIER,
DEEPSEEK_CACHE_READ_MULTIPLIER,
GOOGLE_CACHE_MIN_TOKENS_2_5_FLASH,
GOOGLE_CACHE_MIN_TOKENS_2_5_PRO,
GOOGLE_CACHE_READ_MULTIPLIER,
GROK_CACHE_READ_MULTIPLIER,
GROQ_CACHE_READ_MULTIPLIER,
MOONSHOT_CACHE_READ_MULTIPLIER,
} from '../../../imports/constants';

To save on inference costs, you can enable prompt caching on supported providers and models.

Most providers automatically enable prompt caching, but note that some (see Anthropic below) require you to enable it on a per-message basis.

When using caching (whether automatically in supported models, or via the `cache_control` property), OpenRouter will make a best-effort to continue routing to the same provider to make use of the warm cache. In the event that the provider with your cached prompt is not available, OpenRouter will try the next-best provider.

## Inspecting cache usage

To see how much caching saved on each generation, you can:

1. Click the detail button on the [Activity](/activity) page
2. Use the `/api/v1/generation` API, [documented here](/api-reference/overview#querying-cost-and-stats)
3. Use `usage: {include: true}` in your request to get the cache tokens at the end of the response (see [Usage Accounting](/use-cases/usage-accounting) for details)

The `cache_discount` field in the response body will tell you how much the response saved on cache usage. Some providers, like Anthropic, will have a negative discount on cache writes, but a positive discount (which reduces total cost) on cache reads.

## OpenAI

Caching price changes:

- **Cache writes**: no cost
- **Cache reads**: (depending on the model) charged at 0.25x or 0.50x the price of the original input pricing

[Click here to view OpenAI's cache pricing per model.](https://platform.openai.com/docs/pricing)

Prompt caching with OpenAI is automated and does not require any additional configuration. There is a minimum prompt size of 1024 tokens.

[Click here to read more about OpenAI prompt caching and its limitation.](https://platform.openai.com/docs/guides/prompt-caching)

## Grok

Caching price changes:

- **Cache writes**: no cost
- **Cache reads**: charged at {GROK_CACHE_READ_MULTIPLIER}x the price of the original input pricing

[Click here to view Grok's cache pricing per model.](https://docs.x.ai/docs/models#models-and-pricing)

Prompt caching with Grok is automated and does not require any additional configuration.

## Moonshot AI

Caching price changes:

- **Cache writes**: no cost
- **Cache reads**: charged at {MOONSHOT_CACHE_READ_MULTIPLIER}x the price of the original input pricing

Prompt caching with Moonshot AI is automated and does not require any additional configuration.

[Click here to view Moonshot AI's caching documentation.](https://platform.moonshot.ai/docs/api/caching)

## Groq

Caching price changes:

- **Cache writes**: no cost
- **Cache reads**: charged at {GROQ_CACHE_READ_MULTIPLIER}x the price of the original input pricing

Prompt caching with Groq is automated and does not require any additional configuration. Currently available on Kimi K2 models.

[Click here to view Groq's documentation.](https://console.groq.com/docs/prompt-caching)

## Anthropic Claude

Caching price changes:

- **Cache writes**: charged at {ANTHROPIC_CACHE_WRITE_MULTIPLIER}x the price of the original input pricing
- **Cache reads**: charged at {ANTHROPIC_CACHE_READ_MULTIPLIER}x the price of the original input pricing

Prompt caching with Anthropic requires the use of `cache_control` breakpoints. There is a limit of four breakpoints, and the cache will expire within five minutes. Therefore, it is recommended to reserve the cache breakpoints for large bodies of text, such as character cards, CSV data, RAG data, book chapters, etc.

[Click here to read more about Anthropic prompt caching and its limitation.](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

The `cache_control` breakpoint can only be inserted into the text part of a multipart message.

System message caching example:

```json
{
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a historian studying the fall of the Roman Empire. You know the following book very well:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What triggered the collapse?"
        }
      ]
    }
  ]
}
```

User message caching example:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Given the book below:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY",
          "cache_control": {
            "type": "ephemeral"
          }
        },
        {
          "type": "text",
          "text": "Name all the characters in the above book"
        }
      ]
    }
  ]
}
```

## DeepSeek

Caching price changes:

- **Cache writes**: charged at the same price as the original input pricing
- **Cache reads**: charged at {DEEPSEEK_CACHE_READ_MULTIPLIER}x the price of the original input pricing

Prompt caching with DeepSeek is automated and does not require any additional configuration.

## Google Gemini

### Implicit Caching

Gemini 2.5 Pro and 2.5 Flash models now support **implicit caching**, providing automatic caching functionality similar to OpenAI’s automatic caching. Implicit caching works seamlessly — no manual setup or additional `cache_control` breakpoints required.

Pricing Changes:

- No cache write or storage costs.
- Cached tokens are charged at {GOOGLE_CACHE_READ_MULTIPLIER}x the original input token cost.

Note that the TTL is on average 3-5 minutes, but will vary. There is a minimum of {GOOGLE_CACHE_MIN_TOKENS_2_5_FLASH} tokens for Gemini 2.5 Flash, and {GOOGLE_CACHE_MIN_TOKENS_2_5_PRO} tokens for Gemini 2.5 Pro for requests to be eligible for caching.

[Official announcement from Google](https://developers.googleblog.com/en/gemini-2-5-models-now-support-implicit-caching/)

<Tip>
  To maximize implicit cache hits, keep the initial portion of your message
  arrays consistent between requests. Push variations (such as user questions or
  dynamic context elements) toward the end of your prompt/requests.
</Tip>

### Pricing Changes for Cached Requests:

- **Cache Writes:** Charged at the input token cost plus 5 minutes of cache storage, calculated as follows:

```
Cache write cost = Input token price + (Cache storage price × (5 minutes / 60 minutes))
```

- **Cache Reads:** Charged at {GOOGLE_CACHE_READ_MULTIPLIER}× the original input token cost.

### Supported Models and Limitations:

Only certain Gemini models support caching. Please consult Google's [Gemini API Pricing Documentation](https://ai.google.dev/gemini-api/docs/pricing) for the most current details.

Cache Writes have a 5 minute Time-to-Live (TTL) that does not update. After 5 minutes, the cache expires and a new cache must be written.

Gemini models have typically have a 4096 token minimum for cache write to occur. Cached tokens count towards the model's maximum token usage. Gemini 2.5 Pro has a minimum of {GOOGLE_CACHE_MIN_TOKENS_2_5_PRO} tokens, and Gemini 2.5 Flash has a minimum of {GOOGLE_CACHE_MIN_TOKENS_2_5_FLASH} tokens.

### How Gemini Prompt Caching works on OpenRouter:

OpenRouter simplifies Gemini cache management, abstracting away complexities:

- You **do not** need to manually create, update, or delete caches.
- You **do not** need to manage cache names or TTL explicitly.

### How to Enable Gemini Prompt Caching:

Gemini caching in OpenRouter requires you to insert `cache_control` breakpoints explicitly within message content, similar to Anthropic. We recommend using caching primarily for large content pieces (such as CSV files, lengthy character cards, retrieval augmented generation (RAG) data, or extensive textual sources).

<Tip>
  There is not a limit on the number of `cache_control` breakpoints you can
  include in your request. OpenRouter will use only the last breakpoint for
  Gemini caching. Including multiple breakpoints is safe and can help maintain
  compatibility with Anthropic, but only the final one will be used for Gemini.
</Tip>

### Examples:

#### System Message Caching Example

```json
{
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a historian studying the fall of the Roman Empire. Below is an extensive reference book:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY HERE",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What triggered the collapse?"
        }
      ]
    }
  ]
}
```

#### User Message Caching Example

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Based on the book text below:"
        },
        {
          "type": "text",
          "text": "HUGE TEXT BODY HERE",
          "cache_control": {
            "type": "ephemeral"
          }
        },
        {
          "type": "text",
          "text": "List all main characters mentioned in the text above."
        }
      ]
    }
  ]
}
```
