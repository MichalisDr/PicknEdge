// The theme: theme.json is the only place for colours and fonts; theme.css is generated from it; scripts and style sheets only read variables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildThemeCss, themeVariables, readStyleSheets } from '../../site/theme/generate.mjs';
import { sizeVariables } from '../../site/config/generate.mjs';


const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const walk = (dir, ext, out = []) => {
  for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) {
    const rel = dir + e.name + (e.isDirectory() ? '/' : '');
    if (e.isDirectory()) { if (e.name !== 'data') walk(rel, ext, out); } else if (ext.some(x => e.name.endsWith(x))) out.push(rel);
  }
  return out;
};
const themeText = read('theme/theme.json'), theme = JSON.parse(themeText);
const components = t => Object.entries(t.component).flatMap(([a, cs]) => Object.entries(cs).flatMap(([c, ps]) => Object.entries(ps).flatMap(([p, props]) => Object.entries(props).map(([k, value]) => ({ key: `${a}.${c}.${p}.${k}`, cssVar: `--${a}-${c}-${p}-${k}`, value })))));
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
  const sizes = JSON.parse(read('config/sizes.json'));
  const defined = new Set([...themeVariables(theme).map(([k]) => k), ...sizeVariables(sizes).map(([k]) => k), '--color-accent']);
  const layout = new Set(['--rows', '--gap', '--rowsT']);
  for (const f of [...styles, ...scripts.filter(f => !f.startsWith('theme/'))])
    for (const m of read(f).matchAll(/var\((--[\w-]+)/g)) assert.ok(defined.has(m[1]) || layout.has(m[1]) || m[1].endsWith('-'), `${f} reads ${m[1]}`);
});

test('nothing unused: every component token is read by a style sheet or a script', () => {
  const code = [...styles, ...scripts.filter(f => !f.startsWith('theme/'))].map(read).join('\n');
  const unused = components(theme).filter(t => !code.includes(`var(${t.cssVar}`) && !code.includes(t.cssVar.replace(/-radar-(player|comparison)-(fill|line)$/, '-radar-${who}-$2')));
  assert.deepEqual(unused.map(t => t.key), []);
});

test('no palette: a component entry points at a general colour or holds its value directly; general colours are plain codes', () => {
  assert.equal(theme.palette, undefined);
  for (const [k, v] of Object.entries(theme.semantic)) if (typeof v === 'string') assert.match(v, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, 'general colour ' + k);
  for (const t of components(theme)) {
    const ref = /^\{semantic\.([\w-]+)\}$/.exec(t.value);
    if (ref) assert.ok(ref[1] in theme.semantic, `${t.key} points at a missing general colour`);
    else assert.ok(/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(t.value) || !/^[#{]/.test(t.value), `${t.key}: ${t.value}`);
  }
});

test('variable names are unique', () => {
  const names = themeVariables(theme).map(([k]) => k);
  assert.equal(new Set(names).size, names.length);
});
