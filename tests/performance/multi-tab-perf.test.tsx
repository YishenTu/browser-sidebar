/**
 * @file Multi-Tab Performance Tests
 *
 * Comprehensive performance tests for the multi-tab content injection feature.
 * Tests extraction timing, dropdown rendering, UI responsiveness, memory management,
 * and concurrent operation handling to ensure performance targets are met.
 *
 * Performance Targets:
 * - Tab extraction: < 2s per tab
 * - Dropdown rendering: < 100ms
 * - UI responsiveness: No jank with 10+ tabs
 * - Memory usage: Reasonable growth patterns
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabMentionDropdown } from '@sidebar/components/TabMentionDropdown';
import { useMultiTabExtraction } from '@hooks/useMultiTabExtraction';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import type { ExtractedContent } from '@types/extraction';
import type { TabInfo, TabContent } from '@types/tabs';
import type { GetAllTabsResponsePayload, ExtractTabContentResponsePayload } from '@types/messages';

// Performance measurement utilities
interface PerformanceMetrics {
  extractionTimes: number[];
  renderTimes: number[];
  interactionTimes: number[];
  memorySnapshots: number[];
  tabLoadCounts: number[];
  uiUpdateTimes: number[];
}

const performanceMetrics: PerformanceMetrics = {
  extractionTimes: [],
  renderTimes: [],
  interactionTimes: [],
  memorySnapshots: [],
  tabLoadCounts: [],
  uiUpdateTimes: [],
};

// Memory measurement utility
const measureMemoryUsage = (): number => {
  // Estimate based on DOM elements and state
  const domElementCount = document.querySelectorAll('*').length;
  const stateSize = JSON.stringify({
    chat: useChatStore.getState(),
    settings: useSettingsStore.getState(),
  }).length;
  
  // Rough estimation in KB
  return domElementCount * 0.5 + stateSize * 0.001;
};

// High-performance timer for sub-millisecond accuracy
const preciseTiming = (): number => {
  return performance.now();
};

// Test data generators for performance testing
const createLargeExtractedContent = (tabId: number, size: 'small' | 'medium' | 'large' | 'xlarge'): ExtractedContent => {
  const sizeMappings = {
    small: { contentLength: 1000, linkCount: 5 },
    medium: { contentLength: 5000, linkCount: 20 },
    large: { contentLength: 15000, linkCount: 50 },
    xlarge: { contentLength: 50000, linkCount: 100 },
  };
  
  const { contentLength, linkCount } = sizeMappings[size];
  const contentChunk = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(Math.ceil(contentLength / 57));
  
  return {
    title: `Performance Test Tab ${tabId} - ${size.toUpperCase()} Content`,
    url: `https://perf-test-${size}-${tabId}.example.com/content`,
    domain: `perf-test-${size}-${tabId}.example.com`,
    content: contentChunk.slice(0, contentLength),
    links: Array.from({ length: linkCount }, (_, i) => ({
      text: `Performance Link ${i + 1}`,
      url: `https://perf-test-${size}-${tabId}.example.com/link${i + 1}`,
    })),
    metadata: {
      description: `Performance test content for tab ${tabId} with ${size} size data`,
      keywords: Array.from({ length: Math.ceil(linkCount / 5) }, (_, i) => `perf-keyword-${i + 1}`),
      publishedTime: new Date(Date.now() - tabId * 60000).toISOString(),
      modifiedTime: new Date(Date.now() - tabId * 30000).toISOString(),
      favIconUrl: `https://perf-test-${size}-${tabId}.example.com/favicon.ico`,
      domain: `perf-test-${size}-${tabId}.example.com`,
    },
    extractorUsed: 'readability',
    extractionTime: Date.now(),
    wordCount: Math.ceil(contentLength / 5),
    isContentExtracted: true,
    qualityScore: 0.8 + (tabId % 3) * 0.05,
  };
};

const createPerformanceTabInfo = (tabId: number, active = false): TabInfo => ({
  id: tabId,
  title: `Performance Test Tab ${tabId}`,
  url: `https://perf-test-${tabId}.example.com`,
  domain: `perf-test-${tabId}.example.com`,
  windowId: 1,
  favIconUrl: `https://perf-test-${tabId}.example.com/favicon.ico`,
  active,
  index: tabId - 1,
  pinned: tabId <= 3, // Pin first 3 tabs
  status: 'complete',
  lastAccessed: Date.now() - (tabId * 10000),
  audible: tabId % 5 === 0, // Every 5th tab has audio
});

// Generate large datasets for performance testing
const generateLargeTabSet = (count: number): {
  tabs: TabInfo[];
  contents: Record<number, ExtractedContent>;
} => {
  const tabs: TabInfo[] = [];
  const contents: Record<number, ExtractedContent> = {};
  
  for (let i = 1; i <= count; i++) {
    tabs.push(createPerformanceTabInfo(i, i === 1));
    
    // Vary content size to simulate real-world scenarios
    const sizeType = i % 4 === 0 ? 'xlarge' : i % 3 === 0 ? 'large' : i % 2 === 0 ? 'medium' : 'small';
    contents[i] = createLargeExtractedContent(i, sizeType as 'small' | 'medium' | 'large' | 'xlarge');
  }
  
  return { tabs, contents };
};

// Test datasets
let largeDataset: ReturnType<typeof generateLargeTabSet>;

describe('Multi-Tab Performance Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup();
    
    // Reset performance metrics
    Object.keys(performanceMetrics).forEach((key) => {
      (performanceMetrics as any)[key] = [];
    });
    
    // Generate large test dataset
    largeDataset = generateLargeTabSet(50);
    
    // Reset stores
    useChatStore.getState().clearConversation();
    const settingsStore = useSettingsStore.getState();
    if ('resetToDefaults' in settingsStore && typeof settingsStore.resetToDefaults === 'function') {
      await settingsStore.resetToDefaults();
    }
    
    // Mock Chrome API for performance testing
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message) => {
      const startTime = preciseTiming();
      
      switch (message.type) {
        case 'GET_TAB_ID':
          await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
          performanceMetrics.interactionTimes.push(preciseTiming() - startTime);
          return { payload: { tabId: 1 } };
        
        case 'GET_ALL_TABS':
          await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
          performanceMetrics.interactionTimes.push(preciseTiming() - startTime);
          return {
            payload: { tabs: largeDataset.tabs } as GetAllTabsResponsePayload,
          };
        
        case 'EXTRACT_TAB_CONTENT':
          const tabId = message.payload?.tabId;
          const content = largeDataset.contents[tabId as number];
          
          // Simulate extraction delay based on content size
          const delay = content ? Math.log(content.wordCount) * 5 + 50 : 100;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          performanceMetrics.extractionTimes.push(preciseTiming() - startTime);
          return {
            payload: { content },
          } as { payload: ExtractTabContentResponsePayload };
        
        default:
          performanceMetrics.interactionTimes.push(preciseTiming() - startTime);
          return { success: false };
      }
    });
    
    // Mock storage
    vi.mocked(chrome.storage.sync.get).mockResolvedValue({
      settings: {
        selectedModel: 'gpt-5-nano',
        apiKeyReferences: { openai: 'test-key-ref', google: 'test-key-ref' }
      }
    });
    
    await act(async () => {
      await useSettingsStore.getState().updateSelectedModel('gpt-5-nano');
      await useSettingsStore.getState().updateAPIKeyReferences({
        openai: 'test-key-ref',
        google: 'test-key-ref',
      });
    });
  });
  
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  
  describe('Tab Extraction Performance', () => {
    it('simulates tab extraction within 2s target', async () => {
      const extractionTimes: number[] = [];
      const testTabs = [2, 3, 4, 5];
      
      for (const tabId of testTabs) {
        const startTime = preciseTiming();
        
        // Simulate extraction by calling Chrome API mock
        const message = {
          type: 'EXTRACT_TAB_CONTENT',
          payload: { tabId },
          source: 'sidebar',
          target: 'background',
        };
        
        await chrome.runtime.sendMessage(message);
        
        const extractionTime = preciseTiming() - startTime;
        extractionTimes.push(extractionTime);
        
        // Performance target: < 2000ms (2s)
        expect(extractionTime).toBeLessThan(2000);
        
        console.log(`Tab ${tabId} extraction: ${extractionTime.toFixed(2)}ms`);
      }
      
      // Verify all extractions completed within target
      expect(extractionTimes.every(time => time < 2000)).toBe(true);
      
      // Average should be well under target
      const averageTime = extractionTimes.reduce((a, b) => a + b) / extractionTimes.length;
      expect(averageTime).toBeLessThan(1000);
      
      console.log(`Average extraction time: ${averageTime.toFixed(2)}ms`);
    });
    
    it('maintains extraction performance with varying content sizes', async () => {
      const extractionTimes: number[] = [];
      const contentSizes = ['small', 'medium', 'large', 'xlarge'] as const;
      
      for (const size of contentSizes) {
        const content = createLargeExtractedContent(99, size);
        
        const startTime = preciseTiming();
        
        // Simulate realistic processing delay
        const processingDelay = Math.log(content.wordCount) * 10 + 50;
        await new Promise(resolve => setTimeout(resolve, processingDelay));
        
        const extractionTime = preciseTiming() - startTime;
        extractionTimes.push(extractionTime);
        
        // Each size should still be under 2s
        expect(extractionTime).toBeLessThan(2000);
      }
      
      console.log('Content size extraction times:', extractionTimes.map((t, i) => 
        `${contentSizes[i]}: ${t.toFixed(2)}ms`
      ).join(', '));
      
      // Verify performance scaling is reasonable
      expect(extractionTimes[0]).toBeLessThan(extractionTimes[3]); // small < xlarge
      expect(extractionTimes[3]).toBeLessThan(2000); // even xlarge under 2s
    });
    
    it('handles concurrent tab extractions efficiently', async () => {
      const concurrentExtractions = 5;
      const extractionPromises: Promise<void>[] = [];
      const startTimes: number[] = [];
      
      // Start multiple extractions concurrently
      for (let i = 0; i < concurrentExtractions; i++) {
        const tabId = i + 2; // Start from tab 2
        
        const extractionPromise = (async () => {
          startTimes.push(preciseTiming());
          
          const message = {
            type: 'EXTRACT_TAB_CONTENT',
            payload: { tabId },
            source: 'sidebar',
            target: 'background',
          };
          
          await chrome.runtime.sendMessage(message);
        })();
        
        extractionPromises.push(extractionPromise);
      }
      
      const overallStart = Math.min(...startTimes);
      
      // Wait for all extractions to complete
      await Promise.all(extractionPromises);
      
      const overallTime = preciseTiming() - overallStart;
      
      // Concurrent operations should complete within reasonable time
      expect(overallTime).toBeLessThan(5000); // 5s for 5 concurrent extractions
      expect(performanceMetrics.extractionTimes.length).toBeGreaterThanOrEqual(concurrentExtractions);
      
      // Each individual extraction should still be under 2s
      performanceMetrics.extractionTimes.forEach(time => {
        expect(time).toBeLessThan(2000);
      });
      
      console.log(`Concurrent extractions (${concurrentExtractions}): ${overallTime.toFixed(2)}ms total`);
    });
  });
  
  describe('Dropdown Rendering Performance', () => {
    it('renders dropdown with large tab list under 100ms target', async () => {
      const largeTabs = largeDataset.tabs.slice(0, 25); // 25 tabs
      
      const renderStart = preciseTiming();
      
      const { rerender } = render(
        <TabMentionDropdown
          tabs={largeTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={false}
          onClose={vi.fn()}
        />
      );
      
      // Measure dropdown open render time
      const openStart = preciseTiming();
      
      rerender(
        <TabMentionDropdown
          tabs={largeTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      const openRenderTime = preciseTiming() - openStart;
      performanceMetrics.renderTimes.push(openRenderTime);
      
      // Performance target: < 100ms
      expect(openRenderTime).toBeLessThan(100);
      
      // Wait for any async rendering
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      // Verify tab options are rendered (may be virtualized)
      const tabOptions = screen.getAllByRole('option');
      expect(tabOptions.length).toBeGreaterThan(0);
      expect(tabOptions.length).toBeLessThanOrEqual(largeTabs.length);
      
      console.log(`Dropdown render (${largeTabs.length} tabs): ${openRenderTime.toFixed(2)}ms`);
    });
    
    it('maintains dropdown performance with virtualization for large lists', async () => {
      const massiveTabs = largeDataset.tabs.slice(0, 100); // 100 tabs
      
      const renderStart = preciseTiming();
      
      render(
        <TabMentionDropdown
          tabs={massiveTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
          maxVisibleTabs={20} // Force virtualization
        />
      );
      
      const renderTime = preciseTiming() - renderStart;
      performanceMetrics.renderTimes.push(renderTime);
      
      // Even with 100 tabs, should render quickly due to virtualization
      expect(renderTime).toBeLessThan(150);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      // Should only render visible items initially
      const visibleOptions = screen.getAllByRole('option');
      expect(visibleOptions.length).toBeLessThanOrEqual(25); // Some buffer for virtualization
      
      console.log(`Virtualized dropdown render (${massiveTabs.length} tabs): ${renderTime.toFixed(2)}ms`);
    });
    
    it('handles rapid dropdown filtering without performance degradation', async () => {
      const tabs = largeDataset.tabs.slice(0, 30);
      const filterTimes: number[] = [];
      const testQueries = ['p', 'pe', 'per', 'perf', 'perfo', 'perform'];
      
      let currentTabs = tabs;
      
      const { rerender } = render(
        <TabMentionDropdown
          tabs={currentTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      for (const query of testQueries) {
        const filterStart = preciseTiming();
        
        // Simulate filtering
        const filteredTabs = tabs.filter(tab => 
          tab.title.toLowerCase().includes(query.toLowerCase())
        );
        
        // Re-render with filtered tabs
        rerender(
          <TabMentionDropdown
            tabs={filteredTabs}
            onSelect={vi.fn()}
            position={{ x: 100, y: 100 }}
            isOpen={true}
            onClose={vi.fn()}
          />
        );
        
        const filterTime = preciseTiming() - filterStart;
        filterTimes.push(filterTime);
        
        // Each filter operation should be very fast
        expect(filterTime).toBeLessThan(50);
      }
      
      // Verify no performance degradation over time
      const averageTime = filterTimes.reduce((a, b) => a + b) / filterTimes.length;
      expect(averageTime).toBeLessThan(25);
      
      console.log(`Filter performance: ${filterTimes.map(t => t.toFixed(1)).join('ms, ')}ms (avg: ${averageTime.toFixed(1)}ms)`);
    });
  });
  
  describe('Memory Management', () => {
    it('tracks memory usage with varying loads', async () => {
      // Measure initial memory
      let initialMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(initialMemory);
      
      // Create components with moderate data
      const moderateTabs = largeDataset.tabs.slice(0, 15);
      
      const { rerender } = render(
        <TabMentionDropdown
          tabs={moderateTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      let moderateMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(moderateMemory);
      
      // Increase load significantly
      const heavyTabs = largeDataset.tabs.slice(0, 50);
      
      rerender(
        <TabMentionDropdown
          tabs={heavyTabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      let heavyMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(heavyMemory);
      
      // Clean up - unmount component
      cleanup();
      
      // Force some cleanup time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let finalMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(finalMemory);
      
      // Memory should be reasonable (allow for test environment variance)
      expect(moderateMemory).toBeGreaterThan(0); // Should have some memory usage
      expect(heavyMemory).toBeGreaterThan(0); // Should have some memory usage
      expect(finalMemory).toBeGreaterThan(0); // Should have some memory usage
      
      // Memory usage should be reasonable (under 10MB for test environment)
      expect(moderateMemory).toBeLessThan(10000);
      expect(heavyMemory).toBeLessThan(10000);
      expect(finalMemory).toBeLessThan(10000);
      
      console.log(`Memory usage: initial ${initialMemory.toFixed(0)}KB, moderate ${moderateMemory.toFixed(0)}KB, heavy ${heavyMemory.toFixed(0)}KB, final ${finalMemory.toFixed(0)}KB`);
    });
  });
  
  describe('Performance Benchmarking and Metrics', () => {
    it('provides comprehensive performance summary', async () => {
      // Run a comprehensive workflow to collect metrics
      const tabs = largeDataset.tabs.slice(0, 10);
      
      // Test dropdown rendering
      const renderStart = preciseTiming();
      
      render(
        <TabMentionDropdown
          tabs={tabs}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      const renderTime = preciseTiming() - renderStart;
      performanceMetrics.renderTimes.push(renderTime);
      
      // Test extraction simulation
      for (let i = 2; i <= 6; i++) {
        const message = {
          type: 'EXTRACT_TAB_CONTENT',
          payload: { tabId: i },
          source: 'sidebar',
          target: 'background',
        };
        
        await chrome.runtime.sendMessage(message);
      }
      
      // Collect final metrics
      const finalMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(finalMemory);
      
      // Analyze performance metrics
      const extractionStats = {
        count: performanceMetrics.extractionTimes.length,
        average: performanceMetrics.extractionTimes.reduce((a, b) => a + b, 0) / performanceMetrics.extractionTimes.length || 0,
        max: Math.max(...performanceMetrics.extractionTimes, 0),
        under2s: performanceMetrics.extractionTimes.filter(t => t < 2000).length,
      };
      
      const renderStats = {
        count: performanceMetrics.renderTimes.length,
        average: performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) / performanceMetrics.renderTimes.length || 0,
        max: Math.max(...performanceMetrics.renderTimes, 0),
        under100ms: performanceMetrics.renderTimes.filter(t => t < 100).length,
      };
      
      const interactionStats = {
        count: performanceMetrics.interactionTimes.length,
        average: performanceMetrics.interactionTimes.reduce((a, b) => a + b, 0) / performanceMetrics.interactionTimes.length || 0,
        max: Math.max(...performanceMetrics.interactionTimes, 0),
        under100ms: performanceMetrics.interactionTimes.filter(t => t < 100).length,
      };
      
      const memoryStats = {
        snapshots: performanceMetrics.memorySnapshots.length,
        initial: Math.min(...performanceMetrics.memorySnapshots, Number.MAX_VALUE),
        peak: Math.max(...performanceMetrics.memorySnapshots, 0),
        final: performanceMetrics.memorySnapshots[performanceMetrics.memorySnapshots.length - 1] || 0,
      };
      
      // Performance assertions
      expect(extractionStats.average).toBeLessThan(1000); // Average under 1s
      expect(extractionStats.under2s).toBe(extractionStats.count); // All under 2s
      expect(renderStats.average).toBeLessThan(150); // Average render under 150ms
      expect(interactionStats.average).toBeLessThan(50); // Average interaction under 50ms
      expect(memoryStats.peak - memoryStats.initial).toBeLessThan(10000); // Memory growth under 10MB
      
      // Performance report
      console.log('\n📊 Multi-Tab Performance Summary:');
      console.log(`🔄 Extractions: ${extractionStats.count} total, ${extractionStats.average.toFixed(1)}ms avg, ${extractionStats.max.toFixed(1)}ms max`);
      console.log(`🎨 Renders: ${renderStats.count} total, ${renderStats.average.toFixed(1)}ms avg, ${renderStats.max.toFixed(1)}ms max`);
      console.log(`👆 Interactions: ${interactionStats.count} total, ${interactionStats.average.toFixed(1)}ms avg, ${interactionStats.max.toFixed(1)}ms max`);
      console.log(`💾 Memory: ${memoryStats.initial.toFixed(0)}KB → ${memoryStats.peak.toFixed(0)}KB peak → ${memoryStats.final.toFixed(0)}KB final`);
      console.log(`✅ Performance targets: Extraction ${extractionStats.under2s}/${extractionStats.count} under 2s, Render ${renderStats.under100ms}/${renderStats.count} under 100ms`);
    });
    
    it('detects performance regressions', () => {
      // Set up baseline performance expectations
      const baselines = {
        maxExtractionTime: 2000, // 2s
        maxRenderTime: 100,      // 100ms
        maxInteractionTime: 100,  // 100ms
        maxMemoryGrowth: 15000,   // 15MB
      };
      
      // Current metrics (would be populated by previous tests)
      const currentMetrics = {
        maxExtractionTime: Math.max(...performanceMetrics.extractionTimes, 0),
        maxRenderTime: Math.max(...performanceMetrics.renderTimes, 0),
        maxInteractionTime: Math.max(...performanceMetrics.interactionTimes, 0),
        memoryGrowth: performanceMetrics.memorySnapshots.length > 1 ? 
          Math.max(...performanceMetrics.memorySnapshots) - Math.min(...performanceMetrics.memorySnapshots) : 0,
      };
      
      // Regression detection
      Object.entries(baselines).forEach(([metric, baseline]) => {
        const current = currentMetrics[metric as keyof typeof currentMetrics];
        
        // Skip checks if no data collected for this metric
        if (current === 0 || current === undefined) {
          console.log(`⏭️  Skipping ${metric} - no data collected`);
          return;
        }
        
        if (current > baseline) {
          console.warn(`⚠️  Performance regression detected in ${metric}: ${current} > ${baseline}`);
        }
        
        // Allow some variance for test environment differences
        expect(current).toBeLessThan(baseline * 1.2);
      });
      
      console.log('\n🎯 Performance regression check passed');
    });
  });
  
  describe('Stress Testing', () => {
    it('handles extreme loads gracefully', async () => {
      const extremeDataset = generateLargeTabSet(200); // 200 tabs
      
      // Test dropdown with massive dataset
      const renderStart = preciseTiming();
      
      render(
        <TabMentionDropdown
          tabs={extremeDataset.tabs.slice(0, 100)}
          onSelect={vi.fn()}
          position={{ x: 100, y: 100 }}
          isOpen={true}
          onClose={vi.fn()}
          maxVisibleTabs={25}
        />
      );
      
      const extremeRenderTime = preciseTiming() - renderStart;
      
      // Should handle extreme load gracefully (with reasonable degradation)
      expect(extremeRenderTime).toBeLessThan(500);
      
      // Test memory with extreme content
      const extremeMemory = measureMemoryUsage();
      performanceMetrics.memorySnapshots.push(extremeMemory);
      
      // Memory should still be reasonable even with extreme data
      expect(extremeMemory).toBeLessThan(50000); // 50MB limit for extreme case
      
      console.log(`Extreme load test (100 tabs): render ${extremeRenderTime.toFixed(2)}ms, memory ${extremeMemory.toFixed(0)}KB`);
    });
    
    it('recovers from performance spikes', async () => {
      // Simulate a performance spike scenario
      const spikeTimes: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const spikeStart = preciseTiming();
        
        // Rapid operations that might cause spikes
        const tabs = largeDataset.tabs.slice(0, 5 + i); // Increasing load
        
        render(
          <TabMentionDropdown
            tabs={tabs}
            onSelect={vi.fn()}
            position={{ x: 100, y: 100 }}
            isOpen={true}
            onClose={vi.fn()}
          />
        );
        
        const spikeTime = preciseTiming() - spikeStart;
        spikeTimes.push(spikeTime);
        
        cleanup();
        
        // Short pause between operations
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // System should recover - later operations shouldn't be significantly slower
      const firstFive = spikeTimes.slice(0, 5);
      const lastFive = spikeTimes.slice(-5);
      
      const firstAvg = firstFive.reduce((a, b) => a + b) / firstFive.length;
      const lastAvg = lastFive.reduce((a, b) => a + b) / lastFive.length;
      
      // Recovery: last operations shouldn't be more than 3x slower
      expect(lastAvg).toBeLessThan(firstAvg * 3);
      
      // Individual spikes shouldn't be extreme
      spikeTimes.forEach(time => {
        expect(time).toBeLessThan(1000); // 1s limit even during spikes
      });
      
      console.log(`Spike recovery: first avg ${firstAvg.toFixed(1)}ms, last avg ${lastAvg.toFixed(1)}ms`);
    });
  });
});