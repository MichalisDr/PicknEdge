// The axis range of a scatter is computed once from all four windows (it never moves with the window) and leaves a visible gap around the data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
const { axisRule } = await import('../../site/fantasy/gallery/axes.js');
const { Data } = await import('../../site/core/data.js');
const Windows = await import('../../site/core/windows.js');
const { galleryHtml } = await import('../../site/fantasy/gallery/gallery.js');
const { CHARTS } = await import('../../site/fantasy/gallery/charts.js');

const un = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const models = async (view, win) => {
  const html = await galleryHtml('teams', view, { win, view }), out = {};
  for (const m of html.matchAll(/data-chart-id="([^"]+)"[\s\S]*?data-plot="([^"]+)"/g)) out[m[1]] = JSON.parse(un(m[2]));
  return out;
};

test('every chart has the identical axis range in all four windows (Season, Last 10, Last 5, Last 3)', async () => {
  for (const view of ['profile', 'shooting']) {
    const per = await Promise.all(Windows.LIST.map(w => models(view, w[0])));
    for (const id of Object.keys(per[0])) for (const p of per.slice(1)) {
      assert.deepEqual(p[id].sx, per[0][id].sx, `${id} x`);
      assert.deepEqual(p[id].sy, per[0][id].sy, `${id} y`);
    }
  }
});

test('every extreme (over all windows) lies strictly inside the axis range with a gap of at most one step (none past a ceiling); edges and ticks are multiples of the step; the x = y chart has equal ranges', async () => {
  const views = await Promise.all(Windows.LIST.map(w => Windows.view('teams', { win: w[0] }, w[0])));
  const range = id => { const v = views.flatMap(vw => vw.keys.map(k => vw.get(k, id)?.value)).filter(Number.isFinite); return [Math.min(...v), Math.max(...v)]; };
  for (const view of ['profile', 'shooting']) {
    const m = await models(view, 'season');
    for (const c of CHARTS.filter(c => c.entity === 'teams' && c.view === view)) {
      for (const [id, s] of [[c.x, m[c.id].sx], [c.y, m[c.id].sy]]) {
        const [lo, hi] = c.equal ? [Math.min(...range(c.x), ...range(c.y)), Math.max(...range(c.x), ...range(c.y))] : range(id);
        assert.ok(s.lo < lo && (s.hi > hi || s.hi === axisRule(id).ceiling), `${c.id} ${id}: [${lo}, ${hi}] strictly inside [${s.lo}, ${s.hi}]`);
        assert.ok(lo - s.lo <= s.step + 1e-9 && s.hi - hi <= s.step + 1e-9, `${c.id} ${id}: gap of at most one step (${s.step})`);
        for (const t of [s.lo, s.hi, ...s.ticks]) assert.ok(Math.abs(t / s.step - Math.round(t / s.step)) < 1e-6, `${c.id} ${id}: ${t} is a multiple of ${s.step}`);
      }
      if (c.equal) assert.deepEqual(m[c.id].sx, m[c.id].sy);
    }
  }
});
