# Sidebar styles

The sidebar uses CSS `@layer` to control the cascade inside the Shadow DOM.
All styles live under `src/sidebar/styles/` and are imported from
`index.css` in a fixed order so component overrides stay predictable.

## Directory

```
styles/
├─ 0-foundation/   # reset.css, variables.css, animations.css
├─ 1-base/         # base layout + typography
├─ 2-layout/       # structural rules (resize handles, scrollbars)
├─ 3-components/   # shared component styles (buttons, markdown, tooltips, …)
├─ 4-features/     # feature-specific overrides (tab mentions, search sources)
└─ index.css       # defines @layer order and imports the files above
```

`index.css` declares the layer order as `reset, foundation, base, layout,
components, features, utilities`.  Only the first six are populated today; the
`utilities` layer is reserved for future helper classes (and is the only place
where `!important` is permitted).

## Guidelines

* Keep selectors scoped to `.ai-sidebar-container` or component-specific class
  names—Shadow DOM isolation prevents leaks, but explicit scoping keeps styles
  easy to reason about.
* Prefer CSS variables defined in `0-foundation/variables.css`.  Introduce new
  variables there when adding components.
* Add new component files under `3-components/` and import them from
  `index.css` alphabetically within the layer to avoid merge conflicts.
* Feature-specific combinations (e.g. multi-tab tab list) belong under
  `4-features/` so they can override component defaults without using
  `!important`.
* When bringing in third-party styles (KaTeX, Prism, …) import them within the
  appropriate layer so they honour the cascade.

## Development workflow

1. Add the CSS file in the correct subdirectory.
2. Import it from `index.css` with the matching `layer(...)` qualifier.
3. Run `npm run dev`—Vite will update the Shadow DOM styles without reloading the
   page.
