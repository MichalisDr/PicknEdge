// Static checks of the table sources: one Shooting toggle, no Colours button, no GP column, rank chip, one-line headers, theme variables only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../../site/' + f, import.meta.url), 'utf8');
const js = read('fantasy-tables.js'), css = read('fantasy-table.css'), html = read('index.html');

test('one "Shooting" toggle instead of the two-button Profile/Shooting switch; the page opens in Profile', () => {
  assert.match(js, /data-view-toggle aria-pressed="\$\{state\.view === 'shooting'\}">Shooting</);
  assert.ok(!/data-view="/.test(js) && !/\['profile', 'shooting'\]/.test(js));
  assert.match(js, /state\.view = state\.view === 'shooting' \? 'profile' : 'shooting'/);
  assert.match(js, /state\.view = 'profile';\s*\/\/ the page always opens in Profile/);
});
test('no Colours button and no switch: evaluation colours are always on', () => {
  assert.ok(!/Colours|data-colours|state\.colours/.test(js));
});
test('no GP column, no subtitle or credits slot in the first column, no sub-lines in cells', () => {
  assert.ok(!/fw-gp|>GP<|fw-cr-slot|fw-sub|fw-cov/.test(js));
  assert.match(js, /<th><button class="fw-name"[^>]*>\$\{esc\(r\.name\)\}<\/button><\/th>/);
});
test('a cell is the value and a rank chip (two lines at most)', () => {
  assert.match(js, /<i class="fw-rk">#\$\{r\.position\}<\/i>/);
  assert.match(css, /\.fw-t \.fw-cell\{display:flex;flex-direction:column/);
  const chip = css.match(/.fw-t .fw-rk{([^}]*)}/)[1];   // filled, no border, small radius (not a pill), bold, theme variables only
  assert.ok(chip.includes('background:var(--chip)') && chip.includes('border-radius:4px') && chip.includes('font-weight:700') && !/border:/.test(chip), chip);
});
test('headers stay on one line; sorted column and group line use their theme variables', () => {
  assert.match(css, /\.fw-t thead th button\{white-space:nowrap/);
  assert.match(css, /fw-sorted\{background:var\(--sorthead\)\}/);
  assert.match(css, /td\.fw-sorted\{background:var\(--sortcell\)\}/);
  assert.match(css, /height:2px;background:var\(--groupline\)/);
  assert.equal(js.split("'color:var(--eval-'").length - 1, 2);   // value colours use the visible text variables
  for (const v of ['--chip', '--eval-good-text', '--eval-bad-text', '--gridline', '--sorthead', '--sortcell', '--groupline']) assert.ok(html.includes(v + ':'), v + ' defined in :root');
});
test('the table frame shrinks to the table (no empty framed area beside it)', () => {
  assert.ok(css.includes('.fw-table-wrap{width:fit-content;max-width:100%;'));
});
test('no zebra: no alternating row background in the table CSS', () => {
  assert.ok(!/nth-child\((even|odd|2n)/.test(css));
});
test('no raw hex colour in the table CSS or JS (theme variables only)', () => {
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
  assert.deepEqual(js.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
});
test('hover chart: no descriptive sentence in the popover; click opens the pop-out (sz-pop pattern)', () => {
  assert.ok(!/m\.description/.test(js.slice(js.indexOf('async () => {'), js.indexOf('b.onmouseenter'))));
  assert.match(js, /class="sz-pop fw-pop"/);
  assert.match(js, /'Made \/ attempts'/);
});
