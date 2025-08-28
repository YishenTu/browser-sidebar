/**
 * Usage example for ExtractionQueue in the browser extension context
 * 
 * This demonstrates how the ExtractionQueue would be integrated with
 * actual content extraction functionality in the browser extension.
 */

import { extractionQueue } from './ExtractionQueue';

// Mock function representing actual tab content extraction
async function extractTabContent(tabId: number): Promise<{ content: string; metadata: any }> {
  // This would be replaced with actual extraction logic
  return new Promise((resolve, reject) => {
    // Simulate Chrome tab API call
    chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_CONTENT' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Extraction failed for tab ${tabId}: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      if (!response || !response.success) {
        reject(new Error(`Content extraction failed for tab ${tabId}`));
        return;
      }
      
      resolve({
        content: response.content,
        metadata: response.metadata
      });
    });
  });
}

/**
 * Example: Extract content from a single tab using the queue
 */
export async function extractSingleTab(tabId: number) {
  try {
    const result = await extractionQueue.enqueue(() => extractTabContent(tabId));
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Example: Extract content from multiple tabs concurrently (with queue limiting)
 */
export async function extractMultipleTabs(tabIds: number[]) {
  
  // Create extraction promises for all tabs
  const extractions = tabIds.map(tabId => 
    extractionQueue.enqueue(() => extractTabContent(tabId))
      .then(result => ({ tabId, success: true as const, result }))
      .catch(error => ({ tabId, success: false as const, error: error.message }))
  );
  
  // Wait for all extractions to complete
  const results = await Promise.all(extractions);
  
  
  // Separate successful and failed extractions
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  
  return {
    successful: successful.map(r => ({ 
      tabId: r.tabId, 
      content: (r as any).result.content, 
      metadata: (r as any).result.metadata 
    })),
    failed: failed.map(r => ({ 
      tabId: r.tabId, 
      error: (r as any).error 
    }))
  };
}

/**
 * Example: Background message handler using the queue
 */
export function setupExtractionMessageHandler() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'EXTRACT_CONTENT' && message.tabId) {
      // Use the queue to handle extraction requests
      extractSingleTab(message.tabId)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      
      // Return true to indicate we will send response asynchronously
      return true;
    }
    
    if (message.action === 'EXTRACT_MULTIPLE' && message.tabIds) {
      extractMultipleTabs(message.tabIds)
        .then(results => {
          sendResponse({ success: true, data: results });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      
      return true;
    }
    
    if (message.action === 'QUEUE_STATUS') {
      sendResponse({ success: true, data: extractionQueue.getStatus() });
      return true;
    }
    
    return false;
  });
}

/**
 * Example: Integration with existing sidebar manager
 */
export async function handleSidebarExtractionRequest(tabId: number) {
  try {
    // Check if we have capacity for immediate execution
    if (extractionQueue.hasCapacity()) {
    }
    
    const result = await extractSingleTab(tabId);
    
    // Send result to sidebar
    chrome.tabs.sendMessage(tabId, {
      action: 'CONTENT_EXTRACTED',
      data: result
    });
    
    return result;
  } catch (error) {
    // Send error to sidebar
    chrome.tabs.sendMessage(tabId, {
      action: 'EXTRACTION_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}