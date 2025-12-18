/**
 * @file HTML Fixtures
 *
 * Test fixtures for HTML samples used in markdown conversion tests.
 * Includes various HTML patterns for testing extraction and conversion.
 */

// =============================================================================
// Basic HTML Fixtures
// =============================================================================

/**
 * Simple paragraph HTML.
 */
export const simpleParagraph = '<p>Hello, world!</p>';

/**
 * Multiple paragraphs.
 */
export const multipleParagraphs = `
<p>First paragraph with some text.</p>
<p>Second paragraph with more text.</p>
<p>Third paragraph to complete the set.</p>
`;

/**
 * Headings hierarchy.
 */
export const headings = `
<h1>Main Title</h1>
<h2>Section One</h2>
<p>Content under section one.</p>
<h2>Section Two</h2>
<p>Content under section two.</p>
<h3>Subsection</h3>
<p>Content under subsection.</p>
`;

/**
 * Expected markdown for headings.
 */
export const headingsExpectedMarkdown = `# Main Title

## Section One

Content under section one.

## Section Two

Content under section two.

### Subsection

Content under subsection.`;

// =============================================================================
// Lists
// =============================================================================

/**
 * Unordered list.
 */
export const unorderedList = `
<ul>
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
`;

/**
 * Ordered list.
 */
export const orderedList = `
<ol>
  <li>First step</li>
  <li>Second step</li>
  <li>Third step</li>
</ol>
`;

/**
 * Nested lists.
 */
export const nestedLists = `
<ul>
  <li>Item one
    <ul>
      <li>Nested item A</li>
      <li>Nested item B</li>
    </ul>
  </li>
  <li>Item two</li>
</ul>
`;

// =============================================================================
// Links and Images
// =============================================================================

/**
 * Simple link.
 */
export const simpleLink = '<a href="https://example.com">Example Link</a>';

/**
 * Link with title.
 */
export const linkWithTitle = '<a href="https://example.com" title="Example Site">Example Link</a>';

/**
 * Multiple links in text.
 */
export const textWithLinks = `
<p>Visit <a href="https://google.com">Google</a> or <a href="https://github.com">GitHub</a> for more info.</p>
`;

/**
 * Simple image.
 */
export const simpleImage = '<img src="https://example.com/image.png" alt="Example Image">';

/**
 * Image with dimensions.
 */
export const imageWithDimensions =
  '<img src="https://example.com/photo.jpg" alt="Photo" width="800" height="600">';

/**
 * Figure with caption.
 */
export const figureWithCaption = `
<figure>
  <img src="https://example.com/chart.png" alt="Chart">
  <figcaption>Figure 1: Sales chart for Q4</figcaption>
</figure>
`;

// =============================================================================
// Code Blocks
// =============================================================================

/**
 * Inline code.
 */
export const inlineCode = '<p>Use the <code>console.log()</code> function to debug.</p>';

/**
 * Code block without language.
 */
export const codeBlockNoLanguage = `
<pre><code>function hello() {
  return "world";
}</code></pre>
`;

/**
 * Code block with language class.
 */
export const codeBlockWithLanguage = `
<pre><code class="language-javascript">function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");</code></pre>
`;

/**
 * Code block with highlight.js class.
 */
export const codeBlockHighlightJs = `
<pre><code class="hljs language-typescript">interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = {
  id: 1,
  name: "John",
  email: "john@example.com"
};</code></pre>
`;

/**
 * Code block with data-language attribute.
 */
export const codeBlockDataLanguage = `
<pre><code data-language="python">def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))</code></pre>
`;

/**
 * Multiple code blocks.
 */
export const multipleCodeBlocks = `
<p>Here is JavaScript:</p>
<pre><code class="language-javascript">const x = 1;</code></pre>
<p>And here is Python:</p>
<pre><code class="language-python">x = 1</code></pre>
`;

/**
 * Expected markdown for code block with language.
 */
export const codeBlockExpectedMarkdown = `\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");
\`\`\``;

// =============================================================================
// Tables
// =============================================================================

/**
 * Simple table.
 */
export const simpleTable = `
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Age</th>
      <th>City</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alice</td>
      <td>30</td>
      <td>New York</td>
    </tr>
    <tr>
      <td>Bob</td>
      <td>25</td>
      <td>San Francisco</td>
    </tr>
  </tbody>
</table>
`;

