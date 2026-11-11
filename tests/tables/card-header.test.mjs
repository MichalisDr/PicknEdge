// Card header: GP in the controls row, next-opponent button (player cards), back button (team card opened from a player card), next-game loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const { create } = createRequire(import.meta.url)('../../site/data-loader.js');
const src = readFileSync(new URL('../../site/fantasy-cards.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../site/fantasy-workbench.css', import.meta.url), 'utf8');

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
function setup(next) {
  const roster = { teams: { AAA: 'Alpha Team', DDD: 'Delta Team' }, players: { P1: { name: 'Player One' } } };
  const row = { team: 'AAA', pos: 'G' };
  const view = { keys: [], league: () => ({ value: 0 }), row: () => row, get: () => ({ value: 0 }) };
  const D = { view: async () => view, metrics: async () => ({ byId: {} }), roster: async () => roster, nextGame: async () => next };
  const W = { esc: s => String(s ?? ''), view: async () => ({ keys: [], league: () => ({ value: 0 }), row: () => ({ games: 0 }), get: () => ({ value: 0 }) }), buttons: () => '', wire() {}, spec: () => ({}) };
  const root = { innerHTML: '', buttons: {},
    querySelector(sel) {
      const m = sel.match(/^\[(data-next|data-back)\]$/);
      if (!m || !this.innerHTML.includes(m[1])) return null;
      const dataset = { next: (this.innerHTML.match(/data-next="([^"]*)"/) || [])[1] };
      return (this.buttons[m[1]] = { dataset, addEventListener: (t, f) => { this.buttons[m[1]].fire = () => f({ currentTarget: { dataset } }); } });
    },
    querySelectorAll: () => [] , textContent: '' };
  const dlg = { className: '', querySelector: s => (s === '.fw-card' ? root : {}), showModal() {}, close() {}, remove() {} };
  const document = { createElement: () => dlg, body: { append() {} }, activeElement: null };
  const g = { PicknEdgeData: D, PicknEdgeWindows: W, document, addEventListener() {}, PICKNEDGE_TEAM_CODE: (r, c) => ({ DDD: 'FBT' })[c] || c, PICKNEDGE_TEAMS: [], PicknEdgeLayout: { stackOrder: () => [] }, fetch: async () => ({ ok: true, json: async () => ({ cols: 24, layouts: { 'team.profile': { rows: 1, boxes: [], lines: [] } } }) }) };
  vm.runInNewContext(src, Object.assign(g, { globalThis: g }), { filename: 'fantasy-cards.js' });
  const tick = () => new Promise(r => setTimeout(r, 5));
  return { g, root, tick, D };
}
const GAME = { code: 2, date: '2026-11-14T18:00:00.000Z', home: true, opp: 'DDD', oppName: 'Delta name' };
const header = html => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
const controls = html => html.slice(html.indexOf('fw-card-controls'), html.indexOf('fw-card-controls') + 400);

test('GP is in the controls row between the window group and the Shooting group, not in the header', async () => {
  const { g, root, tick } = setup(null);
  g.FantasyCards.open('players', 'P1', {}); await tick();
  assert.ok(!header(root.innerHTML).includes('GP'));
  assert.match(controls(root.innerHTML), /aria-label="Sample window">.*?<\/div><b>0 GP<\/b><div class="fw-switch" role="group" aria-label="Card view"/);
});

test('player card: "vs FBT ↗" button with tooltip, opens the team card; hidden without an upcoming game', async () => {
  const { g, root, tick } = setup(GAME);
  g.FantasyCards.open('players', 'P1', {}); await tick();
  const h = header(root.innerHTML);
  assert.match(h, /<button class="fw-next" data-next="DDD" title="Open Delta Team card · Sat 14 Nov" aria-label="Open Delta Team card · Sat 14 Nov">vs FBT<span class="fw-arrow"> ↗<\/span><\/button>/);
  assert.ok(!h.includes('data-back'));
  root.buttons['data-next'].fire(); await tick();
  assert.ok(root.innerHTML.includes('TEAM / FANTASY') && root.innerHTML.includes('Delta Team'));
  const none = setup(null);
  none.g.FantasyCards.open('players', 'P1', {}); await none.tick();
  assert.ok(!none.root.innerHTML.includes('data-next'));
});

test('away game shows "@ FBT"', async () => {
  const { g, root, tick } = setup({ ...GAME, home: false });
  g.FantasyCards.open('players', 'P1', {}); await tick();
  assert.match(root.innerHTML, />@ FBT<span/);
});

test('team card opened from a player card shows "← Player One" and goes back; opened from a table it does not', async () => {
  const { g, root, tick } = setup(GAME);
  g.FantasyCards.open('players', 'P1', { win: 'last5' }); await tick();
  root.buttons['data-next'].fire(); await tick();
  assert.match(header(root.innerHTML), /data-back[^>]*>← Player One<\/button>/);
  assert.ok(!header(root.innerHTML).includes('data-next'));
  root.buttons['data-back'].fire(); await tick();
  assert.ok(root.innerHTML.includes('PLAYER / FANTASY') && root.innerHTML.includes('Player One'));
  const t = setup(GAME);
  t.g.FantasyCards.open('teams', 'DDD', {}); await t.tick();
  assert.ok(!t.root.innerHTML.includes('data-back'));
});

test('the button shares the close button rule and drops the arrow on narrow screens', () => {
  assert.match(css, /\.fw-close,\.fw-next\{background:#243143;color:#eef3f8;border:1px solid transparent;border-radius:6px;height:36px;cursor:pointer\}/);
  assert.match(css, /\.fw-next:hover,\.fw-next:focus-visible\{border-color:#ef3d25/);
  assert.match(css, /\.fw-next \.fw-arrow\{display:none\}\}/);
});
