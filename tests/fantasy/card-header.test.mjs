// Card header: GP in the controls row, next-opponent button (player cards), back button (team card opened from a player card), next-game loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../../site/core/data-loader.js';
import { Data } from '../../site/core/data.js';
import { siteFile, useIcons } from '../helpers/site-data.mjs';
import { controlsHtml, headerHtml } from '../../site/fantasy/cards/card-header.js';

const game = (code, date, status, h, a) => ({ code, round: code, date, status, phase: 'RS', home: { code: h, name: h + ' name' }, away: { code: a, name: a + ' name' } });
const SCHEDULE = [
  game(1, '2026-09-24T18:00:00.000Z', 'result', 'AAA', 'BBB'),
  game(3, '2026-11-20T18:00:00.000Z', 'confirmed', 'CCC', 'AAA'),   // later
  game(2, '2026-11-14T18:00:00.000Z', 'confirmed', 'AAA', 'DDD'),   // next for AAA (home)
  game(4, '2026-11-15T18:00:00.000Z', 'confirmed', 'EEE', 'BBB'),   // next for BBB (away)
];
function loader() {
  let fetches = 0;
  const fetchFn = async u => { fetches++; const p = u.split('/').pop().split('?')[0]; return { ok: true, status: 200, json: async () => p === 'manifest.json' ? { version: 'abc' } : SCHEDULE }; };
  return { D: create({ base: 'http://x/data/', fetch: fetchFn }), fetches: () => fetches };
}

test('next game: earliest confirmed game of the team, home and away; none when nothing is upcoming; one fetch', async () => {
  const { D, fetches } = loader();
  const a = await D.nextGame('AAA'), b = await D.nextGame('BBB'), c = await D.nextGame('ZZZ');
  assert.deepEqual({ ...a }, { code: 2, round: 2, date: '2026-11-14T18:00:00.000Z', home: true, opp: 'DDD', oppName: 'DDD name' });
  assert.equal(b.home, false); assert.equal(b.opp, 'EEE');
  assert.equal(c, null);
  assert.equal(fetches(), 2, 'manifest + schedule.json once');
});

/* ---- the card, with stubbed data and a fake DOM ---- */
const root = { innerHTML: '', buttons: {},
  querySelector(sel) {
    if (sel === '[data-close-slot]') return this.innerHTML.includes('data-close-slot') ? { replaceWith: el => { assert.equal(el, closeBtn); closeAt.where = 'header'; } } : null;
    const m = sel.match(/^\[(data-next|data-back)\]$/);
    if (!m || !this.innerHTML.includes(m[1])) return null;
    const dataset = { next: (this.innerHTML.match(/data-next="([^"]*)"/) || [])[1] };
    return (this.buttons[m[1]] = { dataset, addEventListener: (t, f) => { this.buttons[m[1]].fire = () => f({ currentTarget: { dataset } }); } });
  },
  querySelectorAll: () => [], textContent: '' };
const closeBtn = {}, closeAt = { where: 'dialog' };   // the single Close button, and where it sits
const dlg = { className: '', querySelector: s => (s === '.fw-card' ? root : s === '.fw-close' ? closeBtn : {}), prepend: el => { assert.equal(el, closeBtn); closeAt.where = 'dialog'; }, showModal() {}, close() {}, remove() {} };
globalThis.document = { createElement: () => dlg, body: { append() {} }, activeElement: null };
globalThis.window = { addEventListener() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ cols: 24, layouts: Object.fromEntries(['team.profile', 'team.shooting', 'player.profile', 'player.shooting'].map(k => [k, { sections: [] }])) }) });
await useIcons();
const { open } = await import('../../site/fantasy/cards/card.js');

function setup(next) {
  const roster = { teams: { AAA: 'Alpha Team', DDD: 'Delta Team' }, players: { P1: { name: 'Player One' } }, logoIds: { DDD: 'fenerbahce-ulker' } };   // DDD is shown as FBT
  const row = { team: 'AAA', pos: 'G' };
  const view = { keys: [], league: () => ({ value: 0 }), row: () => row, get: () => ({ value: 0 }) };
  const teamsView = { keys: [], league: () => ({ value: 0 }), row: () => ({ games: 0 }), get: () => ({ value: 0 }) };
  Object.assign(Data, { view: async () => view, metrics: async () => ({ byId: {} }), roster: async () => roster, nextGame: async () => next, engine: async () => ({}), games: async () => [] });
  Data.view = async kind => (kind === 'teams' ? teamsView : view);
  root.innerHTML = ''; root.buttons = {};
  return { root, tick: () => new Promise(r => setTimeout(r, 5)) };
}
const GAME = { code: 2, date: '2026-11-14T18:00:00.000Z', home: true, opp: 'DDD', oppName: 'Delta name' };
const header = html => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
const controls = html => html.slice(html.indexOf('fw-card-controls'), html.indexOf('fw-card-controls') + 1000);

