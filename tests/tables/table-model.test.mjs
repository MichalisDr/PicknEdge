// Table helpers (site/table-model.js) with hand-checked numbers. Run: node --test tests/tables
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../../site/table-model.js');

test('rank: 1 = best by direction; ties share the position; missing values are ignored', () => {
  const l = [10, 20, 20, 30, null, NaN];
  assert.deepEqual(M.rankOf(l, 30, 1), { position: 1, fromBottom: 4, n: 4 });
  assert.deepEqual(M.rankOf(l, 20, 1), { position: 2, fromBottom: 2, n: 4 });
  assert.deepEqual(M.rankOf(l, 10, -1), { position: 1, fromBottom: 4, n: 4 });   // lower is better
  assert.deepEqual(M.rankOf(l, 30, 0), { position: 1, fromBottom: 4, n: 4 });    // neutral: highest = #1
  assert.equal(M.rankOf(l, null, 1), null);
});
test('quarter: top and bottom quarter of the pool (20 teams: 5 each)', () => {
  const l = Array.from({ length: 20 }, (_, i) => i + 1);
  const q = v => M.quarter(M.rankOf(l, v, 1));
  assert.equal(q(20), 'top'); assert.equal(q(16), 'top'); assert.equal(q(15), null); assert.equal(q(6), null); assert.equal(q(5), 'bottom'); assert.equal(q(1), 'bottom');
});
test('percentile: share of the other values beaten, ties count half, direction aware', () => {
  const l = [1, 2, 3, 4, 5];
  assert.equal(M.percentile(l, 5, 1), 1); assert.equal(M.percentile(l, 1, 1), 0); assert.equal(M.percentile(l, 3, 1), 0.5);
  assert.equal(M.percentile(l, 1, -1), 1); assert.equal(M.percentile([1, 2, 2, 3], 2, 1), 0.5);
  assert.equal(M.percentile([7], 7, 1), 0.5); assert.equal(M.percentile(l, null, 1), null);
});
test('first click sorts best end first; missing values (and "few shots") always last', () => {
  assert.equal(M.firstDirection(1), 'desc'); assert.equal(M.firstDirection(-1), 'asc'); assert.equal(M.firstDirection(0), 'desc');
  const v = { a: 5, b: null, c: 9, d: 1, e: undefined };
  assert.deepEqual(M.order(Object.keys(v), id => v[id], 'desc'), ['c', 'a', 'd', 'b', 'e']);
  assert.deepEqual(M.order(Object.keys(v), id => v[id], 'asc'), ['d', 'a', 'c', 'b', 'e']);
});
test('combined rank: mean percentile of the selected columns over the pool, nulls skipped', () => {
  const pool = ['a', 'b', 'c'];
  const x = new Map([['a', 1], ['b', 2], ['c', 3]]), y = new Map([['a', 10], ['b', null], ['c', 30]]);   // y lower is better
  const r = M.combined(pool, [{ dir: 1, values: x }, { dir: -1, values: y }], pool);
  assert.equal(r.get('a'), (0 + 1) / 2);   // x: 0, y (lower better, 10 best of two values): 1
  assert.equal(r.get('b'), 0.5);           // x: 0.5 only
  assert.equal(r.get('c'), (1 + 0) / 2);
});
test('first column width: longest name, within [min, cap]', () => {
  const f = { min: 150, cap: 220, charPx: 7.4, pad: 30 };
  assert.equal(M.firstColWidth(['Ab'], f), 150);
  assert.equal(M.firstColWidth(['x'.repeat(20)], f), Math.ceil(20 * 7.4 + 30));
  assert.equal(M.firstColWidth(['x'.repeat(60)], f), 220);
});
