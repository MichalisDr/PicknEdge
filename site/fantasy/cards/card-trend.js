/* The trend of one metric on a card (chart plus the player's range and variation), and the same chart as a self-contained string for the table hover. */
import { Data } from '../../core/data.js';
import * as Windows from '../../core/windows.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { trendChart, diffOf } from './chart.js';
import { series, leagueBand } from './card-data.js';

/** Chart for a metric id as a self-contained html string (also used by the table hover). */
export async function curveHtml(entity, id, metricId, { spec = null, small = false, views = null } = {}) {
  const eng = await Data.engine(), def = eng.byId(metricId), { byId } = await Data.metrics(), m = byId[metricId];
  const [pts, league] = await Promise.all([series(entity, id, def, spec && Object.keys(spec).length ? spec : null), leagueBand(entity, def)]);
  const kind = entity;
  const season = views ? views.season.get(id, metricId)?.value : (await Data.view(kind, 'season')).get(id, metricId)?.value;
  const cur = views && views.cur ? views.cur.get(id, metricId)?.value : null;
  return trendChart(pts, m, { small, ref: season, league, diff: views && views.cur && views.winName !== 'season' ? diffOf(cur, season, m) : null });
}

export async function trendBlock(cs, view, season, byId) {
  const m = byId[cs.selected], eng = await Data.engine(), spec = cs.win === 'season' ? null : Windows.spec(cs);
  const [pts, league] = await Promise.all([series(cs.entity, cs.id, eng.byId(cs.selected), spec), leagueBand(cs.entity, eng.byId(cs.selected))]);
  const cur = view.get(cs.id, cs.selected), base = season.get(cs.id, cs.selected);
  let insight = '';
  if (cs.entity === 'players') {
    const inWin = pts.filter(p => p.recent && Number.isFinite(p.value)).map(p => p.value), n = inWin.length, mean = inWin.reduce((a, b) => a + b, 0) / (n || 1);
    const sd = n > 1 ? Math.sqrt(inWin.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : null, u = m.format.suffix, dg = m.format.digits;
    const box = (t, v, s) => `<div class="fw-ibox"><span>${t}</span><strong>${v}</strong><small>${s}${n < 3 ? ' · <em class="fw-small">small sample</em>' : ''}</small></div>`, ag = k => k + (k === 1 ? ' game' : ' games');
    insight = `<div class="fw-iboxes">${box('Season level', fmt(base, m), ag(season.get(cs.id, 'gp').value) + ' · Season')}${box('Range of appearances', n ? inWin.reduce((a, b) => Math.min(a, b)).toFixed(dg) + u + ' – ' + inWin.reduce((a, b) => Math.max(a, b)).toFixed(dg) + u : '—', ag(n) + ' · ' + Windows.label(cs))}${box('Variation', Number.isFinite(sd) ? 'σ ' + sd.toFixed(dg) + (m.kind === 'pct' ? ' pp' : '') : '—', 'standard deviation · ' + ag(n) + ' · ' + Windows.label(cs))}</div>`;
  }
  return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${fmt(cur, m)}</b></div>${trendChart(pts, m, { ref: base.value, league, diff: cs.win === 'season' ? null : diffOf(cur.value, base.value, m) })}${insight}</section>`;
}