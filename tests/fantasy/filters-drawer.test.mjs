// The Players Filters drawer: state, ranks that never depend on the drawer, rows listed through the below-thresholds switch, Sort by value, the Credits handles, tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useRealData, siteFile, useIcons } from '../helpers/site-data.mjs';

globalThis.document = { addEventListener() {}, createElement: () => ({}), body: {} };
globalThis.window = { addEventListener() {} };
useRealData();
await useIcons();
const { state, FILTER_DEFAULTS, filtersActive, resetFilters } = await import('../../site/fantasy/tables/table-state.js');
const { loadTable } = await import('../../site/fantasy/tables/table-data.js');
const { tableHtml } = await import('../../site/fantasy/tables/table-view.js');
const F = await import('../../site/fantasy/tables/table-filters.js');
const { Data } = await import('../../site/core/data.js');

globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(siteFile('config/table-layouts.json')) });
const BASE = { entity: 'players', view: 'profile', win: 'season', position: [], query: '', ...FILTER_DEFAULTS, team: [], filters: false, sort: '', dir: 'desc', sel: [], mode: 'table' };
async function render(over = {}) {
  Object.assign(state, BASE, { team: [] }, over);
  const M = await loadTable(state, names => names.map(n => n.length * 8), () => false);
  return { M, html: tableHtml(state, M) };
}
/** The rank chips of a row, by player id: { metric: position } from the markup. */
const ranksOf = (html, id) => {
  const row = html.split('<tr>').find(r => r.includes(`data-open="${id}"`)) || '';
  return Object.fromEntries([...row.matchAll(/data-metric="([^"]+)"[^>]*>.*?<\/span>(?:<i class="fw-rk[^"]*">([^<]*)<\/i>)?<\/span>/g)].map(m => [m[1], m[2] ?? null]));
};

test('defaults: team array, Credits handles at the range ends, Min. value 0, Min. games 1, Min. minutes 0, switch off; active and reset follow', () => {
  assert.deepEqual(FILTER_DEFAULTS, { team: [], minCr: null, maxCr: null, minValue: 0, minMin: 0, minGp: 1, showAll: false });
  const s = { ...FILTER_DEFAULTS, team: [], position: ['G'], query: 'a', win: 'l5', sort: 'value' };
  assert.equal(filtersActive(s), false);
  for (const over of [{ team: ['BAR'] }, { minCr: 5 }, { maxCr: 9 }, { minValue: 1 }, { minMin: 1 }, { minGp: 2 }, { showAll: true }]) assert.equal(filtersActive({ ...s, ...over }), true, JSON.stringify(over));
  assert.equal(filtersActive({ ...s, team: ['A', 'B', 'C'] }, 3), false, 'every team ticked = the default');
  assert.equal(filtersActive({ ...s, team: ['A', 'B'] }, 3), true);
  Object.assign(s, { team: ['BAR', 'RED'], minCr: 5, maxCr: 9, minValue: 3, minMin: 10, minGp: 4, showAll: true });
  resetFilters(s);
  assert.deepEqual([s.team, s.minCr, s.maxCr, s.minValue, s.minMin, s.minGp, s.showAll], [[], null, null, 0, 0, 1, false]);
  assert.deepEqual([s.position, s.query, s.win, s.sort], [['G'], 'a', 'l5', 'value'], 'position, search, window and the sort are not filters');
  s.team.push('X'); assert.deepEqual(FILTER_DEFAULTS.team, [], 'the default array is never shared');
});

