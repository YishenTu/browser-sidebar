/**
 * @file Message Handler
 *
 * Handles incoming messages from the background script and coordinates responses.
 * Manages message routing for sidebar toggling, content extraction, and other commands.
 */

/* eslint-disable no-console */
import { createMessage, isValidMessage, Message, ExtractTabPayload } from '../../types/messages';
import { ExtractionMode } from '../../types/extraction';
import { SidebarController } from './sidebarController';
import { addMessageListener } from '@platform/chrome/runtime';

/**
 * Handles content extraction request
 */
async function handleContentExtraction(message: Message): Promise<Message> {
  try {
    // Import extraction modules with better error handling
    const { extractContent } = await import('../extraction/orchestrator');
    const { isExtractionOptions, validateExtractionOptions } = await import(
      '../../types/extraction'
    );

    // Validate and normalize extraction options
    let extractionOptions = undefined;
    if (message.payload && typeof message.payload === 'object') {
      if (isExtractionOptions(message.payload)) {
        extractionOptions = validateExtractionOptions(message.payload);
      } else {
        // Invalid extraction options provided, using defaults
      }
    }

    // Perform extraction with validated options and mode
    const modeString = (message.payload as { mode?: string })?.mode;
    const mode = modeString ? (modeString as ExtractionMode) : undefined;
    const extractedContent = await extractContent(extractionOptions, mode);

    const responsePayload = {
      text: extractedContent.content,
      title: extractedContent.title,
      url: extractedContent.url,
      metadata: {
        domain: extractedContent.domain,
        author: extractedContent.author,
        publishedDate: extractedContent.publishedDate,
        extractedAt: extractedContent.extractedAt,
        extractionMethod: extractedContent.extractionMethod,
        textContent: extractedContent.textContent,
        excerpt: extractedContent.excerpt,
        ...extractedContent.metadata,
      },
    };

    return createMessage({
      type: 'CONTENT_EXTRACTED',
      payload: responsePayload,
      source: 'content',
      target: message.source,
    });
  } catch (error) {
    // Enhanced error classification and reporting
    let errorCode = 'EXTRACTION_FAILED';
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Classify specific error types for better handling
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout')) {
        errorCode = 'EXTRACTION_TIMEOUT';
      } else if (msg.includes('network') || msg.includes('loading')) {
        errorCode = 'EXTRACTION_NETWORK_ERROR';
      } else if (msg.includes('dom') || msg.includes('document')) {
        errorCode = 'EXTRACTION_DOM_ERROR';
      } else if (msg.includes('memory')) {
        errorCode = 'EXTRACTION_MEMORY_ERROR';
      } else if (msg.includes('parsing')) {
        errorCode = 'EXTRACTION_PARSING_ERROR';
      }
    }

    return createMessage({
      type: 'ERROR',
      payload: {
        message: errorMessage,
        code: errorCode,
        details: {
          timestamp: Date.now(),
          url: typeof window !== 'undefined' ? window.location?.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        },
      },
      source: 'content',
      target: message.source,
    });
  }
}

/**
 * Handles tab content extraction request
 */
async function handleTabContentExtraction(message: Message): Promise<Message> {
  try {
    // Import extraction modules with better error handling
    const { extractContent } = await import('../extraction/orchestrator');
    const { isExtractionOptions, validateExtractionOptions } = await import(
      '../../types/extraction'
    );

    // Extract the ExtractTabPayload from the message
    const tabPayload = message.payload as ExtractTabPayload;

    if (!tabPayload || typeof tabPayload.tabId !== 'number') {
      return createMessage({
        type: 'ERROR',
        payload: {
          message: 'Invalid EXTRACT_TAB_CONTENT payload - missing or invalid tabId',
          code: 'INVALID_PAYLOAD',
        },
        source: 'content',
        target: message.source,
      });
    }

    // Validate and normalize extraction options from the tab payload
    let extractionOptions = undefined;
    if (tabPayload.options && typeof tabPayload.options === 'object') {
      if (isExtractionOptions(tabPayload.options)) {
        extractionOptions = validateExtractionOptions(tabPayload.options);
      } else {
        // Invalid extraction options provided in EXTRACT_TAB_CONTENT, using defaults
      }
    }

    // Perform extraction with validated options and mode
    const mode = tabPayload.mode ? (tabPayload.mode as ExtractionMode) : undefined;
    const extractedContent = await extractContent(extractionOptions, mode);

    // Return the extracted content in the expected format
    return createMessage({
      type: 'CONTENT_EXTRACTED',
      payload: {
        content: extractedContent,
        tabId: tabPayload.tabId,
      },
      source: 'content',
      target: message.source,
    });
  } catch (error) {
    // Enhanced error classification and reporting
    let errorCode = 'TAB_EXTRACTION_FAILED';
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Classify specific error types for better handling
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout')) {
        errorCode = 'TAB_EXTRACTION_TIMEOUT';
      } else if (msg.includes('network') || msg.includes('loading')) {
        errorCode = 'TAB_EXTRACTION_NETWORK_ERROR';
      } else if (msg.includes('dom') || msg.includes('document')) {
        errorCode = 'TAB_EXTRACTION_DOM_ERROR';
      } else if (msg.includes('memory')) {
        errorCode = 'TAB_EXTRACTION_MEMORY_ERROR';
      } else if (msg.includes('parsing')) {
        errorCode = 'TAB_EXTRACTION_PARSING_ERROR';
      }
    }

    return createMessage({
      type: 'ERROR',
      payload: {
        message: errorMessage,
        code: errorCode,
        details: {
          timestamp: Date.now(),
          url: typeof window !== 'undefined' ? window.location?.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        },
      },
      source: 'content',
      target: message.source,
    });
  }
}

