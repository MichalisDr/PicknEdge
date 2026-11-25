// The axis range of a scatter is computed once from all four windows (it never moves with the window) and leaves a visible gap around the data. Synthetic teams only: no data file can fail this.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Data } from '../../site/core/data.js';
import * as Windows from '../../site/core/windows.js';
import { galleryHtml } from '../../site/fantasy/gallery/gallery.js';
import { CHARTS } from '../../site/fantasy/gallery/charts.js';
import { axisRule } from '../../site/fantasy/gallery/axes.js';

// where each metric of the Teams charts lives: [middle, half width]; every window is shifted, and one team of Last 3 is far out
const RANGES = { pace: [74, 4], drtg: [116, 11], o_efg: [55, 6], o_exp_efg: [54, 3], o_tov100: [16, 4], t_dreb_pct: [67, 6], o_a3_rate: [43, 7], o_fg3_pct: [36, 5], o_rim_rate: [18, 7], o_zs_rim_pct: [78, 12] };
const SHIFT = { season: 0, l10: 0.2, l5: -0.4, l3: 0.7 }, TEAMS = Array.from({ length: 20 }, (_, i) => 'T' + i);
const valueOf = (win, id, metric) => {
  const [mid, half] = RANGES[metric], i = TEAMS.indexOf(id), v = mid + half * (((i * 7) % 20) / 10 - 1) + SHIFT[win] * half / 3 + (win === 'l3' && i === 3 ? half * 2.5 : 0);
  return metric === 'o_zs_rim_pct' ? Math.min(100, v) : v;   // a FG% cannot pass 100
};
const VIEWS = Object.fromEntries(Windows.LIST.map(([w]) => [w, { kind: 'teams', window: w, keys: TEAMS, row: () => ({}), get: (id, m) => ({ value: valueOf(w, id, m) }), league: m => ({ value: RANGES[m][0] }) }]));
const BYID = Object.fromEntries(Object.keys(RANGES).map(id => [id, { id, label: id, format: { digits: 1, suffix: '' }, direction: 1 }]));
Object.assign(Data, { metrics: async () => ({ list: Object.values(BYID), byId: BYID }), roster: async () => ({ teams: {}, players: {}, logoIds: {} }), view: async (kind, w) => VIEWS[w] });

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
  const views = Object.values(VIEWS);
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
