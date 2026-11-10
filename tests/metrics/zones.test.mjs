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
  for (const m of METRICS.filter(m => /^(t_|o_)?z[sm]?_.*_pct$/.test(m.id))) {
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

test('player sub-area detail: makes, attempts, share of classified shots, attempts per 100 possessions', () => {
  const row = { played: 1, poss_off_on: 50, ...fixture('') };
  const total = ORDER.reduce((n, _, i) => n + i + 2, 0);                 // 90 classified attempts
  assert.equal(total, 90);
  let checked = 0;
  for (const [key, idx] of Object.entries(GROUPS).filter(([k]) => k.startsWith('zs_'))) {
    const made = idx.reduce((n, i) => n + i + 1, 0), att = idx.reduce((n, i) => n + i + 2, 0), v = id => evaluate(METRICS.find(m => m.id === id), [row]).value;
    assert.equal(v(key + '_made'), made);
    assert.equal(v(key + '_att'), att);
    assert.ok(Math.abs(v(key + '_share') - 100 * att / total) < 1e-9, key);
    assert.ok(Math.abs(v(key + '_a100') - 100 * att / 50) < 1e-9, key);
    checked++;
  }
  assert.equal(checked, 6);
});
test('sub-area shares of a window sum attempts first (not an average of shares)', () => {
  const m = METRICS.find(m => m.id === 'zs_rim_share');
  const zero = Object.fromEntries(ORDER.flatMap(k => [['z_' + k + '_a', 0], ['z_' + k + '_m', 0]]));
  const g1 = { ...zero, played: 1, z_rim_a: 1, z_rim_m: 1, z_paint_a: 1 }, g2 = { ...zero, played: 1, z_paint_a: 9 };
  assert.equal(evaluate(m, [g1, g2]).value, 100 * 1 / 11);
});

test('opponent sub-area makes and attempts for teams (neutral direction)', () => {
  const row = { played: 1, ...fixture('o_') };
  let checked = 0;
  for (const [key, idx] of Object.entries(GROUPS).filter(([k]) => k.startsWith('zs_'))) {
    const made = idx.reduce((n, i) => n + i + 1, 0), att = idx.reduce((n, i) => n + i + 2, 0), v = id => METRICS.find(m => m.id === id);
    assert.equal(evaluate(v('o_' + key + '_made'), [row]).value, made);
    assert.equal(evaluate(v('o_' + key + '_att'), [row]).value, att);
    assert.equal(v('o_' + key + '_made').scope, 'team');
    assert.equal(v('o_' + key + '_att').direction, 0);
    checked++;
  }
  assert.equal(checked, 6);
});

test('Mid area detail and shooting makes/attempts (player and opponent), neutral direction', () => {
  const row = { played: 1, poss_off_on: 50, ...fixture(''), ...fixture('o_'), m2: 7, a2: 10, m3: 3, a3: 8, m1: 4, a1: 5, o_m2: 6, o_a2: 12, o_m3: 2, o_a3: 9 };
  const v = id => evaluate(METRICS.find(m => m.id === id), [row]).value, mid = GROUPS.zm_mid;
  const made = mid.reduce((n, i) => n + i + 1, 0), att = mid.reduce((n, i) => n + i + 2, 0), total = ORDER.reduce((n, _, i) => n + i + 2, 0);
  assert.equal(v('zm_mid_made'), made); assert.equal(v('zm_mid_att'), att);
  assert.ok(Math.abs(v('zm_mid_share') - 100 * att / total) < 1e-9); assert.ok(Math.abs(v('zm_mid_a100') - 100 * att / 50) < 1e-9);
  assert.equal(v('o_zm_mid_made'), made); assert.equal(v('o_zm_mid_att'), att);
  assert.deepEqual([v('fg2_made'), v('fg2_att'), v('fg3_made'), v('fg3_att'), v('ft_made'), v('ft_att')], [7, 10, 3, 8, 4, 5]);
  assert.deepEqual([v('o_fg2_made'), v('o_fg2_att'), v('o_fg3_made'), v('o_fg3_att')], [6, 12, 2, 9]);
  for (const id of ['zm_mid_made', 'o_zm_mid_att', 'fg3_att', 'o_fg2_made', 'ft_made']) assert.equal(METRICS.find(m => m.id === id).direction, 0, id);
});
