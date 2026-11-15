// Validates site/config/layout.json, the single source of the Fantasy card grids. Run: node --test tests/config
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { METRICS } from '../../scripts/metrics/registry.mjs';

const layout = JSON.parse(readFileSync(new URL('../../site/config/layout.json', import.meta.url), 'utf8'));
const ids = new Set(METRICS.map(m => m.id)), scopeOf = Object.fromEntries(METRICS.map(m => [m.id, m.scope]));
const NAMES = ['player.profile', 'team.profile', 'player.shooting', 'team.shooting'];
const int = v => Number.isInteger(v);
/* Cells left empty on purpose until the design is approved: player.profile lost cTOV% (x 6, y 8, w 6, h 2) and nothing fills its place yet. */
const PENDING_HOLES = { 'player.profile': ['6,8', '7,8', '8,8', '9,8', '10,8', '11,8', '6,9', '7,9', '8,9', '9,9', '10,9', '11,9'] };

test('the four card layouts exist on a 24-column grid', () => {
  assert.equal(layout.cols, 24);
  assert.deepEqual(Object.keys(layout.layouts).sort(), [...NAMES].sort());
  for (const n of NAMES) assert.ok(int(layout.layouts[n].rows) && layout.layouts[n].rows > 0, n);
});

for (const name of NAMES) {
  const L = layout.layouts[name], scope = name.split('.')[0];
  test(`${name}: every box is inside the grid and has integer cells`, () => {
    for (const b of L.boxes) {
      assert.ok([b.x, b.y, b.w, b.h].every(int), b.id);
      assert.ok(b.x >= 0 && b.y >= 0 && b.w >= 1 && b.h >= 1 && b.x + b.w <= layout.cols && b.y + b.h <= L.rows, `${b.id} is outside ${layout.cols}x${L.rows}`);
    }
    assert.equal(new Set(L.boxes.map(b => b.id)).size, L.boxes.length, 'duplicate box ids');
  });
  test(`${name}: no overlaps and no holes (the boxes cover every cell exactly once)`, () => {
    const cover = Array.from({ length: L.rows }, () => Array(layout.cols).fill(null));
    for (const b of L.boxes) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      assert.equal(cover[y][x], null, `${b.id} overlaps ${cover[y][x]} at ${x},${y}`);
      cover[y][x] = b.id;
    }
    const holes = []; cover.forEach((row, y) => row.forEach((c, x) => { if (c === null) holes.push(`${x},${y}`); }));
    assert.deepEqual(holes, PENDING_HOLES[name] || []);
  });
  test(`${name}: lines lie on grid lines inside the grid`, () => {
    for (const l of L.lines) {
      assert.ok(l.o === 'h' || l.o === 'v');
      assert.ok([l.x, l.y, l.n].every(int) && l.n >= 1, JSON.stringify(l));
      assert.ok(l.x >= 0 && l.y >= 0 && l.x <= layout.cols && l.y <= L.rows, JSON.stringify(l));
      if (l.o === 'h') assert.ok(l.x + l.n <= layout.cols, JSON.stringify(l)); else assert.ok(l.y + l.n <= L.rows, JSON.stringify(l));
    }
  });
  test(`${name}: every metric id exists in the registry, with the right scope`, () => {
    for (const b of L.boxes) {
      const used = [b.metric, ...(b.sub || []).map(s => s.metric)].filter(Boolean);
      assert.ok(b.metric, `${b.id} has no metric`);
      for (const id of used) {
        assert.ok(ids.has(id), `${b.id}: unknown metric ${id}`);
        assert.equal(scopeOf[id], scope === 'player' ? 'player' : 'team', `${b.id}: ${id} has the wrong scope`);
      }
    }
  });
}

