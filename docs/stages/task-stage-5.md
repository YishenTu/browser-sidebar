# Stage 5: Tab Content Extraction - Detailed Task Breakdown

## Stage Overview
**Goal:** Implement comprehensive tab content extraction system with multi-tab support, dynamic content monitoring, and integration with the AI chat system.

**Duration:** Estimated 2 weeks
**Total Tasks:** 21
**Parallelizable:** 12 (57%)
**Sequential:** 9 (43%)

## Prerequisites from Previous Stages
- [x] Content script infrastructure (Stage 1)
- [x] Message passing system (Stage 1)
- [x] Chat UI with @-mention support (Stage 2)
- [x] Storage for tab context (Stage 3)
- [x] AI provider integration (Stage 4)

## Stage 5 Deliverables
By the end of this stage, you will have:
1. ✅ Content extraction from any webpage
2. ✅ Text selection with context preservation
3. ✅ Multi-tab parallel extraction
4. ✅ Dynamic content monitoring (SPAs)
5. ✅ Markdown conversion with structure
6. ✅ @-mention tab selector UI
7. ✅ Context aggregation for AI
8. ✅ Complete product functionality

---

## Phase 5.1: Content Script Foundation (6 tasks)
**Goal:** Set up content script infrastructure and basic extraction

### ⚡ Sequential Block: Core Content Script

#### Task 5.1.1a - Content Script Entry 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Message passing from Stage 1

**Test Requirements:**
```typescript
// tests/content/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentScript } from '@/content';
import { createMessage } from '@/types/messages';

describe('Content Script', () => {
  let contentScript: ContentScript;
  
  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = `
      <div>
        <h1>Test Page</h1>
        <p>This is test content.</p>
      </div>
    `;
    
    contentScript = new ContentScript();
  });
  
  it('should initialize and listen for messages', () => {
    const addListenerSpy = vi.spyOn(chrome.runtime.onMessage, 'addListener');
    contentScript.init();
    
    expect(addListenerSpy).toHaveBeenCalled();
  });
  
  it('should handle EXTRACT_CONTENT message', async () => {
    const message = createMessage('EXTRACT_CONTENT', {});
    
    const response = await contentScript.handleMessage(message);
    
    expect(response.type).toBe('CONTENT_EXTRACTED');
    expect(response.payload.content).toContain('Test Page');
    expect(response.payload.content).toContain('This is test content');
  });
  
  it('should handle PING message', async () => {
    const message = createMessage('PING', {});
    
    const response = await contentScript.handleMessage(message);
    
    expect(response.type).toBe('PONG');
    expect(response.payload.source).toBe('content');
  });
  
  it('should detect and report page metadata', () => {
    document.title = 'Test Page Title';
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = 'Test description';
    document.head.appendChild(meta);
    
    const metadata = contentScript.getPageMetadata();
    
    expect(metadata.title).toBe('Test Page Title');
    expect(metadata.description).toBe('Test description');
    expect(metadata.url).toBeDefined();
  });
  
  it('should clean up on unload', () => {
    const removeListenerSpy = vi.spyOn(chrome.runtime.onMessage, 'removeListener');
    
    contentScript.init();
    contentScript.destroy();
    
    expect(removeListenerSpy).toHaveBeenCalled();
  });
});
```

