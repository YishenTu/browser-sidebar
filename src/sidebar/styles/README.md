# CSS Architecture Guide

## Overview

This directory contains the modular CSS architecture for the AI Browser Sidebar extension. The styles are organized using a layered approach with CSS `@layer` for predictable cascade control and minimal `!important` usage.

## Directory Structure

```
styles/
├── 0-foundation/   # Variables, animations, reset
├── 1-base/        # Core styles and typography
├── 2-layout/      # Layout components
├── 3-components/  # Reusable UI components
├── 4-features/    # Feature-specific styles
└── index.css      # Main entry with layer definitions
```

## CSS Layers Architecture

The styles implement CSS `@layer` for cascade control:

```css
@layer reset, foundation, base, layout, components, features, utilities;
```

### Layer Order (lowest to highest priority):

1. **reset** - Browser normalization
2. **foundation** - CSS variables and animations
3. **base** - Core styles and typography
4. **layout** - Structural components
5. **components** - Reusable UI components
6. **features** - Feature-specific styles
7. **utilities** - Utility classes (only layer allowed to use `!important`)

## CSS Guidelines

### 1. Avoid `!important`

**❌ Don't:**

```css
.message-bubble {
  background: #2f67de !important;
  color: white !important;
}
```

**✅ Do:**

```css
/* Use CSS variables */
.message-bubble {
  background: var(--msg-user-bg);
  color: var(--msg-user-text);
}

/* Or use higher specificity */
.ai-sidebar-container .message-bubble {
  background: var(--msg-user-bg);
  color: var(--msg-user-text);
}
```

### 2. Use Component-Namespaced Variables

Variables are organized with component prefixes in `0-foundation/variables.css`:

```css
/* Message Bubbles */
--msg-user-bg: #2f67de;
--msg-user-text: white;

/* Chat Input */
--input-bg: transparent;
--input-text: #e5e7eb;

/* Modal */
--modal-bg: #1a1a1a;
--modal-text: #d4d4d4;
```

### 3. Specificity Management

Use the `.ai-sidebar-container` parent selector for natural specificity:

```css
/* Base style */
.chat-input {
  padding: 4px;
}

/* Override with higher specificity instead of !important */
.ai-sidebar-container .chat-input {
  padding: 8px;
}
```

### 4. Layer Usage

Place styles in appropriate layers:

```css
/* Foundation layer for variables */
@layer foundation {
  .ai-sidebar-container {
    --primary-color: #3b82f6;
  }
}

/* Component layer for UI components */
@layer components {
  .button {
    background: var(--primary-color);
  }
}

/* Utilities layer for override classes */
@layer utilities {
  .text-center {
    text-align: center !important; /* OK in utilities layer */
  }
}
```

### 5. File Organization

- **0-foundation/**: Variables, animations, reset styles
- **1-base/**: Typography, base element styles
- **2-layout/**: Page structure, sidebars, grids
- **3-components/**: Buttons, inputs, cards, modals
- **4-features/**: Complex feature-specific styles

### 6. Naming Conventions

Use BEM-inspired naming with component prefixes:

```css
/* Component */
.chat-input {
}

/* Component element */
.chat-input__textarea {
}

/* Component modifier */
.chat-input--loading {
}

/* Component state */
.chat-input.is-focused {
}
```

## Adding New Styles

### 1. Create Component File

Place in appropriate directory:

```bash
# For a new UI component
src/sidebar/styles/3-components/new-component.css

# For a feature
src/sidebar/styles/4-features/new-feature.css
```

### 2. Add Variables

Define component-specific variables in `0-foundation/variables.css`:

```css
/* New Component */
--new-component-bg: #1a1a1a;
--new-component-text: #e5e7eb;
--new-component-border: 1px solid rgba(75, 85, 99, 0.3);
```

### 3. Import in index.css

Add import in the correct section with appropriate layer:

```css
/* Components Layer */
@import './3-components/new-component.css' layer(components);
```

### 4. Write Styles Without !important

```css
/* new-component.css */
.ai-sidebar-container .new-component {
  background: var(--new-component-bg);
  color: var(--new-component-text);
  border: var(--new-component-border);
}
```

## Refactoring Legacy Styles

When refactoring styles with `!important`:

1. **Check if it's a utility class** - Keep `!important` in utilities
2. **Use CSS variables** - Replace hard-coded values
3. **Increase specificity** - Add parent selectors
4. **Use layers** - Let cascade order handle priority
5. **Test thoroughly** - Ensure visual appearance unchanged

## Current Statistics

- **Total CSS files**: 27
- **`!important` usage**: ~64 (75% reduction from original 259)
- **CSS Layers**: 7 defined layers
- **Component namespaces**: 10+ variable groups

## Testing CSS Changes

After modifying CSS:

1. **Build the project**: `npm run build`
2. **Check for visual regressions**: Load extension and verify UI
3. **Test responsive behavior**: Resize sidebar
4. **Verify dark/light themes**: If applicable
5. **Check component states**: Hover, focus, active states

## Performance Best Practices

1. **Use CSS variables** for dynamic values
2. **Avoid deep nesting** (max 3 levels)
3. **Minimize redundant selectors**
4. **Group related properties**
5. **Use shorthand where appropriate**
6. **Leverage CSS containment** for isolated components

## Migration Status

### Completed Refactoring

- ✅ reset.css - New reset layer created
- ✅ variables.css - Component namespaces added
- ✅ index.css - CSS layers implemented
- ✅ message-bubbles.css - 80 → 0 `!important`
- ✅ chat-input.css - 48 → 0 `!important`
- ✅ fullscreen-modal.css - 31 → 0 `!important`
- ✅ markdown-content.css - 23 → 0 `!important`
- ✅ typography.css - Moved to layers (utilities preserved)
- ✅ tab-content-item.css - 15 → 0 `!important`

### Pending Refactoring

- tab-mention-dropdown.css (12 `!important`)
- model-selector.css (12 `!important`)
- Other minor components

## Common Patterns

### Transparent Backgrounds

```css
.component {
  background: var(--input-bg, transparent);
  background-color: var(--input-bg, transparent);
}
```

### Focus States

```css
.input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}
```

### Hover Effects

```css
.button {
  transition: all 0.2s ease;
}

.button:hover {
  background: var(--hover-overlay);
  transform: scale(1.05);
}
```

## Troubleshooting

### Styles Not Applying

1. Check layer order in index.css
2. Verify import path is correct
3. Ensure parent selector specificity
4. Check for typos in class names

### Unexpected Cascade

1. Review layer definitions
2. Check specificity calculations
3. Look for conflicting `!important`
4. Verify variable inheritance

### Performance Issues

1. Reduce complex selectors
2. Minimize reflows/repaints
3. Use CSS containment
4. Optimize animations

## Contributing

When adding or modifying CSS:

1. Follow the guidelines above
2. Maintain the layered architecture
3. Add variables for new components
4. Document complex styles
5. Test across different states
6. Avoid adding `!important` except in utilities layer

## Resources

- [CSS Layers MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS Specificity Calculator](https://specificity.keegan.st/)
- [BEM Methodology](http://getbem.com/)
