// The ends of the eight gallery charts, computed from the real data in site/data with the declared steps. This table was agreed for the data of the day it was written:
// when new games or credits move an extreme past an end, the rule still holds (scatter-scale.test.mjs); update the table here after checking the extreme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
const Windows = await import('../../site/core/windows.js');
const { galleryHtml } = await import('../../site/fantasy/gallery/gallery.js');
const { CHARTS } = await import('../../site/fantasy/gallery/charts.js');

const EXPECTED = {   // chart: [x low, x high, y low, y high]
  'teams-pace-drtg': [69, 81, 100, 140],
  'teams-efg-tov': [46, 70, 8, 26],
  'teams-dreb-efg': [58, 76, 46, 70],
  'teams-3pa-3p': [34, 56, 28, 50],
  'teams-expected-efg': [46, 70, 46, 70],
  'teams-rim-defense': [6, 32, 60, 100],
  'players-price-pir': [4, 21, 0, 30],
  'players-volume-efficiency': [5, 40, 25, 105],
};

const un = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

test('real data: the ends of all eight charts, identical in all four windows', async () => {
  assert.deepEqual(Object.keys(EXPECTED).sort(), CHARTS.map(c => c.id).sort(), 'every chart is in the table');
  for (const [win] of Windows.LIST) {
    const got = {};
    for (const kind of ['teams', 'players']) for (const view of ['profile', 'shooting']) {
      const html = await galleryHtml(kind, view, { win, view, showAll: false });
      for (const m of html.matchAll(/data-chart-id="([^"]+)"[\s\S]*?data-plot="([^"]+)"/g)) { const j = JSON.parse(un(m[2])); got[m[1]] = [j.sx.lo, j.sx.hi, j.sy.lo, j.sy.hi]; }
    }
    assert.deepEqual(got, EXPECTED, win);
  }
});
