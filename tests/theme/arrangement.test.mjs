// Arrangement (config/arrangement.json): order of parts, direction, alignment and visibility of the Fantasy toolbar, the Players/Teams name cell and the player card header.
// The view code only says how to draw each part; changing the config changes the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ARRANGEMENT from '../../site/config/arrangement.json' with { type: 'json' };
import { buildArrangementCss } from '../../site/config/generate.mjs';
import { useRealData, useIcons } from '../helpers/site-data.mjs';

globalThis.document = { addEventListener() {}, createElement: () => ({}), body: {} };
globalThis.window = { addEventListener() {} };
useRealData();
await useIcons();
const { Data } = await import('../../site/core/data.js');
const { state } = await import('../../site/fantasy/tables/table-state.js');
const { loadTable } = await import('../../site/fantasy/tables/table-data.js');
const { tableHtml } = await import('../../site/fantasy/tables/table-view.js');
const { headerHtml, controlsHtml } = await import('../../site/fantasy/cards/card-header.js');

const SITE = new URL('../../site/', import.meta.url);
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('config/table-layouts.json', SITE), 'utf8')) });
async function table(entity) {
  Object.assign(state, { entity, view: 'profile', win: 'season', position: [], query: '', minMin: 0, minGp: 1, team: '', filters: false, showAll: false, sort: '', dir: 'desc', sel: [], mode: 'table' });
  return tableHtml(state, await loadTable(state, names => names.map(n => n.length * 8), () => false));
}
const at = (html, parts) => parts.map(p => html.indexOf(p));
const inOrder = idx => idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]));

test('arrangement.css is exactly what arrangement.json generates', () => {
  assert.equal(readFileSync(new URL('config/arrangement.css', SITE), 'utf8'), buildArrangementCss(ARRANGEMENT), 'run: node site/config/generate.mjs');
});

test('toolbar: parts in the configured order, the right-hand group at the far end, Players-only parts only for Players', async () => {
  const players = await table('players');
  assert.ok(inOrder(at(players, ['data-view-set="profile"', 'aria-label="Sample window"', 'data-position="G"', 'type="search"', 'data-filters'])), 'view pair above; windows left; G/F/C, Find player, Filters at the right');
  assert.ok(!players.includes('data-view-toggle') && !players.includes('FANTASY / PLAYERS') && !players.includes('data-position="ALL"'));
  const teams = await table('teams');
  assert.ok(!teams.includes('data-position') && !teams.includes('data-filters'), 'players-only parts are not drawn for teams');
  assert.ok(inOrder(at(teams, ['data-view-set="profile"', 'aria-label="Sample window"', 'type="search"'])));
});

test('changing the order in the config changes the page (toolbar, name cell, card header)', async () => {
  const saved = JSON.stringify(ARRANGEMENT);
  try {
    const tb = ARRANGEMENT.component.fantasy['stat-table']['players-toolbar'].parts; tb.reverse();
    const reversed = await table('players');
    assert.ok(reversed.indexOf('data-filters') < reversed.indexOf('data-position="G"'), 'the right-hand parts follow the config order');
    ARRANGEMENT.component.fantasy['stat-table']['players-toolbar'].parts = JSON.parse(saved).component.fantasy['stat-table']['players-toolbar'].parts;
    const nc = ARRANGEMENT.component.fantasy['stat-table']['name-cell-identity'].parts; nc.reverse();
    const cell = await table('players');
    assert.ok(cell.indexOf('class="fw-who"') < cell.indexOf('class="fw-name"'), 'name cell order follows the config');
    ARRANGEMENT.component.fantasy['stat-table']['name-cell-identity'].parts = JSON.parse(saved).component.fantasy['stat-table']['name-cell-identity'].parts;
    const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' } }, logo: 'assets/logos/x.png', next: null };
    const before = headerHtml(ctx);
    assert.ok(before.indexOf('<img') < before.indexOf('<h2>'));
    ARRANGEMENT.component.fantasy['player-card']['header-identity'].parts.reverse();
    const after = headerHtml(ctx);
    assert.ok(after.indexOf('<h2>') < after.indexOf('<img'), 'header order follows the config');
  } finally { Object.assign(ARRANGEMENT, JSON.parse(saved)); }
});

