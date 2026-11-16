/* theme.json -> theme.css. Run `node site/theme/generate.mjs` after editing theme.json.
   Two layers: semantic (the general colours) and component (one entry per element and property). A component entry points at a general colour by "{semantic.name}" or holds a value directly (a colour code, a size).
   Every value becomes a CSS variable on <body>; the style files only ever read variables.
   A value can differ by area of the page: { "default": ..., "fantasy": ..., "betting": ... }. `default` is always required (it is what Betting and the unscoped page use);
   the other keys become overrides on body[data-area=fantasy] / body[data-area=betting]. */

const refToVar = ref => ref.replace(/^\{(semantic|font)\.([\w-]+)\}$/, (m, layer, name) => `var(--${{ semantic: 'color', font: 'font' }[layer]}-${name})`);
const valueOf = v => (typeof v === 'string' && v.startsWith('{') ? refToVar(v) : v);
const AREAS = ['fantasy', 'betting'];
/** A value that differs by area of the page. */
export const isAreaValue = v => v !== null && typeof v === 'object' && !Array.isArray(v) && ('default' in v);
const baseOf = v => (isAreaValue(v) ? v.default : v);

/** All variables of a theme as [name, value] pairs, in file order. */
export function themeVariables(theme) {
  const vars = [];
  for (const [k, v] of Object.entries(theme.semantic)) if (typeof baseOf(v) === 'string') vars.push([`--color-${k}`, valueOf(baseOf(v))]);
  for (const [k, v] of Object.entries(theme.font)) vars.push([`--font-${k}`, baseOf(v)]);
  for (const [area, comps] of Object.entries(theme.component))
    for (const [comp, els] of Object.entries(comps))
      for (const [el, props] of Object.entries(els))
        for (const [prop, v] of Object.entries(props)) vars.push([`--${area}-${comp}-${el}-${prop}`, valueOf(baseOf(v))]);
  return vars;
}

/** The overrides of the areas: [{ area, name, value }] for every value that has a "fantasy" / "betting" member. */
export function themeAreaVariables(theme) {
  const out = [], add = (name, v) => { if (isAreaValue(v)) for (const area of AREAS) if (area in v) out.push({ area, name, value: valueOf(v[area]) }); };
  for (const [k, v] of Object.entries(theme.semantic)) add(`--color-${k}`, v);
  for (const [k, v] of Object.entries(theme.font)) add(`--font-${k}`, v);
  for (const [area, comps] of Object.entries(theme.component))
    for (const [comp, els] of Object.entries(comps))
      for (const [el, props] of Object.entries(els))
        for (const [prop, v] of Object.entries(props)) add(`--${area}-${comp}-${el}-${prop}`, v);
  return out;
}

/** The area overrides as CSS rules: body[data-area=fantasy]{...} and body[data-area=betting]{...}. */
function areaRules(theme) {
  const over = themeAreaVariables(theme);
  return AREAS.map(area => { const mine = over.filter(o => o.area === area); return mine.length ? `body[data-area=${area}]{\n${mine.map(o => `${o.name}:${o.value}`).join(';\n')}\n}` : ''; }).filter(Boolean).join('\n');
}

/** For every component name, the selectors of the style sheets that read it (cssTexts = the text of the style sheets). Names a script sets itself are marked. */
export function selectorMap(theme, cssTexts) {
  const used = new Map();
  for (const css of cssTexts) {
    for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const v of m[2].matchAll(/var\((--[\w-]+)\)/g)) {
        if (!used.has(v[1])) used.set(v[1], new Set());
        used.get(v[1]).add(m[1].trim().replace(/\s+/g, ' '));
      }
    }
  }
  const out = [];
  for (const [area, comps] of Object.entries(theme.component)) for (const [comp, parts] of Object.entries(comps)) for (const [part, props] of Object.entries(parts)) for (const prop of Object.keys(props)) {
    const name = `${area}.${comp}.${part}.${prop}`, v = '--' + name.replaceAll('.', '-');
    out.push(`  ${name} : ${used.has(v) ? [...used.get(v)].join('  |  ') : '(set by a script)'}`);
  }
  return out;
}

export function buildThemeCss(theme, cssTexts = []) {
  const decl = themeVariables(theme).map(([k, v]) => `${k}:${v}`).join(';\n');
  const where = cssTexts.length ? `/* Where each component colour is used (name : selectors of the style sheets)\n${selectorMap(theme, cssTexts).join('\n')}\n*/\n` : '';
  return `/* Generated from theme.json by theme/generate.mjs. Do not edit by hand. */\nbody{\n${decl}\n}\n${areaRules(theme)}\n${where}`;
}

/** The text of every style sheet of the site except theme.css and the editor's own (for the selector map). Node only. */
export async function readStyleSheets(siteDir) {
  const { readdirSync, readFileSync } = await import('node:fs');
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
      if (e.isDirectory()) { if (e.name !== 'data') walk(p); }
      else if (e.name.endsWith('.css') && !['theme.css', 'editor.css'].includes(e.name)) out.push(readFileSync(p, 'utf8'));
    }
  })(siteDir);
  return out;
}

/* command line: node site/theme/generate.mjs [--check] */
if (typeof process !== 'undefined' && /generate.mjs$/.test(process.argv[1] || '')) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dir = new URL('./', import.meta.url);
  const css = buildThemeCss(JSON.parse(readFileSync(new URL('theme.json', dir), 'utf8')), await readStyleSheets(new URL('../', import.meta.url)));
  if (process.argv.includes('--check')) { if (readFileSync(new URL('theme.css', dir), 'utf8') !== css) { console.error('theme.css is out of date: run node site/theme/generate.mjs'); process.exit(1); } }
  else writeFileSync(new URL('theme.css', dir), css);
}
