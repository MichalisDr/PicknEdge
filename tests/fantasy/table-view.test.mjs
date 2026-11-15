// The Fantasy tables page, drawn from the generated data: one Shooting toggle, no Colours button, no GP column, rank chips, one-line headers, fixed numeric columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { useRealData, siteFile, useIcons } from '../helpers/site-data.mjs';

globalThis.document = { addEventListener() {}, createElement: () => ({}), body: {} };
globalThis.window = { addEventListener() {} };
useRealData();
await useIcons();
const { state } = await import('../../site/fantasy/tables/table-state.js');
const { loadTable } = await import('../../site/fantasy/tables/table-data.js');
const { tableHtml } = await import('../../site/fantasy/tables/table-view.js');
const { mount } = await import('../../site/fantasy/tables/table-page.js');

globalThis.fetch = async u => ({ ok: true, json: async () => JSON.parse(siteFile('config/table-layouts.json')) });
const widthsOf = names => names.map(n => n.length * 8);
async function render(over) {
  Object.assign(state, { entity: 'teams', view: 'profile', win: 'season', position: [], query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' }, over);
  const M = await loadTable(state, widthsOf, () => false);
  return { M, html: tableHtml(state, M) };
}

test('one "Shooting" toggle instead of the two-button Profile/Shooting switch; the page opens in Profile', async () => {
  const profile = await render({});
  assert.match(profile.html, /data-view-toggle aria-pressed="false">Shooting</);
  assert.ok(!/data-view="/.test(profile.html));
  const shooting = await render({ view: 'shooting' });
  assert.match(shooting.html, /data-view-toggle aria-pressed="true">Shooting</);
  assert.notDeepEqual(shooting.M.cols.map(c => c.metric), profile.M.cols.map(c => c.metric), 'the toggle switches the columns');
  state.view = 'shooting';
  mount({ innerHTML: '', isConnected: false }, 'teams');
  assert.equal(state.view, 'profile', 'mounting the page always opens in Profile');
});

test('no Colours button and no switch: evaluation colours are always on', async () => {
  const { html } = await render({});
  assert.ok(!/Colours|data-colours/.test(html));
  assert.match(html, /class="fw-v (good|bad)"/, 'values in the best and worst quarter are coloured');
});

test('no GP column, no subtitle or credits slot in the first column, no sub-lines in cells', async () => {
  for (const entity of ['teams', 'players']) {
    const { html, M } = await render({ entity });
    assert.ok(!/fw-gp|>GP<|fw-cr-slot|fw-sub|fw-cov|fw-tm/.test(html), entity);
    assert.ok(!M.cols.some(c => c.metric === 'gp'));
    assert.match(html, /<th><div class="fw-namecell"><button class="fw-name"[^>]*>[^<]+<\/button>/);
  }
  const { html } = await render({ entity: 'players' });
  assert.match(html, /<small class="fw-who" title="[^"]*">[A-Z]{3} · [GFC]<\/small>/, 'second line of a player: team code (Euroleague Fantasy code) and position');
  assert.ok(!(await render({ entity: 'teams' })).html.includes('fw-who'), 'team rows have no second line');
});

test('a cell is the value and a rank chip (two lines at most)', async () => {
  const { html } = await render({});
  assert.match(html, /<span class="fw-cell" data-id="[^"]+" data-metric="[^"]+" (data-chart )?tabindex="0"><span class="fw-v"[^>]*>[^<]+<\/span><i class="fw-rk">#\d+<\/i><\/span>/);
});

test('headers stay sortable buttons with the metric description; the sorted column is marked', async () => {
  const { html, M } = await render({});
  assert.equal((html.match(/<button data-sort="/g) || []).length, M.cols.length);
  assert.match(html, /aria-sort="(ascending|descending)"/);
  assert.match(html, /class="fw-n fw-sorted"/);
});

test('the table fills its container: numeric columns share the rest equally above a minimum width', async () => {
  const { html, M } = await render({});
  const cols = html.match(/<colgroup>(.*?)<\/colgroup>/)[1];
  assert.match(cols, /^<col style="width:\d+px">(<col>){1,}$/, 'only the first column carries a width');
  assert.equal((cols.match(/<col>/g) || []).length, M.cols.length);
  assert.match(html, /<table class="fw-t" style="min-width:\d+px">/);
});

test('hover and click on a main value: cells carry the entity and metric, charts are offered on the main metrics', async () => {
  const { html } = await render({});
  assert.match(html, /data-chart tabindex="0"/);
  assert.match(html, /class="sz-pop fw-pop"/);
});

test('table stylesheet and scripts use theme variables only: no zebra, no raw colours', () => {
  const css = siteFile('theme/fantasy/table.css');
  assert.ok(!/nth-child\((even|odd|2n)/.test(css), 'no alternating row background');
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
  const dir = new URL('../../site/fantasy/tables/', import.meta.url);
  for (const f of readdirSync(dir)) assert.deepEqual(readFileSync(new URL(f, dir), 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], f);
});

test('position buttons are multi-select: any combination, none = everyone, all three = the same as none', async () => {
  const ids = async position => (await render({ entity: 'players', position })).M.shown.map(r => r.id);
  const posOf = {}; for (const r of (await render({ entity: 'players', showAll: true })).M.shown) posOf[r.id] = r.pos;
  const all = await ids([]);
  assert.ok(all.length > 50);
  const g = await ids(['G']), f = await ids(['F']), c = await ids(['C']), gf = await ids(['G', 'F']);
  assert.ok(g.length && f.length && c.length);
  assert.ok(g.every(id => posOf[id] === 'G') && f.every(id => posOf[id] === 'F') && c.every(id => posOf[id] === 'C'));
  assert.deepEqual(new Set(gf), new Set([...g, ...f]), 'two positions on = the union');
  assert.deepEqual(await ids(['G', 'F', 'C']), all, 'all three on shows the same as none');
  assert.deepEqual(await ids(['C', 'G', 'F']), all);
});

test('position buttons: G, F, C only (no "All"), each pressed when its position is on', async () => {
  const { html } = await render({ entity: 'players', position: ['F', 'C'] });
  assert.ok(!html.includes('data-position="ALL"'));
  assert.match(html, /data-position="G" aria-pressed="false">G</);
  assert.match(html, /data-position="F" aria-pressed="true">F</);
  assert.match(html, /data-position="C" aria-pressed="true">C</);
});

test('Players toolbar: Profile / Shooting (icon above label), outlined windows, G / F / C, "Find player" and a Filters funnel; no eyebrow', async () => {
  const { html } = await render({ entity: 'players', view: 'shooting' });
  assert.ok(!html.includes('FANTASY / PLAYERS') && !html.includes('class="eyebrow"'), 'no eyebrow on Players');
  assert.match(html, /data-view-set="profile" aria-pressed="false"><span data-part="fantasy.stat-table.players-view-icon" aria-hidden="true"><svg [^>]*>.*?<\/svg><\/span><span>Profile<\/span><\/button>/s, 'icon, then label');
  assert.match(html, /data-view-set="shooting" aria-pressed="true">.*?<span>Shooting<\/span>/s);
  assert.ok(!html.includes('data-view-toggle'), 'the single Shooting toggle is for Teams');
  for (const w of ['Season', 'Last 10', 'Last 5', 'Last 3']) assert.ok(html.includes(`>${w}</button>`), w);
  assert.equal(html.split('aria-label="Sample window"').length - 1, 1, 'the period buttons are drawn once');
  assert.match(html, /<input type="search" aria-label="Find player" placeholder="Find player"/);
  assert.match(html, /data-part="fantasy.stat-table.players-search-icon"[^>]*><svg/);
  assert.match(html, /<button data-part="fantasy.stat-table.players-filters-button" data-filters aria-expanded="false" aria-label="Filters" title="Filters"><span[^>]*><svg/);
  assert.ok(!/>Filters<\/button>/.test(html), 'the visible label is replaced by the funnel');
  assert.ok(!/>All</.test(html.slice(html.indexOf('players-position-buttons'), html.indexOf('players-search"'))), 'no All button');
});

test('Players toolbar: no charts for Players today, so no Table / Charts pair and no divider; with charts available the pair follows Profile / Shooting', async () => {
  const { html } = await render({ entity: 'players' });
  assert.ok(!html.includes('data-fwmode') && !html.includes('players-view-divider') && html.includes('data-view-set="profile"'));
  const { playersToolbarHtml } = await import('../../site/fantasy/tables/table-toolbar.js');
  const withCharts = playersToolbarHtml(state, { players: true, 'charts-available': true });
  const at = ['data-view-set="profile"', 'players-view-divider', 'data-fwmode="table"', 'data-fwmode="charts"'].map(s => withCharts.indexOf(s));
  assert.ok(at.every((v, i) => v >= 0 && (!i || v > at[i - 1])), 'Profile / Shooting, divider, Table / Charts');
  assert.match(withCharts, /data-fwmode="table" role="tab" aria-selected="true"><span[^>]*><svg[^>]*>.*?<\/svg><\/span><span>Table<\/span>/s);
});

test('Teams keep their own toolbar: eyebrow, one Shooting toggle, window row, plain search', async () => {
  const { html } = await render({ entity: 'teams' });
  assert.ok(html.includes('FANTASY / TEAMS') && html.includes('data-view-toggle') && html.includes('class="fw-periods"') && html.includes('placeholder="Search…"'));
  assert.ok(!html.includes('data-position') && !html.includes('data-filters') && !html.includes('players-'));
});