test('optional parts (cr box, value chip) draw nothing while there is no data, and appear when there is', async () => {
  assert.equal(Data.fantasyInfo('anyone'), null);
  const real = Data.fantasyInfo; Data.fantasyInfo = () => null;                       // the real build has credits now: this test is about the case without data
  try { assert.ok(!(await table('players')).includes('fw-cr-box')); } finally { Data.fantasyInfo = real; }
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' } }, logo: null, next: null };
  assert.ok(!headerHtml(ctx).includes('fw-cr-box'));
  const saved = Data.fantasyInfo; Data.fantasyInfo = () => ({ cr: 12.5, value: 3.1 });
  try {
    assert.ok(headerHtml(ctx).includes('fw-cr-box') && headerHtml(ctx).includes('fw-value-chip'));
    const html = await table('players');
    assert.ok(html.includes('fw-cr-box') && html.includes('fw-value-chip'));
    assert.ok(!(await table('teams')).includes('fw-cr-box'), 'team rows have no cr box');
  } finally { Data.fantasyInfo = saved; }
});

test('controls row: window buttons, games played, Shooting in the configured order', () => {
  const html = controlsHtml({ cs: { mode: 'profile', win: 'season' }, players: true, gp: 7 });
  assert.ok(inOrder(at(html, ['aria-label="Sample window"', 'controls-games-played-number">7<', 'aria-label="Card view"'])));
});

test('order, direction and alignment of these components are not hard-coded in the style sheets', () => {
  const classes = ['.fw-toolbar', '.fw-right', '.fw-identity', '.fw-card-controls', '.fw-namecell', '.fw-periods', '.fw-name'];
  const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, SITE), { withFileTypes: true })) { if (e.isDirectory()) { if (e.name !== 'data') walk(dir + e.name + '/', out); } else if (e.name.endsWith('.css') && !/^(theme|sizes|arrangement|editor)\.css$/.test(e.name)) out.push(dir + e.name); } return out; };
  for (const f of walk('')) for (const m of readFileSync(new URL(f, SITE), 'utf8').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(',').some(s => classes.some(c => s.trim().split(/[\s>+~]/).pop().startsWith(c)))) continue;
    for (const d of m[2].split(';')) {
      const [p, v] = [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()];
      if (/^(flex-direction|justify-content|align-items|align-self|flex-wrap|order)$/.test(p) || (p === 'margin-left' && v === 'auto')) assert.match(v, /^var\(--/, `${f}: ${m[1].trim()} { ${p}:${v} }`);
    }
  }
});

test('every part named in the config has a name in the same style as theme.json and sizes.json (screen.component.part)', () => {
  for (const [screen, comps] of Object.entries(ARRANGEMENT.component)) for (const [comp, parts] of Object.entries(comps)) for (const [part, entry] of Object.entries(parts))
    for (const p of entry.parts || []) assert.match(p.name, /^[a-z][a-z-]*$/, `${screen}.${comp}.${part}: ${p.name}`);
});

test('with no fantasy info (null) there is no cr box, no value chip, no sparkline, in the header and in the table', async () => {
  assert.equal(Data.fantasyInfo('anyone'), null);
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' }, players: {} }, logo: null, next: null };
  const real = Data.fantasyInfo; Data.fantasyInfo = () => null;                       // the real build has credits now: this test is about the case without data
  try { for (const html of [headerHtml(ctx), await table('players'), await table('teams')]) assert.ok(!/fw-cr-box|fw-value-chip|value-sparkline/.test(html)); } finally { Data.fantasyInfo = real; }
});

test('optional header parts (portrait, given name, family name, sparkline) draw nothing without data; the display name and the logo stay', () => {
  const base = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, logo: 'assets/logos/x.png', next: null };
  const bare = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { name: 'Player One' } } } });
  assert.ok(!/header-portrait|header-given-name|<polyline/.test(bare));
  assert.ok(bare.includes('<h2>Player One</h2>') && bare.includes('<img src="assets/logos/x.png"'), 'display name and team logo fallbacks');
  const onlyFirst = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { first: 'Player' } } } });
  assert.ok(!onlyFirst.includes('header-given-name') && onlyFirst.includes('<h2>Player One</h2>'), 'a given name alone is not used: the names are not derived');
  const full = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { first: 'Player', last: 'One', portrait: 'assets/p/1.png' } } } });
  assert.ok(inOrder(at(full, ['data-part="fantasy.player-card.header-portrait-fade"', 'data-part="fantasy.player-card.header-portrait"', 'src="assets/p/1.png"', 'data-part="fantasy.player-card.header-given-name">Player<', '<h2>One</h2>'])), full);
  assert.ok(!full.includes('assets/logos/x.png'), 'a player with a portrait shows no team logo');
  const saved = Data.fantasyInfo; Data.fantasyInfo = () => ({ cr: null, value: 3.1, valueSeries: [1, 3, 2] });
  try { assert.match(headerHtml({ ...base, roster: { teams: {}, players: {} } }), /data-part="fantasy.player-card.value-sparkline"[^>]*><polyline points="0.0,13.0 20.0,1.0 40.0,7.0"/); } finally { Data.fantasyInfo = saved; }
});