/**
 * Message handler class
 */
export class MessageHandler {
  private sidebarController: SidebarController;

  constructor(sidebarController: SidebarController) {
    this.sidebarController = sidebarController;
  }

  /**
   * Handles incoming messages from the background script
   */
  async handleMessage(message: Message): Promise<Message> {
    // Validate message structure
    if (!isValidMessage(message)) {
      return createMessage({
        type: 'ERROR',
        payload: { message: 'Invalid message format', code: 'INVALID_MESSAGE' },
        source: 'content',
        target: 'background',
      });
    }

    // Handle typed messages
    switch (message.type) {
      case 'TOGGLE_SIDEBAR': {
        // Check if we have an explicit show/hide directive
        const explicitShow = (message.payload as { show?: boolean })?.show;

        if (explicitShow !== undefined) {
          // Explicit show/hide command
          if (explicitShow && !this.sidebarController.isOpen()) {
            // Show sidebar
            try {
              const response = await this.sidebarController.open();
              return response;
            } catch (error: unknown) {
              return createMessage({
                type: 'ERROR',
                payload: {
                  message: error instanceof Error ? error.message : String(error),
                  code: 'INJECTION_FAILED',
                },
                source: 'content',
                target: 'background',
              });
            }
          } else if (!explicitShow && this.sidebarController.isOpen()) {
            // Hide sidebar
            return this.sidebarController.close();
          } else {
            // Already in the desired state
            return createMessage({
              type: 'SIDEBAR_STATE',
              payload: {
                status: this.sidebarController.isOpen()
                  ? 'sidebar-already-open'
                  : 'sidebar-already-closed',
                timestamp: Date.now(),
              },
              source: 'content',
              target: 'background',
            });
          }
        } else {
          // Toggle behavior (no explicit show/hide)
          if (this.sidebarController.isOpen()) {
            return this.sidebarController.close();
          } else {
            try {
              const response = await this.sidebarController.open();
              return response;
            } catch (error: unknown) {
              return createMessage({
                type: 'ERROR',
                payload: {
                  message: error instanceof Error ? error.message : String(error),
                  code: 'INJECTION_FAILED',
                },
                source: 'content',
                target: 'background',
              });
            }
          }
        }
      }

      case 'CLOSE_SIDEBAR': {
        return this.sidebarController.close();
      }

      case 'EXTRACT_CONTENT': {
        return await handleContentExtraction(message);
      }

      case 'EXTRACT_TAB_CONTENT': {
        return await handleTabContentExtraction(message);
      }

      case 'PING':
        return createMessage({
          type: 'PONG',
          payload: { originalId: message.id, source: 'content' },
          source: 'content',
          target: 'background',
        });

      default:
        return createMessage({
          type: 'ERROR',
          payload: {
            message: `Unknown message type: ${message.type}`,
            code: 'UNKNOWN_MESSAGE_TYPE',
          },
          source: 'content',
          target: 'background',
        });
    }
  }

  /**
   * Initializes the message listener
   */
  initialize(): void {
    addMessageListener((message: Message, _sender, sendResponse) => {
      // Handle message asynchronously
      this.handleMessage(message)
        .then(response => sendResponse(response))
        .catch(error => {
          sendResponse(
            createMessage({
              type: 'ERROR',
              payload: {
                message: error instanceof Error ? error.message : String(error),
                code: 'HANDLER_ERROR',
              },
              source: 'content',
              target: 'background',
            })
          );
        });

      return true; // Keep channel open for async response
    });
  }
}
