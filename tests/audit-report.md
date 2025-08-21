# Test Audit Report - Refactoring Task 0.1

## Overview

This document provides a comprehensive audit of all test files in the `/tests/` directory, categorizing them based on their fate during the upcoming refactoring process. The refactoring will consolidate chat components into a unified sidebar structure.

## Audit Summary

- **Total Test Files**: 36
- **Keep & Update**: 30 files
- **Remove**: 0 files
- **Migrate**: 0 files (all updates are path/import changes)

## Test File Categorization

### 1. KEEP & UPDATE - Chat Component Tests

**Location**: `/tests/components/Chat/`
**New Location**: `/tests/sidebar/components/`
**Status**: These tests cover core chat functionality that will be preserved but moved into the unified sidebar structure.

| Current File                          | New Location                                                    | Notes                                             |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `ChatInput.test.tsx`                  | `/tests/sidebar/components/ChatInput.test.tsx`                  | Comprehensive test suite for chat input component |
| `ChatPanel.test.tsx`                  | `/tests/sidebar/components/ChatPanel.test.tsx`                  | Main chat container tests                         |
| `CodeBlock.test.tsx`                  | `/tests/sidebar/components/CodeBlock.test.tsx`                  | Code syntax highlighting tests                    |
| `MarkdownRenderer.test.tsx`           | `/tests/sidebar/components/MarkdownRenderer.test.tsx`           | Markdown processing tests                         |
| `MessageBubble.test.tsx`              | `/tests/sidebar/components/MessageBubble.test.tsx`              | Individual message display tests                  |
| `MessageList.test.tsx`                | `/tests/sidebar/components/MessageList.test.tsx`                | Message list virtualization tests                 |
| `MessageList.virtualization.test.tsx` | `/tests/sidebar/components/MessageList.virtualization.test.tsx` | Advanced virtualization scenarios                 |
| `StreamingText.test.tsx`              | `/tests/sidebar/components/StreamingText.test.tsx`              | Text streaming animation tests                    |
| `TypingIndicator.test.tsx`            | `/tests/sidebar/components/TypingIndicator.test.tsx`            | Typing indicator animation tests                  |

**Import Updates Required**: All imports from `@/components/Chat/` → `@sidebar/components/`

### 2. KEEP & UPDATE - UI Component Tests

**Location**: `/tests/components/ui/`
**New Location**: `/tests/sidebar/components/ui/`
**Status**: Reusable UI components that will move into the sidebar structure.

| Current File                  | New Location                                               | Notes                        |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `Button.test.tsx`             | `/tests/sidebar/components/ui/Button.test.tsx`             | Button component unit tests  |
| `Button.integration.test.tsx` | `/tests/sidebar/components/ui/Button.integration.test.tsx` | Button integration scenarios |
| `Card.test.tsx`               | `/tests/sidebar/components/ui/Card.test.tsx`               | Card layout component tests  |
| `IconButton.test.tsx`         | `/tests/sidebar/components/ui/IconButton.test.tsx`         | Icon button variant tests    |
| `Input.test.tsx`              | `/tests/sidebar/components/ui/Input.test.tsx`              | Input component tests        |
| `Spinner.test.tsx`            | `/tests/sidebar/components/ui/Spinner.test.tsx`            | Loading spinner tests        |
| `TextArea.test.tsx`           | `/tests/sidebar/components/ui/TextArea.test.tsx`           | Textarea component tests     |

**Import Updates Required**: All imports from `@/components/ui/` → `@sidebar/components/ui/`

### 3. KEEP & UPDATE - Sidebar Tests

**Location**: `/tests/sidebar/`
**Status**: Main sidebar tests that will be updated for the unified component structure.

| Current File                      | Updates Required                               | Notes                                           |
| --------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `Sidebar.test.tsx`                | Import path updates                            | Main sidebar container tests - will be expanded |
| `components/ThemeToggle.test.tsx` | Import path: `@sidebar/components/ThemeToggle` | Theme toggle functionality                      |
| `mount-unmount.test.tsx`          | Import path updates                            | Sidebar lifecycle tests                         |

**Import Updates Required**: Update all imports to use new unified sidebar structure.

### 4. KEEP AS-IS - Store Tests

**Location**: `/tests/store/`
**Status**: State management tests remain unchanged as store structure is stable.

| File               | Status            | Notes                       |
| ------------------ | ----------------- | --------------------------- |
| `chat.test.ts`     | No changes needed | Chat state management tests |
| `index.test.ts`    | No changes needed | Store index and exports     |
| `settings.test.ts` | No changes needed | Settings state tests        |

### 5. KEEP AS-IS - Infrastructure Tests

**Location**: Various directories
**Status**: Framework and utility tests that don't require changes.

