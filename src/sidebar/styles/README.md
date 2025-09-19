# CSS Architecture Guide

The sidebar uses a layered CSS architecture (`@layer`) to keep styles predictable inside the Shadow DOM. Each layer has a clear purpose and resides in its own directory.

## Directory Structure

```
styles/
├── 0-foundation/   # Variables, reset, animations
├── 1-base/         # Element defaults, typography
├── 2-layout/       # Layout primitives (container, header, footer, overlays)
├── 3-components/   # Reusable UI components (chat input, screenshots, dropdowns)
├── 4-features/     # Feature-specific styling (settings, extraction previews)
└── index.css       # Entry point, defines layer order
```

## Layer Order

```css
@layer reset, foundation, base, layout, components, features, utilities;
```

1. **reset** — Browser normalization
2. **foundation** — Variables, animations, theme tokens
3. **base** — Plain element selectors
4. **layout** — Structural containers/positioning
5. **components** — Reusable building blocks (chat input, screenshot preview, tooltips)
6. **features** — Page-level features (settings panel, extraction preview, screenshot modal)
7. **utilities** — One-off utility classes (limited, `!important` allowed only here)

## Guidelines

- Avoid `!important` outside the `utilities` layer; control cascade via layer order and specificity.
- Define component-scoped variables in `0-foundation/variables.css` (e.g., `--screenshot-border`, `--message-user-bg`).
- Keep selectors scoped with `.ai-sidebar-container` to maintain isolation.
- Co-locate new component styles in `3-components/`; feature composites (settings modal, screenshot capture overlay) live in `4-features/`.
- Import new files through `index.css` with explicit layer declarations:

```css
@import './3-components/screenshot-preview.css' layer(components);
@import './4-features/settings-panel.css' layer(features);
```

## Adding New Styles

1. Create the CSS file under the appropriate directory/layer.
2. Define variables (if needed) in `0-foundation/variables.css`.
3. Import the file in `index.css` with the correct `layer(...)` annotation.
4. Use BEM-ish naming for readability (`.chat-input__textarea`, `.screenshot-preview__thumb`).
5. Reserve utilities for deliberate overrides (e.g., `.u-text-center` with `text-align: center !important`).

## Notes

- Screenshot capture + uploads share styles between `chat-input-images.css`, `screenshot-preview.css`, and `features/screenshot-modal.css`.
- Message attachments and inline extraction previews use CSS variables to honor theme tweaks made in Settings.
- The entire stylesheet is bundled via Vite and injected inside the Shadow DOM root; no global leakage into host pages.