test('GP is in the controls row between the window group and the Shooting group, not in the header', async () => {
  const { root, tick } = setup(null);
  open('players', 'P1', {}); await tick();
  assert.ok(!header(root.innerHTML).includes('GP'));
  assert.match(controls(root.innerHTML), /aria-label="Sample window"[^>]*>.*?<\/div><div data-part="fantasy.player-card.controls-games-played-group"><span data-part="fantasy.player-card.controls-games-played-divider" aria-hidden="true"><\/span><b data-part="fantasy.player-card.controls-games-played"><span data-part="fantasy.player-card.controls-games-played-number">0<\/span><span data-part="fantasy.player-card.controls-games-played-label">GP<\/span><\/b><\/div><div role="group" aria-label="Card view"/);
});

test('player card: "vs FBT ↗" button with tooltip, opens the team card; hidden without an upcoming game', async () => {
  const { root, tick } = setup(GAME);
  open('players', 'P1', {}); await tick();
  const h = header(root.innerHTML);
  assert.match(h, /<button class="fw-vs" data-part="fantasy.player-card.next-game-button" data-next="DDD" title="Open Delta Team card · Sat 14 Nov" aria-label="Open Delta Team card · Sat 14 Nov"><span data-part="fantasy.player-card.next-game-label">vs<\/span><img data-part="fantasy.player-card.next-game-logo" src="[^"]*fenerbahce-ulker[^"]*" alt="" onerror="[^"]*"><span hidden data-part="fantasy.player-card.next-game-label">FBT<\/span><\/button>/, '"vs" and the opponent emblem; the code stands in if the emblem fails');
  assert.ok(!h.includes('data-back'));
  root.buttons['data-next'].fire(); await tick();
  assert.ok(!root.innerHTML.includes('TEAM / FANTASY') && root.innerHTML.includes('Delta Team'));
  const none = setup(null);
  open('players', 'P1', {}); await none.tick();
  assert.ok(!none.root.innerHTML.includes('data-next'));
});

test('away game shows "@ FBT"', async () => {
  const { root, tick } = setup({ ...GAME, home: false });
  open('players', 'P1', {}); await tick();
  assert.match(root.innerHTML, /<span data-part="fantasy.player-card.next-game-label">@<\/span><img data-part="fantasy.player-card.next-game-logo"/);
});

test('team card opened from a player card shows "← Player One" and goes back; opened from a table it does not', async () => {
  const { root, tick } = setup(GAME);
  open('players', 'P1', { win: 'last5' }); await tick();
  root.buttons['data-next'].fire(); await tick();
  assert.match(header(root.innerHTML), /data-back[^>]*>← Player One<\/button>/);
  assert.ok(!header(root.innerHTML).includes('data-next'));
  root.buttons['data-back'].fire(); await tick();
  assert.ok(!root.innerHTML.includes('FANTASY') && root.innerHTML.includes('Player One'));
  const t = setup(GAME);
  open('teams', 'DDD', {}); await t.tick();
  assert.ok(!t.root.innerHTML.includes('data-back'));
});

