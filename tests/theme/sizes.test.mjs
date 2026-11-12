// Sizes: layout (width, height, min/max, margin, padding, gap, position) lives in config/sizes.json; appearance sizes (font size, radius, border width, shadow)
// live in theme/theme.json. Style sheets only read variables. Both files use the same names (screen.component.part.property).
//
// Exceptions that stay in the code on purpose:
//  - media-query breakpoints (@media (max-width: ...)): a variable cannot be used there;
//  - border and outline STYLE keywords (solid, dashed): only the width is a size;
//  - values that read layout variables the scripts set on the element (--rows, --gap, --rowsT);
//  - inline style in scripts: grid placement, column widths and pop-up position, which are computed from data;
//  - drawing geometry inside the SVG charts (label offsets, tick lengths) and the court (shot-zones.js: real court dimensions in centimetres, hexagon grid);
//  - zero values, and letter-spacing, line-height, z-index, opacity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildSizesCss, sizeVariables } from '../../site/config/generate.mjs';
import { themeVariables } from '../../site/theme/generate.mjs';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const walk = (dir, ext, out = []) => {
  for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) {
    const rel = dir + e.name + (e.isDirectory() ? '/' : '');
    if (e.isDirectory()) { if (e.name !== 'data') walk(rel, ext, out); } else if (ext.some(x => e.name.endsWith(x))) out.push(rel);
  }
  return out;
};
const sizes = JSON.parse(read('config/sizes.json')), theme = JSON.parse(read('theme/theme.json'));
const styles = walk('', ['.css']).filter(f => !['theme/theme.css', 'config/sizes.css', 'theme/editor.css'].includes(f));
const scripts = walk('', ['.js']).filter(f => !f.startsWith('theme/'));
const declarations = css => {
  const out = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\{([^{}]*)\}/g)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); if (i > 0) out.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]); }
  return out;
};
const nonzero = v => /(?<![\w.])[0-9.]*[1-9][0-9.]*/.test(v) || /\b(calc|min|max|clamp)\(/.test(v);
const LAYOUT = /^(width|height|min-width|max-width|min-height|max-height|margin(-top|-right|-bottom|-left)?|padding(-top|-right|-bottom|-left)?|gap|row-gap|column-gap|top|right|bottom|left|inset|flex-basis|grid-template-columns|grid-template-rows)$/;
const RADIUS = /^(border-radius|border-(top|bottom)-(left|right)-radius)$/;
const SET_BY_SCRIPT = /var\(--(rows|gap|rowsT)\)/;

test('sizes.css is exactly what sizes.json generates', () => {
  assert.equal(read('config/sizes.css'), buildSizesCss(sizes), 'run: node site/config/generate.mjs');
});

test('no raw layout size in any style sheet (only variables from config/sizes.json)', () => {
  for (const f of styles) for (const [p, v] of declarations(read(f)))
    if (LAYOUT.test(p) && nonzero(v) && !/^var\(--[\w-]+\)$/.test(v) && !SET_BY_SCRIPT.test(v)) assert.fail(`${f}: ${p}:${v}`);
});

test('no raw font size, radius, border or outline width, or shadow size outside the theme', () => {
  for (const f of styles) for (const [p, v] of declarations(read(f))) {
    if (p === 'font-size' || RADIUS.test(p) || p === 'outline-offset') assert.ok(!nonzero(v) || /^var\(--[\w-]+\)$/.test(v), `${f}: ${p}:${v}`);
    if (p === 'font') assert.ok(!/(?<![\w-])\d*\.?\d+(px|rem|em)\b/.test(v), `${f}: font:${v}`);
    if (/^(border|outline)(-(top|bottom|left|right))?$/.test(p)) assert.ok(!/^\d*\.?\d+px\s/.test(v), `${f}: ${p}:${v}`);
    if (p === 'box-shadow') for (const part of v.split(',')) assert.ok(!nonzero(part.slice(0, part.indexOf('var(') < 0 ? 0 : part.indexOf('var('))), `${f}: ${p}:${v}`);
  }
});

test('inline styles in scripts are computed geometry only (no literal px)', () => {
  for (const f of scripts) {
    const src = read(f);
    for (const m of src.matchAll(/style="([^"]*)"/g)) assert.ok(!/(?<![\w}$])\d+(\.\d+)?px/.test(m[1].replace(/\$\{[^}]*\}/g, '')), `${f}: style="${m[1].slice(0, 80)}"`);
  }
});

test('every variable a style sheet reads exists in theme.json or sizes.json (or is set by a script)', () => {
  const defined = new Set([...themeVariables(theme).map(([k]) => k), ...sizeVariables(sizes).map(([k]) => k), '--color-accent']);
  for (const f of styles) for (const m of read(f).matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(m[1]) || ['--rows', '--gap', '--rowsT'].includes(m[1]), `${f} reads ${m[1]}`);
});

test('theme.json and sizes.json share the names but never a variable', () => {
  const a = themeVariables(theme).map(([k]) => k), b = sizeVariables(sizes).map(([k]) => k);
  assert.deepEqual(a.filter(k => b.includes(k)), []);
  assert.equal(new Set(b).size, b.length);
});

test('nothing unused: every size is read by a style sheet or by a script', () => {
  const css = styles.map(read).join('\n'), js = scripts.map(read).join('\n');
  const dotted = new Set();
  for (const [screen, comps] of Object.entries(sizes.component)) for (const [c, parts] of Object.entries(comps)) for (const [p, props] of Object.entries(parts)) for (const prop of Object.keys(props)) {
    const cssVar = `--${screen}-${c}-${p}-${prop}`;
    if (!css.includes(`var(${cssVar})`) && !(js.includes(`${screen}.${c}.${p}.`) && js.includes(prop))) dotted.add(`${screen}.${c}.${p}.${prop}`);
  }
  assert.deepEqual([...dotted], []);
});

test('layout sizes of the card grid and the tables stay in their own files', () => {
  assert.ok(JSON.parse(read('config/layout.json')).layouts, 'config/layout.json: tile positions and sizes');
  assert.ok(JSON.parse(read('config/table-layouts.json')).numWidth, 'config/table-layouts.json: column widths');
});

test('every generated variable value is well formed (balanced brackets, no stray ; { })', () => {
  for (const [k, v] of [...themeVariables(theme), ...sizeVariables(sizes)]) {
    const text = String(v);
    assert.ok(!/[;{}]/.test(text), `${k}: ${text}`);
    assert.equal((text.match(/\(/g) || []).length, (text.match(/\)/g) || []).length, `${k}: ${text}`);
  }
});
