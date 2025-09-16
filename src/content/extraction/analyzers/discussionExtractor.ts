/**
 * @file Discussion/Comments Extractor
 *
 * Heuristic extractor for forum/blog comment threads and discussions.
 * Designed to complement Readability by appending comment content so that
 * the final extraction includes both the main article and its discussion.
 */

import { htmlToMarkdown } from '@core/extraction/markdownConverter';

export interface ExtractedDiscussion {
  markdown: string;
  textContent: string;
  count: number;
}

/**
 * Extracts comments/discussion from a Document and returns markdown + text.
 *
 * The algorithm uses conservative heuristics:
 * - Find likely comment containers by common IDs/classes/tags
 * - Within each container, gather repeated comment "items"
 * - Ignore items with very short text (< 25 chars) to avoid UI noise
 * - De-duplicate nodes and preserve original order
 *
 * @param rootDoc Document to scan (defaults to global document)
 * @param includeLinks Whether to keep links in markdown
 */
export async function extractCommentsMarkdown(
  rootDoc: Document = document,
  includeLinks = false
): Promise<ExtractedDiscussion> {
  try {
    const containers = findCommentContainers(rootDoc);

    // If no obvious containers, try to detect repeated comment items globally
    const items = new Set<Element>();
    if (containers.length === 0) {
      for (const el of findCommentItems(rootDoc)) items.add(el);
    } else {
      for (const c of containers) {
        for (const el of findCommentItems(c)) items.add(el);
      }
    }

    // Filter, normalize order, and build markdown sections
    const ordered = Array.from(items).filter(Boolean);

    // Short-circuit if we clearly didn't find a thread
    if (ordered.length === 0) {
      return { markdown: '', textContent: '', count: 0 };
    }

    // Extract minimal metadata and body for each comment
    const parts: string[] = [];
    const texts: string[] = [];
    let kept = 0;

    for (const node of ordered) {
      const { author, timestamp, body } = pickCommentSubtree(node);

      const text = (body?.textContent || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 25) continue; // too short; likely UI-only

      const headerBits: string[] = [];
      if (author) headerBits.push(author);
      if (timestamp) headerBits.push(timestamp);
      const header = headerBits.length
        ? `### Comment ${kept + 1} — ${headerBits.join(' • ')}`
        : `### Comment ${kept + 1}`;

      const html = body ? body.innerHTML : (node as Element).innerHTML;
      const md = await htmlToMarkdown(html, { includeLinks });
      parts.push(`${header}\n\n${md}`);
      texts.push(text);
      kept++;
    }

    if (kept === 0) {
      return { markdown: '', textContent: '', count: 0 };
    }

    const markdown = parts.join('\n\n');
    const textContent = texts.join('\n');
    return { markdown, textContent, count: kept };
  } catch (_e) {
    // Fail closed: don't break main extraction if comments fail
    return { markdown: '', textContent: '', count: 0 };
  }
}

/**
 * Finds likely comment containers by common selectors.
 */
export function findCommentContainers(root: ParentNode): Element[] {
  const selectors = [
    // Generic
    '#comments',
    'section#comments',
    'section.comments',
    '.comments',
    '[role="comments"]',
    '[aria-label="Comments"]',
    '[aria-label="comments"]',
    '#replies',
    '.replies',
    '#discussion',
    '.discussion',
    '.discussion-thread',
    '#conversation',
    '.conversation',
    '.thread',
    '.thread-container',
    // Blogs / CMS
    'ol.comment-list',
    'ul.comment-list',
    '.comment-list',
    // GitHub / GitLab-like
    '.timeline-comment',
    '.js-discussion',
    '.discussion-timeline',
    // Reddit (new & old)
    'shreddit-app',
    'shreddit-comment',
    'faceplate-thread',
    'faceplate-comment',
    // YouTube
    'ytd-comments',
    'ytd-comment-thread-renderer',
    // Discourse
    '.post-stream',
    '.topic-posts',
  ];

  const hits: Element[] = [];
  for (const sel of selectors) {
    try {
      root.querySelectorAll(sel).forEach(el => hits.push(el));
    } catch {
      // ignore invalid selectors
    }
  }

  // De-duplicate while preserving order
  const result: Element[] = [];
  const seen = new Set<Element>();
  for (const el of hits) {
    if (!seen.has(el)) {
      seen.add(el);
      result.push(el);
    }
  }
  return result;
}

