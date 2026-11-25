// The Charts gallery sits on the card-system scale (base 4). Type 12 14 16 20 24 32 48, line-heights 16 20 24 32 40 52, spacing 4 8 12 16 24 32 48 (every size token a multiple of 4), radii 4 8 16.
// Chart geometry that comes from the data (plot size, axis range, density-based logo and dot size) is not part of the scale, but its sizes snap to multiples of 4. Stroke and border widths are not part of it.
// The test fails when someone adds an off-scale value to a chart token, a media query, or a literal px in the chart scripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const SITE = new URL('../../site/', import.meta.url);
const read = rel => readFileSync(new URL(rel, SITE), 'utf8');
const sizes = JSON.parse(read('config/sizes.json')).component.fantasy['charts-gallery'];
const theme = JSON.parse(read('theme/theme.json')).component.fantasy['charts-gallery'];
const FONT = [12, 14, 16, 20, 24, 32, 48], LINE = [16, 20, 24, 32, 40, 52], RADIUS = [0, 4, 8, 16];
const props = obj => Object.entries(obj).flatMap(([part, p]) => Object.entries(p).map(([prop, value]) => ({ name: `${part}.${prop}`, part, prop, value })));
const pxs = v => [...String(v).matchAll(/(-?\d*\.?\d+)px/g)].map(m => +m[1]);

test('chart-gallery tokens exist (guard against an empty pass)', () => {
  assert.ok(props(sizes).length > 40 && props(theme).length > 20);
});

test('font sizes of the chart parts are on the type ladder, nothing below 12px, at every width', () => {
  const fonts = props(theme).filter(t => /^font-size/.test(t.prop));
  assert.ok(fonts.length >= 12);
  for (const t of fonts) assert.ok(FONT.includes(parseFloat(t.value)) && String(t.value).endsWith('px'), `${t.name}: ${t.value}`);
});

test('line-heights of the chart parts are on the ladder', () => {
  for (const t of props(theme).filter(t => /^line-height/.test(t.prop))) assert.ok(LINE.includes(parseFloat(t.value)), `${t.name}: ${t.value}`);
});

test('every chart text that sets a font size also sets a line-height on the ladder (none inherits 1.6 x size)', () => {
  const css = read('theme/fantasy/charts.css');
  for (const sel of ['.fc-card-title', '.fc-card-sub', '.fc-note', '.fc-mhead h2', '.fc-mhead h2 small', '.fc-legend']) {
    if (!css.includes(sel + '{')) continue;   // a part that exists at this point of the history
    const rule = css.match(new RegExp('(^|\n)' + sel.replace(/[.]/g, '\.') + '\{([^}]*)\}'));
    assert.ok(rule && /line-height:var\(/.test(rule[2]), `${sel} sets a line-height token`);
  }
});

test('radii of the chart parts are on the scale (4, 8, 16)', () => {
  for (const t of props(theme).filter(t => /radius/.test(t.prop))) assert.ok(RADIUS.includes(parseFloat(t.value)), `${t.name}: ${t.value}`);
});

test('spacing, heights and sizes of the chart parts are multiples of 4', () => {
  const spacing = /^(margin|padding|gap|row-gap|column-gap|height|min-height|max-height|swatch-size)(-|$)/;
  for (const t of props(sizes)) {
    if (t.part === 'plot') {   // drawing geometry: numbers in px; the data-driven ratios and the width are not sizes
      if (typeof t.value === 'number' && !/^(aspect|logo-density|bubble-radius)/.test(t.prop)) assert.equal(t.value % 4, 0, `${t.name}: ${t.value}`);
      continue;
    }
    if (spacing.test(t.prop)) for (const v of pxs(t.value)) assert.equal(v % 4, 0, `${t.name}: ${t.value}`);
  }
});

test('the spacing of the chart cards is on the spacing steps (4 8 12 16 24 32 48)', () => {
  const STEPS = [0, 4, 8, 12, 16, 24, 32, 48];
  for (const t of props(sizes)) if (t.part !== 'plot' && /^(margin|padding|gap|row-gap|column-gap)(-|$)/.test(t.prop)) for (const v of pxs(t.value)) assert.ok(STEPS.includes(Math.abs(v)), `${t.name}: ${t.value}`);
});

test('logo sizes are multiples of the step (4), density-based between the minimum and the maximum', () => {
  const p = sizes.plot;
  for (const k of ['logo-size-floor', 'logo-size-min', 'logo-size-min-narrow', 'logo-size-max', 'logo-size-max-narrow', 'dot-radius'].filter(k => k in p)) assert.equal(p[k] % p['logo-step'], 0, k);
  assert.equal(p['logo-step'], 4);
  assert.ok((p['logo-size-floor'] ?? 0) <= p['logo-size-min-narrow'] && p['logo-size-min'] <= p['logo-size-max'] && p['logo-size-min-narrow'] <= p['logo-size-max-narrow']);
});

test('the chart parts use the card system container queries, not viewport media queries or literal px in scripts', () => {
  const css = read('theme/fantasy/charts.css');
  assert.ok(!/@media/.test(css), 'charts.css has no @media');
  assert.ok(css.includes('@container fc (max-width:519px)'), 'narrow = container below 520px (the card system)');
  assert.ok(!Object.keys(sizes).concat(Object.keys(theme)).some(k => /650/.test(k)) && !props(sizes).concat(props(theme)).some(t => /650/.test(t.prop)), 'no -below-650px token');
  for (const f of readdirSync(new URL('fantasy/gallery/', SITE)).filter(f => f.endsWith('.js'))) {
    const src = read('fantasy/gallery/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/matchMedia/.test(src.replaceAll("matchMedia?.('(prefers-reduced-motion: reduce)')", '')), `${f}: no matchMedia (the one allowed is the reduced-motion preference, which is not a viewport query)`);
    assert.ok(!/(?<![\w.#-])\d+(\.\d+)?px/.test(src.replace(/\$\{[^}]*\}/g, '')), `${f}: no literal px`);
  }
});
