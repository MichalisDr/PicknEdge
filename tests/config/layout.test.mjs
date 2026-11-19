// Validates site/config/layout.json, the single source of the stats block of the Fantasy cards. Run: node --test tests/config
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const layout = JSON.parse(readFileSync(new URL('../../site/config/layout.json', import.meta.url), 'utf8'));
const ids = new Set(METRICS.map(m => m.id)), scopeOf = Object.fromEntries(METRICS.map(m => [m.id, m.scope]));
const NAMES = ['player.profile', 'team.profile', 'player.shooting', 'team.shooting'];
const SIZES = [48, 32, 24, 20, 16];   // the type ladder of the stats block
const cellsOf = L => [L.hero, L.low, ...L.sections.flatMap(s => s.cells)].filter(Boolean);
const ofLayout = name => layout.layouts[name];

test('the four card layouts exist, each with a hero and sections of cells on the type ladder', () => {
  assert.deepEqual(Object.keys(layout.layouts).sort(), [...NAMES].sort());
  for (const n of NAMES) {
    const L = ofLayout(n);
    assert.ok(L.hero && L.sections.length > 0, n);
    for (const c of cellsOf(L)) assert.ok(SIZES.includes(c.size), `${n}: ${c.metric} size ${c.size}`);
    for (const s of L.sections) assert.ok(s.title && s.cells.length > 0, `${n}: section ${s.title}`);
  }
});
for (const name of NAMES) test(`${name}: every metric id exists in the registry, with the right scope; no metric twice`, () => {
  const scope = name.split('.')[0], cells = cellsOf(ofLayout(name));
  for (const c of cells) for (const id of [c.metric, ...(c.sub || []).map(s => s.metric)]) {
    assert.ok(ids.has(id), `${name}: unknown metric ${id}`);
    assert.equal(scopeOf[id], scope, `${name}: ${id} has the wrong scope`);
  }
  assert.equal(new Set(cells.map(c => c.metric)).size, cells.length, `${name}: a metric appears twice`);
});

test('player.profile: the agreed stat set and sizes (PIR hero, nsPIR low slot, ROLE / EFFICIENCY / PRODUCTION)', () => {
  const L = ofLayout('player.profile'), sec = Object.fromEntries(L.sections.map(s => [s.title, s.cells.map(c => [c.metric, c.size])]));
  assert.deepEqual([L.hero.metric, L.hero.size, L.hero.unit], ['pir', 48, '/g']);
  assert.deepEqual([L.low.metric, L.low.size, L.low.unit], ['nspir100', 20, '/100 poss']);
  assert.deepEqual(sec, {
    Role: [['min', 32], ['usg', 32]],
    Efficiency: [['ts_pct', 24], ['ftr', 24], ['tov_pct', 24], ['pf_g', 16]],
    Production: [['pts_g', 24], ['ast_g', 20], ['reb_g', 20], ['stocks_g', 20], ['fd_g', 16]],
  });
  assert.ok(!cellsOf(L).some(c => c.sub), 'single value each, no extra lines');
});
test('team.profile (proposal): DRtg hero, Pace low slot; DEFENSE, POSSESSION, OPPONENT OFFENSE; no Opp PTS off TO', () => {
  const L = ofLayout('team.profile'), sec = Object.fromEntries(L.sections.map(s => [s.title, s.cells.map(c => [c.metric, c.size])]));
  assert.deepEqual([L.hero.metric, L.hero.size, L.low.metric, L.low.size], ['drtg', 48, 'pace', 20]);
  assert.deepEqual(sec, {
    Defense: [['o_efg', 24], ['o_tov100', 24]],
    Possession: [['o_ftr', 24], ['t_dreb_pct', 24], ['t_oreb_pct', 24], ['t_stocks100', 24]],
    'Opponent offense': [['o_sc100', 20], ['o_ast100', 20], ['o_ast_pct', 20], ['o_fb100', 20]],
  });
  assert.ok(!cellsOf(L).some(c => c.metric === 'o_pot100'));
});
test('shooting layouts: eFG% hero with the kept sub lines, 2FG% / 3FG% / FT% at 24', () => {
  const L = ofLayout('player.shooting'), by = Object.fromEntries(cellsOf(L).map(c => [c.metric, c]));
  assert.deepEqual([L.hero.metric, L.hero.size], ['efg', 48]);
  assert.deepEqual(L.hero.sub, [{ metric: 'fga100', text: 'FGA {v} /100' }]);
  assert.deepEqual(by.fg3_pct.sub, [{ metric: 'a3_rate', text: '{v}% of FGA', zeroText: 'no 3PA' }]);
  assert.deepEqual(L.sections[0].cells.map(c => [c.metric, c.size]), [['fg2_pct', 24], ['fg3_pct', 24], ['ft_pct', 24]]);
});