/**
 * Finds individual comment items either under a container or across the document.
 */
export function findCommentItems(root: ParentNode): Element[] {
  const itemSelectors = [
    // Generic comment/reply items
    'article.comment',
    'li.comment',
    'div.comment',
    'div.comment-item',
    'div.reply',
    'li.reply',
    '.comment-body',
    '.comment__body',
    '.reply-body',
    // GitHub-like
    '.timeline-comment',
    '.js-comment',
    '.comment-body markdown-body',
    '.review-comment',
    // Reddit-like
    'shreddit-comment',
    'faceplate-comment',
    'div[data-test-id="comment"]',
    // YouTube
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
    // Discourse
    '.topic-post',
    '.cooked',
    // StackOverflow/StackExchange
    '#answers .answer',
    '.comment-copy',
  ];

  const hits: Element[] = [];
  for (const sel of itemSelectors) {
    try {
      root.querySelectorAll(sel).forEach(el => hits.push(el));
    } catch {
      // ignore invalid selectors
    }
  }

  // If no direct matches, try repeated children under obvious containers
  if (hits.length === 0 && root instanceof Element) {
    const childGroups = Array.from(root.children);
    // Heuristic: siblings with class/id containing 'comment' or 'reply'
    for (const child of childGroups) {
      const label = `${child.className} ${child.id}`.toLowerCase();
      if (label.includes('comment') || label.includes('reply')) {
        hits.push(child);
      }
    }
  }

  // Deduplicate while preserving DOM order
  const deduped: Element[] = [];
  const seen = new Set<Element>();
  for (const el of hits) {
    if (!seen.has(el)) {
      seen.add(el);
      deduped.push(el);
    }
  }

  // Filter out nested matches so only the outermost comment container is kept
  const filtered = deduped.filter(el => !deduped.some(other => other !== el && other.contains(el)));
  return filtered;
}

/**
 * Attempts to pick a meaningful subtree for a comment: author, timestamp, body.
 */
function pickCommentSubtree(node: Element): {
  author?: string;
  timestamp?: string;
  body?: Element;
} {
  // Body candidates by common class names
  const bodySelectors = [
    '.comment-body',
    '.comment__body',
    '.md',
    '.content',
    '.text',
    '.post',
    '.message',
    '.cooked',
    '.usertext-body',
    '.s1us1wxs-0',
    '.s1us1wxs-1',
    '.bbWrapper',
    '.prose',
    '.markdown-body',
  ];

  let body: Element | undefined;
  for (const sel of bodySelectors) {
    const el = node.querySelector(sel);
    if (el) {
      body = el as Element;
      break;
    }
  }
  if (!body) body = node as Element;

  // Author selectors
  const authorSelectors = [
    'a.author',
    '.author',
    '.username',
    '.user',
    '.comment-author',
    'a[href*="/user/"]',
    'a[href*="/u/"]',
    'a[href*="/profile"]',
    '.hnuser',
    'a.author-link',
    'strong.author',
  ];
  let author: string | undefined;
  for (const sel of authorSelectors) {
    const el = node.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text) {
      author = text;
      break;
    }
  }

  // Timestamp selectors
  const timeSelectors = ['time[datetime]', 'time', 'a[href*="#"] time'];
  let timestamp: string | undefined;
  for (const sel of timeSelectors) {
    const t = node.querySelector(sel) as HTMLTimeElement | null;
    if (t) {
      timestamp =
        t.getAttribute('datetime') || t.getAttribute('title') || t.textContent || undefined;
      if (timestamp) timestamp = timestamp.trim();
      if (timestamp) break;
    }
  }

  return { author, timestamp, body };
}
