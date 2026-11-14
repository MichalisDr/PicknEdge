# Icons

The rule: **every icon is an SVG drawn with `currentColor` only.**

- No hex, `rgb()`, `hsl()` or colour names inside an icon file. Use `fill="currentColor"` and/or `stroke="currentColor"` (or `none`).
- The colour therefore comes from the element around the icon: the theme key (`color`) of the button, chip or label that holds it. To recolour an icon, change that element's theme key, never the file.
- One file per icon, named in lower-case with hyphens (`arrow-up-right.svg`), with a `viewBox` and no fixed `width` / `height`.
- Use an icon with the helper in `core/icons.js`: `await loadIcons(['arrow-up-right'])` once, then `icon('arrow-up-right')` returns the inline `<svg>` markup.
- `tests/theme/theme.test.mjs` scans this folder for raw colours.
