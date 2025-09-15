import { describe, it, expect } from 'vitest';
import {
  extractCommentsMarkdown,
  findCommentContainers,
  findCommentItems,
} from '../../../../src/content/extraction/analyzers/discussionExtractor';

function makeDoc(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('discussionExtractor', () => {
  it('finds comments in a simple forum structure', async () => {
    const doc = makeDoc(`
      <html><body>
        <article id="post"><h1>Main Thread</h1><p>Body content here</p></article>
        <section id="comments">
          <ul class="comment-list">
            <li class="comment">
              <div class="comment-body">
                <span class="author">alice</span>
                <time datetime="2025-09-14T12:00:00Z">yesterday</time>
                <p>This is a useful comment with enough length to keep.</p>
              </div>
            </li>
            <li class="comment">
              <div class="comment-body">
                <span class="author">bob</span>
                <time datetime="2025-09-14T12:05:00Z">yesterday</time>
                <p>Another thoughtful reply adding more details to the thread.</p>
              </div>
            </li>
            <li class="comment">
              <div class="comment-body">
                <span class="author">carol</span>
                <time datetime="2025-09-14T12:06:00Z">yesterday</time>
                <p>Short but still over the threshold comment.</p>
              </div>
            </li>
          </ul>
        </section>
      </body></html>
    `);

    const containers = findCommentContainers(doc);
    expect(containers.length).toBeGreaterThan(0);

    const items = findCommentItems(containers[0]);
    expect(items.length).toBe(3);

    const result = await extractCommentsMarkdown(doc, false);
    expect(result.count).toBe(3);
    expect(result.markdown).toMatch(/##?/); // contains headings
    expect(result.markdown).toMatch(/alice/);
    expect(result.markdown).toMatch(/bob/);
    expect(result.markdown).toMatch(/carol/);
    expect(result.textContent).toMatch(/useful comment/);
  });

  it('returns empty when no comments found', async () => {
    const doc = makeDoc(`<html><body><article><h1>Post</h1><p>Content</p></article></body></html>`);
    const result = await extractCommentsMarkdown(doc, false);
    expect(result.count).toBe(0);
    expect(result.markdown).toBe('');
  });
});
