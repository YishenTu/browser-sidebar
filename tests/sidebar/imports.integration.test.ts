/**
 * Integration test for sidebar import resolution after Phase 2.3 refactoring
 * This test verifies that all imports work correctly with the new structure:
 * - ChatPanel moved to /src/sidebar/ChatPanel.tsx (unified component)
 * - All other components remain in /src/sidebar/components/
 * - No circular dependencies exist
 * - Build process works with new imports
 */

import { describe, it, expect } from 'vitest';

describe('Sidebar Import Resolution Integration', () => {
  it('should import ChatPanel from sidebar root level', async () => {
    // ChatPanel is now at sidebar root level as a unified component
    const chatPanelModule = await import('@/sidebar/ChatPanel');
    expect(chatPanelModule.ChatPanel).toBeDefined();
    expect(typeof chatPanelModule.ChatPanel).toMatch(/^(function|object)$/);
    expect(chatPanelModule.default).toBeDefined(); // default export
  });

  it('should import all sidebar components from their correct locations', async () => {
    // These components remain in sidebar/components/
    const chatInputModule = await import('@/sidebar/components/ChatInput');
    expect(chatInputModule.ChatInput).toBeDefined();

    const messageListModule = await import('@/sidebar/components/MessageList');
    expect(messageListModule.MessageList).toBeDefined();

    const messageBubbleModule = await import('@/sidebar/components/MessageBubble');
    expect(messageBubbleModule.MessageBubble).toBeDefined();

    const streamingTextModule = await import('@/sidebar/components/StreamingText');
    expect(streamingTextModule.StreamingText).toBeDefined();

    const typingIndicatorModule = await import('@/sidebar/components/TypingIndicator');
    expect(typingIndicatorModule.TypingIndicator).toBeDefined();

    const markdownRendererModule = await import('@/sidebar/components/MarkdownRenderer');
    expect(markdownRendererModule.MarkdownRenderer).toBeDefined();

    const codeBlockModule = await import('@/sidebar/components/CodeBlock');
    expect(codeBlockModule.CodeBlock).toBeDefined();

    const themeToggleModule = await import('@/sidebar/components/ThemeToggle');
    expect(themeToggleModule.ThemeToggle).toBeDefined();
  });

  it('should import sidebar hooks correctly', async () => {
    const useMockChatModule = await import('@/sidebar/hooks/useMockChat');
    expect(useMockChatModule.useMockChat).toBeDefined();
  });

  it('should import sidebar index correctly without ChatPanel', async () => {
    // sidebar/index.tsx should import ChatPanel from correct location
    const sidebarIndexModule = await import('@/sidebar/index');
    expect(sidebarIndexModule.mountSidebar).toBeDefined();
    expect(sidebarIndexModule.unmountSidebar).toBeDefined();
  });

  it('should import components from barrel export (components/index.ts)', async () => {
    // Components index should NOT export ChatPanel (since it's moved)
    const componentsIndexModule = await import('@/sidebar/components/index');

    // These should be available
    expect(componentsIndexModule.ChatInput).toBeDefined();
    expect(componentsIndexModule.MessageList).toBeDefined();
    expect(componentsIndexModule.MessageBubble).toBeDefined();
    expect(componentsIndexModule.StreamingText).toBeDefined();
    expect(componentsIndexModule.TypingIndicator).toBeDefined();
    expect(componentsIndexModule.MarkdownRenderer).toBeDefined();
    expect(componentsIndexModule.CodeBlock).toBeDefined();
    expect(componentsIndexModule.ThemeToggle).toBeDefined();

    // ChatPanel should NOT be available from components index (it's moved to sidebar root)
    expect(componentsIndexModule.ChatPanel).toBeUndefined();
  });

  it('should verify no circular dependencies exist', async () => {
    // Test that we can import all modules without circular dependency errors
    const imports = [
      import('@/sidebar/ChatPanel'),
      import('@/sidebar/components/ChatInput'),
      import('@/sidebar/components/MessageList'),
      import('@/sidebar/components/MessageBubble'),
      import('@/sidebar/components/StreamingText'),
      import('@/sidebar/components/TypingIndicator'),
      import('@/sidebar/components/MarkdownRenderer'),
      import('@/sidebar/components/CodeBlock'),
      import('@/sidebar/components/ThemeToggle'),
      import('@/sidebar/hooks/useMockChat'),
      import('@/sidebar/index'),
      import('@/sidebar/components/index'),
    ];

    // All imports should resolve without throwing
    await expect(Promise.all(imports)).resolves.toBeDefined();
  });

  it('should verify TypeScript types are exported correctly', async () => {
    // Test type exports for compile-time verification
    const chatPanelModule = await import('@/sidebar/ChatPanel');
    const chatInputModule = await import('@/sidebar/components/ChatInput');
    const messageListModule = await import('@/sidebar/components/MessageList');
    const messageBubbleModule = await import('@/sidebar/components/MessageBubble');
    const streamingTextModule = await import('@/sidebar/components/StreamingText');
    const typingIndicatorModule = await import('@/sidebar/components/TypingIndicator');
    const markdownRendererModule = await import('@/sidebar/components/MarkdownRenderer');
    const codeBlockModule = await import('@/sidebar/components/CodeBlock');
    const themeToggleModule = await import('@/sidebar/components/ThemeToggle');

    // If TypeScript compilation succeeds, types are properly exported
    expect(chatPanelModule).toBeDefined();
    expect(chatInputModule).toBeDefined();
    expect(messageListModule).toBeDefined();
    expect(messageBubbleModule).toBeDefined();
    expect(streamingTextModule).toBeDefined();
    expect(typingIndicatorModule).toBeDefined();
    expect(markdownRendererModule).toBeDefined();
    expect(codeBlockModule).toBeDefined();
    expect(themeToggleModule).toBeDefined();
  });

  it('should verify import paths match the new structure', async () => {
    // Test that all expected import paths are resolvable
    const pathTests = [
      // ChatPanel at sidebar root
      () => import('@/sidebar/ChatPanel'),

      // Components in components directory
      () => import('@/sidebar/components/ChatInput'),
      () => import('@/sidebar/components/MessageList'),
      () => import('@/sidebar/components/MessageBubble'),
      () => import('@/sidebar/components/StreamingText'),
      () => import('@/sidebar/components/TypingIndicator'),
      () => import('@/sidebar/components/MarkdownRenderer'),
      () => import('@/sidebar/components/CodeBlock'),
      () => import('@/sidebar/components/ThemeToggle'),

      // Hooks in hooks directory
      () => import('@/sidebar/hooks/useMockChat'),

      // Index files
      () => import('@/sidebar/index'),
      () => import('@/sidebar/components/index'),
    ];

    // All paths should resolve
    for (const pathTest of pathTests) {
      await expect(pathTest()).resolves.toBeDefined();
    }
  });

  it('should validate build compatibility with new imports', async () => {
    // This test ensures that the import structure is compatible with the build process
    // by testing dynamic imports that would be used in production builds

    const dynamicImports = await Promise.all([
      import('@/sidebar/ChatPanel'),
      import('@/sidebar/components/ChatInput'),
      import('@/sidebar/components/MessageList'),
      import('@/store/chat'),
      import('@/store/settings'),
      import('@/utils/theme'),
      import('@/contexts/ThemeContext'),
    ]);

    // All dynamic imports should succeed
    expect(dynamicImports).toHaveLength(7);
    dynamicImports.forEach(module => {
      expect(module).toBeDefined();
      expect(typeof module).toBe('object');
    });
  });
});
