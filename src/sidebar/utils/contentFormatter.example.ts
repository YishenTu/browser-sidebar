/**
 * Example output of the new content formatter
 * Clean markdown with minimal XML tags as separators
 * Includes browser context instruction for clarity
 *
 * Note: Dynamic content changes based on:
 * - Number of tabs (1 web page vs 2+ web pages)
 * - Presence of text selection(s) - marked within tab content
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
 * Example with single tab and no selection
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
 * Example with multiple tabs having multiple selections
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
 * Benefits of the new structure:
 *
 * 1. **Clear Separation**: Three distinct parts with XML labels
 *    - <system_instruction>: System instruction explaining the context with dynamic text
 *    - <tab_content>: The actual tab content with structured metadata
 *    - <user_query>: The user's actual question
 *
 * 2. **Dynamic Context**: System instruction adapts based on:
 *    - Number of tabs (singular/plural forms)
 *    - Presence of text selection(s) - simply mentions they are marked in content
 *
 * 3. **Better Organization**: Each tab is a separate XML element with:
 *    - Structured metadata (title, url, domain)
 *    - Content with "Selected Content" and "Full Page Content" sections when applicable
 *    - Content properly escaped for XML
 *
 * 4. **Easier Parsing**: AI providers can easily:
 *    - Extract specific tab content
 *    - Understand the context before the query
 *    - Focus on selected content when present
 *    - Process the user question at the end
 *
 * 5. **Truncation Support**: When content is truncated:
 *    - Individual tabs can be marked as truncated
 *    - A truncation notice is included
 *    - Metadata shows which tabs were omitted
 *
 * 6. **Simple Selection Handling**:
 *    - No complex logic for tracking which tabs have selections
 *    - Just mentions selections are marked within the content
 */

export { exampleOutput, exampleSingleTab, exampleMultipleSelections };