test('header actions: next game, back and Close are one group drawn in the configured order; Close has a single slot', () => {
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season', back: { id: 'P1', name: 'Player One' } }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha', DDD: 'Delta' }, players: {} }, logo: null, next: { opp: 'DDD', home: true, date: '2026-11-14T18:00:00.000Z' } };
  const html = headerHtml(ctx);
  assert.equal(html.split('data-close-slot').length - 1, 1);
  assert.ok(inOrder(at(html, ['data-part="fantasy.player-card.header-actions"', 'data-next=', 'data-close-slot'])));
  const saved = JSON.stringify(ARRANGEMENT);
  try {
    ARRANGEMENT.component.fantasy['player-card']['header-actions'].parts.reverse();
    const reversed = headerHtml(ctx);
    assert.ok(reversed.indexOf('data-close-slot') < reversed.indexOf('data-next='), 'Close moves by config alone');
    assert.equal(reversed.split('data-close-slot').length - 1, 1);
  } finally { Object.assign(ARRANGEMENT, JSON.parse(saved)); }
});

/* ---- Batch 2: the player card header ---- */
const PCTX = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, logo: 'assets/logos/x.png', next: { opp: 'DDD', home: true, date: '2026-11-14T18:00:00.000Z' } };
const ROSTER = (p = {}) => ({ teams: { AAA: 'Alpha Team', DDD: 'Delta' }, players: { P1: { name: 'Player One', ...p } } });
const withInfo = async (info, fn) => { const saved = Data.fantasyInfo; Data.fantasyInfo = () => info; try { return await fn(); } finally { Data.fantasyInfo = saved; } };

test('player header: fade (whole header), portrait, title block, CR then Value, and the actions group in the second column', () => {
  const html = headerHtml({ ...PCTX, roster: ROSTER({ first: 'Player', last: 'One', portrait: 'assets/players/P1.webp' }) });
  assert.ok(inOrder(at(html, ['header-portrait-fade', 'header-identity', 'header-portrait"', 'header-given-name', '<h2>One</h2>', 'team-line-position">G<', 'team-line-divider', 'team-line-team">Alpha Team<', 'header-actions', 'next-game-button', 'data-close-slot'])), html);
  assert.ok(html.lastIndexOf('header-identity') < html.indexOf('data-part="fantasy.player-card.header-actions"'), 'the actions group is the last part of the header');
  assert.ok(!html.includes('<small') && !html.includes('FANTASY'), 'no kicker');
});

test('player header: the team logo is only the fallback for a player without a portrait; team cards keep it', () => {
  assert.ok(!headerHtml({ ...PCTX, roster: ROSTER({ portrait: 'assets/players/P1.webp' }) }).includes('assets/logos/x.png'));
  assert.ok(headerHtml({ ...PCTX, roster: ROSTER() }).includes('src="assets/logos/x.png"'));
  const team = headerHtml({ ...PCTX, players: false, name: 'Alpha Team', roster: ROSTER() });
  assert.ok(team.includes('src="assets/logos/x.png"') && !team.includes('FANTASY') && !team.includes('header-portrait'));
});

test('portrait fade: the colour is the team key with the one neutral default as fallback; team entries come from the theme', () => {
  const html = headerHtml({ ...PCTX, roster: ROSTER({ portrait: 'assets/players/P1.webp' }) });
  assert.match(html, /data-part="fantasy.player-card.header-portrait-fade" style="--fade-colour:var\(--fantasy-player-card-header-portrait-fade-team-colour-AAA, var\(--fantasy-player-card-header-portrait-fade-default-colour\)\)"/);
  const theme = JSON.parse(readFileSync(new URL('../../site/theme/theme.json', import.meta.url), 'utf8')).component.fantasy['player-card']['header-portrait-fade'];
  assert.ok(theme['default-colour'], 'the one neutral default colour stays (team entries: tests/theme/team-colours.test.mjs)');
});

