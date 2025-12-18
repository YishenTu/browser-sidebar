/**
 * @file Tab Content Service Tests
 *
 * Tests for tab content management utilities including tab info derivation
 * and multi-tab helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  buildCurrentTabInfo,
  createFinalImageContent,
  filterAdditionalTabs,
  shouldShowContentPreview,
  isMultiTabMode,
  type TabInfo,
} from '@core/services/tabContent';
import type { ExtractedContent } from '@/types/extraction';
import type { TabContent } from '@/types/tabs';

const createTabContent = (tabId: number): TabContent => ({
  tabInfo: {
    id: tabId,
    title: `Tab ${tabId}`,
    url: `https://example.com/tab${tabId}`,
    domain: 'example.com',
    windowId: 0,
    active: false,
    index: 0,
    pinned: false,
    lastAccessed: 1700000000000,
  },
  extractedContent: {
    title: `Tab ${tabId}`,
    url: `https://example.com/tab${tabId}`,
    domain: 'example.com',
    content: 'content',
    textContent: 'content',
    extractedAt: 1700000000000,
    extractionMethod: 'defuddle',
  },
  extractionStatus: 'completed',
});

describe('buildCurrentTabInfo', () => {
  const createExtractedContent = (overrides: Partial<ExtractedContent> = {}): ExtractedContent => ({
    url: 'https://example.com/page',
    title: 'Example Page',
    domain: 'example.com',
    content: 'Page content',
    textContent: 'Page content',
    extractedAt: 1700000000000,
    extractionMethod: 'defuddle',
    ...overrides,
  });

  const createTabInfo = (overrides: Partial<TabInfo> = {}): Partial<TabInfo> => ({
    title: 'Tab Title',
    url: 'https://example.com',
    domain: 'example.com',
    favIconUrl: 'https://example.com/favicon.ico',
    ...overrides,
  });

  describe('basic tab info building', () => {
    it('should return undefined when no content or tabId', () => {
      expect(buildCurrentTabInfo(null, null, null)).toBeUndefined();
      expect(buildCurrentTabInfo(123, null, null)).toBeUndefined();
      expect(buildCurrentTabInfo(null, createTabInfo(), createExtractedContent())).toBeUndefined();
    });

    it('should build tab info with all data present', () => {
      const tabId = 123;
      const tabInfo = createTabInfo();
      const content = createExtractedContent();

      const result = buildCurrentTabInfo(tabId, tabInfo, content);

      expect(result).toBeDefined();
      expect(result?.id).toBe(123);
    });
  });

  describe('property priority', () => {
    it('should prefer tabInfo.title over content.title', () => {
      const result = buildCurrentTabInfo(
        123,
        { title: 'Tab Info Title' },
        createExtractedContent({ title: 'Content Title' })
      );

      expect(result?.title).toBe('Tab Info Title');
    });

    it('should fall back to content.title when tabInfo.title is missing', () => {
      const result = buildCurrentTabInfo(
        123,
        {},
        createExtractedContent({ title: 'Content Title' })
      );

      expect(result?.title).toBe('Content Title');
    });

    it('should use default title when both are missing', () => {
      const result = buildCurrentTabInfo(123, {}, createExtractedContent({ title: '' }));

      expect(result?.title).toBe('Current Tab');
    });

    it('should prefer tabInfo.url over content.url', () => {
      const result = buildCurrentTabInfo(
        123,
        { url: 'https://tab.info/url' },
        createExtractedContent({ url: 'https://content.url' })
      );

      expect(result?.url).toBe('https://tab.info/url');
    });

    it('should prefer tabInfo.domain over content.domain', () => {
      const result = buildCurrentTabInfo(
        123,
        { domain: 'tabinfo.com' },
        createExtractedContent({ domain: 'content.com' })
      );

      expect(result?.domain).toBe('tabinfo.com');
    });

    it('should derive domain from URL when both domains are missing', () => {
      const result = buildCurrentTabInfo(
        123,
        {},
        createExtractedContent({ domain: '', url: 'https://derived.com/page' })
      );

      expect(result?.domain).toBe('derived.com');
    });
  });

  describe('timestamp handling', () => {
    it('should use extractedAt timestamp', () => {
      const result = buildCurrentTabInfo(
        123,
        {},
        createExtractedContent({ extractedAt: 1700000000000 })
      );

      expect(result?.lastAccessed).toBe(1700000000000);
    });

    it('should use current time when extractedAt is missing', () => {
      const before = Date.now();
      const result = buildCurrentTabInfo(123, {}, createExtractedContent({ extractedAt: 0 }));
      const after = Date.now();

      expect(result?.lastAccessed).toBeGreaterThanOrEqual(before);
      expect(result?.lastAccessed).toBeLessThanOrEqual(after);
    });
  });

  describe('default values', () => {
    it('should set default values for window/active/index/pinned', () => {
      const result = buildCurrentTabInfo(123, {}, createExtractedContent());

      expect(result?.windowId).toBe(0);
      expect(result?.active).toBe(true);
      expect(result?.index).toBe(0);
      expect(result?.pinned).toBe(false);
    });

    it('should include favIconUrl from tabInfo', () => {
      const result = buildCurrentTabInfo(
        123,
        { favIconUrl: 'https://example.com/icon.png' },
        createExtractedContent()
      );

      expect(result?.favIconUrl).toBe('https://example.com/icon.png');
    });
  });
});

describe('createFinalImageContent', () => {
  it('should create image content with fileUri', () => {
    const result = createFinalImageContent(
      { fileUri: 'gs://bucket/file.png', mimeType: 'image/png' },
      'data:image/png;base64,abc123'
    );

    expect(result.type).toBe('image');
    expect(result.fileUri).toBe('gs://bucket/file.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.dataUrl).toBe('data:image/png;base64,abc123');
    expect(result.uploadState).toBe('ready');
  });

  it('should create image content with fileId', () => {
    const result = createFinalImageContent(
      { fileId: 'file-123', mimeType: 'image/jpeg' },
      'data:image/jpeg;base64,xyz'
    );

    expect(result.fileId).toBe('file-123');
    expect(result.fileUri).toBeUndefined();
  });

  it('should always set uploadState to ready', () => {
    const result = createFinalImageContent({ mimeType: 'image/png' }, 'data:...');

    expect(result.uploadState).toBe('ready');
  });
});

describe('filterAdditionalTabs', () => {
  it('should filter out current tab', () => {
    const loadedTabs: Record<string, TabContent> = {
      '1': createTabContent(1),
      '2': createTabContent(2),
      '3': createTabContent(3),
    };

    const result = filterAdditionalTabs(loadedTabs, 2);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.tabInfo.id)).toEqual([1, 3]);
  });

  it('should return all tabs when currentTabId is null', () => {
    const loadedTabs: Record<string, TabContent> = {
      '1': createTabContent(1),
      '2': createTabContent(2),
    };

    const result = filterAdditionalTabs(loadedTabs, null);

    expect(result).toHaveLength(2);
  });

  it('should return empty array when no loaded tabs', () => {
    const result = filterAdditionalTabs({}, 1);

    expect(result).toEqual([]);
  });

  it('should return all tabs when currentTabId not in list', () => {
    const loadedTabs: Record<string, TabContent> = {
      '1': createTabContent(1),
      '2': createTabContent(2),
    };

    const result = filterAdditionalTabs(loadedTabs, 999);

    expect(result).toHaveLength(2);
  });
});

describe('shouldShowContentPreview', () => {
  const createExtractedContent = (): ExtractedContent => ({
    title: 'Example',
    url: 'https://example.com',
    domain: 'example.com',
    content: 'content',
    textContent: 'content',
    extractedAt: Date.now(),
    extractionMethod: 'defuddle',
  });

  it('should return true when currentTabContent exists', () => {
    const result = shouldShowContentPreview(createExtractedContent(), {}, false, null);

    expect(result).toBe(true);
  });

  it('should return true when loadedTabs has entries', () => {
    const result = shouldShowContentPreview(null, { '1': createTabContent(1) }, false, null);

    expect(result).toBe(true);
  });

  it('should return true when extraction is loading', () => {
    const result = shouldShowContentPreview(null, {}, true, null);

    expect(result).toBe(true);
  });

  it('should return true when there is an extraction error', () => {
    const result = shouldShowContentPreview(null, {}, false, new Error('Failed'));

    expect(result).toBe(true);
  });

  it('should return false when all conditions are false', () => {
    const result = shouldShowContentPreview(null, {}, false, null);

    expect(result).toBe(false);
  });
});

describe('isMultiTabMode', () => {
  const createExtractedContent = (): ExtractedContent => ({
    title: 'Example',
    url: 'https://example.com',
    domain: 'example.com',
    content: 'content',
    textContent: 'content',
    extractedAt: Date.now(),
    extractionMethod: 'defuddle',
  });

  it('should return true when currentTabContent exists', () => {
    const result = isMultiTabMode(createExtractedContent(), {});

    expect(result).toBe(true);
  });

  it('should return true when loadedTabs has entries', () => {
    const result = isMultiTabMode(null, { '1': createTabContent(1) });

    expect(result).toBe(true);
  });

  it('should return true when both have content', () => {
    const result = isMultiTabMode(createExtractedContent(), { '1': createTabContent(1) });

    expect(result).toBe(true);
  });

  it('should return false when neither has content', () => {
    const result = isMultiTabMode(null, {});

    expect(result).toBe(false);
  });
});
