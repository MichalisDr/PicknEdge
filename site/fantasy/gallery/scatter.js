/* One comparative scatter chart as an SVG string: points are the entities of the current view, dashed lines are the league values from the view's league row,
   tones come from each metric's direction. A point is clickable (class fc-pt, data-open) and opens the card. */
import { esc } from '../../core/html.js';

const GOOD = '#DFFBE9', BAD = '#F6E0E3', NEUTRAL = '#FBFFDF';

function nice(lo, hi, count = 4) {
  const raw = (hi - lo) / count || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12) || 10 * mag, ticks = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(8));
  return ticks;
}
const tone = (sx, dx, sy, dy) => { const n = (sx !== 0) + (sy !== 0); if (!n) return NEUTRAL; const s = (sx * dx + sy * dy) / n; return s > 0 ? GOOD : s < 0 ? BAD : NEUTRAL; };

export function scatter(chart, view, ids, byId, roster) {
  const mx = byId[chart.x], my = byId[chart.y], pts = [];
  for (const id of ids) {
    const a = view.get(id, chart.x)?.value, b = view.get(id, chart.y)?.value;
    if (Number.isFinite(a) && Number.isFinite(b)) pts.push({ id, a, b, name: chart.entity === 'teams' ? roster.teams[id] || id : roster.players[id]?.name || id, pos: view.row(id)?.pos });
  }
  if (pts.length < 2) return '<p class="fw-empty">Not enough data for this chart.</p>';
  const Wd = 520, H = 360, L = 52, R = 14, Tp = 14, B = 44;
  const ext = k => { const v = pts.map(p => p[k]), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * .06 || 1; return [lo - pad, hi + pad]; };
  let [x0, x1] = ext('a'), [y0, y1] = ext('b');
  if (chart.equal) { x0 = y0 = Math.min(x0, y0); x1 = y1 = Math.max(x1, y1); }
  const X = v => L + (v - x0) / (x1 - x0) * (Wd - L - R), Y = v => H - B - (v - y0) / (y1 - y0) * (H - B - Tp);
  const lx = chart.noAvg ? null : view.league(chart.x)?.value, ly = chart.noAvg ? null : view.league(chart.y)?.value, sx = chart.entity === 'teams' ? -mx.direction : mx.direction, sy = chart.entity === 'teams' ? -my.direction : my.direction;   // team lens: green = favourable for the opposing player
  const dot = p => {
    const color = chart.residual ? (p.b - p.a > 0.05 ? GOOD : p.b - p.a < -0.05 ? BAD : NEUTRAL) : tone(sx, Math.sign(p.a - lx), sy, Math.sign(p.b - ly));
    return `<g class="fc-pt" data-open="${esc(p.id)}" tabindex="0"><circle cx="${X(p.a).toFixed(1)}" cy="${Y(p.b).toFixed(1)}" r="${chart.entity === 'teams' ? 5 : 3.5}" fill="${color}" stroke="#0b1018"><title>${esc(p.name)} · ${esc(mx.label)} ${p.a.toFixed(mx.format.digits)}${mx.format.suffix} · ${esc(my.label)} ${p.b.toFixed(my.format.digits)}${my.format.suffix}</title></circle>${chart.entity === 'teams' ? `<text x="${(X(p.a) + 7).toFixed(1)}" y="${(Y(p.b) + 3).toFixed(1)}" class="fc-pl">${esc(p.id)}</text>` : ''}</g>`;
  };
  const ticks = (lo, hi, f, vertical) => nice(lo, hi).map(v => vertical
    ? `<line class="fc-tick" x1="${X(v)}" x2="${X(v)}" y1="${Tp}" y2="${H - B}"/><text x="${X(v)}" y="${H - B + 15}" text-anchor="middle">${v}</text>`
    : `<line class="fc-tick" x1="${L}" x2="${Wd - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  const avg = Number.isFinite(lx) && Number.isFinite(ly) ? `<line class="fc-avg" x1="${X(lx)}" x2="${X(lx)}" y1="${Tp}" y2="${H - B}" stroke-dasharray="4 4" stroke="#6b7c93"/><line class="fc-avg" x1="${L}" x2="${Wd - R}" y1="${Y(ly)}" y2="${Y(ly)}" stroke-dasharray="4 4" stroke="#6b7c93"/>` : '';
  return `<svg viewBox="0 0 ${Wd} ${H}" class="fc-svg" role="img" aria-label="${esc(chart.title)}">${ticks(x0, x1, X, true)}${ticks(y0, y1, Y, false)}${avg}${chart.equal ? `<line x1="${X(x0)}" y1="${Y(x0)}" x2="${X(x1)}" y2="${Y(x1)}" stroke="#6b7c93" stroke-dasharray="2 4"/>` : ''}<line x1="${L}" x2="${Wd - R}" y1="${H - B}" y2="${H - B}" stroke="#3b4655"/><line x1="${L}" x2="${L}" y1="${Tp}" y2="${H - B}" stroke="#3b4655"/>
    <text class="fc-ax" x="${(L + Wd - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(mx.label)}</text><text class="fc-ax" transform="translate(13 ${(Tp + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(my.label)}</text>${pts.map(dot).join('')}</svg>`;
}