test('team line: "Position | Team" as parts (a thin rule between), either alone (no rule), nothing when neither', () => {
  const html = (row, roster, team = 'AAA') => headerHtml({ ...PCTX, row, roster, team });
  const line = (row, roster, team) => (html(row, roster, team).match(/<p data-part="fantasy.player-card.team-line">(.*?)<\/p>/) || [])[1];
  assert.equal(line({ pos: 'G' }, ROSTER()), '<span data-part="fantasy.player-card.team-line-position">G</span><i data-part="fantasy.player-card.team-line-divider" aria-hidden="true"></i><span data-part="fantasy.player-card.team-line-team">Alpha Team</span>');
  assert.equal(line({}, ROSTER()), '<span data-part="fantasy.player-card.team-line-team">Alpha Team</span>');
  assert.equal(line({ pos: 'F' }, { teams: {}, players: {} }), '<span data-part="fantasy.player-card.team-line-position">F</span><i data-part="fantasy.player-card.team-line-divider" aria-hidden="true"></i><span data-part="fantasy.player-card.team-line-team">AAA</span>', 'the team code stands in for an unknown full name');
  assert.equal(line({ pos: 'F' }, ROSTER(), ''), '<span data-part="fantasy.player-card.team-line-position">F</span>');
  assert.equal(html({}, { teams: {}, players: {} }, '').includes('team-line"'), false, 'no empty line');
});

test('CR and Value (label + number, the chip with its sparkline): only with real data; a real 0 is valid; nothing at all while fantasyInfo is null', async () => {
  const draw = () => headerHtml({ ...PCTX, roster: ROSTER() });
  assert.equal(Data.fantasyInfo('P1'), null);
  assert.ok(!/cr-box|value-chip|value-sparkline|header-figures/.test(draw()), 'no empty boxes while the info is null');
  await withInfo({ cr: 0, value: 0, valueSeries: [0, 0] }, () => {
    const html = draw();
    assert.match(html, /<span class="fw-cr-box" data-part="fantasy.player-card.cr-box"><span data-part="fantasy.player-card.cr-box-label">CR<\/span><span data-part="fantasy.player-card.cr-box-value">0<\/span><\/span>/);
    assert.match(html, /<span class="fw-value-chip" data-part="fantasy.player-card.value-chip"><span data-part="fantasy.player-card.value-chip-label">Value<\/span><span data-part="fantasy.player-card.value-chip-value">0.00<\/span><svg data-part="fantasy.player-card.value-sparkline"/);
    assert.ok(inOrder(at(html, ['<h2>', 'header-figures', 'cr-box-label', 'value-chip-label', 'value-sparkline', 'data-part="fantasy.player-card.header-actions"'])), 'CR, then Value with its sparkline, after the name');
  });
  await withInfo({ cr: 12.5, value: null, valueSeries: [4] }, () => { const html = draw(); assert.ok(html.includes('cr-box-value">12.5<') && !html.includes('fw-value-chip') && !html.includes('value-sparkline'), 'a chip needs a value; a sparkline needs two numbers'); });
  await withInfo({ cr: null, value: 3, valueSeries: [1, NaN, 2] }, () => { const html = draw(); assert.ok(!html.includes('fw-cr-box') && html.includes('value-chip-value">3.00<') && !html.includes('value-sparkline'), 'invalid numbers draw no sparkline'); });
  await withInfo({ cr: undefined, value: undefined }, () => assert.ok(!/cr-box|value-chip/.test(draw())));
});