test('a player\'s ranks are identical with and without a Team / Credits / Min. value / Min. games / Min. minutes filter or a search', async () => {
  const base = await render();
  const p = base.M.shown[0], team = p.team, ids = base.M.shown.filter(r => r.team === team).slice(0, 3).map(r => r.id);   // three players of one team: they stay on screen under the Team filter
  const before = ids.map(id => ranksOf(base.html, id));
  assert.ok(Object.values(before[0]).some(v => /^#\d+$/.test(v)), 'the rows have rank chips');
  const crs = base.M.shown.map(r => r.cr).filter(Number.isFinite);
  const filters = [{ team: [team] }, { minCr: Math.max(...crs) - 1 }, { maxCr: Math.min(...crs) + 1 }, { minValue: 1.2 }, { minGp: 5 }, { minMin: 20 }, { query: p.full.slice(0, 4) }];
  for (const over of filters) {
    const f = await render(over), shown = new Set(f.M.shown.map(r => r.id));
    assert.ok(f.M.shown.length < base.M.shown.length || over.query, `${JSON.stringify(over)} narrows the rows`);
    ids.forEach((id, i) => { if (shown.has(id)) assert.deepEqual(ranksOf(f.html, id), before[i], `${id} with ${JSON.stringify(over)}`); });
  }
  const pool = base.M.pool.size, narrowed = await render({ team: [team] });
  assert.equal(narrowed.M.pool.size, pool, 'the rank pool does not shrink with a filter');
  const pos = await render({ position: [p.pos] });
  assert.ok(pos.M.pool.size < pool, 'the position buttons do narrow the rank pool');
  console.log('ranks before / after the Team filter', ids.map((id, i) => `${base.M.shown.find(r => r.id === id).name}: ${before[i].pir} -> ${ranksOf(narrowed.html, id).pir}`).join(' | '));
  ids.forEach((id, i) => assert.deepEqual(ranksOf(narrowed.html, id), before[i], 'every rank of the player'));
  assert.ok(narrowed.M.shown.length < base.M.shown.length && ids.length === 3);
});

test('with the switch on, a player below the thresholds is listed with a dash and no rank; the others keep their ranks', async () => {
  const base = await render(), on = await render({ showAll: true });
  const extra = on.M.shown.filter(r => !on.M.pool.has(r.id));
  assert.ok(extra.length > 0 && on.M.shown.length === base.M.shown.length + extra.length, 'the switch adds the players below the thresholds');
  const r = extra.find(x => Number.isFinite(x.value)) || extra[0], row = ranksOf(on.html, r.id);
  assert.ok(Object.values(row).length > 0 && Object.values(row).every(v => v === '-'), 'every rank chip of the player is a dash');
  assert.ok(!/#\d+/.test(on.html.split('<tr>').find(x => x.includes(`data-open="${r.id}"`))), 'no rank number in the row');
  const id = base.M.shown[0].id;
  assert.deepEqual(ranksOf(on.html, id), ranksOf(base.html, id), 'players inside the pool keep their ranks');
  assert.ok(on.html.includes('rank among the eligible players of the selected position and window; filters do not change it'), 'the note under the table says so');
});

test('Player header: "Cr" and "Value" are sort buttons (Players only), no toolbar button, no switch in the drawer', async () => {
  const { html } = await render({ filters: true });
  assert.match(html, /<th><div class="fw-ph"><span>Player<\/span><span class="fw-ph-sorts"><button type="button" class="fw-hs fw-hs-cr-box" data-sort-fx="cr" aria-label="Sort by credits">Cr<\/button><button type="button" class="fw-hs fw-hs-value-chip" data-sort-fx="value" aria-label="Sort by value">Value<\/button>/);
  assert.ok(!html.includes('data-sort-value') && !/Sort by value<\/span>/.test(html), 'no toolbar button');
  assert.ok(!/sort/i.test(html.slice(html.indexOf('<aside'), html.indexOf('</aside>'))), 'nothing about sorting in the drawer');
  assert.ok(!(await render({ entity: 'teams' })).html.includes('data-sort-fx'), 'Players only');
  assert.equal(filtersActive({ ...FILTER_DEFAULTS, team: [], sort: 'cr' }), false, 'sorting does not make the funnel active');
});

test('sort by Value: the value of the selected window, highest first, second click reverses, missing values last in both directions', async () => {
  const order = {};
  for (const win of ['season', 'l5']) {
    const { M, html } = await render({ sort: 'value', dir: 'desc', win, showAll: true });
    const v = M.shown.map(r => r.value), finite = v.filter(Number.isFinite);
    assert.ok(finite.length > 1, win + ': players have values');
    assert.deepEqual(finite, [...finite].sort((a, b) => b - a), win + ': highest first');
    assert.ok(v.slice(finite.length).every(x => !Number.isFinite(x)), win + ': missing last');
    assert.equal(M.shown[0].value, Data.fantasyInfo(M.shown[0].id, win).value, 'the same number as the chip');
    assert.match(html, /<th aria-sort="descending"><div class="fw-ph">/);
    assert.match(html, /data-sort-fx="value" aria-label="Sort by value" data-on>Value<span aria-hidden="true"> ▾<\/span>/);
    assert.ok(!/data-sort-fx="cr"[^>]*data-on/.test(html));
    order[win] = M.shown.map(r => r.id).join();
  }
  assert.notEqual(order.season, order.l5, 'the window changes the order');
  const asc = await render({ sort: 'value', dir: 'asc', showAll: true }), va = asc.M.shown.map(r => r.value), fin = va.filter(Number.isFinite);
  assert.deepEqual(fin, [...fin].sort((a, b) => a - b), 'reversed: lowest first');
  assert.ok(va.slice(fin.length).every(x => !Number.isFinite(x)), 'missing values still last');
  assert.match(asc.html, /aria-sort="ascending"/); assert.match(asc.html, /Value<span aria-hidden="true"> ▴/);
});

test('sort by Cr: credits, highest first, second click reverses, players without credits last; another header replaces it', async () => {
  const { M } = await render({ sort: 'cr', dir: 'desc' });
  const fin = M.shown.map(r => r.cr).filter(Number.isFinite);
  assert.deepEqual(fin, [...fin].sort((a, b) => b - a));
  const asc = await render({ sort: 'cr', dir: 'asc', showAll: true }), ca = asc.M.shown.map(r => r.cr), fa = ca.filter(Number.isFinite);
  assert.deepEqual(fa, [...fa].sort((a, b) => a - b)); assert.ok(ca.slice(fa.length).every(x => !Number.isFinite(x)), 'missing last when ascending too');
  assert.match(asc.html, /data-sort-fx="cr" aria-label="Sort by credits" data-on>Cr<span aria-hidden="true"> ▴/);
  const other = await render({ sort: 'min', dir: 'desc' });   // clicking MIN sets state.sort to the column: the Cr / Value sort is replaced
  assert.ok(!/data-on/.test(other.html) && !/<th aria-sort=/.test(other.html) && /aria-sort="descending"/.test(other.html));
});

test('sorting by Cr or Value changes only the order: every rank stays the overall rank of the position and window', async () => {
  const base = await render(), ids = base.M.shown.slice(0, 5).map(r => r.id), before = ids.map(id => ranksOf(base.html, id));
  for (const sort of ['cr', 'value']) {
    const s = await render({ sort, dir: 'desc' });
    assert.notDeepEqual(s.M.shown.map(r => r.id), base.M.shown.map(r => r.id), sort + ' reorders the rows');
    assert.equal(s.M.pool.size, base.M.pool.size);
    ids.forEach((id, i) => assert.deepEqual(ranksOf(s.html, id), before[i], `${sort}: ${id}`));
  }
});

test('Credits: the range comes from the data; Max. credits and the upper handle are one value; the handles keep one step apart', async () => {
  const { M, html } = await render({ filters: true });
  const crs = M.shown.map(r => r.cr).filter(Number.isFinite), range = M.range;
  assert.ok(range.min <= Math.min(...crs) && range.max >= Math.max(...crs) && range.max > range.min, 'range = lowest to highest cr of the data');
  assert.match(html, new RegExp(`data-cr="hi"[^>]*min="${range.min}" max="${range.max}" step="0.1" value="${range.max}"`));
  const s = { ...FILTER_DEFAULTS, team: [] };
  let h = F.moveState(s, range, 'hi', range.max - 2);
  assert.deepEqual([s.maxCr, h.hi], [round(range.max - 2), round(range.max - 2)], 'the box and the handle share state.maxCr');
  assert.equal(F.handles(s, range).hi, s.maxCr);
  h = F.moveState(s, range, 'lo', range.max + 5);   // dragged past the upper handle
  assert.ok(round(h.hi - h.lo) >= 0.1 - 1e-9, 'the lower handle stops one step below the upper');
  h = F.moveState(s, range, 'hi', range.min - 5);   // dragged below the lower handle
  assert.ok(round(h.hi - h.lo) >= 0.1 - 1e-9, 'the upper handle stops one step above the lower');
  F.moveState(s, range, 'lo', range.min); F.moveState(s, range, 'hi', range.max);
  assert.deepEqual([s.minCr, s.maxCr], [null, null], 'full range = no filter');
  const narrow = { ...FILTER_DEFAULTS, team: [], minCr: round(range.max - 1) };
  assert.ok((await render(narrow)).M.shown.every(r => r.cr >= narrow.minCr - 1e-9), 'players without a cr are hidden when the range is narrowed');
  const empty = F.crRange([]);
  assert.deepEqual(empty, { min: 0, max: 0 }); assert.match(F.drawerHtml({ ...BASE, team: [] }, { range: empty, roster: { teams: {} } }), /data-cr="lo"/, 'the controls render even without data');
});
const round = v => Math.round(v * 10) / 10;

test('Min. value uses the selected window and hides players without a value', async () => {
  const { M } = await render({ minValue: 1.2 });
  assert.ok(M.shown.length > 0 && M.shown.every(r => r.value >= 1.2));
  const l5 = await render({ minValue: 1.2, win: 'l5' });
  assert.ok(l5.M.shown.every(r => r.value >= 1.2 && r.value === Data.fantasyInfo(r.id, 'l5').value));
});

test('the drawer: right-side dialog with every control, nothing else; teams are checkboxes, the switch is a real checkbox', async () => {
  const { html } = await render({ filters: true, team: ['BAR'] });
  const drawer = html.slice(html.indexOf('<aside class="fw-fd"'), html.indexOf('</aside>'));
  for (const part of ['Filters</h2>', 'data-filters-close', 'none ticked = all teams', 'Select all', 'Deselect all', '>Credits<', 'Max. credits', 'Min. value', 'Min. games', 'Min. minutes', 'Include players below the minimum thresholds', 'role="switch"', 'Reset filters'])
    assert.ok(drawer.includes(part), part);
  assert.equal((drawer.match(/type="checkbox" data-team=/g) || []).length, Object.keys((await Data.roster()).teams).length);
  assert.match(drawer, /data-team="BAR"[^>]*checked/);
  assert.ok(!html.includes('fw-filters'), 'the old pop-up is gone');
  assert.ok(!(await render({ entity: 'teams', filters: true })).html.includes('fw-fd'), 'no drawer for Teams');
  assert.match((await render({ filters: true, showAll: true })).html, /data-on="true">.*<span class="fw-fd-knob">ON<\/span>/s);
});

test('every new element is a token: the sizes exist and no raw px is in the drawer code or its style rules', () => {
  const sizes = JSON.parse(siteFile('config/sizes.json')).component.fantasy['stat-table'], theme = JSON.parse(siteFile('theme/theme.json')).component.fantasy['stat-table'];
  const need = { 'filters-drawer': ['width', 'padding'], 'filters-header': ['height'], 'filters-close': ['width', 'height'], 'filters-team-list': ['grid-template-columns', 'grid-template-rows', 'gap'], 'filters-team-row': ['height', 'gap'], 'filters-checkbox': ['width', 'height'],
    'filters-credits-row': ['height', 'gap'], 'filters-bar-line': ['height'], 'filters-bar-segment': ['height'], 'filters-bar-handle': ['width', 'height'], 'filters-fields': ['gap'], 'filters-field': ['height'], 'filters-switch': ['width', 'height'], 'filters-switch-track': ['height'],
    'filters-switch-knob': ['width', 'height'], 'filters-footer': ['padding-top'], 'filters-reset': ['height', 'gap'] };
  for (const [part, props] of Object.entries(need)) for (const p of props) assert.ok(sizes[part]?.[p], `sizes.json ${part}.${p}`);
  for (const part of ['filters-drawer', 'filters-title', 'filters-label', 'filters-checkbox', 'filters-bar-segment', 'filters-bar-handle', 'filters-switch-knob']) assert.ok(theme[part], `theme.json ${part}`);
  const code = readFileSync(new URL('../../site/fantasy/tables/table-filters.js', import.meta.url), 'utf8'), css = readFileSync(new URL('../../site/theme/fantasy/workbench.css', import.meta.url), 'utf8');
  assert.ok(!/\d\s*px\b/.test(code), 'no px in table-filters.js');
  for (const rule of css.split('\n').filter(l => /\.fw-fd|\.fw-table-area/.test(l))) assert.ok(!/(?<![\w.-])\d*\.?\d+px/.test(rule.replace(/@media\(max-width:\d+px\)/, '')), rule.slice(0, 80));
});
