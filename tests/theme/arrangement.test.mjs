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

test('toolbar: parts in the configured order, the end group at the far end, optional parts only when they apply', async () => {
  const players = await table('players');
  assert.ok(inOrder(at(players, ['data-view-set="profile"', 'aria-label="Sample window"', 'data-position="G"', 'type="search"', 'data-filters'])), 'view pair above; windows left; G/F/C, Find player, Filters at the right');
  assert.ok(!players.includes('data-view-toggle') && !players.includes('FANTASY / PLAYERS') && !players.includes('data-position="ALL"'));
  const teams = await table('teams');
  assert.ok(!teams.includes('data-position') && !teams.includes('data-filters'), 'players-only parts are not drawn for teams');
  assert.ok(inOrder(at(teams, ['data-view-toggle', 'class="fw-right"', 'type="search"'])));
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

test('CR box and Value chip are always drawn on Players (a frame with a dash without data, the values with data); Teams have none', async () => {
  assert.equal(Data.fantasyInfo('anyone'), null);
  const players = await table('players');
  assert.match(players, /class="fw-cr-box" data-part="fantasy.stat-table.name-cell-cr-box" data-placeholder>—<\/span>/);
  assert.match(players, /class="fw-value-chip" data-part="fantasy.stat-table.name-cell-value-chip" data-placeholder>/);
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' } }, logo: null, next: null };
  assert.match(headerHtml(ctx), /class="fw-cr-box" data-part="fantasy.player-card.cr-box" data-placeholder>—<\/span>/);
  const saved = Data.fantasyInfo; Data.fantasyInfo = () => ({ cr: 12.5, value: 3.1 });
  try {
    assert.ok(headerHtml(ctx).includes('>12.5</span>') && headerHtml(ctx).includes('>3.1</span>') && !headerHtml(ctx).includes('data-placeholder'));
    const html = await table('players');
    assert.ok(html.includes('>12.5</span>') && html.includes('fw-value-chip') && !html.includes('data-placeholder'));
    assert.ok(!(await table('teams')).includes('fw-cr-box'), 'team rows have no cr box');
  } finally { Data.fantasyInfo = saved; }
});

test('controls row: window buttons, games played, Shooting in the configured order', () => {
  const html = controlsHtml({ cs: { mode: 'profile', win: 'season' }, players: true, gp: 7 });
  assert.ok(inOrder(at(html, ['aria-label="Sample window"', '7 GP</b>', 'aria-label="Card view"'])));
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

test('with no fantasy info (null) the frames are there with a dash and a flat sparkline line; Teams have none', async () => {
  assert.equal(Data.fantasyInfo('anyone'), null);
  const ctx = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, roster: { teams: { AAA: 'Alpha' }, players: {} }, logo: null, next: null };
  const header = headerHtml(ctx), table1 = await table('players');
  for (const html of [header, table1]) assert.ok(/fw-cr-box/.test(html) && /fw-value-chip/.test(html) && /<svg data-part="[^"]*sparkline-placeholder"[^>]*><line /.test(html) && !/<polyline/.test(html), 'frames + flat placeholder line');
  assert.ok(header.includes('>—</span>'));
  const teams = await table('teams'); assert.ok(!/fw-cr-box|fw-value-chip|sparkline/.test(teams));
  assert.ok(!/fw-cr-box|fw-value-chip|sparkline/.test(headerHtml({ ...ctx, players: false, name: 'Alpha' })), 'team cards have none');
});

test('optional header parts (portrait, given name, family name, sparkline) draw nothing without data; the display name and the logo stay', () => {
  const base = { cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, logo: 'assets/logos/x.png', next: null };
  const bare = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { name: 'Player One' } } } });
  assert.ok(!/header-portrait|header-given-name|<polyline/.test(bare));
  assert.ok(bare.includes('<h2>Player One</h2>') && bare.includes('<img src="assets/logos/x.png"'), 'display name and team logo fallbacks');
  const onlyFirst = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { first: 'Player' } } } });
  assert.ok(!onlyFirst.includes('header-given-name') && onlyFirst.includes('<h2>Player One</h2>'), 'a given name alone is not used: the names are not derived');
  const full = headerHtml({ ...base, roster: { teams: { AAA: 'Alpha' }, players: { P1: { first: 'Player', last: 'One', portrait: 'assets/p/1.png' } } } });
  assert.ok(inOrder(at(full, ['data-part="fantasy.player-card.header-portrait"', 'data-part="fantasy.player-card.header-portrait-fade"', 'src="assets/p/1.png"', 'data-part="fantasy.player-card.header-given-name">Player<', '<h2>One</h2>'])), full);
  assert.ok(!full.includes('assets/logos/x.png'), 'a player with a portrait shows no team logo');
  const saved = Data.fantasyInfo; Data.fantasyInfo = () => ({ cr: null, value: 3.1, valueSeries: [1, 3, 2] });
  try { assert.match(headerHtml({ ...base, roster: { teams: {}, players: {} } }), /data-part="fantasy.player-card.value-sparkline"[^>]*><polyline points="0.0,30.0 50.0,0.0 100.0,15.0"/); } finally { Data.fantasyInfo = saved; }
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

test('player header: portrait, title block, cr, value, and the actions group at the far end', () => {
  const html = headerHtml({ ...PCTX, roster: ROSTER({ first: 'Player', last: 'One', portrait: 'assets/players/P1.webp' }) });
  assert.ok(inOrder(at(html, ['header-identity', 'header-portrait', 'header-given-name', '<h2>One</h2>', '<p>G | Alpha Team</p>', 'header-actions', 'data-next=', 'data-close-slot'])), html);
  assert.ok(html.lastIndexOf('header-identity') < html.indexOf('data-part="fantasy.player-card.header-actions"'), 'the actions group is the last part of the header');
});

