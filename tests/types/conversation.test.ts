/**
 * @file Conversation Types Test Suite
 * 
 * Comprehensive test suite for conversation type definitions following TDD methodology.
 * Tests type compilation, serialization/deserialization, type guards, and IndexedDB compatibility.
 */

import { describe, it, expect, test } from 'vitest';
import type {
  ConversationData,
  ConversationStorageMetadata,
  TabContext,
  ModelSettings,
  ConversationStorageCreate,
  ConversationStorageUpdate,
  ConversationSerialized
} from '@/types/conversation';
import {
  createStorageConversation,
  updateStorageConversation,
  serializeConversation,
  deserializeConversation,
  isConversationData,
  isTabContext,
  isModelSettings,
  isConversationStorageMetadata,
  generateConversationId,
  createTabContext,
  createModelSettings,
  validateConversationForStorage,
  createTestConversation,
  getConversationSummary
} from '@/types/conversation';
import { createUserMessage, createAssistantMessage } from '@/types/chat';

// =============================================================================
// Type Compilation Tests
// =============================================================================

describe('Conversation Types - Type Compilation', () => {
  test('ConversationData interface compiles correctly', () => {
    const conversation: ConversationData = {
      id: 'conv_123',
      title: 'Test Conversation',
      messages: [],
      metadata: {
        createdAt: 1640995200000,
        updatedAt: 1640995200000,
        messageCount: 0
      },
      tabContext: {
        url: 'https://example.com',
        title: 'Example Page',
        timestamp: 1640995200000
      },
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7
      }
    };

    expect(conversation).toBeDefined();
    expect(conversation.id).toBe('conv_123');
    expect(conversation.title).toBe('Test Conversation');
    expect(Array.isArray(conversation.messages)).toBe(true);
    expect(conversation.metadata).toBeDefined();
    expect(conversation.tabContext).toBeDefined();
    expect(conversation.modelSettings).toBeDefined();
  });

  test('ConversationStorageMetadata interface compiles correctly', () => {
    const metadata: ConversationStorageMetadata = {
      createdAt: 1640995200000,
      updatedAt: 1640995200000,
      messageCount: 5,
      tags: ['important', 'work'],
      archived: false,
      pinned: true,
      lastActivity: 1640999800000
    };

    expect(metadata).toBeDefined();
    expect(metadata.messageCount).toBe(5);
    expect(metadata.tags).toEqual(['important', 'work']);
    expect(metadata.archived).toBe(false);
    expect(metadata.pinned).toBe(true);
  });

  test('TabContext interface compiles correctly', () => {
    const tabContext: TabContext = {
      url: 'https://example.com/page',
      title: 'Example Page',
      timestamp: 1640995200000,
      selectedText: 'Important text selection',
      favicon: 'https://example.com/favicon.ico',
      language: 'en',
      metadata: {
        wordCount: 1500,
        readingTime: 7,
        customField: 'value'
      }
    };

    expect(tabContext).toBeDefined();
    expect(tabContext.url).toBe('https://example.com/page');
    expect(tabContext.selectedText).toBe('Important text selection');
    expect(tabContext.metadata?.wordCount).toBe(1500);
  });

  test('ModelSettings interface compiles correctly', () => {
    const modelSettings: ModelSettings = {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      temperature: 0.5,
      maxTokens: 4000,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.05,
      systemPrompt: 'You are a helpful assistant',
      customSettings: {
        streaming: true,
        safetySettings: 'high'
      }
    };

    expect(modelSettings).toBeDefined();
    expect(modelSettings.provider).toBe('anthropic');
    expect(modelSettings.model).toBe('claude-3-sonnet');
    expect(modelSettings.customSettings?.streaming).toBe(true);
  });

  test('Optional fields work correctly', () => {
    const minimalConversation: ConversationData = {
      id: 'conv_minimal',
      title: 'Minimal',
      messages: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0
      }
    };

    expect(minimalConversation).toBeDefined();
    expect(minimalConversation.tabContext).toBeUndefined();
    expect(minimalConversation.modelSettings).toBeUndefined();
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('Conversation Types - Type Guards', () => {
  test('isConversationData validates correct objects', () => {
    const validConversation = {
      id: 'conv_123',
      title: 'Test',
      messages: [],
      metadata: {
        createdAt: 1640995200000,
        updatedAt: 1640995200000,
        messageCount: 0
      }
    };

    expect(isConversationData(validConversation)).toBe(true);

    // Test with invalid objects
    expect(isConversationData(null)).toBe(false);
    expect(isConversationData(undefined)).toBe(false);
    expect(isConversationData({})).toBe(false);
    expect(isConversationData({ id: 'test' })).toBe(false);
    expect(isConversationData({ id: 'test', title: 'test' })).toBe(false);
    expect(isConversationData({ 
      id: 'test', 
      title: 'test', 
      messages: 'not-array' 
    })).toBe(false);
  });

  test('isTabContext validates correct objects', () => {
    const validTabContext = {
      url: 'https://example.com',
      title: 'Test Page',
      timestamp: 1640995200000
    };

    expect(isTabContext(validTabContext)).toBe(true);

    // Test with optional fields
    const fullTabContext = {
      ...validTabContext,
      selectedText: 'text',
      favicon: 'favicon.ico',
      language: 'en',
      metadata: { wordCount: 100 }
    };

    expect(isTabContext(fullTabContext)).toBe(true);

    // Test invalid objects
    expect(isTabContext({})).toBe(false);
    expect(isTabContext({ url: 'test' })).toBe(false);
    expect(isTabContext({ 
      url: 'test', 
      title: 'test', 
      timestamp: 'not-number' 
    })).toBe(false);
  });

  test('isModelSettings validates correct objects', () => {
    const validModelSettings = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7
    };

    expect(isModelSettings(validModelSettings)).toBe(true);

    // Test with optional fields
    const fullModelSettings = {
      ...validModelSettings,
      maxTokens: 4000,
      topP: 0.9,
      systemPrompt: 'test',
      customSettings: { key: 'value' }
    };

    expect(isModelSettings(fullModelSettings)).toBe(true);

    // Test invalid objects
    expect(isModelSettings({})).toBe(false);
    expect(isModelSettings({ provider: 'test' })).toBe(false);
    expect(isModelSettings({ 
      provider: 'test', 
      model: 'test', 
      temperature: 'not-number' 
    })).toBe(false);
  });

  test('isConversationStorageMetadata validates correct objects', () => {
    const validMetadata = {
      createdAt: 1640995200000,
      updatedAt: 1640995200000,
      messageCount: 5
    };

    expect(isConversationStorageMetadata(validMetadata)).toBe(true);

    // Test with optional fields
    const fullMetadata = {
      ...validMetadata,
      tags: ['tag1', 'tag2'],
      archived: true,
      pinned: false,
      lastActivity: 1640999800000
    };

    expect(isConversationStorageMetadata(fullMetadata)).toBe(true);

    // Test invalid objects
    expect(isConversationStorageMetadata({})).toBe(false);
    expect(isConversationStorageMetadata({ createdAt: 123 })).toBe(false);
    expect(isConversationStorageMetadata({
      createdAt: 123,
      updatedAt: 'not-number',
      messageCount: 5
    })).toBe(false);
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('Conversation Types - Helper Functions', () => {
  test('generateConversationId creates unique IDs', () => {
    const id1 = generateConversationId();
    const id2 = generateConversationId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('conv_')).toBe(true);
    expect(id2.startsWith('conv_')).toBe(true);
  });

  test('createStorageConversation creates valid conversation objects', () => {
    const conversation = createStorageConversation('Test Title', {
      tabContext: {
        url: 'https://example.com',
        title: 'Example',
        timestamp: Date.now()
      }
    });

    expect(isConversationData(conversation)).toBe(true);
    expect(conversation.title).toBe('Test Title');
    expect(conversation.tabContext?.url).toBe('https://example.com');
    expect(conversation.messages).toEqual([]);
    expect(conversation.metadata.messageCount).toBe(0);
  });

  test('updateStorageConversation merges updates correctly', () => {
    const original = createStorageConversation('Original Title');
    const updated = updateStorageConversation(original, {
      title: 'Updated Title',
      metadata: {
        tags: ['new-tag'],
        pinned: true
      }
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.metadata.tags).toEqual(['new-tag']);
    expect(updated.metadata.pinned).toBe(true);
    expect(updated.metadata.createdAt).toBe(original.metadata.createdAt);
    expect(updated.metadata.updatedAt).toBeGreaterThan(original.metadata.updatedAt);
  });

  test('createTabContext creates valid tab context objects', () => {
    const tabContext = createTabContext('https://example.com', 'Example Page', {
      selectedText: 'Selected text',
      language: 'en'
    });

    expect(isTabContext(tabContext)).toBe(true);
    expect(tabContext.url).toBe('https://example.com');
    expect(tabContext.title).toBe('Example Page');
    expect(tabContext.selectedText).toBe('Selected text');
    expect(tabContext.language).toBe('en');
    expect(typeof tabContext.timestamp).toBe('number');
  });

  test('createModelSettings creates valid model settings objects', () => {
    const modelSettings = createModelSettings('openai', 'gpt-4', {
      temperature: 0.8,
      maxTokens: 2000,
      systemPrompt: 'Custom prompt'
    });

    expect(isModelSettings(modelSettings)).toBe(true);
    expect(modelSettings.provider).toBe('openai');
    expect(modelSettings.model).toBe('gpt-4');
    expect(modelSettings.temperature).toBe(0.8);
    expect(modelSettings.maxTokens).toBe(2000);
    expect(modelSettings.systemPrompt).toBe('Custom prompt');
  });
});

// =============================================================================
// Serialization Tests
// =============================================================================

describe('Conversation Types - Serialization', () => {
  test('serializeConversation creates JSON-compatible objects', () => {
    const userMessage = createUserMessage('Hello');
    const assistantMessage = createAssistantMessage('Hi there');
    
    const conversation = createStorageConversation('Test Conversation', {
      messages: [userMessage, assistantMessage],
      tabContext: createTabContext('https://example.com', 'Example'),
      modelSettings: createModelSettings('openai', 'gpt-4')
    });

    const serialized = serializeConversation(conversation);

    expect(typeof serialized).toBe('string');
    expect(() => JSON.parse(serialized)).not.toThrow();

    const parsed: ConversationSerialized = JSON.parse(serialized);
    expect(parsed.id).toBe(conversation.id);
    expect(parsed.title).toBe(conversation.title);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.tabContext).toBeDefined();
    expect(parsed.modelSettings).toBeDefined();
  });

  test('deserializeConversation reconstructs objects correctly', () => {
    const original = createStorageConversation('Original', {
      messages: [createUserMessage('Test message')],
      tabContext: createTabContext('https://test.com', 'Test Page'),
      modelSettings: createModelSettings('openai', 'gpt-3.5-turbo', {
        temperature: 0.5
      })
    });

    const serialized = serializeConversation(original);
    const deserialized = deserializeConversation(serialized);

    expect(deserialized.id).toBe(original.id);
    expect(deserialized.title).toBe(original.title);
    expect(deserialized.messages).toHaveLength(1);
    expect(deserialized.messages[0].content).toBe('Test message');
    expect(deserialized.tabContext?.url).toBe('https://test.com');
    expect(deserialized.modelSettings?.model).toBe('gpt-3.5-turbo');
    expect(deserialized.modelSettings?.temperature).toBe(0.5);
  });

  test('serialization handles complex message content', () => {
    const complexMessage = createUserMessage({
      text: 'Here is some code:',
      codeBlocks: [{
        language: 'javascript',
        code: 'console.log("Hello");',
        filename: 'test.js'
      }]
    });

    const conversation = createStorageConversation('Complex Content', {
      messages: [complexMessage]
    });

    const serialized = serializeConversation(conversation);
    const deserialized = deserializeConversation(serialized);

    expect(deserialized.messages).toHaveLength(1);
    const content = deserialized.messages[0].content;
    
    if (typeof content === 'object' && 'text' in content) {
      expect(content.text).toBe('Here is some code:');
      expect(content.codeBlocks).toHaveLength(1);
      expect(content.codeBlocks?.[0].language).toBe('javascript');
      expect(content.codeBlocks?.[0].code).toBe('console.log("Hello");');
      expect(content.codeBlocks?.[0].filename).toBe('test.js');
    } else {
      throw new Error('Expected complex message content');
    }
  });

  test('serialization handles large conversations', () => {
    const messages = Array.from({ length: 100 }, (_, i) => 
      i % 2 === 0 
        ? createUserMessage(`User message ${i}`)
        : createAssistantMessage(`Assistant response ${i}`)
    );

    const largeConversation = createStorageConversation('Large Conversation', {
      messages,
      metadata: {
        tags: Array.from({ length: 20 }, (_, i) => `tag${i}`)
      }
    });

    const serialized = serializeConversation(largeConversation);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(1000);

    const deserialized = deserializeConversation(serialized);
    expect(deserialized.messages).toHaveLength(100);
    expect(deserialized.metadata.tags).toHaveLength(20);
  });

  test('deserialization handles invalid JSON gracefully', () => {
    expect(() => deserializeConversation('invalid json')).toThrow();
    expect(() => deserializeConversation('{}')).toThrow();
    expect(() => deserializeConversation('null')).toThrow();
    
    // Should throw for incomplete conversation data
    const incompleteData = JSON.stringify({ id: 'test' });
    expect(() => deserializeConversation(incompleteData)).toThrow();
  });
});

// =============================================================================
// IndexedDB Compatibility Tests
// =============================================================================

describe('Conversation Types - IndexedDB Compatibility', () => {
  test('validateConversationForStorage validates complete conversations', () => {
    const validConversation = createStorageConversation('Valid Conversation', {
      tabContext: createTabContext('https://example.com', 'Example')
    });

    const result = validateConversationForStorage(validConversation);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validateConversationForStorage catches invalid conversations', () => {
    const invalidConversation = {
      id: '', // Empty ID should fail
      title: 'Test',
      messages: [],
      metadata: {
        createdAt: 0, // Invalid timestamp
        updatedAt: Date.now(),
        messageCount: -1 // Negative count should fail
      }
    };

    const result = validateConversationForStorage(invalidConversation as any);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(error => error.includes('id'))).toBe(true);
    expect(result.errors.some(error => error.includes('messageCount'))).toBe(true);
  });

  test('conversations work with IndexedDB key constraints', () => {
    const conversation = createStorageConversation('Test');
    
    // Should have required 'id' field for IndexedDB keyPath
    expect(conversation.id).toBeTruthy();
    expect(typeof conversation.id).toBe('string');
    expect(conversation.id.length).toBeGreaterThan(0);
  });

  test('conversation metadata supports IndexedDB indexing', () => {
    const conversation = createStorageConversation('Test', {
      metadata: {
        tags: ['tag1', 'tag2'],
        archived: true,
        pinned: false
      }
    });

    // These fields should be indexable
    expect(typeof conversation.metadata.updatedAt).toBe('number');
    expect(typeof conversation.metadata.archived).toBe('boolean');
    expect(Array.isArray(conversation.metadata.tags)).toBe(true);
  });

  test('serialized conversations are under IndexedDB size limits', () => {
    // Create a reasonably large conversation
    const messages = Array.from({ length: 50 }, (_, i) => 
      createUserMessage(`Message ${i} with some longer content to test size limits`)
    );

    const conversation = createStorageConversation('Size Test', {
      messages,
      tabContext: createTabContext('https://example.com/very/long/path/with/many/segments', 'Long Title Example'),
      modelSettings: createModelSettings('openai', 'gpt-4', {
        systemPrompt: 'A very long system prompt that might be used in production scenarios with detailed instructions',
        customSettings: {
          key1: 'value1',
          key2: 'value2',
          key3: Array.from({ length: 10 }, (_, i) => `item${i}`)
        }
      })
    });

    const serialized = serializeConversation(conversation);
    
    // Should be reasonable size (< 1MB for typical conversations)
    expect(serialized.length).toBeLessThan(1024 * 1024);
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Conversation Types - Edge Cases', () => {
  test('handles circular references in metadata', () => {
    const circular: any = { key: 'value' };
    circular.self = circular;

    const conversation = createStorageConversation('Circular Test');
    
    // Should not be able to set circular references
    expect(() => {
      (conversation.metadata as any).circular = circular;
      serializeConversation(conversation);
    }).toThrow();
  });

  test('handles very long conversation titles', () => {
    const longTitle = 'A'.repeat(1000);
    const conversation = createStorageConversation(longTitle);
    
    expect(conversation.title).toBe(longTitle);
    
    const serialized = serializeConversation(conversation);
    const deserialized = deserializeConversation(serialized);
    
    expect(deserialized.title).toBe(longTitle);
  });

  test('handles special characters in URLs and text', () => {
    const specialUrl = 'https://example.com/path?query=value&special=™®©';
    const specialText = 'Text with émojis 🚀 and special chars: ™®©';
    
    const conversation = createStorageConversation(specialText, {
      tabContext: createTabContext(specialUrl, specialText, {
        selectedText: specialText
      })
    });

    const serialized = serializeConversation(conversation);
    const deserialized = deserializeConversation(serialized);

    expect(deserialized.title).toBe(specialText);
    expect(deserialized.tabContext?.url).toBe(specialUrl);
    expect(deserialized.tabContext?.selectedText).toBe(specialText);
  });

  test('handles empty and null values appropriately', () => {
    const conversation = createStorageConversation('', {
      tabContext: createTabContext('', ''),
      modelSettings: createModelSettings('', '')
    });

    expect(conversation.title).toBe('');
    expect(conversation.tabContext?.url).toBe('');
    expect(conversation.modelSettings?.provider).toBe('');
    
    // Should still be valid for storage despite empty values
    const result = validateConversationForStorage(conversation);
    expect(result.isValid).toBe(false); // Empty ID should make it invalid
  });

  test('maintains type safety with TypeScript strict mode', () => {
    // These should fail TypeScript compilation if types are wrong
    const conversation: ConversationData = createStorageConversation('Test');
    const tabContext: TabContext = createTabContext('https://example.com', 'Test');
    const modelSettings: ModelSettings = createModelSettings('openai', 'gpt-4');

    // Type assertions should work correctly
    expect(isConversationData(conversation)).toBe(true);
    expect(isTabContext(tabContext)).toBe(true);
    expect(isModelSettings(modelSettings)).toBe(true);
  });
});

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('Conversation Types - Utility Functions', () => {
  test('createTestConversation creates complete test conversations', () => {
    const conversation = createTestConversation();
    
    expect(conversation.title).toBe('Test Conversation');
    expect(conversation.tabContext?.url).toBe('https://example.com/test');
    expect(conversation.tabContext?.title).toBe('Example Test Page');
    expect(conversation.modelSettings?.provider).toBe('openai');
    expect(conversation.modelSettings?.model).toBe('gpt-4');
    expect(conversation.modelSettings?.temperature).toBe(0.7);
  });

  test('createTestConversation accepts overrides', () => {
    const conversation = createTestConversation('Custom Title', {
      modelSettings: createModelSettings('anthropic', 'claude-3-sonnet', {
        temperature: 0.5
      })
    });
    
    expect(conversation.title).toBe('Custom Title');
    expect(conversation.modelSettings?.provider).toBe('anthropic');
    expect(conversation.modelSettings?.model).toBe('claude-3-sonnet');
    expect(conversation.modelSettings?.temperature).toBe(0.5);
    // Tab context should still have defaults
    expect(conversation.tabContext?.url).toBe('https://example.com/test');
  });

  test('getConversationSummary extracts key information', () => {
    const conversation = createTestConversation('Summary Test', {
      messages: [
        createUserMessage('Hello'),
        createAssistantMessage('Hi there'),
        createUserMessage('How are you?')
      ],
      metadata: {
        lastActivity: 1640999800000
      }
    });

    // Update message count to match actual messages
    conversation.metadata.messageCount = conversation.messages.length;

    const summary = getConversationSummary(conversation);

    expect(summary.id).toBe(conversation.id);
    expect(summary.title).toBe('Summary Test');
    expect(summary.messageCount).toBe(3);
    expect(summary.lastActivity).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    expect(summary.provider).toBe('openai');
    expect(summary.model).toBe('gpt-4');
    expect(summary.url).toBe('https://example.com/test');
  });

  test('getConversationSummary handles missing optional fields', () => {
    const conversation = createStorageConversation('Minimal Test');
    
    const summary = getConversationSummary(conversation);

    expect(summary.id).toBe(conversation.id);
    expect(summary.title).toBe('Minimal Test');
    expect(summary.messageCount).toBe(0);
    expect(summary.provider).toBeUndefined();
    expect(summary.model).toBeUndefined();
    expect(summary.url).toBeUndefined();
  });
});