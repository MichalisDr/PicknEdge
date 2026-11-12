/* config/sizes.json -> sizes.css and config/arrangement.json -> arrangement.css. Run `node site/config/generate.mjs` after editing either file.
   sizes.json holds the layout of every named element: width, height, min/max, margin, padding, gap, position. arrangement.json holds the order of parts,
   direction, alignment and visibility of three components. Colours, fonts, font sizes, radii, borders and shadows are in theme/theme.json.
   All three files use the same names (screen.component.part.property); each value becomes a CSS variable on <body>. */

/** All variables of a sizes file as [name, value] pairs. */
export function sizeVariables(sizes) {
  const vars = [];
  for (const [screen, comps] of Object.entries(sizes.component))
    for (const [comp, parts] of Object.entries(comps))
      for (const [part, props] of Object.entries(parts))
        for (const [prop, v] of Object.entries(props)) vars.push([`--${screen}-${comp}-${part}-${prop}`, v]);
  return vars;
}

export function buildSizesCss(sizes) {
  return `/* Generated from sizes.json by config/generate.mjs. Do not edit by hand. */\nbody{\n${sizeVariables(sizes).map(([k, v]) => `${k}:${v}`).join(';\n')}\n}\n`;
}

const FLEX = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', 'space-between': 'space-between', row: 'row', column: 'column', wrap: 'wrap', nowrap: 'nowrap' };

/** The arrangement as CSS variables: direction, wrap, align, justify of a container, and `push: end` (margin-left: auto) of a group. */
export function arrangementVariables(arrangement) {
  const vars = [];
  for (const [screen, comps] of Object.entries(arrangement.component))
    for (const [comp, parts] of Object.entries(comps))
      for (const [part, entry] of Object.entries(parts)) {
        const base = `--${screen}-${comp}-${part}`;
        for (const k of ['direction', 'wrap', 'align', 'justify']) if (entry[k] !== undefined) {
          if (!(entry[k] in FLEX)) throw new Error(`${base}-${k}: unknown value ${entry[k]}`);
          vars.push([`${base}-${k}`, FLEX[entry[k]]]);
        }
        for (const p of entry.parts || []) if (p.self !== undefined) vars.push([`${base}-${p.name}-self`, FLEX[p.self]]);
        if (entry.push !== undefined) vars.push([`${base}-margin-left`, { end: 'auto', start: '0' }[entry.push]]);
      }
  return vars;
}

export function buildArrangementCss(arrangement) {
  return `/* Generated from arrangement.json by config/generate.mjs. Do not edit by hand. */\nbody{\n${arrangementVariables(arrangement).map(([k, v]) => `${k}:${v}`).join(';\n')}\n}\n`;
}

/* command line: node site/config/generate.mjs [--check] */
if (typeof process !== 'undefined' && /generate.mjs$/.test(process.argv[1] || '') && /config/.test(process.argv[1])) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dir = new URL('./', import.meta.url);
  let stale = false;
  for (const [json, css, build] of [['sizes.json', 'sizes.css', buildSizesCss], ['arrangement.json', 'arrangement.css', buildArrangementCss]]) {
    const out = build(JSON.parse(readFileSync(new URL(json, dir), 'utf8')));
    if (process.argv.includes('--check')) { if (readFileSync(new URL(css, dir), 'utf8') !== out) { console.error(`${css} is out of date: run node site/config/generate.mjs`); stale = true; } }
    else writeFileSync(new URL(css, dir), out);
  }
  if (stale) process.exit(1);
}