/* ---------- the markup ---------- */
const byIdOf = digitsOf => Object.fromEntries(METRICS.map(m => [m.id, { ...m, format: { digits: digitsOf(m), suffix: m.kind === 'pct' ? '%' : '' } }]));
async function grid(name, view, byId, sel = null, players = true) {
  globalThis.fetch = async () => ({ ok: true, json: async () => layout });
  const { layoutGrid } = await import('../../site/fantasy/cards/metric-grid.js');
  return layoutGrid('P1', name, view, byId, sel, players);
}
const cell = (html, metric) => html.match(new RegExp(`<div class="cell[^"]*"[^>]*><button class="m [^"]*" data-metric="${metric}".*?</button></div>`, 's'))[0];

test('a cell is a button with data-metric, aria-pressed and a title; a missing value shows "–" and no unit; the selected one is aria-pressed', async () => {
  const byId = byIdOf(() => 1), view = { get: (id, metric) => ({ value: metric === 'ts_pct' ? NaN : metric === 'pir' ? 21.5 : 5 }), row: () => ({}) };
  const html = await grid('player.profile', view, byId, 'pir');
  const ts = cell(html, 'ts_pct'), pir = cell(html, 'pir');
  assert.ok(ts.includes('<b>–</b>') && !ts.includes('<u>') && ts.includes('aria-pressed="false"') && ts.includes('title="'));
  assert.ok(pir.includes('<b>21.5</b><u>/g</u>') && pir.includes('aria-pressed="true"') && pir.includes('class="m t48"'));
  assert.ok(html.includes('class="sb"') && html.includes('class="sb-grid"') && !html.includes('fw-metric'));
  assert.ok(!html.includes('Offensive Load') && !html.includes('cTOV%') && !html.includes('o_pot100'));
});
test('shooting: sub lines are kept; a zero 3PA share shows "no 3PA"; team cards carry the rank chip and the eval class', async () => {
  const byId = byIdOf(m => m.digits);
  const shoot = await grid('player.shooting', { get: (id, metric) => ({ value: metric === 'a3_rate' ? 0 : metric === 'fga100' ? 24.64 : 40 }), row: () => ({}) }, byId);
  assert.ok(cell(shoot, 'efg').includes('<span class="sub">FGA 24.6 /100</span>'));
  assert.ok(cell(shoot, 'fg3_pct').includes('<span class="sub">no 3PA</span>'));
  assert.ok(cell(shoot, 'fg2_pct').includes('<span class="sub">0.0% of FGA</span>') || cell(shoot, 'fg2_pct').includes('of FGA</span>'));
  const keys = ['A', 'B', 'C'], values = { A: 100, B: 110, C: 120 };
  const team = await grid('team.profile', { keys, get: (k, metric) => ({ value: values[k] ?? 110 }), row: () => ({}) }, byIdOf(m => m.digits), null, false);
  assert.ok(/<span class="rk">#\d+<\/span>/.test(cell(team, 'drtg')) && /class="m t48 ev-(good|avg|bad|neutral)"/.test(cell(team, 'drtg')));
});

test('the last group of both Profile cards is a full-width row (first cell in the left column); Production has 4 cells to the right of PTS', () => {
  for (const n of ['player.profile', 'team.profile']) assert.deepEqual(ofLayout(n).sections.map(s => !!s.full), [false, false, true], n);
  assert.deepEqual(ofLayout('player.profile').sections.at(-1).cells.map(c => c.metric).slice(0, 2), ['pts_g', 'ast_g']);
  assert.ok(!ofLayout('player.shooting').sections.some(s => s.full) && !ofLayout('team.shooting').sections.some(s => s.full));
});
test('units are separate small elements: percent metrics show a % unit, per-game metrics /g, nsPIR /100 poss, MIN none, missing none', async () => {
  const byId = byIdOf(() => 1), view = { get: (id, metric) => ({ value: metric === 'fd_g' ? NaN : 5 }), row: () => ({}) };
  const html = await grid('player.profile', view, byId);
  for (const [m, u] of [['usg', '%'], ['ts_pct', '%'], ['ftr', '%'], ['tov_pct', '%'], ['pir', '/g'], ['pts_g', '/g'], ['ast_g', '/g'], ['reb_g', '/g'], ['stocks_g', '/g'], ['pf_g', '/g'], ['nspir100', '/100 poss']])
    assert.ok(cell(html, m).includes(`<b>5.0</b><u>${u}</u>`) || cell(html, m).includes(`<b>5.0</b><u>${u}</u>`.replace('5.0', '5.0')), `${m} unit ${u}`);
  assert.ok(!cell(html, 'min').includes('<u>'));
  assert.ok(cell(html, 'fd_g').includes('<b>–</b></span>') && !cell(html, 'fd_g').includes('<u>'));
  assert.ok(!/<b>[^<]*%<\/b>/.test(html), 'no unit inside the value text');
});
