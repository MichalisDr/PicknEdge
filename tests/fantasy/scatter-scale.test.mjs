// The shared scale of the gallery scatters: a fixed step per metric (axes.js), the ends from the data, real limits, equal range for the x = y chart, logo separation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisScale, equalScale, separate } from '../../site/fantasy/gallery/scale.js';
import { axisRule } from '../../site/fantasy/gallery/axes.js';
import { CHARTS } from '../../site/fantasy/gallery/charts.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const SETS = [[98.2, 101.5, 104.9, 110.3], [13.1, 19.4], [-4, 7], [105.4, 125.4], [71.6, 77.3], [48.3, 60.4], [70, 70.2], [3, 400]];
const STEPS = { pace: 1, drtg: 5, o_efg: 2, o_exp_efg: 2, o_tov100: 2, t_dreb_pct: 2, o_a3_rate: 2, o_fg3_pct: 2, o_rim_rate: 2, o_zs_rim_pct: 5, cr: 1, pir: 5, sa100: 5, ts_pct: 5 };

test('every axis of every chart has its declared step, and only two metrics have a limit: credits (floor 4) and rim FG% (ceiling 100)', () => {
  assert.deepEqual([...new Set(CHARTS.flatMap(c => [c.x, c.y]))].sort(), Object.keys(STEPS).sort());
  for (const [id, step] of Object.entries(STEPS)) {
    assert.equal(axisRule(id).step, step, id);
    assert.deepEqual([axisRule(id).floor, axisRule(id).ceiling], [id === 'cr' ? 4 : undefined, id === 'o_zs_rim_pct' ? 100 : undefined], id);
  }
  assert.throws(() => axisRule('efg'), /no axis step declared/);
  assert.throws(() => axisScale([1, 2]), /declared step/);
  for (const c of CHARTS.filter(c => c.equal)) assert.equal(axisRule(c.x).step, axisRule(c.y).step, 'an x = y chart has one step');
});

test('the step never depends on the data: a narrow and a wide range get the same step, and a tick at every multiple of it', () => {
  for (const step of [1, 2, 5]) for (const vals of [...SETS, [50.1, 50.2], [-300, 900]]) {
    const s = axisScale(vals, { step });
    assert.equal(s.step, step);
    assert.equal(s.ticks.length, Math.round((s.hi - s.lo) / step) + 1);
    s.ticks.forEach((t, i) => { near(t, s.lo + i * step); near(t / step, Math.round(t / step), 1e-6); });
    assert.deepEqual(s.thumb, s.ticks.filter((_, i) => i % 2 === 0), 'every second tick');
  }
});

test('the ends: the multiple before the lowest and after the highest value, nothing more; no forced zero, no percentage margin', () => {
  for (const step of [1, 2, 5]) for (const vals of SETS) {
    const s = axisScale(vals, { step }), lo = Math.min(...vals), hi = Math.max(...vals);
    assert.ok(s.lo < lo && s.hi > hi, 'strictly inside');
    assert.ok(lo - s.lo <= step + 1e-9 && s.hi - hi <= step + 1e-9, `${vals}: gaps of at most one step (${step})`);
  }
  assert.ok(axisScale([98.2, 110.3], { step: 5 }).lo > 0, 'no zero baseline');
});

test('an extreme value that sits exactly on a multiple goes one more step', () => {
  assert.deepEqual([axisScale([100, 110], { step: 5 }).lo, axisScale([100, 110], { step: 5 }).hi], [95, 115]);
  assert.equal(axisScale([42.4, 100], axisRule('ts_pct')).hi, 105, 'TS% has no ceiling');
  assert.equal(axisScale([30, 89.3], axisRule('ts_pct')).lo, 25);
  assert.equal(axisScale([0, 20], axisRule('sa100')).lo, -5, 'and no floor');
});

test('real limits: rim FG% never goes above 100; credits start at 4', () => {
  for (const top of [97, 99.9, 100]) assert.equal(axisScale([62, top], axisRule('o_zs_rim_pct')).hi, 100, String(top));
  assert.equal(axisScale([62, 94.9], axisRule('o_zs_rim_pct')).hi, 95);
  assert.equal(axisScale([6.1, 7], axisRule('cr')).lo, 4);
  assert.equal(axisScale([4, 20.2], axisRule('cr')).lo, 4);
});

test('digits follow the step so tick labels are exact', () => {
  assert.equal(axisScale([95, 120], { step: 5 }).digits, 0);
  assert.equal(axisScale([1.1, 2.4], { step: 0.5 }).digits, 1);
  assert.equal(axisScale([0.461, 0.58], { step: 0.025 }).digits, 3);
});

test('a single value still gets a usable axis', () => {
  const s = axisScale([52, 52], { step: 2 });
  assert.ok(s.hi > s.lo && s.ticks.length >= 2);
});

test('equal scale: both axes share range and ticks, and the diagonal is exactly 45° on the square plot', () => {
  const xs = [49, 51, 53], ys = [47, 50, 56], [sx, sy] = equalScale(xs, ys, axisRule('o_efg'));
  assert.deepEqual(sx, sy);
  assert.deepEqual([sx.lo, sx.hi, sx.step], [46, 58, 2]);   // from both metrics
  const model = { title: 't', xTitle: 'x', yTitle: 'y', equal: true, fav: { x: 1, y: 1 }, sx, sy, avg: null, pts: [] };
  const svg = drawScatter(model, 640, false), d = svg.match(/class="fc-diag" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/).slice(1).map(Number);
  near(d[2] - d[0], d[1] - d[3], 0.2);   // run = rise (svg y points down), to the rounding of the coordinates
});

test('separate: overlapping logos move apart by the smallest push, others stay', () => {
  const out = separate([{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 300, y: 300 }], 30);
  near(Math.hypot(out[1].x - out[0].x, out[1].y - out[0].y), 30, 1e-3);
  near((out[0].x + out[1].x) / 2, 105, 1e-3);   // symmetric push, centre of the pair unchanged
  assert.deepEqual(out[2], { x: 300, y: 300 });
});

test('separate: identical points and crowds end up apart', () => {
  const crowd = [{ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 52, y: 51 }, { x: 55, y: 49 }], out = separate(crowd, 24);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) assert.ok(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) >= 24 - 1e-3);
});
