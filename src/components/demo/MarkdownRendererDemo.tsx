/**
 * @file MarkdownRenderer Demo Component
 *
 * Demo component to showcase the MarkdownRenderer functionality
 * with various markdown examples.
 */

import React from 'react';
import { MarkdownRenderer } from '@/components/Chat/MarkdownRenderer';

const markdownExample = `
# MarkdownRenderer Demo

This is a demonstration of the **MarkdownRenderer** component with various markdown features.

## Code Blocks

Here's a JavaScript code block with syntax highlighting:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // Output: 55
\`\`\`

And here's some Python code:

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
\`\`\`

## Lists

### Unordered List
- Item 1
- Item 2  
- Item 3

### Ordered List
1. First item
2. Second item
3. Third item

## Blockquotes

> This is a blockquote. It's useful for highlighting important information 
> or quoting text from other sources.

## Links

Here are some links:
- [Safe external link](https://github.com)
- [Another safe link](https://react.dev)

## Text Formatting

**Bold text** and *italic text* and ***bold italic text***.

You can also use \`inline code\` within text.

## Tables (if supported)

| Feature | Status |
|---------|--------|
| Syntax Highlighting | ✅ |
| XSS Protection | ✅ |
| Custom Styling | ✅ |

---

This horizontal rule separates sections nicely!
`;

export const MarkdownRendererDemo: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">MarkdownRenderer Demo</h1>
        <p className="text-gray-600 dark:text-gray-400">
          This demo showcases the MarkdownRenderer component with syntax highlighting, XSS
          protection, and custom styling.
        </p>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <MarkdownRenderer content={markdownExample} className="markdown-content" />
      </div>
    </div>
  );
};

export default MarkdownRendererDemo;
