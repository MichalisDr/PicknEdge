/* sizes.json -> sizes.css. Run `node site/config/generate.mjs` after editing sizes.json (the theme editor's Export button for sizes produces sizes.json).
   sizes.json holds the layout of every named element: width, height, min/max, margin, padding, gap, position. Colours, fonts, font sizes, radii, borders and
   shadows are in theme/theme.json. Both files use the same names (screen.component.part.property); each becomes a CSS variable on <body>. */

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

/* command line: node site/config/generate.mjs [--check] */
if (typeof process !== 'undefined' && /generate.mjs$/.test(process.argv[1] || '') && /config/.test(process.argv[1])) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dir = new URL('./', import.meta.url);
  const css = buildSizesCss(JSON.parse(readFileSync(new URL('sizes.json', dir), 'utf8')));
  if (process.argv.includes('--check')) { if (readFileSync(new URL('sizes.css', dir), 'utf8') !== css) { console.error('sizes.css is out of date: run node site/config/generate.mjs'); process.exit(1); } }
  else writeFileSync(new URL('sizes.css', dir), css);
}
