// The theme: theme.json is the only place for colours and fonts; theme.css is generated from it; scripts and style sheets only read variables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildThemeCss, themeVariables, readStyleSheets } from '../../site/theme/generate.mjs';
import { parseTheme, serializeTheme, tokenIndex, setToken, resolve } from '../../site/theme/editor-model.js';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const walk = (dir, ext, out = []) => {
  for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) {
    const rel = dir + e.name + (e.isDirectory() ? '/' : '');
    if (e.isDirectory()) { if (e.name !== 'data') walk(rel, ext, out); } else if (ext.some(x => e.name.endsWith(x))) out.push(rel);
  }
  return out;
};
const themeText = read('theme/theme.json'), theme = parseTheme(themeText);
const styles = walk('', ['.css']).filter(f => f !== 'theme/theme.css'), scripts = walk('', ['.js']);
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;   // in scripts: hex and rgb(a) / hsl(a)
const NAMED = /(?<![-\w])(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)(?![-\w])/;   // in style sheets: also colour names
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('theme.css is exactly what theme.json generates', async () => {
  assert.equal(read('theme/theme.css'), buildThemeCss(theme, await readStyleSheets(SITE)), 'run: node site/theme/generate.mjs');
});

test('no raw colours in any style sheet or script (only variables from the theme)', () => {
  for (const f of styles) assert.ok(!COLOUR.test(strip(read(f))) && !NAMED.test(strip(read(f)).replace(/white-space/g, '')), f + ' has a raw colour');
  for (const f of scripts) assert.ok(!COLOUR.test(strip(read(f)).replace(/^\s*\/\/.*$/gm, '')), f + ' has a raw colour');
});

test('no raw fonts: families come from the theme', () => {
  for (const f of styles) assert.ok(!/font-family|'Segoe UI'|sans-serif|serif/.test(strip(read(f))), f);
  for (const f of scripts) assert.ok(!/font-family|Segoe UI/.test(read(f)), f);
});

test('inline styles carry geometry only (position, size, grid placement), never colour, font or border', () => {
  for (const f of scripts.filter(f => !f.startsWith('theme/'))) {
    const src = read(f);
    for (const m of src.matchAll(/style="([^"]*)"/g)) assert.ok(!/color|background|fill|stroke|border|outline|font|shadow|opacity/.test(m[1]), `${f}: style="${m[1].slice(0, 60)}"`);
    for (const m of src.matchAll(/\.style\.(\w+)/g)) assert.ok(['left', 'top'].includes(m[1]), `${f}: .style.${m[1]}`);
  }
});

test('the accent is defined once: no style sheet sets --accent', () => {
  for (const f of styles) assert.ok(!/--accent|--color-accent\s*:/.test(strip(read(f))), f);
  assert.ok(!scripts.some(f => !f.startsWith('theme/') && /--accent/.test(read(f))));
});

test('every variable a style sheet or script reads exists in the theme (or is a layout variable)', () => {
  const defined = new Set([...themeVariables(theme).map(([k]) => k), '--color-accent']);
  const layout = new Set(['--rows', '--gap', '--rowsT']);
  for (const f of [...styles, ...scripts.filter(f => !f.startsWith('theme/'))])
    for (const m of read(f).matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(m[1]) || layout.has(m[1]) || m[1].endsWith('-'), `${f} reads ${m[1]}`);
});

test('nothing unused: every component token is read by a style sheet or a script', () => {
  const code = [...styles, ...scripts.filter(f => !f.startsWith('theme/'))].map(read).join('\n');
  const unused = tokenIndex(theme).filter(t => t.layer === 'component' && !code.includes(`var(${t.cssVar}`) && !code.includes(t.cssVar.replace(/-radar-(player|comparison)-(fill|line)$/, '-radar-${who}-$2')));
  assert.deepEqual(unused.map(t => t.key), []);
});

test('references resolve and variable names are unique', () => {
  const idx = tokenIndex(theme);
  assert.equal(new Set(idx.map(t => t.cssVar)).size, idx.length, 'two tokens share a variable name');
  for (const t of idx) assert.notEqual(resolve(theme, t.value), null, `${t.key} does not resolve`);
  for (const t of idx.filter(t => t.layer === 'palette')) assert.match(t.value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, t.key);
});

test('a component token follows the general colour it points at, until it is overridden', () => {
  const idx = tokenIndex(theme), c = idx.find(t => t.layer === 'component' && t.value === '{semantic.panel}');
  assert.ok(c, 'some component points at the panel colour');
  const changed = setToken(theme, idx.find(t => t.layer === 'semantic' && t.key === 'panel'), '#123456');
  assert.equal(resolve(changed, tokenIndex(changed).find(t => t.cssVar === c.cssVar).value), '#123456');
  const own = setToken(theme, c, '#abcdef'), other = tokenIndex(own).filter(t => t.layer === 'component' && t.value === '{semantic.panel}');
  assert.equal(resolve(own, tokenIndex(own).find(t => t.cssVar === c.cssVar).value), '#abcdef');
  assert.ok(other.length > 0, 'the others still follow the panel colour');
});

test('the theme editor round-trips: open, change nothing, export gives the same file; change and undo gives the same file', () => {
  assert.equal(serializeTheme(parseTheme(themeText)), themeText);
  const t = tokenIndex(theme).find(x => x.layer === 'component'), changed = setToken(theme, t, '#010203');
  assert.notEqual(serializeTheme(changed), themeText);
  assert.equal(serializeTheme(setToken(changed, t, t.value)), themeText);
});
