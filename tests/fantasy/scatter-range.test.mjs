// The axis range of a scatter is computed once from all four windows (it never moves with the window) and leaves a visible gap around the data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRealData } from '../helpers/site-data.mjs';

useRealData();
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

test('min and max of every chart (over all windows) sit strictly inside the axis range with a visible gap and a bounded empty margin; the x = y chart shares one range', async () => {
  for (const view of ['profile', 'shooting']) {
    const m = await models(view, 'season');
    for (const c of CHARTS.filter(c => c.view === view)) {
      const vals = id => Windows.LIST.map(w => w[0]);
      const views = await Promise.all(Windows.LIST.map(w => Windows.view('teams', { win: w[0] }, w[0])));
      const range = id => { const v = views.flatMap(vw => vw.keys.map(k => vw.get(k, id)?.value)).filter(Number.isFinite); return [Math.min(...v), Math.max(...v)]; };
      for (const [id, s] of [[c.x, m[c.id].sx], [c.y, m[c.id].sy]]) {
        const [lo, hi] = c.equal ? [Math.min(...range(c.x), ...range(c.y)), Math.max(...range(c.x), ...range(c.y))] : range(id), span = hi - lo;
        const R = s.hi - s.lo;
        assert.ok(s.lo < lo - span * .04 && s.hi > hi + span * .04, `${c.id} ${id}: [${lo}, ${hi}] inside [${s.lo}, ${s.hi}] with a gap of at least 4% of the data range`);
        // about 10% is the aim; the all-windows ranges are wide and the steps stay fine (1/2/5), so a few axes end up to 20%
        assert.ok((lo - s.lo) / R <= .2 && (s.hi - hi) / R <= .2 || c.equal, `${c.id} ${id}: empty margin ${((lo - s.lo) / R * 100).toFixed(1)}% / ${((s.hi - hi) / R * 100).toFixed(1)}%`);
      }
      if (c.equal) assert.deepEqual(m[c.id].sx, m[c.id].sy);
    }
  }
});
