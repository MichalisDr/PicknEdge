// Validates site/layout.json, the single source of the Fantasy card grids. Run: node --test tests/layout
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { METRICS } from '../../scripts/metrics/registry.mjs';
import { SUBS } from '../../scripts/metrics/zones.mjs';

const layout = JSON.parse(readFileSync(new URL('../../site/layout.json', import.meta.url), 'utf8'));
const ids = new Set(METRICS.map(m => m.id)), scopeOf = Object.fromEntries(METRICS.map(m => [m.id, m.scope]));
const NAMES = ['player.profile', 'team.profile', 'player.shooting', 'team.shooting'];
const int = v => Number.isInteger(v);

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
    assert.deepEqual(holes, []);
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
      const used = [b.metric, b.made, b.att, b.share, b.per100, ...(b.sub || []).map(s => s.metric)].filter(Boolean);
      assert.ok(b.metric, `${b.id} has no metric`);
      for (const id of used) {
        assert.ok(ids.has(id), `${b.id}: unknown metric ${id}`);
        assert.equal(scopeOf[id], scope === 'player' ? 'player' : 'team', `${b.id}: ${id} has the wrong scope`);
      }
      if (b.kind === 'zone' && scope === 'player') for (const k of ['made', 'att', 'share', 'per100']) assert.ok(b[k], `${b.id} needs ${k}`);
    }
  });
}

test('zone boxes, when a Shooting layout has them, use the six sub-areas of zones.mjs in order (the cards currently show none: the shot chart below carries the zones)', () => {
  for (const n of ['player.shooting', 'team.shooting']) {
    const zones = layout.layouts[n].boxes.filter(b => b.kind === 'zone');
    if (!zones.length) continue;
    assert.deepEqual(zones.map(b => b.zone), SUBS.map(s => s.key), n);
    assert.deepEqual(zones.map(b => b.label), SUBS.map(s => s.name), n);
  }
});

test('the stacked (narrow) order covers every box of every layout exactly once, in the stack order or (y, x)', async () => {
  const { stackOrder, dividers } = await import('../../site/layout-order.js');
  for (const name of NAMES) {
    const L = layout.layouts[name], order = stackOrder(L);
    assert.equal(order.length, L.boxes.length, name);
    assert.deepEqual([...order.map(b => b.id)].sort(), L.boxes.map(b => b.id).sort(), `${name}: each box exactly once`);
    if (L.stack) { assert.equal(L.stack.length, L.boxes.length, name + ': stack lists every box'); assert.equal(new Set(L.stack).size, L.stack.length, name + ': no id twice'); assert.ok(L.stack.every(id => L.boxes.some(b => b.id === id)), name + ': no unknown id'); assert.ok(order.every(Boolean)); }
    else for (let i = 1; i < order.length; i++) assert.ok(order[i].y > order[i - 1].y || (order[i].y === order[i - 1].y && order[i].x > order[i - 1].x), `${name}: order is (y, x)`);
    const rules = dividers(L), first = order[0].id;
    assert.ok([...rules].every(id => id !== first && L.boxes.some(b => b.id === id)), `${name}: dividers are on known boxes, never above the first row`);
  }
});
