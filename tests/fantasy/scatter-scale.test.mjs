// The shared scale of the gallery scatters: padding, 4–6 round ticks, no forced zero, equal range for the x = y chart, logo separation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisScale, equalScale, niceTicks, separate } from '../../site/fantasy/gallery/scale.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('axis fits the data with a small padding and does not force zero', () => {
  const s = axisScale([98.2, 101.5, 104.9, 110.3]);
  assert.ok(s.lo < 98.2 && s.hi > 110.3, 'padded on both sides');
  assert.ok(s.lo > 94 && s.hi < 115, 'padding is small');
  assert.ok(s.lo > 0, 'no zero baseline');
});

test('4 to 6 round ticks inside the domain, for ranges of any size', () => {
  for (const vals of [[98.2, 110.3], [0.46, 0.58], [13.1, 19.4], [1000, 25000], [3.001, 3.004], [-4, 7]]) {
    const s = axisScale(vals), { step } = niceTicks(s.lo, s.hi);
    assert.ok(s.ticks.length >= 4 && s.ticks.length <= 6, `${vals}: ${s.ticks}`);
    assert.ok(s.ticks.every(t => t >= s.lo - 1e-9 && t <= s.hi + 1e-9));
    const mant = step / Math.pow(10, Math.floor(Math.log10(step)));
    assert.ok([1, 2, 2.5, 5].some(m => Math.abs(m - mant) < 1e-6), `round step ${step}`);
  }
});

test('digits follow the step so tick labels are exact', () => {
  assert.equal(axisScale([95, 120]).digits, 0);
  assert.equal(axisScale([0.46, 0.58]).digits, 3);
});

test('a single value still gets a usable axis', () => {
  const s = axisScale([52, 52]);
  assert.ok(s.hi > s.lo && s.ticks.length >= 2);
});

test('equal scale: both axes share range and ticks, and the diagonal is exactly 45° on the square plot', () => {
  const xs = [0.49, 0.51, 0.53], ys = [0.47, 0.5, 0.56], [sx, sy] = equalScale(xs, ys);
  assert.deepEqual(sx, sy);
  assert.ok(sx.lo < 0.47 && sx.hi > 0.56);
  const model = { title: 't', xTitle: 'x', yTitle: 'y', equal: true, sx, sy, avg: null, pts: [] };
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
