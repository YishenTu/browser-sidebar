/**
 * Example outputs for the tab content formatter (XML-style structure).
 *
 * Format:
 * <system_instruction> ... </system_instruction>
 * <tab_content>
 *   <tab> ... </tab>
 * </tab_content>
 * <user_query> ... </user_query>
 *
 * Images remain out-of-band (provided via message metadata attachments).
 */

const exampleOutput = `
<system_instruction>
The user is viewing 2 web pages in the browser.
Sources: example.com, documentation.dev
Below is the extracted content from these tabs. Selected portions are marked within the tab content, followed by the user's query about it.
Please analyze the provided content to answer the user's query, and do prioritize consideration of the selected content.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Example Product Documentation</title>
    <url>https://example.com/docs/getting-started</url>
    <domain>example.com</domain>
  </metadata>
  <content>
## Selected Content

Quick Setup

1. Import the library in your project:
   \`\`\`javascript
   import { ExampleProduct } from 'example-product';
   \`\`\`

2. Initialize with your configuration:
   \`\`\`javascript
   const example = new ExampleProduct({
     apiKey: 'your-api-key',
     region: 'us-west-2'
   });
   \`\`\`

---

## Full Page Content

# Getting Started with Example Product

Welcome to the Example Product documentation. This guide will help you get up and running quickly.

## Installation

To install Example Product, you can use npm:

\`\`\`bash
npm install example-product
\`\`\`

## Quick Setup

1. Import the library in your project:
   \`\`\`javascript
   import { ExampleProduct } from 'example-product';
   \`\`\`

2. Initialize with your configuration:
   \`\`\`javascript
   const example = new ExampleProduct({
     apiKey: 'your-api-key',
     region: 'us-west-2'
   });
   \`\`\`

## Advanced Configuration

For more complex setups, you can customize various options...
  </content>
</tab>

<tab>
  <metadata>
    <title>API Reference - Example Product</title>
    <url>https://documentation.dev/api/v2/reference</url>
    <domain>documentation.dev</domain>
  </metadata>
  <content>
# API Reference

## Core Methods

### initialize(config)
Initializes the Example Product instance with the provided configuration.

**Parameters:**
- \`config\` (Object): Configuration object
  - \`apiKey\` (string): Your API key
  - \`region\` (string): AWS region (default: 'us-east-1')
  - \`timeout\` (number): Request timeout in milliseconds (default: 5000)

**Returns:** Promise<Instance>

### process(data)
Processes the input data according to the configured rules.

**Parameters:**
- \`data\` (Object|Array): The data to process

**Returns:** Promise<ProcessedResult>

## Error Handling

All methods return promises that may reject with the following error types:
- \`AuthenticationError\`: Invalid or missing API key
- \`ValidationError\`: Invalid input parameters
- \`NetworkError\`: Connection or timeout issues
  </content>
</tab>
</tab_content>

<user_query>
How do I initialize this product with my API key?
</user_query>
`;

/**
 * Example with no tabs loaded.
 */
const exampleNoTabs = `
<system_instruction>
You are a helpful assistant.
</system_instruction>

<user_query>
What is the weather like today?
</user_query>
`;

/**
 * Example with a single tab and no selection.
 */
const exampleSingleTab = `
<system_instruction>
The user is viewing 1 web page in the browser.
Source: example.com
Below is the extracted content from this tab, followed by the user's query about it.
Please analyze the provided content to answer the user's query.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Example Page</title>
    <url>https://example.com/page</url>
    <domain>example.com</domain>
  </metadata>
  <content>
Page content here...
  </content>
</tab>
</tab_content>

<user_query>
What is this page about?
</user_query>
`;

/**
 * Example with multiple tabs and selections.
 */
const exampleMultipleSelections = `
<system_instruction>
The user is viewing 3 web pages in the browser.
Sources: example.com, documentation.dev, api.example.org
Below is the extracted content from these tabs. Selected portions are marked within the tab content, followed by the user's query about it.
Please analyze the provided content to answer the user's query, and do prioritize consideration of the selected content.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Example Product Documentation</title>
    <url>https://example.com/docs/getting-started</url>
    <domain>example.com</domain>
  </metadata>
  <content>
## Selected Content

To initialize the product, use the following configuration...

---

## Full Page Content

# Getting Started

To initialize the product, use the following configuration...

More content here...
  </content>
</tab>

<tab>
  <metadata>
    <title>API Reference</title>
    <url>https://documentation.dev/api/reference</url>
    <domain>documentation.dev</domain>
  </metadata>
  <content>
## Selected Content

The initialize() method accepts a config object with required apiKey field...

---

## Full Page Content

# API Methods

Some content...

The initialize() method accepts a config object with required apiKey field...

More content...
  </content>
</tab>

<tab>
  <metadata>
    <title>Examples Gallery</title>
    <url>https://api.example.org/examples</url>
    <domain>api.example.org</domain>
  </metadata>
  <content>
# Code Examples

Various code examples without any selection...
  </content>
</tab>
</tab_content>

<user_query>
How do these initialization methods relate to each other?
</user_query>
`;