test('player header: the team logo is only the fallback for a player without a portrait; team cards keep it', () => {
  assert.ok(!headerHtml({ ...PCTX, roster: ROSTER({ portrait: 'assets/players/P1.webp' }) }).includes('assets/logos/x.png'));
  assert.ok(headerHtml({ ...PCTX, roster: ROSTER() }).includes('src="assets/logos/x.png"'));
  const team = headerHtml({ ...PCTX, players: false, name: 'Alpha Team', roster: ROSTER() });
  assert.ok(team.includes('src="assets/logos/x.png"') && !team.includes('FANTASY') && !team.includes('header-portrait'));
});

test('portrait fade: the colour is the team key with the one neutral default as fallback; nothing is invented per team', () => {
  const html = headerHtml({ ...PCTX, roster: ROSTER({ portrait: 'assets/players/P1.webp' }) });
  assert.match(html, /data-part="fantasy.player-card.header-portrait-fade" style="--fade-colour:var\(--fantasy-player-card-header-portrait-fade-team-colour-AAA, var\(--fantasy-player-card-header-portrait-fade-default-colour\)\)"/);
  const theme = JSON.parse(readFileSync(new URL('../../site/theme/theme.json', import.meta.url), 'utf8')).component.fantasy['player-card']['header-portrait-fade'];
  assert.ok(theme['default-colour'] && !Object.keys(theme).some(k => k.startsWith('team-colour-')), 'one default colour, no team colour filled yet');
});

test('team line: "Position | Team", either alone, nothing when neither', () => {
  const line = (row, roster, team = 'AAA') => (headerHtml({ ...PCTX, row, roster, team }).match(/<p>(.*?)<\/p>/) || [])[1];
  assert.equal(line({ pos: 'G' }, ROSTER()), 'G | Alpha Team');
  assert.equal(line({}, ROSTER()), 'Alpha Team');
  assert.equal(line({ pos: 'F' }, { teams: {}, players: {} }), 'F | AAA', 'the team code stands in for an unknown full name');
  assert.equal(line({ pos: 'F' }, ROSTER(), ''), 'F');
  assert.equal(headerHtml({ ...PCTX, row: {}, team: '', roster: { teams: {}, players: {} } }).includes('<p>'), false, 'no empty line');
});

test('cr box, value chip and sparkline: real data replaces the placeholders; a real 0 is a value', async () => {
  const draw = () => headerHtml({ ...PCTX, roster: ROSTER() });
  assert.equal(Data.fantasyInfo('P1'), null);
  const empty = draw();
  assert.ok(inOrder(at(empty, ['<h2>', 'fw-cr-box', 'fw-value-chip', 'value-sparkline-placeholder', 'data-part="fantasy.player-card.header-actions"'])), 'the frames are in the layout without data');
  await withInfo({ cr: 0, value: 0, valueSeries: [0, 0] }, () => {
    const html = draw();
    assert.match(html, /<span class="fw-cr-box" data-part="fantasy.player-card.cr-box">0<\/span>/);
    assert.match(html, /<span class="fw-value-chip" data-part="fantasy.player-card.value-chip">0<\/span>/);
    assert.ok(!html.includes('data-placeholder') && !html.includes('placeholder"'), 'a real 0 is not a placeholder');
    assert.ok(inOrder(at(html, ['<h2>', 'fw-cr-box', 'fw-value-chip', 'data-part="fantasy.player-card.value-sparkline"', 'data-part="fantasy.player-card.header-actions"'])), 'cr, then value chip with its sparkline, after the name');
  });
  await withInfo({ cr: 12.5, value: null, valueSeries: [4] }, () => { const html = draw(); assert.ok(html.includes('>12.5</span>') && /fw-value-chip" data-part="fantasy.player-card.value-chip" data-placeholder>—/.test(html) && html.includes('value-sparkline-placeholder'), 'no value: the chip shows a dash and the sparkline keeps its space'); });
  await withInfo({ cr: null, value: 3, valueSeries: [1, NaN, 2] }, () => { const html = draw(); assert.ok(/fw-cr-box" data-part="fantasy.player-card.cr-box" data-placeholder>—/.test(html) && html.includes('>3</span>') && !html.includes('<polyline') && !html.includes('placeholder"'), 'a value with unusable history: no line (as before)'); });
  await withInfo({ cr: undefined, value: undefined }, () => assert.ok(/cr-box" data-part="[^"]*" data-placeholder>—/.test(draw()) && draw().includes('value-sparkline-placeholder')));
});

test('the next-game button and Close share one height and radius (the same keys) and sit in one line of the actions group, at the far end', () => {
  const css = readFileSync(new URL('../../site/theme/fantasy/workbench.css', import.meta.url), 'utf8');
  assert.match(css, /\.fw-close,\.fw-next\{[^}]*border-radius:var\(--fantasy-player-card-close-and-next-button-radius\)[^}]*height:var\(--fantasy-player-card-close-and-next-button-height\)/);
  const cardCss = readFileSync(new URL('../../site/theme/fantasy/card-layout.css', import.meta.url), 'utf8');
  assert.match(cardCss, /header-actions"\]\{display:flex;[^}]*align-items:var\(--fantasy-player-card-header-actions-align\)/);
  assert.equal(ARRANGEMENT.component.fantasy['player-card']['header-actions'].align, 'center');
  assert.equal(ARRANGEMENT.component.fantasy['player-card']['header-actions'].push, 'end');
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