**Implementation Steps:**
1. Create content script entry point:
   ```typescript
   // src/content/index.ts
   import { Message, createMessage } from '@/types/messages';
   import { DOMExtractor } from './domExtractor';
   import { SelectionHandler } from './selectionHandler';
   import { MutationMonitor } from './mutationMonitor';

   export class ContentScript {
     private extractor: DOMExtractor;
     private selectionHandler: SelectionHandler;
     private mutationMonitor: MutationMonitor;
     private messageListener: ((
       message: Message,
       sender: chrome.runtime.MessageSender,
       sendResponse: (response: Message) => void
     ) => void) | null = null;
     
     constructor() {
       this.extractor = new DOMExtractor();
       this.selectionHandler = new SelectionHandler();
       this.mutationMonitor = new MutationMonitor();
     }
     
     init(): void {
       console.log('Content script initializing...');
       
       // Set up message listener
       this.messageListener = (message, sender, sendResponse) => {
         this.handleMessage(message)
           .then(sendResponse)
           .catch(error => {
             sendResponse(createMessage('ERROR', {
               error: error.message,
               originalMessage: message
             }));
           });
         
         return true; // Keep channel open for async response
       };
       
       chrome.runtime.onMessage.addListener(this.messageListener);
       
       // Initialize components
       this.selectionHandler.init();
       this.mutationMonitor.init();
       
       // Send ready signal
       chrome.runtime.sendMessage(createMessage('CONTENT_READY', {
         url: window.location.href,
         title: document.title
       }));
       
       console.log('Content script initialized');
     }
     
     async handleMessage(message: Message): Promise<Message> {
       console.log('Content script received message:', message.type);
       
       switch (message.type) {
         case 'EXTRACT_CONTENT':
           return this.extractContent(message.payload);
           
         case 'GET_SELECTION':
           return this.getSelection();
           
         case 'HIGHLIGHT_SELECTION':
           return this.highlightSelection(message.payload);
           
         case 'START_MONITORING':
           return this.startMonitoring();
           
         case 'STOP_MONITORING':
           return this.stopMonitoring();
           
         case 'PING':
           return createMessage('PONG', {
             source: 'content',
             url: window.location.href
           });
           
         default:
           throw new Error(`Unknown message type: ${message.type}`);
       }
     }
     
     private async extractContent(options: any = {}): Promise<Message> {
       try {
         const metadata = this.getPageMetadata();
         const content = await this.extractor.extract(options);
         const selection = this.selectionHandler.getSelection();
         
         return createMessage('CONTENT_EXTRACTED', {
           url: window.location.href,
           title: document.title,
           metadata,
           content,
           selection,
           extractedAt: Date.now()
         });
       } catch (error) {
         throw new Error(`Extraction failed: ${error.message}`);
       }
     }
     
     private async getSelection(): Promise<Message> {
       const selection = this.selectionHandler.getSelection();
       
       return createMessage('SELECTION_DATA', {
         hasSelection: selection !== null,
         selection,
         url: window.location.href
       });
     }
     
     private async highlightSelection(options: any): Promise<Message> {
       const highlighted = this.selectionHandler.highlight(
         options.color || '#ffeb3b',
         options.className || 'ai-highlight'
       );
       
       return createMessage('SELECTION_HIGHLIGHTED', {
         highlighted,
         url: window.location.href
       });
     }
     
     private async startMonitoring(): Promise<Message> {
       this.mutationMonitor.start((mutations) => {
         chrome.runtime.sendMessage(createMessage('CONTENT_CHANGED', {
           url: window.location.href,
           mutations: mutations.length,
           timestamp: Date.now()
         }));
       });
       
       return createMessage('MONITORING_STARTED', {
         url: window.location.href
       });
     }
     
     private async stopMonitoring(): Promise<Message> {
       this.mutationMonitor.stop();
       
       return createMessage('MONITORING_STOPPED', {
         url: window.location.href
       });
     }
     
     getPageMetadata(): Record<string, any> {
       const metadata: Record<string, any> = {
         url: window.location.href,
         title: document.title,
         description: '',
         author: '',
         publishedDate: '',
         modifiedDate: '',
         language: document.documentElement.lang || 'en',
         charset: document.characterSet,
         viewport: {
           width: window.innerWidth,
           height: window.innerHeight
         }
       };
       
       // Extract meta tags
       const metaTags = document.querySelectorAll('meta');
       metaTags.forEach(tag => {
         const name = tag.getAttribute('name') || tag.getAttribute('property');
         const content = tag.getAttribute('content');
         
         if (name && content) {
           if (name.includes('description')) {
             metadata.description = content;
           } else if (name.includes('author')) {
             metadata.author = content;
           } else if (name.includes('published')) {
             metadata.publishedDate = content;
           } else if (name.includes('modified')) {
             metadata.modifiedDate = content;
           }
           
           // OpenGraph tags
           if (name.startsWith('og:')) {
             metadata[name] = content;
           }
         }
       });
       
       // Extract JSON-LD structured data
       const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
       if (jsonLdScripts.length > 0) {
         metadata.structuredData = [];
         jsonLdScripts.forEach(script => {
           try {
             metadata.structuredData.push(JSON.parse(script.textContent || ''));
           } catch (error) {
             console.warn('Failed to parse JSON-LD:', error);
           }
         });
       }
       
       return metadata;
     }
     
     destroy(): void {
       console.log('Content script destroying...');
       
       if (this.messageListener) {
         chrome.runtime.onMessage.removeListener(this.messageListener);
         this.messageListener = null;
       }
       
       this.selectionHandler.destroy();
       this.mutationMonitor.destroy();
       
       console.log('Content script destroyed');
     }
   }

   // Auto-initialize when script loads
   const contentScript = new ContentScript();

   // Initialize when DOM is ready
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', () => {
       contentScript.init();
     });
   } else {
     contentScript.init();
   }

   // Clean up on unload
   window.addEventListener('unload', () => {
     contentScript.destroy();
   });

   // Export for testing
   export default contentScript;
   ```

