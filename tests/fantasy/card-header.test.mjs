// Card header: GP in the controls row, next-opponent button (player cards), back button (team card opened from a player card), next-game loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../../site/core/data-loader.js';
import { Data } from '../../site/core/data.js';
import { siteFile, useIcons } from '../helpers/site-data.mjs';
import { controlsHtml } from '../../site/fantasy/cards/card-header.js';

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
globalThis.fetch = async () => ({ ok: true, json: async () => ({ cols: 24, layouts: Object.fromEntries(['team.profile', 'team.shooting', 'player.profile', 'player.shooting'].map(k => [k, { rows: 1, boxes: [], lines: [] }])) }) });
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
const controls = html => html.slice(html.indexOf('fw-card-controls'), html.indexOf('fw-card-controls') + 600);

test('GP is in the controls row between the window group and the Shooting group, not in the header', async () => {
  const { root, tick } = setup(null);
  open('players', 'P1', {}); await tick();
  assert.ok(!header(root.innerHTML).includes('GP'));
  assert.match(controls(root.innerHTML), /aria-label="Sample window"[^>]*>.*?<\/div><b data-part="fantasy.player-card.controls-games-played">0 GP<\/b><div role="group" aria-label="Card view"/);
});

test('player card: "vs FBT ↗" button with tooltip, opens the team card; hidden without an upcoming game', async () => {
  const { root, tick } = setup(GAME);
  open('players', 'P1', {}); await tick();
  const h = header(root.innerHTML);
  assert.match(h, /<button class="fw-next" data-next="DDD" title="Open Delta Team card · Sat 14 Nov" aria-label="Open Delta Team card · Sat 14 Nov">vs FBT<span class="fw-arrow"> ↗<\/span><\/button>/);
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
  assert.match(root.innerHTML, />@ FBT<span/);
});

test('team card opened from a player card shows "← Player One" and goes back; opened from a table it does not', async () => {
  const { root, tick } = setup(GAME);
  open('players', 'P1', { win: 'last5' }); await tick();
  root.buttons['data-next'].fire(); await tick();
  assert.match(header(root.innerHTML), /data-back[^>]*>← Player One<\/button>/);
  assert.ok(!header(root.innerHTML).includes('data-next'));
  root.buttons['data-back'].fire(); await tick();
  assert.ok(root.innerHTML.includes('PLAYER / FANTASY') && root.innerHTML.includes('Player One'));
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
  assert.ok(b.root.innerHTML.includes('PLAYER / FANTASY'));
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
test('team card: no "TEAM / FANTASY" kicker, the logo (when there is one) and the full team name; player card keeps its kicker', async () => {
  const p = setup(null);
  open('players', 'P1', {}); await p.tick();
  assert.ok(p.root.innerHTML.includes('PLAYER / FANTASY'));
  const t = setup(null);
  open('teams', 'DDD', {}); await t.tick();
  const h = header(t.root.innerHTML);
  assert.ok(!h.includes('FANTASY') && h.includes('<h2>Delta Team</h2>'));
  assert.match(h, /^<header class="fw-identity" data-part="fantasy.player-card.header-team"><img src="[^"]*fenerbahce-ulker[^"]*" alt="" data-part="fantasy.player-card.header-logo">/, 'logo to the left of the name');
  const none = setup(null);
  open('teams', 'AAA', {}); await none.tick();
  assert.ok(!header(none.root.innerHTML).includes('<img'), 'no image without a logo');
});

test('controls: outlined period buttons at the left, a detached GP readout (players only; "0 GP" for a known zero, none when unknown), Profile and Shooting at the right', () => {
  const draw = (players, gp, mode = 'profile') => controlsHtml({ cs: { mode, win: 'l5' }, players, gp });
  const player = draw(true, 0, 'shooting');
  assert.ok(!player.includes('fw-switch'), 'no shared switch box: each period button has its own outline');
  assert.match(player, /data-part="fantasy.player-card.window-buttons">.*data-card-window="l5" aria-pressed="true">Last 5<\/button>.*<b data-part="fantasy.player-card.controls-games-played">0 GP<\/b>.*data-part="fantasy.player-card.view-buttons"/s);
  assert.match(player, /data-card-view="profile" aria-pressed="false"><span data-part="fantasy.player-card.view-icon" aria-hidden="true"><svg [^>]*>.*?<\/svg><\/span><span>Profile<\/span><\/button>/s);
  assert.match(player, /data-card-view="shooting" aria-pressed="true">.*?<span>Shooting<\/span>/s);
  assert.ok(!draw(true, undefined).includes('GP</b>') && !draw(true, null).includes('GP</b>'), 'no readout when the count is unavailable');
  assert.ok(draw(true, 12).includes('>12 GP</b>'));
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
