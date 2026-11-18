// The shared scale of the gallery scatters: padding, 4–6 round ticks, no forced zero, equal range for the x = y chart, logo separation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisScale, equalScale, separate } from '../../site/fantasy/gallery/scale.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

const STEP_OK = step => { const m = step / Math.pow(10, Math.floor(Math.log10(step))); return [1, 2, 2.5, 5].some(x => Math.abs(x - m) < 1e-6); };
const SETS = [[98.2, 101.5, 104.9, 110.3], [0.46, 0.58], [13.1, 19.4], [1000, 25000], [3.001, 3.004], [-4, 7], [105.4, 125.4], [71.6, 77.3], [48.3, 60.4]];

test('the axis ends at the next round tick beyond the data, with no forced zero and no percentage margin: every gap is smaller than one step', () => {
  for (const vals of SETS) {
    const s = axisScale(vals), lo = Math.min(...vals), hi = Math.max(...vals);
    assert.ok(s.lo < lo && s.hi > hi, 'strictly inside');
    assert.ok(lo - s.lo < s.step + 1e-9 && s.hi - hi < s.step + 1e-9, `${vals}: gaps under one step (${s.step})`);
    assert.ok(STEP_OK(s.step), `round step ${s.step}`);
  }
  assert.ok(axisScale([98.2, 110.3]).lo > 0, 'no zero baseline');
});

test('an extreme value that sits exactly on a tick goes one more step', () => {
  const s = axisScale([100, 110]);
  assert.ok(s.lo < 100 && s.hi > 110);
  assert.ok(100 - s.lo <= s.step && s.hi - 110 <= s.step);
});

test('the opened card has 6 to 8 ticks when the steps allow (otherwise the nearest count), edges and ticks are round numbers, thumbnails show every second tick', () => {
  for (const vals of SETS) {
    const s = axisScale(vals);
    assert.ok(s.ticks.length >= 5 && s.ticks.length <= 9, `${vals}: ${s.ticks}`);
    assert.ok(Math.abs(s.ticks[0] - s.lo) < 1e-9 && Math.abs(s.ticks.at(-1) - s.hi) < 1e-9, 'the axis starts and ends on a tick');
    for (const t of s.ticks) assert.ok(Math.abs(t / s.step - Math.round(t / s.step)) < 1e-6, `${t} is a multiple of ${s.step}`);
    assert.ok(s.thumb.length >= 2 && s.thumb.length <= 4 && s.thumb.every(t => s.ticks.includes(t)), `${vals} thumb: ${s.thumb}`);
  }
  assert.ok(axisScale([66.3, 78.2]).ticks.length >= 6);
});

test('the step suits the metric: Pace by 1 or 2, DRtg by 5, TOV per 100 by 1 or 2, percentages by 2, 2.5 or 5', () => {
  assert.ok([1, 2].includes(axisScale([71.6, 72.4, 76.5, 77.3]).step), 'pace');
  assert.equal(axisScale([105.4, 112, 119.7, 125.4]).step, 5);   // DRtg
  assert.ok([1, 2].includes(axisScale([13.0, 16, 19.8]).step), 'tov');
  assert.ok([2, 2.5, 5].includes(axisScale([48.3, 54.6, 60.4]).step), 'percentage');
});

test('digits follow the step so tick labels are exact', () => {
  assert.equal(axisScale([95, 120]).digits, 0);
  assert.equal(axisScale([0.461, 0.58]).digits, axisScale([0.461, 0.58]).step === 0.025 ? 3 : 2);
  assert.equal(axisScale([11.3, 19.6]).digits, 0);
  assert.equal(axisScale([1.1, 2.4]).digits, String(axisScale([1.1, 2.4]).step).split('.')[1]?.length || 0);
});

test('a single value still gets a usable axis', () => {
  const s = axisScale([52, 52]);
  assert.ok(s.hi > s.lo && s.ticks.length >= 2);
});

test('equal scale: both axes share range and ticks, and the diagonal is exactly 45° on the square plot', () => {
  const xs = [0.49, 0.51, 0.53], ys = [0.47, 0.5, 0.56], [sx, sy] = equalScale(xs, ys);
  assert.deepEqual(sx, sy);
  assert.ok(sx.lo < 0.47 && sx.hi > 0.56);   // from both metrics
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
