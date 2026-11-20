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
const { FILTER_DEFAULTS, filtersActive, resetFilters } = await import('../../site/fantasy/tables/table-state.js');

globalThis.fetch = async u => ({ ok: true, json: async () => JSON.parse(siteFile('config/table-layouts.json')) });
const widthsOf = names => names.map(n => n.length * 8);
async function render(over) {
  Object.assign(state, { entity: 'teams', view: 'profile', win: 'season', position: [], query: '', minMin: 0, minGp: 1, team: [], minCr: null, maxCr: null, minValue: 0, sortValue: false, filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' }, over);
  const M = await loadTable(state, widthsOf, () => false);
  return { M, html: tableHtml(state, M) };
}

test('Profile / Shooting are two explicit buttons (Players and Teams); the page opens in Profile', async () => {
  for (const entity of ['teams', 'players']) {
    const profile = await render({ entity });
    assert.match(profile.html, /data-view-set="profile" aria-pressed="true"/);
    assert.match(profile.html, /data-view-set="shooting" aria-pressed="false"/);
    assert.ok(!profile.html.includes('data-view-toggle'), 'no single toggle any more');
    const shooting = await render({ entity, view: 'shooting' });
    assert.match(shooting.html, /data-view-set="shooting" aria-pressed="true"/);
    assert.notDeepEqual(shooting.M.cols.map(c => c.metric), profile.M.cols.map(c => c.metric), 'the view switches the columns');
  }
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
    assert.match(html, entity === 'teams' ? /<th><div class="fw-namecell"><button class="fw-name"[^>]*><span data-part="fantasy.stat-table.name-cell-team-name">[^<]+<\/span><\/button>/ : /<th><div data-part="fantasy.stat-table.players-name-cell">.*?<button class="fw-name"/s);
  }
  const { html } = await render({ entity: 'players' });
  assert.match(html, /<small class="fw-who" title="[^"]+">[A-Z]{3}( (vs|@) [A-Z]{3})?<\/small>/, 'second line of a player: team code, then the next game when there is one (Euroleague Fantasy codes)');
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
  assert.match(html, /<table class="fw-t" style="--table-total:\d+px">/);
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
  assert.match(html, /<button data-part="fantasy.stat-table.players-filters-button" data-filters aria-expanded="false" data-active="false" aria-label="Filters" title="Filters"><span[^>]*><svg/);
  assert.ok(!/>Filters<\/button>/.test(html), 'the visible label is replaced by the funnel');
  assert.ok(!/>All</.test(html.slice(html.indexOf('players-position-buttons'), html.indexOf('players-search"'))), 'no All button');
});

test('Table / Charts: none for Players today (no pair, no divider); Teams have charts, so the pair follows Profile / Shooting after a divider; independent of the view', async () => {
  const players = await render({ entity: 'players' });
  assert.ok(!players.html.includes('data-fwmode') && !players.html.includes('players-view-divider') && players.html.includes('data-view-set="profile"'));
  for (const view of ['profile', 'shooting']) {
    const { html } = await render({ entity: 'teams', view });
    const at = ['data-view-set="profile"', 'players-view-divider', 'data-fwmode="table"', 'data-fwmode="charts"'].map(s => html.indexOf(s));
    assert.ok(at.every((v, i) => v >= 0 && (!i || v > at[i - 1])), view + ': Profile / Shooting, divider, Table / Charts');
  }
  const { tableToolbarHtml } = await import('../../site/fantasy/tables/table-toolbar.js');
  const none = tableToolbarHtml(state, { teams: true, 'charts-available': false });
  assert.ok(!none.includes('data-fwmode') && !none.includes('players-view-divider') && none.includes('data-view-set="shooting"'), 'without charts: Profile / Shooting stay, the pair and the divider go');
  const withCharts = tableToolbarHtml(state, { players: true, 'charts-available': true });
  assert.match(withCharts, /data-fwmode="table" role="tab" aria-selected="true"><span[^>]*><svg[^>]*>.*?<\/svg><\/span><span>Table<\/span>/s);
});

test('Teams toolbar: the Players composition without G / F / C and Filters; "Find team"; no eyebrow, no old toolbar; each control once', async () => {
  const { html } = await render({ entity: 'teams' });
  assert.ok(!html.includes('FANTASY / TEAMS') && !html.includes('class="eyebrow"') && html.includes('>Teams</h1>'));
  assert.ok(!/class="fw-(toolbar|periods|right|switch)"|data-view-toggle|Search Fantasy|placeholder="Search…"/.test(html), 'the old Teams toolbar and window row are gone');
  assert.match(html, /<input type="search" aria-label="Find team" placeholder="Find team"/);
  assert.equal(html.split('aria-label="Sample window"').length - 1, 1, 'the period buttons once');
  for (const w of ['Season', 'Last 10', 'Last 5', 'Last 3']) assert.ok(html.includes('>' + w + '</button>'), w);
  assert.equal(html.split('type="search"').length - 1, 1, 'one search field');
  assert.ok(!html.includes('data-position') && !html.includes('data-filters') && !html.includes('players-position') && !html.includes('players-filters'), 'G/F/C and the funnel are Players only');
  assert.ok(html.indexOf('data-view-set="profile"') < html.indexOf('aria-label="Sample window"') && html.indexOf('aria-label="Sample window"') < html.indexOf('type="search"'), 'view pair above; periods left; search right');
});
test('Teams search keeps matching teams by name; Players keep "Find player"', async () => {
  const all = (await render({ entity: 'teams' })).M.shown.length, one = (await render({ entity: 'teams', query: (await render({ entity: 'teams' })).M.shown[0].full.slice(0, 4) })).M;
  assert.ok(one.shown.length >= 1 && one.shown.length < all);
  assert.match((await render({ entity: 'players' })).html, /aria-label="Find player" placeholder="Find player"/);
});

test('cards opened from the table pages and the chart gallery get the period and the Profile / Shooting view', () => {
  const page = siteFile('fantasy/tables/table-page.js');
  const calls = page.match(/openCard\(/g).length;
  assert.ok(calls >= 2);
  assert.equal(page.match(/openCard\([^)]*\{ win: state\.win, mode: state\.view \}/g)?.length, calls);
  assert.match(siteFile('fantasy/gallery/gallery-dialog.js'), /openCard\([^)]*\{ win: gal\.dataset\.win, mode: gal\.dataset\.view \}/);
});

/* ---- Batch 5: the Players name cell ---- */
const { playerNameCellHtml } = await import('../../site/fantasy/tables/table-name-cell.js');
const { Data } = await import('../../site/core/data.js');
const ROW = { id: 'P1', name: 'Player One', full: 'Player One', team: 'AAA', pos: 'G' };
const ROSTER = (p = {}) => ({ teams: { AAA: 'Alpha Team' }, logoIds: {}, players: { P1: { name: 'Player One', ...p } } });

test('Players name cell: position badge, name above the team code; one name element "P. One"; CR and Value only with data', () => {
  const html = playerNameCellHtml(ROW, ROSTER({ first: 'Player', last: 'One' }), null);
  assert.ok(html.indexOf('name-cell-position-badge') < html.indexOf('name-cell-identity') && html.indexOf('class="fw-name"') < html.indexOf('class="fw-who"'));
  assert.match(html, /name-cell-position-badge" title="Position">G<\/span>/);
  assert.match(html, /<button class="fw-name" data-open="P1" title="Player One"><span data-part="fantasy.stat-table.name-cell-family-name">P\. One<\/span><\/button>/, 'initial + family name in one element, one button (opens the card)');
  assert.ok(!html.includes('given-name'));
  assert.match(html, /<small class="fw-who" title="Alpha Team">AAA<\/small>/, 'team code only, full name as the tooltip');
  assert.ok(!/fw-cr-box|fw-value-chip|name-cell-figures|sparkline|—/.test(html), 'while fantasyInfo is null the CR and Value slots stay hidden');
});

test('Players name cell: incomplete name parts show the display name intact; no valid position, no badge; no team code, no second line', () => {
  assert.match(playerNameCellHtml(ROW, ROSTER({ first: 'Player' }), null), /<button class="fw-name"[^>]*>Player One<\/button>/);
  assert.ok(!playerNameCellHtml({ ...ROW, pos: '' }, ROSTER(), null).includes('position-badge'));
  assert.ok(!playerNameCellHtml({ ...ROW, pos: 'X' }, ROSTER(), null).includes('position-badge'));
  assert.ok(!playerNameCellHtml({ ...ROW, team: '' }, ROSTER(), null).includes('fw-who'));
});

test('Players name cell: CR then Value (chip with its sparkline), 0 is a value, parts are optional', () => {
  const draw = info => playerNameCellHtml(ROW, ROSTER(), info);
  const full = draw({ cr: 0, value: 0, valueSeries: [1, 3, 2] });
  assert.match(full, /<span class="fw-cr-box" data-part="fantasy.stat-table.name-cell-cr-box">0<\/span><span class="fw-value-chip" data-part="fantasy.stat-table.name-cell-value-chip"><span>0.00<\/span><svg data-part="fantasy.stat-table.name-cell-sparkline"/);
  assert.ok(full.indexOf('name-cell-identity') < full.indexOf('name-cell-figures') && full.indexOf('name-cell-cr-box') < full.indexOf('name-cell-value-chip'));
  const crOnly = draw({ cr: 12.5, value: null }); assert.ok(crOnly.includes('fw-cr-box') && !crOnly.includes('fw-value-chip'));
  const noSpark = draw({ cr: null, value: 3.1, valueSeries: [4] }); assert.ok(noSpark.includes('fw-value-chip') && !noSpark.includes('sparkline') && !noSpark.includes('fw-cr-box'));
  assert.ok(!draw({ cr: null, value: null }).includes('name-cell-figures'), 'both missing: no group');
  assert.ok(!draw({}).includes('name-cell-figures'));
});

test('Teams name cell: club name, approved city below it (none without a city); the first column is 230 px for both tables', async () => {
  const teams = await render({ entity: 'teams' });
  assert.match(teams.html, /<th><div class="fw-namecell"><button class="fw-name" data-open="[^"]+" title="[^"]+"><span data-part="fantasy.stat-table.name-cell-team-name">[^<]+<\/span><\/button>/);
  assert.match(teams.html, /data-open="RED"[^>]*><span data-part="fantasy.stat-table.name-cell-team-name">Crvena Zvezda mts<\/span><\/button><small data-part="fantasy.stat-table.name-cell-city">Belgrade<\/small>/, 'a team with an approved city');
  assert.match(teams.html, /data-open="BAR"[^>]*><span data-part="fantasy.stat-table.name-cell-team-name">[^<]+<\/span><\/button><\/div>/, 'a team without a city: no second line');
  assert.ok(!teams.html.includes('players-name-cell') && !teams.html.includes('position-badge'), 'no badge, CR or Value on Teams');
  const TL = JSON.parse(siteFile('config/table-layouts.json')).firstCol;
  assert.deepEqual([TL.min, TL.cap], [230, 230]);
  for (const entity of ['teams', 'players']) assert.equal((await render({ entity })).M.firstW, 230, entity);
});

test('Players Overview: PIR MIN USG% TOV% TS% FTr PTS AST REB STOCKS FD/g FC/100 (one flat group); no Offensive load, no cTOV%, but both metrics stay in the data and the registry', async () => {
  const { M, html } = await render({ entity: 'players' });
  assert.deepEqual(M.cols.map(c => c.label), ['PIR', 'MIN', 'USG%', 'TOV%', 'TS%', 'FTr', 'PTS', 'AST', 'REB', 'STOCKS', 'FD/g', 'FC/100']);
  assert.ok(!/Offensive load|cTOV%|data-metric="(load|ctov)"|data-sort="(load|ctov)"/.test(html));
  assert.ok(M.byId.load && M.byId.ctov, 'metrics stay in the registry');
  assert.ok(M.view.get(M.shown[0].id, 'load') && M.view.get(M.shown[0].id, 'ctov'), 'and in the data');
  const avg = html.match(/<tr class="fw-average">.*?<\/tr>/s);
  if (avg) assert.equal((avg[0].match(/<td/g) || []).length, 12, 'League average row has one cell per column');
});
test('a sort or a combined rank on a removed column falls back to the default (PIR descending)', async () => {
  const bySort = await render({ entity: 'players', sort: 'ctov', dir: 'asc' });
  assert.deepEqual(bySort.M.cur, { metric: 'pir', dir: 'desc' });
  const combined = await render({ entity: 'players', sel: ['pir', 'load', 'tov_pct'] });
  assert.deepEqual(combined.M.sel, []);
  assert.deepEqual(combined.M.cur, { metric: 'pir', dir: 'desc' });
  assert.ok(!/Combined rank/.test(combined.html));
  const ok = await render({ entity: 'players', sel: ['pir', 'tov_pct'] });
  assert.deepEqual(ok.M.sel, ['pir', 'tov_pct']);
});

test('Filters funnel: active (orange) while the pop-up is open or any pop-up field is non-default, even with the pop-up closed; normal again after Reset filters', async () => {
  const active = html => /players-filters-button" data-filters aria-expanded="(true|false)" data-active="(true|false)"/.exec(html).slice(1);
  assert.deepEqual(active((await render({ entity: 'players' })).html), ['false', 'false'], 'defaults, closed');
  assert.deepEqual(active((await render({ entity: 'players', filters: true })).html), ['true', 'true'], 'open');
  for (const over of [{ team: ['BAR'] }, { minCr: 5 }, { maxCr: 9 }, { minValue: 3 }, { minMin: 10 }, { minGp: 5 }, { showAll: true }]) {
    assert.deepEqual(active((await render({ entity: 'players', ...over })).html), ['false', 'true'], JSON.stringify(over) + ', closed');
  }
  for (const over of [{ position: ['G'] }, { query: 'a' }, { win: 'l5' }]) assert.deepEqual(active((await render({ entity: 'players', ...over })).html), ['false', 'false'], JSON.stringify(over) + ' is not a filter');
  assert.match((await render({ entity: 'players', filters: true })).html, /<div class="fw-fd-foot"><button type="button" class="fw-fd-link fw-fd-reset" data-filters-reset[^>]*>.*<span>Reset filters<\/span><\/button><\/div>\s*<\/aside>/s, 'Reset filters is the pinned footer of the drawer');
});
test('Reset filters restores every pop-up field and the default rows; position, search and window stay; the pop-up stays open', async () => {
  const defaults = await render({ entity: 'players' });
  const filtered = await render({ entity: 'players', team: ['ZZZ'], minCr: 6, maxCr: 9, minValue: 2, minMin: 25, minGp: 8, showAll: true, position: ['G'], query: 'a', win: 'l5', filters: true });
  assert.notDeepEqual(filtered.M.shown.map(r => r.id), defaults.M.shown.map(r => r.id), 'the non-default filters change the rows');
  resetFilters(state);
  for (const [k, v] of Object.entries(FILTER_DEFAULTS)) assert.deepEqual(state[k], v, k);
  assert.deepEqual([state.position, state.query, state.win, state.filters], [['G'], 'a', 'l5', true]);
  assert.equal(filtersActive(state), false);
  Object.assign(state, { position: [], query: '', win: 'season' });
  const after = await render({ entity: 'players', filters: false });
  assert.deepEqual(after.M.shown.map(r => r.id), defaults.M.shown.map(r => r.id), 'the table shows the default rows');
});

test('Players name cell v2: "S. Vezenkov" format in one element; suffixes and compound names intact; single name as is; line 2 = team code + next game', () => {
  const name = (p, row = ROW) => playerNameCellHtml(row, ROSTER(p), null);
  assert.match(name({ first: 'Sasha', last: 'Vezenkov' }), /<span data-part="fantasy.stat-table.name-cell-family-name">S\. Vezenkov<\/span>/);
  assert.match(name({ first: 'Mike', last: 'Wright IV' }), />M\. Wright IV</);
  assert.match(name({ first: 'Nigel', last: 'Hayes-Davis' }), />N\. Hayes-Davis</);
  assert.match(name({ first: 'Cory', last: 'Jones' }), />C\. Jones</);
  assert.match(name({}), /<button class="fw-name"[^>]*>Player One<\/button>/, 'single name as is');
  assert.ok(name({ first: 'Sasha', last: 'Vezenkov' }).includes('title="Player One"'), 'the full name stays in the button title (search and the card use the full name)');
  const who = next => /<small class="fw-who"[^>]*>([^<]*)<\/small>/.exec(playerNameCellHtml({ ...ROW, next }, ROSTER({ first: 'P', last: 'One' }), null))[1];
  assert.equal(who(null), 'AAA', 'no known next game: team code only');
  assert.match(who({ home: false, opp: 'AAA', oppName: 'X' }), /^AAA @ [A-Z]{3}$/, 'away');
  assert.match(who({ home: true, opp: 'AAA', oppName: 'X' }), /^AAA vs [A-Z]{3}$/, 'home');
});
test('the table rows carry the next game of the team from Data.nextGame (the card\'s source) and line 2 shows it', async () => {
  const { M, html } = await render({ entity: 'players' });
  const withNext = M.shown.filter(r => r.next);
  assert.ok(withNext.length > 0 && withNext.every(r => r.next.opp && typeof r.next.home === 'boolean'));
  assert.match(html, /<small class="fw-who"[^>]*>[A-Z]{3} (vs|@) [A-Z]{3}<\/small>/);
  const r = withNext[0], expected = await Data.nextGame(r.team);
  assert.deepEqual([r.next.opp, r.next.home], [expected.opp, expected.home]);
});