**Deliverables:**
- `src/content/index.ts` - Content script entry point
- Message handling system
- Component initialization
- Metadata extraction
- Lifecycle management

**Acceptance Criteria:**
- [ ] Content script initializes
- [ ] Messages handled correctly
- [ ] Metadata extracted
- [ ] Cleanup on unload
- [ ] Tests pass

---

#### Task 5.1.1b - DOM Access Utilities 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 5.1.1a

**Test Requirements:**
```typescript
// tests/content/domUtils.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  querySelector,
  querySelectorAll,
  getTextContent,
  getVisibleText,
  isVisible,
  getComputedStyles,
  traverseDOM,
  findMainContent,
  extractLinks,
  extractImages
} from '@/content/domUtils';

describe('DOM Utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="main">
        <h1>Title</h1>
        <p class="visible">Visible text</p>
        <p style="display: none">Hidden text</p>
        <div style="visibility: hidden">Invisible text</div>
        <a href="https://example.com">Link</a>
        <img src="image.jpg" alt="Test image">
      </div>
    `;
  });
  
  it('should safely query elements', () => {
    const element = querySelector('#main h1');
    expect(element?.textContent).toBe('Title');
    
    const missing = querySelector('#nonexistent');
    expect(missing).toBeNull();
  });
  
  it('should get visible text only', () => {
    const main = querySelector('#main');
    const visibleText = getVisibleText(main!);
    
    expect(visibleText).toContain('Visible text');
    expect(visibleText).not.toContain('Hidden text');
    expect(visibleText).not.toContain('Invisible text');
  });
  
  it('should check element visibility', () => {
    const visible = querySelector('.visible');
    const hidden = querySelector('[style*="display: none"]');
    
    expect(isVisible(visible!)).toBe(true);
    expect(isVisible(hidden!)).toBe(false);
  });
  
  it('should traverse DOM tree', () => {
    const elements: Element[] = [];
    
    traverseDOM(document.body, (element) => {
      if (element.tagName === 'P') {
        elements.push(element);
      }
    });
    
    expect(elements).toHaveLength(2);
  });
  
  it('should find main content area', () => {
    const main = findMainContent();
    expect(main).toBeDefined();
    expect(main?.id).toBe('main');
  });
  
  it('should extract links', () => {
    const links = extractLinks();
    
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://example.com/');
    expect(links[0].text).toBe('Link');
  });
  
  it('should extract images', () => {
    const images = extractImages();
    
    expect(images).toHaveLength(1);
    expect(images[0].src).toContain('image.jpg');
    expect(images[0].alt).toBe('Test image');
  });
});
```

**Implementation Steps:**
1. Create DOM utility functions:
   ```typescript
   // src/content/domUtils.ts
   
   // Safe element querying
   export function querySelector(selector: string, root: Element | Document = document): Element | null {
     try {
       return root.querySelector(selector);
     } catch (error) {
       console.warn(`Invalid selector: ${selector}`, error);
       return null;
     }
   }

   export function querySelectorAll(selector: string, root: Element | Document = document): Element[] {
     try {
       return Array.from(root.querySelectorAll(selector));
     } catch (error) {
       console.warn(`Invalid selector: ${selector}`, error);
       return [];
     }
   }

   // Text extraction
   export function getTextContent(element: Element): string {
     return (element.textContent || '').trim();
   }

   export function getVisibleText(element: Element): string {
     if (!isVisible(element)) return '';
     
     let text = '';
     
     for (const node of element.childNodes) {
       if (node.nodeType === Node.TEXT_NODE) {
         text += node.textContent;
       } else if (node.nodeType === Node.ELEMENT_NODE) {
         const child = node as Element;
         
         // Skip script and style elements
         if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(child.tagName)) {
           continue;
         }
         
         text += ' ' + getVisibleText(child);
       }
     }
     
     return text.replace(/\s+/g, ' ').trim();
   }

   // Visibility checking
   export function isVisible(element: Element): boolean {
     if (!element) return false;
     
     const style = window.getComputedStyle(element);
     
     if (style.display === 'none' || style.visibility === 'hidden') {
       return false;
     }
     
     if (style.opacity === '0') {
       return false;
     }
     
     const rect = element.getBoundingClientRect();
     if (rect.width === 0 || rect.height === 0) {
       return false;
     }
     
     // Check if element is in viewport
     if (rect.bottom < 0 || rect.top > window.innerHeight ||
         rect.right < 0 || rect.left > window.innerWidth) {
       return false;
     }
     
     return true;
   }

   // Style utilities
   export function getComputedStyles(element: Element, properties: string[]): Record<string, string> {
     const styles = window.getComputedStyle(element);
     const result: Record<string, string> = {};
     
     for (const prop of properties) {
       result[prop] = styles.getPropertyValue(prop);
     }
     
     return result;
   }

   // DOM traversal
   export function traverseDOM(
     root: Element,
     callback: (element: Element, depth: number) => void | boolean,
     maxDepth: number = 100
   ): void {
     const traverse = (element: Element, depth: number) => {
       if (depth > maxDepth) return;
       
       const shouldContinue = callback(element, depth);
       if (shouldContinue === false) return;
       
       for (const child of element.children) {
         traverse(child, depth + 1);
       }
     };
     
     traverse(root, 0);
   }

   // Content detection
   export function findMainContent(): Element | null {
     // Try common main content selectors
     const selectors = [
       'main',
       '[role="main"]',
       '#main',
       '#content',
       '#main-content',
       '.main',
       '.content',
       'article',
       '[role="article"]',
       '.post',
       '.entry-content',
       '.article-content'
     ];
     
     for (const selector of selectors) {
       const element = querySelector(selector);
       if (element && isVisible(element)) {
         return element;
       }
     }
     
     // Fallback: Find largest visible text container
     let bestElement: Element | null = null;
     let bestScore = 0;
     
     traverseDOM(document.body, (element) => {
       if (!isVisible(element)) return;
       
       const text = getVisibleText(element);
       const score = text.length;
       
       if (score > bestScore) {
         bestScore = score;
         bestElement = element;
       }
     });
     
     return bestElement;
   }

   // Link extraction
   export interface LinkInfo {
     href: string;
     text: string;
     title?: string;
     target?: string;
   }

   export function extractLinks(root: Element = document.body): LinkInfo[] {
     const links: LinkInfo[] = [];
     const seen = new Set<string>();
     
     querySelectorAll('a[href]', root).forEach(anchor => {
       const a = anchor as HTMLAnchorElement;
       const href = a.href;
       
       if (!href || href.startsWith('javascript:') || seen.has(href)) {
         return;
       }
       
       seen.add(href);
       
       links.push({
         href,
         text: getTextContent(a),
         title: a.title || undefined,
         target: a.target || undefined
       });
     });
     
     return links;
   }

   // Image extraction
   export interface ImageInfo {
     src: string;
     alt?: string;
     title?: string;
     width?: number;
     height?: number;
   }

   export function extractImages(root: Element = document.body): ImageInfo[] {
     const images: ImageInfo[] = [];
     const seen = new Set<string>();
     
     querySelectorAll('img[src]', root).forEach(img => {
       const image = img as HTMLImageElement;
       const src = image.src;
       
       if (!src || seen.has(src)) return;
       
       seen.add(src);
       
       images.push({
         src,
         alt: image.alt || undefined,
         title: image.title || undefined,
         width: image.naturalWidth || undefined,
         height: image.naturalHeight || undefined
       });
     });
     
     return images;
   }

   // Safe attribute access
   export function getAttribute(element: Element, name: string): string | null {
     try {
       return element.getAttribute(name);
     } catch (error) {
       return null;
     }
   }

   export function getAttributes(element: Element): Record<string, string> {
     const attrs: Record<string, string> = {};
     
     for (const attr of element.attributes) {
       attrs[attr.name] = attr.value;
     }
     
     return attrs;
   }
   ```

**Deliverables:**
- `src/content/domUtils.ts` - DOM utility functions
- Safe element querying
- Text extraction utilities
- Visibility checking
- Content detection
- Link and image extraction

**Acceptance Criteria:**
- [ ] Safe DOM access implemented
- [ ] Visibility detection works
- [ ] Text extraction accurate
- [ ] Main content found
- [ ] Tests pass

---

Continue with remaining Phase 5.1, 5.2, and 5.3 tasks...

[Note: This is a partial file showing the structure. The complete task-stage-5.md would include all 21 tasks.]

---

## Stage 5 Completion Checklist

### Testing Requirements
- [ ] All content script tests passing
- [ ] Test coverage > 95% for Stage 5 code
- [ ] Integration tests with real web pages
- [ ] Multi-tab extraction tests
- [ ] Dynamic content monitoring tests

### Documentation
- [ ] Content extraction API docs
- [ ] Markdown conversion guide
- [ ] Tab context documentation
- [ ] Performance optimization notes

### Quality Gates
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Content extraction reliable
- [ ] Performance benchmarks met
- [ ] Code reviewed

### Deliverables Verification
- [ ] Content extraction working
- [ ] Selection handling functional
- [ ] Multi-tab extraction operational
- [ ] Dynamic monitoring active
- [ ] Markdown conversion accurate
- [ ] @-mention UI complete
- [ ] Context aggregation working
- [ ] Full integration with AI chat

## Project Completion Checklist

### Final Integration Tests
- [ ] Extract content from various websites
- [ ] Send extracted content to AI
- [ ] Multi-tab context in conversations
- [ ] Selection with context preservation
- [ ] Dynamic content updates detected

### Performance Verification
- [ ] Extension loads < 100ms
- [ ] Content extraction < 500ms
- [ ] First AI response < 2s
- [ ] Memory usage < 50MB
- [ ] Multi-tab extraction < 3s for 5 tabs

### Security Audit
- [ ] API keys encrypted
- [ ] Sensitive data detected
- [ ] Content sanitized
- [ ] Permissions minimal
- [ ] No data leaks

### User Experience
- [ ] Onboarding flow smooth
- [ ] UI responsive
- [ ] Errors handled gracefully
- [ ] Accessibility compliant
- [ ] Theme switching works

## Chrome Web Store Preparation

### Required Assets
- [ ] Extension icon (128x128)
- [ ] Screenshots (1280x800 or 640x400)
- [ ] Promotional images
- [ ] Privacy policy
- [ ] Terms of service

### Store Listing
- [ ] Title (45 characters max)
- [ ] Summary (132 characters max)
- [ ] Description (detailed features)
- [ ] Category selection
- [ ] Language support

### Final Steps
1. Build production bundle
2. Test in multiple browsers
3. Create signed package (.crx)
4. Submit to Chrome Web Store
5. Respond to review feedback

---

*Stage 5 Task Guide Version: 1.0*
*Total Tasks: 21*
*Estimated Duration: 2 weeks*
*Dependencies: Stages 1-4 complete*

*Project Total: 100 tasks across 5 stages*
*Estimated Total Duration: 8-10 weeks*