// Players name cell v2: first column sized from the rows shown (230 px is the minimum), one width per CR / Value slot, neither name line ever clipped; row hover and name underline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitWidths } from '../../site/fantasy/tables/table-fit.js';

const base = { pad: 20, crW: 34, valW: 60, gap: 5, min: 230 };
const row = (identity, figures = true) => ({ badge: 16, identity, figures });
const css = f => readFileSync(new URL('../../site/theme/fantasy/' + f, import.meta.url), 'utf8');

test('the first column grows with the widest line and the slots; 230 is the minimum, not the maximum; it never stops short of the content', () => {
  assert.equal(fitWidths({ ...base, rows: [row(40)] }).first, 230);
  const r = fitWidths({ ...base, rows: [row(140), row(120)] });
  assert.equal(r.need, 20 + 16 + 5 + 140 + 5 + 34 + 5 + 60);
  assert.equal(r.first, r.need);
  assert.equal(fitWidths({ ...base, rows: [row(400)] }).first, fitWidths({ ...base, rows: [row(400)] }).need, 'no cap: the lines are never clipped');
});
test('slot widths are the same for every row: a row without figures does not change the column; no figures anywhere reserves nothing', () => {
  assert.equal(fitWidths({ ...base, rows: [row(150), row(140)] }).first, fitWidths({ ...base, rows: [row(150), row(140, false)] }).first);
  assert.equal(fitWidths({ ...base, crW: 0, valW: 0, rows: [row(140, false)] }).first, 230);
  assert.equal(fitWidths({ ...base, crW: 0, rows: [row(150)] }).need, 20 + 16 + 5 + 150 + 5 + 60, 'no CR anywhere: only the value slot');
});
test('the page measures after drawing and sets the slot widths and the column width', () => {
  assert.match(readFileSync(new URL('../../site/fantasy/tables/table-page.js', import.meta.url), 'utf8'), /fitFirstColumn/);
});
test('row hover reaches the sticky first cell: its own background is a colour only (the shorthand would reset the hover overlay), still opaque', () => {
  const t = css('table.css');
  assert.match(t, /\.fw-t tbody tr:hover>\*\{background-image:linear-gradient\(/);
  assert.match(t, /\.fw-t tbody th:first-child\{background-color:var\(--fantasy-stat-table-first-column-body-background\)\}/);
  assert.ok(!/\.fw-t tbody th:first-child\{background:/.test(t));
});
test('the name is one element: it is underlined as a whole on hover and focus-visible', () => {
  const w = css('workbench.css');
  assert.ok(w.includes('.fw-name:hover{text-decoration:underline'));
  assert.ok(w.includes('.fw-name:focus-visible{text-decoration:underline'));
  assert.ok(!/given-name/.test(w + css('table.css')));
});
test('vertical divider on the right edge of the first column: an inset 1 px line in the existing gridline token, on every cell of the sticky column (header, rows, League Average), no width or padding change', () => {
  const generated = css('../theme.css');
  assert.ok(generated.includes('--fantasy-stat-table-first-column-shadow:var(--color-gridline);') && generated.includes('--fantasy-stat-table-first-column-shadow-size:inset -1px 0 0;'));
  assert.match(css('table.css'), /\.fw-t th:first-child\{[^}]*position:sticky;[^}]*box-shadow:var\(--fantasy-stat-table-first-column-shadow-size\) var\(--fantasy-stat-table-first-column-shadow\)\}/);
});