test('the stacked (narrow) order covers every box of every layout exactly once, in the stack order or (y, x)', async () => {
  const { stackOrder } = await import('../../site/core/stack-order.js');
  for (const name of NAMES) {
    const L = layout.layouts[name], order = stackOrder(L);
    assert.equal(order.length, L.boxes.length, name);
    assert.deepEqual([...order.map(b => b.id)].sort(), L.boxes.map(b => b.id).sort(), `${name}: each box exactly once`);
    if (L.stack) { assert.equal(L.stack.length, L.boxes.length, name + ': stack lists every box'); assert.equal(new Set(L.stack).size, L.stack.length, name + ': no id twice'); assert.ok(L.stack.every(id => L.boxes.some(b => b.id === id)), name + ': no unknown id'); assert.ok(order.every(Boolean)); }
    else for (let i = 1; i < order.length; i++) assert.ok(order[i].y > order[i - 1].y || (order[i].y === order[i - 1].y && order[i].x > order[i - 1].x), `${name}: order is (y, x)`);
  }
});

test('player.profile (Batch 4): no Offensive Load, no cTOV%; TS% in the old Load position (provisional); PIR and TOV% as before; the empty area is the old cTOV% one', async () => {
  const L = layout.layouts['player.profile'], by = Object.fromEntries(L.boxes.map(b => [b.id, b]));
  assert.ok(!by.load && !by.ctov && !L.stack.includes('load') && !L.stack.includes('ctov'));
  assert.ok(!L.boxes.some(b => [b.metric, ...(b.sub || []).map(s => s.metric)].some(m => ['load', 'bc', 'ctov', 'tov100', 'efg'].includes(m))), 'no Load / Box Creation / cTOV% / TOV per 100 / eFG% tile or line');
  assert.deepEqual(by.ts, { id: 'ts', metric: 'ts_pct', label: 'TS%', x: 6, y: 4, w: 6, h: 4 });
  assert.deepEqual(L.stack, ['pir', 'min', 'ftr', 'usg', 'ts', 'pts100', 'tov_pct', 'ast100', 'reb100', 'fd100', 'fc100'], 'ts sits where load was');
  assert.deepEqual(L.stack.slice().sort(), L.boxes.map(b => b.id).sort(), 'the stack list matches the boxes');
  assert.deepEqual([by.pir.x, by.pir.y, by.pir.w, by.pir.h, by.pir.unit, by.pir.sub], [6, 0, 12, 4, '/g', [{ metric: 'pir_min', unit: '/m' }, { metric: 'nspir100', label: 'nsPIR', unit: ' /100 poss', side: true }]]);
  assert.deepEqual([by.tov_pct.metric, by.tov_pct.x, by.tov_pct.y, by.tov_pct.w, by.tov_pct.h, by.tov_pct.sub], ['tov_pct', 0, 8, 6, 2, [{ metric: 'tov_g', unit: '/g' }]]);
  assert.equal(L.rows, 10); assert.equal(layout.cols, 24); assert.equal(L.boxes.length, 11);
});

test('the TS% tile shows the normal empty value when a player has no ts_pct, and the value otherwise', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => layout });
  const { layoutGrid } = await import('../../site/fantasy/cards/metric-grid.js');
  const byId = Object.fromEntries(METRICS.map(m => [m.id, { ...m, format: { digits: 1, suffix: m.id === 'ts_pct' ? '%' : '' } }]));
  const grid = value => layoutGrid('P1', 'player.profile', { get: (id, metric) => ({ value: metric === 'ts_pct' ? value : 5 }), row: () => ({}) }, byId, null, true);
  const missing = await grid(NaN), has = await grid(61.234);
  const tile = h => h.match(/<button class="fw-metric[^>]*data-metric="ts_pct".*?<\/button>/s)[0];
  assert.ok(tile(missing).includes('<strong>—</strong>') && tile(missing).includes('TS%'));
  assert.ok(tile(has).includes('61.2%') && tile(has).includes('TS%'));
  assert.ok(!has.includes('Offensive Load') && !has.includes('cTOV%'));
});