test('the button class is styled: the stylesheet has rules for the next / back button and its arrow', () => {
  const css = siteFile('theme/fantasy/workbench.css');
  assert.match(css, /\.fw-next[ ,{:]/);
  assert.match(css, /\.fw-next \.fw-arrow\{/);
});

test('a card opens in the mode it is given (profile by default); next opponent and Back keep working from it', async () => {
  const pressed = html => /data-card-view="shooting" aria-pressed="(true|false)"/.exec(html)[1];
  const a = setup(GAME);
  open('players', 'P1', {}); await a.tick();
  assert.equal(pressed(a.root.innerHTML), 'false', 'profile when no mode is supplied');
  const b = setup(GAME);
  open('players', 'P1', { win: 'l5', mode: 'shooting' }); await b.tick();
  assert.equal(pressed(b.root.innerHTML), 'true');
  assert.match(b.root.innerHTML, /data-card-window="l5" aria-pressed="true"/, 'the window is kept together with the mode');
  b.root.buttons['data-next'].fire(); await b.tick();
  assert.ok(!b.root.innerHTML.includes('TEAM / FANTASY') && b.root.innerHTML.includes('Delta Team') && b.root.innerHTML.includes('data-back'));
  b.root.buttons['data-back'].fire(); await b.tick();
  assert.ok(!b.root.innerHTML.includes('FANTASY') && b.root.innerHTML.includes('Player One'));
  const c = setup(GAME);
  open('teams', 'DDD', { mode: 'nonsense' }); await c.tick();
  assert.ok(!c.root.innerHTML.includes('TEAM / FANTASY') && c.root.innerHTML.includes('Delta Team'));
});

test('Close is one button: in the dialog while loading and when the card fails, in the header actions once drawn; Escape and backdrop click close too', async () => {
  const { root, tick } = setup(GAME);
  closeAt.where = 'dialog'; delete closeBtn.onclick;
  open('players', 'P1', {});
  assert.equal(closeAt.where, 'dialog', 'while loading');
  assert.equal(typeof closeBtn.onclick, 'function');
  await tick();
  assert.equal(closeAt.where, 'header', 'once the card is drawn');
  assert.equal(root.innerHTML.split('data-close-slot').length - 1, 1);
  const failing = setup(GAME);
  Data.view = async () => { throw new Error('boom'); };
  closeAt.where = 'dialog'; open('players', 'P1', {}); await failing.tick();
  assert.match(root.textContent, /Could not load the card/);
  assert.equal(closeAt.where, 'dialog', 'on an error');
  assert.equal(typeof dlg.oncancel, 'function'); assert.equal(typeof dlg.onclick, 'function');
  let prevented = false; dlg.oncancel({ preventDefault() { prevented = true; } }); assert.ok(prevented, 'Escape is handled by the card');
});

/* ---- Batch 3: team card header, shared controls ---- */
test('team card: no "TEAM / FANTASY" kicker, the logo (when there is one) and the full team name; no kicker on player cards either', async () => {
  const p = setup(null);
  open('players', 'P1', {}); await p.tick();
  assert.ok(!p.root.innerHTML.includes('FANTASY') && p.root.innerHTML.includes('<h2>'), 'no kicker on player cards either');
  const t = setup(null);
  open('teams', 'DDD', {}); await t.tick();
  const h = header(t.root.innerHTML);
  assert.ok(!h.includes('FANTASY') && h.includes('<h2 title="Delta Team">Fenerbahce Tarfin</h2>') && h.includes('>Istanbul</p>'), 'the approved first line and city; the display name stays as the tooltip');
  assert.match(h, /^<header class="fw-identity" data-part="fantasy.player-card.header-team"><img src="[^"]*fenerbahce-ulker[^"]*" alt="" data-part="fantasy.player-card.header-logo">/, 'logo to the left of the name');
  const none = setup(null);
  open('teams', 'AAA', {}); await none.tick();
  assert.ok(!header(none.root.innerHTML).includes('<img'), 'no image without a logo');
});

test('controls: outlined period buttons at the left, a detached GP readout (players only; "0 GP" for a known zero, none when unknown), Profile and Shooting at the right', () => {
  const draw = (players, gp, mode = 'profile') => controlsHtml({ cs: { mode, win: 'l5' }, players, gp });
  const player = draw(true, 0, 'shooting');
  assert.ok(!player.includes('fw-switch'), 'no shared switch box: each period button has its own outline');
  assert.match(player, /data-part="fantasy.player-card.window-buttons">.*data-card-window="l5" aria-pressed="true">Last 5<\/button>.*<span data-part="fantasy.player-card.controls-games-played-number">0<\/span><span data-part="fantasy.player-card.controls-games-played-label">GP<\/span>.*data-part="fantasy.player-card.view-buttons"/s);
  assert.match(player, /data-card-view="profile" aria-pressed="false"><span data-part="fantasy.player-card.view-icon" aria-hidden="true"><svg [^>]*>.*?<\/svg><\/span><span>Profile<\/span><\/button>/s);
  assert.match(player, /data-card-view="shooting" aria-pressed="true">.*?<span>Shooting<\/span>/s);
  assert.ok(!draw(true, undefined).includes('GP</b>') && !draw(true, null).includes('GP</b>'), 'no readout when the count is unavailable');
  assert.ok(draw(true, 12).includes('controls-games-played-number">12<'));
  const team = draw(false, 12);
  assert.ok(!team.includes('GP</b>'), 'team cards show no GP');
  assert.ok(team.includes('data-card-view="profile"') && team.includes('data-card-view="shooting"') && team.includes('Last 5'), 'the same period and view buttons on team cards');
});

test('the two view buttons select their mode explicitly and clicking the active one changes nothing', async () => {
  const { root, tick } = setup(null);
  const clicks = [];
  root.querySelectorAll = sel => (sel === '[data-card-view]' ? ['profile', 'shooting'].map(v => ({ dataset: { cardView: v }, set onclick(f) { clicks.push([v, f]); } })) : []);
  open('players', 'P1', {}); await tick();
  assert.deepEqual(clicks.map(c => c[0]), ['profile', 'shooting']);
  clicks[1][1](); await tick();
  assert.match(root.innerHTML, /data-card-view="shooting" aria-pressed="true"/);
  clicks.length = 0; await tick();
});

test('GP divider: a thin rule grouped with the GP readout, only for a known count (0 included), never on team cards', () => {
  const draw = (players, gp) => controlsHtml({ cs: { mode: 'profile', win: 'season' }, players, gp });
  for (const gp of [0, 7]) assert.match(draw(true, gp), new RegExp(`<div data-part="fantasy.player-card.controls-games-played-group"><span data-part="fantasy.player-card.controls-games-played-divider" aria-hidden="true"></span><b data-part="fantasy.player-card.controls-games-played"><span data-part="fantasy.player-card.controls-games-played-number">${gp}</span><span data-part="fantasy.player-card.controls-games-played-label">GP</span></b></div>`));
  for (const gp of [undefined, null, NaN]) assert.ok(!/controls-games-played/.test(draw(true, gp)), 'no readout and no divider without a count');
  assert.ok(!/controls-games-played/.test(draw(false, 12)), 'no readout and no divider on team cards');
});

test('player card: no kicker, the identity starts with the given name or the display name', () => {
  const html = headerHtml({ cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: { pos: 'G' }, logo: null, next: null, roster: { teams: { AAA: 'Alpha' }, players: { P1: { first: 'Player', last: 'One' } } } });
  assert.ok(!/<small|FANTASY/.test(html));
  assert.ok(html.indexOf('header-given-name') < html.indexOf('<h2>'));
  assert.ok(headerHtml({ cs: { id: 'P1', mode: 'profile', win: 'season' }, players: true, name: 'Player One', team: 'AAA', row: {}, logo: null, next: null, roster: { teams: {}, players: {} } }).includes('<h2>Player One</h2>'));
});

test('cr box and value chip open the trend like a tile: one selected at a time, again closes, each feeds its own series; no series = not clickable', async () => {
  const { root, tick } = setup(null);
  const info = { cr: 9.5, crSeries: [8, 8.5, 9, 9.5], value: 1.2, valueSeries: [9, 9, 9, 9], gameValues: [1, 1.1, 1.15, 1.2] };
  Data.metrics = async () => ({ byId: { value: { id: 'value', label: 'Value', direction: 1, chartScale: 'zero', format: { digits: 2, suffix: '' } } } });
  Data.fantasyInfo = () => info; Data.formatMetric = (id, v) => v.toFixed(2);
  const gpView = { keys: [], league: () => ({ value: 0 }), row: () => ({ team: 'AAA', pos: 'G' }), get: () => ({ value: 5 }) };
  Data.view = async () => gpView;   // a player with games, so the card draws a chart
  const els = {};
  root.querySelectorAll = sel => (sel === '[data-metric]' ? ['cr', 'value'].map(k => (els[k] = { tagName: 'SPAN', dataset: { metric: k } })) : []);
  const tips = html => [...html.matchAll(/data-tip="R\d+ · ([-\d.]+)"/g)].map(m => +m[1]);
  const pressed = (k) => new RegExp('data-metric="' + k + '" aria-pressed="(true|false)"').exec(root.innerHTML)[1];
  open('players', 'P1', {}); await tick();
  assert.match(root.innerHTML, /data-part="fantasy.player-card.cr-box" role="button" tabindex="0" data-metric="cr" aria-pressed="false"/);
  assert.equal(pressed('value'), 'false'); assert.ok(!root.innerHTML.includes('fw-trend'));
  els.cr.onclick(); await tick();
  assert.equal(pressed('cr'), 'true'); assert.equal(pressed('value'), 'false');
  assert.deepEqual(tips(root.innerHTML), [8, 8.5, 9, 9.5], 'cr feeds crSeries');
  els.value.onclick(); await tick();
  assert.equal(pressed('value'), 'true'); assert.equal(pressed('cr'), 'false', 'selecting value deselects cr');
  assert.deepEqual(tips(root.innerHTML), [1, 1.1, 1.15, 1.2].map(v => +v.toFixed(2)), 'value feeds gameValues (2 decimals), not the sparkline series');
  els.value.onkeydown({ key: 'Enter', preventDefault() {} }); await tick();
  assert.equal(pressed('value'), 'false'); assert.ok(!root.innerHTML.includes('fw-trend'), 'again closes the chart');
  Data.fantasyInfo = () => ({ ...info, crSeries: [null, null], gameValues: [null, null] });
  open('players', 'P1', {}); await tick();
  assert.ok(!/data-metric="(cr|value)"/.test(root.innerHTML), 'no series: nothing clickable');
});
