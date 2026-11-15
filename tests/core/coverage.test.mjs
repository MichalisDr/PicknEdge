// The games coverage line of the top bar: format, availability, route visibility, and its place in the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverageText } from '../../site/core/coverage.js';
import { showCoverage } from '../../site/app/coverage.js';
import ARRANGEMENT from '../../site/config/arrangement.json' with { type: 'json' };

const site = rel => readFileSync(new URL('../../site/' + rel, import.meta.url), 'utf8');

test('format: "100 games · Latest 6 Nov 2026" from the manifest, the date as written (no local-time shift)', () => {
  assert.equal(coverageText({ games: 100, lastDate: '2026-11-06T19:45:00.000Z' }), '100 games · Latest 6 Nov 2026');
  assert.equal(coverageText({ games: 100, lastDate: '2026-11-06T23:59:00.000-05:00' }), '100 games · Latest 6 Nov 2026');
  assert.equal(coverageText({ games: 1, lastDate: '2027-01-02' }), '1 game · Latest 2 Jan 2027');
  const real = JSON.parse(site('data/manifest.json'));
  assert.equal(coverageText(real), `${real.games} games · Latest ${+real.lastDate.slice(8, 10)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+real.lastDate.slice(5, 7) - 1]} ${real.lastDate.slice(0, 4)}`);
});

test('only the available fields show; no separator unless both; nothing when neither', () => {
  assert.equal(coverageText({ games: 12 }), '12 games');
  assert.equal(coverageText({ games: 0, lastDate: null }), '0 games');
  assert.equal(coverageText({ lastDate: '2026-11-06T19:45:00.000Z' }), 'Latest 6 Nov 2026');
  for (const none of [{}, null, undefined, { games: 'x', lastDate: 'soon' }, { games: -1, lastDate: '2026-13-40' }, { games: NaN }]) assert.equal(coverageText(none), null, JSON.stringify(none));
});

test('the coverage part shows on the Fantasy area only (config: app.top-bar.bar), muted, one element', () => {
  const el = { textContent: 'old', hidden: true };
  showCoverage(el, 'fantasy', { games: 100, lastDate: '2026-11-06T19:45:00.000Z' });
  assert.deepEqual([el.textContent, el.hidden], ['100 games · Latest 6 Nov 2026', false]);
  showCoverage(el, 'betting', { games: 100, lastDate: '2026-11-06T19:45:00.000Z' });
  assert.deepEqual([el.textContent, el.hidden], ['', true], 'Betting keeps its header');
  showCoverage(el, 'fantasy', null);
  assert.deepEqual([el.textContent, el.hidden], ['', true], 'hidden while unknown or when neither field is available');
  assert.deepEqual(ARRANGEMENT.component.app['top-bar'].bar.parts, [{ name: 'coverage', show: 'fantasy' }]);
  const saved = JSON.stringify(ARRANGEMENT);
  try { ARRANGEMENT.component.app['top-bar'].bar.parts[0].show = 'betting'; showCoverage(el, 'fantasy', { games: 1 }); assert.equal(el.hidden, true, 'visibility is a config value'); } finally { Object.assign(ARRANGEMENT, JSON.parse(saved)); }
});

test('the top bar has one coverage element between the brand area and the navigation, hidden until the shell shows it', () => {
  const html = site('index.html');
  assert.equal(html.split('data-part="app.top-bar.coverage"').length - 1, 1);
  assert.ok(html.indexOf('class="brand"') < html.indexOf('data-part="app.top-bar.coverage"') && html.indexOf('data-part="app.top-bar.coverage"') < html.indexOf('<nav aria-label="Main areas">'));
  assert.match(html, /<span class="coverage" data-part="app.top-bar.coverage" hidden><\/span>/);
});

test('the table heading no longer carries the coverage; the footer and its appearance stay; loading and error announcements stay', async () => {
  const view = site('fantasy/tables/table-view.js');
  assert.ok(!/<span role="status">\$\{esc\(status\)\}/.test(view) && !/status,? shown/.test(view));
  assert.match(view, /<div class="fw-foot"/);
  assert.match(view, /role="status"[^>]*>Could not load the data|Could not load the data: \$\{esc\(message\)\}/);
  assert.match(view, /<p class="fw-empty" role="status">Loading data…/);
  const css = site('theme/fantasy/workbench.css');
  assert.ok(!css.includes('.fw-heading [role=status]'));
  assert.match(css, /\.fw-foot\{font-size:var\(--fantasy-stat-table-status-and-footer-font-size\);color:var\(--fantasy-stat-table-status-and-footer-text\)\}/);
});