test('the next-game button ("vs" and the emblem) and Close sit in one line of the actions group, vertically centred in the second column of the header grid', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/card-layout.css', import.meta.url), 'utf8');
  assert.match(css, /header-actions"\]\{display:flex;[^}]*align-items:var\(--fantasy-player-card-header-actions-align\)/);
  assert.match(css, /\.fw-close\{box-sizing:border-box;min-width:var\(--fantasy-player-card-close-button-min-width\);min-height:var\(--fantasy-player-card-close-button-min-height\)/);
  assert.equal(ARRANGEMENT.component.fantasy['player-card']['header-actions'].align, 'center');
  assert.equal(ARRANGEMENT.component.fantasy['player-card'].header.parts.find(p => p.name === 'header-actions').self, 'center');
  assert.equal(ARRANGEMENT.component.fantasy['player-card']['header-actions'].push, undefined);
});

test('team cards keep the header they had: flat header row, own actions wrapper, no truncated Back button', () => {
  const html = headerHtml({ ...PCTX, players: false, name: 'Alpha Team', cs: { id: 'AAA', back: { id: 'P1', name: 'A Very Long Player Name Indeed' } }, roster: ROSTER() });
  assert.ok(html.startsWith('<header class="fw-identity" data-part="fantasy.player-card.header-team">'));
  assert.ok(html.includes('data-part="fantasy.player-card.header-actions-team"') && !html.includes('header-identity') && !html.includes('header-actions"'));
  assert.ok(inOrder(at(html, ['<img', '<h2>', 'data-back', 'data-close-slot'])));
  const css = readFileSync(new URL('../../site/theme/fantasy/workbench.css', import.meta.url), 'utf8');
  const base = css.match(/\.fw-next\{align-self:[^}]*\}/)[0];
  assert.ok(!/max-width|text-overflow/.test(base), 'the base Back / next button is not truncated; only the player actions group caps it');
  assert.match(css, /@media\(max-width:650px\)\{\.fw-next\{margin-top:0\}\}/);
});

/* ---- Batch 9: the team card city line ---- */
test('team card: the approved city sits below the club name inside the title; without a city the display name alone; player cards have none', async () => {
  const { default: CITIES } = await import('../../site/config/team-cities.json', { with: { type: 'json' } });
  const team = (name = 'Hapoel IBI Tel Aviv') => headerHtml({ cs: { id: 'HTA' }, players: false, name, team: 'HTA', row: {}, logo: 'assets/logos/x.png', next: null, roster: { teams: { HTA: name }, logoIds: { HTA: 'hapoel-tel-aviv' }, players: {} } });
  const none = headerHtml({ cs: { id: 'BAR' }, players: false, name: 'FC Barcelona', team: 'BAR', row: {}, logo: 'assets/logos/x.png', next: null, roster: { teams: { BAR: 'FC Barcelona' }, logoIds: { BAR: 'barcelona' }, players: {} } });
  assert.ok(none.includes('<h2>FC Barcelona</h2>') && !none.includes('header-city'), 'a team whose city is none: the display name alone, no second line');
  const real = team();
  assert.match(real, /<h2 title="Hapoel IBI Tel Aviv">Hapoel<\/h2><p data-part="fantasy.player-card.header-city">Tel Aviv<\/p>/, 'the approved labels apply');
  const unknown = headerHtml({ cs: { id: 'ZZZ' }, players: false, name: 'Unknown Club', team: 'ZZZ', row: {}, logo: null, next: null, roster: { teams: { ZZZ: 'Unknown Club' }, logoIds: {}, players: {} } });
  assert.ok(unknown.includes('<h2>Unknown Club</h2>') && !unknown.includes('header-city'), 'a team outside the catalogue: no mapping, no second line');
  const saved = JSON.stringify(CITIES.cities);
  try {
    CITIES.cities['hapoel-tel-aviv'] = { city: 'Tel Aviv' };
    const html = team();
    assert.match(html, /<h2 title="Hapoel IBI Tel Aviv">Hapoel IBI<\/h2><p data-part="fantasy.player-card.header-city">Tel Aviv<\/p>/, 'city once across the two lines, the full name stays as the tooltip');
    assert.ok(html.indexOf('<img') < html.indexOf('<h2') && html.indexOf('<h2') < html.indexOf('header-city') && html.indexOf('header-city') < html.indexOf('data-close-slot'), 'logo, club, city, then the actions');
    assert.ok(!html.includes('FANTASY') && !html.includes('GP'));
    CITIES.cities['hapoel-tel-aviv'] = { city: 'Tel Aviv', club: 'Hapoel' };
    assert.ok(team().includes('>Hapoel</h2>'));
    const player = headerHtml({ cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'HTA', row: { pos: 'G' }, logo: null, next: null, roster: { teams: { HTA: 'Hapoel IBI Tel Aviv' }, logoIds: { HTA: 'hapoel-tel-aviv' }, players: { P1: { name: 'Player One' } } } });
    assert.ok(!player.includes('header-city'), 'player cards have no city line');
  } finally { for (const k of Object.keys(CITIES.cities)) delete CITIES.cities[k]; Object.assign(CITIES.cities, JSON.parse(saved)); }
});
