// Quadrant colouring: the favourable direction per axis comes from metrics.json (no second list); green = favourable on both axes, red = unfavourable on both, mixed = none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARTS } from '../../site/fantasy/gallery/charts.js';
import { favourable, quadrantTone, diagonalTone } from '../../site/fantasy/gallery/tint.js';
import { drawScatter } from '../../site/fantasy/gallery/scatter.js';
import { axisScale } from '../../site/fantasy/gallery/scale.js';

const metrics = JSON.parse(readFileSync(new URL('../../site/data/metrics.json', import.meta.url), 'utf8')), list = metrics.metrics || metrics;
const dir = id => list.find(m => m.id === id).direction;

test('favourable direction per axis for the six charts (+1 = high favours the opposing player)', () => {
  const rows = CHARTS.map(c => ({ chart: c.id, x: `${c.x} ${favourable(dir(c.x))}`, y: `${c.y} ${favourable(dir(c.y))}` }));
  console.log(rows.map(r => `${r.chart}: x ${r.x} | y ${r.y}`).join('\n'));
  const fav = id => favourable(dir(id));
  assert.equal(CHARTS.length, 6);
  assert.equal(fav('drtg'), 1); assert.equal(fav('o_efg'), 1); assert.equal(fav('o_exp_efg'), 1);
  assert.equal(fav('o_tov100'), -1); assert.equal(fav('t_dreb_pct'), -1);
  assert.equal(fav('pace'), 0, 'Pace has no judgement in the metric data (direction 0)');
  for (const id of ['o_a3_rate', 'o_fg3_pct', 'o_rim_rate', 'o_zs_rim_pct']) assert.equal(fav(id), 1, id);
});

test('quadrant tones: both favourable = good, both unfavourable = bad, mixed = none; an axis without judgement is left out', () => {
  const fav = { x: 1, y: 1 };
  assert.equal(quadrantTone(fav, true, true), 'good');
  assert.equal(quadrantTone(fav, false, false), 'bad');
  assert.equal(quadrantTone(fav, true, false), '');
  assert.equal(quadrantTone(fav, false, true), '');
  const mixed = { x: -1, y: 1 };   // low x and high y favour the opponent: the top-left quadrant
  assert.equal(quadrantTone(mixed, false, true), 'good');
  assert.equal(quadrantTone(mixed, true, false), 'bad');
  assert.equal(quadrantTone({ x: 0, y: 1 }, true, true), 'good');   // Pace x DRtg: DRtg decides alone
  assert.equal(quadrantTone({ x: 0, y: 1 }, true, false), 'bad');
  assert.equal(quadrantTone({ x: 0, y: 0 }, true, true), '');
});

test('the drawn chart has one tint per quadrant with the right class, none for mixed ones; thumbnails and opened card both tint', () => {
  const sx = axisScale([50, 60]), sy = axisScale([100, 120]);
  const model = { title: 't', xTitle: 'x', yTitle: 'y', equal: false, fav: { x: 1, y: 1 }, sx, sy, avg: { x: 55, y: 110 }, pts: [] };
  for (const mode of ['thumb', 'full']) {
    const svg = drawScatter(model, 640, false, mode), tints = [...svg.matchAll(/class="fc-q (good|bad)" x="([\d.]+)" y="([\d.]+)"/g)];
    assert.equal(tints.length, 2);
    const top = tints.find(t => +t[3] < 200), right = tints.find(t => +t[2] > 200);
    assert.equal(tints.find(t => t[1] === 'good')[2] > 200 && tints.find(t => t[1] === 'good')[3] < 200, true, 'good = top right');
    assert.ok(top && right);
    assert.equal(tints.find(t => t[1] === 'bad')[2] < 200, true, 'bad = bottom left');
  }
});

test('x = y chart: above the diagonal (opponent shoots better than expected) is green, below red', () => {
  assert.equal(diagonalTone({ x: 1, y: 1 }, true), 'good');
  assert.equal(diagonalTone({ x: 1, y: 1 }, false), 'bad');
  const s = axisScale([48, 60]), svg = drawScatter({ title: 't', xTitle: 'x', yTitle: 'y', equal: true, fav: { x: 1, y: 1 }, sx: s, sy: s, avg: null, pts: [] }, 640, false, 'full');
  assert.ok(/<polygon class="fc-q good"/.test(svg) && /<polygon class="fc-q bad"/.test(svg));
});
