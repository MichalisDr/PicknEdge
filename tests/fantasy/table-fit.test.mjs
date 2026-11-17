// Players name cell with real names: first column sized from the rows shown (230 px is the minimum), one width per CR / Value slot, family name never truncated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitWidths } from '../../site/fantasy/tables/table-fit.js';

const base = { pad: 20, crW: 34, valW: 60, gap: 5, min: 230 };
const row = (identity, family, figures = true) => ({ badge: 16, identity, family, figures });

test('the first column grows with the longest name and the slots; 230 is the minimum, not the maximum', () => {
  assert.equal(fitWidths({ ...base, rows: [row(40, 30)], avail: 1000 }).first, 230);
  const r = fitWidths({ ...base, rows: [row(140, 90), row(120, 70)], avail: 1000 });
  assert.equal(r.need, 20 + 16 + 5 + 140 + 5 + 34 + 5 + 60);
  assert.equal(r.first, r.need);
  assert.ok(r.first > 230);
});
test('when the container is tight the column stops at what fits, but never below what keeps every family name whole', () => {
  const rows = [row(160, 91), row(120, 70)];
  const tight = fitWidths({ ...base, rows, avail: 257 });
  assert.equal(tight.first, 257);
  assert.ok(tight.need > 257 && tight.mustHave <= 257, 'given names shrink, family names fit');
  const tighter = fitWidths({ ...base, rows, avail: 200 });
  assert.equal(tighter.first, tighter.mustHave, 'below the family-name need it stops there (236), not at 230');
  const impossible = fitWidths({ ...base, rows: [row(300, 260)], avail: 240 });
  assert.equal(impossible.first, impossible.mustHave, 'the family name wins over the container');
});
test('slot widths are the same for every row: a row without CR / sparkline, or with null data, does not change the column', () => {
  const full = fitWidths({ ...base, rows: [row(150, 80), row(140, 70)], avail: 1000 });
  const mixed = fitWidths({ ...base, rows: [row(150, 80), row(140, 70, false)], avail: 1000 });
  assert.equal(full.first, mixed.first);
  assert.equal(fitWidths({ ...base, crW: 0, valW: 0, rows: [row(140, 70, false)], avail: 1000 }).first, 230, 'no figures anywhere: no slot is reserved');
  assert.equal(fitWidths({ ...base, crW: 0, rows: [row(150, 80)], avail: 1000 }).need, 20 + 16 + 5 + 150 + 5 + 60, 'no CR anywhere: only the value slot');
});

test('the page measures after drawing and sets slot widths; the CSS shrinks only the given name', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/table.css', import.meta.url), 'utf8');
  assert.match(css, /name-cell-given-name"\]\{min-width:0;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css, /name-cell-family-name"\]\{flex:none\}/);
  assert.match(readFileSync(new URL('../../site/fantasy/tables/table-page.js', import.meta.url), 'utf8'), /fitFirstColumn/);
});

test('row hover reaches the sticky first cell: its own background is a colour only (the shorthand would reset the hover overlay), still opaque', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/table.css', import.meta.url), 'utf8');
  assert.match(css, /\.fw-t tbody tr:hover>\*\{background-image:linear-gradient\(/);
  assert.match(css, /\.fw-t tbody th:first-child\{background-color:var\(--fantasy-stat-table-first-column-body-background\)\}/);
  assert.ok(!/\.fw-t tbody th:first-child\{background:/.test(css));
});
test('the name underline is drawn under the given name and the family name, with a real space between them; focus-visible shows it too', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/workbench.css', import.meta.url), 'utf8');
  for (const p of ['hover', 'focus-visible']) for (const k of ['given', 'family']) assert.ok(css.includes(`.fw-name:${p} [data-part="fantasy.stat-table.name-cell-${k}-name"]`), `${p} ${k}`);
  assert.ok(css.includes(String.raw`name-cell-family-name"]::before{content:"\00a0"}`));
});
