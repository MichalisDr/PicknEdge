// The shared scale of the gallery scatters: padding, 4–6 round ticks, no forced zero, equal range for the x = y chart, logo separation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisScale, equalScale, niceTicks, separate } from '../../site/fantasy/gallery/scale.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('axis fits the data with a small padding and does not force zero', () => {
  const s = axisScale([98.2, 101.5, 104.9, 110.3]);
  assert.ok(s.lo < 98.2 && s.hi > 110.3, 'padded on both sides');
  assert.ok(s.lo > 85 && s.hi < 130, 'padding is small');
  assert.ok(s.lo > 0, 'no zero baseline');
});

test('4 to 10 round ticks (6 to 8 when the range allows) inside the domain (opened card), at most 4 in thumbnails, for ranges of any size', () => {
  for (const vals of [[98.2, 110.3], [0.46, 0.58], [13.1, 19.4], [1000, 25000], [3.001, 3.004], [-4, 7]]) {
    const s = axisScale(vals), { step } = niceTicks(s.lo, s.hi);
    assert.ok(s.ticks.length >= 4 && s.ticks.length <= 10, `${vals}: ${s.ticks}`);
    assert.ok(s.thumb.length >= 2 && s.thumb.length <= 4, `${vals} thumb: ${s.thumb}`);
    assert.ok(s.ticks.every(t => t >= s.lo - 1e-9 && t <= s.hi + 1e-9));
    assert.ok(Math.abs(s.ticks[0] - s.lo) < 1e-9 && Math.abs(s.ticks.at(-1) - s.hi) < 1e-9, 'the axis starts and ends on a tick');
    const mant = step / Math.pow(10, Math.floor(Math.log10(step)));
    assert.ok([1, 2, 5].some(m => Math.abs(m - mant) < 1e-6), `round step ${step}`);
  }
});

test('the step suits the metric: Pace by 1 or 2, DRtg by 5, TOV per 100 by 1 or 2, percentages by 2 or 5', () => {
  const step = vals => { const t = axisScale(vals).ticks; return +(t[1] - t[0]).toFixed(6); };
  assert.ok([1, 2].includes(step([71.6, 72.4, 76.5, 77.3])), 'pace');
  assert.equal(step([105.4, 112, 119.7, 125.4]), 5);   // DRtg
  assert.ok(axisScale([66.3, 71, 74, 78.2]).ticks.length >= 6, 'at least 6 ticks for a typical range');
  assert.ok([1, 2].includes(step([13.0, 16, 19.8])), 'tov');
  assert.ok([2, 5].includes(step([48.3, 54.6, 60.4])), 'percentage');
});

test('digits follow the step so tick labels are exact', () => {
  assert.equal(axisScale([95, 120]).digits, 0);
  assert.equal(axisScale([0.46, 0.58]).digits, 2);
});

test('the empty margin is 4.5% plus the rounding to a fine step: about 10% of the axis (up to 20% when the fine steps cannot land closer), never a coarse step', () => {
  for (const vals of [[105.4, 125.4], [71.6, 77.3], [13.0, 19.8], [48.3, 60.4]]) {
    const s = axisScale(vals), lo = Math.min(...vals), hi = Math.max(...vals), R = s.hi - s.lo;
    assert.ok(lo - s.lo > 0 && s.hi - hi > 0, 'strictly inside');
    assert.ok((lo - s.lo) / R <= .2 && (s.hi - hi) / R <= .2, `${vals}: [${s.lo}, ${s.hi}]`);
  }
  const dr = axisScale([105.4, 125.4]);
  assert.equal(dr.ticks[1] - dr.ticks[0], 5);   // DRtg is not pushed to 10 or 20
});

test('a single value still gets a usable axis', () => {
  const s = axisScale([52, 52]);
  assert.ok(s.hi > s.lo && s.ticks.length >= 2);
});

test('equal scale: both axes share range and ticks, and the diagonal is exactly 45° on the square plot', () => {
  const xs = [0.49, 0.51, 0.53], ys = [0.47, 0.5, 0.56], [sx, sy] = equalScale(xs, ys);
  assert.deepEqual(sx, sy);
  assert.ok(sx.lo < 0.47 && sx.hi > 0.56);
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
