/* The per-game chart of one metric on a card: title and value, the LAST 5 / LAST 10 averages, the bars chart, and (players) the sample's level, range and variation. */
import * as Windows from '../../core/windows.js';
import { esc } from '../../core/html.js';
import { fmt } from '../../core/format.js';
import { loadSeries } from '../../core/game-series.js';
import { barsChart } from './bars-chart.js';

const lastBox = (series, n, m) => {
  const w = series.window(n);
  return `<div class="fw-ibox"><span>LAST ${n} AVG</span><strong>${fmt(w, m)}</strong><small>${w.used} of ${w.of} team games</small></div>`;
};

export async function trendBlock(cs, view, season, byId) {
  const m = byId[cs.selected], series = await loadSeries(cs.entity, cs.id, cs.selected), cur = view.get(cs.id, cs.selected), base = season.get(cs.id, cs.selected);
  let insight = '';
  if (cs.entity === 'players') {
    const last = Windows.spec(cs).last ?? Infinity, inWin = series.points.filter(p => Number.isFinite(p.value) && series.inWindow(last).includes(p.game)).map(p => p.value), n = inWin.length, mean = inWin.reduce((a, b) => a + b, 0) / (n || 1);
    const sd = n > 1 ? Math.sqrt(inWin.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : null, u = m.format.suffix, dg = m.format.digits;
    const box = (t, v, s) => `<div class="fw-ibox"><span>${t}</span><strong>${v}</strong><small>${s}${n < 3 ? ' · <em class="fw-small">small sample</em>' : ''}</small></div>`, ag = k => k + (k === 1 ? ' game' : ' games');
    insight = `<div class="fw-iboxes">${box('Season level', fmt(base, m), ag(season.get(cs.id, 'gp').value) + ' · Season')}${box('Range of appearances', n ? inWin.reduce((a, b) => Math.min(a, b)).toFixed(dg) + u + ' – ' + inWin.reduce((a, b) => Math.max(a, b)).toFixed(dg) + u : '—', ag(n) + ' · ' + Windows.label(cs))}${box('Variation', Number.isFinite(sd) ? 'σ ' + sd.toFixed(dg) + (m.kind === 'pct' ? ' pp' : '') : '—', 'standard deviation · ' + ag(n) + ' · ' + Windows.label(cs))}</div>`;
  }
  return `<section class="fw-trend"><div class="fw-section-title"><h3>${esc(m.label)}</h3><b>${fmt(cur, m)}</b></div><div class="fw-iboxes fw-last">${lastBox(series, 5, m)}${lastBox(series, 10, m)}</div>${barsChart(series, m)}${insight}</section>`;
}
