// Logos that overlap are nudged apart by the smallest push, never further than half a logo from their data point; 
import test from 'node:test';
import assert from 'node:assert/strict';
import { separateBoxes, overlapPairs } from '../../site/fantasy/gallery/scale.js';
import { logoBox } from '../../site/fantasy/gallery/logo-fit.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';

const box = (x, y, w = 32, h = 32) => ({ x, y, w, h });

test('a pair that overlaps is separated by the smaller of the two pushes, half each', () => {
  const items = [box(100, 100), box(110, 100)];   // 22 px of overlap in x (plus 4 air), 32 in y: it moves in x only
  const p = separateBoxes(items, 4, 16);
  assert.equal(p[0].y, 100); assert.equal(p[1].y, 100);
  assert.ok(p[1].x - p[0].x >= 32 - 1e-6 && p[1].x - p[0].x <= 36 + 1e-3, 'now touching with at most the air');
  assert.equal(overlapPairs(p, items), 0);
});

test('a logo nothing touches does not move', () => {
  const items = [box(10, 10), box(200, 200), box(205, 200)];
  const p = separateBoxes(items, 4, 16);
  assert.deepEqual(p[0], { x: 10, y: 10 });
});

test('no logo ever ends further than the maximum shift (half the logo) from its data point', () => {
  const items = Array.from({ length: 12 }, (_, i) => box(100 + (i % 3) * 2, 100 + Math.floor(i / 3) * 2));   // a dense cluster
  const p = separateBoxes(items, 4, 16);
  p.forEach((q, i) => assert.ok(Math.hypot(q.x - items[i].x, q.y - items[i].y) <= 16 + 1e-9, 'point ' + i));
});

test('two logos exactly on top of each other are split sideways', () => {
  const items = [box(50, 50), box(50, 50)];
  const p = separateBoxes(items, 4, 20);
  assert.ok(p[0].x !== p[1].x || p[0].y !== p[1].y);
});

test('overlapPairs counts the pairs of boxes that still cover each other', () => {
  assert.equal(overlapPairs([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 100, y: 0 }], [box(0, 0), box(0, 0), box(0, 0)]), 1);
  assert.equal(overlapPairs([{ x: 0, y: 0 }, { x: 32, y: 0 }], [box(0, 0), box(0, 0)]), 0, 'touching is not overlapping');
});

test('logoBox: the larger side of the visible artwork is the box', () => {
  const b = logoBox('assets/logos/dubai.png', 32);
  assert.ok(Math.abs(Math.max(b.w, b.h) - 32) < 1e-9 && b.w > 0 && b.h > 0);
  assert.deepEqual(logoBox('assets/logos/unknown-team.png', 24), { w: 24, h: 24 });
});

test('a drawn opened card: every logo size is a multiple of 4, from the 16 floor to the 40 maximum', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ id: 'T' + i, a: 54 + (i % 5) * .2, b: 54 + Math.floor(i / 5) * .2, name: 'T' + i, logo: 'assets/logos/dubai.png', tip: 't' }));
  const sc = { lo: 45, hi: 70, ticks: [45, 50, 55, 60, 65, 70], thumb: [45, 55, 65], step: 5, digits: 0 };
  const svg = drawScatter({ fav: { x: true, y: true }, title: 't', xTitle: 'x', yTitle: 'y', equal: true, sx: sc, sy: sc, avg: null, pts }, 670, false, 'full', 670);
  const sizes = [...svg.matchAll(/<circle class="fc-hit" r="([\d.]+)"/g)].map(m => +m[1] * 2);
  assert.equal(sizes.length, 20);
  for (const s of sizes) assert.ok(s % 4 === 0 && s >= 16 && s <= 40, 'logo size ' + s);
});
