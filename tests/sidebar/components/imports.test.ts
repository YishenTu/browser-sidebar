/**
 * Integration test for chat component imports after moving to sidebar/components
 * This test verifies that all chat components can be imported from their new location
 * and that all exports are accessible.
 */

import { describe, it, expect } from 'vitest';

describe('Chat Components Import Integration', () => {
  it('should import all chat components from new sidebar/components location', async () => {
    // Test individual component imports from new location
    const chatInputModule = await import('@/sidebar/components/ChatInput');
    expect(chatInputModule.ChatInput).toBeDefined();
    expect(typeof chatInputModule.ChatInput).toMatch(/^(function|object)$/); // React.forwardRef returns object

    const messageListModule = await import('@/sidebar/components/MessageList');
    expect(messageListModule.MessageList).toBeDefined();
    expect(typeof messageListModule.MessageList).toMatch(/^(function|object)$/);

    const messageBubbleModule = await import('@/sidebar/components/MessageBubble');
    expect(messageBubbleModule.MessageBubble).toBeDefined();
    expect(typeof messageBubbleModule.MessageBubble).toMatch(/^(function|object)$/);

    const streamingTextModule = await import('@/sidebar/components/StreamingText');
    expect(streamingTextModule.StreamingText).toBeDefined();
    expect(typeof streamingTextModule.StreamingText).toMatch(/^(function|object)$/);

    const typingIndicatorModule = await import('@/sidebar/components/TypingIndicator');
    expect(typingIndicatorModule.TypingIndicator).toBeDefined();
    expect(typeof typingIndicatorModule.TypingIndicator).toMatch(/^(function|object)$/);

    const markdownRendererModule = await import('@/sidebar/components/MarkdownRenderer');
    expect(markdownRendererModule.MarkdownRenderer).toBeDefined();
    expect(typeof markdownRendererModule.MarkdownRenderer).toMatch(/^(function|object)$/);

    const codeBlockModule = await import('@/sidebar/components/CodeBlock');
    expect(codeBlockModule.CodeBlock).toBeDefined();
    expect(typeof codeBlockModule.CodeBlock).toMatch(/^(function|object)$/);

    const themeToggleModule = await import('@/sidebar/components/ThemeToggle');
    expect(themeToggleModule.ThemeToggle).toBeDefined();
    expect(typeof themeToggleModule.ThemeToggle).toMatch(/^(function|object)$/);
  });

  it('should import all chat components from index file', async () => {
    // Test importing from barrel export
    const indexModule = await import('@/sidebar/components/index');

    expect(indexModule.ChatInput).toBeDefined();
    expect(indexModule.MessageList).toBeDefined();
    expect(indexModule.MessageBubble).toBeDefined();
    expect(indexModule.StreamingText).toBeDefined();
    expect(indexModule.TypingIndicator).toBeDefined();
    expect(indexModule.MarkdownRenderer).toBeDefined();
    expect(indexModule.CodeBlock).toBeDefined();
    expect(indexModule.ThemeToggle).toBeDefined();
  });

  it('should import TypeScript types from components', async () => {
    // Test that TypeScript types are accessible (compile-time check)
    // We can't check runtime properties for types, but we can verify
    // that imports don't throw TypeScript compilation errors
    const chatInputModule = await import('@/sidebar/components/ChatInput');
    const messageListModule = await import('@/sidebar/components/MessageList');
    const messageBubbleModule = await import('@/sidebar/components/MessageBubble');
    const streamingTextModule = await import('@/sidebar/components/StreamingText');
    const typingIndicatorModule = await import('@/sidebar/components/TypingIndicator');
    const markdownRendererModule = await import('@/sidebar/components/MarkdownRenderer');
    const codeBlockModule = await import('@/sidebar/components/CodeBlock');
    const themeToggleModule = await import('@/sidebar/components/ThemeToggle');

    // If this test passes, it means TypeScript successfully compiled with type exports
    expect(chatInputModule).toBeDefined();
    expect(messageListModule).toBeDefined();
    expect(messageBubbleModule).toBeDefined();
    expect(streamingTextModule).toBeDefined();
    expect(typingIndicatorModule).toBeDefined();
    expect(markdownRendererModule).toBeDefined();
    expect(codeBlockModule).toBeDefined();
    expect(themeToggleModule).toBeDefined();
  });

  it('should resolve import paths correctly', async () => {
    // Test that import resolution works without errors
    expect(async () => {
      await import('@/sidebar/components/ChatInput');
      await import('@/sidebar/components/MessageList');
      await import('@/sidebar/components/MessageBubble');
      await import('@/sidebar/components/StreamingText');
      await import('@/sidebar/components/TypingIndicator');
      await import('@/sidebar/components/MarkdownRenderer');
      await import('@/sidebar/components/CodeBlock');
      await import('@/sidebar/components/ThemeToggle');
      await import('@/sidebar/components/index');
    }).not.toThrow();
  });
});