| File                               | Location              | Status     | Notes                          |
| ---------------------------------- | --------------------- | ---------- | ------------------------------ |
| `messageHandler.test.ts`           | `/tests/background/`  | No changes | Background script tests        |
| `ThemeContext.test.tsx`            | `/tests/contexts/`    | No changes | Theme context provider tests   |
| `background-content.test.ts`       | `/tests/integration/` | No changes | Integration tests              |
| `message-roundtrip-simple.test.ts` | `/tests/integration/` | No changes | Message passing tests          |
| `chrome-mocks.test.ts`             | `/tests/mocks/`       | No changes | Chrome API mock validation     |
| `chrome.ts`                        | `/tests/mocks/`       | No changes | Chrome API mock implementation |
| `chrome-mock.ts`                   | `/tests/setup/`       | No changes | Test setup for Chrome APIs     |
| `setup.ts`                         | `/tests/setup/`       | No changes | Global test configuration      |

### 6. KEEP AS-IS - Styles Tests

**Location**: `/tests/styles/`
**Status**: CSS and styling tests remain valid as they test design system components.

| File                                    | Status     | Notes                        |
| --------------------------------------- | ---------- | ---------------------------- |
| `components.test.tsx`                   | No changes | Component styling tests      |
| `dark-mode.test.ts`                     | No changes | Dark mode theme tests        |
| `sidebar-tailwind-integration.test.tsx` | No changes | Tailwind integration tests   |
| `tailwind-integration-final.test.tsx`   | No changes | Final Tailwind validation    |
| `tailwind.test.ts`                      | No changes | Tailwind configuration tests |
| `theme-values.test.ts`                  | No changes | Theme value validation       |
| `variables.test.ts`                     | No changes | CSS variable tests           |

### 7. KEEP AS-IS - Type & Utility Tests

**Location**: `/tests/types/` and `/tests/utils/`
**Status**: Type definitions and utilities don't require changes.

| File                | Location        | Status     | Notes                     |
| ------------------- | --------------- | ---------- | ------------------------- |
| `chat.test.ts`      | `/tests/types/` | No changes | Chat type definitions     |
| `manifest.test.ts`  | `/tests/types/` | No changes | Extension manifest types  |
| `messages.test.ts`  | `/tests/types/` | No changes | Message type validation   |
| `messaging.test.ts` | `/tests/utils/` | No changes | Message utility functions |
| `mockChat.test.ts`  | `/tests/utils/` | No changes | Mock chat functionality   |
| `test-utils.tsx`    | `/tests/utils/` | No changes | Test utility helpers      |
| `theme.test.ts`     | `/tests/utils/` | No changes | Theme utility functions   |
| `README.md`         | `/tests/utils/` | No changes | Utils documentation       |

## DEMO COMPONENT ANALYSIS

**Result**: No demo component tests found in the test suite.

After thorough analysis, there are **no test files** for demo components (`/src/components/demo/`) in the current test suite. This means:

- No test files need to be removed
- All existing tests cover production components that will be preserved

## Migration Strategy

### Phase 1: Directory Structure Updates

1. Create new directory structure:

   ```
   /tests/sidebar/components/
   /tests/sidebar/components/ui/
   ```

2. Move test files to new locations as specified above.

### Phase 2: Import Path Updates

Update import statements in all moved test files:

- `@/components/Chat/` → `@sidebar/components/`
- `@/components/ui/` → `@sidebar/components/ui/`
- Update any relative imports to match new structure

### Phase 3: Test Configuration Updates

- Update test path aliases in `vite.config.ts` if needed
- Verify all test imports resolve correctly
- Update any glob patterns in test runners

## Risk Assessment

### Low Risk

- Store tests (no changes required)
- Infrastructure tests (no changes required)
- Style tests (no changes required)
- Type tests (no changes required)

### Medium Risk

- Import path updates (straightforward but requires careful execution)
- Directory moves (potential for missing files)

### High Risk

- None identified - all changes are mechanical

## Validation Checklist

After migration:

- [ ] All tests run successfully with `npm test`
- [ ] No broken import statements
- [ ] Test coverage remains at current levels
- [ ] All moved files are in correct new locations
- [ ] No orphaned test files in old locations

## Dependencies & Considerations

### Test Dependencies

- `@tests/utils/test-utils` - remains unchanged
- Chrome API mocks - remain unchanged
- Vitest configuration - may need path updates

### Special Considerations

1. **Virtualization Tests**: `MessageList.virtualization.test.tsx` has complex DOM manipulation - ensure it works in new location
2. **Integration Tests**: Background-content integration tests may need import updates if they reference moved components
3. **CSS Tests**: Component styling tests should continue working as CSS classes are preserved

## Conclusion

The test migration is **low-complexity** with **minimal risk**. All 36 test files have clear migration paths:

- 30 files need path/import updates
- 6 files remain unchanged
- 0 files need removal

The main work involves systematic file moves and import path updates. No test logic modifications are required, ensuring test coverage and quality remain intact during the refactoring process.