/**
 * Example showing how images are handled (text only here; images in metadata).
 */
const exampleWithImage = {
  formattedContent: `
<system_instruction>
The user is viewing 1 web page in the browser.
Source: example.com
Below is the extracted content from this tab, followed by the user's query about it.
Please analyze the provided content to answer the user's query.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Product Page</title>
    <url>https://example.com/product</url>
    <domain>example.com</domain>
  </metadata>
  <content>
Product details and specifications...
  </content>
</tab>
</tab_content>

<user_query>
What's different between this image and the product shown on the page?
</user_query>
`,
  metadata: {
    attachments: [
      {
        type: 'image',
        mimeType: 'image/png',
        fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
        fileId: 'file-xyz789',
      },
    ],
  },
  aiProviderMessage: {
    role: 'user',
    content: '...formatted content above...',
    metadata: {
      attachments: [
        /* image attachments */
      ],
    },
  },
};

/**
 * Example with YouTube video (Gemini only).
 */
const exampleYouTubeVideo = `
<system_instruction>
The user is viewing 1 web page in the browser.
Source: youtube.com
A YouTube video is provided below, followed by the user's query about it.
Please analyze the provided video to answer the user's query.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Introduction to Machine Learning</title>
    <url>https://www.youtube.com/watch?v=abc123xyz</url>
    <domain>youtube.com</domain>
  </metadata>
  <content type="video">
    <fileUri>https://www.youtube.com/watch?v=abc123xyz</fileUri>
  </content>
</tab>
</tab_content>

<user_query>
Summarize the key concepts explained in this video.
</user_query>
`;

/**
 * Example with mixed YouTube videos and regular content.
 */
const exampleMixedContent = `
<system_instruction>
The user is viewing 2 web pages in the browser.
Sources: youtube.com, example.com
Below are a YouTube video and a web page with extracted content, followed by the user's query about them.
Please analyze the provided content to answer the user's query.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Machine Learning Tutorial</title>
    <url>https://www.youtube.com/watch?v=abc123xyz</url>
    <domain>youtube.com</domain>
  </metadata>
  <content type="video">
    <fileUri>https://www.youtube.com/watch?v=abc123xyz</fileUri>
  </content>
</tab>

<tab>
  <metadata>
    <title>ML Documentation</title>
    <url>https://example.com/ml-docs</url>
    <domain>example.com</domain>
  </metadata>
  <content>
# Machine Learning Basics

Machine learning is a subset of artificial intelligence that focuses on...
  </content>
</tab>
</tab_content>

<user_query>
How does the video tutorial relate to the concepts in the documentation?
</user_query>
`;

/**
 * Example with URL Context (Gemini only - for live/dynamic content).
 */
const exampleUrlContext = `
<system_instruction>
The user is viewing 2 web pages in the browser.
Sources: example.com, api.example.com
Below is the extracted content from these tabs, followed by the user's query about it.
Please analyze the provided content to answer the user's query.
Use \`url_context\` tool to fetch web content from the URL in tab metadata for tabs marked with URL Context.
</system_instruction>

<tab_content>
<tab>
  <metadata>
    <title>Live Stock Prices</title>
    <url>https://example.com/stocks/live</url>
    <domain>example.com</domain>
  </metadata>
</tab>

<tab>
  <metadata>
    <title>Stock Analysis Guide</title>
    <url>https://api.example.com/docs/analysis</url>
    <domain>api.example.com</domain>
  </metadata>
  <content>
# Stock Analysis Guide

When analyzing stock performance, consider these key metrics...
  </content>
</tab>
</tab_content>

<user_query>
What are the current stock prices and how do they compare to the analysis recommendations?
</user_query>
`;

export {
  exampleOutput,
  exampleNoTabs,
  exampleSingleTab,
  exampleMultipleSelections,
  exampleWithImage,
  exampleYouTubeVideo,
  exampleMixedContent,
  exampleUrlContext,
};