/**
 * Table without thead.
 */
export const tableWithoutThead = `
<table>
  <tr>
    <td>Cell 1</td>
    <td>Cell 2</td>
  </tr>
  <tr>
    <td>Cell 3</td>
    <td>Cell 4</td>
  </tr>
</table>
`;

/**
 * Complex table with colspan/rowspan.
 */
export const complexTable = `
<table>
  <thead>
    <tr>
      <th colspan="2">Header Spanning Two Columns</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">Merged Row</td>
      <td>Value 1</td>
    </tr>
    <tr>
      <td>Value 2</td>
    </tr>
  </tbody>
</table>
`;

/**
 * Expected markdown for simple table.
 */
export const simpleTableExpectedMarkdown = `| Name | Age | City |
| --- | --- | --- |
| Alice | 30 | New York |
| Bob | 25 | San Francisco |`;

// =============================================================================
// Blockquotes
// =============================================================================

/**
 * Simple blockquote.
 */
export const simpleBlockquote = '<blockquote>This is a quoted text.</blockquote>';

/**
 * Nested blockquote.
 */
export const nestedBlockquote = `
<blockquote>
  <p>Outer quote</p>
  <blockquote>
    <p>Inner quote</p>
  </blockquote>
</blockquote>
`;

/**
 * Blockquote with attribution.
 */
export const blockquoteWithAttribution = `
<blockquote>
  <p>The only way to do great work is to love what you do.</p>
  <footer>— Steve Jobs</footer>
</blockquote>
`;

// =============================================================================
// Formatting
// =============================================================================

/**
 * Text formatting elements.
 */
export const textFormatting = `
<p>
  This text is <strong>bold</strong> and this is <em>italic</em>.
  You can also have <strong><em>bold italic</em></strong> text.
  Here is <del>strikethrough</del> and <u>underlined</u> text.
</p>
`;

/**
 * Subscript and superscript.
 */
export const subSuperScript = `
<p>H<sub>2</sub>O is water. E = mc<sup>2</sup> is Einstein's equation.</p>
`;

/**
 * Horizontal rule.
 */
export const horizontalRule = `
<p>First section</p>
<hr>
<p>Second section</p>
`;

// =============================================================================
// Embeds
// =============================================================================

/**
 * YouTube embed (iframe).
 */
export const youtubeEmbed = `
<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen>
</iframe>
`;

/**
 * Twitter embed.
 */
export const twitterEmbed = `
<blockquote class="twitter-tweet">
  <p lang="en" dir="ltr">Hello Twitter!</p>
  &mdash; Test User (@testuser) <a href="https://twitter.com/testuser/status/123456789">January 1, 2024</a>
</blockquote>
`;

/**
 * Video element.
 */
export const videoElement = `
<video controls width="640" height="360">
  <source src="https://example.com/video.mp4" type="video/mp4">
  <source src="https://example.com/video.webm" type="video/webm">
  Your browser does not support the video tag.
</video>
`;

// =============================================================================
// Complex Documents
// =============================================================================

/**
 * Article with various elements.
 */
export const articleDocument = `
<article>
  <header>
    <h1>Understanding TypeScript</h1>
    <p class="meta">Published on January 15, 2024 by John Doe</p>
  </header>

  <p>TypeScript is a strongly typed programming language that builds on JavaScript.</p>

  <h2>Why Use TypeScript?</h2>
  <p>There are several reasons to use TypeScript:</p>
  <ul>
    <li>Type safety</li>
    <li>Better IDE support</li>
    <li>Easier refactoring</li>
  </ul>

  <h2>Example Code</h2>
  <pre><code class="language-typescript">interface Person {
  name: string;
  age: number;
}

function greet(person: Person): string {
  return \`Hello, \${person.name}!\`;
}</code></pre>

  <blockquote>
    <p>"TypeScript has become an essential tool for modern web development."</p>
  </blockquote>

  <footer>
    <p>Tags: <a href="/tags/typescript">TypeScript</a>, <a href="/tags/javascript">JavaScript</a></p>
  </footer>
</article>
`;

/**
 * Full webpage structure.
 */
