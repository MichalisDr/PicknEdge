/* The theme editor's model: theme.json in, edited theme.json out. No screen here. The editor reads and writes only theme.json, so it adds no second source
   of truth; opening a theme and exporting it without a change gives back the same text. */
import { themeVariables } from './generate.mjs';

/** Text of theme.json -> theme object. */
export const parseTheme = text => JSON.parse(text);
/** Theme object -> text of theme.json (the format the file is kept in). */
export const serializeTheme = theme => JSON.stringify(theme, null, 1) + '\n';

/** Every token of the theme: { layer, key, cssVar, value }. key is the dotted name used in theme.json (area.component.element.property for component tokens). */
export function tokenIndex(theme, sizes = null) {
  const out = [];
  for (const [k, v] of Object.entries(theme.palette)) out.push({ layer: 'palette', key: k, cssVar: `--palette-${k}`, value: v });
  for (const [k, v] of Object.entries(theme.semantic)) if (typeof v === 'string') out.push({ layer: 'semantic', key: k, cssVar: `--color-${k}`, value: v });
  for (const [area, comps] of Object.entries(theme.component))
    for (const [comp, els] of Object.entries(comps))
      for (const [el, props] of Object.entries(els))
        for (const [prop, v] of Object.entries(props)) out.push({ layer: 'component', key: `${area}.${comp}.${el}.${prop}`, cssVar: `--${area}-${comp}-${el}-${prop}`, value: v });
  if (sizes) for (const [area, comps] of Object.entries(sizes.component))
    for (const [comp, els] of Object.entries(comps))
      for (const [el, props] of Object.entries(els))
        for (const [prop, v] of Object.entries(props)) out.push({ layer: 'layout', key: `${area}.${comp}.${el}.${prop}`, cssVar: `--${area}-${comp}-${el}-${prop}`, value: String(v) });
  return out;
}

const holder = (theme, t) => {
  if (t.layer === 'palette') return [theme.palette, t.key];
  if (t.layer === 'semantic') return [theme.semantic, t.key];
  const [area, comp, el, prop] = t.key.split('.');
  return [theme.component[area][comp][el], prop];
};
/** Set a token to a colour ("#rrggbb") or to a reference ("{semantic.panel}"). Returns a new theme; the old one is not changed. */
export function setToken(theme, t, value) {
  const next = structuredClone(theme); const [obj, k] = holder(next, t); obj[k] = value; return next;
}

/** Set a layout size (config/sizes.json). Numbers that were numbers stay numbers. Returns a new sizes object. */
export function setSize(sizes, t, value) {
  const next = structuredClone(sizes); const [area, comp, el, prop] = t.key.split('.'); const old = next.component[area][comp][el][prop];
  next.component[area][comp][el][prop] = typeof old === 'number' && /^-?[d.]+$/.test(value) ? Number(value) : value; return next;
}

/** A colour (hex or a reference) or a size (anything else)? */
export const isColourValue = v => /^(#|{)/.test(String(v));

/** The colour a token ends up with (references followed), or null for a reference that does not resolve. */
export function resolve(theme, value, depth = 0) {
  if (depth > 10) return null;
  const m = /^\{(palette|semantic)\.([\w-]+)\}$/.exec(value);
  if (!m) return value;
  const next = theme[m[1]][m[2]];
  if (next && typeof next === 'object') return resolve(theme, next.default, depth + 1);   // the accent: its default stands for the area-dependent value
  return typeof next === 'string' ? resolve(theme, next, depth + 1) : null;
}

/** Accepts only plain 6-digit hex for the colour pickers; anything else is shown as text. */
export const isHex6 = v => /^#[0-9a-fA-F]{6}$/.test(v);

export { themeVariables };
