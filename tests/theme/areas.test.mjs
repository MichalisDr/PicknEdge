// Values that differ by area of the page: Fantasy gets the new palette, fonts and shell sizes; the default (Betting and the unscoped page) keeps its values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { themeAreaVariables, isAreaValue } from '../../site/theme/generate.mjs';
import { sizeAreaVariables } from '../../site/config/generate.mjs';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const theme = JSON.parse(read('theme/theme.json')), sizes = JSON.parse(read('config/sizes.json'));

// what Betting and the unscoped page had before the Fantasy palette (must not change)
const BEFORE = { bg: '#0b1018', panel: '#111a26', line: '#263242', muted: '#94a3b8', text: '#f0f3f6', chip: '#1d2a3c', gridline: '#3a4a60', sorthead: '#243248', sortcell: '#162131', 'surface-dialog': '#101925', 'surface-deep': '#0e1724', 'border-control': '#324052', 'border-soft': '#2b394b', 'accent-fantasy': '#ef3d25', 'accent-fantasy-light': '#ff8a78', 'accent-fantasy-dark': '#3a1b19', 'text-soft': '#d9e3ef', 'text-muted-2': '#94a6bc', 'text-subtle': '#a8b6c9', 'text-dim': '#b8c6d7' };
const FANTASY = { bg: '#09090b', panel: '#0e0e12', line: '#26242d', muted: '#a9a7b1', text: '#f5f2fb', chip: '#2c2250', gridline: '#26242d', sorthead: '#e93f29', sortcell: '#2c2250', 'surface-dialog': '#0e0e12', 'surface-deep': '#0e0e12', 'border-control': '#534568', 'border-soft': '#26242d', 'accent-fantasy': '#e93f29', 'accent-fantasy-light': '#ec6a5b', 'accent-fantasy-dark': '#341311', 'text-soft': '#f5f2fb', 'text-muted-2': '#a9a7b1', 'text-subtle': '#a9a7b1', 'text-dim': '#a9a7b1' };

test('every area value has a default; only fantasy / betting / default (and a note) are used as members', () => {
  const walk = (obj, path = '') => { for (const [k, v] of Object.entries(obj)) if (isAreaValue(v)) { for (const m of Object.keys(v)) assert.ok(['default', 'fantasy', 'betting', 'note'].includes(m), `${path}${k}.${m}`); } else if (v && typeof v === 'object') walk(v, path + k + '.'); };
  walk(theme); walk(sizes);
});

test('the Fantasy palette is the locked one; the default (Betting) values are unchanged', () => {
  for (const [k, v] of Object.entries(FANTASY)) { assert.equal(theme.semantic[k].fantasy, v, 'fantasy ' + k); assert.equal(theme.semantic[k].default, BEFORE[k], 'default ' + k); assert.equal(theme.semantic[k].betting, undefined, k + ' has no Betting override'); }
  assert.deepEqual({ violet: theme.semantic['violet-header'], field: theme.semantic.field, positive: theme.semantic.positive, hover: theme.semantic['row-hover'], thumb: theme.semantic['scroll-thumb'] }, { violet: '#19112e', field: '#100c19', positive: '#66d6a6', hover: '#ffffff12', thumb: '#982c1e' });
});

test('Inter (system fallback) and 14 px are the Fantasy font; Betting keeps Segoe UI and 15 px', () => {
  assert.match(theme.font.ui.fantasy, /^Inter,.*sans-serif$/); assert.equal(theme.font.ui.default, "'Segoe UI',sans-serif");
  assert.equal(theme.component.app.page.body['font-size'].fantasy, '14px'); assert.equal(theme.component.app.page.body['font-size'].default, '15px');
});

test('the shell sizes of the spec (top bar 61 px, sidebar 134 px, content padding) are Fantasy overrides; Betting keeps 82 px, 220 px, 38 px 4%', () => {
  const z = sizes.component.app;
  assert.deepEqual([z['top-bar'].bar.height.fantasy, z['top-bar'].bar.height.default], ['61px', '82px']);
  assert.deepEqual([z['top-bar'].bar.gap.fantasy, z['top-bar'].nav.gap.fantasy, z['top-bar'].nav['padding-left'].fantasy], ['16px', '24px', '12px']);
  assert.deepEqual([z.page.layout['grid-template-columns'].fantasy, z.page.layout['grid-template-columns'].default], ['134px 1fr', '220px 1fr']);
  assert.deepEqual([z.sidebar.panel.padding.fantasy, z.sidebar.link.padding.fantasy, z.sidebar.link.margin.fantasy], ['23px 9px', '9px 12px', '2px 0']);
  assert.equal(z.page.content.padding.default, '38px 4%');
  assert.equal(theme.component.app['top-bar']['nav-link']['border-bottom-width'].fantasy, '2px');
});

test('the generated style sheets carry the overrides under body[data-area=fantasy] only', () => {
  const themeCss = read('theme/theme.css'), sizesCss = read('config/sizes.css');
  assert.match(themeCss, /body\[data-area=fantasy\]\{[^}]*--color-bg:#09090b/);
  assert.match(sizesCss, /body\[data-area=fantasy\]\{[^}]*--app-top-bar-bar-height:61px/);
  assert.ok(!/body\[data-area=betting\]\{[^}]*--color-bg/.test(themeCss));
  assert.ok(themeAreaVariables(theme).length > 20 && sizeAreaVariables(sizes).length > 8);
  assert.match(themeCss.split('body[data-area=fantasy]')[0], /--color-bg:#0b1018/, 'the unscoped body keeps the old colour');
});

test('the Fantasy responsive rules of the shell: top bar wraps at 550 px, the sidebar becomes a row at 730 px; the 900 px rules are for the other areas', () => {
  const css = read('theme/base.css');
  assert.match(css, /@media\(max-width:730px\)\{body\[data-area=fantasy\] \.layout/);
  assert.match(css, /@media\(max-width:550px\)\{body\[data-area=fantasy\] \.top\{flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:900px\)\{body:not\(\[data-area=fantasy\]\) \.layout/);
});
