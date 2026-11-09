// Efficient Scorers Venn, hand-checked. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { venn } from '../../scripts/metrics/venn.mjs';

test('venn: percentile cut-offs and region counts (hand-checked, 10 players)', () => {
  // values[0] = i (top 30% = 7, 8, 9), values[1] = 9 - i (bottom 30% = 0, 1, 2 -> i = 7, 8, 9), values[2] = i % 5 (top 30%: cut 3 -> i = 3, 4, 8, 9)
  const items = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, values: [i, 9 - i, i % 5] }));
  items.push({ id: 'missing', values: [1, 2, NaN] });
  const r = venn(items, [{ dir: 'high', pct: 30 }, { dir: 'low', pct: 30 }, { dir: 'high', pct: 30 }]);
  assert.equal(r.n, 10); assert.equal(r.unavailable, 1);
  assert.deepEqual(r.cuts, [7, 2, 3]);
  assert.deepEqual(r.counts, [3, 3, 4]);
  assert.deepEqual(Object.fromEntries(Object.entries(r.regions).filter(([, v]) => v.n).map(([k, v]) => [k, v.ids])), { '000': ['p0', 'p1', 'p2', 'p5', 'p6'], '001': ['p3', 'p4'], '110': ['p7'], '111': ['p8', 'p9'] });
});