export const fullWebpage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Page</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>
    <h1>Welcome</h1>
    <p>This is the main content area.</p>
  </main>
  <aside>
    <h2>Related Links</h2>
    <ul>
      <li><a href="/link1">Link 1</a></li>
      <li><a href="/link2">Link 2</a></li>
    </ul>
  </aside>
  <footer>
    <p>&copy; 2024 Example Inc.</p>
  </footer>
</body>
</html>
`;

// =============================================================================
// Edge Cases
// =============================================================================

/**
 * Empty elements.
 */
export const emptyElements = `
<p></p>
<div></div>
<span></span>
<p>   </p>
`;

/**
 * HTML with comments.
 */
export const htmlWithComments = `
<!-- This is a comment -->
<p>Visible text</p>
<!-- Another comment
     spanning multiple lines -->
<p>More visible text</p>
`;

/**
 * HTML with scripts and styles (should be stripped).
 */
export const htmlWithScriptsAndStyles = `
<style>
  .highlight { color: red; }
</style>
<p class="highlight">Important text</p>
<script>
  console.log("This should be removed");
</script>
`;

/**
 * Malformed HTML (unclosed tags).
 */
export const malformedHtml = `
<p>Paragraph without closing tag
<div>Div with <span>unclosed span
<p>Another paragraph
`;

/**
 * HTML entities.
 */
export const htmlEntities = `
<p>&lt;script&gt;alert('XSS')&lt;/script&gt;</p>
<p>Copyright &copy; 2024</p>
<p>&quot;Quoted text&quot; and &apos;apostrophes&apos;</p>
<p>Space:&nbsp;&nbsp;&nbsp;Multiple non-breaking spaces</p>
`;

/**
 * HTML with data attributes.
 */
export const htmlWithDataAttributes = `
<div data-testid="container" data-value="123">
  <p data-highlight="true">Text with data attributes</p>
</div>
`;

/**
 * Deeply nested structure.
 */
export const deeplyNested = `
<div>
  <div>
    <div>
      <div>
        <div>
          <p>Deeply nested paragraph</p>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// =============================================================================
// Special Content
// =============================================================================

/**
 * Footnotes (academic style).
 */
export const footnotes = `
<p>This is some text with a footnote<sup><a href="#fn1" id="ref1">1</a></sup>.</p>
<p>And another reference<sup><a href="#fn2" id="ref2">2</a></sup>.</p>
<hr>
<ol>
  <li id="fn1">First footnote content. <a href="#ref1">↩</a></li>
  <li id="fn2">Second footnote content. <a href="#ref2">↩</a></li>
</ol>
`;

/**
 * Definition list.
 */
export const definitionList = `
<dl>
  <dt>HTML</dt>
  <dd>HyperText Markup Language</dd>
  <dt>CSS</dt>
  <dd>Cascading Style Sheets</dd>
  <dt>JS</dt>
  <dd>JavaScript</dd>
</dl>
`;

/**
 * Details/Summary (expandable content).
 */
export const detailsSummary = `
<details>
  <summary>Click to expand</summary>
  <p>This is the hidden content that appears when expanded.</p>
</details>
`;

/**
 * Keyboard input elements.
 */
export const keyboardInputs = `
<p>Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy and <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste.</p>
`;

/**
 * Math content (MathML or LaTeX-like).
 */
export const mathContent = `
<p>The quadratic formula is: <math><mi>x</mi><mo>=</mo><mfrac><mrow><mo>-</mo><mi>b</mi><mo>±</mo><msqrt><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></math></p>
`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Wrap content in a basic HTML document structure.
 */
export function wrapInDocument(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>${content}</body>
</html>`;
}

/**
 * Create a paragraph with specified text.
 */
export function createParagraph(text: string): string {
  return `<p>${text}</p>`;
}

/**
 * Create a code block with language.
 */
export function createCodeBlock(code: string, language?: string): string {
  const langClass = language ? ` class="language-${language}"` : '';
  return `<pre><code${langClass}>${code}</code></pre>`;
}

/**
 * Create a link element.
 */
export function createLink(url: string, text: string, title?: string): string {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${url}"${titleAttr}>${text}</a>`;
}

/**
 * Create an unordered list from items.
 */
export function createList(items: string[]): string {
  const listItems = items.map(item => `<li>${item}</li>`).join('\n');
  return `<ul>\n${listItems}\n</ul>`;
}
