// Zone model and zone FG% metrics, hand-checked. Run: node --test tests/metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../../scripts/metrics/zones.mjs';
import { METRICS } from '../../scripts/metrics/registry.mjs';
import { evaluate } from '../../scripts/metrics/engine.mjs';

test('classify: hand-placed shots land in the expected zone', () => {
  const at = (x, y, three) => classify(x, y, three);
  assert.equal(at(0, 0, false), 'rim');
  assert.equal(at(-100, -100, false), 'paint');      // behind the hoop, inside the lane
  assert.equal(at(62, 238, false), 'paint');         // real shot from game 1
  assert.equal(at(357, 25, false), 'baseR');         // theta 4 degrees < 12.1 (corner junction ray)
  assert.equal(at(0, 600, false), 'midC');
  assert.equal(at(-600, 300, false), 'midL');
  assert.equal(at(700, 100, true), 'cornerR');       // y <= 141.5
  assert.equal(at(-700, 100, true), 'cornerL');
  assert.equal(at(0, 700, true), 'arcC');
  assert.equal(at(500, 600, true), 'arcR');          // theta 50 degrees < 67
  assert.equal(at(NaN, 5, true), null);
});

// zone i (0..11, in the order below) has i+2 attempts and i+1 makes
const ORDER = ['rim', 'paint', 'midL', 'midC', 'midR', 'baseL', 'baseR', 'arcL', 'arcC', 'arcR', 'cornerL', 'cornerR'];
const GROUPS = { // written out by hand, independent of zones.mjs
  zs_rim: [0], zs_paint: [1], zs_mid: [2, 3, 4], zs_base: [5, 6], zs_arc: [7, 8, 9], zs_corner: [10, 11],
  zm_paint: [0, 1], zm_mid: [2, 3, 4, 5, 6], zm_3p: [7, 8, 9, 10, 11],
};
const fixture = prefix => Object.fromEntries(ORDER.flatMap((k, i) => [[`${prefix}z_${k}_a`, i + 2], [`${prefix}z_${k}_m`, i + 1]]));
const pct = idx => 100 * idx.reduce((n, i) => n + i + 1, 0) / idx.reduce((n, i) => n + i + 2, 0);

test('zone FG% for zones, sub-areas and areas, for players, own team and opponent', () => {
  let checked = 0;
  for (const m of METRICS.filter(m => /^(t_|o_)?z[sm]?_/.test(m.id))) {
    const opp = m.id.startsWith('o_'), id = m.id.replace(/^(t_|o_)/, '');
    const key = id.replace(/_pct$/, '');
    const idx = GROUPS[key] ?? [ORDER.indexOf(key.replace(/^z_/, ''))];
    assert.ok(idx.every(i => i >= 0), m.id);
    const row = { played: 1, games: 1, ...fixture(''), ...fixture('o_') };
    assert.ok(Math.abs(evaluate(m, [row]).value - pct(idx)) < 1e-9, m.id);
    assert.equal(opp, m.scope === 'team' && m.id.startsWith('o_'));
    checked++;
  }
  assert.equal(checked, 3 * (12 + 6 + 3));
});

test('zone FG% sums made and attempts over games, not an average of rates', () => {
  const m = METRICS.find(m => m.id === 'z_rim_pct');
  assert.equal(evaluate(m, [{ played: 1, z_rim_m: 1, z_rim_a: 1 }, { played: 1, z_rim_m: 0, z_rim_a: 9 }]).value, 10);
});
