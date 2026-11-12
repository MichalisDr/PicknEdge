/* theme.json -> theme.css. Run `node site/theme/generate.mjs` after editing theme.json (the theme editor's Export button produces theme.json).
   Layers: palette (raw colours) -> semantic (meaning) -> component (one entry per element and property). Each layer points at the one below by "{layer.name}".
   Every value becomes a CSS variable on <body>; the style files only ever read variables. */

const refToVar = ref => ref.replace(/^\{(palette|semantic|font)\.([\w-]+)\}$/, (m, layer, name) => `var(--${{ palette: 'palette', semantic: 'color', font: 'font' }[layer]}-${name})`);
const valueOf = v => (typeof v === 'string' && v.startsWith('{') ? refToVar(v) : v);

/** All variables of a theme as [name, value] pairs, in file order. */
export function themeVariables(theme) {
  const vars = [];
  for (const [k, v] of Object.entries(theme.palette)) vars.push([`--palette-${k}`, v]);
  for (const [k, v] of Object.entries(theme.semantic)) if (typeof v === 'string') vars.push([`--color-${k}`, valueOf(v)]);
  for (const [k, v] of Object.entries(theme.font)) vars.push([`--font-${k}`, v]);
  for (const [area, comps] of Object.entries(theme.component))
    for (const [comp, els] of Object.entries(comps))
      for (const [el, props] of Object.entries(els))
        for (const [prop, v] of Object.entries(props)) vars.push([`--${area}-${comp}-${el}-${prop}`, valueOf(v)]);
  return vars;
}

/** The accent follows the area of the page: default / Fantasy / Betting. */
function accentRules(theme) {
  const a = theme.semantic.accent;
  return `body{--color-accent:${valueOf(a.default)}}body[data-area=fantasy]{--color-accent:${valueOf(a.fantasy)}}body[data-area=betting]{--color-accent:${valueOf(a.betting)}}`;
}

export function buildThemeCss(theme) {
  const decl = themeVariables(theme).map(([k, v]) => `${k}:${v}`).join(';\n');
  return `/* Generated from theme.json by theme/generate.mjs. Do not edit by hand. */\nbody{\n${decl}\n}\n${accentRules(theme)}\n`;
}

/* command line: node site/theme/generate.mjs [--check] */
if (typeof process !== 'undefined' && /generate.mjs$/.test(process.argv[1] || '')) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dir = new URL('./', import.meta.url);
  const css = buildThemeCss(JSON.parse(readFileSync(new URL('theme.json', dir), 'utf8')));
  if (process.argv.includes('--check')) { if (readFileSync(new URL('theme.css', dir), 'utf8') !== css) { console.error('theme.css is out of date: run node site/theme/generate.mjs'); process.exit(1); } }
  else writeFileSync(new URL('theme.css', dir), css);
}
